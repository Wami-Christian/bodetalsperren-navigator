#!/usr/bin/env node
/**
 * HarzFishing – Matcher v5 / Uniqueness Analyzer
 *
 * Liest:
 *   data/lav-catalog.ts
 *   data/local-water-matches.generated.ts
 *   data/local-water-import-cache.json
 *
 * Erzeugt:
 *   data/local-water-v5.generated.ts
 *   data/local-water-v5-review.csv
 *
 * Kein Internetzugriff. Keine Änderung an waters.ts.
 *
 * Kernidee:
 *   Unbenannte Gewässer dürfen nur dann automatisch bestätigt werden,
 *   wenn in unmittelbarer Ortsnähe tatsächlich nur ein plausibles
 *   Wasserobjekt existiert bzw. der beste Kandidat klar vor dem zweiten liegt.
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const CATALOG = path.join(DATA, "lav-catalog.ts");
const V3 = path.join(DATA, "local-water-matches.generated.ts");
const CACHE = path.join(DATA, "local-water-import-cache.json");
const OUTPUT = path.join(DATA, "local-water-v5.generated.ts");
const REVIEW = path.join(DATA, "local-water-v5-review.csv");

const RADIUS_M = 6000;

function normalize(value = "") {
  return String(value)
    .toLocaleLowerCase("de-DE")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[’'`´„“”]/g, "")
    .replace(/\b(der|die|das|des|den|dem|am|an|im|in|bei|von|vom|zum|zur|und)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function core(value = "") {
  return normalize(value)
    .replace(/\b(teich|teiche|see|weiher|kuhle|kiesgrube|grube|wasser|wasserspeicher|speicher|stausee|talsperre|graben|bach|fluss|kanal|tagebau|restloch|altarm|hafen)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return new Set(normalize(value).split(" ").filter((x) => x.length > 2));
}

function jaccard(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const x of A) if (B.has(x)) common++;
  return common / (A.size + B.size - common);
}

function similarity(a, b) {
  const A = normalize(a), B = normalize(b);
  const CA = core(a), CB = core(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (CA && CB && CA === CB) return 0.98;
  if (A.includes(B) || B.includes(A)) {
    return Math.min(A.length, B.length) / Math.max(A.length, B.length);
  }
  return Math.max(jaccard(A, B), jaccard(CA, CB));
}

function extractAssignedJson(text, marker) {
  const pos = text.indexOf(marker);
  if (pos < 0) throw new Error(`Marker nicht gefunden: ${marker}`);
  const equals = text.indexOf("=", pos);
  const arr = text.indexOf("[", equals);
  const obj = text.indexOf("{", equals);
  const begin = arr >= 0 && (obj < 0 || arr < obj) ? arr : obj;
  const open = text[begin];
  const close = open === "[" ? "]" : "}";
  let depth = 0, quote = null, esc = false;
  for (let i = begin; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === open) depth++;
    if (ch === close) depth--;
    if (depth === 0) return JSON.parse(text.slice(begin, i + 1));
  }
  throw new Error(`Unvollständiges Literal: ${marker}`);
}

function uniqueStrings(values) {
  return [...new Set(values.map(v => String(v || "").trim()).filter(Boolean))];
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
  if (natural === "water" || water || /reservoir|basin/.test(landuse) || leisure === "fishing") return "standing";
  return "unknown";
}

function toCandidate(element) {
  const center = element.center || (Number.isFinite(element.lat) ? {lat:element.lat, lon:element.lon} : null);
  if (!center) return null;
  const tags = element.tags || {};
  const cls = candidateClass(tags);
  if (cls === "unknown") return null;
  const names = uniqueStrings([tags.name, tags["name:de"], tags.local_name, tags.alt_name, tags.old_name, tags.short_name]);
  return {
    id: `${element.type}/${element.id}`,
    latitude: Number(center.lat),
    longitude: Number(center.lon),
    class: cls,
    names,
    name: names[0] || ""
  };
}

function haversineKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b.latitude-a.latitude), dLon = rad(b.longitude-a.longitude);
  const q = Math.sin(dLat/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}

function aliases(water) {
  const full = String(water.name || "").trim();
  return uniqueStrings([
    full,
    full.replace(/\s+(?:bei|in|am|nahe)\s+[^,;()–-]+$/i, "").trim(),
    core(full)
  ]);
}

function scoreCandidate(water, candidate, anchor) {
  let name = 0;
  for (const a of aliases(water)) {
    for (const b of candidate.names) name = Math.max(name, similarity(a,b));
  }
  const type = candidate.class === expectedClass(water) ? 1 : 0;
  const distanceKm = haversineKm(anchor, candidate);
  const distance = Math.max(0, 1 - distanceKm / 6);
  const named = candidate.names.length > 0;

  const score = named
    ? name*0.48 + type*0.26 + distance*0.26
    : type*0.48 + distance*0.52;

  return {candidate, name, type, distanceKm, score};
}

function anchorFromCache(v3rec, cache) {
  const loc = v3rec.locality;
  if (!loc) return null;

  // Finde den vorhandenen Ortscache-Eintrag, der exakt zu v3.locality gehört.
  const keys = Object.keys(cache.localities || {}).filter(k =>
    k.toLocaleLowerCase("de-DE").includes(String(loc).toLocaleLowerCase("de-DE"))
  );

  for (const key of keys) {
    const results = cache.localities[key] || [];
    const hit = results.find(x =>
      ["city","town","village","hamlet","municipality","administrative","suburb"].includes(x.type)
    ) || results[0];

    if (hit) {
      const latitude = Number(hit.lat), longitude = Number(hit.lon);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return {latitude, longitude};
      }
    }
  }
  return null;
}

function overpassElementsForAnchor(anchor, cache) {
  const exact = `water|${anchor.latitude.toFixed(5)}|${anchor.longitude.toFixed(5)}|${RADIUS_M}`;
  if (cache.overpass?.[exact]) return cache.overpass[exact];

  // Fallback: suche gleichen gerundeten Mittelpunkt unabhängig vom Radius-Key.
  const prefix = `water|${anchor.latitude.toFixed(5)}|${anchor.longitude.toFixed(5)}|`;
  const key = Object.keys(cache.overpass || {}).find(k => k.startsWith(prefix));
  return key ? cache.overpass[key] : [];
}

function classify(water, v3rec, ranked) {
  if (!v3rec || v3rec.status === "unmatched") {
    return {status:"unmatched", tier:"none", reason:"Kein v3-Kandidat."};
  }

  if (water.type === "Fließgewässer") {
    return {status:"review", tier:"flow", reason:"Fließgewässer benötigt Abschnittsprüfung."};
  }

  const best = ranked[0], second = ranked[1];
  if (!best) return {status:"review", tier:"no-cache", reason:"Kein Kandidatenfeld im Cache rekonstruierbar."};

  const gap = best.score - (second?.score ?? 0);
  const nearStanding = ranked.filter(r => r.type === 1 && r.distanceKm <= 0.75);
  const veryNearStanding = ranked.filter(r => r.type === 1 && r.distanceKm <= 0.35);

  const named = best.candidate.names.length > 0;

  if (named && best.name >= 0.88 && best.distanceKm <= 2.5 && gap >= 0.06) {
    return {
      status:"matched", tier:"named-unique",
      reason:"Benannter stehender Kandidat mit starkem Namensmatch und eindeutigem Vorsprung.",
      gap, nearCount:nearStanding.length, veryNearCount:veryNearStanding.length
    };
  }

  // Unbenannt: nur automatisch, wenn räumlich praktisch eindeutig.
  if (
    !named &&
    best.distanceKm <= 0.20 &&
    veryNearStanding.length === 1 &&
    gap >= 0.16
  ) {
    return {
      status:"matched", tier:"unnamed-unique",
      reason:"Einziges sehr nahes stehendes Wasserobjekt und klarer Vorsprung vor dem Zweitkandidaten.",
      gap, nearCount:nearStanding.length, veryNearCount:veryNearStanding.length
    };
  }

  if (!named && best.distanceKm <= 0.35 && veryNearStanding.length === 1 && gap >= 0.10) {
    return {
      status:"review", tier:"unnamed-high",
      reason:"Sehr plausibler unbenannter Kandidat, aber automatische Schwelle knapp nicht erreicht.",
      gap, nearCount:nearStanding.length, veryNearCount:veryNearStanding.length
    };
  }

  return {
    status:"review",
    tier:named ? "named-review" : "unnamed-review",
    reason:"Mehrere plausible Wasserobjekte oder kein ausreichender Vorsprung.",
    gap, nearCount:nearStanding.length, veryNearCount:veryNearStanding.length
  };
}

function renderTs(index) {
  return `// AUTO-GENERATED by scripts/analyze-local-water-v5.mjs
// v5 nutzt Kandidaten-Eindeutigkeit aus dem v3-Overpass-Cache.

export interface LocalWaterV5Match {
  status: "matched" | "review" | "unmatched";
  tier: "named-unique" | "unnamed-unique" | "unnamed-high" | "named-review" | "unnamed-review" | "flow" | "no-cache" | "none";
  latitude?: number;
  longitude?: number;
  confidence?: number;
  gap?: number;
  nearCount?: number;
  veryNearCount?: number;
  candidateName?: string;
  candidateId?: string;
  distanceKm?: number;
  reason: string;
}

export const localWaterV5Index: Record<string, LocalWaterV5Match> = ${JSON.stringify(index, null, 2)};
`;
}

const csv = v => `"${String(v ?? "").replaceAll('"','""')}"`;

const catalogText = await fs.readFile(CATALOG,"utf8");
const v3Text = await fs.readFile(V3,"utf8");
const cache = JSON.parse(await fs.readFile(CACHE,"utf8"));

const catalog = extractAssignedJson(catalogText,"export const lavCatalog");
const v3 = extractAssignedJson(v3Text,"export const localWaterMatchIndex");
const byId = new Map(catalog.map(w=>[w.id,w]));

const out = {};
const rows = [["id","lavNumber","name","type","status","tier","lat","lon","candidateName","distanceKm","gap","nearCount","veryNearCount","reason"]];

for (const [id,v3rec] of Object.entries(v3)) {
  const water = byId.get(id);
  if (!water) continue;

  let ranked = [];
  const anchor = anchorFromCache(v3rec,cache);

  if (anchor) {
    const elements = overpassElementsForAnchor(anchor,cache);
    ranked = elements.map(toCandidate).filter(Boolean).map(c=>scoreCandidate(water,c,anchor)).sort((a,b)=>b.score-a.score);
  }

  const decision = classify(water,v3rec,ranked);
  const best = ranked[0];

  const rec = {
    status:decision.status,
    tier:decision.tier,
    ...(best ? {
      latitude:Number(best.candidate.latitude.toFixed(7)),
      longitude:Number(best.candidate.longitude.toFixed(7)),
      confidence:Number(best.score.toFixed(3)),
      candidateName:best.candidate.name || undefined,
      candidateId:best.candidate.id,
      distanceKm:Number(best.distanceKm.toFixed(2))
    } : {
      ...(v3rec.latitude != null ? {latitude:v3rec.latitude}:{}),
      ...(v3rec.longitude != null ? {longitude:v3rec.longitude}:{})
    }),
    ...(decision.gap != null ? {gap:Number(decision.gap.toFixed(3))}:{}),
    ...(decision.nearCount != null ? {nearCount:decision.nearCount}:{}),
    ...(decision.veryNearCount != null ? {veryNearCount:decision.veryNearCount}:{}),
    reason:decision.reason
  };

  out[id]=rec;

  if(rec.status!=="matched"){
    rows.push([
      id,water.lavNumber,water.name,water.type,rec.status,rec.tier,
      rec.latitude,rec.longitude,rec.candidateName,rec.distanceKm,rec.gap,
      rec.nearCount,rec.veryNearCount,rec.reason
    ]);
  }
}

const stable = Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b,"de")));
await fs.writeFile(OUTPUT,renderTs(stable),"utf8");
await fs.writeFile(REVIEW,rows.map(r=>r.map(csv).join(";")).join("\n")+"\n","utf8");

const stats=Object.values(stable).reduce((a,r)=>{
  a[r.status]=(a[r.status]||0)+1;
  a.tiers[r.tier]=(a.tiers[r.tier]||0)+1;
  return a;
},{tiers:{}});

console.log("");
console.log("HarzFishing – Matcher v5");
console.log("------------------------");
console.log(`Ausgewertet: ${Object.keys(stable).length}`);
console.log(`Matched:     ${stats.matched||0}`);
console.log(`Review:      ${stats.review||0}`);
console.log(`Unmatched:   ${stats.unmatched||0}`);
console.log("Tiers:",stats.tiers);
console.log("");
console.log(`Generated: ${path.relative(ROOT,OUTPUT)}`);
console.log(`Review:    ${path.relative(ROOT,REVIEW)}`);
