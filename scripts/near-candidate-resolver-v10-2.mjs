#!/usr/bin/env node
/**
 * HarzFishing – Near Candidate Resolver v10.2
 *
 * Prüft ausschließlich die von v10.1 erzeugten Reviews.
 * Keine neue Web-/WFS-Abfrage: bewertet die bereits gespeicherten amtlichen
 * Kandidaten konservativ und blockiert Mehrfachbelegungen.
 *
 * Inputs:
 *   data/unmatched-v10-1-result.csv
 *   data/two-source-water-v6-2.generated.ts
 *
 * Outputs:
 *   data/two-source-water-v6-2.generated.ts
 *   data/unmatched-v10-2-result.csv
 */

import fs from "node:fs/promises";
import path from "node:path";
const ROOT=process.cwd(), DATA=path.join(ROOT,"data");
const INPUT=path.join(DATA,"unmatched-v10-1-result.csv");
const GENERATED=path.join(DATA,"two-source-water-v6-2.generated.ts");
const REPORT=path.join(DATA,"unmatched-v10-2-result.csv");

function line(s){const o=[];let v="",q=false;for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(q&&s[i+1]==='"'){v+='"';i++;}else q=!q;}else if(c===";"&&!q){o.push(v);v="";}else v+=c;}o.push(v);return o;}
function parse(t){const l=t.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean),h=line(l[0]||"");return l.slice(1).map(x=>{const a=line(x);return Object.fromEntries(h.map((k,i)=>[k,a[i]??""]));});}
function n(v){if(v==null||v==="")return null;const x=Number(String(v).replace(",","."));return Number.isFinite(x)?x:null;}
function extract(t,m){const p=t.indexOf(m);if(p<0)throw Error(`Marker nicht gefunden: ${m}`);const e=t.indexOf("=",p),a=t.indexOf("[",e),o=t.indexOf("{",e),b=a>=0&&(o<0||a<o)?a:o,op=t[b],cl=op==="["?"]":"}";let d=0,q=null,esc=false;for(let i=b;i<t.length;i++){const c=t[i];if(q){if(esc){esc=false;continue;}if(c==="\\"){esc=true;continue;}if(c===q)q=null;continue;}if(c==='"'||c==="'"||c==="`"){q=c;continue;}if(c===op)d++;if(c===cl)d--;if(!d)return JSON.parse(t.slice(b,i+1));}throw Error("Unvollständiges Literal");}
function render(x){return `// AUTO-GENERATED / updated by scripts/near-candidate-resolver-v10-2.mjs
export interface TwoSourceWaterV62Match {
 status:"matched"|"review"|"unmatched"; latitude?:number; longitude?:number;
 osmConfidence?:number; officialDistanceM?:number; officialName?:string;
 officialFeatureId?:string; officialType?:"StandingWater"|"Watercourse";
 officialCandidateCount?:number; nameScore?:number; distanceGapM?:number;
 reviewTier?:string; reason:string;
}
export const twoSourceWaterV62Index: Record<string, TwoSourceWaterV62Match> = ${JSON.stringify(x,null,2)};
`;}
const csv=v=>`"${String(v??"").replaceAll('"','""')}"`;

const rows=parse(await fs.readFile(INPUT,"utf8"));
const text=await fs.readFile(GENERATED,"utf8");
const index=extract(text,"export const twoSourceWaterV62Index");
const targets=rows.filter(r=>r.result==="review" && index[r.id]?.status==="review" && index[r.id]?.reviewTier==="v10-locality-review");

// Feature-Konflikte über die 94 neuen Reviews erkennen.
const groups=new Map();
for(const r of targets){
 const fid=String(index[r.id]?.officialFeatureId||"").trim();
 if(!fid)continue;
 if(!groups.has(fid))groups.set(fid,[]);
 groups.get(fid).push(r);
}

const stats={targets:targets.length,nearCandidates:0,promoted:0,keptReview:0,duplicateBlocked:0};
const report=[["id","lavNumber","name","type","result","tier","officialFeatureId","distanceM","candidateCount","nameScore","gapM","featureUseCount","reason"]];

for(const r of targets){
 const cur=index[r.id], fid=String(cur.officialFeatureId||"").trim();
 const dist=n(cur.officialDistanceM), count=n(cur.officialCandidateCount), ns=n(cur.nameScore)??0, gap=n(cur.distanceGapM);
 const uses=fid?(groups.get(fid)?.length||1):0;
 const flow=String(r.type||"").toLocaleLowerCase("de-DE").includes("fließ");
 let promote=false,tier="",reason="";
 if(dist!=null&&dist<=50)stats.nearCandidates++;

 if(!fid||dist==null){
   tier="v102-incomplete"; reason="Amtlicher Kandidat unvollständig; bleibt Review.";
 }else if(uses>1){
   stats.duplicateBlocked++; tier="v102-duplicate-blocked";
   reason=`Dasselbe amtliche Feature wird von ${uses} neuen Reviews beansprucht; keine automatische Freigabe.`;
 }else if(flow){
   // Fließgewässer nur mit sehr starker Zusatz-Evidenz.
   if(dist<=15 && ns>=0.75 && (count===1 || (gap!=null&&gap>=100))){
     promote=true;tier="v102-flow-strong";reason="Sehr nahes, konfliktfreies Fließgewässer mit starkem Namenssignal.";
   }else{
     tier="v102-flow-review";reason="Fließgewässer bleibt ohne starkes Namenssignal im Review.";
   }
 }else{
   // Bei Ortsanker-Geocoding ist Nähe allein gefährlich. Deshalb strenger als v7.2.
   if(dist<=20 && count===1 && gap!=null && gap>=120){
     promote=true;tier="v102-standing-single-near";
     reason="Konfliktfreies stehendes Gewässer: <=20 m, einziger Kandidat und >=120 m Vorsprung.";
   }else if(dist<=35 && ns>=0.70 && gap!=null && gap>=100){
     promote=true;tier="v102-standing-name-near";
     reason="Konfliktfreies stehendes Gewässer: nah, starkes Namenssignal und klarer Vorsprung.";
   }else{
     tier="v102-standing-review";
     reason="Nähe allein reicht beim neu erzeugten Ortsanker nicht für automatische Freigabe.";
   }
 }
 cur.reviewTier=tier;cur.reason=reason;
 if(promote){cur.status="matched";stats.promoted++;}else stats.keptReview++;
 report.push([r.id,r.lavNumber,r.name,r.type,cur.status,tier,fid,dist,count,ns,gap,uses,reason]);
}

await fs.writeFile(GENERATED,render(index),"utf8");
await fs.writeFile(REPORT,report.map(r=>r.map(csv).join(";")).join("\n")+"\n","utf8");
const cumulative=Object.values(index).reduce((a,r)=>{a[r.status]=(a[r.status]||0)+1;return a;},{});
console.log("");
console.log("HarzFishing – Near Candidate Resolver v10.2");
console.log("------------------------------------------");
console.log("v10.2-Ergebnis:",stats);
console.log("Zwei-Quellen kumuliert:",cumulative);
console.log(`Generated aktualisiert: ${path.relative(ROOT,GENERATED)}`);
console.log(`Bericht:                ${path.relative(ROOT,REPORT)}`);
