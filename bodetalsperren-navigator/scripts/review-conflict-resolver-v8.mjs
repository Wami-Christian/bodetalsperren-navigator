#!/usr/bin/env node
/**
 * HarzFishing – Conflict Resolver v8
 *
 * Bearbeitet ausschließlich die v7.2-Mehrfachkonflikte.
 * Ein amtliches Feature darf höchstens EINEN automatischen Gewinner erhalten.
 *
 * Inputs:
 *   data/review-v7-2-result.csv
 *   data/two-source-water-v6-2.generated.ts
 *
 * Outputs:
 *   data/two-source-water-v6-2.generated.ts
 *   data/review-v8-conflicts.csv
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const DATA=path.join(ROOT,"data");
const INPUT=path.join(DATA,"review-v7-2-result.csv");
const GENERATED=path.join(DATA,"two-source-water-v6-2.generated.ts");
const REPORT=path.join(DATA,"review-v8-conflicts.csv");

function parseCsvLine(line){
  const out=[]; let v="",q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){ if(q&&line[i+1]==='"'){v+='"';i++;} else q=!q; }
    else if(c===";"&&!q){out.push(v);v="";} else v+=c;
  }
  out.push(v); return out;
}
function parseCsv(text){
  const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);
  const h=parseCsvLine(lines[0]||"");
  return lines.slice(1).map(l=>{
    const a=parseCsvLine(l);
    return Object.fromEntries(h.map((k,i)=>[k,a[i]??""]));
  });
}
function n(v){ if(v==null||v==="")return null; const x=Number(String(v).replace(",",".")); return Number.isFinite(x)?x:null; }
function norm(s=""){
  return String(s).toLocaleLowerCase("de-DE").normalize("NFD")
   .replace(/[\u0300-\u036f]/g,"").replace(/ß/g,"ss")
   .replace(/[’'`´„“”]/g,"").replace(/[^a-z0-9]+/g," ")
   .replace(/\s+/g," ").trim();
}
function core(s=""){
  return norm(s).replace(/\b(teich|teiche|see|seen|weiher|kuhle|grube|kiesgrube|graben|bach|fluss|kanal|altarm|wasser|speicher|wasserspeicher|stausee|talsperre)\b/g," ")
   .replace(/\s+/g," ").trim();
}
function tokenSet(s){return new Set(norm(s).split(" ").filter(x=>x.length>2));}
function sim(a,b){
  const A=norm(a),B=norm(b),CA=core(a),CB=core(b);
  if(!A||!B)return 0;
  if(A===B)return 1;
  if(CA&&CB&&CA===CB)return .98;
  if(A.includes(B)||B.includes(A))return Math.min(A.length,B.length)/Math.max(A.length,B.length);
  const aa=tokenSet(CA||A),bb=tokenSet(CB||B); let c=0;
  for(const x of aa)if(bb.has(x))c++;
  return aa.size&&bb.size?c/(aa.size+bb.size-c):0;
}
function extractAssignedJson(text,marker){
  const p=text.indexOf(marker); if(p<0)throw new Error(`Marker nicht gefunden: ${marker}`);
  const eq=text.indexOf("=",p),arr=text.indexOf("[",eq),obj=text.indexOf("{",eq);
  const b=arr>=0&&(obj<0||arr<obj)?arr:obj,o=text[b],cl=o==="["?"]":"}";
  let d=0,q=null,e=false;
  for(let i=b;i<text.length;i++){
    const c=text[i];
    if(q){if(e){e=false;continue;}if(c==="\\"){e=true;continue;}if(c===q)q=null;continue;}
    if(c==='"'||c==="'"||c==="`"){q=c;continue;} if(c===o)d++; if(c===cl)d--;
    if(d===0)return JSON.parse(text.slice(b,i+1));
  }
  throw new Error("Unvollständiges Literal");
}
function render(index){
 return `// AUTO-GENERATED / updated by scripts/review-conflict-resolver-v8.mjs
export interface TwoSourceWaterV62Match {
  status: "matched" | "review" | "unmatched";
  latitude?: number; longitude?: number; osmConfidence?: number;
  officialDistanceM?: number; officialName?: string; officialFeatureId?: string;
  officialType?: "StandingWater" | "Watercourse";
  officialCandidateCount?: number; nameScore?: number; distanceGapM?: number;
  reviewTier?: string; reason: string;
}
export const twoSourceWaterV62Index: Record<string, TwoSourceWaterV62Match> = ${JSON.stringify(index,null,2)};
`;
}
const csv=v=>`"${String(v??"").replaceAll('"','""')}"`;

const rows=parseCsv(await fs.readFile(INPUT,"utf8"));
const text=await fs.readFile(GENERATED,"utf8");
const index=extractAssignedJson(text,"export const twoSourceWaterV62Index");

const conflicts=rows.filter(r=>r.tier==="v72-conflict" && index[r.id]?.status==="review");
const groups=new Map();
for(const r of conflicts){
  const fid=String(index[r.id]?.officialFeatureId||r.officialFeatureId||"").trim();
  if(!fid)continue;
  if(!groups.has(fid))groups.set(fid,[]);
  groups.get(fid).push(r);
}

const stats={conflictRows:conflicts.length,groups:groups.size,promoted:0,keptReview:0,noClearWinner:0};
const report=[["officialFeatureId","id","lavNumber","name","type","result","score","distanceM","nameScore","groupSize","winnerMargin","tier","reason"]];

for(const [fid,g] of groups){
  const scored=g.map(r=>{
    const cur=index[r.id];
    const dist=n(cur.officialDistanceM??r.officialDistanceM)??9999;
    const officialName=String(cur.officialName??r.officialName??"");
    const ns=Math.max(n(cur.nameScore??r.nameScore)??0,sim(r.name,officialName));
    const isFlow=String(r.type||"").toLocaleLowerCase("de-DE").includes("fließ");

    // Distanz dominiert; Name ist ein Bonus, aber fehlender amtlicher Name bestraft nicht.
    const distanceScore=Math.max(0,1-Math.min(dist,250)/250);
    const nameBonus=officialName ? ns : 0;
    const score=(distanceScore*0.72)+(nameBonus*0.28);

    return {r,cur,dist,ns,isFlow,officialName,score};
  }).sort((a,b)=>b.score-a.score || a.dist-b.dist);

  const best=scored[0], second=scored[1];
  const margin=second ? best.score-second.score : 1;
  const distLead=second ? second.dist-best.dist : 9999;

  // Nur klarer Gewinner. Fließgewässer weiterhin strenger.
  let winner=false;
  if(best){
    if(best.isFlow){
      winner=best.dist<=25 && best.ns>=0.72 && margin>=0.12 && distLead>=35;
    }else{
      winner=
        (best.dist<=20 && margin>=0.10 && distLead>=25) ||
        (best.dist<=35 && best.ns>=0.70 && margin>=0.10 && distLead>=25) ||
        (best.dist<=50 && best.ns>=0.85 && margin>=0.14 && distLead>=40);
    }
  }

  if(winner){
    best.cur.status="matched";
    best.cur.reviewTier="v8-conflict-winner";
    best.cur.reason=`Klarer Gewinner innerhalb einer ${g.length}er-Mehrfachbelegung: Abstand ${best.dist.toFixed(1)} m, Score-Vorsprung ${margin.toFixed(3)}.`;
    stats.promoted++;
  }else{
    stats.noClearWinner++;
  }

  for(const s of scored){
    const isWinner=winner && s.r.id===best.r.id;
    if(!isWinner){
      s.cur.reviewTier="v8-conflict-review";
      s.cur.reason=`Mehrfachbelegung mit ${g.length} LAV-Einträgen; kein ausreichend klarer automatischer Gewinner für diesen Eintrag.`;
      stats.keptReview++;
    }
    report.push([
      fid,s.r.id,s.r.lavNumber,s.r.name,s.r.type,s.cur.status,
      s.score.toFixed(3),s.dist.toFixed(1),s.ns.toFixed(3),g.length,
      margin.toFixed(3),s.cur.reviewTier,s.cur.reason
    ]);
  }
}

await fs.writeFile(GENERATED,render(index),"utf8");
await fs.writeFile(REPORT,report.map(r=>r.map(csv).join(";")).join("\n")+"\n","utf8");

const cumulative=Object.values(index).reduce((a,r)=>{a[r.status]=(a[r.status]||0)+1;return a;},{});
console.log("");
console.log("HarzFishing – Conflict Resolver v8");
console.log("---------------------------------");
console.log("v8-Ergebnis:",stats);
console.log("Zwei-Quellen kumuliert:",cumulative);
console.log(`Generated aktualisiert: ${path.relative(ROOT,GENERATED)}`);
console.log(`Konfliktbericht:        ${path.relative(ROOT,REPORT)}`);
