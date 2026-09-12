import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const USER_AGENT = "WamiFishing-Navigator/5.2 (Ortssuche im Angelatlas)";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const latParam = request.nextUrl.searchParams.get("lat");
  const lonParam = request.nextUrl.searchParams.get("lon");

  // GPS-Schalter: aktuellen Standort auf den nächstgelegenen Ort zurückführen.
  if (latParam && lonParam) {
    const latitude = Number(latParam);
    const longitude = Number(lonParam);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Ungültige Standortkoordinaten." }, { status: 400 });
    }

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("zoom", "14");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "de");

    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Standortdienst nicht erreichbar." }, { status: 502 });
    }

    const result = await response.json() as {
      display_name?: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        hamlet?: string;
        suburb?: string;
        county?: string;
      };
    };

    const address = result.address ?? {};
    const label =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.hamlet ||
      address.suburb ||
      address.county ||
      result.display_name?.split(",")[0] ||
      "Aktueller Standort";

    return NextResponse.json(
      { latitude, longitude, label },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!query) {
    return NextResponse.json({ error: "Suchbegriff fehlt." }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${query}, Sachsen-Anhalt, Deutschland`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set("accept-language", "de");

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 86400 }
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Geocoding-Dienst nicht erreichbar." }, { status: 502 });
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  const first = results[0];

  if (!first) {
    return NextResponse.json({ error: "Ort nicht gefunden." }, { status: 404 });
  }

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "Ungültiges Geocoding-Ergebnis." }, { status: 502 });
  }

  return NextResponse.json(
    {
      latitude,
      longitude,
      label: first.display_name.split(",")[0] || query
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"
      }
    }
  );
}
