import { getNamedWaterwayGeometry } from "@/lib/osm-waterway-geometry";

export const dynamic = "force-dynamic";

export const revalidate = 86400;

export async function GET() {
  return getNamedWaterwayGeometry({
    name: "Mulde",
    kind: "river",
    bounds: [51.4, 12.1, 52.05, 12.8],
    headerName: "X-HarzFishing-Mulde-Features"
  });
}
