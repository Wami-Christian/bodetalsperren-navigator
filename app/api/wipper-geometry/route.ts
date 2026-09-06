import { getNamedWaterwayGeometry } from "@/lib/osm-waterway-geometry";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export async function GET() {
  return getNamedWaterwayGeometry({
    name: "Wipper",
    kind: "river",
    bounds: [51.7, 11.45, 51.84, 11.68],
    headerName: "X-HarzFishing-Wipper-Features"
  });
}
