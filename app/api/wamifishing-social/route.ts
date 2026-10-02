import { requireWamiUser } from "../_wamifishing-auth";
import { del, get, put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Friend = { userId: string; name: string; friendCode: string };
type Incoming = { fromUserId: string; fromName: string; fromCode: string; createdAt: string };
type Profile = { userId: string; name: string; friendCode: string; friends: Friend[]; incoming: Incoming[]; updatedAt: string };


function profilePath(userId: string) { return `wamifishing/social/profiles/${userId}.json`; }
function codePath(code: string) { return `wamifishing/social/codes/${code.toUpperCase()}.json`; }
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
function cleanCode(value: unknown) { return String(value ?? "").trim().toUpperCase(); }
function validCode(code: string) { return /^WAMI-[A-Z0-9]{6,16}$/.test(code); }

export async function GET(request: Request) {
  try {
    const identity = await requireWamiUser(request);
    if (!identity) return Response.json({ error: "Bitte per E-Mail anmelden." }, { status: 401 });
    const userId = identity.dataUserId;
    const profile = await readJson<Profile>(profilePath(userId));
    return Response.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Freundeprofil konnte nicht gelesen werden:", error);
    return Response.json({ error: "Freundeprofil konnte nicht gelesen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireWamiUser(request);
    if (!identity) return Response.json({ error: "Bitte per E-Mail anmelden." }, { status: 401 });
    const userId = identity.dataUserId;
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "save-profile") {
      const name = String(body.name ?? "").trim().slice(0, 40);
      const friendCode = cleanCode(body.friendCode);
      if (!name) return Response.json({ error: "Bitte einen Anzeigenamen eingeben." }, { status: 400 });
      if (!validCode(friendCode)) return Response.json({ error: "Der Freundescode ist ungültig." }, { status: 400 });

      const owner = await readJson<{ userId: string }>(codePath(friendCode));
      if (owner && owner.userId !== userId) return Response.json({ error: "Dieser Freundescode ist bereits vergeben." }, { status: 409 });

      const old = await readJson<Profile>(profilePath(userId));
      const profile: Profile = {
        userId, name, friendCode,
        friends: old?.friends ?? [], incoming: old?.incoming ?? [],
        updatedAt: new Date().toISOString(),
      };
      await writeJson(profilePath(userId), profile);
      await writeJson(codePath(friendCode), { userId });
      if (old?.friendCode && old.friendCode !== friendCode) await del(codePath(old.friendCode)).catch(() => undefined);
      return Response.json({ ok: true, profile });
    }

    if (action === "request") {
      const friendCode = cleanCode(body.friendCode);
      if (!validCode(friendCode)) return Response.json({ error: "Der Freundescode ist ungültig." }, { status: 400 });
      const me = await readJson<Profile>(profilePath(userId));
      if (!me) return Response.json({ error: "Bitte zuerst dein Profil / deinen Freundescode speichern." }, { status: 400 });
      const owner = await readJson<{ userId: string }>(codePath(friendCode));
      if (!owner) return Response.json({ error: "Freundescode nicht gefunden." }, { status: 404 });
      if (owner.userId === userId) return Response.json({ error: "Du kannst dich nicht selbst hinzufügen." }, { status: 400 });
      const target = await readJson<Profile>(profilePath(owner.userId));
      if (!target) return Response.json({ error: "Freundeprofil nicht gefunden." }, { status: 404 });
      if (target.friends.some(f => f.userId === userId)) return Response.json({ ok: true });
      const incoming = target.incoming.filter(r => r.fromUserId !== userId);
      incoming.push({ fromUserId: userId, fromName: me.name, fromCode: me.friendCode, createdAt: new Date().toISOString() });
      await writeJson(profilePath(target.userId), { ...target, incoming, updatedAt: new Date().toISOString() });
      return Response.json({ ok: true });
    }

    if (action === "accept") {
      const fromUserId = String(body.fromUserId ?? "").trim();
      const me = await readJson<Profile>(profilePath(userId));
      const other = await readJson<Profile>(profilePath(fromUserId));
      if (!me || !other) return Response.json({ error: "Freundeprofil nicht gefunden." }, { status: 404 });
      if (!me.incoming.some(r => r.fromUserId === fromUserId)) return Response.json({ error: "Keine passende Freundschaftsanfrage vorhanden." }, { status: 400 });
      const myFriends = [...me.friends.filter(f => f.userId !== other.userId), { userId: other.userId, name: other.name, friendCode: other.friendCode }];
      const otherFriends = [...other.friends.filter(f => f.userId !== me.userId), { userId: me.userId, name: me.name, friendCode: me.friendCode }];
      await writeJson(profilePath(me.userId), { ...me, friends: myFriends, incoming: me.incoming.filter(r => r.fromUserId !== fromUserId), updatedAt: new Date().toISOString() });
      await writeJson(profilePath(other.userId), { ...other, friends: otherFriends, updatedAt: new Date().toISOString() });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unbekannte Aktion." }, { status: 400 });
  } catch (error) {
    console.error("Freundefunktion fehlgeschlagen:", error);
    return Response.json({ error: "Freundefunktion fehlgeschlagen." }, { status: 500 });
  }
}
