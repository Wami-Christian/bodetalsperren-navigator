export type Fish = "Aal" | "Barsch" | "Blei" | "Forelle" | "Hecht" | "Karpfen" | "Plötze" | "Rotfeder" | "Schleie" | "Zander";
export type WaterType = "Talsperre" | "See" | "Teich" | "Fließgewässer" | "Kiesgrube";
export type WaterModule = "Bodetalsperren" | "LAV Sachsen-Anhalt" | "Harzflüsse";
export type SourceStatus = "demo" | "verified" | "catalog";

export interface ParkingSpot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  access: "public" | "restricted";
  accuracy: "verified" | "approx";
  note?: string;
}

export interface FishingSpot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  tags: string[];
  note?: string;
  parkingId?: string;
  source?: string;
  risk?: string;
}

export interface FishingWater {
  id: string;
  name: string;
  lavNumber?: string;
  module: WaterModule;
  type: WaterType;
  district: string;
  latitude: number | null;
  longitude: number | null;
  fish: Fish[];
  fishCodes?: string[];
  areaHa?: string | null;
  rating: Partial<Record<Fish, number>>;
  notes: string[];
  spots: FishingSpot[];
  parkings: ParkingSpot[];
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
