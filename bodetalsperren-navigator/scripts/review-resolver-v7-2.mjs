#!/usr/bin/env node
/**
 * HarzFishing – Review Resolver v7.2
 *
 * Ziel:
 * - nur konfliktfreie, stehende Gewässer aus v7.1.1 neu bewerten
 * - räumliche Eindeutigkeit darf fehlenden amtlichen Namen ersetzen
 * - Fließgewässer bleiben unangetastet im Review
 * - Mehrfachkonflikte bleiben unangetastet
 *
 * Input:
 *   data/review-v7-1-1-result.csv
 *   data/two-source-water-v6-2.generated.ts
 *
 * Output:
 *   data/two-source-water-v6-2.generated.ts
 *   data/review-v7-2-result.csv
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const INPUT = path.join(DATA, "review-v7-1-1-result.csv");
const GENERATED = path.join(DATA, "two-source-water-v6-2.generated.ts");
const REPORT = path.join(DATA, "review-v7-2-result.csv");

function parseCsvLine(line) {
  const out=[]; let value=""; let quoted=false;
  for (let i=0;i<line.length;i++) {
    const ch=line[i];
    if (ch === '"') {
      if (quoted && line[i+1] === '"') { value+='"'; i++; }
      else quoted=!quoted;
    } else if (ch === ";" && !quoted) { out.push(value); value=""; }
    else value+=ch;
  }
  out.push(value);
  return out;
}

function parseCsv(text) {
  const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header=parseCsvLine(lines[0]);
  return lines.slice(1).map(line=>{
    const values=parseCsvLine(line);
    return Object.fromEntries(header.map((key,i)=>[key,values[i]??""]));
  });
}

function n(value) {
  if (value == null || value === "") return null;
  const x=Number(String(value).replace(",","."));
  return Number.isFinite(x) ? x : null;
}

function extractAssignedJson(text, marker) {
  const pos=text.indexOf(marker);
  if (pos<0) throw new Error(`Marker nicht gefunden: ${marker}`);
  const eq=text.indexOf("=",pos);
  const arr=text.indexOf("[",eq);
  const obj=text.indexOf("{",eq);
  const begin=arr>=0 && (obj<0 || arr<obj) ? arr : obj;
  const open=text[begin], close=open==="["?"]":"}";
  let depth=0, quote=null, escaped=false;
  for (let i=begin;i<text.length;i++) {
    const ch=text[i];
    if (quote) {
      if (escaped) { escaped=false; continue; }
      if (ch==="\\") { escaped=true; continue; }
      if (ch===quote) quote=null;
      continue;
    }
    if (ch==='"' || ch==="'" || ch==="`") { quote=ch; continue; }
    if (ch===open) depth++;
    if (ch===close) depth--;
    if (depth===0) return JSON.parse(text.slice(begin,i+1));
  }
  throw new Error("Unvollständiges Literal");
}

function render(index) {
  return `// AUTO-GENERATED / updated by scripts/review-resolver-v7-2.mjs
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
export const twoSourceWaterV62Index: Record<string, TwoSourceWaterV62Match> = ${JSON.stringify(index,null,2)};
`;
}

const csv=v=>`"${String(v??"").replaceAll('"','""')}"`;

const rows=parseCsv(await fs.readFile(INPUT,"utf8"));
const generatedText=await fs.readFile(GENERATED,"utf8");
const index=extractAssignedJson(generatedText,"export const twoSourceWaterV62Index");

const stats={
  reviewed:0,
  eligibleStanding:0,
  promoted:0,
  keptReview:0,
  skippedFlow:0,
  skippedConflict:0,
  skippedNoFeature:0
};

const report=[[
  "id","lavNumber","name","type","result","tier",
  "officialFeatureId","officialDistanceM",
  "officialCandidateCount","distanceGapM","featureUseCount","reason"
]];

for (const row of rows) {
  const cur=index[row.id];
  if (!cur || cur.status!=="review") continue;

  stats.reviewed++;

  const useCount=n(row.featureUseCount) ?? 0;
  const fid=String(cur.officialFeatureId ?? row.officialFeatureId ?? "").trim();
  const dist=n(cur.officialDistanceM ?? row.officialDistanceM);
  const count=n(cur.officialCandidateCount ?? row.officialCandidateCount);
  const gap=n(cur.distanceGapM ?? row.distanceGapM);
  const isFlow=String(row.type||"").toLocaleLowerCase("de-DE").includes("fließ");

  let promote=false;
  let tier="";
  let reason="";

  if (!fid || dist==null) {
    stats.skippedNoFeature++;
    tier="v72-no-feature";
    reason="Kein amtliches Feature bzw. keine belastbare Distanz; bleibt Review.";
  } else if (useCount>1) {
    stats.skippedConflict++;
    tier="v72-conflict";
    reason=`Amtliches Feature wird von ${useCount} LAV-Einträgen beansprucht; bleibt Review.`;
  } else if (isFlow) {
    stats.skippedFlow++;
    tier="v72-flow";
    reason="Fließgewässer werden in v7.2 nicht automatisch hochgestuft.";
  } else {
    stats.eligibleStanding++;

    // Räumliche Eindeutigkeit ersetzt hier bewusst das fehlende Namenssignal.
    if (
      dist <= 20 &&
      (count === 1 || (gap != null && gap >= 40))
    ) {
      promote=true;
      tier="v72-standing-near";
      reason="Konfliktfreies stehendes Gewässer: höchstens 20 m entfernt und räumlich ausreichend eindeutig.";
    } else if (
      dist <= 40 &&
      count === 1
    ) {
      promote=true;
      tier="v72-standing-single";
      reason="Konfliktfreies stehendes Gewässer: einziger amtlicher Kandidat im Suchbereich und höchstens 40 m entfernt.";
    } else if (
      dist <= 50 &&
      gap != null &&
      gap >= 100
    ) {
      promote=true;
      tier="v72-standing-gap";
      reason="Konfliktfreies stehendes Gewässer: höchstens 50 m entfernt und mindestens 100 m Vorsprung vor dem nächsten amtlichen Kandidaten.";
    } else {
      tier="v72-standing-review";
      reason="Konfliktfrei, aber Distanz/Kandidatenzahl/Abstand reichen noch nicht für automatische Freigabe.";
    }
  }

  cur.reviewTier=tier;
  cur.reason=reason;

  if (promote) {
    cur.status="matched";
    stats.promoted++;
  } else {
    stats.keptReview++;
  }

  report.push([
    row.id,row.lavNumber,row.name,row.type,cur.status,tier,
    fid,dist,count,gap,useCount,reason
  ]);
}

await fs.writeFile(GENERATED,render(index),"utf8");
await fs.writeFile(
  REPORT,
  report.map(row=>row.map(csv).join(";")).join("\n")+"\n",
  "utf8"
);

const cumulative=Object.values(index).reduce((acc,record)=>{
  acc[record.status]=(acc[record.status]||0)+1;
  return acc;
},{});

console.log("");
console.log("HarzFishing – Review Resolver v7.2");
console.log("---------------------------------");
console.log("v7.2-Ergebnis:",stats);
console.log("Zwei-Quellen kumuliert:",cumulative);
console.log(`Generated aktualisiert: ${path.relative(ROOT,GENERATED)}`);
console.log(`Bericht:                ${path.relative(ROOT,REPORT)}`);
