import type { FishingWater } from "@/lib/types";

/**
 * Harz Premium – Paket 2.1
 * Thale / Quedlinburg / Ditfurt / Opperode / Halberstadt
 *
 * Datenstatus:
 * - verified: Lage aus belastbarer öffentlicher Quelle bestätigt
 * - demo: Lage ist ein klar gekennzeichneter Arbeitsdatensatz
 * - catalog: noch keine belastbare Kartenposition
 */
export const harzLavPremium: FishingWater[] = [
  {
    id: "5-340-08-kiesgrube-bei-dittfurt",
    name: "Kiesgrube bei Ditfurt",
    lavNumber: "5-340-08",
    module: "LAV Sachsen-Anhalt",
    type: "Kiesgrube",
    district: "Harz",
    latitude: 51.829,
    longitude: 11.197,
    fish: ["Barsch", "Hecht", "Karpfen"],
    fishCodes: ["A", "B", "Bl", "H", "K", "Pl"],
    areaHa: "32.05",
    rating: { Barsch: 3, Hecht: 3, Karpfen: 3 },
    notes: [
      "LAV-Gewässernummer 5-340-08, Fläche 32,05 ha.",
      "Die Kartenposition ist ein Arbeitsdatensatz; Gewässergrenze und Zugang vor Veröffentlichung prüfen."
    ],
    spots: [],
    parkings: [],
    sourceStatus: "demo"
  },
  {
    id: "5-340-17-kiessandtagebau-ditfurt-i",
    name: "Kiessandtagebau Ditfurt I",
    lavNumber: "5-340-17",
    module: "LAV Sachsen-Anhalt",
    type: "Kiesgrube",
    district: "Harz",
    latitude: null,
    longitude: null,
    fish: ["Hecht", "Karpfen", "Schleie", "Zander"],
    fishCodes: ["A", "H", "K", "Pl", "Ro", "S", "Z"],
    areaHa: "17.08",
    rating: { Hecht: 3, Karpfen: 3, Schleie: 3, Zander: 3 },
    notes: [
      "LAV-Katalogdatensatz bereinigt.",
      "Noch keine belastbar geprüfte Kartenposition gespeichert."
    ],
    spots: [],
    parkings: [],
    sourceStatus: "catalog"
  },
  {
    id: "5-340-18-kiessandtagebau-ditfurt-ii",
    name: "Kiessandtagebau Ditfurt II",
    lavNumber: "5-340-18",
    module: "LAV Sachsen-Anhalt",
    type: "Kiesgrube",
    district: "Harz",
    latitude: null,
    longitude: null,
    fish: ["Hecht", "Karpfen", "Schleie", "Zander"],
    fishCodes: ["A", "H", "K", "Pl", "Ro", "S", "Z"],
    areaHa: "18.57",
    rating: { Hecht: 3, Karpfen: 3, Schleie: 3, Zander: 3 },
    notes: [
      "LAV-Katalogdatensatz bereinigt.",
      "Noch keine belastbar geprüfte Kartenposition gespeichert."
    ],
    spots: [],
    parkings: [],
    sourceStatus: "catalog"
  },
  {
    id: "5-340-19-petersstichel-thale",
    name: "Petersstichel Thale",
    lavNumber: "5-340-19",
    module: "LAV Sachsen-Anhalt",
    type: "See",
    district: "Harz",
    latitude: null,
    longitude: null,
    fish: ["Barsch", "Hecht", "Karpfen"],
    fishCodes: ["A", "B", "Bl", "H", "K", "Pl"],
    areaHa: "1.93",
    rating: { Barsch: 3, Hecht: 3, Karpfen: 3 },
    notes: [
      "LAV-Katalogdatensatz bereinigt.",
      "Noch keine belastbar geprüfte Kartenposition gespeichert."
    ],
    spots: [],
    parkings: [],
    sourceStatus: "catalog"
  },
  {
    id: "5-340-20-muhlgraben-thale-0-25",
    name: "Mühlgraben Thale",
    lavNumber: "5-340-20",
    module: "LAV Sachsen-Anhalt",
    type: "Fließgewässer",
    district: "Harz",
    latitude: null,
    longitude: null,
    fish: [],
    fishCodes: [],
    areaHa: "0.25",
    rating: {},
    notes: [
      "Name und Fläche aus dem LAV-Katalogdatensatz bereinigt.",
      "Fischarten und genauer Gewässerabschnitt müssen noch gegen die aktuelle Gewässerordnung geprüft werden."
    ],
    spots: [],
    parkings: [],
    sourceStatus: "catalog"
  },
  {
    id: "5-340-21-dorfteich-opperode",
    name: "Dorfteich Opperode",
    lavNumber: "5-340-21",
    module: "LAV Sachsen-Anhalt",
    type: "Teich",
    district: "Harz",
    latitude: 51.717853,
    longitude: 11.261839,
    fish: ["Barsch"],
    fishCodes: ["B", "Pl", "Ro"],
    areaHa: "1.06",
    rating: { Barsch: 3 },
    notes: [
      "Gewässerlage und Fläche über öffentlich dokumentierte Orts- und Gewässerdaten bestätigt.",
      "Aktuelle LAV-Bestimmungen und örtliche Beschilderung bleiben maßgeblich."
    ],
    spots: [],
    parkings: [],
    sourceStatus: "verified"
  },
  {
    id: "5-190-08-halberstadter-see-ii",
    name: "Halberstädter See II",
    lavNumber: "5-190-08",
    module: "LAV Sachsen-Anhalt",
    type: "See",
    district: "Harz",
    latitude: null,
    longitude: null,
    fish: ["Barsch", "Hecht", "Karpfen", "Schleie", "Zander"],
    fishCodes: ["A", "B", "H", "K", "Pl", "S", "Z"],
    areaHa: "15.00",
    rating: { Barsch: 3, Hecht: 3, Karpfen: 3, Schleie: 3, Zander: 3 },
    notes: [
      "LAV-Katalogdatensatz bereinigt.",
      "Noch keine belastbar geprüfte Kartenposition gespeichert."
    ],
    spots: [],
    parkings: [],
    sourceStatus: "catalog"
  },
  {
    id: "5-190-06-groer-graben-vom-zusammenfluss",
    name: "Großer Graben vom Zusammenfluss",
    lavNumber: "5-190-06",
    module: "LAV Sachsen-Anhalt",
    type: "Fließgewässer",
    district: "Harz",
    latitude: null,
    longitude: null,
    fish: ["Hecht", "Schleie"],
    fishCodes: ["A", "H", "Pl", "S"],
    areaHa: "4.40",
    rating: { Hecht: 3, Schleie: 3 },
    notes: [
      "Abschnitt laut Katalog: Schiffgraben und Aue bis zur Straßenbrücke zwischen Aderstedt und Gunsleben.",
      "Noch keine belastbar geprüfte Kartenposition gespeichert."
    ],
    spots: [],
    parkings: [],
    sourceStatus: "catalog"
  }
,
{
  id: "5-340-22",
  lavNumber: "5-340-22",
  name: "Schlossteich Ballenstedt",
  module: "LAV Sachsen-Anhalt",
  district: "Harz",
  type: "Teich",
  latitude: 51.718202,
  longitude: 11.215973,
  fish: [],
  fishCodes: [],
  areaHa: "2.16",
  rating: {},
  notes: [
    "Koordinaten recherchiert.",
    "Fischarten und Parkplätze werden ergänzt."
  ],
  spots: [],
  parkings: [],
  sourceStatus: "verified"
},
{
  id: "5-340-14",
  lavNumber: "5-340-14",
  name: "Gondelteich Thale",
  module: "LAV Sachsen-Anhalt",
  district: "Harz",
  type: "Teich",
  latitude: 51.7481,
  longitude: 11.0417,
  fish: [],
  fishCodes: [],
  areaHa: "1.93",
  rating: {},
  notes: [
    "Koordinaten recherchiert.",
    "Weitere Daten folgen."
  ],
  spots: [],
  parkings: [],
  sourceStatus: "verified"
}
];
