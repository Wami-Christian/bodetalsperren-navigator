import type { CatchEntry } from "@/lib/types";

const FAVORITES_KEY = "harzfishing:favorites";
const CATCHES_KEY = "harzfishing:catches";

export function loadFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]"); } catch { return []; }
}

export function saveFavorites(ids: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

export function loadCatches(): CatchEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CATCHES_KEY) ?? "[]"); } catch { return []; }
}

export function saveCatches(entries: CatchEntry[]) {
  localStorage.setItem(CATCHES_KEY, JSON.stringify(entries));
}
