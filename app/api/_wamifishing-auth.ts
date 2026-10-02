import { get, put } from "@vercel/blob";

const COOKIE_ACCESS = "wami_access";

function cookieValue(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

async function supabaseUser(accessToken: string) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !accessToken) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return await response.json() as { id?: string; email?: string };
}

async function readJson<T>(pathname: string): Promise<T | null> {
  try {
    const result = await get(pathname, { access: "private", useCache: false });
    if (!result) return null;
    return JSON.parse(await new Response(result.stream).text()) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/404|not found/i.test(message)) return null;
    throw error;
  }
}

async function writeJson(pathname: string, value: unknown) {
  await put(pathname, JSON.stringify(value), { access: "private", allowOverwrite: true, contentType: "application/json; charset=utf-8" });
}

export async function requireWamiUser(request: Request) {
  const auth = await supabaseUser(cookieValue(request, COOKIE_ACCESS));
  if (!auth?.id) return null;

  const requested = request.headers.get("x-wamifishing-user")?.trim() || "";
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(requested)) return null;

  const userBindingPath = `wamifishing/auth/users/${auth.id}.json`;
  const existing = await readJson<{ dataUserId: string }>(userBindingPath);
  if (existing?.dataUserId) return { authUserId: auth.id, email: auth.email ?? "", dataUserId: existing.dataUserId };

  // Ein bestehender Geräte-/Sync-Code wird beim ersten E-Mail-Login genau einmal
  // an das bestätigte Konto gebunden. Dadurch bleiben alle vorhandenen Daten erhalten.
  const ownerPath = `wamifishing/auth/data-owners/${requested}.json`;
  const owner = await readJson<{ authUserId: string }>(ownerPath);
  if (owner && owner.authUserId !== auth.id) return null;

  await writeJson(userBindingPath, { dataUserId: requested, email: auth.email ?? "", boundAt: new Date().toISOString() });
  await writeJson(ownerPath, { authUserId: auth.id, boundAt: new Date().toISOString() });
  return { authUserId: auth.id, email: auth.email ?? "", dataUserId: requested };
}
