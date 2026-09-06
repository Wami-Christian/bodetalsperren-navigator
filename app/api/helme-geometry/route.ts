import { getNamedWaterwayGeometry } from "@/lib/osm-waterway-geometry";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

export async function GET() {
  return getNamedWaterwayGeometry({
    name: "Helme",
    kind: "river",
    bounds: [51.36, 10.98, 51.48, 11.4],
    headerName: "X-HarzFishing-Helme-Features"
  });
}
