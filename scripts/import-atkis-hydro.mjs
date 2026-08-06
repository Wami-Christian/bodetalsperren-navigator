#!/usr/bin/env node
/**
 * HarzFishing Navigator – multi-source coordinate importer.
 *
 * Sources:
 *  - OpenStreetMap Nominatim: named-water and locality search
 *  - OpenStreetMap Overpass API: nearby water objects around a locality
 *
 * The script is deliberately conservative. Only confident matches become
 * "matched". Borderline candidates are written as "review".
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, 'data', 'lav-catalog.ts');
const OUTPUT = path.join(ROOT, 'data', 'atkis-water-matches.generated.ts');
const REVIEW = path.join(ROOT, 'data', 'atkis-water-review.csv');
const CACHE = path.join(ROOT, 'data', 'osm-water-import-cache.json');

const SOURCE = 'OpenStreetMap contributors (ODbL), Nominatim and Overpass API';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const args = process.argv.slice(2);
const option = (name, fallback = '') => args.find((x) => x.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || fallback;
const flag = (name) => args.includes(`--${name}`);
const limit = Number(option('limit', '0')) || Infinity;
const start = Number(option('start', '0')) || 0;
const radiusM = Math.max(1500, Math.min(12000, Number(option('radius', '7000')) || 7000));
const refresh = flag('refresh');
const email = option('email', process.env.NOMINATIM_EMAIL || '');
const userAgent = `HarzFishingNavigator-coordinate-importer/2.1${email ? ` (${email})` : ''}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => new Date().toISOString();

function normalize(value = '') {
  return String(value)
    .toLocaleLowerCase('de-DE')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[’'`´„“”]/g, '')
    .replace(/\b(der|die|das|des|den|dem|am|an|im|in|bei|von|vom|zum|zur|und)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function waterNameCore(value = '') {
  return normalize(value)
    .replace(/\b(teich|teiche|see|weiher|kuhle|kiesgrube|grube|wasser|wasserspeicher|speicher|stausee|talsperre|graben|bach|fluss|kanal)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanWaterLabel(value = '') {
  return String(value)
    .replace(/^\s*\d+\.\s*/, '')
    .replace(/[„“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || '').replace(/\s+/g, ' ').trim()).filter((value) => value.length >= 3))];
}

function searchNamesForWater(water) {
  const full = cleanWaterLabel(water.name);
  const withoutLocation = full
    .replace(/\s+(?:bei|in|am|nahe)\s+[^,;()–-]+$/i, '')
    .trim();
  const parenthetical = [...full.matchAll(/\(([^)]+)\)/g)].map((match) => match[1]);
  const quoted = [...full.matchAll(/["“„]([^"“”„]+)["“”„]/g)].map((match) => match[1]);
  const dashParts = full.split(/\s+[–-]\s+|,|\//).map((part) => part.trim());
  const noteHints = (water.notes || [])
    .map((note) => cleanWaterLabel(note))
    .filter((note) => note.length >= 3 && note.length <= 80 && !/basis:|verbot|prufen|prüfen/i.test(note));
  const core = waterNameCore(full);
  const candidates = [full, withoutLocation, ...parenthetical, ...quoted, ...dashParts, core, ...noteHints];
  return uniqueStrings(candidates)
    .filter((value) => !/^(?:bei|in|am)\s+/i.test(value))
    .slice(0, 6);
}

function queryVariantsForWater(water, locality) {
  const names = searchNamesForWater(water);
  const district = water.district || '';
  const variants = [];
  for (const name of names) {
    if (locality) variants.push(`${name}, ${locality}, Sachsen-Anhalt`);
    variants.push(`${name}, ${district}, Sachsen-Anhalt`);
  }
  return uniqueStrings(variants).slice(0, 4);
}

function tokenSet(value) {
  return new Set(normalize(value).split(' ').filter((x) => x.length > 2));
}

function jaccard(a, b) {
  const A = tokenSet(a), B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const token of A) if (B.has(token)) common++;
  return common / (A.size + B.size - common);
}

function nameSimilarity(a, b) {
  const A = normalize(a), B = normalize(b);
  const coreA = waterNameCore(a), coreB = waterNameCore(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (coreA && coreB && coreA === coreB) return 0.96;
  if (A.includes(B) || B.includes(A)) return Math.min(A.length, B.length) / Math.max(A.length, B.length);
  return Math.max(jaccard(A, B), jaccard(coreA, coreB));
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

async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2));
}

function expectedClass(water) {
  return water.type === 'Fließgewässer' ? 'flow' : 'standing';
}

function candidateClass(tags = {}, osmType = '') {
  const waterway = String(tags.waterway || '').toLowerCase();
  const natural = String(tags.natural || '').toLowerCase();
  const water = String(tags.water || '').toLowerCase();
  const landuse = String(tags.landuse || '').toLowerCase();
  const type = String(osmType).toLowerCase();
  if (waterway || /river|stream|canal|drain|ditch/.test(type)) return 'flow';
  if (natural === 'water' || water || /lake|pond|reservoir|water/.test(type) || /reservoir|basin/.test(landuse)) return 'standing';
  return 'unknown';
}

function typeScore(water, candidate) {
  const expected = expectedClass(water);
  if (candidate.class === expected) return 1;
  if (candidate.class === 'unknown') return 0.45;
  return 0.05;
}

function localityFromWater(water) {
  const combined = [water.name, ...(water.notes || [])].join(' · ').replace(/^\d+\.\s*/, '');
  const patterns = [
    /\bbei\s+([^,()\-–·]{3,60})/i,
    /\bin\s+([^,()\-–·]{3,60})/i,
    /\bam\s+([^,()\-–·]{3,60})/i,
    /\bnahe\s+([^,()\-–·]{3,60})/i,
  ];
  for (const pattern of patterns) {
    const hit = combined.match(pattern)?.[1]?.trim();
    if (hit && !/weg|graben|bach|fluss|teich|see|kuhle|mündung|brücke|straße/i.test(hit)) return hit;
  }
  const note = (water.notes || []).find((x) => /^(?:bei|in)\s+/i.test(String(x).trim()));
  if (note) return String(note).replace(/^(?:bei|in)\s+/i, '').trim();
  return '';
}

function haversineKm(a, b) {
  const R = 6371, rad = (x) => x * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(q));
}

function nominatimCandidate(result) {
  const tags = result.extratags || {};
  const latitude = Number(result.lat), longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const names = uniqueStrings([
    result.namedetails?.name,
    result.namedetails?.['name:de'],
    result.namedetails?.alt_name,
    result.namedetails?.old_name,
    result.name,
    String(result.display_name || '').split(',')[0],
  ]);
  return {
    provider: 'nominatim',
    id: result.osm_type && result.osm_id ? `${result.osm_type}/${result.osm_id}` : String(result.place_id || ''),
    latitude,
    longitude,
    name: names[0] || '',
    names,
    displayName: result.display_name || '',
    class: candidateClass(tags, `${result.class} ${result.type}`),
    tags,
  };
}

async function nominatimSearch(query, cache, key) {
  if (!refresh && key in cache.nominatim) return cache.nominatim[key];
  const url = new URL(NOMINATIM);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'de');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('namedetails', '1');
  url.searchParams.set('extratags', '1');
  url.searchParams.set('polygon_geojson', '0');
  if (email) url.searchParams.set('email', email);
  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent, 'Accept-Language': 'de', Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const data = await response.json();
  cache.nominatim[key] = data;
  await writeJson(CACHE, cache);
  await sleep(1200);
  return data;
}

async function geocodeLocality(locality, district, cache) {
  if (!locality) return null;
  const key = `locality|${locality}|${district}`;
  const results = await nominatimSearch(`${locality}, ${district}, Sachsen-Anhalt`, cache, key);
  const hit = results.find((x) => ['city', 'town', 'village', 'hamlet', 'municipality', 'administrative'].includes(x.type)) || results[0];
  return hit ? { latitude: Number(hit.lat), longitude: Number(hit.lon), displayName: hit.display_name } : null;
}

function overpassQuery(latitude, longitude, radius) {
  return `[out:json][timeout:50];\n(\n  nwr(around:${radius},${latitude},${longitude})[natural=water];\n  nwr(around:${radius},${latitude},${longitude})[water];\n  nwr(around:${radius},${latitude},${longitude})[waterway~"^(river|stream|canal|drain|ditch)$"];\n  nwr(around:${radius},${latitude},${longitude})[landuse~"^(reservoir|basin)$"];\n  nwr(around:${radius},${latitude},${longitude})[leisure=fishing];\n);\nout center tags qt;`;
}

async function overpassNearby(anchor, cache, key) {
  if (!refresh && key in cache.overpass) return cache.overpass[key];
  const query = overpassQuery(anchor.latitude, anchor.longitude, radiusM);
  let lastError;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const body = new URLSearchParams({ data: query });
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'User-Agent': userAgent, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body,
        });
        if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 300)}`);
        const data = await response.json();
        cache.overpass[key] = data.elements || [];
        await writeJson(CACHE, cache);
        await sleep(900);
        return cache.overpass[key];
      } catch (error) {
        lastError = error;
        await sleep(1500 * attempt);
      }
    }
  }
  throw new Error(`Overpass failed: ${lastError?.message || 'unknown error'}`);
}

function overpassCandidate(element) {
  const center = element.center || (Number.isFinite(element.lat) ? { lat: element.lat, lon: element.lon } : null);
  if (!center) return null;
  const tags = element.tags || {};
  const names = uniqueStrings([tags.name, tags['name:de'], tags.local_name, tags.alt_name, tags.old_name, tags.short_name]);
  return {
    provider: 'overpass',
    id: `${element.type}/${element.id}`,
    latitude: Number(center.lat),
    longitude: Number(center.lon),
    name: names[0] || '',
    names,
    displayName: names[0] || `${element.type}/${element.id}`,
    class: candidateClass(tags, element.type),
    tags,
  };
}

function scoreCandidate(water, candidate, anchor) {
  const aliases = searchNamesForWater(water);
  const candidateNames = candidate.names?.length ? candidate.names : [candidate.name];
  let name = 0;
  let matchedAlias = '';
  let matchedCandidateName = '';
  for (const alias of aliases) {
    for (const candidateName of candidateNames) {
      const similarity = nameSimilarity(alias, candidateName);
      if (similarity > name) {
        name = similarity;
        matchedAlias = alias;
        matchedCandidateName = candidateName;
      }
    }
  }
  const type = typeScore(water, candidate);
  const distanceKm = anchor ? haversineKm(anchor, candidate) : null;
  const distance = distanceKm == null ? 0.35 : Math.max(0, 1 - distanceKm / Math.max(3, radiusM / 1000));
  const osmFishing = candidate.tags?.leisure === 'fishing' ? 0.06 : 0;
  const hasName = candidateNames.some(Boolean);
  const unnamedPenalty = hasName ? 0 : -0.12;
  const score = name * 0.62 + type * 0.18 + distance * 0.20 + osmFishing + unnamedPenalty;
  return { candidate, score: Math.max(0, Math.min(1, score)), name, type, distance, distanceKm, matchedAlias, matchedCandidateName };
}

function chooseCandidate(water, candidates, anchor) {
  const unique = new Map();
  for (const candidate of candidates.filter(Boolean)) {
    const key = candidate.id || `${candidate.latitude},${candidate.longitude}`;
    if (!unique.has(key)) unique.set(key, candidate);
  }
  const ranked = [...unique.values()].map((c) => scoreCandidate(water, c, anchor)).sort((a, b) => b.score - a.score);
  const best = ranked[0], second = ranked[1];
  if (!best) return { status: 'unmatched' };
  const gap = best.score - (second?.score ?? 0);
  const namedStrong = best.name >= 0.84 && best.type >= 0.45 && gap >= 0.04;
  const localStrong = best.score >= 0.82 && gap >= 0.09 && (best.distanceKm == null || best.distanceKm <= 5);
  if (namedStrong || localStrong) return { status: 'matched', confidence: best.score, method: best.candidate.provider === 'nominatim' ? 'nominatim-name' : 'overpass-locality', ...best };
  if (best.score >= 0.42) return { status: 'review', confidence: best.score, method: best.candidate.provider === 'nominatim' ? 'nominatim-name' : 'overpass-locality', ...best };
  return { status: 'unmatched' };
}

function outputRecord(match) {
  if (!match.candidate) return { status: match.status, checkedAt: now(), source: SOURCE };
  return {
    status: match.status,
    latitude: Number(match.candidate.latitude.toFixed(7)),
    longitude: Number(match.candidate.longitude.toFixed(7)),
    confidence: Number((match.confidence ?? 0).toFixed(3)),
    method: match.method,
    officialName: match.matchedCandidateName || match.candidate.name || undefined,
    matchedAlias: match.matchedAlias || undefined,
    officialFeatureId: match.candidate.id || undefined,
    officialTypeName: `${match.candidate.provider}:${match.candidate.class}`,
    distanceKm: match.distanceKm == null ? undefined : Number(match.distanceKm.toFixed(2)),
    source: SOURCE,
    checkedAt: now(),
  };
}

function renderTs(records) {
  const stable = Object.fromEntries(Object.entries(records).sort(([a], [b]) => a.localeCompare(b)));
  return `// AUTO-GENERATED by scripts/import-atkis-hydro.mjs\n// Source: ${SOURCE}\n\nexport interface AtkisWaterMatch {\n  status: "matched" | "review" | "unmatched";\n  latitude?: number; longitude?: number; confidence?: number;\n  method?: "nominatim-name" | "overpass-locality";\n  officialName?: string; officialFeatureId?: string; officialTypeName?: string;\n  areaHa?: number; distanceKm?: number; source?: string; checkedAt?: string;\n}\n\nexport const atkisWaterMatchIndex: Record<string, AtkisWaterMatch> = ${JSON.stringify(stable, null, 2)};\n`;
}

const csv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
function renderReview(waters, records) {
  const rows = [['id', 'lavNumber', 'name', 'district', 'status', 'confidence', 'method', 'latitude', 'longitude', 'matchedAlias', 'candidateName', 'distanceKm', 'source']];
  for (const water of waters) {
    const record = records[water.id];
    if (!record || record.status === 'matched') continue;
    rows.push([water.id, water.lavNumber, water.name, water.district, record.status, record.confidence, record.method, record.latitude, record.longitude, record.matchedAlias, record.officialName, record.distanceKm, record.source]);
  }
  return rows.map((row) => row.map(csv).join(';')).join('\n') + '\n';
}

const catalog = extractCatalog(await fs.readFile(CATALOG, 'utf8'));
const cache = await readJson(CACHE, { nominatim: {}, overpass: {} });
cache.nominatim ||= {};
cache.overpass ||= {};
const existing = await import(`${pathToFileURL(OUTPUT).href}?v=${Date.now()}`).then((m) => m.atkisWaterMatchIndex).catch(() => ({}));
const records = { ...existing };
const work = catalog.slice(start, Number.isFinite(limit) ? start + limit : undefined);

console.log(`LAV entries: ${catalog.length}; processing ${work.length}; start=${start}; radius=${radiusM}m`);
console.log('Multi-stage matching v2.1: name variants + locality + Overpass. Cache is resumable.');

let index = 0;
for (const water of work) {
  index++;
  const locality = localityFromWater(water);
  let anchor = null;
  const candidates = [];
  const queries = queryVariantsForWater(water, locality);
  for (const [queryIndex, query] of queries.entries()) {
    try {
      const nameKey = `water-v2|${query}`;
      const namedResults = await nominatimSearch(query, cache, nameKey);
      candidates.push(...namedResults.map(nominatimCandidate));
      // A strong direct name hit makes further public API calls unnecessary.
      const direct = chooseCandidate(water, candidates, null);
      if (direct.status === 'matched' && direct.confidence >= 0.90) break;
    } catch (error) {
      console.warn(`Nominatim variant ${queryIndex + 1} failed: ${error.message}`);
    }
  }

  try {
    anchor = await geocodeLocality(locality, water.district, cache);
  } catch (error) {
    console.warn(`Locality lookup failed (${locality || 'none'}): ${error.message}`);
  }

  if (anchor) {
    try {
      const overpassKey = `near|${anchor.latitude.toFixed(5)}|${anchor.longitude.toFixed(5)}|${radiusM}`;
      const elements = await overpassNearby(anchor, cache, overpassKey);
      candidates.push(...elements.map(overpassCandidate));
    } catch (error) {
      console.warn(`Overpass nearby failed: ${error.message}`);
    }
  }

  const match = chooseCandidate(water, candidates, anchor);
  records[water.id] = outputRecord(match);
  console.log(`${index}/${work.length} ${water.lavNumber ?? ''} ${water.name} -> ${match.status}${match.candidate?.name ? ` [${match.candidate.name}]` : ''}${match.matchedAlias ? ` <= ${match.matchedAlias}` : ''}${match.confidence ? ` ${(match.confidence * 100).toFixed(0)}%` : ''}`);
  await fs.writeFile(OUTPUT, renderTs(records));
  await fs.writeFile(REVIEW, renderReview(catalog, records));
}

const stats = Object.values(records).reduce((acc, record) => (acc[record.status] = (acc[record.status] || 0) + 1, acc), {});
console.log('Done:', stats);
console.log(`Generated ${path.relative(ROOT, OUTPUT)}`);
console.log(`Review ${path.relative(ROOT, REVIEW)}`);
console.log(`Cache ${path.relative(ROOT, CACHE)}`);
