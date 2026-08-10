#!/usr/bin/env node
/**
 * HarzFishing – Matcher v4 / Review Classifier
 *
 * Liest:
 *   data/lav-catalog.ts
 *   data/local-water-matches.generated.ts
 *
 * Erzeugt:
 *   data/local-water-v4.generated.ts
 *   data/local-water-v4-review.csv
 *
 * Zweck:
 *   Die v3-Kandidaten konservativ klassifizieren.
 *   Bestehende App-Daten werden NICHT verändert.
 *
 * Regeln:
 *   - benannter Kandidat + sehr guter Namensmatch + richtiger Typ -> matched
 *   - Fließgewässer bleiben konservativ review, auch bei gutem Namen
 *   - unbenannte Kandidaten werden NICHT blind bestätigt
 *   - sehr nahe unbenannte stehende Gewässer -> high-review
 *   - Rest -> review/unmatched
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const CATALOG = path.join(DATA, "lav-catalog.ts");
const INPUT = path.join(DATA, "local-water-matches.generated.ts");
const OUTPUT = path.join(DATA, "local-water-v4.generated.ts");
const REVIEW = path.join(DATA, "local-water-v4-review.csv");

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
  const beginObj = text.indexOf("{", equals);
  const beginArr = text.indexOf("[", equals);
  let begin;
  let open;
  let close;

  if (beginArr >= 0 && (beginObj < 0 || beginArr < beginObj)) {
    begin = beginArr; open = "["; close = "]";
  } else {
    begin = beginObj; open = "{"; close = "}";
  }

  let depth = 0, quote = null, escaped = false;
  for (let i = begin; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === open) depth++;
    if (ch === close) depth--;
    if (depth === 0) return JSON.parse(text.slice(begin, i + 1));
  }
  throw new Error(`JSON-Literal unvollständig: ${marker}`);
}

function isFlow(water, candidate) {
  return water?.type === "Fließgewässer" || candidate?.officialTypeName === "flow";
}

function classify(water, candidate) {
  if (!candidate || candidate.status === "unmatched" || candidate.latitude == null || candidate.longitude == null) {
    return {
      status: "unmatched",
      tier: "none",
      reason: "Kein v3-Wasserkandidat vorhanden."
    };
  }

  const candidateName = candidate.officialName || "";
  const matchedAlias = candidate.matchedAlias || water.name || "";
  const nameScore = candidateName ? similarity(matchedAlias, candidateName) : 0;
  const distanceKm = Number(candidate.distanceKm);
  const confidence = Number(candidate.confidence || 0);
  const flow = isFlow(water, candidate);

  // Flüsse/Kanäle: ein einzelner Punkt ist kein belastbarer Gewässermittelpunkt.
  if (flow) {
    return {
      status: "review",
      tier: candidateName && nameScore >= 0.85 ? "flow-named" : "flow",
      reason: candidateName && nameScore >= 0.85
        ? "Fließgewässername passt gut; Punkt repräsentiert aber nur einen Abschnitt."
        : "Fließgewässer benötigt Abschnittsprüfung statt automatischem Mittelpunkt.",
      nameScore
    };
  }

  // Starke benannte Übereinstimmung.
  if (
    candidateName &&
    nameScore >= 0.88 &&
    distanceKm <= 2.5 &&
    confidence >= 0.78
  ) {
    return {
      status: "matched",
      tier: "named-strong",
      reason: "Benanntes stehendes Wasser mit sehr guter Namensübereinstimmung und lokaler Nähe.",
      nameScore
    };
  }

  // Gute benannte Übereinstimmung, aber noch nicht automatisch freigeben.
  if (
    candidateName &&
    nameScore >= 0.72 &&
    distanceKm <= 4 &&
    confidence >= 0.65
  ) {
    return {
      status: "review",
      tier: "named-review",
      reason: "Benannter Wasserkandidat plausibel, aber Schwelle für automatische Freigabe nicht erreicht.",
      nameScore
    };
  }

  // Unbenannte Gewässer: Nähe allein reicht NICHT für matched.
  if (
    !candidateName &&
    distanceKm <= 0.25 &&
    confidence >= 0.90
  ) {
    return {
      status: "review",
      tier: "unnamed-high",
      reason: "Sehr nahes unbenanntes stehendes Wasser; vor Freigabe konkurrierende Teiche/Fläche prüfen.",
      nameScore: 0
    };
  }

  if (
    !candidateName &&
    distanceKm <= 1.5 &&
    confidence >= 0.80
  ) {
    return {
      status: "review",
      tier: "unnamed-medium",
      reason: "Nahes unbenanntes stehendes Wasser; räumlich plausibel, aber nicht eindeutig.",
      nameScore: 0
    };
  }

  return {
    status: "review",
    tier: "low",
    reason: "Wasserkandidat vorhanden, aber für automatische Freigabe nicht eindeutig genug.",
    nameScore
  };
}

function renderTs(index) {
  return `// AUTO-GENERATED by scripts/classify-local-water-v4.mjs
// NICHT von Hand bearbeiten.
// v4 bestätigt nur konservativ starke benannte stehende Gewässer.

export interface LocalWaterV4Match {
  status: "matched" | "review" | "unmatched";
  tier: "named-strong" | "named-review" | "unnamed-high" | "unnamed-medium" | "flow-named" | "flow" | "low" | "none";
  latitude?: number;
  longitude?: number;
  confidence?: number;
  nameScore?: number;
  method?: string;
  locality?: string;
  officialName?: string;
  officialFeatureId?: string;
  officialTypeName?: string;
  distanceKm?: number;
  areaHa?: number;
  reason: string;
}

export const localWaterV4Index: Record<string, LocalWaterV4Match> = ${JSON.stringify(index, null, 2)};
`;
}

const csv = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;

function renderCsv(rows) {
  const head = [
    "id","lavNumber","name","type","district","status","tier",
    "latitude","longitude","confidence","nameScore","distanceKm",
    "candidateName","locality","reason"
  ];
  return [head, ...rows].map((r) => r.map(csv).join(";")).join("\n") + "\n";
}

const catalogText = await fs.readFile(CATALOG, "utf8");
const inputText = await fs.readFile(INPUT, "utf8");

const catalog = extractAssignedJson(catalogText, "export const lavCatalog");
const input = extractAssignedJson(inputText, "export const localWaterMatchIndex");

const byId = new Map(catalog.map((w) => [w.id, w]));
const output = {};
const reviewRows = [];

for (const [id, candidate] of Object.entries(input)) {
  const water = byId.get(id);
  if (!water) continue;

  const decision = classify(water, candidate);

  const record = {
    status: decision.status,
    tier: decision.tier,
    ...(candidate.latitude != null ? { latitude: candidate.latitude } : {}),
    ...(candidate.longitude != null ? { longitude: candidate.longitude } : {}),
    ...(candidate.confidence != null ? { confidence: candidate.confidence } : {}),
    ...(decision.nameScore != null ? { nameScore: Number(decision.nameScore.toFixed(3)) } : {}),
    ...(candidate.method ? { method: candidate.method } : {}),
    ...(candidate.locality ? { locality: candidate.locality } : {}),
    ...(candidate.officialName ? { officialName: candidate.officialName } : {}),
    ...(candidate.officialFeatureId ? { officialFeatureId: candidate.officialFeatureId } : {}),
    ...(candidate.officialTypeName ? { officialTypeName: candidate.officialTypeName } : {}),
    ...(candidate.distanceKm != null ? { distanceKm: candidate.distanceKm } : {}),
    ...(candidate.areaHa != null ? { areaHa: candidate.areaHa } : {}),
    reason: decision.reason
  };

  output[id] = record;

  if (decision.status !== "matched") {
    reviewRows.push([
      id, water.lavNumber, water.name, water.type, water.district,
      decision.status, decision.tier,
      candidate.latitude, candidate.longitude, candidate.confidence,
      record.nameScore, candidate.distanceKm,
      candidate.officialName, candidate.locality, decision.reason
    ]);
  }
}

const stable = Object.fromEntries(
  Object.entries(output).sort(([a], [b]) => a.localeCompare(b, "de"))
);

await fs.writeFile(OUTPUT, renderTs(stable), "utf8");
await fs.writeFile(REVIEW, renderCsv(reviewRows), "utf8");

const stats = Object.values(stable).reduce((acc, r) => {
  acc[r.status] = (acc[r.status] || 0) + 1;
  acc.tiers[r.tier] = (acc.tiers[r.tier] || 0) + 1;
  return acc;
}, { tiers: {} });

console.log("");
console.log("HarzFishing – Matcher v4");
console.log("------------------------");
console.log(`Ausgewertet: ${Object.keys(stable).length}`);
console.log(`Matched:     ${stats.matched || 0}`);
console.log(`Review:      ${stats.review || 0}`);
console.log(`Unmatched:   ${stats.unmatched || 0}`);
console.log("Tiers:", stats.tiers);
console.log("");
console.log(`Generated: ${path.relative(ROOT, OUTPUT)}`);
console.log(`Review:    ${path.relative(ROOT, REVIEW)}`);
