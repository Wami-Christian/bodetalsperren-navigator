import type { FishingWater, ForecastInputs } from "@/lib/types";

export function calculateFishingScore(water: FishingWater, input: ForecastInputs) {
  let score = (water.rating[input.fish] ?? 0) * 14;

  const isLowLight = input.hour <= 8 || input.hour >= 19;
  if (isLowLight && ["Zander", "Barsch", "Forelle", "Schleie"].includes(input.fish)) score += 12;
  if (input.windKmh >= 6 && input.windKmh <= 22) score += 8;
  if (input.windKmh > 30) score -= 12;
  if (input.pressureTrend === "falling") score += input.fish === "Zander" ? 10 : 5;
  if (input.pressureTrend === "rising") score -= input.fish === "Forelle" ? 2 : 5;
  if (input.cloudCover >= 60) score += 7;
  if (!water.fish.includes(input.fish)) score = 0;

  return Math.max(0, Math.min(100, Math.round(score)));
}
