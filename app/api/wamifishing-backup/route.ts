import { del, get, put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATHNAME = "wamifishing/current-backup.json";

export async function GET() {
  try {
    const result = await get(PATHNAME, { access: "private", useCache: false });
    if (!result) return Response.json({ backup: null }, { headers: { "Cache-Control": "no-store" } });
    const text = await new Response(result.stream).text();
    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/404|not found/i.test(message)) return Response.json({ backup: null }, { headers: { "Cache-Control": "no-store" } });
    console.error("Cloud-Backup konnte nicht gelesen werden:", error);
    return Response.json({ error: "Cloud-Backup konnte nicht gelesen werden." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const backup = await request.json();
    if (!backup || backup.format !== "WamiFishing Navigator Backup" || backup.version !== 1) {
      return Response.json({ error: "Ungültige WamiFishing-Sicherung." }, { status: 400 });
    }
    await put(PATHNAME, JSON.stringify(backup), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
    });
    return Response.json({ ok: true, exportedAt: backup.exportedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Cloud-Backup konnte nicht gespeichert werden:", error);
    return Response.json({ error: "Cloud-Backup konnte nicht gespeichert werden." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await del(PATHNAME);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/404|not found/i.test(message)) console.error("Cloud-Backup konnte nicht gelöscht werden:", error);
    return Response.json({ ok: true });
  }
}
