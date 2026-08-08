#!/usr/bin/env node
/**
 * HarzFishing Navigator – Locality-first water matcher v3
 *
 * Ziel:
 *   LAV-Gewässer zuerst über Ort/Gemeinde räumlich eingrenzen und danach
 *   ausschließlich echte Wasserobjekte bewerten.
 *
 * Quellen:
 *   - OpenStreetMap Nominatim: Orts-/Gemeindesuche
 *   - OpenStreetMap Overpass API: Wasserobjekte im Umkreis
 *
 * Ausgabe:
 *   data/local-water-matches.generated.ts
 *   data/local-water-review.csv
 *   data/local-water-import-cache.json
 *
 * Bestehende Dateien werden NICHT überschrieben.
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");

const CATALOG = path.join(DATA, "lav-catalog.ts");
const OUTPUT = path.join(DATA, "local-water-matches.generated.ts");
const REVIEW = path.join(DATA, "local-water-review.csv");
const CACHE = path.join(DATA, "local-water-import-cache.json");

const SOURCE = "OpenStreetMap contributors (ODbL), Nominatim and Overpass API";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const args = process.argv.slice(2);
const option = (name, fallback = "") =>
  args.find((x) => x.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;

const limit = Number(option("limit", "50")) || 50;
const start = Number(option("start", "0")) || 0;
const radiusM = Math.max(1000, Math.min(15000, Number(option("radius", "6000")) || 6000));
const email = option("email", process.env.NOMINATIM_EMAIL || "");
const userAgent = `HarzFishingNavigator-local-water-matcher/3.0${email ? ` (${email})` : ""}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => new Date().toISOString();

function normalize(value = "") {
  return String(value)
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[’'`´„“”]/g, "")
    .replace(/\b(der|die|das|des|den|dem|am|an|im|in|bei|von|vom|zum|zur|und)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(normalize(value).split(" ").filter((x) => x.length > 2));
}

function jaccard(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const token of A) if (B.has(token)) common++;
  return common / (A.size + B.size - common);
}

function waterNameCore(value = "") {
  return normalize(value)
    .replace(
      /\b(teich|teiche|see|weiher|kuhle|kiesgrube|grube|wasser|wasserspeicher|speicher|stausee|talsperre|graben|bach|fluss|kanal|tagebau|restloch|altarm|hafen)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function nameSimilarity(a, b) {
  const A = normalize(a), B = normalize(b);
  const CA = waterNameCore(a), CB = waterNameCore(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (CA && CB && CA === CB) return 0.97;
  if (A.includes(B) || B.includes(A)) {
    return Math.min(A.length, B.length) / Math.max(A.length, B.length);
  }
  return Math.max(jaccard(A, B), jaccard(CA, CB));
}

function uniqueStrings(values) {
  return [...new Set(
    values
      .map((v) => String(v || "").replace(/\s+/g, " ").trim())
      .filter((v) => v.length >= 2)
  )];
}

function extractCatalog(text) {
  const marker = "export const lavCatalog: FishingWater[] =";
  const pos = text.indexOf(marker);
  if (pos < 0) throw new Error("data/lav-catalog.ts: lavCatalog export not found");
  const begin = text.indexOf("[", text.indexOf("=", pos));
  const end = text.lastIndexOf("];");
  return JSON.parse(text.slice(begin, end + 1));
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2));
}

function cleanName(value = "") {
  return String(value)
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function localityCandidates(water) {
  const combined = [water.name, ...(water.notes || [])].join(" · ");
  const out = [];

  const patterns = [
    /\bbei\s+([^,()\-–·]{2,60})/gi,
    /\bin\s+([^,()\-–·]{2,60})/gi,
    /\bnahe\s+([^,()\-–·]{2,60})/gi,
    /\bam\s+([^,()\-–·]{2,60})/gi,
  ];

  for (const pattern of patterns) {
    for (const match of combined.matchAll(pattern)) {
      const hit = match[1]?.trim();
      if (
        hit &&
        !/weg|straße|strasse|graben|bach|fluss|teich|see|kuhle|mündung|brücke|wehr|kanal/i.test(hit)
      ) {
        out.push(hit);
      }
    }
  }

  // Häufige LAV-Namensform: "Dorfteich Sietzsch", "Glockenteich Ballenstedt"
  const words = cleanName(water.name).split(/\s+/);
  if (words.length >= 2) {
    const lastTwo = words.slice(-2).join(" ");
    const lastOne = words.at(-1);
    if (lastTwo && !/teich|see|graben|bach|fluss|kanal|grube|kuhle/i.test(lastTwo)) out.push(lastTwo);
    if (lastOne && !/teich|see|graben|bach|fluss|kanal|grube|kuhle/i.test(lastOne)) out.push(lastOne);
  }

  return uniqueStrings(out).slice(0, 4);
}

function aliasesForWater(water) {
  const full = cleanName(water.name);
  const withoutLocation = full
    .replace(/\s+(?:bei|in|am|nahe)\s+[^,;()–-]+$/i, "")
    .trim();

  const paren = [...full.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
  const quoted = [...full.matchAll(/["“„]([^"“”„]+)["“”„]/g)].map((m) => m[1]);
  const pieces = full.split(/\s+[–-]\s+|,|\//).map((x) => x.trim());

  return uniqueStrings([full, withoutLocation, ...paren, ...quoted, ...pieces, waterNameCore(full)])
    .slice(0, 8);
}

function expectedClass(water) {
  return water.type === "Fließgewässer" ? "flow" : "standing";
}

function candidateClass(tags = {}) {
  const waterway = String(tags.waterway || "").toLowerCase();
  const natural = String(tags.natural || "").toLowerCase();
  const water = String(tags.water || "").toLowerCase();
  const landuse = String(tags.landuse || "").toLowerCase();
  const leisure = String(tags.leisure || "").toLowerCase();

  if (/river|stream|canal|drain|ditch/.test(waterway)) return "flow";
  if (
    natural === "water" ||
    water ||
    /reservoir|basin/.test(landuse) ||
    leisure === "fishing"
  ) return "standing";

  return "unknown";
}

function typeScore(water, candidate) {
  const expected = expectedClass(water);
  if (candidate.class === expected) return 1;
  if (candidate.class === "unknown") return 0.2;
  return 0;
}

function haversineKm(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const q =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(q));
}

function approximateAreaHa(tags = {}) {
  const value =
    tags["water:area"] ??
    tags.area ??
    tags["area:ha"] ??
    tags["surface_area"];

  if (value == null) return null;

  const text = String(value).replace(",", ".").trim().toLowerCase();
  const n = Number.parseFloat(text);
  if (!Number.isFinite(n)) return null;

  if (/km2|km²/.test(text)) return n * 100;
  if (/m2|m²/.test(text)) return n / 10000;
  if (/ha/.test(text)) return n;

  return null;
}

function areaScore(expectedHa, actualHa) {
  const e = Number(expectedHa);
  const a = Number(actualHa);
  if (!Number.isFinite(e) || e <= 0 || !Number.isFinite(a) || a <= 0) return 0.5;
  const ratio = Math.min(e, a) / Math.max(e, a);
  return Math.max(0, Math.min(1, ratio));
}

async function nominatimLocalitySearch(query, cache, key) {
  if (key in cache.localities) return cache.localities[key];

  const url = new URL(NOMINATIM);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set("addressdetails", "1");

  if (email) url.searchParams.set("email", email);

  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      "Accept-Language": "de",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }

  const data = await response.json();
  cache.localities[key] = data;
  await writeJson(CACHE, cache);
  await sleep(1200);
  return data;
}

async function resolveLocality(water, cache) {
  const candidates = localityCandidates(water);

  for (const locality of candidates) {
    const queries = uniqueStrings([
      `${locality}, ${water.district || ""}, Sachsen-Anhalt`,
      `${locality}, Sachsen-Anhalt`,
    ]);

    for (const query of queries) {
      const key = `loc|${query}`;
      const results = await nominatimLocalitySearch(query, cache, key);

      const hit =
        results.find((x) =>
          ["city", "town", "village", "hamlet", "municipality", "administrative", "suburb"].includes(x.type)
        ) || results[0];

      if (hit) {
        const latitude = Number(hit.lat);
        const longitude = Number(hit.lon);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          return {
            locality,
            latitude,
            longitude,
            displayName: hit.display_name || "",
          };
        }
      }
    }
  }

  return null;
}

function overpassQuery(latitude, longitude, radius) {
  // Ausschließlich echte Wasserobjekte.
  return `[out:json][timeout:60];
(
  nwr(around:${radius},${latitude},${longitude})[natural=water];
  nwr(around:${radius},${latitude},${longitude})[water];
  nwr(around:${radius},${latitude},${longitude})[landuse~"^(reservoir|basin)$"];
  nwr(around:${radius},${latitude},${longitude})[leisure=fishing];
  nwr(around:${radius},${latitude},${longitude})[waterway~"^(river|stream|canal|drain|ditch)$"];
);
out center tags qt;`;
}

async function overpassNearby(anchor, cache, key) {
  if (key in cache.overpass) return cache.overpass[key];

  const query = overpassQuery(anchor.latitude, anchor.longitude, radiusM);
  let lastError;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "User-Agent": userAgent,
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: new URLSearchParams({ data: query }),
        });

        if (!response.ok) {
          throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`);
        }

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

  throw new Error(`Overpass failed: ${lastError?.message || "unknown"}`);
}

function toCandidate(element) {
  const center =
    element.center ||
    (Number.isFinite(element.lat)
      ? { lat: element.lat, lon: element.lon }
      : null);

  if (!center) return null;

  const tags = element.tags || {};
  const cls = candidateClass(tags);

  // Harte Sperre: kein echtes Wasserobjekt => niemals Kandidat.
  if (cls === "unknown") return null;

  const names = uniqueStrings([
    tags.name,
    tags["name:de"],
    tags.local_name,
    tags.alt_name,
    tags.old_name,
    tags.short_name,
  ]);

  return {
    id: `${element.type}/${element.id}`,
    latitude: Number(center.lat),
    longitude: Number(center.lon),
    names,
    name: names[0] || "",
    class: cls,
    tags,
    areaHa: approximateAreaHa(tags),
  };
}

function scoreCandidate(water, candidate, anchor) {
  const aliases = aliasesForWater(water);
  let name = 0;
  let matchedAlias = "";
  let matchedCandidateName = "";

  if (candidate.names.length) {
    for (const alias of aliases) {
      for (const candidateName of candidate.names) {
        const s = nameSimilarity(alias, candidateName);
        if (s > name) {
          name = s;
          matchedAlias = alias;
          matchedCandidateName = candidateName;
        }
      }
    }
  }

  const type = typeScore(water, candidate);
  const distanceKm = haversineKm(anchor, candidate);
  const distance = Math.max(0, 1 - distanceKm / Math.max(1, radiusM / 1000));
  const area = areaScore(water.areaHa, candidate.areaHa);

  // Für unbenannte echte Gewässer darf der Name 0 sein.
  // Räumliche Nähe + Typ tragen deshalb deutlich mehr als vorher.
  const hasName = candidate.names.length > 0;
  const score = hasName
    ? name * 0.42 + type * 0.25 + distance * 0.25 + area * 0.08
    : type * 0.42 + distance * 0.46 + area * 0.12;

  return {
    candidate,
    score: Math.max(0, Math.min(1, score)),
    name,
    type,
    distance,
    area,
    distanceKm,
    matchedAlias,
    matchedCandidateName,
  };
}

function chooseCandidate(water, candidates, anchor) {
  const unique = new Map();

  for (const candidate of candidates.filter(Boolean)) {
    if (!unique.has(candidate.id)) unique.set(candidate.id, candidate);
  }

  const ranked = [...unique.values()]
    .map((c) => scoreCandidate(water, c, anchor))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];

  if (!best) return { status: "unmatched" };

  const gap = best.score - (second?.score ?? 0);

  // Konservativ:
  // - benanntes Gewässer: sehr guter Name + richtiger Typ
  // - unbenanntes Gewässer: nur bei sehr nah + eindeutigem Abstand zum Zweitplatzierten
  const namedStrong =
    best.candidate.names.length > 0 &&
    best.name >= 0.82 &&
    best.type >= 0.9 &&
    best.distanceKm <= 5 &&
    gap >= 0.06;

  const unnamedStrong =
    best.candidate.names.length === 0 &&
    best.type >= 0.9 &&
    best.distanceKm <= 1.5 &&
    best.score >= 0.78 &&
    gap >= 0.14;

  if (namedStrong || unnamedStrong) {
    return {
      status: "matched",
      confidence: best.score,
      method: namedStrong ? "locality-name-water" : "locality-unnamed-water",
      ...best,
    };
  }

  if (best.score >= 0.48 && best.type >= 0.9) {
    return {
      status: "review",
      confidence: best.score,
      method: "locality-water-review",
      ...best,
    };
  }

  return { status: "unmatched" };
}

function outputRecord(match, anchor) {
  if (!match.candidate) {
    return {
      status: match.status,
      locality: anchor?.locality,
      checkedAt: now(),
      source: SOURCE,
    };
  }

  return {
    status: match.status,
    latitude: Number(match.candidate.latitude.toFixed(7)),
    longitude: Number(match.candidate.longitude.toFixed(7)),
    confidence: Number((match.confidence ?? 0).toFixed(3)),
    method: match.method,
    locality: anchor?.locality,
    localityDisplayName: anchor?.displayName,
    officialName: match.matchedCandidateName || match.candidate.name || undefined,
    matchedAlias: match.matchedAlias || undefined,
    officialFeatureId: match.candidate.id,
    officialTypeName: match.candidate.class,
    distanceKm: Number(match.distanceKm.toFixed(2)),
    areaHa: match.candidate.areaHa == null ? undefined : Number(match.candidate.areaHa.toFixed(3)),
    source: SOURCE,
    checkedAt: now(),
  };
}

function renderTs(records) {
  const stable = Object.fromEntries(
    Object.entries(records).sort(([a], [b]) => a.localeCompare(b, "de"))
  );

  return `// AUTO-GENERATED by scripts/import-local-water-v3.mjs
// Source: ${SOURCE}
// Locality-first matcher. Only genuine water objects are candidates.

export interface LocalWaterMatch {
  status: "matched" | "review" | "unmatched";
  latitude?: number;
  longitude?: number;
  confidence?: number;
  method?: "locality-name-water" | "locality-unnamed-water" | "locality-water-review";
  locality?: string;
  localityDisplayName?: string;
  officialName?: string;
  matchedAlias?: string;
  officialFeatureId?: string;
  officialTypeName?: "standing" | "flow";
  distanceKm?: number;
  areaHa?: number;
  source?: string;
  checkedAt?: string;
}

export const localWaterMatchIndex: Record<string, LocalWaterMatch> = ${JSON.stringify(stable, null, 2)};
`;
}

const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function renderReview(waters, records) {
  const rows = [[
    "id","lavNumber","name","district","status","confidence","method",
    "latitude","longitude","locality","candidateName","distanceKm","candidateAreaHa"
  ]];

  for (const water of waters) {
    const r = records[water.id];
    if (!r || r.status === "matched") continue;

    rows.push([
      water.id,
      water.lavNumber,
      water.name,
      water.district,
      r.status,
      r.confidence,
      r.method,
      r.latitude,
      r.longitude,
      r.locality,
      r.officialName,
      r.distanceKm,
      r.areaHa,
    ]);
  }

  return rows.map((row) => row.map(csv).join(";")).join("\n") + "\n";
}

const catalog = extractCatalog(await fs.readFile(CATALOG, "utf8"));
const cache = await readJson(CACHE, { localities: {}, overpass: {} });
cache.localities ||= {};
cache.overpass ||= {};

let records = {};
try {
  const text = await fs.readFile(OUTPUT, "utf8");
  const marker = "export const localWaterMatchIndex: Record<string, LocalWaterMatch> = ";
  const pos = text.indexOf(marker);
  if (pos >= 0) {
    const begin = text.indexOf("{", pos + marker.length);
    const end = text.lastIndexOf("};");
    records = JSON.parse(text.slice(begin, end + 1));
  }
} catch {}

const work = catalog.slice(start, start + limit);

console.log("");
console.log("HarzFishing – Locality-first Water Matcher v3");
console.log("------------------------------------------------");
console.log(`LAV gesamt: ${catalog.length}`);
console.log(`Bearbeitung: ${start}–${start + work.length - 1}`);
console.log(`Radius: ${radiusM} m`);
console.log("");

let i = 0;

for (const water of work) {
  i++;
  let anchor = null;

  try {
    anchor = await resolveLocality(water, cache);
  } catch (error) {
    console.warn(`Ortssuche fehlgeschlagen: ${error.message}`);
  }

  if (!anchor) {
    records[water.id] = {
      status: "unmatched",
      checkedAt: now(),
      source: SOURCE,
    };

    console.log(`${i}/${work.length} ${water.lavNumber ?? ""} ${water.name} -> unmatched [kein Ort]`);
    await fs.writeFile(OUTPUT, renderTs(records));
    await fs.writeFile(REVIEW, renderReview(catalog, records));
    continue;
  }

  let candidates = [];

  try {
    const key = `water|${anchor.latitude.toFixed(5)}|${anchor.longitude.toFixed(5)}|${radiusM}`;
    const elements = await overpassNearby(anchor, cache, key);
    candidates = elements.map(toCandidate).filter(Boolean);
  } catch (error) {
    console.warn(`Overpass fehlgeschlagen: ${error.message}`);
  }

  const match = chooseCandidate(water, candidates, anchor);
  records[water.id] = outputRecord(match, anchor);

  console.log(
    `${i}/${work.length} ${water.lavNumber ?? ""} ${water.name} -> ${match.status}` +
    `${match.candidate?.name ? ` [${match.candidate.name}]` : match.candidate ? " [unbenannt]" : ""}` +
    `${match.distanceKm != null ? ` ${match.distanceKm.toFixed(2)} km` : ""}` +
    `${match.confidence ? ` ${(match.confidence * 100).toFixed(0)}%` : ""}`
  );

  await fs.writeFile(OUTPUT, renderTs(records));
  await fs.writeFile(REVIEW, renderReview(catalog, records));
}

const stats = Object.values(records).reduce((acc, r) => {
  acc[r.status] = (acc[r.status] || 0) + 1;
  return acc;
}, {});

console.log("");
console.log("Ergebnis:", stats);
console.log(`Generated: ${path.relative(ROOT, OUTPUT)}`);
console.log(`Review:    ${path.relative(ROOT, REVIEW)}`);
console.log(`Cache:     ${path.relative(ROOT, CACHE)}`);
