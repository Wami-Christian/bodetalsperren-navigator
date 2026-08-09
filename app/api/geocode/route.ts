import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Suchbegriff fehlt." },
      { status: 400 }
    );
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${query}, Sachsen-Anhalt, Deutschland`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set("accept-language", "de");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "HarzFishing-Navigator/5.2 (Ortssuche im Angelatlas)",
      Accept: "application/json"
    },
    next: {
      revalidate: 86400
    }
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Geocoding-Dienst nicht erreichbar." },
      { status: 502 }
    );
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  const first = results[0];

  if (!first) {
    return NextResponse.json(
      { error: "Ort nicht gefunden." },
      { status: 404 }
    );
  }

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { error: "Ungültiges Geocoding-Ergebnis." },
      { status: 502 }
    );
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
