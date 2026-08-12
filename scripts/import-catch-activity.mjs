import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const input=process.argv[2]||'data/catch-activity-import.csv';
const output='data/catch-activity.json'; const reviewOutput='data/catch-activity-review.csv';
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
const cleanLav=s=>String(s??'').trim().replace(/[–—]/g,'-');
function csvParse(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(q){if(c==='"'&&n==='"'){cell+='"';i++;}else if(c==='"')q=false;else cell+=c;}else if(c==='"')q=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}if(cell||row.length){row.push(cell);rows.push(row);}const h=rows.shift()?.map(x=>x.trim())||[];return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(h.map((k,i)=>[k,(r[i]??'').trim()])));}
function sim(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;if(a===b)return 1;if(a.includes(b)||b.includes(a))return .9;const A=new Set(a.split(' ')),B=new Set(b.split(' '));return [...A].filter(x=>B.has(x)).length/Math.max(A.size,B.size);}
const {lavCatalog}=await import(pathToFileURL(path.resolve('data/lav-catalog.ts')).href);
const byLav=new Map(lavCatalog.map(w=>[cleanLav(w.lavNumber),w])); const rows=csvParse(await fs.readFile(input,'utf8')); const data=[],review=[];
for(const r of rows){let water=null,method='none',score=0;if(r.lavNumber&&byLav.has(cleanLav(r.lavNumber))){water=byLav.get(cleanLav(r.lavNumber));method='lav-number';score=1;}else if(r.waterName){const ranked=lavCatalog.map(w=>({w,s:sim(r.waterName,w.name)})).sort((a,b)=>b.s-a.s);if(ranked[0]?.s>=.9&&(ranked[0].s-(ranked[1]?.s??0)>=.1)){water=ranked[0].w;method='name';score=ranked[0].s;}else score=ranked[0]?.s??0;}
 const rec={species:r.species||null,waterName:water?.name||r.waterName||null,lavNumber:water?.lavNumber||r.lavNumber||null,provider:r.provider||null,url:r.url||null,totalReports:r.totalReports?+r.totalReports:null,speciesReports:r.speciesReports?+r.speciesReports:null,speciesRank:r.speciesRank?+r.speciesRank:null,activityLabel:r.activityLabel||null,observedAt:r.observedAt||new Date().toISOString().slice(0,10),confidence:+(r.confidence||.6),quality:'E',match:{method,score:+score.toFixed(2)}};
 if(water) data.push(rec); else review.push({...r,matchScore:score});
}
await fs.writeFile(output,JSON.stringify(data,null,2));
const cols=['species','waterName','lavNumber','provider','url','matchScore']; await fs.writeFile(reviewOutput,[cols.join(','),...review.map(r=>cols.map(c=>`"${String(r[c]??'').replaceAll('"','""')}"`).join(','))].join('\n'));
console.log(`Aktivität: ${rows.length} · gematcht: ${data.length} · Review: ${review.length}`);console.log(`✓ ${output}`);
