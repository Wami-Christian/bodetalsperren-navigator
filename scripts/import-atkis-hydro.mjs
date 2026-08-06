#!/usr/bin/env node
/**
 * HarzFishing Navigator – official ATKIS/INSPIRE Hydro importer.
 *
 * Data source:
 *   INSPIRE-WFS ST Hydro – Physische Gewässer ATKIS Basis-DLM
 *   © GeoBasis-DE / LVermGeo ST, Datenlizenz Deutschland – Namensnennung – 2.0
 *
 * The script deliberately separates confident matches from review candidates.
 * It never promotes an uncertain result automatically.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, 'data', 'lav-catalog.ts');
const OUTPUT = path.join(ROOT, 'data', 'atkis-water-matches.generated.ts');
const REVIEW = path.join(ROOT, 'data', 'atkis-water-review.csv');
const FEATURE_CACHE = path.join(ROOT, 'data', 'atkis-hydro-cache.json');
const LOCALITY_CACHE = path.join(ROOT, 'data', 'locality-cache.json');
const CAPABILITIES_CACHE = path.join(ROOT, 'data', 'atkis-getcapabilities.xml');

const WFS_BASE = 'https://geodatenportal.sachsen-anhalt.de/ows_INSPIRE_LVermGeo_ATKIS_HY-P_WFS';
const SOURCE = '© GeoBasis-DE / LVermGeo ST, Datenlizenz Deutschland – Namensnennung – 2.0';
const args = process.argv.slice(2);
const option = (name, fallback = '') => args.find((x) => x.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || fallback;
const flag = (name) => args.includes(`--${name}`);
const limit = Number(option('limit', '0')) || Infinity;
const start = Number(option('start', '0')) || 0;
const pageSize = Math.max(50, Math.min(5000, Number(option('page-size', '1000')) || 1000));
const refresh = flag('refresh');
const email = option('email', process.env.NOMINATIM_EMAIL || '');
const userAgent = `HarzFishingNavigator-ATKIS-importer/1.0${email ? ` (${email})` : ''}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (value = '') => String(value)
  .toLocaleLowerCase('de-DE')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ß/g, 'ss')
  .replace(/[’'`´]/g, '')
  .replace(/\b(der|die|das|des|den|dem|am|an|im|in|bei|von|vom|zum|zur|und|teich|see|weiher|kuhle|kiesgrube|wasser|speicher|stausee)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ').trim();

const tokens = (value) => new Set(normalize(value).split(' ').filter((x) => x.length > 2));
function jaccard(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const token of A) if (B.has(token)) common++;
  return common / (A.size + B.size - common);
}
function exactish(a, b) {
  const A = normalize(a), B = normalize(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (A.includes(B) || B.includes(A)) return Math.min(A.length, B.length) / Math.max(A.length, B.length);
  return jaccard(A, B);
}

function extractCatalog(text) {
  const marker = 'export const lavCatalog: FishingWater[] =';
  const pos = text.indexOf(marker);
  if (pos < 0) throw new Error('data/lav-catalog.ts: lavCatalog export not found');
  const begin = text.indexOf('[', text.indexOf('=', pos));
  const end = text.lastIndexOf('];');
  return JSON.parse(text.slice(begin, end + 1));
}
async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: 'application/xml,text/xml,*/*' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${(await response.text()).slice(0, 500)}`);
  return response.text();
}
async function fetchGml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/gml+xml,text/xml,application/xml,*/*',
    },
  });
  const text = await response.text();
  if (!response.ok) {
    const detail = text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 900);
    throw new Error(`${response.status} ${response.statusText}: ${detail}`);
  }
  return text;
}

function decodeXml(value = '') {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function xmlTextValues(block) {
  const out = [];
  const pattern = /<(?:\w+:)?(?:text|name|spelling|label|localId|identifier|geographicalName)[^>]*>([\s\S]*?)<\/(?:\w+:)?(?:text|name|spelling|label|localId|identifier|geographicalName)>/gi;
  for (const match of block.matchAll(pattern)) {
    const text = decodeXml(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (text.length > 1 && text.length < 180) out.push(text);
  }
  return [...new Set(out)];
}

function coordinatePairsFromGml(block) {
  const pairs = [];
  const coordinateBlocks = [
    ...block.matchAll(/<(?:\w+:)?posList\b[^>]*>([\s\S]*?)<\/(?:\w+:)?posList>/gi),
    ...block.matchAll(/<(?:\w+:)?pos\b[^>]*>([\s\S]*?)<\/(?:\w+:)?pos>/gi),
  ];
  for (const match of coordinateBlocks) {
    const values = match[1].trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
    for (let i = 0; i + 1 < values.length; i += 2) {
      const a = values[i], b = values[i + 1];
      let longitude, latitude;
      // EPSG:4258/4326 from INSPIRE is commonly returned in latitude/longitude axis order.
      if (a >= 49 && a <= 55 && b >= 5 && b <= 16) {
        latitude = a; longitude = b;
      } else if (b >= 49 && b <= 55 && a >= 5 && a <= 16) {
        longitude = a; latitude = b;
      } else {
        continue;
      }
      pairs.push([longitude, latitude]);
    }
  }
  return pairs;
}

function geometryFromGml(block) {
  const pairs = coordinatePairsFromGml(block);
  if (!pairs.length) return null;
  const isPolygon = /<(?:\w+:)?(?:Polygon|Surface|MultiSurface)\b/i.test(block);
  const isLine = /<(?:\w+:)?(?:LineString|Curve|MultiCurve)\b/i.test(block);
  if (isPolygon) return { type: 'Polygon', coordinates: [pairs] };
  if (isLine) return { type: 'LineString', coordinates: pairs };
  return { type: 'Point', coordinates: pairs[0] };
}

function parseGmlFeatureCollection(xml, typeName) {
  const blocks = [
    ...(xml.match(/<(?:wfs:)?member\b[\s\S]*?<\/(?:wfs:)?member>/gi) || []),
    ...(xml.match(/<(?:gml:)?featureMember\b[\s\S]*?<\/(?:gml:)?featureMember>/gi) || []),
  ];
  const features = [];
  for (const block of blocks) {
    const geometry = geometryFromGml(block);
    if (!geometry) continue;
    const id = block.match(/(?:gml:)?id=["']([^"']+)["']/i)?.[1] || '';
    const names = xmlTextValues(block);
    features.push({ id, geometry, properties: { names } });
  }
  const numberReturned = Number(xml.match(/numberReturned=["'](\d+)["']/i)?.[1] || features.length);
  return { features, numberReturned };
}

function parseFeatureTypes(xml) {
  const blocks = xml.match(/<(?:\w+:)?FeatureType\b[\s\S]*?<\/(?:\w+:)?FeatureType>/g) || [];
  return blocks.map((block) => {
    const name = block.match(/<(?:\w+:)?Name>([^<]+)<\/(?:\w+:)?Name>/)?.[1]?.trim();
    const title = block.match(/<(?:\w+:)?Title>([^<]+)<\/(?:\w+:)?Title>/)?.[1]?.trim() || '';
    return { name, title };
  }).filter((item) => item.name);
}
function selectHydroTypes(types) {
  const preferred = types.filter(({ name, title }) => /standingwater|watercourse|wetland|hydroobject|physicalwaters|gewaesser|gewässer/i.test(`${name} ${title}`));
  return preferred.length ? preferred : types;
}

function collectNameStrings(value, key = '', out = []) {
  if (value == null) return out;
  if (typeof value === 'string') {
    if (/name|geograph|spelling|text|label|bezeich|objektname/i.test(key) && value.trim().length > 1) out.push(value.trim());
    return out;
  }
  if (Array.isArray(value)) for (const item of value) collectNameStrings(item, key, out);
  else if (typeof value === 'object') for (const [k, v] of Object.entries(value)) collectNameStrings(v, k, out);
  return out;
}
function allCoordinates(geometry, out = []) {
  if (!geometry) return out;
  const walk = (value) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') out.push([value[0], value[1]]);
    else for (const item of value) walk(item);
  };
  walk(geometry.coordinates);
  return out;
}
function centroid(geometry) {
  const coords = allCoordinates(geometry);
  if (!coords.length) return null;
  let lon = 0, lat = 0;
  for (const [x, y] of coords) { lon += x; lat += y; }
  return { longitude: lon / coords.length, latitude: lat / coords.length };
}
function ringAreaHa(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  const lat0 = ring.reduce((s, p) => s + Number(p[1] || 0), 0) / ring.length;
  const mx = 111320 * Math.cos(lat0 * Math.PI / 180), my = 110540;
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1,y1] = ring[i], [x2,y2] = ring[(i+1)%ring.length];
    area += (x1*mx)*(y2*my) - (x2*mx)*(y1*my);
  }
  return Math.abs(area / 2) / 10000;
}
function geometryAreaHa(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') return Math.max(0, ringAreaHa(geometry.coordinates?.[0] || []) - (geometry.coordinates?.slice(1) || []).reduce((s,r) => s + ringAreaHa(r), 0));
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.reduce((s,p) => s + Math.max(0, ringAreaHa(p?.[0] || []) - (p?.slice(1) || []).reduce((x,r) => x + ringAreaHa(r),0)), 0);
  return null;
}
function typeClass(typeName, geometry) {
  const text = String(typeName).toLowerCase();
  if (/watercourse|river|stream/.test(text) || /linestring/.test(geometry?.type?.toLowerCase() || '')) return 'flow';
  return 'standing';
}
function expectedClass(water) { return water.type === 'Fließgewässer' ? 'flow' : 'standing'; }
function featureRecord(feature, typeName) {
  const center = centroid(feature.geometry);
  if (!center) return null;
  const names = [...new Set(collectNameStrings(feature.properties))].filter((x) => x.length < 180);
  return {
    id: String(feature.id ?? feature.properties?.localId ?? feature.properties?.identifier ?? ''),
    typeName,
    class: typeClass(typeName, feature.geometry),
    names,
    latitude: center.latitude,
    longitude: center.longitude,
    areaHa: geometryAreaHa(feature.geometry),
  };
}

async function loadOfficialFeatures() {
  if (!refresh) {
    const cached = await readJson(FEATURE_CACHE, null);
    if (cached?.features?.length) {
      console.log(`ATKIS cache: ${cached.features.length} features`);
      return cached.features;
    }
  }
  const capUrl = new URL(WFS_BASE);
  Object.entries({ service:'WFS', version:'2.0.0', request:'GetCapabilities' }).forEach(([k,v]) => capUrl.searchParams.set(k,v));
  console.log('Loading WFS capabilities …');
  const xml = await fetchText(capUrl);
  await fs.writeFile(CAPABILITIES_CACHE, xml);
  const allTypes = parseFeatureTypes(xml);
  const selected = selectHydroTypes(allTypes);
  console.log(`Feature types: ${allTypes.length}; selected hydro types: ${selected.map(x=>x.name).join(', ')}`);
  if (!selected.length) throw new Error('No WFS feature types found. See data/atkis-getcapabilities.xml');

  const records = [];
  for (const { name } of selected) {
    let startIndex = 0;
    for (;;) {
      const url = new URL(WFS_BASE);
      Object.entries({
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeNames: name,
        namespaces: 'xmlns(hy-p,http://inspire.ec.europa.eu/schemas/hy-p/4.0)',
        srsName: 'urn:ogc:def:crs:EPSG::4258',
        outputFormat: 'application/gml+xml; version=3.2',
        count: String(pageSize),
        startIndex: String(startIndex),
      }).forEach(([k,v]) => url.searchParams.set(k,v));
      console.log(`${name}: page starting ${startIndex} …`);
      const xmlPage = await fetchGml(url);
      const collection = parseGmlFeatureCollection(xmlPage, name);
      const features = collection.features;
      for (const feature of features) {
        const record = featureRecord(feature, name);
        if (record && record.latitude >= 50.8 && record.latitude <= 53.2 && record.longitude >= 10.3 && record.longitude <= 13.5) records.push(record);
      }
      if (collection.numberReturned < pageSize || features.length === 0) break;
      startIndex += collection.numberReturned;
    }
  }
  await fs.writeFile(FEATURE_CACHE, JSON.stringify({ source: SOURCE, fetchedAt:new Date().toISOString(), features:records }, null, 2));
  console.log(`Saved ${records.length} official hydro features.`);
  return records;
}

function localityFromWater(water) {
  const name = water.name.replace(/^\d+\.\s*/, '');
  const patterns = [
    /\bbei\s+([^,()\-–]{3,50})/i,
    /\bin\s+([^,()\-–]{3,50})/i,
    /\bam\s+([^,()\-–]{3,50})/i,
    /\bbei\s+(.+)$/i,
  ];
  for (const pattern of patterns) {
    const hit = name.match(pattern)?.[1]?.trim();
    if (hit && !/weg|graben|bach|fluss|teich|see|kuhle/i.test(hit)) return hit;
  }
  const parts = name.split(/,|\(|\)|–|-/).map((x)=>x.trim()).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) : '';
}
async function localityPoint(locality, district, cache) {
  if (!locality) return null;
  const key = `${locality}|${district}`;
  if (key in cache) return cache[key];
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${locality}, ${district}, Sachsen-Anhalt`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'de');
  if (email) url.searchParams.set('email', email);
  const response = await fetch(url, { headers: { 'User-Agent':userAgent, 'Accept-Language':'de', Accept:'application/json' } });
  if (!response.ok) throw new Error(`Locality geocoder ${response.status}`);
  const result = (await response.json())?.[0];
  cache[key] = result ? { latitude:Number(result.lat), longitude:Number(result.lon), displayName:result.display_name } : null;
  await fs.writeFile(LOCALITY_CACHE, JSON.stringify(cache, null, 2));
  await sleep(1100);
  return cache[key];
}
function haversineKm(a,b) {
  const R=6371, rad=(x)=>x*Math.PI/180;
  const dLat=rad(b.latitude-a.latitude), dLon=rad(b.longitude-a.longitude);
  const q=Math.sin(dLat/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}
function areaSimilarity(expected, actual) {
  const e=Number(expected), a=Number(actual);
  if (!Number.isFinite(e) || e<=0 || !Number.isFinite(a) || a<=0) return 0.35;
  return Math.exp(-Math.abs(Math.log(a/e)));
}
function chooseMatch(water, features, locality) {
  const sameClass = features.filter((f)=>f.class===expectedClass(water));
  const named = sameClass.map((f)=>({ f, score:Math.max(0,...f.names.map((n)=>exactish(water.name,n))) })).filter((x)=>x.score>0.25).sort((a,b)=>b.score-a.score);
  if (named[0]?.score >= 0.78 && named[0].score - (named[1]?.score ?? 0) >= 0.08) {
    return { status:'matched', confidence:Math.min(0.99,0.76+named[0].score*0.23), method:'official-name', feature:named[0].f };
  }
  if (!locality) return named[0] ? { status:'review', confidence:named[0].score, method:'official-name', feature:named[0].f } : { status:'unmatched' };
  const nearby = sameClass.map((f)=>{
    const distanceKm=haversineKm(locality,f);
    const area=areaSimilarity(water.areaHa,f.areaHa);
    const name=Math.max(0,...f.names.map((n)=>exactish(water.name,n)));
    const distanceScore=Math.max(0,1-distanceKm/12);
    const score=name*0.36+distanceScore*0.38+area*0.26;
    return {f,score,distanceKm,area,name};
  }).filter((x)=>x.distanceKm<=12).sort((a,b)=>b.score-a.score);
  const best=nearby[0], second=nearby[1];
  if (!best) return { status:'unmatched' };
  const gap=best.score-(second?.score??0);
  if (best.score>=0.78 && gap>=0.09 && best.distanceKm<=6) return { status:'matched', confidence:best.score, method:'locality-area', feature:best.f, distanceKm:best.distanceKm };
  return { status:'review', confidence:best.score, method:'locality-area', feature:best.f, distanceKm:best.distanceKm };
}
function outputRecord(match) {
  if (!match.feature) return { status:match.status, checkedAt:new Date().toISOString(), source:SOURCE };
  return {
    status:match.status,
    latitude:Number(match.feature.latitude.toFixed(7)), longitude:Number(match.feature.longitude.toFixed(7)),
    confidence:Number((match.confidence??0).toFixed(3)), method:match.method,
    officialName:match.feature.names[0] || undefined,
    officialFeatureId:match.feature.id || undefined, officialTypeName:match.feature.typeName,
    areaHa:match.feature.areaHa==null?undefined:Number(match.feature.areaHa.toFixed(3)),
    distanceKm:match.distanceKm==null?undefined:Number(match.distanceKm.toFixed(2)),
    source:SOURCE, checkedAt:new Date().toISOString(),
  };
}
function renderTs(records) {
  const stable=Object.fromEntries(Object.entries(records).sort(([a],[b])=>a.localeCompare(b)));
  return `// AUTO-GENERATED by scripts/import-atkis-hydro.mjs\n// Source: ${SOURCE}\n\nexport interface AtkisWaterMatch {\n  status: \"matched\" | \"review\" | \"unmatched\";\n  latitude?: number; longitude?: number; confidence?: number;\n  method?: \"official-name\" | \"locality-area\";\n  officialName?: string; officialFeatureId?: string; officialTypeName?: string;\n  areaHa?: number; distanceKm?: number; source?: string; checkedAt?: string;\n}\n\nexport const atkisWaterMatchIndex: Record<string, AtkisWaterMatch> = ${JSON.stringify(stable,null,2)};\n`;
}
const csv = (v)=>`"${String(v??'').replaceAll('"','""')}"`;
function renderReview(waters, records) {
  const rows=[['id','lavNumber','name','district','status','confidence','method','latitude','longitude','officialName','distanceKm','officialAreaHa']];
  for (const w of waters) { const r=records[w.id]; if (!r || r.status==='matched') continue; rows.push([w.id,w.lavNumber,w.name,w.district,r.status,r.confidence,r.method,r.latitude,r.longitude,r.officialName,r.distanceKm,r.areaHa]); }
  return rows.map((r)=>r.map(csv).join(';')).join('\n')+'\n';
}

const catalog=extractCatalog(await fs.readFile(CATALOG,'utf8'));
const official=await loadOfficialFeatures();
const localityCache=await readJson(LOCALITY_CACHE,{});
const existing=await import(`${pathToFileURL(OUTPUT).href}?v=${Date.now()}`).then((m)=>m.atkisWaterMatchIndex).catch(()=>({}));
const records={...existing};
const work=catalog.slice(start,Number.isFinite(limit)?start+limit:undefined);
console.log(`LAV entries: ${catalog.length}; processing ${work.length}; official candidates: ${official.length}`);
let i=0;
for (const water of work) {
  const locality=localityFromWater(water);
  let anchor=null;
  try { if (locality) anchor=await localityPoint(locality,water.district,localityCache); }
  catch (error) { console.warn(`Locality lookup failed (${locality}): ${error.message}`); }
  const match=chooseMatch(water,official,anchor);
  records[water.id]=outputRecord(match);
  i++;
  console.log(`${i}/${work.length} ${water.lavNumber??''} ${water.name} -> ${match.status}${match.feature?.names?.[0]?` [${match.feature.names[0]}]`:''}`);
}
await fs.writeFile(OUTPUT,renderTs(records));
await fs.writeFile(REVIEW,renderReview(catalog,records));
const stats=Object.values(records).reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
console.log('Done:',stats); console.log(`Generated ${path.relative(ROOT,OUTPUT)}`); console.log(`Review ${path.relative(ROOT,REVIEW)}`);

function pathToFileURL(filePath) {
  const resolved=path.resolve(filePath).replaceAll('\\','/');
  return new URL(`file://${resolved.startsWith('/')?'':'/'}${resolved}`);
}
