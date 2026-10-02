export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCESS_COOKIE = "wami_access";
const REFRESH_COOKIE = "wami_refresh";
function cfg() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase ist noch nicht konfiguriert.");
  return { url, key };
}
function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function clearCookie(name: string) { return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
function cookieValue(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) { const [k, ...v] = part.trim().split("="); if (k === name) return decodeURIComponent(v.join("=")); }
  return "";
}
async function authFetch(path: string, body: unknown) {
  const { url, key } = cfg();
  return fetch(`${url}/auth/v1/${path}`, { method:"POST", headers:{apikey:key,"Content-Type":"application/json"}, body:JSON.stringify(body), cache:"no-store" });
}
export async function GET(request: Request) {
  try {
    const { url, key } = cfg();
    let access = cookieValue(request, ACCESS_COOKIE);
    let response = access ? await fetch(`${url}/auth/v1/user`, {headers:{apikey:key,Authorization:`Bearer ${access}`},cache:"no-store"}) : null;
    const headers = new Headers({"Cache-Control":"no-store"});
    if (!response?.ok) {
      const refresh = cookieValue(request, REFRESH_COOKIE);
      if (!refresh) return Response.json({user:null},{headers});
      const refreshed = await authFetch("token?grant_type=refresh_token", {refresh_token:refresh});
      if (!refreshed.ok) return Response.json({user:null},{headers});
      const session = await refreshed.json() as {access_token:string;refresh_token:string;expires_in:number;user?:{id:string;email?:string}};
      headers.append("Set-Cookie",cookie(ACCESS_COOKIE,session.access_token,session.expires_in));
      headers.append("Set-Cookie",cookie(REFRESH_COOKIE,session.refresh_token,60*60*24*30));
      return Response.json({user:session.user??null},{headers});
    }
    return Response.json({user:await response.json()},{headers});
  } catch (error) { return Response.json({user:null,error:error instanceof Error?error.message:String(error)},{status:500}); }
}
export async function POST(request: Request) {
  try {
    const body = await request.json() as {action?:string;email?:string;token?:string};
    const action = String(body.action??"");
    if (action === "send") {
      const email = String(body.email??"").trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({error:"Bitte eine gültige E-Mail-Adresse eingeben."},{status:400});
      const response = await authFetch("otp", {email,create_user:true});
      if (!response.ok) return Response.json({error:"Anmeldecode konnte nicht gesendet werden."},{status:400});
      return Response.json({ok:true});
    }
    if (action === "verify") {
      const email = String(body.email??"").trim().toLowerCase(); const token=String(body.token??"").trim();
      const response = await authFetch("verify", {email,token,type:"email"});
      const data = await response.json() as {access_token?:string;refresh_token?:string;expires_in?:number;user?:{id:string;email?:string};msg?:string};
      if (!response.ok || !data.access_token || !data.refresh_token) return Response.json({error:"Der Code ist ungültig oder abgelaufen."},{status:400});
      const headers = new Headers({"Cache-Control":"no-store"});
      headers.append("Set-Cookie",cookie(ACCESS_COOKIE,data.access_token,data.expires_in??3600));
      headers.append("Set-Cookie",cookie(REFRESH_COOKIE,data.refresh_token,60*60*24*30));
      return Response.json({ok:true,user:data.user??null},{headers});
    }
    return Response.json({error:"Unbekannte Aktion."},{status:400});
  } catch (error) { return Response.json({error:error instanceof Error?error.message:String(error)},{status:500}); }
}
export async function DELETE() {
  const headers = new Headers({"Cache-Control":"no-store"});
  headers.append("Set-Cookie",clearCookie(ACCESS_COOKIE)); headers.append("Set-Cookie",clearCookie(REFRESH_COOKIE));
  return Response.json({ok:true},{headers});
}
