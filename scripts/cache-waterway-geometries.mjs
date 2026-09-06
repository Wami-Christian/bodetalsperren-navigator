import fs from "node:fs/promises";
import path from "node:path";

const endpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter"
];

const waters = [
  ["elbe","Elbe","river",[51.70,11.35,53.20,12.65]],
  ["saale","Saale","river",[50.95,11.45,52.05,12.20]],
  ["selke","Selke","river",[51.60,10.90,52.05,11.55]],
  ["bode","Bode","river",[51.65,10.70,52.10,11.90]],
  ["mulde","Mulde","river",[51.40,12.10,52.05,12.80]],
  ["unstrut","Unstrut","river",[50.95,10.90,51.45,11.90]],
  ["mittellandkanal","Mittellandkanal","canal",[52.10,10.40,52.55,12.10]],
  ["elbe-havel-kanal","Elbe-Havel-Kanal","canal",[52.15,11.60,52.60,12.60]],
  ["wipper","Wipper","river",[51.70,11.45,51.84,11.68]],
  ["helme","Helme","river",[51.36,10.98,51.48,11.40]],
  ["ohre","Ohre","river",[52.20,10.90,52.66,11.82]],
  ["jeetze","Jeetze","river",[52.74,11.02,53.02,11.30]],
  ["fuhne","Fuhne","river",[51.60,11.72,51.83,12.05]]
];

function validLine(geometry) {
  if (!Array.isArray(geometry) || geometry.length < 2) return null;
  const coordinates = geometry
    .filter(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lon))
    .map(p => [p.lon, p.lat]);
  return coordinates.length >= 2 ? coordinates : null;
}

function toFeatures(data) {
  const features = [];
  for (const element of data.elements ?? []) {
    const own = validLine(element.geometry);
    if (own) {
      features.push({
        type:"Feature",
        properties:{osmType:element.type ?? "way",osmId:element.id ?? null},
        geometry:{type:"LineString",coordinates:own}
      });
    }
    for (let i=0;i<(element.members?.length ?? 0);i++) {
      const member=element.members[i];
      if (member.type !== "way") continue;
      const line=validLine(member.geometry);
      if (!line) continue;
      features.push({
        type:"Feature",
        properties:{
          osmType:"relation-member",
          osmId:member.ref ?? null,
          relationId:element.id ?? null,
          role:member.role ?? ""
        },
        geometry:{type:"LineString",coordinates:line}
      });
    }
  }
  return features;
}

function dedupe(features) {
  const seen = new Set();
  const result = [];
  for (const f of features) {
    const id = f.properties?.osmId;
    const coords = f.geometry?.coordinates ?? [];
    const first = coords[0] ?? [];
    const last = coords[coords.length - 1] ?? [];
    const key = id != null
      ? `${f.properties?.osmType}:${id}`
      : `${first.join(",")}|${last.join(",")}|${coords.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(f);
  }
  return result;
}

function makeTiles([south,west,north,east]) {
  const latStep = 0.16;
  const lonStep = 0.22;
  const overlap = 0.015;
  const tiles = [];
  for (let s=south; s<north; s+=latStep) {
    for (let w=west; w<east; w+=lonStep) {
      tiles.push([
        Math.max(south, s-overlap),
        Math.max(west, w-overlap),
        Math.min(north, s+latStep+overlap),
        Math.min(east, w+lonStep+overlap)
      ]);
    }
  }
  return tiles;
}

async function fetchTile(name, kind, bounds) {
  const [south,west,north,east]=bounds;
  const query=`[out:json][timeout:25];
(
  way["waterway"="${kind}"]["name"="${name}"](${south},${west},${north},${east});
  relation["waterway"="${kind}"]["name"="${name}"](${south},${west},${north},${east});
);
out geom;`;

  let lastError;
  for (let attempt=0; attempt<endpoints.length; attempt++) {
    const endpoint=endpoints[attempt];
    try {
      const response=await fetch(endpoint,{
        method:"POST",
        headers:{
          "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8",
          "Accept":"application/json",
          "User-Agent":"HarzFishing-Navigator/5.2"
        },
        body:new URLSearchParams({data:query}).toString(),
        signal:AbortSignal.timeout(35000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return toFeatures(await response.json());
    } catch (e) {
      lastError=e;
      await new Promise(r => setTimeout(r, 1200));
    }
  }
  throw lastError ?? new Error("Overpass nicht erreichbar");
}

async function existsAndValid(file) {
  try {
    const txt=await fs.readFile(file,"utf8");
    const data=JSON.parse(txt);
    return data?.type==="FeatureCollection" && Array.isArray(data.features) && data.features.length>0;
  } catch {
    return false;
  }
}

const outDir=path.join(process.cwd(),"public","osm-geometries");
await fs.mkdir(outDir,{recursive:true});

let cached=0, newly=0, failed=0;

for (const [slug,name,kind,bounds] of waters) {
  const file=path.join(outDir,`${slug}.geojson`);

  if (await existsAndValid(file)) {
    const data=JSON.parse(await fs.readFile(file,"utf8"));
    console.log(`${name.padEnd(18)} ... BEREITS LOKAL (${data.features.length} Linien)`);
    cached++;
    continue;
  }

  const tiles=makeTiles(bounds);
  process.stdout.write(`${name.padEnd(18)} ... `);

  const all=[];
  let tileErrors=0;

  for (let i=0;i<tiles.length;i++) {
    try {
      all.push(...await fetchTile(name,kind,tiles[i]));
    } catch {
      tileErrors++;
    }
    process.stdout.write(`\r${name.padEnd(18)} ... Teil ${i+1}/${tiles.length}, Fehler ${tileErrors}`);
  }

  const features=dedupe(all);

  if (features.length>0) {
    await fs.writeFile(file,JSON.stringify({type:"FeatureCollection",features}));
    console.log(`\r${name.padEnd(18)} ... OK (${features.length} Linien, ${tiles.length-tileErrors}/${tiles.length} Teilbereiche)`);
    newly++;
  } else {
    console.log(`\r${name.padEnd(18)} ... FEHLER (keine Geometrie geladen)`);
    failed++;
  }
}

console.log(`\nVorhanden: ${cached} | Neu geladen: ${newly} | Noch fehlend: ${failed}`);
if (failed===0) {
  console.log("Fertig: Alle 13 Gewässer liegen lokal vor.");
} else {
  console.log("Bei noch fehlenden Gewässern denselben Befehl erneut starten.");
}
