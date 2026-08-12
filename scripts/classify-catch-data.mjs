import fs from 'node:fs/promises';

const file = process.argv[2] || 'data/catch-events.json';
const out = process.argv[3] || 'data/catch-events.quality.json';
const events = JSON.parse(await fs.readFile(file,'utf8'));

function quality(e){
  const hasWater = !!(e.lavNumber || (e.waterName && e.latitude!=null && e.longitude!=null));
  const hasDate = !!e.caughtAt;
  const p = e.timePrecision;
  if(hasWater && hasDate && (p==='exact'||p==='hour')) return 'A';
  if(hasWater && hasDate && p==='daypart') return 'B';
  if(hasWater && hasDate && p==='date') return 'C';
  if(hasWater && e.caughtMonth) return 'D';
  return 'E';
}
const enriched=events.map(e=>({...e,dataQuality:quality(e)}));
const counts={A:0,B:0,C:0,D:0,E:0}; for(const e of enriched) counts[e.dataQuality]++;
await fs.writeFile(out,JSON.stringify(enriched,null,2));
console.log('Qualität:',Object.entries(counts).map(([k,v])=>`${k}=${v}`).join(' · '));
console.log(`✓ ${out}`);
