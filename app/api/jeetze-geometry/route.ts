import { getNamedWaterwayGeometry } from "@/lib/osm-waterway-geometry";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export async function GET() {
  return getNamedWaterwayGeometry({
    name: "Jeetze",
    kind: "river",
    bounds: [52.74, 11.02, 53.02, 11.3],
    headerName: "X-HarzFishing-Jeetze-Features"
  });
}
