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

/**
 * Harz Premium – Paket 1 MERGE
 *
 * WICHTIG:
 * - vorhandene kartierte Gewässer bleiben erhalten
 * - ungeklärte Koordinaten werden NICHT mit null überschrieben
 * - neue Paket-1-Informationen werden nur ergänzt
 */
export const harzPremium: Record<string, HarzPremiumData> = {
  "5-340-05": {
    latitude: 51.706389,
    longitude: 11.237222,
    sourceStatus: "verified",
    notes: [
      "Mittelpunkt des Kunstteichs Ballenstedt aus öffentlich dokumentierten Gewässerkoordinaten übernommen."
    ]
  },

  "5-340-07": {
    latitude: 51.713753,
    longitude: 11.215316,
    sourceStatus: "demo",
    notes: [
      "Position aus zwei nahe beieinanderliegenden, georeferenzierten Aufnahmen am Großen Dachsteich abgeleitet.",
      "Der Punkt liegt am Gewässer; den exakten Kartenmittelpunkt noch prüfen."
    ]
  },

  "5-340-08": {
    latitude: 51.829,
    longitude: 11.197,
    sourceStatus: "demo",
    notes: [
      "Kiesgrube bei Ditfurt, LAV 5-340-08, Fläche laut LAV-Katalog 32,05 ha.",
      "Kartenposition ist der bereits vorhandene Arbeitsdatensatz und muss weiter verifiziert werden.",
      "Noch kein Parkplatz belastbar einem legalen Angelzugang zugeordnet.",
      "Hotspots werden erst ergänzt, wenn Uferzugang und zulässige Angelbereiche sicher geprüft sind."
    ]
  },

  "5-340-10": {
    latitude: 51.707222,
    longitude: 11.174167,
    sourceStatus: "verified",
    notes: [
      "Mittelpunkt des Großen Siebersteinsteichs aus öffentlich dokumentierten Gewässerkoordinaten übernommen."
    ]
  },

  "5-340-11": {
    latitude: 51.718611,
    longitude: 11.195694,
    sourceStatus: "verified",
    notes: [
      "Mittelpunkt des Kleinen Siebersteinsteichs aus öffentlich dokumentierten Gewässerkoordinaten übernommen."
    ]
  },

  "5-340-14": {
    latitude: 51.758164,
    longitude: 11.030746,
    sourceStatus: "demo",
    notes: [
      "Gondelteich Thale, LAV 5-340-14, Fläche laut LAV-Katalog 1,93 ha.",
      "Vorhandene Kartenposition aus georeferenzierten Aufnahmen am Gondelteich übernommen und bewusst beibehalten.",
      "Der Punkt liegt am Gewässer; den exakten Kartenmittelpunkt weiter prüfen.",
      "Noch kein Parkplatz als sicherer Angelzugang belastbar verifiziert.",
      "Hotspots werden erst nach Prüfung der tatsächlich zulässigen Uferbereiche ergänzt."
    ]
  },

  "5-340-15": {
    latitude: 51.717342,
    longitude: 11.212517,
    sourceStatus: "demo",
    notes: [
      "Position aus einer georeferenzierten Aufnahme am Glockenteich abgeleitet.",
      "Der Punkt liegt am Gewässer; den exakten Kartenmittelpunkt noch prüfen."
    ]
  },

  "5-340-17": {
    sourceStatus: "catalog",
    notes: [
      "Kiessandtagebau Ditfurt I, LAV 5-340-17, Fläche laut LAV-Katalog 17,08 ha.",
      "Fischcodes laut Katalog: A, H, K, Pl, Ro, S, Z.",
      "Keine Koordinaten im Premium-Layer gesetzt: vorhandene ATKIS-/OSM-Zuordnungen bleiben dadurch erhalten.",
      "Parkplätze und Hotspots erst nach eindeutiger Abgrenzung von Ditfurt I und Ditfurt II ergänzen."
    ]
  },

  "5-340-18": {
    sourceStatus: "catalog",
    notes: [
      "Kiessandtagebau Ditfurt II, LAV 5-340-18, Fläche laut LAV-Katalog 18,57 ha.",
      "Fischcodes laut Katalog: A, H, K, Pl, Ro, S, Z.",
      "Keine Koordinaten im Premium-Layer gesetzt: vorhandene ATKIS-/OSM-Zuordnungen bleiben dadurch erhalten.",
      "Vor Nutzung aktuellen Gewässer- und Sperrstatus beim zuständigen Verein/LAV prüfen.",
      "Parkplätze und Hotspots erst nach eindeutiger Lage- und Zugangsprüfung ergänzen."
    ]
  },

  "5-340-19": {
    sourceStatus: "catalog",
    notes: [
      "Petersstichel Thale, LAV 5-340-19, Fläche laut LAV-Katalog 1,93 ha.",
      "Fischcodes laut Katalog: A, B, Bl, H, K, Pl.",
      "Keine Koordinaten im Premium-Layer gesetzt: vorhandene ATKIS-/OSM-Zuordnungen bleiben dadurch erhalten.",
      "Parkplätze und Hotspots erst nach eindeutiger Lage- und Zugangsprüfung ergänzen."
    ]
  },

  "5-340-20": {
    sourceStatus: "catalog",
    notes: [
      "Mühlgraben Thale, LAV 5-340-20, Fläche laut LAV-Katalog 0,25 ha.",
      "Bei diesem Fließgewässer ist ein einzelner Kartenpunkt nur eingeschränkt aussagekräftig.",
      "Keine Koordinaten im Premium-Layer gesetzt: vorhandene ATKIS-/OSM-Zuordnungen bleiben dadurch erhalten.",
      "Abschnittsgrenzen, legale Zugänge und mögliche Angelbeschränkungen vor Parkplatz-/Hotspot-Erfassung prüfen."
    ]
  },

  "5-340-21": {
    latitude: 51.717853,
    longitude: 11.261839,
    sourceStatus: "verified",
    notes: [
      "Gewässerlage des Dorfteichs Opperode wurde bereits geprüft."
    ]
  },

  "5-340-22": {
    latitude: 51.718202,
    longitude: 11.215973,
    sourceStatus: "verified",
    notes: [
      "Schlossteich Ballenstedt, LAV 5-340-22, Fläche laut LAV-Katalog 2,16 ha.",
      "Vorhandener, bereits bestätigter Mittelpunkt des Schlossteichs Ballenstedt wurde beibehalten.",
      "Vor anglerischer Nutzung aktuellen Gewässer- und Sperrstatus prüfen.",
      "Parkplätze und Hotspots werden erst ergänzt, wenn der legale Angelzugang eindeutig bestätigt ist."
    ]
  }
};
