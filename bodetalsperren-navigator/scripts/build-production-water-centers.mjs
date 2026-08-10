#!/usr/bin/env node
/**
 * HarzFishing – Production Center Merge v1
 *
 * Priorität:
 * 1. vorhandene Koordinate direkt im LAV-Katalog
 * 2. manuelle Premium-Koordinate aus harz-premium.ts
 * 3. amtlich bestätigter Zwei-Quellen-Treffer aus v6.2
 * 4. bestehender ATKIS/OSM-Mehrquellen-Match
 * 5. bestehender OSM/Nominatim-Match
 *
 * WICHTIG:
 * - "review" wird niemals als kartiert veröffentlicht
 * - vorhandene bessere Daten werden nicht überschrieben
 * - waters.ts wird noch NICHT verändert
 *
 * Ausgabe:
 *   data/water-centers.production.generated.ts
 *   data/water-centers.production-review.csv
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");

const FILES = {
  catalog: path.join(DATA, "lav-catalog.ts"),
  premium: path.join(DATA, "harz-premium.ts"),
  twoSource: path.join(DATA, "two-source-water-v6-2.generated.ts"),
  atkis: path.join(DATA, "atkis-water-matches.generated.ts"),
  osm: path.join(DATA, "lav-coordinates.generated.ts"),
  output: path.join(DATA, "water-centers.production.generated.ts"),
  review: path.join(DATA, "water-centers.production-review.csv"),
};

function extractAssignedJson(text, marker) {
  const pos = text.indexOf(marker);
  if (pos < 0) throw new Error(`Marker nicht gefunden: ${marker}`);

  const equals = text.indexOf("=", pos);
  const arr = text.indexOf("[", equals);
  const obj = text.indexOf("{", equals);

  const begin =
    arr >= 0 && (obj < 0 || arr < obj)
      ? arr
      : obj;

  if (begin < 0) {
    throw new Error(`Kein Array/Object nach ${marker}`);
  }

  const open = text[begin];
  const close = open === "[" ? "]" : "}";

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = begin; i < text.length; i++) {
    const ch = text[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === open) depth++;
    if (ch === close) depth--;

    if (depth === 0) {
      return JSON.parse(text.slice(begin, i + 1));
    }
  }

  throw new Error(`Literal unvollständig: ${marker}`);
}

async function readText(file, optional = false) {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    if (optional) return "";
    throw error;
  }
}

/**
 * harz-premium.ts ist kein reines JSON-Literal, weil dort Typen/Formatierung erlaubt sind.
 * Wir extrahieren daher nur sichere latitude/longitude-Werte pro LAV-Nummer.
 */
function parsePremiumCoordinates(text) {
  const result = {};
  if (!text) return result;

  const entryRegex =
    /["'](\d+-\d+-\d+)["']\s*:\s*\{([\s\S]*?)(?=\n\s*["']\d+-\d+-\d+["']\s*:|\n\s*\}\s*;?\s*$)/g;

  for (const match of text.matchAll(entryRegex)) {
    const lavNumber = match[1];
    const body = match[2];

    const latMatch = body.match(/\blatitude\s*:\s*(-?\d+(?:\.\d+)?)/);
    const lonMatch = body.match(/\blongitude\s*:\s*(-?\d+(?:\.\d+)?)/);

    if (!latMatch || !lonMatch) continue;

    const latitude = Number(latMatch[1]);
    const longitude = Number(lonMatch[1]);

    if (validCoord(latitude, longitude)) {
      result[lavNumber] = {
        latitude,
        longitude,
      };
    }
  }

  return result;
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

function chooseCenter(water, sources) {
  // 1. Bereits im Katalog gespeicherte Lage.
  if (validCoord(water.latitude, water.longitude)) {
    return {
      status: "mapped",
      latitude: round(water.latitude),
      longitude: round(water.longitude),
      source: "catalog-existing",
      confidence: 1,
      sourceStatus: water.sourceStatus ?? "demo",
      note: "Bereits im Katalog gespeicherte Position beibehalten.",
    };
  }

  // 2. Manuelle Premium-Lage.
  const premium = water.lavNumber
    ? sources.premium[water.lavNumber]
    : undefined;

  if (
    premium &&
    validCoord(premium.latitude, premium.longitude)
  ) {
    return {
      status: "mapped",
      latitude: round(premium.latitude),
      longitude: round(premium.longitude),
      source: "premium-manual",
      confidence: 1,
      sourceStatus: "verified",
      note: "Manuelle Premium-Koordinate hat Vorrang vor automatisch erzeugten Daten.",
    };
  }

  // 3. Zwei-Quellen-Verifikation.
  const two = sources.twoSource[water.id];

  if (
    two?.status === "matched" &&
    validCoord(two.latitude, two.longitude)
  ) {
    return {
      status: "mapped",
      latitude: round(two.latitude),
      longitude: round(two.longitude),
      source: "two-source-v6.2",
      confidence:
        typeof two.osmConfidence === "number"
          ? two.osmConfidence
          : 0.9,
      sourceStatus: "verified",
      officialDistanceM: two.officialDistanceM,
      officialFeatureId: two.officialFeatureId,
      note:
        "OSM-Kandidat durch amtliche HY-P-Geometrie aus dem Basis-DLM bestätigt.",
    };
  }

  // 4. Bestehender ATKIS-/Mehrquellen-Match.
  const atkis = sources.atkis[water.id];

  if (
    atkis?.status === "matched" &&
    validCoord(atkis.latitude, atkis.longitude)
  ) {
    return {
      status: "mapped",
      latitude: round(atkis.latitude),
      longitude: round(atkis.longitude),
      source: "atkis-match",
      confidence:
        typeof atkis.confidence === "number"
          ? atkis.confidence
          : 0.8,
      sourceStatus: "demo",
      note:
        "Bestehender ATKIS/OSM-Mehrquellenabgleich übernommen.",
    };
  }

  // 5. Bestehender OSM-/Nominatim-Match.
  const osm = sources.osm[water.id];

  if (
    osm?.status === "matched" &&
    validCoord(osm.latitude, osm.longitude)
  ) {
    return {
      status: "mapped",
      latitude: round(osm.latitude),
      longitude: round(osm.longitude),
      source: "osm-match",
      confidence:
        typeof osm.confidence === "number"
          ? osm.confidence
          : 0.7,
      sourceStatus: "demo",
      note:
        "Bestehender OSM/Nominatim-Match übernommen.",
    };
  }

  // Review-Hinweise nur dokumentieren, nicht veröffentlichen.
  const review =
    two?.status === "review"
      ? {
          source: "two-source-v6.2-review",
          latitude: two.latitude,
          longitude: two.longitude,
          confidence: two.osmConfidence,
        }
      : atkis?.status === "review"
        ? {
            source: "atkis-review",
            latitude: atkis.latitude,
            longitude: atkis.longitude,
            confidence: atkis.confidence,
          }
        : osm?.status === "review"
          ? {
              source: "osm-review",
              latitude: osm.latitude,
              longitude: osm.longitude,
              confidence: osm.confidence,
            }
          : null;

  if (review) {
    return {
      status: "review",
      candidateSource: review.source,
      candidateLatitude: review.latitude,
      candidateLongitude: review.longitude,
      confidence:
        typeof review.confidence === "number"
          ? review.confidence
          : 0,
      note:
        "Kandidat vorhanden, aber bewusst nicht als kartiert veröffentlicht.",
    };
  }

  return {
    status: "unmapped",
    confidence: 0,
    note: "Noch keine belastbare Kartenposition vorhanden.",
  };
}

function renderTs(index) {
  return `// AUTO-GENERATED by scripts/build-production-water-centers.mjs
// NICHT von Hand bearbeiten.
// Priorität:
// catalog-existing > premium-manual > two-source-v6.2 > atkis-match > osm-match
// Review-Kandidaten werden nicht als kartiert veröffentlicht.

export interface ProductionWaterCenter {
  status: "mapped" | "review" | "unmapped";
  latitude?: number;
  longitude?: number;
  source?: "catalog-existing" | "premium-manual" | "two-source-v6.2" | "atkis-match" | "osm-match";
  confidence: number;
  sourceStatus?: "verified" | "demo" | "catalog";
  officialDistanceM?: number;
  officialFeatureId?: string;
  candidateSource?: string;
  candidateLatitude?: number;
  candidateLongitude?: number;
  note: string;
}

export const productionWaterCenterIndex: Record<string, ProductionWaterCenter> = ${JSON.stringify(
    index,
    null,
    2
  )};
`;
}

const csv = (value) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

function renderReview(catalog, index) {
  const rows = [[
    "id",
    "lavNumber",
    "name",
    "district",
    "status",
    "candidateSource",
    "candidateLatitude",
    "candidateLongitude",
    "confidence",
    "note",
  ]];

  for (const water of catalog) {
    const record = index[water.id];
    if (!record || record.status === "mapped") continue;

    rows.push([
      water.id,
      water.lavNumber,
      water.name,
      water.district,
      record.status,
      record.candidateSource,
      record.candidateLatitude,
      record.candidateLongitude,
      record.confidence,
      record.note,
    ]);
  }

  return (
    rows
      .map((row) => row.map(csv).join(";"))
      .join("\n") + "\n"
  );
}

const [
  catalogText,
  premiumText,
  twoSourceText,
  atkisText,
  osmText,
] = await Promise.all([
  readText(FILES.catalog),
  readText(FILES.premium, true),
  readText(FILES.twoSource, true),
  readText(FILES.atkis, true),
  readText(FILES.osm, true),
]);

const catalog = extractAssignedJson(
  catalogText,
  "export const lavCatalog"
);

const premium = parsePremiumCoordinates(premiumText);

const twoSource = twoSourceText
  ? extractAssignedJson(
      twoSourceText,
      "export const twoSourceWaterV62Index"
    )
  : {};

const atkis = atkisText
  ? extractAssignedJson(
      atkisText,
      "export const atkisWaterMatchIndex"
    )
  : {};

const osm = osmText
  ? extractAssignedJson(
      osmText,
      "export const lavCoordinateIndex"
    )
  : {};

const sources = {
  premium,
  twoSource,
  atkis,
  osm,
};

const index = {};

for (const water of catalog) {
  index[water.id] = chooseCenter(water, sources);
}

const stable = Object.fromEntries(
  Object.entries(index).sort(([a], [b]) =>
    a.localeCompare(b, "de")
  )
);

await fs.writeFile(
  FILES.output,
  renderTs(stable),
  "utf8"
);

await fs.writeFile(
  FILES.review,
  renderReview(catalog, stable),
  "utf8"
);

const stats = Object.values(stable).reduce(
  (acc, record) => {
    acc[record.status] =
      (acc[record.status] || 0) + 1;

    if (record.status === "mapped") {
      acc.sources[record.source] =
        (acc.sources[record.source] || 0) + 1;
    }

    return acc;
  },
  { sources: {} }
);

console.log("");
console.log("HarzFishing – Production Center Merge");
console.log("-------------------------------------");
console.log(`LAV-Gewässer: ${catalog.length}`);
console.log(`Kartiert:     ${stats.mapped || 0}`);
console.log(`Review:       ${stats.review || 0}`);
console.log(`Ohne Lage:    ${stats.unmapped || 0}`);
console.log("");
console.log("Kartiert nach Quelle:", stats.sources);
console.log("");
console.log(
  `Generated: ${path.relative(ROOT, FILES.output)}`
);
console.log(
  `Review:    ${path.relative(ROOT, FILES.review)}`
);
