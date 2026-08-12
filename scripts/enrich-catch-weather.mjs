import fs from 'node:fs/promises';
import path from 'node:path';

const input = process.argv[2] || 'data/catch-events.json';
const output = process.argv[3] || 'data/catch-events.enriched.json';
const events = JSON.parse(await fs.readFile(input, 'utf8'));

function nearestIndex(times, iso) {
  const target = new Date(iso).getTime();
  let best = 0, delta = Infinity;
  times.forEach((t,i) => { const d=Math.abs(new Date(t).getTime()-target); if(d<delta){delta=d;best=i;} });
  return best;
}
function pressureTrend(values, i) {
  const j=Math.max(0,i-6); const d=(values[i]??0)-(values[j]??values[i]??0);
  return { delta6h: Number(d.toFixed(1)), direction: d > 2 ? 'steigend' : d < -2 ? 'fallend' : 'stabil' };
}
async function enrich(e) {
  if (!Number.isFinite(e.latitude) || !Number.isFinite(e.longitude)) return {...e, weather:null, weatherStatus:'missing-coordinates'};
  const date=e.caughtAt.slice(0,10);
  const p=new URLSearchParams({latitude:String(e.latitude),longitude:String(e.longitude),start_date:date,end_date:date,timezone:'Europe/Berlin',hourly:'temperature_2m,precipitation,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m'});
  const r=await fetch(`https://archive-api.open-meteo.com/v1/archive?${p}`);
  if(!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const j=await r.json(), h=j.hourly, i=nearestIndex(h.time,e.caughtAt);
  return {...e, weather:{time:h.time[i],temperatureC:h.temperature_2m[i],precipitationMm:h.precipitation[i],pressureHpa:h.pressure_msl[i],pressureTrend:pressureTrend(h.pressure_msl,i),cloudCoverPct:h.cloud_cover[i],windKmh:h.wind_speed_10m[i],windDirectionDeg:h.wind_direction_10m[i],provider:'Open-Meteo Historical Weather API'},weatherStatus:'enriched'};
}
const out=[];
for (let i=0;i<events.length;i++) { process.stdout.write(`\rWetter ${i+1}/${events.length}`); try{out.push(await enrich(events[i]));}catch(err){out.push({...events[i],weather:null,weatherStatus:`error: ${err.message}`});} }
await fs.writeFile(output, JSON.stringify(out,null,2));
console.log(`\n✓ ${output}`);
