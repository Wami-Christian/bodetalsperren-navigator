import { getNamedWaterwayGeometry } from "@/lib/osm-waterway-geometry";

export const dynamic = "force-dynamic";

export const revalidate = 86400;

export async function GET() {
  return getNamedWaterwayGeometry({
    name: "Bode",
    kind: "river",
    bounds: [51.65, 10.7, 52.1, 11.9],
    headerName: "X-HarzFishing-Bode-Features"
  });
}
