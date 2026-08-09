#!/usr/bin/env node
/**
 * HarzFishing – Final Data / App Audit
 *
 * Prüft den eingefrorenen Datenstand vor weiteren UI-Arbeiten.
 * Verändert KEINE Datei.
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const FILES = {
  production: path.join(ROOT, "data", "water-centers.production.generated.ts"),
  waters: path.join(ROOT, "data", "waters.ts"),
  navigator: path.join(ROOT, "components", "FishingNavigator.tsx"),
};

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

const ok = (label, detail = "") =>
  console.log(`OK   ${label}${detail ? ` – ${detail}` : ""}`);

const warn = (label, detail = "") =>
  console.log(`WARN ${label}${detail ? ` – ${detail}` : ""}`);

const fail = (label, detail = "") =>
  console.log(`FEHL ${label}${detail ? ` – ${detail}` : ""}`);

let errors = 0;

console.log("");
console.log("HarzFishing – Final Data / App Audit");
console.log("------------------------------------");

let productionText;
let watersText;
let navigatorText;

try {
  productionText = await fs.readFile(FILES.production, "utf8");
  ok("Production-Datei vorhanden");
} catch (e) {
  fail("Production-Datei fehlt", e.message);
  errors++;
}

try {
  watersText = await fs.readFile(FILES.waters, "utf8");
  ok("waters.ts vorhanden");
} catch (e) {
  fail("waters.ts fehlt", e.message);
  errors++;
}

try {
  navigatorText = await fs.readFile(FILES.navigator, "utf8");
  ok("FishingNavigator.tsx vorhanden");
} catch (e) {
  fail("FishingNavigator.tsx fehlt", e.message);
  errors++;
}

if (productionText) {
  try {
    const index = extractAssignedJson(
      productionText,
      "export const productionWaterCenterIndex"
    );

    const values = Object.values(index);
    const counts = values.reduce(
      (a, r) => {
        a[r.status] = (a[r.status] || 0) + 1;
        return a;
      },
      {}
    );

    const sourceCounts = values
      .filter((r) => r.status === "mapped")
      .reduce((a, r) => {
        a[r.source] = (a[r.source] || 0) + 1;
        return a;
      }, {});

    console.log("");
    console.log("Production:");
    console.log(`  Gesamt:      ${values.length}`);
    console.log(`  Kartiert:    ${counts.mapped || 0}`);
    console.log(`  Review:      ${counts.review || 0}`);
    console.log(`  Ohne Lage:   ${counts.unmapped || 0}`);
    console.log("  Quellen:    ", sourceCounts);

    if (values.length === 1138) ok("LAV-Gesamtzahl", "1138");
    else {
      fail("LAV-Gesamtzahl", `${values.length} statt 1138`);
      errors++;
    }

    if ((counts.mapped || 0) === 283) ok("Eingefrorener Kartierungsstand", "283");
    else
      warn(
        "Kartierungsstand weicht vom letzten Merge ab",
        `${counts.mapped || 0} statt 283`
      );

    const invalidMapped = Object.entries(index).filter(
      ([, r]) =>
        r.status === "mapped" &&
        (!Number.isFinite(r.latitude) ||
          !Number.isFinite(r.longitude) ||
          r.latitude < 50 ||
          r.latitude > 54 ||
          r.longitude < 8 ||
          r.longitude > 14)
    );

    if (!invalidMapped.length) ok("Koordinaten-Plausibilität");
    else {
      fail("Unplausible kartierte Koordinaten", `${invalidMapped.length}`);
      errors++;
    }
  } catch (e) {
    fail("Production-Datei nicht auswertbar", e.message);
    errors++;
  }
}

if (watersText) {
  if (
    watersText.includes(
      'import { productionWaterCenterIndex } from "./water-centers.production.generated"'
    )
  ) {
    ok("waters.ts nutzt Production-Index");
  } else {
    fail("waters.ts nutzt Production-Index nicht");
    errors++;
  }

  if (
    watersText.includes('production?.status === "mapped"') ||
    watersText.includes("production.status === \"mapped\"")
  ) {
    ok("waters.ts veröffentlicht nur Production-Matches");
  } else {
    warn("Production-Statusprüfung in waters.ts nicht eindeutig gefunden");
  }
}

if (navigatorText) {
  const allDefault =
    /useState<\s*"all"\s*\|\s*"harz"\s*>\s*\(\s*"all"\s*\)/m.test(
      navigatorText
    );

  if (allDefault) {
    ok("Atlas startet ohne versteckten Harz-Filter");
  } else {
    warn("regionFilter startet möglicherweise nicht auf all");
  }

  if (
    navigatorText.includes("water.latitude !== null") &&
    navigatorText.includes("water.longitude !== null")
  ) {
    ok("Atlas zählt kartierte Gewässer anhand echter Koordinaten");
  } else {
    warn("Atlas-Kartierungszählung nicht eindeutig gefunden");
  }
}

console.log("");
if (errors === 0) {
  console.log("ERGEBNIS: Datenintegration sieht konsistent aus.");
  console.log("Nächster Schritt: npm run build");
} else {
  console.log(`ERGEBNIS: ${errors} Fehler gefunden – vor dem Build korrigieren.`);
  process.exitCode = 1;
}
