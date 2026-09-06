import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

function toFeatureCollection(data: any) {
  const features: any[] = [];
  for (const element of data?.elements ?? []) {
    if (Array.isArray(element.geometry) && element.geometry.length >= 2) {
      features.push({
        type: "Feature",
        properties: { id: element.id, type: element.type, name: element.tags?.name ?? null },
        geometry: {
          type: "LineString",
          coordinates: element.geometry.map((p: any) => [p.lon, p.lat])
        }
      });
    }
    if (element.type === "relation" && Array.isArray(element.members)) {
      for (const member of element.members) {
        if (Array.isArray(member.geometry) && member.geometry.length >= 2) {
          features.push({
            type: "Feature",
            properties: { id: `${element.id}:${member.ref}`, type: "relation-member", name: element.tags?.name ?? null },
            geometry: {
              type: "LineString",
              coordinates: member.geometry.map((p: any) => [p.lon, p.lat])
            }
          });
        }
      }
    }
  }
  return { type: "FeatureCollection", features };
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim();
  if (!name || name.length > 80) {
    return NextResponse.json({ error: "waterway name required" }, { status: 400 });
  }

  const safe = name.replace(/["\\]/g, "");
  // Hauptflüsse/Kanäle können in OSM abschnittsweise Namenszusätze tragen.
  // Deshalb suchen wir neben dem exakten Namen auch passende benannte
  // river/canal-Ways und Relations.
  const escapedRegex = safe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const query = `[out:json][timeout:35];
(
way["waterway"~"^(river|canal)$"]["name"~"${escapedRegex}","i"](50.75,10.45,53.25,13.35);
relation["waterway"~"^(river|canal)$"]["name"~"${escapedRegex}","i"](50.75,10.45,53.25,13.35);
);
out geom;`;

  let lastError = "Overpass unavailable";
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ data: query }),
        next: { revalidate: 86400 }
      });
      if (!response.ok) {
        lastError = `Overpass ${response.status}`;
        continue;
      }
      const raw = await response.json();
      const collection = toFeatureCollection(raw);
      return NextResponse.json(collection, {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
          "X-HarzFishing-Waterway": name,
          "X-HarzFishing-Features": String(collection.features.length)
        }
      });
    } catch (error: any) {
      lastError = error?.message ?? String(error);
    }
  }

  return NextResponse.json({ error: lastError }, { status: 502 });
}
