import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const input = process.argv[2] || 'data/catch-import.csv';
const output = process.argv[3] || 'data/catch-events.json';
const reviewOutput = 'data/catch-import-review.csv';
const reportOutput = 'data/catch-import-report.json';

const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
const cleanLav = s => String(s ?? '').trim().replace(/[–—]/g,'-');
function csvParse(text){
  const rows=[]; let row=[], cell='', q=false;
  for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1]; if(q){if(c==='"'&&n==='"'){cell+='"';i++;}else if(c==='"')q=false;else cell+=c;}else if(c==='"')q=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}
  if(cell||row.length){row.push(cell);rows.push(row);} const h=rows.shift()?.map(x=>x.trim())||[]; return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(h.map((k,i)=>[k,(r[i]??'').trim()])));
}
function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
function toIso(date,time,precision){ if(!date)return null; const t=(time||'12:00').slice(0,5); const d=new Date(`${date}T${t}:00+02:00`); return Number.isNaN(d.getTime())?null:d.toISOString(); }
function similarity(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;if(a===b)return 1;if(a.includes(b)||b.includes(a))return .9;const A=new Set(a.split(' ')),B=new Set(b.split(' '));const inter=[...A].filter(x=>B.has(x)).length;return inter/Math.max(A.size,B.size);}

const { lavCatalog } = await import(pathToFileURL(path.resolve('data/lav-catalog.ts')).href).catch(()=>({lavCatalog:null}));
if(!lavCatalog) throw new Error('lav-catalog.ts konnte von Node nicht direkt geladen werden. Bitte Node 22+ verwenden.');
const syncText=await fs.readFile('data/angelatlas-lav-sync.generated.ts','utf8');
const coords=new Map();
for(const m of syncText.matchAll(/"([^"]+)":\s*\{[\s\S]*?"lavNumber":\s*"([^"]+)"[\s\S]*?"latitude":\s*([\d.-]+),[\s\S]*?"longitude":\s*([\d.-]+),/g)) coords.set(m[2],{latitude:+m[3],longitude:+m[4]});
const byLav=new Map(lavCatalog.map(w=>[cleanLav(w.lavNumber),w]));
const rows=csvParse(await fs.readFile(input,'utf8'));
const events=[], review=[]; const seen=new Set();
for(let i=0;i<rows.length;i++){
 const r=rows[i]; let water=null,match='none',score=0;
 if(r.lavNumber && byLav.has(cleanLav(r.lavNumber))){water=byLav.get(cleanLav(r.lavNumber));match='lav-number';score=1;}
 else if(r.waterName){const ranked=lavCatalog.map(w=>({w,s:similarity(r.waterName,w.name)})).sort((a,b)=>b.s-a.s); if(ranked[0]?.s>=.86 && (ranked[0].s-(ranked[1]?.s??0)>=.08)){water=ranked[0].w;match='name';score=ranked[0].s;} else {score=ranked[0]?.s??0;}}
 const caughtAt=toIso(r.date,r.time,r.timePrecision); const provider=r.provider||'manual'; const url=r.url||''; const key=`${provider}|${url}|${r.species}|${r.date}|${r.time}|${r.waterName}`;
 if(seen.has(key)){review.push({...r,status:'duplicate',matchScore:score});continue;} seen.add(key);
 const c=water?coords.get(cleanLav(water.lavNumber)):null;
 const confidence=Math.max(0,Math.min(1,Number(r.confidence||0.7)*(match==='lav-number'?1:match==='name'?.95:.65)*(caughtAt?1:.5)));
 const status=water&&caughtAt&&c&&confidence>=.5?'usable':'review';
 const e={id:r.id||`catch-${String(i+1).padStart(4,'0')}`,species:r.species||null,waterName:water?.name||r.waterName||null,lavNumber:water?.lavNumber||r.lavNumber||null,region:r.region||water?.district||'Sachsen-Anhalt',latitude:c?.latitude??null,longitude:c?.longitude??null,caughtAt,timePrecision:r.timePrecision||'date',lengthCm:r.lengthCm?Number(r.lengthCm):null,weightKg:r.weightKg?Number(r.weightKg):null,method:r.method||null,bait:r.bait||null,source:{provider,url,externalId:r.externalId||null,accessMode:r.accessMode||'manual'},confidence:Number(confidence.toFixed(2)),weather:null,notes:r.notes||null,match:{status,method:match,score:Number(score.toFixed(2))}};
 events.push(e); if(status!=='usable')review.push({...r,status,matchMethod:match,matchScore:score,bestLav:water?.lavNumber||'',bestWater:water?.name||''});
}
await fs.writeFile(output,JSON.stringify(events,null,2));
const cols=['id','species','waterName','lavNumber','date','time','provider','url','status','matchMethod','matchScore','bestLav','bestWater'];
await fs.writeFile(reviewOutput,[cols.join(','),...review.map(r=>cols.map(c=>csvEscape(r[c])).join(','))].join('\n'));
const usable=events.filter(e=>e.match?.status==='usable').length;
await fs.writeFile(reportOutput,JSON.stringify({input:rows.length,events:events.length,usable,review:review.length,output,reviewOutput},null,2));
console.log(`Import: ${rows.length} · Events: ${events.length} · brauchbar: ${usable} · Review: ${review.length}`);console.log(`✓ ${output}`);console.log(`✓ ${reviewOutput}`);
