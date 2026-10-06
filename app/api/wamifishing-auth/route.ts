import { randomBytes, randomInt, timingSafeEqual } from "crypto";
import { authUserId, readJson, readLicense, sessionPath, sha, writeJson, writeLicense, type License } from "../_wamifishing-auth";

export const runtime="nodejs"; export const dynamic="force-dynamic";
const COOKIE="wami_session";
const MAX_DEVICES=3;
type Pending={email:string;name:string;deviceId:string;dataUserId:string;adminTokenHash:string;createdAt:string;expiresAt:string};
type Otp={email:string;deviceId:string;dataUserId:string;hash:string;expiresAt:string};
type Session={email:string;authUserId:string;dataUserId:string;deviceId:string;expiresAt:string};
function norm(v:unknown){return String(v??"").trim().toLowerCase()}
function validEmail(v:string){return /^\S+@\S+\.\S+$/.test(v)}
function cleanDevice(v:unknown){const s=String(v??"").trim();return /^[A-Za-z0-9_-]{8,120}$/.test(s)?s:""}
function cookie(value:string,maxAge:number){return `wami_session=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
function clearCookie(){return `wami_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}

function deviceLabel(request:Request){
  const ua=request.headers.get("user-agent")||"";
  if(/iPhone/i.test(ua))return "iPhone";
  if(/iPad/i.test(ua))return "iPad";
  if(/Android/i.test(ua))return /Mobile/i.test(ua)?"Android-Smartphone":"Android-Tablet";
  if(/Windows/i.test(ua))return "Windows-PC";
  if(/Macintosh|Mac OS X/i.test(ua))return "Mac";
  if(/Linux/i.test(ua))return "Linux-PC";
  return "Gerät";
}
function touchDevice(lic:License,deviceId:string,request:Request,register=false,countUsage=false){
  const now=new Date().toISOString(); const old=lic.deviceInfo?.[deviceId]??{};
  return {...lic,deviceInfo:{...(lic.deviceInfo??{}),[deviceId]:{label:old.label||deviceLabel(request),registeredAt:old.registeredAt||(register?now:undefined),lastSeenAt:now,usageCount:(old.usageCount??0)+(countUsage?1:0)}}};
}
function baseUrl(r:Request){return (process.env.WAMI_APP_URL||new URL(r.url).origin).replace(/\/$/,"")}
function esc(v:string){return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c))}
function page(title:string,message:string,ok=true){return new Response(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#f5f7f6;color:#17211e}.box{max-width:560px;margin:10vh auto;padding:28px;background:white;border:1px solid #d9e0dd;border-radius:16px}.mark{font-size:44px}h1{margin:.3em 0}p{line-height:1.5}.btn{display:inline-block;margin-top:12px;padding:12px 18px;background:#087b68;color:white;text-decoration:none;border-radius:9px;font-weight:700}</style></head><body><main class="box"><div class="mark">${ok?"🎣✅":"🎣⚠️"}</div><h1>${esc(title)}</h1><p>${esc(message)}</p><a class="btn" href="/">Zurück zu WamiFishing</a></main></body></html>`,{status:ok?200:400,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}})}
async function resend(to:string,subject:string,html:string){const key=process.env.RESEND_API_KEY;if(!key)throw new Error("RESEND_API_KEY fehlt in Vercel.");const from=process.env.WAMI_FROM_EMAIL||"WamiFishing <wamifishing@myccw.de>";const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject,html}),cache:"no-store"});if(!res.ok)throw new Error(`E-Mail-Versand fehlgeschlagen (${res.status}).`)}
function equalHash(a:string,b:string){const x=Buffer.from(a);const y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
async function bindUser(email:string,dataUserId:string){const id=authUserId(email);const p=`wamifishing/auth/users/${id}.json`;const existing=await readJson<{dataUserId:string}>(p);if(!existing)await writeJson(p,{dataUserId,email,boundAt:new Date().toISOString()});return existing?.dataUserId||dataUserId}
async function sendOtp(email:string,deviceId:string,dataUserId:string){const code=String(randomInt(100000,1000000));await writeJson(`wamifishing/auth/otp/${sha(email)}.json`,{email,deviceId,dataUserId,hash:sha(code),expiresAt:new Date(Date.now()+10*60_000).toISOString()} satisfies Otp);await resend(email,"Dein WamiFishing Anmeldecode",`<h2>Dein WamiFishing Anmeldecode</h2><p>Dein Code lautet:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px">${code}</p><p>Der Code ist 10 Minuten gültig.</p>`)}

export async function GET(request:Request){
  const u=new URL(request.url); const action=u.searchParams.get("action"); const token=u.searchParams.get("token")||"";
  if(action==="approve"||action==="reject"){
    const p=await readJson<Pending>(`wamifishing/auth/requests/${sha(token)}.json`);
    if(!p||!equalHash(p.adminTokenHash,sha(token))||Date.parse(p.expiresAt)<Date.now())return page("Anfrage ungültig","Diese Freigabe ist bereits verwendet oder abgelaufen.",false);
    await writeJson(`wamifishing/auth/requests/${sha(token)}.json`,{...p,expiresAt:new Date(0).toISOString()});
    const id=authUserId(p.email); const old=await readLicense(p.email); const now=new Date();
    if(action==="approve"){
      const devices=Array.from(new Set(old?.devices??[]));
      if(!devices.includes(p.deviceId)&&devices.length>=MAX_DEVICES)return page("Gerät nicht freigegeben",`Für dieses Konto sind bereits ${MAX_DEVICES} Geräte registriert. Entferne zuerst ein vorhandenes Gerät, bevor ein weiteres freigeschaltet wird.`,false);
      if(!devices.includes(p.deviceId))devices.push(p.deviceId);
      const oldValidUntil=old?.validUntil;
      const oldStillValid=old?.status==="active"&&typeof oldValidUntil==="string"&&Date.parse(oldValidUntil)>Date.now();
      const valid=oldStillValid?new Date(oldValidUntil):new Date(now);
      if(!oldStillValid)valid.setFullYear(valid.getFullYear()+1);
      await writeLicense(touchDevice({email:p.email,name:p.name||old?.name,authUserId:id,status:"active",validUntil:valid.toISOString(),devices,deviceInfo:old?.deviceInfo,createdAt:old?.createdAt??now.toISOString(),approvedAt:now.toISOString()},p.deviceId,request,true));
      await bindUser(p.email,p.dataUserId);
      try{await resend(p.email,"WamiFishing freigeschaltet",`<h2>Willkommen bei WamiFishing 🎣</h2><p>Dein Zugang ist bis <strong>${valid.toLocaleDateString("de-DE")}</strong> freigeschaltet.</p><p>Registrierte Geräte: <strong>${devices.length}/${MAX_DEVICES}</strong>.</p><p>Öffne WamiFishing auf dem beantragten Gerät und fordere deinen Anmeldecode an.</p>`)}catch{}
      return page("Freigabe erfolgreich",`Das Gerät wurde freigeschaltet. Die Jahreslizenz ist bis ${valid.toLocaleDateString("de-DE")} gültig. Registrierte Geräte: ${devices.length}/${MAX_DEVICES}.`);
    }
    await writeLicense({email:p.email,name:p.name||old?.name,authUserId:id,status:"rejected",devices:old?.devices??[],createdAt:old?.createdAt??now.toISOString()});
    try{await resend(p.email,"WamiFishing Zugangsanfrage",`<p>Deine Zugangsanfrage wurde leider nicht freigegeben.</p>`)}catch{}
    return page("Anfrage abgelehnt","Die WamiFishing-Zugangsanfrage wurde abgelehnt.");
  }
  const raw=(request.headers.get("cookie")??"").split(";").map(x=>x.trim()).find(x=>x.startsWith("wami_session="));
  if(!raw)return Response.json({user:null},{headers:{"Cache-Control":"no-store"}});
  const st=decodeURIComponent(raw.slice(raw.indexOf("=")+1)); const s=await readJson<Session>(sessionPath(st));
  if(!s||Date.parse(s.expiresAt)<=Date.now())return Response.json({user:null},{headers:{"Cache-Control":"no-store"}});
  const lic=await readLicense(s.email);
  const allowed=lic?.status==="active"&&Boolean(lic.validUntil)&&Date.parse(lic.validUntil!)>Date.now()&&Array.isArray(lic.devices)&&lic.devices.includes(s.deviceId);
  if(allowed&&lic) await writeLicense(touchDevice(lic,s.deviceId,request,false,true));
  return Response.json({user:allowed?{email:s.email,isAdmin:norm(s.email)===norm(process.env.WAMI_ADMIN_EMAIL)}:null},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){try{
  const b=await request.json() as Record<string,unknown>;const action=String(b.action??"");const email=norm(b.email);const deviceId=cleanDevice(b.deviceId);const dataUserId=cleanDevice(b.dataUserId);
  if(!validEmail(email))return Response.json({error:"Bitte eine gültige E-Mail-Adresse eingeben."},{status:400});if(!deviceId||!dataUserId)return Response.json({error:"Geräte-ID konnte nicht ermittelt werden."},{status:400});
  if(action==="request"){
    const name=String(b.name??"").trim().slice(0,80);if(!name)return Response.json({error:"Bitte deinen Namen eingeben."},{status:400});
    const old=await readLicense(email);const devices=Array.from(new Set(old?.devices??[]));
    if(!devices.includes(deviceId)&&devices.length>=MAX_DEVICES)return Response.json({error:`Für dieses Konto sind bereits ${MAX_DEVICES} Geräte registriert.`},{status:409});
    const admin=norm(process.env.WAMI_ADMIN_EMAIL);if(!admin)return Response.json({error:"WAMI_ADMIN_EMAIL fehlt in Vercel."},{status:500});
    const token=randomBytes(32).toString("hex");const pending:Pending={email,name,deviceId,dataUserId,adminTokenHash:sha(token),createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7*86400_000).toISOString()};
    await writeJson(`wamifishing/auth/requests/${sha(token)}.json`,pending);const root=baseUrl(request);
    const licenseInfo=old?.status==="active"&&old.validUntil&&Date.parse(old.validUntil)>Date.now()?`<p>Bestehende Lizenz bis <strong>${new Date(old.validUntil).toLocaleDateString("de-DE")}</strong> · Geräte ${devices.length}/${MAX_DEVICES}. Die Gerätefreigabe verlängert die Laufzeit nicht.</p>`:"<p>Bei Genehmigung wird die Jahreslizenz aktiviert.</p>";
    await resend(admin,`WamiFishing Zugangsanfrage: ${name}`,`<h2>Neue WamiFishing-Zugangsanfrage</h2><p><strong>Name:</strong> ${esc(name)}<br><strong>E-Mail:</strong> ${esc(email)}<br><strong>Geräte-ID:</strong> ${esc(deviceId)}</p>${licenseInfo}<p>Bitte zuerst den Zahlungseingang bei PayPal prüfen.</p><p><a href="${root}/api/wamifishing-auth?action=approve&token=${token}" style="padding:12px 18px;background:#087b68;color:white;text-decoration:none;border-radius:8px">✓ Genehmigen</a></p><p><a href="${root}/api/wamifishing-auth?action=reject&token=${token}">✕ Ablehnen</a></p>`);
    return Response.json({ok:true,message:"Zugangsanfrage wurde an den Betreiber gesendet."});
  }
  if(action==="send"){
    const admin=norm(process.env.WAMI_ADMIN_EMAIL);let lic=await readLicense(email);
    if(email===admin&&(!lic||lic.status!=="active")){const until=new Date();until.setFullYear(until.getFullYear()+10);lic=touchDevice({email,authUserId:authUserId(email),status:"active",validUntil:until.toISOString(),devices:[deviceId],createdAt:new Date().toISOString(),approvedAt:new Date().toISOString()},deviceId,request,true);await writeLicense(lic);await bindUser(email,dataUserId)}
    if(!lic||lic.status!=="active")return Response.json({error:"Diese E-Mail ist noch nicht freigeschaltet. Bitte zuerst Zugang beantragen."},{status:403});
    if(!lic.validUntil||Date.parse(lic.validUntil)<=Date.now())return Response.json({error:"Deine Jahreslizenz ist abgelaufen."},{status:403});
    const devices=Array.from(new Set(lic.devices??[]));
    if(!devices.includes(deviceId)){
      if(devices.length>=MAX_DEVICES)return Response.json({error:`Für dieses Konto sind bereits ${MAX_DEVICES} Geräte registriert. Entferne zuerst ein vorhandenes Gerät.`},{status:409});
      devices.push(deviceId);
      lic=touchDevice({...lic,devices},deviceId,request,true);
      await writeLicense(lic);
      await bindUser(email,dataUserId);
    }
    if(devices.includes(deviceId)){lic=touchDevice(lic,deviceId,request,!lic.deviceInfo?.[deviceId]?.registeredAt);await writeLicense(lic);}
    await sendOtp(email,deviceId,dataUserId);return Response.json({ok:true,deviceRegistered:true,devices:devices.length,maxDevices:MAX_DEVICES});
  }
  if(action==="verify"){
    const code=String(b.token??"").trim();const otp=await readJson<Otp>(`wamifishing/auth/otp/${sha(email)}.json`);
    if(!otp||otp.deviceId!==deviceId||Date.parse(otp.expiresAt)<=Date.now()||!equalHash(otp.hash,sha(code)))return Response.json({error:"Der Code ist ungültig oder abgelaufen."},{status:400});
    let lic=await readLicense(email);if(!lic||lic.status!=="active"||!lic.validUntil||Date.parse(lic.validUntil)<=Date.now()||!lic.devices.includes(deviceId))return Response.json({error:"Die Freigabe für dieses Gerät ist nicht mehr gültig."},{status:403});
    lic=touchDevice(lic,deviceId,request,!lic.deviceInfo?.[deviceId]?.registeredAt);await writeLicense(lic);
    const data=await bindUser(email,dataUserId);const session=randomBytes(32).toString("hex");const expires=30*86400;
    await writeJson(sessionPath(session),{email,authUserId:authUserId(email),dataUserId:data,deviceId,expiresAt:new Date(Date.now()+expires*1000).toISOString()});
    const h=new Headers({"Cache-Control":"no-store"});h.append("Set-Cookie",cookie(session,expires));return Response.json({ok:true,user:{email}},{headers:h});
  }
  return Response.json({error:"Unbekannte Aktion."},{status:400});
}catch(e){console.error("WamiFishing Auth:",e);return Response.json({error:e instanceof Error?e.message:String(e)},{status:500})}}
export async function DELETE(){const h=new Headers({"Cache-Control":"no-store"});h.append("Set-Cookie",clearCookie());return Response.json({ok:true},{headers:h})}
