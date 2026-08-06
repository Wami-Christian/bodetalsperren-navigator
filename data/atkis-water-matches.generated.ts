// AUTO-GENERATED placeholder. Run: npm run import:atkis:test

export interface AtkisWaterMatch {
  status: "matched" | "review" | "unmatched";
  latitude?: number;
  longitude?: number;
  confidence?: number;
  method?: "official-name" | "locality-area";
  officialName?: string;
  officialFeatureId?: string;
  officialTypeName?: string;
  areaHa?: number;
  distanceKm?: number;
  source?: string;
  checkedAt?: string;
}

export const atkisWaterMatchIndex: Record<string, AtkisWaterMatch> = {};
