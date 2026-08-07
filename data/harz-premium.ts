import type { FishingWater } from "@/lib/types";

export type HarzPremiumData = Partial<
  Pick<
    FishingWater,
    | "latitude"
    | "longitude"
    | "parkings"
    | "spots"
    | "notes"
    | "sourceStatus"
  >
>;

export const harzPremium: Record<string, HarzPremiumData> = {
  "5-340-08": {
    latitude: 51.829,
    longitude: 11.197,
    parkings: [],
    spots: [],
    sourceStatus: "demo",
    notes: [
      "Kiesgrube bei Ditfurt, LAV 5-340-08, Fläche laut Katalog 32,05 ha.",
      "Die gespeicherte Kartenposition ist der bereits vorhandene Arbeitsdatensatz; Gewässergrenze vor endgültiger Freigabe weiter prüfen.",
      "Öffentliche Angelquellen führen Bootsangeln als nicht erlaubt und Nachtangeln als erlaubt; maßgeblich bleiben aktuelle LAV-/Vereinsbestimmungen.",
      "Noch kein Parkplatz belastbar einem legalen Zugang zugeordnet.",
      "Noch keine Hotspots eingetragen, weil Uferzugang und zulässige Angelbereiche zuerst sicher geprüft werden müssen."
    ]
  },

  "5-340-17": {
    latitude: null,
    longitude: null,
    parkings: [],
    spots: [],
    sourceStatus: "catalog",
    notes: [
      "Kiessandtagebau Ditfurt I, LAV 5-340-17, Fläche laut Katalog 17,08 ha.",
      "Der 1. Quedlinburger Angelverein führt das Gewässer mit den Fischcodes A, H, K, Pl, Ro, S, Z.",
      "Öffentliche Angelquellen führen Bootsangeln als nicht erlaubt und Nachtangeln als erlaubt; aktuelle örtliche Bestimmungen prüfen.",
      "Noch keine belastbar bestätigte Kartenposition gespeichert.",
      "Parkplätze und Hotspots bleiben leer, bis Gewässer I und II auf der Karte eindeutig voneinander abgegrenzt sind."
    ]
  },

  "5-340-18": {
    latitude: null,
    longitude: null,
    parkings: [],
    spots: [],
    sourceStatus: "catalog",
    notes: [
      "Kiessandtagebau Ditfurt II, LAV 5-340-18, Fläche laut Katalog 18,57 ha.",
      "Der 1. Quedlinburger Angelverein kennzeichnet dieses Gewässer aktuell ausdrücklich mit „GESPERRT!“. Vor Nutzung zwingend den aktuellen Status beim Verein/LAV prüfen.",
      "Fischcodes laut Vereinsübersicht: A, B, H, Pl, Ro, S, Z.",
      "Noch keine belastbar bestätigte Kartenposition gespeichert.",
      "Wegen des veröffentlichten Sperrhinweises werden bewusst keine Parkplätze oder Hotspots als Angelzugänge hinterlegt."
    ]
  },

  "5-340-19": {
    latitude: null,
    longitude: null,
    parkings: [],
    spots: [],
    sourceStatus: "catalog",
    notes: [
      "Petersstichel Thale, LAV 5-340-19.",
      "Eine öffentliche Gewässerquelle führt denselben Eintrag unter dem Namen „Ochsensumpfteich“ mit dem weiteren Namen „Petersstichel“ und derselben internen Gewässernummer 5-340-19.",
      "Die dort genannte Fläche von ca. 2,4 ha weicht vom LAV-Katalogwert 1,93 ha ab; in der App bleibt deshalb der LAV-Wert maßgeblich.",
      "Öffentliche Angelquellen führen Bootsangeln als nicht erlaubt und Nachtangeln als erlaubt; außerdem wird Landschaftsschutz genannt.",
      "Noch keine belastbar bestätigte Kartenposition gespeichert.",
      "Parkplätze und Hotspots erst nach eindeutiger Lage- und Zugangsprüfung ergänzen."
    ]
  },

  "5-340-20": {
    latitude: null,
    longitude: null,
    parkings: [],
    spots: [],
    sourceStatus: "catalog",
    notes: [
      "Mühlgraben in Thale, LAV 5-340-20, Fläche laut Katalog 0,25 ha.",
      "Der aktuelle Katalogdatensatz enthält keine belastbare Punktlage für den konkreten angelrechtlich relevanten Abschnitt.",
      "Bei einem Fließgewässer ist ein einzelner Mittelpunkt für die Navigation nur eingeschränkt sinnvoll; zuerst müssen Abschnittsgrenzen und zulässige Zugänge geklärt werden.",
      "Deshalb derzeit bewusst keine Parkplätze oder Hotspots eingetragen."
    ]
  },

  "5-340-14": {
    latitude: 51.75772,
    longitude: 11.0306,
    parkings: [],
    spots: [],
    sourceStatus: "verified",
    notes: [
      "Gondelteich Thale, LAV 5-340-14, Fläche laut Katalog 1,93 ha.",
      "Gewässerlage über OpenStreetMap-basierte öffentliche Kartendaten bestätigt (OSM way 5327967).",
      "Zusätzliche georeferenzierte Wikimedia-Aufnahmen liegen unmittelbar am Gewässer und stützen die Lagezuordnung.",
      "Der 1. Quedlinburger Angelverein führt die Fischcodes Bl, K, Pl, Ro, S.",
      "Öffentliche Angelquellen führen Bootsangeln als nicht erlaubt und Nachtangeln als erlaubt; aktuelle Bestimmungen bleiben maßgeblich.",
      "Noch kein Parkplatz als sicherer Angelzugang belastbar verifiziert.",
      "Hotspots werden erst nach Prüfung der tatsächlich zulässigen Uferbereiche ergänzt."
    ]
  },

  "5-340-22": {
    latitude: 51.718202,
    longitude: 11.215973,
    parkings: [],
    spots: [],
    sourceStatus: "verified",
    notes: [
      "Schlossteich Ballenstedt, LAV 5-340-22, Fläche laut Katalog 2,16 ha.",
      "Gewässerlage öffentlich eindeutig bestätigt; der Teich liegt im Schlosspark westlich des Schlosses Ballenstedt.",
      "Der 1. Quedlinburger Angelverein kennzeichnet den Schlossteich aktuell ausdrücklich mit „GESPERRT!“. Vor jeder anglerischen Nutzung zwingend aktuellen Status prüfen.",
      "Fischcodes laut Vereinsübersicht: A, B, Bl, H, K, Pl.",
      "Wegen des veröffentlichten Sperrhinweises werden derzeit bewusst keine Parkplätze oder Hotspots als Angelzugänge hinterlegt."
    ]
  }
};
