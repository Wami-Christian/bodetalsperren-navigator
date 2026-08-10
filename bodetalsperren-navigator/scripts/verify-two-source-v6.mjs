#!/usr/bin/env node
/**
 * HarzFishing – Two-source verifier v6
 *
 * Quelle 1: bestehende OSM-Kandidaten aus v3
 * Quelle 2: amtlicher INSPIRE-WFS "Physische Gewässer" Sachsen-Anhalt (Basis-DLM)
 *
 * Liest:
 *   data/lav-catalog.ts
 *   data/local-water-matches.generated.ts
 *
 * Erzeugt:
 *   data/two-source-water-v6.generated.ts
 *   data/two-source-water-v6-review.csv
 *   data/two-source-water-v6-cache.json
 *
 * waters.ts / harz-premium.ts bleiben unangetastet.
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const CATALOG = path.join(DATA, "lav-catalog.ts");
const V3 = path.join(DATA, "local-water-matches.generated.ts");
const OUTPUT = path.join(DATA, "two-source-water-v6.generated.ts");
const REVIEW = path.join(DATA, "two-source-water-v6-review.csv");
const CACHE = path.join(DATA, "two-source-water-v6-cache.json");

const WFS = "https://geodatenportal.sachsen-anhalt.de/ows_INSPIRE_LVermGeo_ATKIS_HY-P_WFS";
const args = process.argv.slice(2);
const opt = (name, fallback="") => args.find(x=>x.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;
const limit = Number(opt("limit","50")) || 50;
const start = Number(opt("start","0")) || 0;
const delta = Math.max(0.002, Math.min(0.03, Number(opt("delta","0.008")) || 0.008)); // ~0.9 km lat
const sleep = ms => new Promise(r=>setTimeout(r,ms));

function extract(text, marker) {
  const p=text.indexOf(marker); if(p<0) throw new Error(`Marker fehlt: ${marker}`);
  const eq=text.indexOf("=",p), a=text.indexOf("[",eq), o=text.indexOf("{",eq);
  const b=a>=0&&(o<0||a<o)?a:o, open=text[b], close=open==="["?"]":"}";
  let d=0,q=null,e=false;
  for(let i=b;i<text.length;i++){const c=text[i];
    if(q){if(e){e=false;continue} if(c==="\\"){e=true;continue} if(c===q)q=null;continue}
    if(c==='"'||c==="'"||c==="`"){q=c;continue}
    if(c===open)d++; if(c===close)d--;
    if(d===0)return JSON.parse(text.slice(b,i+1));
  }
  throw new Error("Literal unvollständig");
}
async function readJson(file,fallback){try{return JSON.parse(await fs.readFile(file,"utf8"))}catch{return fallback}}
const rad=x=>x*Math.PI/180;
function distKm(a,b){const R=6371,dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude);
 const z=Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2;
 return 2*R*Math.asin(Math.sqrt(z));
}
function collectCoords(g,out=[]){
 if(!g)return out;
 if(typeof g[0]==="number"){out.push(g);return out}
 for(const x of g)collectCoords(x,out); return out;
}
function centerOfFeature(f){
 const coords=collectCoords(f?.geometry?.coordinates||[]);
 if(!coords.length)return null;
 let sx=0,sy=0; for(const [x,y] of coords){sx+=x;sy+=y}
 return {longitude:sx/coords.length,latitude:sy/coords.length};
}
function propsName(p={}){
 return p.name || p.geographicalName || p.localName || p["gn:name"] || p["hy-p:name"] || p.label || "";
}
async function getCapabilities(){
 const u=new URL(WFS); u.searchParams.set("service","WFS");u.searchParams.set("request","GetCapabilities");
 const r=await fetch(u); if(!r.ok)throw new Error(`WFS capabilities ${r.status}`);
 return await r.text();
}
function featureTypes(xml){
 return [...xml.matchAll(/<(?:\w+:)?Name>([^<]+)<\/(?:\w+:)?Name>/g)]
  .map(m=>m[1]).filter(x=>/water|hydro|standing|surface|river|lake/i.test(x));
}
async function fetchFeatures(type,lat,lon,cache){
 const key=`${type}|${lat.toFixed(5)}|${lon.toFixed(5)}|${delta}`;
 if(cache[key])return cache[key];
 const u=new URL(WFS);
 u.searchParams.set("service","WFS");u.searchParams.set("version","2.0.0");u.searchParams.set("request","GetFeature");
 u.searchParams.set("typeNames",type);u.searchParams.set("outputFormat","application/json");
 u.searchParams.set("srsName","EPSG:4326");
 u.searchParams.set("bbox",`${lat-delta},${lon-delta},${lat+delta},${lon+delta},EPSG:4326`);
 const r=await fetch(u,{headers:{Accept:"application/json"}});
 if(!r.ok)throw new Error(`WFS ${type}: ${r.status} ${(await r.text()).slice(0,120)}`);
 const j=await r.json(); cache[key]=j.features||[];
 await fs.writeFile(CACHE,JSON.stringify(cache,null,2)); await sleep(300);
 return cache[key];
}
function normalize(s=""){return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g," ").trim()}
function sim(a,b){
 const A=normalize(a),B=normalize(b); if(!A||!B)return 0;if(A===B)return 1;if(A.includes(B)||B.includes(A))return Math.min(A.length,B.length)/Math.max(A.length,B.length);
 const aa=new Set(A.split(" ").filter(x=>x.length>2)),bb=new Set(B.split(" ").filter(x=>x.length>2));let c=0;for(const x of aa)if(bb.has(x))c++;
 return c/(aa.size+bb.size-c||1);
}

const catalog=extract(await fs.readFile(CATALOG,"utf8"),"export const lavCatalog");
const v3=extract(await fs.readFile(V3,"utf8"),"export const localWaterMatchIndex");
const cache=await readJson(CACHE,{});
const caps=await getCapabilities();
let types=featureTypes(caps);
if(!types.length){
 // Common INSPIRE HY-P names; tried if capabilities parsing yields no obvious English names.
 types=["hy-p:StandingWater","hy-p:Watercourse"];
}
console.log("Amtliche WFS-Layer:",types);

const work=catalog.slice(start,start+limit), out={}, rows=[];
for(let i=0;i<work.length;i++){
 const w=work[i], osm=v3[w.id];
 if(!osm || osm.latitude==null || osm.longitude==null){
   out[w.id]={status:"unmatched",reason:"Kein OSM-v3-Kandidat zum Gegenprüfen."};
   continue;
 }
 const p={latitude:Number(osm.latitude),longitude:Number(osm.longitude)};
 let official=[];
 for(const type of types){
   try{
     const fsx=await fetchFeatures(type,p.latitude,p.longitude,cache);
     for(const f of fsx){const c=centerOfFeature(f);if(c)official.push({type,feature:f,center:c,distanceKm:distKm(p,c),name:propsName(f.properties)})}
   }catch(e){console.warn(`WFS ${type}: ${e.message}`)}
 }
 official.sort((a,b)=>a.distanceKm-b.distanceKm);
 const best=official[0], second=official[1];
 if(!best){
   out[w.id]={status:"review",latitude:p.latitude,longitude:p.longitude,reason:"OSM-Kandidat vorhanden, aber kein amtliches HY-P-Objekt im Prüfbereich."};
 }else{
   const nameScore=best.name?sim(w.name,best.name):0;
   const gap=(second?.distanceKm??99)-best.distanceKm;
   const strongDistance=best.distanceKm<=0.12;
   const mediumDistance=best.distanceKm<=0.30;
   const strongName=nameScore>=0.78;
   const unique=gap>=0.12;
   const status=(strongDistance && (strongName||unique)) ? "matched" : "review";
   out[w.id]={
     status,latitude:p.latitude,longitude:p.longitude,
     osmConfidence:osm.confidence,
     officialDistanceKm:Number(best.distanceKm.toFixed(3)),
     officialName:best.name||undefined,
     officialFeatureId:best.feature.id||undefined,
     officialLayer:best.type,
     nameScore:Number(nameScore.toFixed(3)),
     distanceGapKm:Number(gap.toFixed(3)),
     reason:status==="matched"
       ?"OSM-Kandidat räumlich durch amtliches Basis-DLM-HY-P-Wasserobjekt bestätigt."
       :"Amtliches Wasserobjekt vorhanden, aber Zuordnung noch nicht eindeutig genug."
   };
 }
 const r=out[w.id];
 console.log(`${i+1}/${work.length} ${w.lavNumber||""} ${w.name} -> ${r.status}${r.officialDistanceKm!=null?` [amtlich ${r.officialDistanceKm} km]`:""}`);
 if(r.status!=="matched")rows.push([w.id,w.lavNumber,w.name,r.status,r.latitude,r.longitude,r.officialDistanceKm,r.officialName,r.nameScore,r.distanceGapKm,r.reason]);
 await fs.writeFile(OUTPUT,`// AUTO-GENERATED by scripts/verify-two-source-v6.mjs
export const twoSourceWaterV6Index = ${JSON.stringify(out,null,2)};
`,"utf8");
}
const csv=v=>`"${String(v??"").replaceAll('"','""')}"`;
const header=["id","lavNumber","name","status","lat","lon","officialDistanceKm","officialName","nameScore","distanceGapKm","reason"];
await fs.writeFile(REVIEW,[header,...rows].map(r=>r.map(csv).join(";")).join("\n")+"\n","utf8");
const stats=Object.values(out).reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
console.log("\nErgebnis:",stats);
console.log(`Generated: ${path.relative(ROOT,OUTPUT)}`);
console.log(`Review:    ${path.relative(ROOT,REVIEW)}`);
