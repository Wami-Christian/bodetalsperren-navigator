import { createHash } from "crypto";
import { get, put } from "@vercel/blob";

const COOKIE_SESSION = "wami_session";

type Session = { email: string; authUserId: string; dataUserId: string; deviceId: string; expiresAt: string };
export type DeviceInfo = { label?:string; registeredAt?:string; lastSeenAt?:string };
export type License = { email:string; name?:string; authUserId:string; status:"pending"|"active"|"rejected"|"expired"; validUntil?:string; devices:string[]; deviceInfo?:Record<string,DeviceInfo>; createdAt:string; approvedAt?:string };

function cookieValue(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) { const [key, ...rest] = part.trim().split("="); if (key === name) return decodeURIComponent(rest.join("=")); }
  return "";
}
export function sha(value:string){ return createHash("sha256").update(value).digest("hex"); }
export function authUserId(email:string){ return `mail-${sha(email.trim().toLowerCase()).slice(0,32)}`; }
export function licensePath(email:string){ return `wamifishing/auth/licenses/${sha(email.trim().toLowerCase())}.json`; }
export function sessionPath(token:string){ return `wamifishing/auth/sessions/${sha(token)}.json`; }
export async function readJson<T>(pathname:string):Promise<T|null>{ try{const r=await get(pathname,{access:"private",useCache:false}); if(!r)return null; return JSON.parse(await new Response(r.stream).text()) as T;}catch(e){if(/404|not found/i.test(e instanceof Error?e.message:String(e)))return null;throw e;} }
export async function writeJson(pathname:string,value:unknown){ await put(pathname,JSON.stringify(value),{access:"private",allowOverwrite:true,contentType:"application/json; charset=utf-8"}); }
export async function readLicense(email:string){ return readJson<License>(licensePath(email)); }
export async function writeLicense(license:License){ return writeJson(licensePath(license.email),license); }

export async function requireWamiUser(request: Request) {
  const token = cookieValue(request, COOKIE_SESSION);
  if (!token) return null;
  const session = await readJson<Session>(sessionPath(token));
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;
  const license = await readLicense(session.email);
  if (!license || license.status !== "active" || !license.validUntil || Date.parse(license.validUntil) <= Date.now()) return null;
  if (!license.devices.includes(session.deviceId)) return null;
  const requested = request.headers.get("x-wamifishing-user")?.trim() || "";
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(requested)) return null;
  const binding = await readJson<{dataUserId:string}>(`wamifishing/auth/users/${session.authUserId}.json`);
  const dataUserId = binding?.dataUserId || session.dataUserId || requested;
  return { authUserId:session.authUserId, email:session.email, dataUserId };
}
