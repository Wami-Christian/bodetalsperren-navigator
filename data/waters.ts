import type { FishingWater } from "@/lib/types";

// DEMODATEN: Koordinaten, Gewässernummern, Fischbestände, Zugänge und Bestimmungen
// vor Veröffentlichung immer mit Angelatlas, Gewässerverzeichnis, aktuellen LAV-
// Ergänzungen, Beschilderung und dem zuständigen Verein abgleichen.
export const waters: FishingWater[] = [
  {
    id: "rappbodetalsperre",
    name: "Rappbodetalsperre",
    module: "Bodetalsperren",
    type: "Talsperre",
    district: "Harz",
    latitude: 51.7376,
    longitude: 10.8914,
    fish: ["Zander", "Barsch", "Hecht"],
    rating: { Zander: 4, Barsch: 4, Hecht: 4 },
    notes: ["Demodatensatz", "Zulässige Angelbereiche und Sonderregeln vor Ort prüfen"],
    spots: [
      { id: "rappbode-1", name: "Beispielpunkt Nordufer", latitude: 51.744, longitude: 10.901, tags: ["Kante", "Abend"], note: "Nur struktureller Beispielpunkt." }
    ],
    sourceStatus: "demo"
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
    rating: { Barsch: 4, Hecht: 4, Karpfen: 3 },
    notes: ["Demodatensatz", "Parken, Uferzugang und Bootsregeln amtlich prüfen"],
    spots: [],
    sourceStatus: "demo"
  },
  {
    id: "kunstteich-ballenstedt",
    name: "Kunstteich Ballenstedt",
    module: "LAV Sachsen-Anhalt",
    type: "Teich",
    district: "Harz",
    latitude: 51.704,
    longitude: 11.215,
    fish: ["Zander", "Barsch", "Schleie"],
    rating: { Zander: 4, Barsch: 4, Schleie: 4 },
    notes: ["Demodatensatz", "Gewässernummer, Bestand und Bestimmungen offiziell prüfen"],
    spots: [
      { id: "kunst-1", name: "Beispiel: Tiefenkante", latitude: 51.7047, longitude: 11.2142, tags: ["Zander", "Dämmerung"], note: "Nicht als amtlicher oder garantierter Hotspot verstehen." },
      { id: "kunst-2", name: "Beispiel: Krautkante", latitude: 51.7034, longitude: 11.2162, tags: ["Schleie", "Morgen"] }
    ],
    sourceStatus: "demo"
  },
  {
    id: "selke-meisdorf",
    name: "Selke bei Meisdorf",
    module: "Harzflüsse",
    type: "Fließgewässer",
    district: "Harz",
    latitude: 51.710,
    longitude: 11.298,
    fish: ["Forelle"],
    rating: { Forelle: 5 },
    notes: ["Demodatensatz", "Salmoniden-, Schon- und Sperrstrecken zwingend prüfen"],
    spots: [
      { id: "selke-1", name: "Beispiel: Außenkurve", latitude: 51.7112, longitude: 11.296, tags: ["Forelle", "Gumpen"] }
    ],
    sourceStatus: "demo"
  },
  {
    id: "ditfurter-kiessee",
    name: "Ditfurter Kiessee",
    module: "LAV Sachsen-Anhalt",
    type: "Kiesgrube",
    district: "Harz",
    latitude: 51.829,
    longitude: 11.197,
    fish: ["Zander", "Barsch"],
    rating: { Zander: 5, Barsch: 4 },
    notes: ["Demodatensatz", "Exakte Gewässerzuordnung, Grenzen und Zugang prüfen"],
    spots: [
      { id: "ditfurt-1", name: "Beispiel: Windseite", latitude: 51.8301, longitude: 11.1957, tags: ["Zander", "Wind"] }
    ],
    sourceStatus: "demo"
  },
  {
    id: "siebersteinteich",
    name: "Großer Siebersteinteich",
    module: "LAV Sachsen-Anhalt",
    type: "Teich",
    district: "Harz",
    latitude: 51.690,
    longitude: 11.165,
    fish: ["Schleie", "Barsch"],
    rating: { Schleie: 4, Barsch: 3 },
    notes: ["Demodatensatz", "Ufer-, Natur- und Schutzregeln prüfen"],
    spots: [],
    sourceStatus: "demo"
  }
];
