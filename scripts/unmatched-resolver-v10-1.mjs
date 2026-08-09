#!/usr/bin/env node
/**
 * HarzFishing – Unmatched Resolver v10.1
 *
 * Bearbeitet ausschließlich bestehende `unmatched`-Fälle.
 *
 * Strategie:
 * 1) Ortsbezug aus dem LAV-Gewässernamen extrahieren.
 * 2) Ortsanker über Nominatim suchen (Sachsen-Anhalt bevorzugt).
 * 3) Um den Ortsanker amtlichen HY-P-WFS prüfen.
 * 4) Nur bei starker räumlicher + namentlicher Eindeutigkeit hochstufen.
 *
 * Bestehende matched/review werden NICHT verändert.
 *
 * Input:
 *   data/two-source-water-v6-2.generated.ts
 *   data/local-water-import-cache.json   (optional)
 *
 * Außerdem wird versucht, den LAV-Katalog aus den vorhandenen TS-Dateien
 * automatisch zu laden.
 *
 * Output:
 *   data/two-source-water-v6-2.generated.ts
 *   data/unmatched-v10-1-result.csv
 *   data/unmatched-v10-1-cache.json
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const DATA=path.join(ROOT,"data");
const GENERATED=path.join(DATA,"two-source-water-v6-2.generated.ts");
const REPORT=path.join(DATA,"unmatched-v10-1-result.csv");
const CACHE_FILE=path.join(DATA,"unmatched-v10-1-cache.json");
const WFS="https://geodatenportal.sachsen-anhalt.de/ows_INSPIRE_LVermGeo_ATKIS_HY-P_WFS";

const args=process.argv.slice(2);
const opt=(name,fallback)=>args.find(x=>x.startsWith(`--${name}=`))?.split("=").slice(1).join("=")??fallback;
const start=Math.max(0,Number(opt("start","0"))||0);
const limit=Math.max(1,Number(opt("limit","100"))||100);
const bboxM=Math.max(300,Math.min(1500,Number(opt("bbox","700"))||700));
const timeoutMs=Math.max(10000,Math.min(60000,Number(opt("timeout","25000"))||25000));
const email=opt("email",process.env.NOMINATIM_EMAIL||"");
const userAgent=`HarzFishingNavigator-unmatched-v10${email?` (${email})`:""}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function n(v){if(v==null||v==="")return null;const x=Number(String(v).replace(",","."));return Number.isFinite(x)?x:null;}
function norm(s=""){return String(s).toLocaleLowerCase("de-DE").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ß/g,"ss").replace(/[’'`´„“”]/g,"").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
function tokenSet(s){return new Set(norm(s).split(" ").filter(x=>x.length>2));}
function sim(a,b){const A=norm(a),B=norm(b);if(!A||!B)return 0;if(A===B)return 1;if(A.includes(B)||B.includes(A))return Math.min(A.length,B.length)/Math.max(A.length,B.length);const aa=tokenSet(A),bb=tokenSet(B);let c=0;for(const x of aa)if(bb.has(x))c++;return aa.size&&bb.size?c/(aa.size+bb.size-c):0;}
function extractAssignedJson(text,marker){const p=text.indexOf(marker);if(p<0)throw new Error(`Marker nicht gefunden: ${marker}`);const eq=text.indexOf("=",p),arr=text.indexOf("[",eq),obj=text.indexOf("{",eq),b=arr>=0&&(obj<0||arr<obj)?arr:obj,o=text[b],cl=o==="["?"]":"}";let d=0,q=null,e=false;for(let i=b;i<text.length;i++){const c=text[i];if(q){if(e){e=false;continue;}if(c==="\\"){e=true;continue;}if(c===q)q=null;continue;}if(c==='"'||c==="'"||c==="`"){q=c;continue;}if(c===o)d++;if(c===cl)d--;if(d===0)return JSON.parse(text.slice(b,i+1));}throw new Error("Unvollständiges Literal");}
function render(index){return `// AUTO-GENERATED / updated by scripts/unmatched-resolver-v10-1.mjs
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
async function readJson(f,d){try{return JSON.parse(await fs.readFile(f,"utf8"));}catch{return d;}}
function csv(v){return `"${String(v??"").replaceAll('"','""')}"`;}

async function findCatalog(){
 const files=(await fs.readdir(DATA)).filter(x=>x.endsWith(".ts"));
 for(const name of files){
  const p=path.join(DATA,name);
  const t=await fs.readFile(p,"utf8");
  const candidates=[
   "export const lavCatalog",
   "export const lavWaters",
   "export const waters",
   "export const fishingWaters",
   "export const lavWaterCatalog"
  ];
  for(const marker of candidates){
   try{
    const value=extractAssignedJson(t,marker);
    if(Array.isArray(value)&&value.length>500&&value.some(x=>x?.id&&x?.name)) return value;
   }catch{}
  }
 }
 throw new Error("LAV-Katalog nicht automatisch gefunden. Erwartet wird ein exportiertes Array mit id/name in data/*.ts.");
}

function localityCandidates(name){
 const raw=String(name||"").replace(/[–—]/g,"-");
 const out=[];
 const patterns=[
  /\bbei\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß\- ]{2,40})/g,
  /\bin\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß\- ]{2,40})/g,
  /\bam\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß\- ]{2,40})/g,
  /\bvon\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß\- ]{2,40})/g
 ];
 for(const re of patterns){
  for(const m of raw.matchAll(re)){
   let s=m[1].split(/\b(bis|zur|zum|Straße|Straßenbrücke|Brücke|Mündung|Einmündung|km)\b/i)[0].trim();
   s=s.replace(/[-,.;:]+$/,"").trim();
   if(s.length>=3)out.push(s);
  }
 }
 return [...new Set(out)].slice(0,3);
}

async function geocode(place,cache){
 const key=norm(place);
 if(cache.geocode[key])return cache.geocode[key];
 const u=new URL("https://nominatim.openstreetmap.org/search");
 u.searchParams.set("q",`${place}, Sachsen-Anhalt, Deutschland`);
 u.searchParams.set("format","jsonv2");u.searchParams.set("limit","3");u.searchParams.set("countrycodes","de");
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);
 try{
  const r=await fetch(u,{headers:{"User-Agent":userAgent,Accept:"application/json"},signal:ctl.signal});
  if(!r.ok)throw new Error(`Nominatim ${r.status}`);
  const data=await r.json();
  cache.geocode[key]=data.map(x=>({lat:Number(x.lat),lon:Number(x.lon),display_name:x.display_name,importance:Number(x.importance||0)}));
  await fs.writeFile(CACHE_FILE,JSON.stringify(cache,null,2),"utf8");await sleep(1050);
  return cache.geocode[key];
 }finally{clearTimeout(timer);}
}

function wgs84ToUtm32(latDeg,lonDeg){const a=6378137,f=1/298.257223563,k0=.9996,e2=f*(2-f),ep2=e2/(1-e2),lat=latDeg*Math.PI/180,lon=lonDeg*Math.PI/180,lon0=9*Math.PI/180,N=a/Math.sqrt(1-e2*Math.sin(lat)**2),T=Math.tan(lat)**2,C=ep2*Math.cos(lat)**2,A=Math.cos(lat)*(lon-lon0),M=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*lat-(3*e2/8+3*e2**2/32+45*e2**3/1024)*Math.sin(2*lat)+(15*e2**2/256+45*e2**3/1024)*Math.sin(4*lat)-(35*e2**3/3072)*Math.sin(6*lat));return{x:500000+k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T**2+72*C-58*ep2)*A**5/120),y:k0*(M+N*Math.tan(lat)*(A**2/2+(5-T+9*C+4*C**2)*A**4/24+(61-58*T+T**2+600*C-330*ep2)*A**6/720))};}
function decode(s=""){return String(s).replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&amp;","&").replaceAll("&quot;",'"').replaceAll("&apos;","'");}
function vals(xml,name){const re=new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}>`,"gi");return[...xml.matchAll(re)].map(m=>decode(m[1].replace(/<[^>]+>/g,"").trim())).filter(Boolean);}
function blocks(xml,name){const re=new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?[\\s\\S]*?<\\/(?:[\\w.-]+:)?${name}>`,"gi");return[...xml.matchAll(re)].map(m=>m[0]);}
function pts(block){const o=[];for(const t of vals(block,"posList")){const a=t.trim().split(/\s+/).map(Number).filter(Number.isFinite);for(let i=0;i+1<a.length;i+=2)o.push({x:a[i],y:a[i+1]});}for(const t of vals(block,"pos")){const a=t.trim().split(/\s+/).map(Number).filter(Number.isFinite);if(a.length>=2)o.push({x:a[0],y:a[1]});}return o;}
function fid(b){return b.match(/gml:id="([^"]+)"/i)?.[1]||b.match(/gml:id='([^']+)'/i)?.[1]||"";}
function fname(b){return [...vals(b,"text"),...vals(b,"name"),...vals(b,"geographicalName"),...vals(b,"localName")].find(x=>x.length<=120)||"";}
function seg(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay;if(!dx&&!dy)return Math.hypot(px-ax,py-ay);const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));}
function distance(p,a){if(!a.length)return Infinity;if(a.length===1)return Math.hypot(p.x-a[0].x,p.y-a[0].y);let m=Infinity;for(let i=0;i<a.length-1;i++)m=Math.min(m,seg(p.x,p.y,a[i].x,a[i].y,a[i+1].x,a[i+1].y));return m;}

async function fetchWfs(type,p,cache){
 const key=`${type}|${Math.round(p.x)}|${Math.round(p.y)}|${bboxM}`;
 if(cache.wfs[key])return cache.wfs[key];
 const u=new URL(WFS);u.searchParams.set("service","WFS");u.searchParams.set("version","2.0.0");u.searchParams.set("request","GetFeature");u.searchParams.set("typeNames",type);u.searchParams.set("srsName","urn:ogc:def:crs:EPSG::25832");u.searchParams.set("bbox",`${p.x-bboxM},${p.y-bboxM},${p.x+bboxM},${p.y+bboxM},urn:ogc:def:crs:EPSG::25832`);u.searchParams.set("count","100");
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);
 try{const r=await fetch(u,{headers:{Accept:"application/gml+xml; version=3.2, application/xml, text/xml"},signal:ctl.signal});const text=await r.text();if(!r.ok)throw new Error(`WFS ${r.status}`);cache.wfs[key]=text;await fs.writeFile(CACHE_FILE,JSON.stringify(cache,null,2),"utf8");await sleep(150);return text;}finally{clearTimeout(timer);}
}

const generated=await fs.readFile(GENERATED,"utf8");
const index=extractAssignedJson(generated,"export const twoSourceWaterV62Index");
const catalog=await findCatalog();
const byId=new Map(catalog.map(x=>[x.id,x]));
const all=Object.entries(index).filter(([,r])=>r.status==="unmatched").map(([id])=>byId.get(id)).filter(Boolean);
const work=all.slice(start,start+limit);
const cache=await readJson(CACHE_FILE,{geocode:{},wfs:{}});
cache.geocode??={};cache.wfs??={};

const stats={available:all.length,processed:work.length,withLocality:0,promoted:0,review:0,unmatched:0,errors:0};
const report=[["id","lavNumber","name","type","result","locality","distanceM","officialName","candidateCount","nameScore","gapM","reason"]];

console.log("");
console.log("HarzFishing – Unmatched Resolver v10.1");
console.log("------------------------------------");
console.log(`Offene unmatched: ${all.length}`);
console.log(`Bearbeitung: ${start}–${start+work.length-1}`);
console.log("");

for(let i=0;i<work.length;i++){
 const water=work[i],cur=index[water.id],locs=localityCandidates(water.name);
 let result="unmatched",reason="Kein belastbarer Ortsbezug aus dem Namen extrahiert.",bestOut=null,chosenLoc="";
 if(locs.length){stats.withLocality++;
  try{
   let choices=[];
   for(const loc of locs){
    const geo=await geocode(loc,cache);
    for(const g of geo.slice(0,2)){
     const p=wgs84ToUtm32(g.lat,g.lon);
     const isFlow=String(water.type||"").toLocaleLowerCase("de-DE").includes("fließ");
     const local=isFlow?"Watercourse":"StandingWater";
     const xml=await fetchWfs(`hy-p:${local}`,p,cache);
     const cand=blocks(xml,local).map(b=>{const a=pts(b);return a.length?{id:fid(b),name:fname(b),distanceM:distance(p,a)}:null;}).filter(Boolean).sort((a,b)=>a.distanceM-b.distanceM);
     if(cand.length){
      const b=cand[0],gap=cand[1]?cand[1].distanceM-b.distanceM:9999,ns=b.name?sim(water.name,b.name):0;
      choices.push({loc,g,b,gap,ns,count:cand.length,local,isFlow});
     }
    }
   }
   choices.sort((a,b)=>(a.b.distanceM-b.b.distanceM)||(b.ns-a.ns));
   const x=choices[0];
   if(x){
    bestOut=x;chosenLoc=x.loc;
    let promote=false;
    if(x.isFlow) promote=x.b.distanceM<=80 && x.ns>=.72 && x.gap>=80;
    else promote=(x.b.distanceM<=80 && x.ns>=.65 && x.gap>=100) || (x.b.distanceM<=35 && x.count===1 && x.ns>=.45);
    if(promote){
      cur.status="matched";cur.latitude=x.g.lat;cur.longitude=x.g.lon;cur.officialFeatureId=x.b.id||undefined;cur.officialName=x.b.name||undefined;cur.officialDistanceM=Number(x.b.distanceM.toFixed(1));cur.officialCandidateCount=x.count;cur.nameScore=Number(x.ns.toFixed(3));cur.distanceGapM=Number(x.gap.toFixed(1));cur.officialType=x.local;cur.reviewTier="v10-locality-official";cur.reason=`Neuer Ortsanker '${x.loc}' plus eindeutige amtliche HY-P-Bestätigung.`;result="matched";stats.promoted++;
    }else{
      cur.status="review";cur.latitude=x.g.lat;cur.longitude=x.g.lon;cur.officialFeatureId=x.b.id||undefined;cur.officialName=x.b.name||undefined;cur.officialDistanceM=Number(x.b.distanceM.toFixed(1));cur.officialCandidateCount=x.count;cur.nameScore=Number(x.ns.toFixed(3));cur.distanceGapM=Number(x.gap.toFixed(1));cur.officialType=x.local;cur.reviewTier="v10-locality-review";cur.reason=`Neuer Ortsanker '${x.loc}' gefunden; amtlicher Kandidat vorhanden, aber nicht eindeutig genug.`;result="review";stats.review++;
    }
   }else{stats.unmatched++;reason="Ortsanker gefunden, aber kein amtliches Gewässer im Prüfbereich.";}
  }catch(e){stats.errors++;stats.unmatched++;reason=`Prüfung fehlgeschlagen: ${e.message}`;}
 }else stats.unmatched++;
 report.push([water.id,water.lavNumber??"",water.name,water.type??"",result,chosenLoc,bestOut?.b.distanceM?.toFixed(1)??"",bestOut?.b.name??"",bestOut?.count??"",bestOut?.ns?.toFixed(3)??"",bestOut?.gap?.toFixed(1)??"",cur.reason??reason]);
 console.log(`${i+1}/${work.length} ${water.lavNumber??""} ${water.name} -> ${result}${chosenLoc?` [${chosenLoc}]`:""}`);
}

await fs.writeFile(GENERATED,render(index),"utf8");
await fs.writeFile(REPORT,report.map(r=>r.map(csv).join(";")).join("\n")+"\n","utf8");
const cumulative=Object.values(index).reduce((a,r)=>{a[r.status]=(a[r.status]||0)+1;return a;},{});
console.log("");
console.log("v10-Ergebnis:",stats);
console.log("Zwei-Quellen kumuliert:",cumulative);
console.log(`Generated aktualisiert: ${path.relative(ROOT,GENERATED)}`);
console.log(`Bericht:                ${path.relative(ROOT,REPORT)}`);
console.log(`Cache:                  ${path.relative(ROOT,CACHE_FILE)}`);
