import type { FishingWater } from "@/lib/types";

type ElbeOverlay = Pick<FishingWater, "route" | "bankSide" | "riverKm" | "restrictions" | "spots"> & {
  latitude: number;
  longitude: number;
};

// LAV Sachsen-Anhalt Gewässerverzeichnis 2022–2026.
// Die Route dient der Kartenorientierung; für die rechtliche Abgrenzung sind
// die im Gewässerverzeichnis genannten Fluss-km und Uferseiten maßgeblich.
export const elbeOverlayByLavNumber: Record<string, ElbeOverlay> = {
  "8-183-02": {
    latitude: 51.858, longitude: 12.348,
    bankSide: "left", riverKm: "244,5–248,3",
    restrictions: ["Nur linksseitig beangelbar."], spots: [],
    route: [[51.847,12.377],[51.852,12.365],[51.858,12.348],[51.864,12.331],[51.870,12.315]]
  },
  "6-400-22": {
    latitude: 52.000, longitude: 11.735,
    bankSide: "both", riverKm: "305–320",
    restrictions: [], spots: [],
    // Korrigierter Suchkorridor: km 305 bei Ranies -> Schönebeck -> Salbke (km 320).
    // Verifizierte Referenzen: Elbauenbrücke km 310,5 (~52.0239/11.7578),
    // alte Elbebrücke Schönebeck km 311,75 (~52.0247/11.7389).
    route: [[52.002,11.811],[52.007,11.797],[52.014,11.782],[52.0239,11.7578],[52.0247,11.7389],[52.032,11.720],[52.044,11.704],[52.058,11.690],[52.073,11.663]]
  },
  "13-280-23": {
    latitude: 52.138, longitude: 11.651,
    bankSide: "both", riverKm: "320–334",
    restrictions: [], spots: [],
    route: [[52.073,11.663],[52.094,11.660],[52.116,11.653],[52.139,11.648],[52.164,11.653],[52.189,11.658],[52.214,11.666]]
  },
  "4-130-18": {
    latitude: 52.250, longitude: 11.705,
    bankSide: "both", riverKm: "334–350",
    restrictions: ["Schleusen- und Betriebsbereiche sowie örtliche Beschilderung beachten."],
    spots: [{
      id: "niegripp-lock-orientation",
      name: "Schleuse Niegripp – Orientierung",
      latitude: 52.24915,
      longitude: 11.74046,
      tags: ["Orientierung", "Schleuse"],
      note: "Schleuse im Niegripper Verbindungskanal bei Kanal-km 0,68 – kein Angelplatz.",
      risk: "Sicherheits- und Betriebsbereich der Schleuse beachten."
    }],
    route: [[52.214,11.666],[52.228,11.680],[52.241,11.698],[52.249,11.714],[52.257,11.724],[52.269,11.731],[52.286,11.737],[52.305,11.744],[52.326,11.753]]
  },
  "2-421-11": {
    latitude: 52.474, longitude: 11.967,
    bankSide: "left", riverKm: "372,4–378",
    restrictions: ["Nur linksseitig beangelbar."], spots: [],
    route: [[52.441,11.930],[52.452,11.943],[52.463,11.957],[52.474,11.967],[52.486,11.974],[52.497,11.979]]
  },
  "4-171-14": {
    latitude: 52.474, longitude: 11.967,
    bankSide: "right", riverKm: "372,4–378",
    restrictions: ["Nur rechtsseitig beangelbar. Zusammen mit 2-421-11 ist dieser Elbabschnitt damit beidseitig im LAV-Gewässerfonds."], spots: [],
    route: [[52.441,11.930],[52.452,11.943],[52.463,11.957],[52.474,11.967],[52.486,11.974],[52.497,11.979]]
  },
  "2-422-12": {
    latitude: 52.548, longitude: 11.972,
    bankSide: "both", riverKm: "386–392",
    restrictions: ["Rechtsseitig zwischen Elb-km 391–392 Uferbetretungsverbot."], spots: [],
    route: [[52.523,11.968],[52.534,11.971],[52.545,11.974],[52.557,11.977],[52.569,11.979],[52.581,11.979]]
  },
  "2-420-08": {
    latitude: 52.624, longitude: 11.995,
    bankSide: "left", riverKm: "392–402",
    restrictions: ["Nur linksseitig beangelbar."], spots: [],
    route: [[52.581,11.979],[52.594,11.982],[52.608,11.987],[52.622,11.994],[52.638,11.999],[52.655,12.003]]
  },
  "2-220-18": {
    latitude: 52.865, longitude: 11.988,
    bankSide: "right", riverKm: "428–431",
    restrictions: ["Nur rechtsseitig beangelbar."], spots: [],
    route: [[52.846,12.002],[52.856,11.997],[52.866,11.990],[52.876,11.983]]
  },
  "2-330-14": {
    latitude: 52.968, longitude: 11.867,
    bankSide: "left", riverKm: "428–454",
    restrictions: ["Nur linksseitig beangelbar.", "Uferbetretungsverbot zwischen Elb-km 450,9–452."], spots: [],
    route: [[52.846,12.002],[52.866,11.990],[52.887,11.974],[52.908,11.958],[52.930,11.938],[52.950,11.914],[52.969,11.889],[52.987,11.862],[53.004,11.834],[53.019,11.808],[53.035,11.780]]
  }
};


export type ElbeRestrictionOverlay = {
  lavNumber: string;
  fromKm: number;
  toKm: number;
  bank: "left" | "right" | "both";
  label: string;
};

// Besondere Einschränkungen, die zusätzlich direkt auf der Elbe-Karte hervorgehoben werden.
export const elbeRestrictionOverlays: ElbeRestrictionOverlay[] = [
  {
    lavNumber: "2-422-12",
    fromKm: 391,
    toKm: 392,
    bank: "right",
    label: "Uferbetretungsverbot rechtsseitig zwischen Elb-km 391–392."
  },
  {
    lavNumber: "2-330-14",
    fromKm: 450.9,
    toKm: 452,
    bank: "left",
    label: "Uferbetretungsverbot zwischen Elb-km 450,9–452."
  }
];

export const elbeOrientationPoints = [
  {
    id: "niegripp-lock-orientation",
    lavNumber: "4-130-18",
    name: "Schleuse Niegripp",
    latitude: 52.24915,
    longitude: 11.74046,
    label: "Schleuse Niegripp – Orientierungspunkt, kein Angelplatz. Niegripper Verbindungskanal, Kanal-km 0,68. Sicherheits- und Betriebsbereich beachten."
  }
] as const;
