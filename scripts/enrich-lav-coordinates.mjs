#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, 'data', 'lav-catalog.ts');
const CACHE = path.join(ROOT, 'data', 'geocoding-cache.json');
const OUTPUT = path.join(ROOT, 'data', 'lav-coordinates.generated.ts');
const REVIEW = path.join(ROOT, 'data', 'lav-coordinate-review.csv');

const argv = new Set(process.argv.slice(2));
const dryRun = argv.has('--dry-run');
const retryReview = argv.has('--retry-review');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const startArg = process.argv.find((arg) => arg.startsWith('--start='));
const emailArg = process.argv.find((arg) => arg.startsWith('--email='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
const start = startArg ? Number(startArg.split('=')[1]) : 0;
const email = emailArg?.split('=').slice(1).join('=') || process.env.NOMINATIM_EMAIL || '';
const userAgent = `HarzFishingNavigator-coordinate-enricher/1.0${email ? ` (${email})` : ''}`;
const REQUEST_DELAY_MS = 1200;
const SA_VIEWBOX = '10.45,53.12,13.25,50.88'; // west,north,east,south

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (value = '') => value
  .toLocaleLowerCase('de-DE')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\b(der|die|das|des|den|am|an|im|in|bei|von|vom|zum|zur|und|sachsen|anhalt)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function tokenSet(value) {
  return new Set(normalize(value).split(' ').filter((t) => t.length > 2));
}

function jaccard(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let intersection = 0;
  for (const token of A) if (B.has(token)) intersection += 1;
  return intersection / (A.size + B.size - intersection);
}

function waterTypeScore(water, result) {
  const cls = `${result.class ?? ''} ${result.type ?? ''} ${result.category ?? ''}`.toLowerCase();
  const display = String(result.display_name ?? '').toLowerCase();
  const combined = `${cls} ${display}`;
  const expected = {
    Talsperre: ['reservoir', 'dam', 'water'],
    See: ['lake', 'water', 'reservoir'],
    Teich: ['pond', 'water', 'lake'],
    Kiesgrube: ['quarry', 'lake', 'water', 'gravel'],
    Fließgewässer: ['river', 'stream', 'canal', 'ditch', 'waterway'],
  }[water.type] ?? ['water'];
  return expected.some((term) => combined.includes(term)) ? 1 : 0;
}

function districtScore(district, result) {
  const address = Object.values(result.address ?? {}).join(' ');
  const display = String(result.display_name ?? '');
  const score = Math.max(jaccard(district, address), jaccard(district, display));
  return score;
}

function nameScore(water, result) {
  const candidate = result.namedetails?.name || result.name || String(result.display_name ?? '').split(',')[0];
  return Math.max(jaccard(water.name, candidate), jaccard(water.name, result.display_name ?? ''));
}

function scoreResult(water, result) {
  const name = nameScore(water, result);
  const district = districtScore(water.district, result);
  const type = waterTypeScore(water, result);
  const importance = Math.min(Number(result.importance ?? 0), 0.8) / 0.8;
  const score = name * 0.58 + district * 0.18 + type * 0.16 + importance * 0.08;
  return { score, name, district, type, importance };
}

function extractCatalog(text) {
  const marker = 'export const lavCatalog: FishingWater[] =';
  const pos = text.indexOf(marker);
  if (pos < 0) throw new Error('lavCatalog export not found');
  const equals = text.indexOf('=', pos);
  const begin = text.indexOf('[', equals);
  const end = text.lastIndexOf('];');
  if (begin < 0 || end < 0) throw new Error('lavCatalog array not found');
  return JSON.parse(text.slice(begin, end + 1));
}

function queryVariants(water) {
  const locationNotes = (water.notes ?? [])
    .filter((note) => !note.startsWith('Basis:'))
    .join(' ')
    .slice(0, 180);
  const base = water.name.replace(/^\d+\.\s*/, '').trim();
  const variants = [
    `${base} ${locationNotes} ${water.district} Sachsen-Anhalt`,
    `${base} ${water.district} Sachsen-Anhalt`,
    `${base} Sachsen-Anhalt`,
  ];
  return [...new Set(variants.map((q) => q.replace(/\s+/g, ' ').trim()))];
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

async function fetchNominatim(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '6');
  url.searchParams.set('countrycodes', 'de');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('namedetails', '1');
  url.searchParams.set('dedupe', '1');
  url.searchParams.set('viewbox', SA_VIEWBOX);
  url.searchParams.set('bounded', '1');
  if (email) url.searchParams.set('email', email);

  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      'Accept-Language': 'de',
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}: ${await response.text()}`);
  return response.json();
}

function selectMatch(water, candidates) {
  const ranked = candidates
    .map((result) => ({ result, ...scoreResult(water, result) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const second = ranked[1];
  if (!best) return { status: 'unmatched', ranked: [] };
  const gap = best.score - (second?.score ?? 0);
  const status = best.score >= 0.72 && gap >= 0.08
    ? 'matched'
    : best.score >= 0.55
      ? 'review'
      : 'unmatched';
  return { status, best, second, gap, ranked };
}

function toRecord(water, match, query) {
  if (!match.best) return { status: 'unmatched', query, checkedAt: new Date().toISOString() };
  const r = match.best.result;
  return {
    status: match.status,
    latitude: Number(r.lat),
    longitude: Number(r.lon),
    confidence: Number(match.best.score.toFixed(3)),
    scoreGap: Number(match.gap.toFixed(3)),
    displayName: r.display_name,
    osmType: r.osm_type,
    osmId: Number(r.osm_id),
    category: r.class,
    featureType: r.type,
    query,
    checkedAt: new Date().toISOString(),
  };
}

function renderTs(records) {
  const stable = Object.fromEntries(Object.entries(records).sort(([a], [b]) => a.localeCompare(b)));
  return `// AUTO-GENERATED by scripts/enrich-lav-coordinates.mjs\n// Review data/lav-coordinate-review.csv before promoting uncertain matches.\n\nexport interface LavCoordinateMatch {\n  status: \"matched\" | \"review\" | \"unmatched\";\n  latitude?: number;\n  longitude?: number;\n  confidence?: number;\n  scoreGap?: number;\n  displayName?: string;\n  osmType?: string;\n  osmId?: number;\n  category?: string;\n  featureType?: string;\n  query?: string;\n  checkedAt?: string;\n}\n\nexport const lavCoordinateIndex: Record<string, LavCoordinateMatch> = ${JSON.stringify(stable, null, 2)};\n`;
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function renderReview(waters, records) {
  const rows = [['id','lavNumber','name','district','status','confidence','latitude','longitude','displayName','query']];
  for (const water of waters) {
    const record = records[water.id];
    if (!record || record.status === 'matched') continue;
    rows.push([
      water.id, water.lavNumber ?? '', water.name, water.district,
      record.status, record.confidence ?? '', record.latitude ?? '', record.longitude ?? '',
      record.displayName ?? '', record.query ?? '',
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(';')).join('\n') + '\n';
}

const source = await fs.readFile(CATALOG, 'utf8');
const waters = extractCatalog(source);
const cache = await readJson(CACHE, { queries: {}, records: {} });
cache.queries ??= {};
cache.records ??= {};

const candidates = waters
  .filter((water) => water.latitude == null || water.longitude == null)
  .filter((water) => retryReview || !cache.records[water.id] || cache.records[water.id].status === 'unmatched')
  .slice(start, Number.isFinite(limit) ? start + limit : undefined);

console.log(`LAV catalog: ${waters.length} entries`);
console.log(`To process: ${candidates.length} (start=${start}, limit=${Number.isFinite(limit) ? limit : 'all'})`);
console.log(`Nominatim policy: single-threaded, ${REQUEST_DELAY_MS} ms delay, cached results.`);
if (!email) console.warn('Tip: add --email=you@example.com so the geocoder can contact you if needed.');

let processed = 0;
for (const water of candidates) {
  let finalMatch = { status: 'unmatched', ranked: [] };
  let usedQuery = '';
  for (const query of queryVariants(water)) {
    usedQuery = query;
    let results = cache.queries[query];
    if (!results) {
      if (dryRun) {
        console.log(`[dry] ${water.lavNumber ?? ''} ${query}`);
        continue;
      }
      try {
        results = await fetchNominatim(query);
        cache.queries[query] = results;
        await fs.writeFile(CACHE, JSON.stringify(cache, null, 2));
        await sleep(REQUEST_DELAY_MS);
      } catch (error) {
        console.error(`Request failed for ${query}:`, error.message);
        await sleep(5000);
        continue;
      }
    }
    const match = selectMatch(water, results);
    if (!finalMatch.best || (match.best?.score ?? 0) > (finalMatch.best?.score ?? 0)) finalMatch = match;
    if (match.status === 'matched') break;
  }
  if (!dryRun) {
    cache.records[water.id] = toRecord(water, finalMatch, usedQuery);
    await fs.writeFile(CACHE, JSON.stringify(cache, null, 2));
  }
  processed += 1;
  const rec = cache.records[water.id];
  console.log(`${processed}/${candidates.length} ${water.lavNumber ?? ''} ${water.name} -> ${rec?.status ?? 'dry'} ${rec?.confidence ?? ''}`);
}

if (!dryRun) {
  await fs.writeFile(OUTPUT, renderTs(cache.records));
  await fs.writeFile(REVIEW, renderReview(waters, cache.records));
  const stats = Object.values(cache.records).reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log('Done:', stats);
  console.log(`Generated: ${path.relative(ROOT, OUTPUT)}`);
  console.log(`Review list: ${path.relative(ROOT, REVIEW)}`);
}
