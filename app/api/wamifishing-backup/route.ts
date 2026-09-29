import { del, get, put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATHNAME = "wamifishing/current-backup.json";
const MANIFEST = "wamifishing/current-backup-manifest.json";

type ChunkManifest = { uploadId: string; total: number };

async function readBlobText(pathname: string) {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result) return null;
  return new Response(result.stream).text();
}

export async function GET() {
  try {
    const manifestText = await readBlobText(MANIFEST);
    if (manifestText) {
      const manifest = JSON.parse(manifestText) as ChunkManifest;
      if (manifest?.uploadId && Number.isInteger(manifest.total) && manifest.total > 0) {
        const parts: string[] = [];
        for (let index = 0; index < manifest.total; index += 1) {
          const part = await readBlobText(`wamifishing/chunks/${manifest.uploadId}/${index}.txt`);
          if (part === null) throw new Error(`Cloud-Sicherung ist unvollständig (Teil ${index + 1}/${manifest.total}).`);
          parts.push(part);
        }
        return new Response(parts.join(""), {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
    }

    // Abwärtskompatibel mit der bis V6.0.5 verwendeten Ein-Datei-Sicherung.
    const text = await readBlobText(PATHNAME);
    if (text === null) return Response.json({ backup: null }, { headers: { "Cache-Control": "no-store" } });
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
    const uploadId = request.headers.get("x-wamifishing-upload");
    const part = Number(request.headers.get("x-wamifishing-part"));
    const total = Number(request.headers.get("x-wamifishing-total"));

    if (uploadId && Number.isInteger(part) && Number.isInteger(total) && part >= 0 && total > 0 && part < total) {
      const chunk = await request.text();
      await put(`wamifishing/chunks/${uploadId}/${part}.txt`, chunk, {
        access: "private",
        allowOverwrite: true,
        contentType: "text/plain; charset=utf-8",
      });
      if (part === total - 1) {
        await put(MANIFEST, JSON.stringify({ uploadId, total } satisfies ChunkManifest), {
          access: "private",
          allowOverwrite: true,
          contentType: "application/json; charset=utf-8",
        });
      }
      return Response.json({ ok: true, part, total }, { headers: { "Cache-Control": "no-store" } });
    }

    // Alte Clients bleiben weiterhin unterstützt.
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
    const manifestText = await readBlobText(MANIFEST).catch(() => null);
    if (manifestText) {
      const manifest = JSON.parse(manifestText) as ChunkManifest;
      if (manifest?.uploadId && manifest.total > 0) {
        for (let index = 0; index < manifest.total; index += 1) {
          await del(`wamifishing/chunks/${manifest.uploadId}/${index}.txt`).catch(() => undefined);
        }
      }
      await del(MANIFEST).catch(() => undefined);
    }
    await del(PATHNAME).catch(() => undefined);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Cloud-Backup konnte nicht gelöscht werden:", error);
    return Response.json({ ok: true });
  }
}
