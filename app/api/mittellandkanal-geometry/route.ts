import { getNamedWaterwayGeometry } from "@/lib/osm-waterway-geometry";

export const dynamic = "force-dynamic";

export const revalidate = 86400;

export async function GET() {
  return getNamedWaterwayGeometry({
    name: "Mittellandkanal",
    kind: "canal",
    bounds: [52.1, 10.4, 52.55, 12.1],
    headerName: "X-HarzFishing-MLK-Features"
  });
}
