#!/usr/bin/env node
/**
 * HarzFishing – Review Verifier v7
 *
 * Bearbeitet ausschließlich bestehende `review`-Fälle aus:
 *   data/two-source-water-v6-2-review.csv
 *
 * Bestehende `matched`-Treffer bleiben unangetastet.
 *
 * Strategie:
 *   A) vorhandene amtliche HY-P-Bestätigung konservativ neu bewerten
 *   B) Fälle ohne HY-P-Treffer mit größerer amtlicher BBOX erneut prüfen
 *   C) Fließgewässer nur bei zusätzlichem Namenssignal automatisch freigeben
 *
 * Schreibt aktualisiert zurück:
 *   data/two-source-water-v6-2.generated.ts
 *
 * Zusätzlich:
 *   data/review-v7-result.csv
 *   data/review-v7-cache.json
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");

const REVIEW_INPUT = path.join(DATA, "two-source-water-v6-2-review.csv");
const GENERATED = path.join(DATA, "two-source-water-v6-2.generated.ts");
const OUTPUT_REVIEW = path.join(DATA, "review-v7-result.csv");
const CACHE = path.join(DATA, "review-v7-cache.json");

const WFS =
  "https://geodatenportal.sachsen-anhalt.de/ows_INSPIRE_LVermGeo_ATKIS_HY-P_WFS";

const args = process.argv.slice(2);
const opt = (name, fallback = "") =>
  args.find((x) => x.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ??
  fallback;

const wideBboxM = Math.max(
  400,
  Math.min(1500, Number(opt("bbox", "800")) || 800)
);

const requestTimeoutMs = Math.max(
  10000,
  Math.min(60000, Number(opt("timeout", "30000")) || 30000)
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractAssignedJson(text, marker) {
  const pos = text.indexOf(marker);
  if (pos < 0) throw new Error(`Marker nicht gefunden: ${marker}`);

  const eq = text.indexOf("=", pos);
  const arr = text.indexOf("[", eq);
  const obj = text.indexOf("{", eq);
  const begin = arr >= 0 && (obj < 0 || arr < obj) ? arr : obj;

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

  throw new Error(`Unvollständiges Literal: ${marker}`);
}

function parseCsvLine(line) {
  const out = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ";" && !quoted) {
      out.push(value);
      value = "";
    } else {
      value += ch;
    }
  }

  out.push(value);
  return out;
}

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean);

  if (!lines.length) return [];

  const header = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      header.map((key, index) => [key, values[index] ?? ""])
    );
  });
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalize(s = "") {
  return String(s)
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

function coreName(s = "") {
  return normalize(s)
    .replace(
      /\b(teich|teiche|see|weiher|kuhle|kiesgrube|grube|wasser|wasserspeicher|speicher|stausee|talsperre|graben|bach|fluss|kanal|tagebau|restloch|altarm|hafen)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(s) {
  return new Set(normalize(s).split(" ").filter((x) => x.length > 2));
}

function similarity(a, b) {
  const A = normalize(a);
  const B = normalize(b);
  const CA = coreName(a);
  const CB = coreName(b);

  if (!A || !B) return 0;
  if (A === B) return 1;
  if (CA && CB && CA === CB) return 0.98;

  if (A.includes(B) || B.includes(A)) {
    return Math.min(A.length, B.length) / Math.max(A.length, B.length);
  }

  const AA = tokenSet(A);
  const BB = tokenSet(B);

  let common = 0;
  for (const x of AA) if (BB.has(x)) common++;

  const jac = AA.size && BB.size
    ? common / (AA.size + BB.size - common)
    : 0;

  const CAA = tokenSet(CA);
  const CBB = tokenSet(CB);

  common = 0;
  for (const x of CAA) if (CBB.has(x)) common++;

  const coreJac = CAA.size && CBB.size
    ? common / (CAA.size + CBB.size - common)
    : 0;

  return Math.max(jac, coreJac);
}

// WGS84 -> ETRS89 / UTM Zone 32N (EPSG:25832)
function wgs84ToUtm32(latitude, longitude) {
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);

  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  const lon0 = (9 * Math.PI) / 180;

  const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const T = Math.tan(lat) ** 2;
  const C = ep2 * Math.cos(lat) ** 2;
  const A = Math.cos(lat) * (lon - lon0);

  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * lat -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) *
        Math.sin(2 * lat) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) *
        Math.sin(4 * lat) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * lat));

  const easting =
    500000 +
    k0 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120);

  const northing =
    k0 *
    (M +
      N *
        Math.tan(lat) *
        (A ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
          ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) /
            720));

  return { easting, northing };
}

function decodeXml(s = "") {
  return String(s)
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function tagValues(xml, localName) {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${localName}>`,
    "gi"
  );

  return [...xml.matchAll(re)]
    .map((m) => decodeXml(m[1].replace(/<[^>]+>/g, "").trim()))
    .filter(Boolean);
}

function extractFeatureBlocks(xml, typeLocalName) {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${typeLocalName}(?:\\s[^>]*)?[\\s\\S]*?<\\/(?:[\\w.-]+:)?${typeLocalName}>`,
    "gi"
  );

  return [...xml.matchAll(re)].map((m) => m[0]);
}

function parseNumberList(text) {
  return String(text)
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter(Number.isFinite);
}

function geometryPointsFromFeatureXml(block) {
  const points = [];

  for (const text of tagValues(block, "posList")) {
    const nums = parseNumberList(text);

    for (let i = 0; i + 1 < nums.length; i += 2) {
      points.push({ x: nums[i], y: nums[i + 1] });
    }
  }

  for (const text of tagValues(block, "pos")) {
    const nums = parseNumberList(text);

    if (nums.length >= 2) {
      points.push({ x: nums[0], y: nums[1] });
    }
  }

  return points;
}

function featureName(block) {
  const possible = [
    ...tagValues(block, "text"),
    ...tagValues(block, "name"),
    ...tagValues(block, "geographicalName"),
    ...tagValues(block, "localName"),
  ];

  return possible.find((x) => x && x.length <= 120) || "";
}

function featureId(block) {
  const hit =
    block.match(/gml:id="([^"]+)"/i) ||
    block.match(/gml:id='([^']+)'/i);

  return hit?.[1] || "";
}

function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  );

  const x = ax + t * dx;
  const y = ay + t * dy;

  return Math.hypot(px - x, py - y);
}

function minDistanceToGeometry(point, coords) {
  if (!coords.length) return Infinity;

  if (coords.length === 1) {
    return Math.hypot(point.x - coords[0].x, point.y - coords[0].y);
  }

  let min = Infinity;

  for (let i = 0; i < coords.length - 1; i++) {
    min = Math.min(
      min,
      pointSegmentDistance(
        point.x,
        point.y,
        coords[i].x,
        coords[i].y,
        coords[i + 1].x,
        coords[i + 1].y
      )
    );
  }

  return min;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

async function fetchOfficial(typeName, point, cache) {
  const minX = point.easting - wideBboxM;
  const minY = point.northing - wideBboxM;
  const maxX = point.easting + wideBboxM;
  const maxY = point.northing + wideBboxM;

  const key = [
    typeName,
    minX.toFixed(0),
    minY.toFixed(0),
    maxX.toFixed(0),
    maxY.toFixed(0),
  ].join("|");

  if (cache[key]) return cache[key];

  const url = new URL(WFS);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeNames", typeName);
  url.searchParams.set("srsName", "urn:ogc:def:crs:EPSG::25832");
  url.searchParams.set(
    "bbox",
    `${minX},${minY},${maxX},${maxY},urn:ogc:def:crs:EPSG::25832`
  );
  url.searchParams.set("count", "100");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/gml+xml; version=3.2, application/xml, text/xml",
      },
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `WFS ${response.status}: ${
          tagValues(text, "ExceptionText").join(" | ") || text.slice(0, 180)
        }`
      );
    }

    cache[key] = text;
    await writeJson(CACHE, cache);
    await sleep(180);

    return text;
  } finally {
    clearTimeout(timer);
  }
}

function classifyExisting(row) {
  const type = String(row.type || "");
  const isFlow = type.toLocaleLowerCase("de-DE").includes("fließ");

  const distance = numberOrNull(row.officialDistanceM);
  const count = numberOrNull(row.officialCandidateCount);
  const gap = numberOrNull(row.distanceGapM);
  const nameScore = numberOrNull(row.nameScore) ?? 0;

  if (distance == null) return null;

  // Fließgewässer: nur mit starkem Namenssignal automatisch bestätigen.
  if (isFlow) {
    if (
      distance <= 25 &&
      nameScore >= 0.65 &&
      (gap == null || gap >= 50 || count === 1)
    ) {
      return {
        promote: true,
        tier: "flow-named",
        reason:
          "Fließgewässer: sehr nahe amtliche Geometrie plus starkes Namenssignal.",
      };
    }

    return {
      promote: false,
      tier: "flow-review",
      reason:
        "Fließgewässer bleibt ohne starkes zusätzliches Namenssignal im Review.",
    };
  }

  // Stehende Gewässer.
  if (distance <= 20 && count === 1) {
    return {
      promote: true,
      tier: "standing-single-20",
      reason:
        "Einziges amtliches stehendes Gewässerobjekt innerhalb 20 m.",
    };
  }

  if (distance <= 30 && gap != null && gap >= 100) {
    return {
      promote: true,
      tier: "standing-gap-30",
      reason:
        "Amtliche Geometrie innerhalb 30 m und mindestens 100 m Vorsprung vor dem Zweitkandidaten.",
    };
  }

  if (
    distance <= 50 &&
    nameScore >= 0.65 &&
    (gap == null || gap >= 60 || count === 1)
  ) {
    return {
      promote: true,
      tier: "standing-name-50",
      reason:
        "Nahe amtliche Geometrie mit zusätzlicher Namensbestätigung.",
    };
  }

  return {
    promote: false,
    tier: "standing-review",
    reason:
      "Amtlicher Kandidat vorhanden, aber Eindeutigkeit für automatische Freigabe noch nicht ausreichend.",
  };
}

function classifyWide(row, candidates) {
  const isFlow = String(row.type || "")
    .toLocaleLowerCase("de-DE")
    .includes("fließ");

  if (!candidates.length) {
    return {
      promote: false,
      tier: "wide-none",
      reason:
        `Auch im erweiterten ±${wideBboxM}-m-Prüfbereich kein amtliches Gewässerobjekt gefunden.`,
    };
  }

  candidates.sort((a, b) => a.distanceM - b.distanceM);

  const best = candidates[0];
  const second = candidates[1];

  const gapM =
    second?.distanceM != null
      ? second.distanceM - best.distanceM
      : 9999;

  const nameScore = best.name
    ? similarity(row.name, best.name)
    : 0;

  if (isFlow) {
    const promote =
      best.distanceM <= 20 &&
      nameScore >= 0.70 &&
      gapM >= 50;

    return {
      promote,
      tier: promote ? "wide-flow-named" : "wide-flow-review",
      best,
      gapM,
      nameScore,
      reason: promote
        ? "Erweiterte amtliche Suche: Fließgewässer sehr nah, benannt und eindeutig."
        : "Erweiterte amtliche Suche liefert keinen ausreichend eindeutigen Fließgewässer-Treffer.",
    };
  }

  // Bei zuvor fehlendem HY-P-Treffer sind wir absichtlich strenger:
  // reine Nähe reicht nicht, es muss zusätzlich Eindeutigkeit vorliegen.
  const promote =
    best.distanceM <= 25 &&
    (candidates.length === 1 || gapM >= 120);

  return {
    promote,
    tier: promote ? "wide-standing-unique" : "wide-standing-review",
    best,
    gapM,
    nameScore,
    reason: promote
      ? "Erweiterte amtliche Suche: sehr nahes und räumlich eindeutiges stehendes Gewässer."
      : "Erweiterte amtliche Suche liefert noch keine ausreichend eindeutige Zuordnung.",
  };
}

function renderGenerated(index) {
  return `// AUTO-GENERATED / updated by scripts/review-verifier-v7.mjs
// Zweiquellen-Abgleich OSM + amtlicher HY-P WFS.
// v7 ändert ausschließlich bestehende Review-Fälle.

export interface TwoSourceWaterV62Match {
  status: "matched" | "review" | "unmatched";
  latitude?: number;
  longitude?: number;
  osmConfidence?: number;
  officialDistanceM?: number;
  officialName?: string;
  officialFeatureId?: string;
  officialType?: "StandingWater" | "Watercourse";
  officialCandidateCount?: number;
  nameScore?: number;
  distanceGapM?: number;
  reviewTier?: string;
  reason: string;
}

export const twoSourceWaterV62Index: Record<string, TwoSourceWaterV62Match> = ${JSON.stringify(
    index,
    null,
    2
  )};
`;
}

const csv = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;

const reviewRows = parseCsv(
  await fs.readFile(REVIEW_INPUT, "utf8")
);

const generatedText = await fs.readFile(GENERATED, "utf8");
const index = extractAssignedJson(
  generatedText,
  "export const twoSourceWaterV62Index"
);

const cache = await readJson(CACHE, {});

const reviews = reviewRows.filter(
  (row) => row.status === "review"
);

console.log("");
console.log("HarzFishing – Review Verifier v7");
console.log("--------------------------------");
console.log(`Review-Fälle: ${reviews.length}`);
console.log(`Erweiterte HY-P-BBOX: ±${wideBboxM} m`);
console.log("");

const stats = {
  reviewed: 0,
  promoted: 0,
  keptReview: 0,
  wideQueries: 0,
  wfsErrors: 0,
};

const report = [[
  "id",
  "lavNumber",
  "name",
  "type",
  "result",
  "tier",
  "officialDistanceM",
  "officialName",
  "officialCandidateCount",
  "nameScore",
  "distanceGapM",
  "reason",
]];

for (let i = 0; i < reviews.length; i++) {
  const row = reviews[i];
  const current = index[row.id];

  if (!current || current.status !== "review") {
    continue;
  }

  stats.reviewed++;

  let decision = classifyExisting(row);

  // Kein amtlicher Treffer im alten ±350-m-Fenster:
  // gezielt mit größerer BBOX nachprüfen.
  if (!decision) {
    const latitude = numberOrNull(row.latitude);
    const longitude = numberOrNull(row.longitude);

    if (latitude != null && longitude != null) {
      stats.wideQueries++;

      try {
        const point = wgs84ToUtm32(latitude, longitude);
        const isFlow = String(row.type || "")
          .toLocaleLowerCase("de-DE")
          .includes("fließ");

        const typeName = isFlow
          ? "hy-p:Watercourse"
          : "hy-p:StandingWater";

        const localType = isFlow
          ? "Watercourse"
          : "StandingWater";

        const xml = await fetchOfficial(
          typeName,
          point,
          cache
        );

        const blocks = extractFeatureBlocks(
          xml,
          localType
        );

        const candidates = blocks
          .map((block) => {
            const coords =
              geometryPointsFromFeatureXml(block);

            if (!coords.length) return null;

            return {
              id: featureId(block),
              name: featureName(block),
              distanceM: minDistanceToGeometry(
                { x: point.easting, y: point.northing },
                coords
              ),
            };
          })
          .filter(Boolean);

        decision = classifyWide(
          row,
          candidates
        );

        if (decision.best) {
          current.officialDistanceM = Number(
            decision.best.distanceM.toFixed(1)
          );
          current.officialName =
            decision.best.name || undefined;
          current.officialFeatureId =
            decision.best.id || undefined;
          current.officialType = localType;
          current.officialCandidateCount =
            candidates.length;
          current.nameScore = Number(
            (decision.nameScore ?? 0).toFixed(3)
          );
          current.distanceGapM = Number(
            (decision.gapM ?? 0).toFixed(1)
          );
        }
      } catch (error) {
        stats.wfsErrors++;

        decision = {
          promote: false,
          tier: "wide-error",
          reason:
            `Erweiterte amtliche Abfrage fehlgeschlagen: ${error.message}`,
        };
      }
    } else {
      decision = {
        promote: false,
        tier: "no-osm-point",
        reason:
          "Review enthält keinen nutzbaren OSM-Punkt für die erweiterte amtliche Prüfung.",
      };
    }
  }

  current.reviewTier = decision.tier;
  current.reason = decision.reason;

  if (decision.promote) {
    current.status = "matched";
    stats.promoted++;
  } else {
    stats.keptReview++;
  }

  report.push([
    row.id,
    row.lavNumber,
    row.name,
    row.type,
    current.status,
    decision.tier,
    current.officialDistanceM,
    current.officialName,
    current.officialCandidateCount,
    current.nameScore,
    current.distanceGapM,
    decision.reason,
  ]);

  console.log(
    `${i + 1}/${reviews.length} ${row.lavNumber} ${row.name} -> ` +
      `${current.status} [${decision.tier}]`
  );

  // Fortschritt sicher speichern.
  if ((i + 1) % 10 === 0) {
    await fs.writeFile(
      GENERATED,
      renderGenerated(index),
      "utf8"
    );
  }
}

await fs.writeFile(
  GENERATED,
  renderGenerated(index),
  "utf8"
);

await fs.writeFile(
  OUTPUT_REVIEW,
  report
    .map((row) => row.map(csv).join(";"))
    .join("\n") + "\n",
  "utf8"
);

const cumulative = Object.values(index).reduce(
  (acc, record) => {
    acc[record.status] =
      (acc[record.status] || 0) + 1;
    return acc;
  },
  {}
);

console.log("");
console.log("v7-Ergebnis:", stats);
console.log("Zwei-Quellen kumuliert:", cumulative);
console.log(`Generated aktualisiert: ${path.relative(ROOT, GENERATED)}`);
console.log(`v7-Bericht:             ${path.relative(ROOT, OUTPUT_REVIEW)}`);
console.log(`v7-Cache:               ${path.relative(ROOT, CACHE)}`);
