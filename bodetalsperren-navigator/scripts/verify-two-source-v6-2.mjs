#!/usr/bin/env node
/**
 * HarzFishing – Zwei-Quellen-Matcher v6.2
 *
 * Quelle A: OSM-v3-Kandidat (data/local-water-matches.generated.ts)
 * Quelle B: amtlicher INSPIRE-WFS HY-P Sachsen-Anhalt
 *
 * Der WFS liefert GML 3.2.1 in EPSG:25832.
 * Dieses Skript:
 *   1) nimmt den OSM-v3-Punkt in WGS84,
 *   2) wandelt ihn nach ETRS89 / UTM 32N (EPSG:25832),
 *   3) fragt StandingWater oder Watercourse im kleinen BBOX-Fenster ab,
 *   4) parst GML-Geometrien,
 *   5) misst den Abstand Punkt <-> amtliche Geometrie,
 *   6) klassifiziert konservativ als matched / review / unmatched.
 *
 * Es verändert weder waters.ts noch harz-premium.ts.
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");

const CATALOG = path.join(DATA, "lav-catalog.ts");
const V3 = path.join(DATA, "local-water-matches.generated.ts");

const OUTPUT = path.join(DATA, "two-source-water-v6-2.generated.ts");
const REVIEW = path.join(DATA, "two-source-water-v6-2-review.csv");
const CACHE = path.join(DATA, "two-source-water-v6-2-cache.json");

const WFS =
  "https://geodatenportal.sachsen-anhalt.de/ows_INSPIRE_LVermGeo_ATKIS_HY-P_WFS";

const args = process.argv.slice(2);
const opt = (name, fallback = "") =>
  args.find((x) => x.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ??
  fallback;

const start = Number(opt("start", "0")) || 0;
const limit = Number(opt("limit", "50")) || 50;
const bboxRadiusM = Math.max(
  50,
  Math.min(1500, Number(opt("bbox", "350")) || 350)
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

function decodeXml(s = "") {
  return String(s)
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

/**
 * WGS84 -> UTM Zone 32N / EPSG:25832
 *
 * ETRS89 und WGS84 sind für diesen Zweck in Sachsen-Anhalt praktisch deckungsgleich
 * (cm-/dm-Bereich gegenüber unserem Karten-/Gewässerabgleich).
 */
function wgs84ToUtm32(latitude, longitude) {
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);

  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  const lon0 = (9 * Math.PI) / 180; // Zone 32 central meridian

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

function normalize(s = "") {
  return String(s)
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[’'`´„“”]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(s) {
  return new Set(normalize(s).split(" ").filter((x) => x.length > 2));
}

function nameSimilarity(a, b) {
  const A = normalize(a);
  const B = normalize(b);

  if (!A || !B) return 0;
  if (A === B) return 1;

  if (A.includes(B) || B.includes(A)) {
    return Math.min(A.length, B.length) / Math.max(A.length, B.length);
  }

  const AA = tokenSet(A);
  const BB = tokenSet(B);

  if (!AA.size || !BB.size) return 0;

  let common = 0;
  for (const x of AA) if (BB.has(x)) common++;

  return common / (AA.size + BB.size - common);
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

  // GML posList: x y x y ...
  const posLists = tagValues(block, "posList");

  for (const text of posLists) {
    const nums = parseNumberList(text);

    for (let i = 0; i + 1 < nums.length; i += 2) {
      points.push({ x: nums[i], y: nums[i + 1] });
    }
  }

  // GML pos: x y
  const poses = tagValues(block, "pos");

  for (const text of poses) {
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
    const d = pointSegmentDistance(
      point.x,
      point.y,
      coords[i].x,
      coords[i].y,
      coords[i + 1].x,
      coords[i + 1].y
    );

    if (d < min) min = d;
  }

  return min;
}

async function fetchWfs(typeName, point, cache) {
  const minX = point.easting - bboxRadiusM;
  const minY = point.northing - bboxRadiusM;
  const maxX = point.easting + bboxRadiusM;
  const maxY = point.northing + bboxRadiusM;

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

  // EPSG:25832 => x=easting, y=northing
  url.searchParams.set(
    "bbox",
    `${minX},${minY},${maxX},${maxY},urn:ogc:def:crs:EPSG::25832`
  );

  url.searchParams.set("count", "50");

  const response = await fetch(url, {
    headers: {
      Accept: "application/gml+xml; version=3.2, application/xml, text/xml",
    },
  });

  const text = await response.text();

  if (!response.ok) {
    const exception =
      tagValues(text, "ExceptionText").join(" | ") || text.slice(0, 400);

    throw new Error(`WFS ${response.status}: ${exception}`);
  }

  cache[key] = text;
  await writeJson(CACHE, cache);
  await sleep(250);

  return text;
}

function classify(water, osm, officialCandidates) {
  if (!officialCandidates.length) {
    return {
      status: "review",
      reason:
        "OSM-Kandidat vorhanden, aber im amtlichen Prüfbereich kein passendes HY-P-Objekt gefunden.",
    };
  }

  officialCandidates.sort((a, b) => a.distanceM - b.distanceM);

  const best = officialCandidates[0];
  const second = officialCandidates[1];

  const nameScore = best.name
    ? nameSimilarity(water.name, best.name)
    : 0;

  const gapM =
    second?.distanceM != null
      ? second.distanceM - best.distanceM
      : 9999;

  // Sehr starke räumliche Bestätigung.
  if (
    best.distanceM <= 35 &&
    (nameScore >= 0.65 || gapM >= 75 || officialCandidates.length === 1)
  ) {
    return {
      status: "matched",
      best,
      nameScore,
      gapM,
      reason:
        "OSM-Kandidat durch amtliche HY-P-Geometrie räumlich bestätigt.",
    };
  }

  // Noch brauchbarer Gegencheck.
  if (
    best.distanceM <= 120 &&
    (nameScore >= 0.45 || gapM >= 40)
  ) {
    return {
      status: "review",
      best,
      nameScore,
      gapM,
      reason:
        "Amtliche HY-P-Geometrie liegt nahe am OSM-Kandidaten, aber nicht eindeutig genug für automatische Freigabe.",
    };
  }

  return {
    status: "review",
    best,
    nameScore,
    gapM,
    reason:
      "Amtliches Wasserobjekt vorhanden, Abstand/Name aber nicht eindeutig genug.",
  };
}

function renderTs(index) {
  return `// AUTO-GENERATED by scripts/verify-two-source-v6-2.mjs
// Zweiquellen-Abgleich: OSM-v3 + amtlicher INSPIRE HY-P WFS Sachsen-Anhalt.

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

const catalogText = await fs.readFile(CATALOG, "utf8");
const v3Text = await fs.readFile(V3, "utf8");

const catalog = extractAssignedJson(
  catalogText,
  "export const lavCatalog"
);

const v3 = extractAssignedJson(
  v3Text,
  "export const localWaterMatchIndex"
);

const cache = await readJson(CACHE, {});
const work = catalog.slice(start, start + limit);

const records = {};

const reviewRows = [[
  "id",
  "lavNumber",
  "name",
  "type",
  "status",
  "latitude",
  "longitude",
  "osmConfidence",
  "officialDistanceM",
  "officialName",
  "officialFeatureId",
  "officialType",
  "officialCandidateCount",
  "nameScore",
  "distanceGapM",
  "reason",
]];

console.log("");
console.log("HarzFishing – Zwei-Quellen-Matcher v6.2");
console.log("---------------------------------------");
console.log(`Bearbeitung: ${start}–${start + work.length - 1}`);
console.log(`Amtliche BBOX: ±${bboxRadiusM} m`);
console.log("");

for (let i = 0; i < work.length; i++) {
  const water = work[i];
  const osm = v3[water.id];

  if (
    !osm ||
    osm.latitude == null ||
    osm.longitude == null
  ) {
    records[water.id] = {
      status: "unmatched",
      reason: "Kein OSM-v3-Kandidat vorhanden.",
    };

    console.log(
      `${i + 1}/${work.length} ${water.lavNumber ?? ""} ${water.name} -> unmatched`
    );

    continue;
  }

  const pointUtm = wgs84ToUtm32(
    Number(osm.latitude),
    Number(osm.longitude)
  );

  const typeName =
    water.type === "Fließgewässer"
      ? "hy-p:Watercourse"
      : "hy-p:StandingWater";

  const localType =
    water.type === "Fließgewässer"
      ? "Watercourse"
      : "StandingWater";

  let officialCandidates = [];

  try {
    const xml = await fetchWfs(typeName, pointUtm, cache);
    const blocks = extractFeatureBlocks(xml, localType);

    officialCandidates = blocks
      .map((block) => {
        const coords = geometryPointsFromFeatureXml(block);

        if (!coords.length) return null;

        return {
          id: featureId(block),
          name: featureName(block),
          distanceM: minDistanceToGeometry(
            { x: pointUtm.easting, y: pointUtm.northing },
            coords
          ),
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.warn(
      `${i + 1}/${work.length} WFS-Fehler ${water.lavNumber ?? ""}: ${error.message}`
    );

    records[water.id] = {
      status: "review",
      latitude: osm.latitude,
      longitude: osm.longitude,
      osmConfidence: osm.confidence,
      reason: `Amtliche WFS-Abfrage fehlgeschlagen: ${error.message}`,
    };

    continue;
  }

  const decision = classify(
    water,
    osm,
    officialCandidates
  );

  const record = {
    status: decision.status,
    latitude: osm.latitude,
    longitude: osm.longitude,
    osmConfidence: osm.confidence,
    ...(decision.best
      ? {
          officialDistanceM: Number(
            decision.best.distanceM.toFixed(1)
          ),
          officialName:
            decision.best.name || undefined,
          officialFeatureId:
            decision.best.id || undefined,
          officialType: localType,
          officialCandidateCount:
            officialCandidates.length,
          nameScore:
            decision.nameScore != null
              ? Number(decision.nameScore.toFixed(3))
              : undefined,
          distanceGapM:
            decision.gapM != null
              ? Number(decision.gapM.toFixed(1))
              : undefined,
        }
      : {
          officialCandidateCount:
            officialCandidates.length,
        }),
    reason: decision.reason,
  };

  records[water.id] = record;

  console.log(
    `${i + 1}/${work.length} ${water.lavNumber ?? ""} ${water.name}` +
      ` -> ${record.status}` +
      (record.officialDistanceM != null
        ? ` [amtlich ${record.officialDistanceM} m]`
        : "") +
      (record.officialName
        ? ` [${record.officialName}]`
        : "")
  );

  if (record.status !== "matched") {
    reviewRows.push([
      water.id,
      water.lavNumber,
      water.name,
      water.type,
      record.status,
      record.latitude,
      record.longitude,
      record.osmConfidence,
      record.officialDistanceM,
      record.officialName,
      record.officialFeatureId,
      record.officialType,
      record.officialCandidateCount,
      record.nameScore,
      record.distanceGapM,
      record.reason,
    ]);
  }

  await fs.writeFile(
    OUTPUT,
    renderTs(records),
    "utf8"
  );
}

await fs.writeFile(
  REVIEW,
  reviewRows
    .map((row) => row.map(csv).join(";"))
    .join("\n") + "\n",
  "utf8"
);

const stats = Object.values(records).reduce(
  (acc, record) => {
    acc[record.status] =
      (acc[record.status] || 0) + 1;
    return acc;
  },
  {}
);

console.log("");
console.log("Ergebnis:", stats);
console.log(
  `Generated: ${path.relative(ROOT, OUTPUT)}`
);
console.log(
  `Review:    ${path.relative(ROOT, REVIEW)}`
);
console.log(
  `Cache:     ${path.relative(ROOT, CACHE)}`
);
