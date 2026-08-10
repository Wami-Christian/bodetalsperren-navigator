#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const matcher = path.join(ROOT, "scripts", "import-atkis-hydro.mjs");
const output = path.join(DATA, "atkis-water-matches.generated.ts");
const review = path.join(DATA, "atkis-water-review.csv");
const args = process.argv.slice(2);
const opt = (name, fallback) => args.find(x => x.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;
const batchSize = Math.max(10, Number(opt("batch","50")) || 50);
const total = Math.max(1, Number(opt("total","1138")) || 1138);
const radius = Math.max(3000, Math.min(12000, Number(opt("radius","10000")) || 10000));
const email = opt("email", process.env.NOMINATIM_EMAIL || "");
const stamp = () => new Date().toISOString().replace(/[:.]/g,"-");
async function exists(f){ try { await fs.access(f); return true; } catch { return false; } }
function runNode(a){ return new Promise((resolve,reject)=>{
  const c=spawn(process.execPath,[matcher,...a],{cwd:ROOT,stdio:"inherit",env:process.env});
  c.on("error",reject); c.on("exit",code=>code===0?resolve():reject(new Error(`Matcher exit code ${code}`)));
});}
if (!(await exists(matcher))) throw new Error("scripts/import-atkis-hydro.mjs fehlt.");
const backupDir=path.join(DATA,"backups"); await fs.mkdir(backupDir,{recursive:true}); const suffix=stamp();
if(await exists(output)){const b=path.join(backupDir,`atkis-water-matches.${suffix}.ts`);await fs.copyFile(output,b);console.log(`Backup: ${path.relative(ROOT,b)}`);await fs.rm(output);}
if(await exists(review)){const b=path.join(backupDir,`atkis-water-review.${suffix}.csv`);await fs.copyFile(review,b);console.log(`Backup: ${path.relative(ROOT,b)}`);}
console.log(`\nHarzFishing Step 2 – Rematch: ${total} Gewässer, Batch ${batchSize}, Radius ${radius} m`);
for(let start=0;start<total;start+=batchSize){
 const limit=Math.min(batchSize,total-start);
 console.log(`\n=== Batch ${start}–${start+limit-1} ===`);
 const a=[`--start=${start}`,`--limit=${limit}`,`--radius=${radius}`,"--refresh"];
 if(email)a.push(`--email=${email}`);
 await runNode(a);
}
console.log("\nRematch abgeschlossen. Jetzt: node scripts/build-water-centers.mjs");
