import { getNamedWaterwayGeometry } from "@/lib/osm-waterway-geometry";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export async function GET() {
  return getNamedWaterwayGeometry({
    name: "Fuhne",
    kind: "river",
    bounds: [51.6, 11.72, 51.83, 12.05],
    headerName: "X-HarzFishing-Fuhne-Features"
  });
}
