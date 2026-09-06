import { getNamedWaterwayGeometry } from "@/lib/osm-waterway-geometry";

export const dynamic = "force-dynamic";

export const revalidate = 86400;

export async function GET() {
  return getNamedWaterwayGeometry({
    name: "Unstrut",
    kind: "river",
    bounds: [50.95, 10.9, 51.45, 11.9],
    headerName: "X-HarzFishing-Unstrut-Features"
  });
}
