#!/usr/bin/env node
/**
 * HarzFishing – Review Resolver v7.1
 *
 * Zweck:
 * - wertet data/review-v7-result.csv aus
 * - erkennt Mehrfachbelegungen desselben amtlichen Features
 * - stuft nur räumlich + strukturell eindeutige Reviews automatisch hoch
 * - bestehende matched/unmatched Datensätze werden nicht herabgestuft
 *
 * Input:
 *   data/review-v7-result.csv
 *   data/two-source-water-v6-2.generated.ts
 *
 * Output:
 *   data/two-source-water-v6-2.generated.ts   (kumulativ aktualisiert)
 *   data/review-v7-1-result.csv
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const INPUT = path.join(DATA, "review-v7-result.csv");
const GENERATED = path.join(DATA, "two-source-water-v6-2.generated.ts");
const REPORT = path.join(DATA, "review-v7-1-result.csv");

function parseCsvLine(line) {
  const out = []; let value = ""; let quoted = false;
  for (let i=0;i<line.length;i++) {
    const ch=line[i];
    if (ch === '"') {
      if (quoted && line[i+1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ";" && !quoted) { out.push(value); value=""; }
    else value += ch;
  }
  out.push(value); return out;
}
function parseCsv(text) {
  const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const h=parseCsvLine(lines[0]);
  return lines.slice(1).map(line=>{
    const v=parseCsvLine(line);
    return Object.fromEntries(h.map((k,i)=>[k,v[i]??""]));
  });
}
function n(v) {
  if (v == null || v === "") return null;
  const x=Number(String(v).replace(",","."));
  return Number.isFinite(x)?x:null;
}
function norm(s="") {
  return String(s).toLocaleLowerCase("de-DE").normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").replace(/ß/g,"ss")
    .replace(/[’'`´„“”]/g,"").replace(/[^a-z0-9]+/g," ")
    .replace(/\s+/g," ").trim();
}
function tokens(s="") {
  return new Set(norm(s).split(" ").filter(x=>x.length>2));
}
function nameSim(a,b) {
  const A=norm(a), B=norm(b);
  if (!A || !B) return 0;
  if (A===B) return 1;
  if (A.includes(B)||B.includes(A)) return Math.min(A.length,B.length)/Math.max(A.length,B.length);
  const aa=tokens(A), bb=tokens(B);
  let c=0; for (const x of aa) if (bb.has(x)) c++;
  return aa.size&&bb.size ? c/(aa.size+bb.size-c) : 0;
}
function extractAssignedJson(text, marker) {
  const pos=text.indexOf(marker); if(pos<0) throw new Error(`Marker nicht gefunden: ${marker}`);
  const eq=text.indexOf("=",pos), arr=text.indexOf("[",eq), obj=text.indexOf("{",eq);
  const begin=arr>=0&&(obj<0||arr<obj)?arr:obj, open=text[begin], close=open==="["?"]":"}";
  let depth=0, quote=null, escaped=false;
  for(let i=begin;i<text.length;i++){
    const ch=text[i];
    if(quote){
      if(escaped){escaped=false;continue;}
      if(ch==="\\"){escaped=true;continue;}
      if(ch===quote) quote=null;
      continue;
    }
    if(ch==='"'||ch==="'"||ch==="`"){quote=ch;continue;}
    if(ch===open) depth++; if(ch===close) depth--;
    if(depth===0) return JSON.parse(text.slice(begin,i+1));
  }
  throw new Error("Unvollständiges Literal");
}
function render(index) {
  return `// AUTO-GENERATED / updated by scripts/review-resolver-v7-1.mjs
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

// Nur weiterhin offene Reviews.
const open=rows.filter(r=>r.result==="review" && index[r.id]?.status==="review");

// Cluster-Key: bevorzugt amtliche Feature-ID.
// Falls WFS kein Feature-ID geliefert hat, KEINE künstliche Zusammenfassung nach Name/Abstand.
const groups=new Map();
for (const r of open) {
  const fid=(r.officialFeatureId||"").trim();
  if (!fid) continue;
  if (!groups.has(fid)) groups.set(fid,[]);
  groups.get(fid).push(r);
}

const stats={
  reviewed: open.length,
  promoted:0,
  keptReview:0,
  duplicateFeatureGroups:0,
  duplicateFeatureRows:0,
  noOfficialFeature:0
};

for (const [,g] of groups) {
  if (g.length>1) {
    stats.duplicateFeatureGroups++;
    stats.duplicateFeatureRows += g.length;
  }
}

const report=[[
  "id","lavNumber","name","type","result","tier",
  "officialFeatureId","officialDistanceM","officialName",
  "officialCandidateCount","nameScore","distanceGapM",
  "featureUseCount","reason"
]];

for (const r of open) {
  const cur=index[r.id];
  const fid=(r.officialFeatureId||"").trim();
  const dist=n(r.officialDistanceM);
  const count=n(r.officialCandidateCount);
  const gap=n(r.distanceGapM);
  const ns=Math.max(n(r.nameScore)??0, nameSim(r.name,r.officialName));
  const isFlow=String(r.type||"").toLocaleLowerCase("de-DE").includes("fließ");
  const featureUseCount=fid ? (groups.get(fid)?.length||1) : 0;

  let promote=false, tier="", reason="";

  if (!fid || dist==null) {
    stats.noOfficialFeature++;
    tier="v71-no-official-feature";
    reason="Kein eindeutig referenzierbares amtliches Feature; bleibt im Review.";
  } else if (featureUseCount > 1) {
    // Kern von v7.1: dasselbe amtliche Feature nicht automatisch mehreren LAV-Einträgen geben.
    // Ausnahme nur bei extrem starkem Namenssignal UND klar bestem Abstand innerhalb der Gruppe.
    const g=groups.get(fid);
    const ranked=[...g].sort((a,b)=>(n(a.officialDistanceM)??1e9)-(n(b.officialDistanceM)??1e9));
    const best=ranked[0], second=ranked[1];
    const bestDist=n(best.officialDistanceM)??1e9;
    const secondDist=n(second?.officialDistanceM)??1e9;
    const isBest=best.id===r.id;
    const separation=secondDist-bestDist;

    if (isBest && ns>=0.88 && dist<=25 && separation>=40) {
      promote=true;
      tier="v71-duplicate-winner";
      reason="Amtliches Feature wird mehrfach beansprucht; dieser Eintrag ist durch sehr starkes Namenssignal und klar besten Abstand eindeutig.";
    } else {
      tier="v71-duplicate-blocked";
      reason=`Amtliches Feature wird von ${featureUseCount} LAV-Einträgen beansprucht; automatische Mehrfachzuordnung blockiert.`;
    }
  } else if (isFlow) {
    if (dist<=30 && ns>=0.78 && (count===1 || (gap!=null && gap>=80))) {
      promote=true;
      tier="v71-flow-strong";
      reason="Eindeutiges amtliches Fließgewässer: nahe Geometrie, starkes Namenssignal und ausreichende räumliche Trennung.";
    } else {
      tier="v71-flow-review";
      reason="Fließgewässer erfüllt die strengen v7.1-Kriterien noch nicht.";
    }
  } else {
    // Ein amtliches Feature wird nur von EINEM offenen LAV-Review beansprucht.
    // Hier können wir gegenüber v7 etwas offensiver sein.
    if (dist<=25 && (count===1 || (gap!=null && gap>=80))) {
      promote=true;
      tier="v71-standing-unique-25";
      reason="Einzig beanspruchtes amtliches Feature, maximal 25 m entfernt und räumlich eindeutig.";
    } else if (dist<=45 && ns>=0.72 && (count===1 || (gap!=null && gap>=100))) {
      promote=true;
      tier="v71-standing-name-45";
      reason="Einzig beanspruchtes amtliches Feature mit naher Geometrie, gutem Namenssignal und räumlicher Eindeutigkeit.";
    } else if (dist<=60 && count===1 && ns>=0.82) {
      promote=true;
      tier="v71-standing-single-name-60";
      reason="Einziger amtlicher Kandidat im Suchbereich mit sehr starkem Namenssignal.";
    } else {
      tier="v71-standing-review";
      reason="Kein Mehrfachkonflikt, aber Distanz/Name/Eindeutigkeit reichen für automatische Freigabe noch nicht.";
    }
  }

  cur.reviewTier=tier;
  cur.reason=reason;
  if (promote) {
    cur.status="matched";
    stats.promoted++;
  } else stats.keptReview++;

  report.push([
    r.id,r.lavNumber,r.name,r.type,cur.status,tier,
    fid,dist,r.officialName,count,ns.toFixed(3),gap,
    featureUseCount,reason
  ]);
}

await fs.writeFile(GENERATED,render(index),"utf8");
await fs.writeFile(REPORT,report.map(row=>row.map(csv).join(";")).join("\n")+"\n","utf8");

const cumulative=Object.values(index).reduce((a,r)=>{
  a[r.status]=(a[r.status]||0)+1; return a;
},{});

console.log("");
console.log("HarzFishing – Review Resolver v7.1");
console.log("---------------------------------");
console.log("v7.1-Ergebnis:",stats);
console.log("Zwei-Quellen kumuliert:",cumulative);
console.log(`Generated aktualisiert: ${path.relative(ROOT,GENERATED)}`);
console.log(`Bericht:                ${path.relative(ROOT,REPORT)}`);
