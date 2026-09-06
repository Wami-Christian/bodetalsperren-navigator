import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

// Gesamter für HarzFishing relevanter Elbe-Bereich in Sachsen-Anhalt
// mit etwas Puffer an den Landesgrenzen.
const OVERPASS_QUERY = `[out:json][timeout:30];
(
  way["waterway"="river"]["name"="Elbe"](51.70,11.35,53.20,12.65);
  relation["waterway"="river"]["name"="Elbe"](51.70,11.35,53.20,12.65);
);
out geom;`;

export const revalidate = 86400;

type OverpassGeometryPoint = { lat: number; lon: number };
type OverpassElement = {
  type?: string;
  id?: number;
  geometry?: OverpassGeometryPoint[];
  members?: Array<{
    type?: string;
    role?: string;
    geometry?: OverpassGeometryPoint[];
  }>;
};

function validLine(geometry: OverpassGeometryPoint[] | undefined) {
  if (!Array.isArray(geometry) || geometry.length < 2) return null;
  const coordinates = geometry
    .filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lon))
    .map((point) => [point.lon, point.lat]);
  return coordinates.length >= 2 ? coordinates : null;
}

function overpassToGeoJson(data: { elements?: OverpassElement[] }) {
  const features: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const element of data.elements ?? []) {
    const ownLine = validLine(element.geometry);
    if (ownLine) {
      const key = `${element.type ?? "way"}:${element.id ?? features.length}`;
      if (!seen.has(key)) {
        seen.add(key);
        features.push({
          type: "Feature",
          properties: { osmType: element.type ?? "way", osmId: element.id ?? null },
          geometry: { type: "LineString", coordinates: ownLine }
        });
      }
    }

    // Bei River-Relationen liefert Overpass die Geometrie oft auf den Way-Membern.
    for (let index = 0; index < (element.members?.length ?? 0); index += 1) {
      const member = element.members![index];
      if (member.type !== "way") continue;
      const memberLine = validLine(member.geometry);
      if (!memberLine) continue;
      const key = `relation:${element.id ?? "x"}:member:${index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      features.push({
        type: "Feature",
        properties: {
          osmType: "relation-member",
          osmId: element.id ?? null,
          role: member.role ?? ""
        },
        geometry: { type: "LineString", coordinates: memberLine }
      });
    }
  }

  return { type: "FeatureCollection", features };
}

async function fetchFromOverpass(endpoint: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Accept: "application/json",
      "User-Agent": "HarzFishing-Navigator/5.2"
    },
    body: new URLSearchParams({ data: OVERPASS_QUERY }).toString(),
    next: { revalidate: 86400 }
  });

  if (!response.ok) {
    throw new Error(`Overpass ${response.status}`);
  }

  const data = await response.json();
  const geoJson = overpassToGeoJson(data);
  if (!geoJson.features.length) {
    throw new Error("Overpass lieferte keine Elbe-Linien.");
  }
  return geoJson;
}

export async function GET() {
  const errors: string[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const geoJson = await fetchFromOverpass(endpoint);
      return NextResponse.json(geoJson, {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
          "X-HarzFishing-Elbe-Features": String(geoJson.features.length)
        }
      });
    } catch (error) {
      errors.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return NextResponse.json(
    {
      error: "Elbe-Geometrie momentan nicht erreichbar.",
      detail: errors.join(" | ")
    },
    { status: 502 }
  );
}
