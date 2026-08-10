import type { FishingWater } from "@/lib/types";
import { lavCatalog } from "./lav-catalog";
import { productionWaterCenterIndex } from "./water-centers.production.generated";
import { harzPremium } from "./harz-premium";
import { lavCoordinateIndex } from "./lav-coordinates.generated";
import { atkisWaterMatchIndex } from "./atkis-water-matches.generated";
import { bodetalsperrenPremium } from "./bodetalsperren-premium";
import { angelatlasLavSyncIndex } from "./angelatlas-lav-sync.generated";
import { finalUnmatchedPositionIndex } from "./final-unmatched-positions.generated";

const rappbodeParkings: FishingWater["parkings"] = [
  {
    id: "1",
    name: "Alte Rübeländer Straße – Beginn Betonstraße",
    latitude: 51.718578,
    longitude: 10.876041,
    access: "restricted",
    accuracy: "approx",
    note: "Eingeschränkte Zufahrt / Abstellpunkt"
  },
  {
    id: "2",
    name: "Alte Heerstraße – Waldkante",
    latitude: 51.715027,
    longitude: 10.860164,
    access: "restricted",
    accuracy: "approx",
    note: "Eingeschränkte Zufahrt / Abstellpunkt"
  },
  {
    id: "3",
    name: "Birkenallee",
    latitude: 51.702304,
    longitude: 10.84562,
    access: "restricted",
    accuracy: "approx",
    note: "Eingeschränkte Zufahrt / Abstellpunkt"
  },
  {
    id: "4",
    name: "Parkplatz am Rotestein",
    latitude: 51.729181,
    longitude: 10.880881,
    access: "public",
    accuracy: "verified",
    note: "Öffentlicher Parkplatz"
  },
  {
    id: "5",
    name: "Parkplatz Stemberghaus",
    latitude: 51.721871,
    longitude: 10.896238,
    access: "public",
    accuracy: "verified",
    note: "Öffentlicher Parkplatz"
  },
  {
    id: "6",
    name: "Parkplatz B81",
    latitude: 51.733332,
    longitude: 10.884947,
    access: "public",
    accuracy: "approx",
    note: "Öffentlicher Parkplatz"
  },
  {
    id: "7",
    name: "Parkplatz Rappbodetalsperre Ost",
    latitude: 51.742403,
    longitude: 10.88802,
    access: "public",
    accuracy: "verified",
    note: "Öffentlicher Parkplatz"
  },
  {
    id: "8",
    name: "Parkplatz Rappbodetalsperre Nord",
    latitude: 51.767209,
    longitude: 10.836927,
    access: "public",
    accuracy: "approx",
    note: "Öffentlicher Parkplatz"
  },
  {
    id: "9",
    name: "Waldparkplatz Rappbodetalsperre",
    latitude: 51.781315,
    longitude: 10.79682,
    access: "public",
    accuracy: "approx",
    note: "Öffentlicher Parkplatz"
  },
  {
    id: "10",
    name: "Alte Rübeländer Straße – Beginn Lange",
    latitude: 51.774641,
    longitude: 10.790456,
    access: "restricted",
    accuracy: "approx",
    note: "Eingeschränkte Zufahrt / Abstellpunkt"
  },
  {
    id: "11",
    name: "Königshütte – Zufahrt zur Staumauer",
    latitude: 51.788785,
    longitude: 10.721493,
    access: "restricted",
    accuracy: "approx",
    note: "Eingeschränkte Zufahrt / Abstellpunkt"
  },
  {
    id: "12",
    name: "Parkplatz an der Staumauer",
    latitude: 51.743033,
    longitude: 10.897782,
    access: "public",
    accuracy: "approx",
    note: "Öffentlicher Parkplatz"
  }
];

const rappbodeSpots: FishingWater["spots"] = [
  {
    id: "E1",
    name: "Rotestein – Ufererkundung West",
    latitude: 51.729404,
    longitude: 10.873333,
    parkingId: "4",
    tags: ["Erkundung"],
    source:
      "Aus FPG-Merkblattkarte näherungsweise am Ufer abgeleitet.",
    risk: "Steiles Gelände möglich; Zugang vor Ort prüfen."
  },
  {
    id: "E2",
    name: "Stemberghaus – Ufererkundung Nordwest",
    latitude: 51.733218,
    longitude: 10.87531,
    parkingId: "5",
    tags: ["Erkundung"],
    source:
      "Aus FPG-Merkblattkarte näherungsweise am Ufer abgeleitet.",
    risk: "Längerer Fußweg und steile Ufer möglich."
  },
  {
    id: "E3",
    name: "B81 – südliche Bucht",
    latitude: 51.738769,
    longitude: 10.87354,
    parkingId: "6",
    tags: ["Erkundung"],
    source:
      "Aus FPG-Merkblattkarte näherungsweise am Ufer abgeleitet.",
    risk: "Uferzugang und Schutzbereiche prüfen."
  },
  {
    id: "E4",
    name: "Rappbode Ost – Ufererkundung",
    latitude: 51.740823,
    longitude: 10.885714,
    parkingId: "7",
    tags: ["Erkundung"],
    source:
      "Aus FPG-Merkblattkarte näherungsweise am Ufer abgeleitet.",
    risk:
      "Nähe technischer Anlagen; Beschilderung besonders beachten."
  }
];

const featured: FishingWater[] = [
  {
    id: "rappbodetalsperre",
    name: "Rappbodetalsperre",
    module: "Bodetalsperren",
    type: "Talsperre",
    district: "Harz",
    latitude: 51.7376,
    longitude: 10.8914,
    fish: ["Zander", "Barsch", "Hecht"],
    rating: {
      Zander: 4,
      Barsch: 4,
      Hecht: 4
    },
    notes: [
      "Navigationsdaten aus Bodetalsperren Navigator übernommen.",
      "Erkundungspunkte sind keine amtlich freigegebenen Angelstellen."
    ],
    spots: [...rappbodeSpots],
    parkings: [...rappbodeParkings],
    sourceStatus: "verified"
  },
  {
    id: "vorsperre-rappbode-trautenstein",
    name: "Vorsperre Rappbode – Trautenstein",
    module: "Bodetalsperren",
    type: "Talsperre",
    district: "Harz",
    latitude: 51.705556,
    longitude: 10.794167,
    fish: [],
    rating: {},
    notes: [],
    spots: [],
    parkings: [],
    sourceStatus: "verified"
  },
  {
    id: "vorsperre-hassel-hasselfelde",
    name: "Vorsperre Hassel – Hasselfelde",
    module: "Bodetalsperren",
    type: "Talsperre",
    district: "Harz",
    latitude: 51.706111,
    longitude: 10.830278,
    fish: [],
    rating: {},
    notes: [],
    spots: [],
    parkings: [],
    sourceStatus: "verified"
  },
  {
    id: "ueberleitungssperre-koenigshuette",
    name: "Überleitungssperre Königshütte",
    module: "Bodetalsperren",
    type: "Talsperre",
    district: "Harz",
    latitude: 51.738611,
    longitude: 10.793333,
    fish: [],
    rating: {},
    notes: [],
    spots: [],
    parkings: [],
    sourceStatus: "verified"
  },
  {
    id: "hwr-kalte-bode-mandelholz",
    name: "HWR Kalte Bode – Mandelholz",
    module: "Bodetalsperren",
    type: "Talsperre",
    district: "Harz",
    latitude: 51.745556,
    longitude: 10.736389,
    fish: [],
    rating: {},
    notes: [],
    spots: [],
    parkings: [],
    sourceStatus: "verified"
  },
  {
    id: "wendefurther-talsperre",
    name: "Wendefurther Talsperre",
    module: "Bodetalsperren",
    type: "Talsperre",
    district: "Harz",
    latitude: 51.7385,
    longitude: 10.9255,
    fish: ["Barsch", "Hecht", "Karpfen"],
    rating: {
      Barsch: 4,
      Hecht: 4,
      Karpfen: 3
    },
    notes: [
      "Parkplatz und Uferpunkt aus der Vorversion übernommen; örtliche Sperrbereiche prüfen."
    ],
    spots: [
      {
        id: "E7",
        name: "Wendefurth – Ufer nahe Staumauer",
        latitude: 51.73627,
        longitude: 10.901098,
        parkingId: "12",
        tags: ["Erkundung"],
        risk: "Technische Sperrbereiche beachten."
      }
    ],
    parkings: [rappbodeParkings[11]],
    sourceStatus: "verified"
  },
  {
    id: "selke-meisdorf",
    name: "Selke bei Meisdorf",
    module: "Harzflüsse",
    type: "Fließgewässer",
    district: "Harz",
    latitude: 51.71,
    longitude: 11.298,
    fish: ["Forelle"],
    rating: {
      Forelle: 5
    },
    notes: [
      "Salmoniden-, Schon- und Sperrstrecken zwingend aktuell prüfen."
    ],
    spots: [],
    parkings: [],
    sourceStatus: "demo"
  }
];

const enrichedFeatured: FishingWater[] = featured.map((water) => {
  const premium = bodetalsperrenPremium[water.id];

  if (!premium) {
    return water;
  }

  return {
    ...water,
    ...premium,
    notes: premium.notes
      ? [...water.notes, ...premium.notes]
      : water.notes
  };
});

const featuredLavNumbers = new Set(
  featured
    .map((water) => water.lavNumber)
    .filter(Boolean)
);

const enrichedLavCatalog: FishingWater[] = lavCatalog.map((water) => {
  const angelatlas = angelatlasLavSyncIndex[water.id];
  const production = productionWaterCenterIndex[water.id];
  const finalRest = finalUnmatchedPositionIndex[water.id];
  const official = atkisWaterMatchIndex[water.id];
  const osm = lavCoordinateIndex[water.id];

  let enrichedWater: FishingWater = water;

  const protectedProduction =
    production?.status === "mapped" &&
    production.latitude != null &&
    production.longitude != null &&
    (production.sourceStatus === "verified" ||
      production.source === "premium-manual" ||
      production.source === "catalog-existing" ||
      production.source === "two-source-v6.2");

  if (protectedProduction) {
    enrichedWater = {
      ...enrichedWater,
      latitude: production.latitude!,
      longitude: production.longitude!,
      notes: [
        ...enrichedWater.notes,
        production.source === "two-source-v6.2"
          ? `Lage durch OSM + amtliche HY-P-Gewässergeometrie bestätigt${
              production.officialDistanceM != null
                ? ` (${Math.round(production.officialDistanceM)} m Abweichung)`
                : ""
            }.`
          : production.source === "premium-manual"
            ? "Manuell geprüfte Premium-Lage."
            : production.source === "catalog-existing"
              ? "Bereits vorhandene Kartenlage übernommen."
              : `Verifizierte Kartenlage aus ${production.source ?? "Datenabgleich"} beibehalten.`
      ]
    };
  } else if (
    angelatlas?.status === "matched" &&
    angelatlas.latitude != null &&
    angelatlas.longitude != null
  ) {
    enrichedWater = {
      ...enrichedWater,
      latitude: angelatlas.latitude,
      longitude: angelatlas.longitude,
      notes: [
        ...enrichedWater.notes,
        `Lage direkt über LAV-Nr. ${water.lavNumber ?? ""} aus Angelatlas Sachsen-Anhalt / GeoServer WFS zugeordnet${
          angelatlas.atlasName && angelatlas.atlasName !== water.name
            ? ` (Atlasname: ${angelatlas.atlasName})`
            : ""
        }.`
      ]
    };
  } else if (
    finalRest?.status === "secure" &&
    finalRest.latitude != null &&
    finalRest.longitude != null
  ) {
    enrichedWater = {
      ...enrichedWater,
      latitude: finalRest.latitude,
      longitude: finalRest.longitude,
      notes: [...enrichedWater.notes, `Finaler Restlauf: strenger Mehrquellen-Treffer (${Math.round((finalRest.confidence ?? 0) * 100)} %); automatisch übernommen.`]
    };
  } else if (
    production?.status === "mapped" &&
    production.latitude != null &&
    production.longitude != null
  ) {
    enrichedWater = {
      ...enrichedWater,
      latitude: production.latitude,
      longitude: production.longitude,
      notes: [
        ...enrichedWater.notes,
        `Bestehende unbestätigte Kartenlage aus ${production.source ?? "Datenabgleich"} als Fallback beibehalten.`
      ]
    };
  } else if (
    official?.status === "matched" &&
    official.latitude != null &&
    official.longitude != null
  ) {
    enrichedWater = {
      ...enrichedWater,
      latitude: official.latitude,
      longitude: official.longitude,
      notes: [
        ...enrichedWater.notes,
        `OSM-Mehrquellenabgleich (${Math.round(
          (official.confidence ?? 0) * 100
        )} %); Lage prüfen.`
      ]
    };
  } else if (
    osm?.status === "matched" &&
    osm.latitude != null &&
    osm.longitude != null
  ) {
    enrichedWater = {
      ...enrichedWater,
      latitude: osm.latitude,
      longitude: osm.longitude,
      notes: [
        ...enrichedWater.notes,
        `OSM/Nominatim-Zuordnung (${Math.round(
          (osm.confidence ?? 0) * 100
        )} %); Lage prüfen.`
      ]
    };
  }

  const premium = water.lavNumber
    ? harzPremium[water.lavNumber]
    : undefined;

  if (!premium) {
    return enrichedWater;
  }

  return {
    ...enrichedWater,
    latitude:
      premium.latitude !== undefined
        ? premium.latitude
        : enrichedWater.latitude,
    longitude:
      premium.longitude !== undefined
        ? premium.longitude
        : enrichedWater.longitude,
    parkings:
      premium.parkings !== undefined
        ? premium.parkings
        : enrichedWater.parkings,
    spots:
      premium.spots !== undefined
        ? premium.spots
        : enrichedWater.spots,
    notes: premium.notes
      ? [...enrichedWater.notes, ...premium.notes]
      : enrichedWater.notes,
    sourceStatus:
      premium.sourceStatus ?? enrichedWater.sourceStatus
  };
});

export const waters: FishingWater[] = [
  ...enrichedFeatured,
  ...enrichedLavCatalog.filter(
    (water) => !featuredLavNumbers.has(water.lavNumber)
  )
];