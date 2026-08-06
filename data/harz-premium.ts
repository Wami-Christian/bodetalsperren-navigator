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
    sourceStatus: "demo",
    notes: [
      "Kartenposition ist ein Arbeitsdatensatz und muss noch verifiziert werden."
    ]
  },

  "5-340-21": {
    latitude: 51.717853,
    longitude: 11.261839,
    sourceStatus: "verified",
    notes: [
      "Gewässerlage wurde bereits geprüft."
    ]
  },

  "5-340-22": {
    latitude: 51.718202,
    longitude: 11.215973,
    sourceStatus: "verified",
    notes: [
      "Koordinaten wurden bereits recherchiert."
    ]
  }
};