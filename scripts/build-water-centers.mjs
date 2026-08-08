#!/usr/bin/env node

/**
 * HarzFishing – Schritt 1 der Datenpipeline
 * scripts/build-water-centers.mjs
 *
 * Liest:
 *   data/lav-catalog.ts
 *   data/atkis-water-matches.generated.ts
 *   data/lav-coordinates.generated.ts
 *
 * Erzeugt:
 *   data/water-centers.generated.ts
 *   data/water-centers-review.csv
 *
 * Grundsatz:
 *   Bestehende Katalogkoordinaten werden niemals verschlechtert.
 *   Danach gilt: ATKIS/Mehrquellen-Match > OSM/Nominatim.
 *   "review" wird NICHT automatisch veröffentlicht, sondern nur in die Prüfliste geschrieben.
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DATA = path.join(ROOT, "data");

const CATALOG_FILE = path.join(DATA, "lav-catalog.ts");
const ATKIS_FILE = path.join(DATA, "atkis-water-matches.generated.ts");
const OSM_FILE = path.join(DATA, "lav-coordinates.generated.ts");

const OUTPUT_FILE = path.join(DATA, "water-centers.generated.ts");
const REVIEW_FILE = path.join(DATA, "water-centers-review.csv");

function findAssignedValue(source, exportName) {
  const marker = `export const ${exportName}`;
  const markerIndex = source.indexOf(marker);

  if (markerIndex < 0) {
    throw new Error(`Export "${exportName}" nicht gefunden.`);
  }

  const equalsIndex = source.indexOf("=", markerIndex);
  if (equalsIndex < 0) {
    throw new Error(`Zuweisung für "${exportName}" nicht gefunden.`);
  }

  let start = equalsIndex + 1;
  while (/\s/.test(source[start] ?? "")) start++;

  const opener = source[start];
  const closer = opener === "[" ? "]" : opener === "{" ? "}" : null;

  if (!closer) {
    throw new Error(
      `Export "${exportName}" beginnt nicht mit Array/Object (gefunden: ${JSON.stringify(opener)}).`
    );
  }

  let depth = 0;
  let stringQuote = null;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const char = source[i];

    if (stringQuote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === stringQuote) {
        stringQuote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      stringQuote = char;
      continue;
    }

    if (char === opener) depth++;
    if (char === closer) depth--;

    if (depth === 0) {
      return source.slice(start, i + 1);
    }
  }

  throw new Error(`Export "${exportName}" konnte nicht vollständig gelesen werden.`);
}

function parseJsonExport(source, exportName) {
  const raw = findAssignedValue(source, exportName);

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `${exportName} ist nicht als JSON-kompatibler Literal lesbar: ${error.message}`
    );
  }
}

function validCoord(latitude, longitude) {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function round(value, digits = 7) {
  return Number(value.toFixed(digits));
}

function confidenceNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

function chooseCenter(water, atkis, osm) {
  // 1. Bereits direkt im Katalog gespeicherte Lage behalten.
  if (validCoord(water.latitude, water.longitude)) {
    return {
      status: "mapped",
      latitude: round(water.latitude),
      longitude: round(water.longitude),
      confidence: 1,
      source: "catalog",
      method: "existing-coordinate",
      sourceStatus: water.sourceStatus ?? "demo",
      note: "Bereits im LAV-Katalogdatensatz vorhandene Kartenposition beibehalten."
    };
  }

  // 2. Nur echte "matched"-Treffer automatisch veröffentlichen.
  if (
    atkis?.status === "matched" &&
    validCoord(atkis.latitude, atkis.longitude)
  ) {
    return {
      status: "mapped",
      latitude: round(atkis.latitude),
      longitude: round(atkis.longitude),
      confidence: confidenceNumber(atkis.confidence, 0.8),
      source: "atkis-match",
      method: atkis.method ?? "matched",
      sourceStatus: "demo",
      officialName: atkis.officialName,
      featureId: atkis.officialFeatureId,
      note: "Automatisch aus dem vorhandenen ATKIS/OSM-Mehrquellenabgleich übernommen; Lage vor Veröffentlichung prüfen."
    };
  }

  // 3. OSM/Nominatim nur bei Status "matched".
  if (
    osm?.status === "matched" &&
    validCoord(osm.latitude, osm.longitude)
  ) {
    return {
      status: "mapped",
      latitude: round(osm.latitude),
      longitude: round(osm.longitude),
      confidence: confidenceNumber(osm.confidence, 0.7),
      source: "osm-match",
      method: osm.method ?? "matched",
      sourceStatus: "demo",
      officialName: osm.officialName,
      featureId: osm.officialFeatureId,
      note: "Automatisch aus dem vorhandenen OSM/Nominatim-Abgleich übernommen; Lage vor Veröffentlichung prüfen."
    };
  }

  // Review-Kandidaten bewusst nicht als kartiert ausgeben.
  const reviewCandidate =
    atkis?.status === "review" && validCoord(atkis.latitude, atkis.longitude)
      ? { provider: "atkis", ...atkis }
      : osm?.status === "review" && validCoord(osm.latitude, osm.longitude)
        ? { provider: "osm", ...osm }
        : null;

  if (reviewCandidate) {
    return {
      status: "review",
      latitude: round(reviewCandidate.latitude),
      longitude: round(reviewCandidate.longitude),
      confidence: confidenceNumber(reviewCandidate.confidence, 0),
      source: `${reviewCandidate.provider}-review`,
      method: reviewCandidate.method ?? "review",
      officialName: reviewCandidate.officialName,
      featureId: reviewCandidate.officialFeatureId,
      note: "Kandidat vorhanden, aber noch nicht sicher genug für automatische Kartierung."
    };
  }

  return {
    status: "unmapped",
    confidence: 0,
    source: "none",
    method: "none",
    note: "Noch keine belastbare automatische Kartenposition vorhanden."
  };
}

function stableObject(entries) {
  return Object.fromEntries(
    entries.sort(([a], [b]) => a.localeCompare(b, "de"))
  );
}

function renderTs(index) {
  return `// AUTO-GENERATED by scripts/build-water-centers.mjs
// NICHT von Hand bearbeiten.
// Priorität: vorhandene Katalogposition > matched ATKIS/Mehrquellen > matched OSM/Nominatim.
// "review"-Kandidaten werden nicht automatisch als kartiert veröffentlicht.

export interface WaterCenter {
  status: "mapped" | "review" | "unmapped";
  latitude?: number;
  longitude?: number;
  confidence: number;
  source: "catalog" | "atkis-match" | "osm-match" | "atkis-review" | "osm-review" | "none";
  method: string;
  sourceStatus?: "verified" | "demo" | "catalog";
  officialName?: string;
  featureId?: string;
  note: string;
}

export const waterCenterIndex: Record<string, WaterCenter> = ${JSON.stringify(index, null, 2)};
`;
}

function csv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function renderReview(rows) {
  const header = [
    "id",
    "lavNumber",
    "name",
    "district",
    "status",
    "latitude",
    "longitude",
    "confidence",
    "source",
    "method",
    "officialName",
    "note"
  ];

  return [
    header,
    ...rows.map(({ water, center }) => [
      water.id,
      water.lavNumber,
      water.name,
      water.district,
      center.status,
      center.latitude,
      center.longitude,
      center.confidence,
      center.source,
      center.method,
      center.officialName,
      center.note
    ])
  ]
    .map((row) => row.map(csv).join(";"))
    .join("\n") + "\n";
}

const [catalogSource, atkisSource, osmSource] = await Promise.all([
  fs.readFile(CATALOG_FILE, "utf8"),
  fs.readFile(ATKIS_FILE, "utf8"),
  fs.readFile(OSM_FILE, "utf8")
]);

const catalog = parseJsonExport(catalogSource, "lavCatalog");
const atkisIndex = parseJsonExport(atkisSource, "atkisWaterMatchIndex");
const osmIndex = parseJsonExport(osmSource, "lavCoordinateIndex");

const entries = [];
const reviewRows = [];

for (const water of catalog) {
  const center = chooseCenter(
    water,
    atkisIndex[water.id],
    osmIndex[water.id]
  );

  entries.push([water.id, center]);

  if (center.status !== "mapped") {
    reviewRows.push({ water, center });
  }
}

const index = stableObject(entries);

await Promise.all([
  fs.writeFile(OUTPUT_FILE, renderTs(index), "utf8"),
  fs.writeFile(REVIEW_FILE, renderReview(reviewRows), "utf8")
]);

const stats = Object.values(index).reduce(
  (acc, center) => {
    acc[center.status] = (acc[center.status] ?? 0) + 1;
    return acc;
  },
  {}
);

const mappedBySource = Object.values(index).reduce((acc, center) => {
  if (center.status !== "mapped") return acc;
  acc[center.source] = (acc[center.source] ?? 0) + 1;
  return acc;
}, {});

console.log("");
console.log("HarzFishing – Water Center Build");
console.log("--------------------------------");
console.log(`LAV-Gewässer: ${catalog.length}`);
console.log(`Kartiert:     ${stats.mapped ?? 0}`);
console.log(`Review:       ${stats.review ?? 0}`);
console.log(`Ohne Lage:    ${stats.unmapped ?? 0}`);
console.log("");
console.log("Kartiert nach Quelle:", mappedBySource);
console.log("");
console.log(`Erzeugt: ${path.relative(ROOT, OUTPUT_FILE)}`);
console.log(`Prüfliste: ${path.relative(ROOT, REVIEW_FILE)}`);
console.log("");
