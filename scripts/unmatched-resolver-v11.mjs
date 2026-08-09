#!/usr/bin/env node
/**
 * HarzFishing – Unmatched Resolver v11
 *
 * Zweite Suchstrategie für weiterhin `unmatched`:
 * - robuster Parser für Orts-/Abschnittsangaben in LAV-Namen
 * - mehrere Suchanker pro Gewässer
 * - Nominatim nur für Ortsanker
 * - amtliche HY-P-Verifikation
 * - konservative Freigabe; ansonsten Review/unmatched
 *
 * Input:
 *   data/two-source-water-v6-2.generated.ts
 *   LAV-Katalog in data/*.ts
 *
 * Output:
 *   data/two-source-water-v6-2.generated.ts
 *   data/unmatched-v11-result.csv
 *   data/unmatched-v11-cache.json
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd(), DATA=path.join(ROOT,"data");
const GENERATED=path.join(DATA,"two-source-water-v6-2.generated.ts");
const REPORT=path.join(DATA,"unmatched-v11-result.csv");
const CACHE_FILE=path.join(DATA,"unmatched-v11-cache.json");
const WFS="https://geodatenportal.sachsen-anhalt.de/ows_INSPIRE_LVermGeo_ATKIS_HY-P_WFS";

const args=process.argv.slice(2);
const opt=(n,d)=>args.find(x=>x.startsWith(`--${n}=`))?.split("=").slice(1).join("=")??d;
const start=Math.max(0,Number(opt("start","0"))||0);
const limit=Math.max(1,Number(opt("limit","50"))||50);
const bboxM=Math.max(400,Math.min(1800,Number(opt("bbox","900"))||900);
const timeoutMs=Math.max(10000,Math.min(60000,Number(opt("timeout","25000"))||25000);
const email=opt("email",process.env.NOMINATIM_EMAIL||"");
const UA=`HarzFishingNavigator-v11${email?` (${email})`:""}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function n(v){if(v==null||v==="")return null;const x=Number(String(v).replace(",","."));return Number.isFinite(x)?x:null;}
function norm(s=""){return String(s).toLocaleLowerCase("de-DE").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ß/g,"ss").replace(/[’'`´„“”]/g,"").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
function toks(s){return new Set(norm(s).split(" ").filter(x=>x.length>2));}
function sim(a,b){const A=norm(a),B=norm(b);if(!A||!B)return 0;if(A===B)return 1;if(A.includes(B)||B.includes(A))return Math.min(A.length,B.length)/Math.max(A.length,B.length);const aa=toks(A),bb=toks(B);let c=0;for(const x of aa)if(bb.has(x))c++;return aa.size&&bb.size?c/(aa.size+bb.size-c):0;}
function extract(t,m){const p=t.indexOf(m);if(p<0)throw Error(`Marker nicht gefunden: ${m}`);const e=t.indexOf("=",p),a=t.indexOf("[",e),o=t.indexOf("{",e),b=a>=0&&(o<0||a<o)?a:o,op=t[b],cl=op==="["?"]":"}";let d=0,q=null,esc=false;for(let i=b;i<t.length;i++){const c=t[i];if(q){if(esc){esc=false;continue;}if(c==="\\"){esc=true;continue;}if(c===q)q=null;continue;}if(c==='"'||c==="'"||c==="`"){q=c;continue;}if(c===op)d++;if(c===cl)d--;if(!d)return JSON.parse(t.slice(b,i+1));}throw Error("Unvollständiges Literal");}
function render(x){return `// AUTO-GENERATED / updated by scripts/unmatched-resolver-v11.mjs
export interface TwoSourceWaterV62Match {
 status:"matched"|"review"|"unmatched"; latitude?:number; longitude?:number;
 osmConfidence?:number; officialDistanceM?:number; officialName?:string;
 officialFeatureId?:string; officialType?:"StandingWater"|"Watercourse";
 officialCandidateCount?:number; nameScore?:number; distanceGapM?:number;
 reviewTier?:string; reason:string;
}
export const twoSourceWaterV62Index: Record<string, TwoSourceWaterV62Match> = ${JSON.stringify(x,null,2)};
`;}
async function readJson(f,d){try{return JSON.parse(await fs.readFile(f,"utf8"));}catch{return d;}}
const csv=v=>`"${String(v??"").replaceAll('"','""')}"`;

async function findCatalog(){
 const files=(await fs.readdir(DATA)).filter(x=>x.endsWith(".ts"));
 const markers=["export const lavCatalog","export const lavWaters","export const waters","export const fishingWaters","export const lavWaterCatalog"];
 for(const f of files){const t=await fs.readFile(path.join(DATA,f),"utf8");for(const m of markers){try{const x=extract(t,m);if(Array.isArray(x)&&x.length>500&&x.some(y=>y?.id&&y?.name))return x;}catch{}}}
 throw Error("LAV-Katalog nicht gefunden.");
}

// v11: deutlich breiter als v10.1.
// Liefert mehrere plausible Ortsanker, nicht nur "bei/in/am/von".
function anchors(name){
 let s=String(name||"").replace(/[–—]/g,"-").replace(/[„“”"]/g," ");
 const out=[];
 const add=(x,why)=>{
   x=String(x||"").replace(/\([^)]*\)/g," ").replace(/\b(km|rechtsseitig|linksseitig|Straßenbrücke|Str\.-?Br\.?|Brücke|Wegebrücke|Mündung|Einmündung|Abschlag|Wehr|Schleuse)\b.*$/i," ")
    .replace(/[,:;.\-]+$/g," ").replace(/\s+/g," ").trim();
   if(x.length>=3 && x.length<=45 && !/^\d/.test(x)) out.push({place:x,why});
 };
 const patterns=[
  [/\bbei\s+([^,;()]{3,45})/gi,"bei"],
  [/\bin\s+([^,;()]{3,45})/gi,"in"],
  [/\bvon\s+([^,;()]{3,45}?)(?=\s+(?:bis|nach|zur|zum|bei|in)\b|$)/gi,"von"],
  [/\bbis\s+([^,;()]{3,45})/gi,"bis"],
  [/\bnach\s+([^,;()]{3,45})/gi,"nach"],
  [/\bzwischen\s+([^,;()]{3,35})\s+und\s+([^,;()]{3,35})/gi,"zwischen"],
  [/\b(?:Ortsteil|OT)\s+([^,;()]{3,35})/gi,"ortsteil"]
 ];
 for(const [re,why] of patterns)for(const m of s.matchAll(re)){add(m[1],why);if(m[2])add(m[2],why);}
 // Schlusswort/Schlussphrase als Fallback, z.B. "Dorfteich X", "Ohre X".
 const clean=s.replace(/\([^)]*\)/g," ").replace(/\s+/g," ").trim();
 const words=clean.split(" ");
 if(words.length>=2){
   add(words.slice(-1).join(" "),"suffix1");
   if(words.length>=3)add(words.slice(-2).join(" "),"suffix2");
 }
 // offensichtliche Gewässer-/Technikwörter nicht als Ort geokodieren
 const bad=/^(teich|see|graben|bach|elbe|ohre|milde|jeetze|uchte|biese|aland|mulde|unstrut|kanal|wasser|gewässer|weiher|bracke?|altarm|kolk|kuhle|wehr)$/i;
 const seen=new Set();
 return out.filter(x=>!bad.test(x.place)).filter(x=>{const k=norm(x.place);if(!k||seen.has(k))return false;seen.add(k);return true;}).slice(0,6);
}

async function geocode(place,cache){
 const k=norm(place);if(cache.geo[k])return cache.geo[k];
 const u=new URL("https://nominatim.openstreetmap.org/search");
 u.searchParams.set("q",`${place}, Sachsen-Anhalt, Deutschland`);u.searchParams.set("format","jsonv2");u.searchParams.set("limit","3");u.searchParams.set("countrycodes","de");
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);
 try{const r=await fetch(u,{headers:{"User-Agent":UA,Accept:"application/json"},signal:ctl.signal});if(!r.ok)throw Error(`Nominatim ${r.status}`);const d=await r.json();cache.geo[k]=d.map(x=>({lat:Number(x.lat),lon:Number(x.lon),display:x.display_name,importance:Number(x.importance||0)}));await fs.writeFile(CACHE_FILE,JSON.stringify(cache,null,2),"utf8");await sleep(1050);return cache.geo[k];}finally{clearTimeout(timer);}
}
function utm(latD,lonD){const a=6378137,f=1/298.257223563,k=.9996,e=f*(2-f),ep=e/(1-e),lat=latD*Math.PI/180,lon=lonD*Math.PI/180,l0=9*Math.PI/180,N=a/Math.sqrt(1-e*Math.sin(lat)**2),T=Math.tan(lat)**2,C=ep*Math.cos(lat)**2,A=Math.cos(lat)*(lon-l0),M=a*((1-e/4-3*e**2/64-5*e**3/256)*lat-(3*e/8+3*e**2/32+45*e**3/1024)*Math.sin(2*lat)+(15*e**2/256+45*e**3/1024)*Math.sin(4*lat)-(35*e**3/3072)*Math.sin(6*lat));return{x:500000+k*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep)*A**5/120),y:k*(M+N*Math.tan(lat)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep)*A**6/720))};}
function dec(s=""){return String(s).replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&amp;","&").replaceAll("&quot;",'"').replaceAll("&apos;","'");}
function vals(x,nm){const re=new RegExp(`<(?:[\\w.-]+:)?${nm}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${nm}>`,"gi");return[...x.matchAll(re)].map(m=>dec(m[1].replace(/<[^>]+>/g,"").trim())).filter(Boolean);}
function blocks(x,nm){const re=new RegExp(`<(?:[\\w.-]+:)?${nm}(?:\\s[^>]*)?[\\s\\S]*?<\\/(?:[\\w.-]+:)?${nm}>`,"gi");return[...x.matchAll(re)].map(m=>m[0]);}
function points(b){const o=[];for(const t of vals(b,"posList")){const a=t.trim().split(/\s+/).map(Number).filter(Number.isFinite);for(let i=0;i+1<a.length;i+=2)o.push({x:a[i],y:a[i+1]});}for(const t of vals(b,"pos")){const a=t.trim().split(/\s+/).map(Number).filter(Number.isFinite);if(a.length>=2)o.push({x:a[0],y:a[1]});}return o;}
function fid(b){return b.match(/gml:id="([^"]+)"/i)?.[1]||b.match(/gml:id='([^']+)'/i)?.[1]||"";}
function fname(b){return [...vals(b,"text"),...vals(b,"name"),...vals(b,"geographicalName"),...vals(b,"localName")].find(x=>x.length<=120)||"";}
function seg(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay;if(!dx&&!dy)return Math.hypot(px-ax,py-ay);const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));}
function dist(p,a){if(!a.length)return Infinity;if(a.length===1)return Math.hypot(p.x-a[0].x,p.y-a[0].y);let m=Infinity;for(let i=0;i<a.length-1;i++)m=Math.min(m,seg(p.x,p.y,a[i].x,a[i].y,a[i+1].x,a[i+1].y));return m;}
async function wfs(type,p,cache){
 const k=`${type}|${Math.round(p.x)}|${Math.round(p.y)}|${bboxM}`;if(cache.wfs[k])return cache.wfs[k];
 const u=new URL(WFS);u.searchParams.set("service","WFS");u.searchParams.set("version","2.0.0");u.searchParams.set("request","GetFeature");u.searchParams.set("typeNames",type);u.searchParams.set("srsName","urn:ogc:def:crs:EPSG::25832");u.searchParams.set("bbox",`${p.x-bboxM},${p.y-bboxM},${p.x+bboxM},${p.y+bboxM},urn:ogc:def:crs:EPSG::25832`);u.searchParams.set("count","100");
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);
 try{const r=await fetch(u,{headers:{Accept:"application/gml+xml; version=3.2, application/xml, text/xml"},signal:ctl.signal});const t=await r.text();if(!r.ok)throw Error(`WFS ${r.status}`);cache.wfs[k]=t;await fs.writeFile(CACHE_FILE,JSON.stringify(cache,null,2),"utf8");await sleep(150);return t;}finally{clearTimeout(timer);}
}

const gt=await fs.readFile(GENERATED,"utf8"),index=extract(gt,"export const twoSourceWaterV62Index"),catalog=await findCatalog(),byId=new Map(catalog.map(x=>[x.id,x]));
const unmatched=Object.entries(index).filter(([,r])=>r.status==="unmatched").map(([id])=>byId.get(id)).filter(Boolean);
const work=unmatched.slice(start,start+limit),cache=await readJson(CACHE_FILE,{geo:{},wfs:{}});cache.geo??={};cache.wfs??={};
const stats={available:unmatched.length,processed:work.length,withAnchors:0,promoted:0,review:0,unmatched:0,errors:0};
const report=[["id","lavNumber","name","type","result","anchor","anchorRule","distanceM","officialName","candidateCount","nameScore","gapM","reason"]];

console.log("\nHarzFishing – Unmatched Resolver v11\n-----------------------------------");
for(let i=0;i<work.length;i++){
 const water=work[i],cur=index[water.id],aa=anchors(water.name);let result="unmatched",best=null,reason="Kein neuer Ortsanker.";
 if(aa.length){stats.withAnchors++;
  try{
   const choices=[];
   for(const a of aa){
    const gs=await geocode(a.place,cache);
    for(const g of gs.slice(0,2)){
     const p=utm(g.lat,g.lon),flow=String(water.type||"").toLocaleLowerCase("de-DE").includes("fließ"),local=flow?"Watercourse":"StandingWater",xml=await wfs(`hy-p:${local}`,p,cache);
     const cs=blocks(xml,local).map(b=>{const ps=points(b);return ps.length?{id:fid(b),name:fname(b),distanceM:dist(p,ps)}:null;}).filter(Boolean).sort((a,b)=>a.distanceM-b.distanceM);
     if(cs.length){const b=cs[0],gap=cs[1]?cs[1].distanceM-b.distanceM:9999,ns=b.name?sim(water.name,b.name):0;choices.push({a,g,b,gap,ns,count:cs.length,local,flow});}
    }
   }
   choices.sort((x,y)=>(x.b.distanceM-y.b.distanceM)||(y.ns-x.ns));
   best=choices[0];
   if(best){
    let promote=false;
    if(best.flow) promote=best.b.distanceM<=40&&best.ns>=.78&&best.gap>=100;
    else promote=(best.b.distanceM<=30&&best.count===1&&best.gap>=120)||(best.b.distanceM<=50&&best.ns>=.75&&best.gap>=120);
    cur.latitude=best.g.lat;cur.longitude=best.g.lon;cur.officialFeatureId=best.b.id||undefined;cur.officialName=best.b.name||undefined;cur.officialDistanceM=Number(best.b.distanceM.toFixed(1));cur.officialCandidateCount=best.count;cur.nameScore=Number(best.ns.toFixed(3));cur.distanceGapM=Number(best.gap.toFixed(1));cur.officialType=best.local;
    if(promote){cur.status="matched";cur.reviewTier="v11-anchor-strong";cur.reason=`v11-Ortsanker '${best.a.place}' (${best.a.why}) mit eindeutiger amtlicher Bestätigung.`;result="matched";stats.promoted++;}
    else{cur.status="review";cur.reviewTier="v11-anchor-review";cur.reason=`v11-Ortsanker '${best.a.place}' (${best.a.why}) liefert amtlichen Kandidaten, aber noch keine sichere Freigabe.`;result="review";stats.review++;}
   }else{stats.unmatched++;reason="Neue Ortsanker gefunden, aber kein amtlicher Kandidat im Suchbereich.";}
  }catch(e){stats.errors++;stats.unmatched++;reason=`Prüfung fehlgeschlagen: ${e.message}`;}
 }else stats.unmatched++;
 report.push([water.id,water.lavNumber??"",water.name,water.type??"",result,best?.a.place??"",best?.a.why??"",best?.b.distanceM?.toFixed(1)??"",best?.b.name??"",best?.count??"",best?.ns?.toFixed(3)??"",best?.gap?.toFixed(1)??"",cur.reason??reason]);
 console.log(`${i+1}/${work.length} ${water.lavNumber??""} ${water.name} -> ${result}${best?` [${best.a.place}]`:""}`);
}
await fs.writeFile(GENERATED,render(index),"utf8");
await fs.writeFile(REPORT,report.map(r=>r.map(csv).join(";")).join("\n")+"\n","utf8");
const cumulative=Object.values(index).reduce((a,r)=>{a[r.status]=(a[r.status]||0)+1;return a;},{});
console.log("\nv11-Ergebnis:",stats);
console.log("Zwei-Quellen kumuliert:",cumulative);
console.log(`Generated aktualisiert: ${path.relative(ROOT,GENERATED)}`);
console.log(`Bericht:                ${path.relative(ROOT,REPORT)}`);
console.log(`Cache:                  ${path.relative(ROOT,CACHE_FILE)}`);
