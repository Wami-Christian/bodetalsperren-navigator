import type { Fish, FishingWater } from "@/lib/types";

export const lavFishCodeMap: Record<string, Fish> = {
  A: "Aal",
  B: "Barsch",
  Bl: "Blei",
  H: "Hecht",
  K: "Karpfen",
  Pl: "Plötze",
  Ro: "Rotfeder",
  S: "Schleie",
  Z: "Zander"
};

export function waterTargetFish(water: FishingWater): Fish[] {
  const fromCodes = (water.fishCodes ?? [])
    .map((code) => lavFishCodeMap[code])
    .filter((fish): fish is Fish => Boolean(fish));
  return Array.from(new Set<Fish>([...water.fish, ...fromCodes]));
}

export function waterHasTargetFish(water: FishingWater, fish: Fish): boolean {
  return waterTargetFish(water).includes(fish);
}

export function targetFishRating(water: FishingWater, fish: Fish): number {
  const existing = water.rating[fish];
  if (typeof existing === "number") return existing;
  return waterHasTargetFish(water, fish) ? 3 : 0;
}
