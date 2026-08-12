import fs from 'node:fs/promises';
const input=process.argv[2]||'data/catch-events.enriched.json';
const events=JSON.parse(await fs.readFile(input,'utf8'));
const usable=events.filter(e=>e.weather && e.confidence>=0.5);
const bySpecies={};
for(const e of usable){const a=bySpecies[e.species]??=[];a.push(e);bySpecies[e.species]=a;}
const avg=(a,k)=>a.length?Number((a.reduce((s,x)=>s+(k(x)??0),0)/a.length).toFixed(1)):null;
const result={total:events.length,usable:usable.length,species:Object.fromEntries(Object.entries(bySpecies).map(([s,a])=>[s,{n:a.length,avgTemperatureC:avg(a,x=>x.weather.temperatureC),avgPressureHpa:avg(a,x=>x.weather.pressureHpa),avgWindKmh:avg(a,x=>x.weather.windKmh),avgCloudCoverPct:avg(a,x=>x.weather.cloudCoverPct)}]))};
console.log(JSON.stringify(result,null,2));
