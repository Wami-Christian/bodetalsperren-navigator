import { NextResponse } from "next/server";
import { lavFlowFeatureById } from "@/data/lav-flow-features.generated";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

type OSMElement = {
  type: "way" | "relation";
  id: number;
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{ type: string; geometry?: Array<{ lat: number; lon: number }> }>;
};

function featureId(type: string, id: number) {
  return `${type}/${id}`;
}

export async function GET() {
  const ids = Array.from(new Set(Object.values(lavFlowFeatureById).map((x) => x.osmFeatureId)));
  const wayIds = ids.filter((id) => id.startsWith("way/")).map((id) => id.slice(4));
  const relationIds = ids.filter((id) => id.startsWith("relation/")).map((id) => id.slice(9));

  const clauses: string[] = [];
  if (wayIds.length) clauses.push(`way(id:${wayIds.join(",")});`);
  if (relationIds.length) clauses.push(`relation(id:${relationIds.join(",")});`);
  const query = `[out:json][timeout:45];(${clauses.join("")});out geom;`;

  let lastError = "Overpass unavailable";
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ data: query }),
        next: { revalidate: 86400 }
      });
      if (!response.ok) {
        lastError = `${endpoint}: ${response.status}`;
        continue;
      }
      const json = await response.json();
      const features: any[] = [];
      for (const element of (json.elements ?? []) as OSMElement[]) {
        const osmFeatureId = featureId(element.type, element.id);
        if (element.geometry?.length) {
          features.push({
            type: "Feature",
            properties: { osmFeatureId },
            geometry: { type: "LineString", coordinates: element.geometry.map((p) => [p.lon, p.lat]) }
          });
        }
        if (element.type === "relation") {
          for (const member of element.members ?? []) {
            if (!member.geometry?.length) continue;
            features.push({
              type: "Feature",
              properties: { osmFeatureId },
              geometry: { type: "LineString", coordinates: member.geometry.map((p) => [p.lon, p.lat]) }
            });
          }
        }
      }
      return NextResponse.json(
        { type: "FeatureCollection", features },
        { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
      );
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return NextResponse.json({ error: lastError, type: "FeatureCollection", features: [] }, { status: 502 });
}
