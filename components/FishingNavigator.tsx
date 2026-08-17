"use client";

import dynamic from "next/dynamic";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { waters } from "@/data/waters";
import { catchActivity } from "@/data/catch-activity";
import catchEventsRaw from "@/data/catch-events.json";
import { calculateAutomaticFishingScore, type ForecastHour, type ScoreResult } from "@/lib/forecast";
import { targetFishRating, waterHasTargetFish, waterTargetFish } from "@/lib/fish";
import { parseGpx, spotsToGpx } from "@/lib/gpx";
import { loadCatches, loadFavorites, saveCatches, saveFavorites } from "@/lib/storage";
import type { CatchEntry, Fish, FishingSpot, FishingWater, WaterModule } from "@/lib/types";

const MapView = dynamic(() => import("./MapView"), { ssr: false });
const fishOptions: Array<Fish | "Alle"> = ["Alle", "Aal", "Barsch", "Blei", "Forelle", "Hecht", "Karpfen", "Plötze", "Rotfeder", "Schleie", "Zander"];
const moduleOptions: Array<WaterModule | "Alle"> = ["Alle", "Bodetalsperren", "LAV Sachsen-Anhalt", "Harzflüsse"];
type View =
  | "dashboard"
  | "waters"
  | "atlas"
  | "forecast"
  | "diary"
  | "settings";

type AtlasCategory =
  | "all"
  | "reservoirs"
  | "rivers"
  | "lakes"
  | "parking"
  | "favorites";


type AtlasPlace = {
  latitude: number;
  longitude: number;
  label: string;
};


type CatchWeatherSnapshot = {
  temperature: number;
  pressure: number;
  windSpeed: number;
  windDirection?: number;
  cloudCover: number;
  precipitation?: number;
};

type EnhancedCatchEntry = CatchEntry & {
  latitude?: number;
  longitude?: number;
  locationAccuracyM?: number;
  locationSource?: "gps" | "manual";
  weather?: CatchWeatherSnapshot;
  moonPhase?: string;
  moonIllumination?: number;
  method?: string;
  depthM?: number;
};

function windDirectionLabel(degrees?: number | null) {
  if (degrees == null || !Number.isFinite(degrees)) return "–";
  const directions = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

function windDirectionArrow(degrees?: number | null) {
  if (degrees == null || !Number.isFinite(degrees)) return "";
  const arrows = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];
  return arrows[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

function windDisplay(degrees?: number | null) {
  const label = windDirectionLabel(degrees);
  if (label === "–") return label;
  return `${label} ${windDirectionArrow(degrees)}`;
}

function moonInfoFor(date: Date) {
  const synodicMonth = 29.530588853;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const days = (date.getTime() - knownNewMoon) / 86400000;
  const phase = ((days / synodicMonth) % 1 + 1) % 1;
  const illumination = Math.round(((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100);
  const names = ["Neumond", "Zunehmende Sichel", "Erstes Viertel", "Zunehmender Mond", "Vollmond", "Abnehmender Mond", "Letztes Viertel", "Abnehmende Sichel"];
  const index = Math.round(phase * 8) % 8;
  return { phase: names[index], illumination };
}

const ATLAS_RADIUS_KM = 20;

function distanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(latitudeB - latitudeA);
  const dLon = toRad(longitudeB - longitudeA);
  const lat1 = toRad(latitudeA);
  const lat2 = toRad(latitudeB);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function FishingNavigator() {
  const mainNavRef = useRef<HTMLElement | null>(null);
  const atlasCategoryRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [fish, setFish] = useState<Fish | "Alle">("Alle");
  const [module, setModule] = useState<WaterModule | "Alle">("Alle");
  const [query, setQuery] = useState("");
  const [waterPlace, setWaterPlace] = useState<AtlasPlace | null>(null);
  const [waterSearchBusy, setWaterSearchBusy] = useState(false);
  const [waterSearchError, setWaterSearchError] = useState("");
const [regionFilter, setRegionFilter] =
  useState<"all" | "harz">("harz");
const [atlasQuery, setAtlasQuery] = useState("");
const [atlasFish, setAtlasFish] = useState<Fish | "Alle">("Alle");
const [atlasPlace, setAtlasPlace] = useState<AtlasPlace | null>(null);
const [atlasSearchBusy, setAtlasSearchBusy] = useState(false);
const [atlasSearchError, setAtlasSearchError] = useState("");
const [atlasCategory, setAtlasCategory] =
  useState<AtlasCategory>("all");
  const [selected, setSelected] = useState<FishingWater>(waters[0]);
  const [focusedWaterId, setFocusedWaterId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [catches, setCatches] = useState<EnhancedCatchEntry[]>([]);
  const [catchWaterId, setCatchWaterId] = useState("");
  const [catchPosition, setCatchPosition] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [catchWeather, setCatchWeather] = useState<CatchWeatherSnapshot | null>(null);
  const [catchAutoBusy, setCatchAutoBusy] = useState(false);
  const [catchAutoAttempted, setCatchAutoAttempted] = useState(false);
  const [catchAutoError, setCatchAutoError] = useState("");
  const [importedSpots, setImportedSpots] = useState<FishingSpot[]>([]);
  const [forecastFish, setForecastFish] = useState<Fish>("Zander");
  const [forecastQuery, setForecastQuery] = useState("");
  const [forecastPlace, setForecastPlace] = useState<AtlasPlace | null>(null);
  const [forecastBusy, setForecastBusy] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [forecastHours, setForecastHours] = useState<ForecastHour[]>([]);
  const [forecastDate, setForecastDate] = useState("");
  const [forecastSort, setForecastSort] = useState<"score" | "distance" | "name">("score");
  const [showAllForecast, setShowAllForecast] = useState(false);

  useEffect(() => { setFavorites(loadFavorites()); setCatches(loadCatches() as EnhancedCatchEntry[]); }, []);

  useEffect(() => {
    const nav = mainNavRef.current;
    if (!nav) return;

    const active = nav.querySelector<HTMLButtonElement>("button.active");
    if (!active) return;

    window.requestAnimationFrame(() => {
      active.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center"
      });
    });
  }, [view]);

  const filtered = useMemo(() => waters
    .filter((water) => {
      if (!waterPlace) return true;
      if (water.latitude === null || water.longitude === null) return false;
      return distanceKm(waterPlace.latitude, waterPlace.longitude, water.latitude, water.longitude) <= 20;
    })
    .filter((water) => fish === "Alle" || waterHasTargetFish(water, fish))
    .sort((a, b) => {
      if (waterPlace && a.latitude !== null && a.longitude !== null && b.latitude !== null && b.longitude !== null) {
        return distanceKm(waterPlace.latitude, waterPlace.longitude, a.latitude, a.longitude) -
          distanceKm(waterPlace.latitude, waterPlace.longitude, b.latitude, b.longitude);
      }
      return fish === "Alle"
        ? a.name.localeCompare(b.name, "de")
        : (b.rating[fish] ?? 0) - (a.rating[fish] ?? 0);
    }),
    [fish, waterPlace]);

  // Gewässeransicht: Nach einer neuen Filterung automatisch den ersten Treffer
  // im Profil anzeigen. Die Karte bleibt dabei in der Trefferübersicht.
  useEffect(() => {
    if (view !== "waters") return;

    const firstWater = filtered[0];
    if (!firstWater) {
      setFocusedWaterId(null);
      return;
    }

    setSelected(firstWater);
    setFocusedWaterId(null);
  }, [view, waterPlace, fish, filtered]);

  async function searchWatersPlace() {
    const term = query.trim();
    if (!term) return;
    setWaterSearchBusy(true);
    setWaterSearchError("");
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`);
      if (!response.ok) throw new Error("Ort nicht gefunden");
      const result = await response.json() as AtlasPlace;
      if (typeof result.latitude !== "number" || typeof result.longitude !== "number") throw new Error("Ort nicht gefunden");
      setWaterPlace(result);
      setFocusedWaterId(null);
    } catch (error) {
      setWaterSearchError(error instanceof Error ? error.message : "Ortssuche fehlgeschlagen");
    } finally {
      setWaterSearchBusy(false);
    }
  }

  function resetWatersFilters() {
    setQuery("");
    setWaterPlace(null);
    setFish("Alle");
    setWaterSearchError("");
    setFocusedWaterId(null);
  }

const atlasWaters = useMemo(() => {
  return waters
    .filter((water) => {
      if (!atlasPlace) return true;
      if (water.latitude === null || water.longitude === null) return false;
      return distanceKm(atlasPlace.latitude, atlasPlace.longitude, water.latitude, water.longitude) <= ATLAS_RADIUS_KM;
    })
    .filter((water) => atlasFish === "Alle" || waterHasTargetFish(water, atlasFish))
    .sort((a, b) => {
      if (atlasPlace && a.latitude !== null && a.longitude !== null && b.latitude !== null && b.longitude !== null) {
        return distanceKm(atlasPlace.latitude, atlasPlace.longitude, a.latitude, a.longitude) -
          distanceKm(atlasPlace.latitude, atlasPlace.longitude, b.latitude, b.longitude);
      }
      return atlasFish === "Alle"
        ? a.name.localeCompare(b.name, "de")
        : (b.rating[atlasFish] ?? 0) - (a.rating[atlasFish] ?? 0);
    });
}, [atlasPlace, atlasFish]);

  useEffect(() => {
    if (view !== "atlas") return;

    const currentStillVisible = atlasWaters.some(
      (water) => water.id === selected.id
    );

    if (currentStillVisible) return;

    const firstMapped =
      atlasWaters.find(
        (water) =>
          water.latitude !== null &&
          water.longitude !== null
      ) ?? atlasWaters[0];

    if (!firstMapped) {
      setFocusedWaterId(null);
      return;
    }

    setSelected(firstMapped);
    setFocusedWaterId(
      firstMapped.latitude !== null &&
      firstMapped.longitude !== null
        ? firstMapped.id
        : null
    );
  }, [atlasWaters, selected.id, view]);

  async function searchAtlasPlace() {
    const term = atlasQuery.trim();
    if (!term) return;

    setAtlasSearchBusy(true);
    setAtlasSearchError("");

    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`);
      if (!response.ok) throw new Error("Ort nicht gefunden");

      const result = await response.json() as AtlasPlace;
      if (typeof result.latitude !== "number" || typeof result.longitude !== "number") {
        throw new Error("Ort nicht gefunden");
      }

      setAtlasPlace({
        latitude: result.latitude,
        longitude: result.longitude,
        label: result.label || term
      });
      setFocusedWaterId(null);
    } catch (error) {
      setAtlasPlace(null);
      setFocusedWaterId(null);
      setAtlasSearchError(error instanceof Error ? error.message : "Ortssuche fehlgeschlagen");
    } finally {
      setAtlasSearchBusy(false);
    }
  }

  function resetAtlasFilters() {
    setAtlasQuery("");
    setAtlasPlace(null);
    setAtlasFish("Alle");
    setAtlasSearchError("");
    setFocusedWaterId(null);
  }

  const forecastWaters = useMemo(() => {
    if (!forecastPlace) return [];
    return waters.filter((water) =>
      water.latitude !== null && water.longitude !== null &&
      waterHasTargetFish(water, forecastFish) &&
      distanceKm(forecastPlace.latitude, forecastPlace.longitude, water.latitude, water.longitude) <= 20
    );
  }, [forecastPlace, forecastFish]);

  const forecastDates = useMemo(() => Array.from(new Set(forecastHours.map((hour) => hour.time.slice(0, 10)))), [forecastHours]);
  const selectedForecastHours = useMemo(() => forecastDate ? forecastHours.filter((hour) => hour.time.startsWith(forecastDate)) : [], [forecastHours, forecastDate]);

  const ranked = useMemo(() => forecastWaters.map((water) => {
    const distance = distanceKm(forecastPlace!.latitude, forecastPlace!.longitude, water.latitude!, water.longitude!);
    const scored = selectedForecastHours.map((hour) => ({ hour, result: calculateAutomaticFishingScore(water, forecastFish, hour) }));
    const best = scored.sort((a,b) => b.result.score-a.result.score)[0];
    return { water, distance, best };
  }).filter(item => item.best).sort((a,b) => b.best.result.score-a.best.result.score), [forecastWaters, selectedForecastHours, forecastFish, forecastPlace]);

  const sortedForecast = useMemo(() => {
    const next = [...ranked];
    if (forecastSort === "distance") return next.sort((a,b) => a.distance-b.distance);
    if (forecastSort === "name") return next.sort((a,b) => a.water.name.localeCompare(b.water.name, "de"));
    return next.sort((a,b) => b.best.result.score-a.best.result.score);
  }, [ranked, forecastSort]);

  const activityFor = (water: FishingWater) => catchActivity.find((item) => item.species === forecastFish && item.lavNumber === water.lavNumber);

  const activityEvidenceFor = (water: FishingWater) => {
    const direct = activityFor(water);
    const nearby = catchActivity
      .filter((item) => item.species === forecastFish && item.lavNumber !== water.lavNumber)
      .map((item) => {
        const activityWater = waters.find((candidate) => candidate.lavNumber === item.lavNumber);
        if (activityWater?.latitude == null || activityWater.longitude == null || water.latitude == null || water.longitude == null) return null;
        const km = distanceKm(water.latitude, water.longitude, activityWater.latitude, activityWater.longitude);
        if (km > 20) return null;
        return { ...item, km, matchedWaterName: activityWater.name };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a,b) => a.km-b.km);
    const nearbyByLav = Array.from(new Map(nearby.map((item) => [item.lavNumber, item])).values());
    return { direct, nearbyCount: nearbyByLav.length, nearby: nearbyByLav };
  };

  const ActivityDiagnostic = ({ water, compact = false }: { water: FishingWater; compact?: boolean }) => {
    const [open, setOpen] = useState(false);
    const activityEvidence = activityEvidenceFor(water);

    useEffect(() => {
      if (!open) return;
      const oldOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") setOpen(false);
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = oldOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [open]);

    const modal = open && typeof document !== "undefined"
      ? createPortal(
          <div className="forecast-activity-modal-backdrop" onClick={() => setOpen(false)}>
            <div className="forecast-activity-modal" role="dialog" aria-modal="true" aria-label={`Dokumentierte ${forecastFish}aktivität im 20-km-Umkreis`} onClick={(event) => event.stopPropagation()}>
              <button type="button" className="forecast-activity-close" aria-label="Fanginfo schließen" onClick={() => setOpen(false)}>×</button>
              <h3>Dokumentierte {forecastFish}aktivität<br />im 20-km-Umkreis</h3>
              <div className="forecast-activity-direct-check">Aktuelles Gewässer: <strong>{activityEvidence.direct ? `${activityEvidence.direct.activityLabel} · ${activityEvidence.direct.lavNumber}` : `kein direkter LAV-Treffer · ${water.lavNumber ?? "ohne LAV-Nr."}`}</strong></div>
              <b className="forecast-activity-count">{activityEvidence.nearby.length} Gewässer im Umkreis</b>
              {activityEvidence.nearby.length ? <ul className="forecast-activity-modal-list">{activityEvidence.nearby.map((item) => <li key={`${water.id}-${item.lavNumber}`}>
                <span><strong>{item.matchedWaterName || item.waterName}</strong><small>{item.lavNumber} · {item.activityLabel}</small></span>
                <b>{item.km.toFixed(1)} km</b>
              </li>)}</ul> : <p>Keine dokumentierten Fangaktivitäts-Gewässer innerhalb von 20 km.</p>}
              <div className="forecast-activity-note"><span>ⓘ</span><small>Diagnose: Distanz wird von diesem Kandidaten aus berechnet. Qualitätsklasse E, kein Score-Einfluss.</small></div>
            </div>
          </div>, document.body)
      : null;

    return <>
      <span className={`forecast-activity-diagnostic${compact ? " compact" : ""}`} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="forecast-activity-info-button" aria-label="Fangaktivitäts-Treffer im Umkreis anzeigen" title="Fangaktivitäts-Treffer im Umkreis anzeigen" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true); }}>i</button>
      </span>
      {modal}
    </>;
  };

  type EvidenceEvent = {
    species?: string; waterName?: string | null; lavNumber?: string | null; latitude?: number | null; longitude?: number | null;
    caughtAt?: string | null; timePrecision?: string | null; confidence?: number | null; notes?: string | null;
    source?: { provider?: string | null };
    weather?: { temperatureC?: number | null; pressureHpa?: number | null; windKmh?: number | null; cloudCoverPct?: number | null } | null;
  };
  const catchEvents = catchEventsRaw as EvidenceEvent[];

  const evidenceFor = (water: FishingWater, hour: ForecastHour) => {
    const eligible = catchEvents.filter((event) =>
      event.species === forecastFish &&
      event.weather &&
      event.caughtAt &&
      (event.confidence ?? 0) >= 0.6 &&
      event.source?.provider !== "manual-test" &&
      !event.notes?.toLowerCase().includes("beispieldatensatz")
    );
    const similar = eligible.filter((event) => {
      const w = event.weather!;
      return Math.abs((w.temperatureC ?? hour.temperature) - hour.temperature) <= 4 &&
        Math.abs((w.pressureHpa ?? hour.pressure) - hour.pressure) <= 8 &&
        Math.abs((w.windKmh ?? hour.windSpeed) - hour.windSpeed) <= 8 &&
        Math.abs((w.cloudCoverPct ?? hour.cloudCover) - hour.cloudCover) <= 30;
    });
    const local = similar.filter((event) =>
      (water.lavNumber && event.lavNumber === water.lavNumber) ||
      (!!event.waterName && event.waterName.toLowerCase() === water.name.toLowerCase())
    );
    const regional = similar.filter((event) =>
      event.latitude != null && event.longitude != null && water.latitude != null && water.longitude != null &&
      distanceKm(water.latitude, water.longitude, event.latitude, event.longitude) <= 20 &&
      !local.includes(event)
    );
    return { local: local.length, regional: regional.length, eligible: eligible.length };
  };

  const forecastActivityMatches = useMemo(() => ranked.filter((item) => activityFor(item.water)).length, [ranked, forecastFish]);

  const bestForecast = ranked[0] ?? null;
  const otherForecast = sortedForecast.filter((item) => item.water.id !== bestForecast?.water.id);
  const visibleOtherForecast = showAllForecast ? otherForecast : otherForecast.slice(0, 4);

  function openForecastWaterInAtlas(water: FishingWater) {
    setSelected(water);
    setAtlasCategory("all");
    setAtlasPlace(null);
    setAtlasSearchError("");
    setAtlasQuery(water.name);
    setFocusedWaterId(water.latitude !== null && water.longitude !== null ? water.id : null);
    setView("atlas");
  }

  async function loadForecast() {
    const term = forecastQuery.trim();
    if (!term) return;
    setForecastBusy(true); setForecastError("");
    try {
      const geo = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`);
      if (!geo.ok) throw new Error("Ort nicht gefunden");
      const place = await geo.json() as AtlasPlace;
      setForecastPlace(place);
      const weather = await fetch(`/api/weather?lat=${place.latitude}&lon=${place.longitude}`);
      if (!weather.ok) throw new Error("Wetterdaten nicht verfügbar");
      const data = await weather.json() as { hours: ForecastHour[] };
      setForecastHours(data.hours || []);
      const availableDates = Array.from(new Set((data.hours || []).map((hour) => hour.time.slice(0,10))));
      if (!forecastDate || !availableDates.includes(forecastDate)) setForecastDate(availableDates[0] || "");
    } catch (error) { setForecastError(error instanceof Error ? error.message : "Prognose konnte nicht geladen werden"); }
    finally { setForecastBusy(false); }
  }

  useEffect(() => { if (view === "forecast" && !forecastPlace && !forecastBusy) void loadForecast(); }, [view]);
  const focusedWater = focusedWaterId === selected.id && selected.latitude !== null && selected.longitude !== null ? selected : null;
  const mapWaters = focusedWater ? [focusedWater] : filtered;
  const visibleSpots = focusedWater ? [...selected.spots, ...importedSpots] : [];
  const visibleParkings = focusedWater ? (selected.parkings ?? []) : [];
  const mappedCount = filtered.filter((water) => water.latitude !== null && water.longitude !== null).length;

  function selectAndFocus(water: FishingWater) {
  setSelected(water);

  setFocusedWaterId(
    water.latitude !== null && water.longitude !== null
      ? water.id
      : null
  );

  if (window.innerWidth <= 900) {
    window.setTimeout(() => {
      const target = view === "atlas" ? ".atlas-map" : ".details";
      document.querySelector(target)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 120);
  }
}

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next); saveFavorites(next);
  }

  async function loadCatchEnvironment() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setCatchAutoError("Standortbestimmung wird von diesem Gerät nicht unterstützt.");
      setCatchAutoAttempted(true);
      return;
    }

    setCatchAutoBusy(true);
    setCatchAutoError("");
    setCatchAutoAttempted(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        setCatchPosition({ latitude, longitude, accuracy });

        const nearest = waters
          .filter((water) => water.latitude !== null && water.longitude !== null)
          .map((water) => ({
            water,
            distance: distanceKm(latitude, longitude, water.latitude!, water.longitude!)
          }))
          .sort((a, b) => a.distance - b.distance)[0];

        if (nearest) setCatchWaterId(nearest.water.id);

        try {
          const response = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}`);
          if (!response.ok) throw new Error("Wetterdaten nicht verfügbar");
          const data = await response.json() as { hours?: ForecastHour[] };
          const now = Date.now();
          const hour = (data.hours ?? [])
            .slice()
            .sort((a, b) => Math.abs(new Date(a.time).getTime() - now) - Math.abs(new Date(b.time).getTime() - now))[0];
          if (hour) {
            setCatchWeather({
              temperature: hour.temperature,
              pressure: hour.pressure,
              windSpeed: hour.windSpeed,
              cloudCover: hour.cloudCover,
              precipitation: hour.precipitation,
              windDirection: hour.windDirection
            });
          }
        } catch (error) {
          setCatchAutoError(error instanceof Error ? error.message : "Wetterdaten konnten nicht geladen werden.");
        } finally {
          setCatchAutoBusy(false);
        }
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Standortfreigabe wurde nicht erteilt – Gewässer kann manuell gewählt werden."
          : "Standort konnte nicht bestimmt werden – Gewässer kann manuell gewählt werden.";
        setCatchAutoError(message);
        setCatchAutoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  useEffect(() => {
    if (view !== "diary" || catchAutoAttempted || catchAutoBusy) return;
    void loadCatchEnvironment();
  }, [view, catchAutoAttempted, catchAutoBusy]);

  function addCatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const now = new Date();
    const moon = moonInfoFor(now);
    const savePosition = form.get("savePosition") === "on";
    const waterId = catchWaterId || String(form.get("waterId") || "");
    if (!waterId) {
      setCatchAutoError("Bitte ein Gewässer auswählen.");
      return;
    }

    const entry: EnhancedCatchEntry = {
      id: crypto.randomUUID(),
      caughtAt: now.toISOString(),
      waterId,
      fish: String(form.get("fish")) as Fish,
      lengthCm: Number(form.get("lengthCm")) || undefined,
      weightKg: Number(form.get("weightKg")) || undefined,
      lure: String(form.get("lure") || ""),
      note: String(form.get("note") || ""),
      method: String(form.get("method") || "") || undefined,
      depthM: Number(form.get("depthM")) || undefined,
      weather: catchWeather ?? undefined,
      moonPhase: moon.phase,
      moonIllumination: moon.illumination,
      latitude: savePosition ? catchPosition?.latitude : undefined,
      longitude: savePosition ? catchPosition?.longitude : undefined,
      locationAccuracyM: savePosition ? catchPosition?.accuracy : undefined,
      locationSource: savePosition && catchPosition ? "gps" : "manual"
    };

    const next = [entry, ...catches];
    setCatches(next);
    saveCatches(next);
    event.currentTarget.reset();
  }

  async function importGpx(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setImportedSpots(parseGpx(await file.text()));
  }

  function exportGpx() {
    const xml = spotsToGpx(selected.name, visibleSpots);
    const href = URL.createObjectURL(new Blob([xml], { type: "application/gpx+xml" }));
    const anchor = document.createElement("a"); anchor.href = href; anchor.download = `${selected.id}-spots.gpx`; anchor.click(); URL.revokeObjectURL(href);
  }

  function scrollMainMenu(direction: "left" | "right") {
    mainNavRef.current?.scrollBy({
      left: direction === "right" ? 230 : -230,
      behavior: "smooth"
    });
  }

  function scrollAtlasCategories(direction: "left" | "right") {
    atlasCategoryRef.current?.scrollBy({
      left: direction === "right" ? 210 : -210,
      behavior: "smooth"
    });
  }

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => setView("dashboard")}><span>🎣</span><div><strong>HarzFishing</strong><small>Navigator V5.2 Beta</small></div></button>
        <div className="main-nav-shell">
          <button
            type="button"
            className="menu-scroll-button"
            aria-label="Menü nach links"
            onClick={() => scrollMainMenu("left")}
          >
            ‹
          </button>

          <nav ref={mainNavRef} className="main-nav" aria-label="Hauptnavigation">
            {([
              ["dashboard", "🏠 Dashboard"],
              ["waters", "🎣 Gewässer"],
              ["atlas", "🗺 Atlas"],
              ["forecast", "📈 Prognose"],
              ["diary", "📖 Fangbuch"],
              ["settings", "⚙ Einstellungen"]
            ] as [View, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={view === id ? "active" : ""}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            className="menu-scroll-button"
            aria-label="Menü nach rechts"
            onClick={() => scrollMainMenu("right")}
          >
            ›
          </button>
        </div>
      </header>

      {view === "dashboard" && <section className="page dashboard">
        <div className="hero-card"><p className="eyebrow">HarzFishing Navigator</p><h1>Dein Angelrevier auf einer Karte.</h1><p>Bodetalsperren, LAV-Gewässer, Harzflüsse, Fangbuch, GPX und eine transparente, regelbasierte Angelprognose.</p><button onClick={()=>setView("waters")}>Gewässer entdecken</button></div>
        <div className="dashboard-grid">
          <article><span>🗺️</span><strong>{waters.length}</strong><p>Gewässerprofile im Katalog</p></article>
          <article><span>⭐</span><strong>{favorites.length}</strong><p>gespeicherte Favoriten</p></article>
          <article><span>🐟</span><strong>{catches.length}</strong><p>Fänge im lokalen Fangbuch</p></article>
          <article><span>📍</span><strong>{importedSpots.length}</strong><p>importierte GPX-Punkte</p></article>
        </div>
        <div className="panel"><h2>Automatische Prognose</h2><p>Ort und Zielfisch wählen: HarzFishing bewertet passende Gewässer im 20-km-Umkreis automatisch anhand der Wetterdaten.</p></div>
      </section>}
{view === "atlas" && (
  <section className="atlas-page">

    <aside className="atlas-sidebar">
      <h2>Angelatlas</h2>

      <div
        className="forecast-controls-modern waters-search-controls"
        style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, width: "100%" }}
      >
        <div className="forecast-control forecast-location-control" style={{ width: "100%", minWidth: 0 }}>
          <span className="forecast-control-icon" aria-hidden="true">⌖</span>
          <input
            aria-label="Ort"
            value={atlasQuery}
            onChange={(e)=>{setAtlasQuery(e.target.value);setAtlasSearchError("");}}
            onKeyDown={(e)=>{if(e.key==='Enter'){e.preventDefault();void searchAtlasPlace();}}}
            placeholder="Ort"
            style={{ minWidth: 0, width: "100%" }}
          />
          <button className="forecast-search-compact" type="button" onClick={()=>void searchAtlasPlace()} disabled={atlasSearchBusy}>{atlasSearchBusy?'…':'Suchen'}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10 }}>
          <div className="forecast-control" style={{ minWidth: 0 }}>
            <span className="forecast-control-icon" aria-hidden="true">🐟</span>
            <select aria-label="Zielfisch" value={atlasFish} onChange={(e)=>setAtlasFish(e.target.value as Fish|"Alle")} style={{ minWidth: 0, width: "100%" }}>{fishOptions.map(x=><option key={x}>{x}</option>)}</select>
          </div>
          <div className="forecast-control forecast-radius" aria-label="Umkreis 20 Kilometer">
            <span className="forecast-control-icon" aria-hidden="true">◎</span><strong>20 km</strong>
          </div>
        </div>
      </div>
      {(atlasPlace || atlasFish !== "Alle") && <button type="button" className="forecast-reset-filter" onClick={resetAtlasFilters}>× Filter aufheben</button>}
      {atlasPlace && <div className="forecast-meta-modern waters-search-meta"><div><strong>Atlas rund um {atlasPlace.label}</strong><span>20 km · {atlasWaters.length} passende Gewässer</span></div></div>}
      {atlasSearchError && <p className="forecast-error">⚠ {atlasSearchError}</p>}

      <div className="atlas-result-heading">
        <strong>{atlasWaters.length} Treffer</strong>
        <small>
          {
            atlasWaters.filter(
              (water) =>
                water.latitude !== null &&
                water.longitude !== null
            ).length
          } kartiert
        </small>
      </div>

      <div className="atlas-water-list">
        {atlasWaters.map((water) => (
          <button
            key={water.id}
            className={
              selected.id === water.id
                ? "atlas-water active"
                : "atlas-water"
            }
            onClick={() => selectAndFocus(water)}
          >
            <strong>{water.name}</strong>

            <span>
              {water.type}
              {water.lavNumber
                ? ` · ${water.lavNumber}`
                : ""}
            </span>

            <small>
              {water.latitude !== null &&
              water.longitude !== null
                ? "📍 kartiert"
                : "Lage noch offen"}
            </small>

            <span className="atlas-water-meta">
              🅿 {water.parkings.length} · 📍 {water.spots.length}
            </span>
          </button>
        ))}
      </div>
    </aside>

    <aside className="atlas-details" aria-live="polite">
      <div className="atlas-details-head">
        <div>
          <p className="eyebrow">Gewässerprofil</p>
          <h2>{selected.name}</h2>
          <p>{selected.module} · {selected.type}{selected.lavNumber ? ` · ${selected.lavNumber}` : ""}</p>
        </div>
        <button type="button" className="favorite atlas-favorite" aria-label="Favorit umschalten" onClick={() => toggleFavorite(selected.id)}>
          {favorites.includes(selected.id) ? "★" : "☆"}
        </button>
      </div>

      <div className="atlas-detail-stats">
        <span>🐟 {waterTargetFish(selected).length} Zielfische</span>
        <span>🅿️ {selected.parkings.length} Parkplätze</span>
        <span>📍 {selected.spots.length} Erkundungspunkte</span>
      </div>

      {selected.latitude !== null && selected.longitude !== null ? (
        <div className="atlas-primary-actions">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer">Google Navigation</a>
          <a href={`https://maps.apple.com/?daddr=${selected.latitude},${selected.longitude}&dirflg=d`} target="_blank" rel="noreferrer">Apple Navigation</a>
        </div>
      ) : (
        <p className="atlas-empty-note">Für dieses Gewässer ist noch keine Kartenposition gespeichert.</p>
      )}

      {selected.parkings.length > 0 && (
        <>
          <h3>Parkplätze / Ausgangspunkte</h3>
          <div className="atlas-nav-list">
            {selected.parkings.slice(0, 1).map((parking) => (
              <article key={parking.id}>
                <strong>{parking.name}</strong>
                <small>{parking.note ?? (parking.access === "public" ? "Öffentlicher Parkplatz" : "Zufahrt eingeschränkt")}</small>
                <div className="atlas-row-actions">
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${parking.latitude},${parking.longitude}&travelmode=driving`} target="_blank" rel="noreferrer">Google Auto</a>
                  <a href={`https://maps.apple.com/?daddr=${parking.latitude},${parking.longitude}&dirflg=d`} target="_blank" rel="noreferrer">Apple Auto</a>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {selected.spots.length > 0 && (
        <>
          <h3>Erkundungspunkte</h3>
          <div className="atlas-nav-list">
            {selected.spots.map((spot) => {
              const parking = selected.parkings.find((item) => item.id === spot.parkingId);
              return (
                <article key={spot.id}>
                  <strong>{spot.name}</strong>
                  <small>{spot.risk ?? spot.note ?? "Zugang vor Ort prüfen."}</small>
                  <div className="atlas-row-actions">
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=walking`} target="_blank" rel="noreferrer">Zu Fuß ab Standort</a>
                    {parking && <a href={`https://www.google.com/maps/dir/?api=1&origin=${parking.latitude},${parking.longitude}&destination=${spot.latitude},${spot.longitude}&travelmode=walking`} target="_blank" rel="noreferrer">Ab Parkplatz</a>}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </aside>

    <div className="atlas-map">
      <MapView
        waters={
          focusedWater
            ? [focusedWater]
            : atlasWaters
        }
        spots={visibleSpots}
        parkings={visibleParkings}
        selectedWater={focusedWater}
        onSelect={selectAndFocus}
      />

      <div className="map-note">
        {focusedWater ? (
          <>
            <strong>{selected.name}</strong>

            <span>
              {visibleParkings.length} Parkplätze ·{" "}
              {visibleSpots.length} Hotspots
            </span>

            <button
              type="button"
              onClick={() => setFocusedWaterId(null)}
            >
              Atlasübersicht
            </button>
          </>
        ) : (
          <span>
            Wähle links ein kartiertes Gewässer aus.
          </span>
        )}
      </div>
    </div>

  </section>
)}      {view === "waters" && <section className="page">
        <div className="waters-filter-zone" style={{ width: "min(1180px, calc(100% - 32px))", margin: "24px auto 18px" }}>
        <div className="forecast-controls-modern waters-search-controls">
          <div className="forecast-control forecast-location-control">
            <span className="forecast-control-icon" aria-hidden="true">⌖</span>
            <input aria-label="Ort" value={query} onChange={(e)=>setQuery(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter') void searchWatersPlace();}} placeholder="Ort"/>
            <button className="forecast-search-compact" type="button" onClick={()=>void searchWatersPlace()} disabled={waterSearchBusy}>{waterSearchBusy?'…':'Suchen'}</button>
          </div>
          <div className="forecast-control">
            <span className="forecast-control-icon" aria-hidden="true">🐟</span>
            <select aria-label="Zielfisch" value={fish} onChange={(e)=>setFish(e.target.value as Fish|"Alle")}>{fishOptions.map(x=><option key={x}>{x}</option>)}</select>
          </div>
          <div className="forecast-control forecast-radius" aria-label="Umkreis 20 Kilometer">
            <span className="forecast-control-icon" aria-hidden="true">◎</span><strong>20 km</strong>
          </div>
        </div>
        {(waterPlace || fish !== "Alle") && <button type="button" className="forecast-reset-filter" onClick={resetWatersFilters}>× Filter aufheben</button>}
        {waterPlace && <div className="forecast-meta-modern waters-search-meta waters-search-meta-below"><div><strong>Gewässer rund um {waterPlace.label}</strong><span>20 km · {filtered.length} passende Gewässer</span></div></div>}
        {waterSearchError && <p className="forecast-error">⚠ {waterSearchError}</p>}
        </div>
        <div className="workspace"><aside className="sidebar"><div className="sidebar-heading"><strong>{filtered.length} Gewässer</strong><span>Demo-/Prüfdaten</span></div><div className="water-list">{filtered.map((water)=><article key={water.id} className={`water-card ${selected.id===water.id?'selected':''}`} onClick={()=>selectAndFocus(water)}><div><h2>{water.name}</h2><p>{water.module} · {water.type}</p></div><button className="favorite" onClick={(e)=>{e.stopPropagation();toggleFavorite(water.id)}}>{favorites.includes(water.id)?'★':'☆'}</button><div className="fish-row">{waterTargetFish(water).map(item=><span key={item}>{item} {'★'.repeat(targetFishRating(water,item))}</span>)}</div></article>)}</div></aside>
          <div className="map-panel"><MapView waters={mapWaters} spots={visibleSpots} parkings={visibleParkings} selectedWater={focusedWater} onSelect={selectAndFocus}/><div className="map-note">{focusedWater ? <><strong>{selected.name}</strong><span>{visibleParkings.length} Parkplatz{visibleParkings.length === 1 ? "" : "plätze"} · {visibleSpots.length} Hotspot{visibleSpots.length === 1 ? "" : "s"}</span><button type="button" onClick={()=>setFocusedWaterId(null)}>Alle Gewässer zeigen</button></> : <>{selected.latitude === null || selected.longitude === null ? <span>Für dieses Gewässer ist noch keine geprüfte Kartenposition gespeichert.</span> : <span>{mappedCount} von {filtered.length} Treffern sind bereits kartiert. Gewässer anklicken, um Parkplätze und Hotspots zu öffnen.</span>}</>}</div></div>
          <aside className="details"><p className="eyebrow">Gewässerprofil</p><div className="water-stats">
  <div className="stat-card">
    <span>🐟</span>
    <strong>{waterTargetFish(selected).length}</strong>
    <small>Zielfische</small>
  </div>

  <div className="stat-card">
    <span>📍</span>
    <strong>{selected.spots.length}</strong>
    <small>Hotspots</small>
  </div>

  <div className="stat-card">
    <span>🅿️</span>
    <strong>{selected.parkings.length}</strong>
    <small>Parkplätze</small>
  </div>

  <div className="stat-card">
    <span>⭐</span>
    <strong>
      {Math.max(
        ...waterTargetFish(selected).map((f) => targetFishRating(selected, f)),
        0
      )}
    </strong>
    <small>Top-Fisch</small>
  </div>
</div><h2>{selected.name}</h2><p>{selected.module} · {selected.type}{selected.lavNumber ? ` · ${selected.lavNumber}` : ""}</p><span className={`status ${selected.sourceStatus}`}>{selected.sourceStatus==='verified'?'Navigationsdaten vorhanden':selected.sourceStatus==='catalog'?'LAV-Katalog – Lage noch offen':'Arbeitsdaten – prüfen'}</span>{selected.areaHa && <p><strong>Fläche:</strong> {selected.areaHa} ha</p>}<h3>Zielfische</h3><div className="score-list">{waterTargetFish(selected).length ? waterTargetFish(selected).map(item=><div key={item}><span>{item}</span><strong>{'★'.repeat(targetFishRating(selected,item))}</strong></div>) : <p>Keine Zielfischarten im Basiskatalog erkannt.</p>}</div><h3>Hinweise</h3><ul>{selected.notes.map((note, index)=><li key={`${selected.id}-note-${index}`}>{note}</li>)}</ul>
          {selected.parkings.length > 0 && <><h3>Parkplätze / Ausgangspunkte</h3><div className="nav-list">{selected.parkings.map(p=><article key={p.id}><strong>{p.name}</strong><small>{p.access==='public'?'öffentlich':'Zufahrt eingeschränkt'} · {p.accuracy==='verified'?'belegt':'Näherungswert'}</small><div className="mini-actions"><a href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=driving`} target="_blank" rel="noreferrer">Google Auto</a><a href={`https://maps.apple.com/?daddr=${p.latitude},${p.longitude}&dirflg=d`} target="_blank" rel="noreferrer">Apple Auto</a></div></article>)}</div></>}
          {selected.spots.length > 0 && <><h3>Hotspots / Erkundungspunkte</h3><div className="nav-list">{selected.spots.map(spot=>{const parking=selected.parkings.find(p=>p.id===spot.parkingId);return <article key={spot.id}><strong>{spot.name}</strong><small>{spot.risk ?? spot.note ?? 'Zugang vor Ort prüfen.'}</small><div className="mini-actions"><a href={`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=walking`} target="_blank" rel="noreferrer">Zu Fuß ab Standort</a>{parking&&<a href={`https://www.google.com/maps/dir/?api=1&origin=${parking.latitude},${parking.longitude}&destination=${spot.latitude},${spot.longitude}&travelmode=walking`} target="_blank" rel="noreferrer">Zu Fuß ab Parkplatz</a>}</div></article>})}</div></>}
          <div className="button-row">{selected.latitude !== null && selected.longitude !== null && <a className="route-button" href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer">Zum Gewässer</a>}<button onClick={exportGpx} disabled={!visibleSpots.length}>GPX exportieren</button></div><label className="file-button">GPX importieren<input type="file" accept=".gpx,application/gpx+xml" onChange={importGpx}/></label></aside>
        </div>
      </section>}

      {view === "forecast" && <section className="page forecast-page forecast-page-modern">
        <div className="panel forecast-head-card">
          <div className="forecast-head-copy">
            <p className="eyebrow">Automatische Angelprognose</p>
            <h1>Wo lohnt es sich?</h1>
            <p className="forecast-intro">Ort, Zielfisch und Datum wählen – bewertet werden passende kartierte Gewässer im 20-km-Umkreis.</p>
          </div>

          <div className="forecast-controls-modern">
            <div className="forecast-control forecast-location-control">
              <span className="forecast-control-icon" aria-hidden="true">⌖</span>
              <input aria-label="Ort" value={forecastQuery} onChange={(e)=>setForecastQuery(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter') void loadForecast();}} placeholder="Ort"/>
              <button className="forecast-search-compact" type="button" onClick={()=>void loadForecast()} disabled={forecastBusy}>{forecastBusy?'…':'Suchen'}</button>
            </div>
            <div className="forecast-control">
              <span className="forecast-control-icon" aria-hidden="true">🐟</span>
              <select aria-label="Zielfisch" value={forecastFish} onChange={(e)=>{setForecastFish(e.target.value as Fish);setShowAllForecast(false);}}>{fishOptions.filter(x=>x!=="Alle").map(x=><option key={x}>{x}</option>)}</select>
            </div>
            <div className="forecast-control">
              <span className="forecast-control-icon" aria-hidden="true">▣</span>
              <input aria-label="Datum" type="date" value={forecastDate} min={forecastDates[0] || undefined} max={forecastDates[forecastDates.length-1] || undefined} onChange={(e)=>{setForecastDate(e.target.value);setShowAllForecast(false);}} disabled={!forecastDates.length}/>
            </div>
            <div className="forecast-control forecast-radius" aria-label="Umkreis 20 Kilometer">
              <span className="forecast-control-icon" aria-hidden="true">◎</span><strong>20 km</strong>
            </div>
          </div>

          {forecastError && <p className="forecast-error">⚠ {forecastError}</p>}
          {forecastPlace && <div className="forecast-meta-modern">
            <div className="forecast-fish-badge" aria-hidden="true">🐟</div>
            <div><strong>{forecastFish} rund um {forecastPlace.label}</strong><span>20 km · {forecastWaters.length} passende Gewässer · {forecastDate ? new Date(`${forecastDate}T12:00:00`).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'}) : 'Datum wählen'} · Wetter automatisch</span></div>
            {bestForecast && <span className="forecast-meta-weather">☁ {Math.round(bestForecast.best.hour.cloudCover)} % · {bestForecast.best.hour.temperature.toFixed(0)} °C · 🎣 Pilotdaten {forecastActivityMatches}/{ranked.length}</span>}
          </div>}
        </div>

        {forecastPlace && !forecastBusy && ranked.length===0 && <div className="panel"><p>Keine passenden kartierten Gewässer mit {forecastFish} im 20-km-Umkreis gefunden.</p></div>}

        {bestForecast && <section className="forecast-best-section">
          <div className="forecast-section-title"><span>★</span><strong>Beste Bedingungen</strong></div>
          {/* MOBILE V1.10.11: Kachel 1 – Info-Knöpfe und Bewertungs-Pfeil mobil angepasst; Desktop unverändert */}
          <article className="forecast-best-card forecast-clickable forecast-best-info-shift-mobile-v2" role="button" tabIndex={0} onClick={()=>openForecastWaterInAtlas(bestForecast.water)} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openForecastWaterInAtlas(bestForecast.water);}}}>
            <div className="forecast-best-rank">1</div>
            <div className="forecast-best-main">
              <div className="forecast-water-icon" aria-hidden="true">🌊</div>
              <div className="forecast-best-copy">
                <strong>{bestForecast.water.name}</strong>
                <p>⌖ {bestForecast.distance.toFixed(1)} km · {bestForecast.water.type}</p>
                <b>Beste Zeit: {new Date(bestForecast.best.hour.time).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})} Uhr</b>
              </div>
            </div>
            <span className="forecast-score">{bestForecast.best.result.score}/100</span>
            <span className="forecast-open-arrow" aria-hidden="true">›</span>
            <div className="forecast-best-weather">
              <span><i>☾</i><b>{bestForecast.best.result.dayPhase}</b><small>günstig</small></span>
              <span><i>☁</i><b>{Math.round(bestForecast.best.hour.cloudCover)} %</b><small>Bewölkung</small></span>
              <span><i>≋</i><b>{Math.round(bestForecast.best.hour.windSpeed)} km/h · {windDisplay(bestForecast.best.hour.windDirection)}</b><small>Wind</small></span>
              <span><i>♨</i><b>{bestForecast.best.hour.temperature.toFixed(0)} °C</b><small>Temperatur</small></span>
              <span><i>◴</i><b>{Math.round(bestForecast.best.hour.pressure)} hPa</b><small>Luftdruck {bestForecast.best.hour.pressureTrend >= 1.5 ? '↗' : bestForecast.best.hour.pressureTrend <= -1.5 ? '↘' : '→'}</small></span>
              <span className="forecast-weather-moon"><i>◐</i><b>{bestForecast.best.result.moonPhase}</b><small>{bestForecast.best.result.moonIllumination} %</small></span>
            </div>
            <details className="forecast-explain" onClick={(e)=>e.stopPropagation()}>
              <summary>Warum diese Bewertung?</summary>
              <div className="forecast-explain-grid">
                <div><b>Prognose {bestForecast.best.result.score}/100</b><ul>{bestForecast.best.result.reasons.length ? bestForecast.best.result.reasons.map((reason)=><li key={reason}>{reason}</li>) : <li>Keine zusätzlichen Bonusfaktoren erkannt.</li>}</ul></div>
                <div><b>Fangdaten-Evidenz</b>{activityFor(bestForecast.water) ? (() => { const activity = activityFor(bestForecast.water)!; return <p><strong>{activity.activityLabel}</strong>{activity.totalReports ? ` · ${activity.totalReports.toLocaleString("de-DE")} Gesamtmeldungen` : ""}{activity.speciesRank ? ` · ${forecastFish} Rang #${activity.speciesRank}` : ""}<br/><small>Qualitätsklasse E · kein Einfluss auf den 0–100-Score</small></p>; })() : <p>Für dieses Gewässer liegen noch keine dokumentierten Fangaktivitätsdaten vor.<br/><small>Kein Nachteil im 0–100-Score.</small></p>}</div>
              </div>
            </details>
            <div className="forecast-catch-compact">
              <div className="forecast-catch-compact-row">
                <span aria-hidden="true">🎣</span>
                <b>Ähnliche Fänge Gewässer</b>
                <span className="forecast-catch-info" role="button" tabIndex={0} aria-label="Info zu ähnlichen Fängen im Gewässer" title="Gezählt werden nur Einzelfänge mit verwertbaren Wetterdaten bei ähnlichen Bedingungen (Temperatur ±4 °C, Luftdruck ±8 hPa, Wind ±8 km/h, Bewölkung ±30 %)." onClick={(event)=>{event.preventDefault();event.stopPropagation();}}>i</span>
              </div>
              <div className="forecast-catch-compact-row">
                <span aria-hidden="true">📊</span>
                <b>Ähnliche Fänge Umkreis 20 km</b>
                <ActivityDiagnostic water={bestForecast.water} />
              </div>
            </div>
          </article>
        </section>}

        {otherForecast.length > 0 && <section className="forecast-other-section">
          <div className="forecast-other-head"><div><p className="eyebrow">Weitere Kandidaten</p></div><label>Sortierung:<select value={forecastSort} onChange={(e)=>setForecastSort(e.target.value as "score"|"distance"|"name")}><option value="score">Beste Bewertung</option><option value="distance">Entfernung</option><option value="name">Name</option></select></label></div>
          <div className="forecast-other-list">
            {visibleOtherForecast.map(({water,distance,best})=>{
              const rank = ranked.findIndex((item)=>item.water.id===water.id)+1;
              return <article key={water.id} className="forecast-other-card forecast-clickable" role="button" tabIndex={0} onClick={()=>openForecastWaterInAtlas(water)} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openForecastWaterInAtlas(water);}}}>
                <div className="forecast-rank-small">{rank}</div>
                <div className="forecast-water-icon small" aria-hidden="true">🌊</div>
                <div className="forecast-other-copy">
                  <strong>{water.name}</strong>
                  <p>⌖ {distance.toFixed(1)} km · {water.type} · Beste Zeit: {new Date(best.hour.time).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})} Uhr</p>
                  <div className="forecast-reason-pills"><span>{best.result.dayPhase} günstig</span><span>{Math.round(best.hour.cloudCover)} % Bewölkung</span><span>{Math.round(best.hour.windSpeed)} km/h · {windDisplay(best.hour.windDirection)} Wind</span><span>◐ {best.result.moonPhase} · {best.result.moonIllumination} %</span></div>
                  <div className="forecast-catch-mini forecast-catch-desktop">
                    <span className="forecast-catch-mini-line">🎣 <b>Ähnliche Fänge Gewässer</b> <span className="forecast-catch-info" role="button" tabIndex={0} aria-label="Info zu ähnlichen Fängen im Gewässer" title="Gezählt werden nur Einzelfänge mit verwertbaren Wetterdaten bei ähnlichen Bedingungen (Temperatur ±4 °C, Luftdruck ±8 hPa, Wind ±8 km/h, Bewölkung ±30 %)." onClick={(event)=>{event.preventDefault();event.stopPropagation();}}>i</span></span>
                    <span className="forecast-catch-mini-line">📊 <b>Ähnliche Fänge Umkreis 20 km</b> <ActivityDiagnostic water={water} compact /></span>
                  </div>
                </div>
                <span className="forecast-score small">{best.result.score}/100</span><span className="forecast-open-arrow" aria-hidden="true">›</span>
                <div className="forecast-catch-compact forecast-other-catch-mobile">
                  <div className="forecast-catch-compact-row">
                    <span aria-hidden="true">🎣</span>
                    <b>Ähnliche Fänge Gewässer</b>
                    <span className="forecast-catch-info" role="button" tabIndex={0} aria-label="Info zu ähnlichen Fängen im Gewässer" title="Gezählt werden nur Einzelfänge mit verwertbaren Wetterdaten bei ähnlichen Bedingungen (Temperatur ±4 °C, Luftdruck ±8 hPa, Wind ±8 km/h, Bewölkung ±30 %)." onClick={(event)=>{event.preventDefault();event.stopPropagation();}}>i</span>
                  </div>
                  <div className="forecast-catch-compact-row">
                    <span aria-hidden="true">📊</span>
                    <b>Ähnliche Fänge Umkreis 20 km</b>
                    <ActivityDiagnostic water={water} compact />
                  </div>
                </div>
              </article>
            })}
          </div>
          {otherForecast.length > 4 && <button className="forecast-show-all" type="button" onClick={()=>setShowAllForecast((value)=>!value)}>{showAllForecast ? 'Weniger Gewässer anzeigen' : `Alle ${ranked.length} Gewässer anzeigen`} <span>{showAllForecast?'⌃':'⌄'}</span></button>}
        </section>}

        {bestForecast && <p className="forecast-disclaimer">ⓘ Bewertungen basieren auf Wettervorhersage, Sonnen- & Mondphasen und artspezifischen Faktoren. Community-Fangaktivität wird separat angezeigt und verändert den 0–100-Score noch nicht. Keine Garantie – Petri Heil!</p>}
      </section>}
      {view === "diary" && (() => {
        const moon = moonInfoFor(new Date());
        const selectedCatchWater = waters.find((water) => water.id === catchWaterId);
        const selectedCatchDistance = selectedCatchWater && catchPosition && selectedCatchWater.latitude !== null && selectedCatchWater.longitude !== null
          ? distanceKm(catchPosition.latitude, catchPosition.longitude, selectedCatchWater.latitude, selectedCatchWater.longitude)
          : null;
        return <section className="page diary diary-v2">
          <form className="panel catch-entry-card" onSubmit={addCatch}>
            <div className="catch-entry-head">
              <div><p className="eyebrow">Lokales Fangbuch</p><h1>Fang eintragen</h1><p>Standort, Gewässer, Wetter und Mondphase werden automatisch vorbereitet.</p></div>
              <button type="button" className="catch-refresh" onClick={()=>void loadCatchEnvironment()} disabled={catchAutoBusy}>{catchAutoBusy ? "Ermittle …" : "⌖ Neu erkennen"}</button>
            </div>

            <div className="catch-auto-grid">
              <article><span>📍</span><div><small>Gewässer</small><strong>{selectedCatchWater?.name ?? (catchAutoBusy ? "wird ermittelt …" : "bitte auswählen")}</strong><em>{selectedCatchDistance != null ? `${selectedCatchDistance.toFixed(1)} km vom Standort` : catchPosition ? "Standort erkannt" : "GPS noch nicht verfügbar"}</em></div></article>
              <article><span>🌤️</span><div><small>Wetter</small><strong>{catchWeather ? `${catchWeather.temperature.toFixed(0)} °C · ${Math.round(catchWeather.pressure)} hPa` : "wird automatisch geladen"}</strong><em>{catchWeather ? `${Math.round(catchWeather.windSpeed)} km/h · ${windDisplay(catchWeather.windDirection)} · ${Math.round(catchWeather.cloudCover)} % Bewölkung` : "vom aktuellen Standort"}</em></div></article>
              <article><span>◐</span><div><small>Mondphase</small><strong>{moon.phase}</strong><em>{moon.illumination} % beleuchtet</em></div></article>
              <article><span>🕒</span><div><small>Zeitpunkt</small><strong>{new Date().toLocaleDateString("de-DE")}</strong><em>{new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr · automatisch</em></div></article>
            </div>

            {catchAutoError && <p className="catch-auto-error">⚠ {catchAutoError}</p>}

            <div className="catch-form-grid">
              <label className="wide">Gewässer <select name="waterId" value={catchWaterId} onChange={(event)=>setCatchWaterId(event.target.value)} required><option value="">Gewässer auswählen …</option>{waters.slice().sort((a,b)=>a.name.localeCompare(b.name,"de")).map((water)=><option value={water.id} key={water.id}>{water.name}{water.lavNumber ? ` · ${water.lavNumber}` : ""}</option>)}</select></label>
              <label>Fischart <select name="fish" defaultValue="Zander">{fishOptions.filter(x=>x!=="Alle").map(x=><option key={x}>{x}</option>)}</select></label>
              <label>Länge <div className="catch-unit-field"><input name="lengthCm" type="number" min="0" step="0.1" inputMode="decimal" placeholder="0"/><span>cm</span></div></label>
              <label>Gewicht <div className="catch-unit-field"><input name="weightKg" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0"/><span>kg</span></div></label>
              <label>Fangmethode <select name="method" defaultValue="Spinnfischen"><option>Spinnfischen</option><option>Ansitz</option><option>Pose</option><option>Grundangeln</option><option>Fliegenfischen</option><option>Vertikalangeln</option><option>Sonstiges</option></select></label>
              <label>Köder <input name="lure" placeholder="z. B. 10 cm Gummifisch"/></label>
              <label>Fangtiefe <div className="catch-unit-field"><input name="depthM" type="number" min="0" step="0.1" inputMode="decimal" placeholder="optional"/><span>m</span></div></label>
              <label className="wide">Notiz <textarea name="note" rows={3} placeholder="optional – z. B. Bissphase, Struktur, Besonderheiten"/></label>
            </div>

            <label className="catch-location-check"><input name="savePosition" type="checkbox" defaultChecked/> <span>🎯 Fangstelle mit GPS-Position speichern</span></label>
            <button className="catch-save-button" type="submit">🎣 Fang speichern</button>
          </form>

          <div className="catch-history">
            <div className="catch-history-head"><div><p className="eyebrow">Eigene Datenbasis</p><h2>Gespeicherte Fänge</h2></div><strong>{catches.length}</strong></div>
            <div className="catch-list catch-list-v2">{catches.map(entry=>{
              const water = waters.find(w=>w.id===entry.waterId);
              return <article key={entry.id}>
                <div className="catch-list-main"><strong>{entry.fish}</strong><p>{water?.name ?? entry.waterId} · {new Date(entry.caughtAt).toLocaleString("de-DE")}</p><small>{[entry.method, entry.lure, entry.depthM ? `${entry.depthM} m` : ""].filter(Boolean).join(" · ") || "Keine Zusatzangaben"}</small>{entry.weather && <small>🌤 {entry.weather.temperature.toFixed(0)} °C · {Math.round(entry.weather.pressure)} hPa · {Math.round(entry.weather.windSpeed)} km/h · {windDisplay(entry.weather.windDirection)}{entry.weather.windDirection != null ? ` (${Math.round(entry.weather.windDirection)}°)` : ""}</small>}{entry.moonPhase && <small>◐ {entry.moonPhase} · {entry.moonIllumination ?? 0} %</small>}</div>
                <span className="catch-measure">{entry.lengthCm?`${entry.lengthCm} cm`:""}{entry.weightKg?`${entry.lengthCm?" · ":""}${entry.weightKg} kg`:""}</span>
              </article>;
            })}{!catches.length&&<p className="catch-empty">Noch keine Fänge gespeichert. Der erste Eintrag baut deine eigene Prognose-Datenbasis auf.</p>}</div>
          </div>
        </section>;
      })()}

      {view === "settings" && <section className="page narrow"><div className="panel"><p className="eyebrow">V5.2 Beta</p><h1>Offline & Daten</h1><h3>Installierbare Web-App</h3><p>Manifest und Service Worker sind vorbereitet. Nach einem Produktions-Deployment kann die App über den Browser zum Startbildschirm hinzugefügt werden.</p><h3>Lokale Speicherung</h3><p>Favoriten und Fangbuch liegen nur im Browser dieses Geräts. Es gibt noch kein Konto und keine Cloud-Synchronisierung.</p><h3>Amtliche Verlässlichkeit</h3><p>Die enthaltenen Gewässer sind technische Demonstrationsdaten. Vor dem Angeln gelten ausschließlich aktuelle Dokumente, Beschilderung und lokale Regeln.</p><button onClick={()=>{localStorage.clear();setFavorites([]);setCatches([]);setImportedSpots([])}}>Lokale App-Daten löschen</button></div></section>}

      <footer>HarzFishing Navigator V5.2 Beta · Keine amtliche Gewässerkarte und keine Fanggarantie.</footer>
    </main>
  );
}
