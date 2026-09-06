import { getNamedWaterwayGeometry } from "@/lib/osm-waterway-geometry";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export async function GET() {
  return getNamedWaterwayGeometry({
    name: "Selke",
    kind: "river",
    bounds: [51.60, 10.90, 52.05, 11.55],
    headerName: "X-HarzFishing-Selke-Features"
  });
}
