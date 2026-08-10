#!/usr/bin/env node
/**
 * HarzFishing – No-Feature Resolver v9
 *
 * Bearbeitet ausschließlich Review-Fälle, die nach v7.2 kein amtliches
 * HY-P-Feature hatten. Bestehende matched/unmatched werden nicht verändert.
 *
 * Strategie:
 *  1. vorhandenen OSM-Punkt als Suchanker verwenden
 *  2. amtlichen HY-P-WFS mit größerer BBOX prüfen (1200 m)
 *  3. StandingWater und Watercourse passend zum Gewässertyp
 *  4. nur sehr eindeutige Treffer automatisch hochstufen
 *
 * Input:
 *   data/review-v7-2-result.csv
 *   data/two-source-water-v6-2.generated.ts
 *
 * Output:
 *   data/two-source-water-v6-2.generated.ts
 *   data/review-v9-no-feature.csv
 *   data/review-v9-cache.json
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const DATA=path.join(ROOT,"data");
const INPUT=path.join(DATA,"review-v7-2-result.csv");
const GENERATED=path.join(DATA,"two-source-water-v6-2.generated.ts");
const REPORT=path.join(DATA,"review-v9-no-feature.csv");
const CACHE_FILE=path.join(DATA,"review-v9-cache.json");

const WFS="https://geodatenportal.sachsen-anhalt.de/ows_INSPIRE_LVermGeo_ATKIS_HY-P_WFS";
const args=process.argv.slice(2);
const opt=(name,fallback)=>args.find(x=>x.startsWith(`--${name}=`))?.split("=").slice(1).join("=")??fallback;
const bboxM=Math.max(800,Math.min(2500,Number(opt("bbox","1200"))||1200));
const timeoutMs=Math.max(10000,Math.min(60000,Number(opt("timeout","30000"))||30000));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function parseCsvLine(line){const o=[];let v="",q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){v+='"';i++;}else q=!q;}else if(c===";"&&!q){o.push(v);v="";}else v+=c;}o.push(v);return o;}
function parseCsv(text){const l=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);const h=parseCsvLine(l[0]||"");return l.slice(1).map(x=>{const a=parseCsvLine(x);return Object.fromEntries(h.map((k,i)=>[k,a[i]??""]));});}
function n(v){if(v==null||v==="")return null;const x=Number(String(v).replace(",","."));return Number.isFinite(x)?x:null;}
function norm(s=""){return String(s).toLocaleLowerCase("de-DE").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ß/g,"ss").replace(/[’'`´„“”]/g,"").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
function tokens(s){return new Set(norm(s).split(" ").filter(x=>x.length>2));}
function sim(a,b){const A=norm(a),B=norm(b);if(!A||!B)return 0;if(A===B)return 1;if(A.includes(B)||B.includes(A))return Math.min(A.length,B.length)/Math.max(A.length,B.length);const aa=tokens(A),bb=tokens(B);let c=0;for(const x of aa)if(bb.has(x))c++;return aa.size&&bb.size?c/(aa.size+bb.size-c):0;}
function extractAssignedJson(text,marker){const p=text.indexOf(marker);if(p<0)throw new Error(`Marker nicht gefunden: ${marker}`);const eq=text.indexOf("=",p),arr=text.indexOf("[",eq),obj=text.indexOf("{",eq),b=arr>=0&&(obj<0||arr<obj)?arr:obj,o=text[b],cl=o==="["?"]":"}";let d=0,q=null,e=false;for(let i=b;i<text.length;i++){const c=text[i];if(q){if(e){e=false;continue;}if(c==="\\"){e=true;continue;}if(c===q)q=null;continue;}if(c==='"'||c==="'"||c==="`"){q=c;continue;}if(c===o)d++;if(c===cl)d--;if(d===0)return JSON.parse(text.slice(b,i+1));}throw new Error("Unvollständiges Literal");}
function render(index){return `// AUTO-GENERATED / updated by scripts/review-no-feature-resolver-v9.mjs
export interface TwoSourceWaterV62Match {
  status: "matched" | "review" | "unmatched";
  latitude?: number; longitude?: number; osmConfidence?: number;
  officialDistanceM?: number; officialName?: string; officialFeatureId?: string;
  officialType?: "StandingWater" | "Watercourse";
  officialCandidateCount?: number; nameScore?: number; distanceGapM?: number;
  reviewTier?: string; reason: string;
}
export const twoSourceWaterV62Index: Record<string, TwoSourceWaterV62Match> = ${JSON.stringify(index,null,2)};
`;}
function wgs84ToUtm32(latDeg,lonDeg){const a=6378137,f=1/298.257223563,k0=.9996,e2=f*(2-f),ep2=e2/(1-e2),lat=latDeg*Math.PI/180,lon=lonDeg*Math.PI/180,lon0=9*Math.PI/180,N=a/Math.sqrt(1-e2*Math.sin(lat)**2),T=Math.tan(lat)**2,C=ep2*Math.cos(lat)**2,A=Math.cos(lat)*(lon-lon0),M=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*lat-(3*e2/8+3*e2**2/32+45*e2**3/1024)*Math.sin(2*lat)+(15*e2**2/256+45*e2**3/1024)*Math.sin(4*lat)-(35*e2**3/3072)*Math.sin(6*lat));return{x:500000+k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T**2+72*C-58*ep2)*A**5/120),y:k0*(M+N*Math.tan(lat)*(A**2/2+(5-T+9*C+4*C**2)*A**4/24+(61-58*T+T**2+600*C-330*ep2)*A**6/720))};}
function decode(s=""){return String(s).replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&amp;","&").replaceAll("&quot;",'"').replaceAll("&apos;","'");}
function vals(xml,name){const re=new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}>`,"gi");return[...xml.matchAll(re)].map(m=>decode(m[1].replace(/<[^>]+>/g,"").trim())).filter(Boolean);}
function blocks(xml,name){const re=new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?[\\s\\S]*?<\\/(?:[\\w.-]+:)?${name}>`,"gi");return[...xml.matchAll(re)].map(m=>m[0]);}
function pts(block){const out=[];for(const t of vals(block,"posList")){const a=t.trim().split(/\s+/).map(Number).filter(Number.isFinite);for(let i=0;i+1<a.length;i+=2)out.push({x:a[i],y:a[i+1]});}for(const t of vals(block,"pos")){const a=t.trim().split(/\s+/).map(Number).filter(Number.isFinite);if(a.length>=2)out.push({x:a[0],y:a[1]});}return out;}
function fid(block){return block.match(/gml:id="([^"]+)"/i)?.[1]||block.match(/gml:id='([^']+)'/i)?.[1]||"";}
function fname(block){return [...vals(block,"text"),...vals(block,"name"),...vals(block,"geographicalName"),...vals(block,"localName")].find(x=>x.length<=120)||"";}
function seg(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay;if(!dx&&!dy)return Math.hypot(px-ax,py-ay);const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));}
function distance(p,a){if(!a.length)return Infinity;if(a.length===1)return Math.hypot(p.x-a[0].x,p.y-a[0].y);let m=Infinity;for(let i=0;i<a.length-1;i++)m=Math.min(m,seg(p.x,p.y,a[i].x,a[i].y,a[i+1].x,a[i+1].y));return m;}
async function readJson(f,d){try{return JSON.parse(await fs.readFile(f,"utf8"));}catch{return d;}}
async function fetchWfs(type,p,cache){const key=`${type}|${Math.round(p.x)}|${Math.round(p.y)}|${bboxM}`;if(cache[key])return cache[key];const u=new URL(WFS);u.searchParams.set("service","WFS");u.searchParams.set("version","2.0.0");u.searchParams.set("request","GetFeature");u.searchParams.set("typeNames",type);u.searchParams.set("srsName","urn:ogc:def:crs:EPSG::25832");u.searchParams.set("bbox",`${p.x-bboxM},${p.y-bboxM},${p.x+bboxM},${p.y+bboxM},urn:ogc:def:crs:EPSG::25832`);u.searchParams.set("count","100");const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);try{const r=await fetch(u,{headers:{Accept:"application/gml+xml; version=3.2, application/xml, text/xml"},signal:ctl.signal});const text=await r.text();if(!r.ok)throw new Error(`WFS ${r.status}`);cache[key]=text;await fs.writeFile(CACHE_FILE,JSON.stringify(cache,null,2),"utf8");await sleep(150);return text;}finally{clearTimeout(timer);}}
const csv=v=>`"${String(v??"").replaceAll('"','""')}"`;

const rows=parseCsv(await fs.readFile(INPUT,"utf8"));
const generated=await fs.readFile(GENERATED,"utf8");
const index=extractAssignedJson(generated,"export const twoSourceWaterV62Index");
const cache=await readJson(CACHE_FILE,{});

const targets=rows.filter(r=>r.tier==="v72-no-feature" && index[r.id]?.status==="review");
const stats={targets:targets.length,queried:0,promoted:0,keptReview:0,noCandidates:0,errors:0};
const report=[["id","lavNumber","name","type","result","tier","distanceM","officialName","candidateCount","gapM","nameScore","reason"]];

for(let i=0;i<targets.length;i++){
 const r=targets[i],cur=index[r.id];
 const lat=n(cur.latitude),lon=n(cur.longitude);
 let tier="v9-review",reason="",best=null,count=0,gap=null,ns=0;
 if(lat==null||lon==null){reason="Kein nutzbarer Suchanker vorhanden.";stats.keptReview++;}
 else{
  try{
   stats.queried++;
   const p=wgs84ToUtm32(lat,lon);
   const isFlow=String(r.type||"").toLocaleLowerCase("de-DE").includes("fließ");
   const local=isFlow?"Watercourse":"StandingWater";
   const xml=await fetchWfs(`hy-p:${local}`,p,cache);
   const cand=blocks(xml,local).map(b=>{const a=pts(b);return a.length?{id:fid(b),name:fname(b),distanceM:distance(p,a)}:null;}).filter(Boolean).sort((a,b)=>a.distanceM-b.distanceM);
   count=cand.length;
   if(!count){stats.noCandidates++;reason=`Auch in ±${bboxM} m kein amtliches ${local}-Feature.`;stats.keptReview++;}
   else{
    best=cand[0];gap=cand[1]?cand[1].distanceM-best.distanceM:9999;ns=best.name?sim(r.name,best.name):0;
    let promote=false;
    if(isFlow){
      promote=best.distanceM<=20 && ns>=.75 && gap>=60;
      tier=promote?"v9-flow-strong":"v9-flow-review";
    }else{
      promote=
        (best.distanceM<=20 && (count===1||gap>=80)) ||
        (best.distanceM<=35 && ns>=.75 && gap>=80);
      tier=promote?"v9-standing-unique":"v9-standing-review";
    }
    if(promote){
      cur.status="matched";cur.officialFeatureId=best.id||undefined;cur.officialName=best.name||undefined;cur.officialDistanceM=Number(best.distanceM.toFixed(1));cur.officialCandidateCount=count;cur.distanceGapM=Number(gap.toFixed(1));cur.nameScore=Number(ns.toFixed(3));cur.officialType=local;stats.promoted++;
      reason=`Erweiterte amtliche Suche: eindeutiger Treffer bei ${best.distanceM.toFixed(1)} m.`;
    }else{stats.keptReview++;reason=`Amtlicher Kandidat gefunden, aber nicht eindeutig genug (${best.distanceM.toFixed(1)} m; Gap ${gap.toFixed(1)} m).`;}
   }
  }catch(e){stats.errors++;stats.keptReview++;tier="v9-error";reason=`WFS-Prüfung fehlgeschlagen: ${e.message}`;}
 }
 cur.reviewTier=tier;cur.reason=reason;
 report.push([r.id,r.lavNumber,r.name,r.type,cur.status,tier,best?.distanceM?.toFixed(1)??"",best?.name??"",count,gap?.toFixed?.(1)??"",ns.toFixed(3),reason]);
 console.log(`${i+1}/${targets.length} ${r.lavNumber} ${r.name} -> ${cur.status} [${tier}]`);
}

await fs.writeFile(GENERATED,render(index),"utf8");
await fs.writeFile(REPORT,report.map(r=>r.map(csv).join(";")).join("\n")+"\n","utf8");
const cumulative=Object.values(index).reduce((a,r)=>{a[r.status]=(a[r.status]||0)+1;return a;},{});
console.log("");
console.log("HarzFishing – No-Feature Resolver v9");
console.log("-----------------------------------");
console.log("v9-Ergebnis:",stats);
console.log("Zwei-Quellen kumuliert:",cumulative);
console.log(`Generated aktualisiert: ${path.relative(ROOT,GENERATED)}`);
console.log(`Bericht:                ${path.relative(ROOT,REPORT)}`);
