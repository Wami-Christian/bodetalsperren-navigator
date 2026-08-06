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
      "Kartenposition ist ein vorhandener Arbeitsdatensatz und muss noch verifiziert werden."
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
      "Position aus zwei georeferenzierten Aufnahmen am Gondelteich Thale gemittelt.",
      "Der Punkt liegt am Gewässer; den exakten Kartenmittelpunkt noch prüfen."
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
      "Mittelpunkt des Schlossteichs Ballenstedt aus öffentlich dokumentierten Gewässerkoordinaten übernommen."
    ]
  }
};
