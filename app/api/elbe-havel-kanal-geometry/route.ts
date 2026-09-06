import { getNamedWaterwayGeometry } from "@/lib/osm-waterway-geometry";

export const dynamic = "force-dynamic";

export const revalidate = 86400;

export async function GET() {
  return getNamedWaterwayGeometry({
    name: "Elbe-Havel-Kanal",
    kind: "canal",
    bounds: [52.15, 11.6, 52.6, 12.6],
    headerName: "X-HarzFishing-EHK-Features"
  });
}
