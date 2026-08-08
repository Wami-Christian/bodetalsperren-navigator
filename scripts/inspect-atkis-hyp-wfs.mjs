#!/usr/bin/env node
/**
 * HarzFishing – WFS Inspector v6.1
 * Nur Diagnose: GetCapabilities -> FeatureTypes -> DescribeFeatureType -> 1 GetFeature.
 * Keine App-/Daten-Dateien werden verändert.
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTDIR = path.join(ROOT, "data", "wfs-diagnostic");
await fs.mkdir(OUTDIR, { recursive: true });

const WFS = "https://geodatenportal.sachsen-anhalt.de/ows_INSPIRE_LVermGeo_ATKIS_HY-P_WFS";
const VERSION = "2.0.0";

function decodeXml(s="") {
  return s.replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&amp;","&").replaceAll("&quot;",'"').replaceAll("&apos;","'");
}
function tagValues(xml, localName) {
  const re = new RegExp(`<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${localName}>`, "gi");
  return [...xml.matchAll(re)].map(m => decodeXml(m[1].replace(/<[^>]+>/g,"").trim())).filter(Boolean);
}
function featureTypeBlocks(xml) {
  const re=/<(?:[\w.-]+:)?FeatureType(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?FeatureType>/gi;
  return [...xml.matchAll(re)].map(m=>m[1]);
}
function firstTag(block,name){ return tagValues(block,name)[0] || ""; }

async function request(url) {
  const r = await fetch(url, { headers: { Accept: "application/xml,text/xml,*/*" }});
  const text = await r.text();
  return { status:r.status, ok:r.ok, contentType:r.headers.get("content-type")||"", text, url:r.url };
}
function make(params){
  const u=new URL(WFS);
  for(const [k,v] of Object.entries(params)) u.searchParams.set(k,v);
  return u;
}
function exceptionText(xml){
  return tagValues(xml,"ExceptionText").join(" | ");
}

console.log("\nHarzFishing – WFS Inspector v6.1");
console.log("--------------------------------");

// 1) Capabilities
const capUrl=make({service:"WFS",version:VERSION,request:"GetCapabilities"});
const cap=await request(capUrl);
await fs.writeFile(path.join(OUTDIR,"01-capabilities.xml"),cap.text,"utf8");
console.log(`GetCapabilities: HTTP ${cap.status}`);
if(!cap.ok){
  console.log(exceptionText(cap.text) || cap.text.slice(0,500));
  process.exit(1);
}

const blocks=featureTypeBlocks(cap.text);
const types=blocks.map(b=>({
  name:firstTag(b,"Name"),
  title:firstTag(b,"Title"),
  defaultCRS:firstTag(b,"DefaultCRS") || firstTag(b,"DefaultSRS")
})).filter(x=>x.name);

console.log(`FeatureTypes gefunden: ${types.length}`);
types.forEach((x,i)=>console.log(`  ${i+1}. ${x.name} | ${x.title} | ${x.defaultCRS}`));
await fs.writeFile(path.join(OUTDIR,"feature-types.json"),JSON.stringify(types,null,2),"utf8");

if(!types.length){
  console.log("Keine FeatureTypes gefunden. Bitte data/wfs-diagnostic/01-capabilities.xml schicken.");
  process.exit(2);
}

// Bevorzugt physische stehende Gewässer, sonst erster echter FeatureType.
const chosen =
  types.find(x=>/standing|steh|surfacewater|waterbody|water/i.test(`${x.name} ${x.title}`) && !/network|node/i.test(`${x.name} ${x.title}`))
  || types[0];

console.log(`\nGewählter FeatureType: ${chosen.name}`);

// 2) DescribeFeatureType
const descUrl=make({
  service:"WFS",version:VERSION,request:"DescribeFeatureType",typeNames:chosen.name
});
const desc=await request(descUrl);
await fs.writeFile(path.join(OUTDIR,"02-describe-feature-type.xml"),desc.text,"utf8");
console.log(`DescribeFeatureType: HTTP ${desc.status}`);
if(!desc.ok) console.log(exceptionText(desc.text) || desc.text.slice(0,500));

// 3) Ein einziges Feature – zunächst ohne BBOX und ohne GeoJSON-Annahme.
const getUrl=make({
  service:"WFS",version:VERSION,request:"GetFeature",
  typeNames:chosen.name,count:"1"
});
const one=await request(getUrl);
await fs.writeFile(path.join(OUTDIR,"03-one-feature.xml"),one.text,"utf8");
console.log(`GetFeature count=1: HTTP ${one.status} | ${one.contentType}`);
if(!one.ok){
  console.log(exceptionText(one.text) || one.text.slice(0,700));
  process.exit(3);
}

console.log("\nERFOLG: Der amtliche WFS liefert ein echtes Feature.");
console.log("Diagnose gespeichert unter data\\wfs-diagnostic\\");
console.log("Bitte schick mir jetzt die komplette Konsolenausgabe dieses Tests.");
