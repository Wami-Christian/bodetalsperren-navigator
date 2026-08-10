#!/usr/bin/env node
/**
 * HarzFishing – v11.2 Review Resolver
 *
 * Bearbeitet ausschließlich die von v11.1 erzeugten Reviews.
 *
 * Ziel:
 * - Mehrfachbelegungen desselben amtlichen Features erkennen
 * - konfliktfreie Kandidaten nach Distanz, Namenssignal und Gap neu bewerten
 * - pro amtlichem Feature höchstens einen Gewinner zulassen
 * - bestehende matched / unmatched nicht herabstufen
 *
 * Input:
 *   data/unmatched-v11-1-result.csv
 *   data/two-source-water-v6-2.generated.ts
 *
 * Output:
 *   data/two-source-water-v6-2.generated.ts
 *   data/unmatched-v11-2-result.csv
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");

const INPUT = path.join(DATA, "unmatched-v11-1-result.csv");
const GENERATED = path.join(DATA, "two-source-water-v6-2.generated.ts");
const REPORT = path.join(DATA, "unmatched-v11-2-result.csv");

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

function normalize(value = "") {
  return String(value)
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[’'`´„“”]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function coreName(value = "") {
  return normalize(value)
    .replace(
      /\b(teich|teiche|see|seen|weiher|kuhle|kiesgrube|grube|graben|bach|fluss|kanal|altarm|wasser|speicher|wasserspeicher|stausee|talsperre|bracke|kolk)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((x) => x.length > 2)
  );
}

function nameSimilarity(a, b) {
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

  const AA = tokenSet(CA || A);
  const BB = tokenSet(CB || B);

  let common = 0;
  for (const x of AA) {
    if (BB.has(x)) common++;
  }

  if (!AA.size || !BB.size) return 0;

  return common / (AA.size + BB.size - common);
}

function extractAssignedJson(text, marker) {
  const pos = text.indexOf(marker);
  if (pos < 0) throw new Error(`Marker nicht gefunden: ${marker}`);

  const eq = text.indexOf("=", pos);
  const arr = text.indexOf("[", eq);
  const obj = text.indexOf("{", eq);

  const begin =
    arr >= 0 && (obj < 0 || arr < obj)
      ? arr
      : obj;

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

  throw new Error("Unvollständiges Literal");
}

function renderGenerated(index) {
  return `// AUTO-GENERATED / updated by scripts/review-resolver-v11-2.mjs
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

const csv = (value) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

const rows = parseCsv(
  await fs.readFile(INPUT, "utf8")
);

const generatedText =
  await fs.readFile(GENERATED, "utf8");

const index = extractAssignedJson(
  generatedText,
  "export const twoSourceWaterV62Index"
);

// Nur v11.1-Reviews, die weiterhin Review sind.
const targets = rows.filter((row) => {
  const current = index[row.id];

  return (
    row.result === "review" &&
    current?.status === "review" &&
    current?.reviewTier === "v11-anchor-review"
  );
});

// Feature-Gruppen für Konflikterkennung.
const groups = new Map();

for (const row of targets) {
  const current = index[row.id];
  const featureId = String(
    current?.officialFeatureId || ""
  ).trim();

  if (!featureId) continue;

  if (!groups.has(featureId)) {
    groups.set(featureId, []);
  }

  groups.get(featureId).push(row);
}

const stats = {
  targets: targets.length,
  promoted: 0,
  keptReview: 0,
  duplicateGroups: 0,
  duplicateRows: 0,
  uniqueFeatures: 0,
  noFeatureId: 0,
  flowReviews: 0,
};

for (const [, group] of groups) {
  if (group.length > 1) {
    stats.duplicateGroups++;
    stats.duplicateRows += group.length;
  } else {
    stats.uniqueFeatures++;
  }
}

const report = [[
  "officialFeatureId",
  "id",
  "lavNumber",
  "name",
  "type",
  "result",
  "tier",
  "distanceM",
  "nameScore",
  "candidateCount",
  "gapM",
  "featureUseCount",
  "groupMargin",
  "reason",
]];

for (const [featureId, group] of groups) {
  const scored = group
    .map((row) => {
      const current = index[row.id];

      const distance =
        numberOrNull(
          current.officialDistanceM ??
          row.distanceM
        ) ?? 9999;

      const candidateCount =
        numberOrNull(
          current.officialCandidateCount ??
          row.candidateCount
        );

      const gap =
        numberOrNull(
          current.distanceGapM ??
          row.gapM
        );

      const officialName = String(
        current.officialName ??
        row.officialName ??
        ""
      );

      const nameScore = Math.max(
        numberOrNull(
          current.nameScore ??
          row.nameScore
        ) ?? 0,
        nameSimilarity(
          row.name,
          officialName
        )
      );

      const isFlow = String(row.type || "")
        .toLocaleLowerCase("de-DE")
        .includes("fließ");

      // Abstand ist Hauptsignal.
      // Amtlicher Name ist nur Bonus, kein Muss.
      const distanceScore =
        Math.max(
          0,
          1 - Math.min(distance, 300) / 300
        );

      const uniquenessBonus =
        candidateCount === 1
          ? 0.12
          : gap != null && gap >= 150
            ? 0.10
            : gap != null && gap >= 80
              ? 0.06
              : 0;

      const score =
        distanceScore * 0.70 +
        nameScore * 0.20 +
        uniquenessBonus;

      return {
        row,
        current,
        distance,
        candidateCount,
        gap,
        nameScore,
        officialName,
        isFlow,
        score,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.distance - b.distance
    );

  const best = scored[0];
  const second = scored[1];

  const groupMargin =
    second
      ? best.score - second.score
      : 1;

  const distanceLead =
    second
      ? second.distance - best.distance
      : 9999;

  let groupWinner = null;

  if (best) {
    if (best.isFlow) {
      // Fließgewässer weiterhin sehr streng.
      const strong =
        best.distance <= 20 &&
        best.nameScore >= 0.78 &&
        (best.candidateCount === 1 ||
          (best.gap != null &&
            best.gap >= 120));

      const clearAgainstGroup =
        group.length === 1 ||
        (
          groupMargin >= 0.12 &&
          distanceLead >= 40
        );

      if (strong && clearAgainstGroup) {
        groupWinner = best;
      }
    } else {
      const spatialStrong =
        (
          best.distance <= 15 &&
          (
            best.candidateCount === 1 ||
            (best.gap != null &&
              best.gap >= 120)
          )
        ) ||
        (
          best.distance <= 30 &&
          best.nameScore >= 0.68 &&
          (
            best.candidateCount === 1 ||
            (best.gap != null &&
              best.gap >= 100)
          )
        ) ||
        (
          best.distance <= 45 &&
          best.nameScore >= 0.82 &&
          best.gap != null &&
          best.gap >= 120
        );

      const clearAgainstGroup =
        group.length === 1 ||
        (
          groupMargin >= 0.10 &&
          distanceLead >= 30
        );

      if (
        spatialStrong &&
        clearAgainstGroup
      ) {
        groupWinner = best;
      }
    }
  }

  for (const item of scored) {
    const isWinner =
      groupWinner &&
      item.row.id ===
        groupWinner.row.id;

    if (isWinner) {
      item.current.status = "matched";
      item.current.reviewTier =
        "v112-confirmed";
      item.current.reason =
        `v11.2 bestätigt: amtliches Feature konfliktfrei bzw. klarer Gruppengewinner; ` +
        `Abstand ${item.distance.toFixed(1)} m, Score ${item.score.toFixed(3)}.`;

      stats.promoted++;
    } else {
      item.current.reviewTier =
        group.length > 1
          ? "v112-conflict-review"
          : item.isFlow
            ? "v112-flow-review"
            : "v112-review";

      item.current.reason =
        group.length > 1
          ? `Amtliches Feature wird von ${group.length} v11-Kandidaten beansprucht; kein ausreichend klarer Gewinner.`
          : item.isFlow
            ? "Fließgewässer erfüllt die strengen v11.2-Kriterien nicht."
            : "Kandidat bleibt nach Distanz-/Gap-/Namensprüfung im Review.";

      if (item.isFlow) {
        stats.flowReviews++;
      }

      stats.keptReview++;
    }

    report.push([
      featureId,
      item.row.id,
      item.row.lavNumber,
      item.row.name,
      item.row.type,
      item.current.status,
      item.current.reviewTier,
      item.distance.toFixed(1),
      item.nameScore.toFixed(3),
      item.candidateCount ?? "",
      item.gap != null
        ? item.gap.toFixed(1)
        : "",
      group.length,
      groupMargin.toFixed(3),
      item.current.reason,
    ]);
  }
}

// Fälle ohne Feature-ID getrennt dokumentieren.
for (const row of targets) {
  const current = index[row.id];
  const featureId = String(
    current?.officialFeatureId || ""
  ).trim();

  if (featureId) continue;

  stats.noFeatureId++;
  stats.keptReview++;

  current.reviewTier =
    "v112-no-feature";
  current.reason =
    "v11.2: kein amtliches Feature referenzierbar; bleibt Review.";

  report.push([
    "",
    row.id,
    row.lavNumber,
    row.name,
    row.type,
    current.status,
    current.reviewTier,
    current.officialDistanceM ?? row.distanceM ?? "",
    current.nameScore ?? row.nameScore ?? "",
    current.officialCandidateCount ?? row.candidateCount ?? "",
    current.distanceGapM ?? row.gapM ?? "",
    0,
    "",
    current.reason,
  ]);
}

await fs.writeFile(
  GENERATED,
  renderGenerated(index),
  "utf8"
);

await fs.writeFile(
  REPORT,
  report
    .map((row) =>
      row.map(csv).join(";")
    )
    .join("\n") + "\n",
  "utf8"
);

const cumulative =
  Object.values(index).reduce(
    (acc, record) => {
      acc[record.status] =
        (acc[record.status] || 0) + 1;

      return acc;
    },
    {}
  );

console.log("");
console.log(
  "HarzFishing – Review Resolver v11.2"
);
console.log(
  "-----------------------------------"
);
console.log(
  "v11.2-Ergebnis:",
  stats
);
console.log(
  "Zwei-Quellen kumuliert:",
  cumulative
);
console.log(
  `Generated aktualisiert: ${path.relative(
    ROOT,
    GENERATED
  )}`
);
console.log(
  `Bericht:                ${path.relative(
    ROOT,
    REPORT
  )}`
);
