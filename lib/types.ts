export type Fish = "Zander" | "Barsch" | "Forelle" | "Schleie" | "Hecht" | "Karpfen";
export type WaterType = "Talsperre" | "See" | "Teich" | "Fließgewässer" | "Kiesgrube";
export type WaterModule = "Bodetalsperren" | "LAV Sachsen-Anhalt" | "Harzflüsse";
export type SourceStatus = "demo" | "verified";

export interface FishingSpot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  tags: string[];
  note?: string;
}

export interface FishingWater {
  id: string;
  name: string;
  lavNumber?: string;
  module: WaterModule;
  type: WaterType;
  district: string;
  latitude: number;
  longitude: number;
  fish: Fish[];
  rating: Partial<Record<Fish, number>>;
  notes: string[];
  spots: FishingSpot[];
  sourceStatus: SourceStatus;
}

export interface CatchEntry {
  id: string;
  caughtAt: string;
  waterId: string;
  fish: Fish;
  lengthCm?: number;
  weightKg?: number;
  lure: string;
  note: string;
}

export interface ForecastInputs {
  fish: Fish;
  hour: number;
  windKmh: number;
  pressureTrend: "falling" | "steady" | "rising";
  cloudCover: number;
}
