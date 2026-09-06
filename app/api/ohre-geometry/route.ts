import { getNamedWaterwayGeometry } from "@/lib/osm-waterway-geometry";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export async function GET() {
  return getNamedWaterwayGeometry({
    name: "Ohre",
    kind: "river",
    bounds: [52.2, 10.9, 52.66, 11.82],
    headerName: "X-HarzFishing-Ohre-Features"
  });
}
