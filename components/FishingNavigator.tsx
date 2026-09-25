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
import type { CatchEntry, Fish, FishingSpot, FishingWater, ParkingSpot, WaterModule } from "@/lib/types";

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
  | "favorites"
  | "elbe";


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
  photo?: string;
};

type UserParkingSpot = ParkingSpot & {
  waterId: string;
  photo?: string;
  createdAt: string;
  accuracyM?: number;
};

type UserFishingSpot = FishingSpot & {
  waterId: string;
  photo?: string;
  createdAt: string;
  accuracyM?: number;
};

const USER_PARKINGS_KEY = "harzfishing:user-parkings";
const USER_HOTSPOTS_KEY = "harzfishing:user-hotspots";

function loadLocalArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}

function saveLocalArray<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

const ATLAS_DB_NAME = "harzfishing-atlas";
const ATLAS_DB_VERSION = 2;
const ATLAS_PHOTO_STORE = "point-photos";
const CATCH_PHOTO_STORE = "catch-photos";

function openAtlasDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB wird von diesem Browser nicht unterstützt."));
      return;
    }
    const request = indexedDB.open(ATLAS_DB_NAME, ATLAS_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ATLAS_PHOTO_STORE)) db.createObjectStore(ATLAS_PHOTO_STORE);
      if (!db.objectStoreNames.contains(CATCH_PHOTO_STORE)) db.createObjectStore(CATCH_PHOTO_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Lokaler Bildspeicher konnte nicht geöffnet werden."));
  });
}

async function putDbPhoto(store: string, id: string, photo: string) {
  const db = await openAtlasDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(photo, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Foto konnte nicht dauerhaft gespeichert werden."));
      tx.onabort = () => reject(tx.error ?? new Error("Fotospeicherung wurde abgebrochen."));
    });
  } finally { db.close(); }
}

async function getDbPhoto(store: string, id: string) {
  const db = await openAtlasDb();
  try {
    return await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const request = tx.objectStore(store).get(id);
      request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : undefined);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function putAtlasPhoto(id: string, photo: string) {
  const db = await openAtlasDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ATLAS_PHOTO_STORE, "readwrite");
      tx.objectStore(ATLAS_PHOTO_STORE).put(photo, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Foto konnte nicht dauerhaft gespeichert werden."));
      tx.onabort = () => reject(tx.error ?? new Error("Fotospeicherung wurde abgebrochen."));
    });
  } finally { db.close(); }
}

async function getAtlasPhoto(id: string) {
  const db = await openAtlasDb();
  try {
    return await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(ATLAS_PHOTO_STORE, "readonly");
      const request = tx.objectStore(ATLAS_PHOTO_STORE).get(id);
      request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : undefined);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function deleteAtlasPhoto(id: string) {
  const db = await openAtlasDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ATLAS_PHOTO_STORE, "readwrite");
      tx.objectStore(ATLAS_PHOTO_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

function withoutPhoto<T extends { photo?: string }>(items: T[]) {
  return items.map(({ photo: _photo, ...item }) => item);
}

async function hydrateAndMigrateAtlasPoints<T extends { id: string; photo?: string }>(key: string) {
  const stored = loadLocalArray<T>(key);
  const hydrated: T[] = [];
  let migrated = false;

  for (const item of stored) {
    let photo = item.photo;
    if (photo) {
      await putAtlasPhoto(item.id, photo);
      migrated = true;
    } else {
      photo = await getAtlasPhoto(item.id);
    }
    hydrated.push(photo ? { ...item, photo } : item);
  }

  if (migrated) saveLocalArray(key, withoutPhoto(hydrated));
  return hydrated;
}

async function hydrateCatchPhotos(entries: EnhancedCatchEntry[]) {
  const hydrated: EnhancedCatchEntry[] = [];
  for (const entry of entries) {
    const photo = await getDbPhoto(CATCH_PHOTO_STORE, entry.id);
    hydrated.push(photo ? { ...entry, photo } : entry);
  }
  return hydrated;
}


type MeasurePoint = { x: number; y: number };
function FishLengthMeasure({photo,handleLengthCm,onApply,onClose}:{photo:string;handleLengthCm:number;onApply:(cm:number)=>void;onClose:()=>void}) {
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const [points,setPoints]=useState<MeasurePoint[]>([]);
  const labels=["Griff Anfang","Griff Ende","Maulspitze","Schwanzspitze"];
  const distance=(a:MeasurePoint,b:MeasurePoint)=>Math.hypot(a.x-b.x,a.y-b.y);
  const result=points.length===4 && distance(points[0],points[1])>0 ? distance(points[2],points[3])/distance(points[0],points[1])*handleLengthCm : null;
  useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;const image=new Image();image.onload=()=>{const scale=Math.min(1,Math.min(900,window.innerWidth-40)/image.naturalWidth);canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);const ctx=canvas.getContext("2d");if(!ctx)return;ctx.drawImage(image,0,0,canvas.width,canvas.height);points.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.fillStyle=i<2?"#fff":"#ffd54f";ctx.fill();ctx.lineWidth=3;ctx.strokeStyle="#111";ctx.stroke();});[[0,1],[2,3]].forEach(([a,b])=>{if(!points[a]||!points[b])return;ctx.beginPath();ctx.moveTo(points[a].x,points[a].y);ctx.lineTo(points[b].x,points[b].y);ctx.lineWidth=4;ctx.strokeStyle="#fff";ctx.stroke();});};image.src=photo;},[photo,points]);
  function addPoint(e:React.MouseEvent<HTMLCanvasElement>){if(points.length>=4)return;const r=e.currentTarget.getBoundingClientRect();setPoints(v=>[...v,{x:(e.clientX-r.left)*e.currentTarget.width/r.width,y:(e.clientY-r.top)*e.currentTarget.height/r.height}]);}
  return <div className="fish-measure-overlay"><div className="fish-measure-panel"><div className="fish-measure-head"><div><strong>📏 Fischlänge aus Foto</strong><small>Rutengriff: {handleLengthCm.toFixed(1)} cm</small></div><button type="button" onClick={onClose}>✕</button></div><p className="fish-measure-help">{points.length<4?`Punkt ${points.length+1}: ${labels[points.length]} antippen`:"Messpunkte vollständig."}</p><div className="fish-measure-canvas-wrap"><canvas ref={canvasRef} onClick={addPoint}/></div><div className="fish-measure-actions"><button type="button" disabled={!points.length} onClick={()=>setPoints(v=>v.slice(0,-1))}>↶ Punkt zurück</button><button type="button" disabled={!points.length} onClick={()=>setPoints([])}>Neu messen</button>{result!==null&&<strong>{result.toFixed(1)} cm</strong>}<button type="button" disabled={result===null} onClick={()=>result!==null&&onApply(Math.round(result))}>✓ Länge übernehmen</button></div></div></div>;
}
type WamiFishingBackup = {
  format: "WamiFishing Navigator Backup";
  version: 1;
  exportedAt: string;
  favorites: string[];
  catches: EnhancedCatchEntry[];
  parkings: UserParkingSpot[];
  hotspots: UserFishingSpot[];
};

const AUTO_BACKUP_KEY = "wamifishing:auto-backup-v1";
const AUTO_CATCH_BACKUP_KEY = "wamifishing:auto-catches-v1";

function saveAutomaticBackup(backup: WamiFishingBackup) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(backup));
  localStorage.setItem(AUTO_CATCH_BACKUP_KEY, JSON.stringify({version:1, exportedAt:backup.exportedAt, catches:backup.catches}));
}

function loadAutomaticBackup(): WamiFishingBackup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY);
    if (!raw) return null;
    const backup = JSON.parse(raw) as WamiFishingBackup;
    if (backup.format !== "WamiFishing Navigator Backup" || backup.version !== 1) return null;
    return backup;
  } catch {
    return null;
  }
}

async function imageFileToDataUrl(file: File) {
  const rawUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Foto konnte nicht gelesen werden."));
      img.src = rawUrl;
    });

    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Foto konnte nicht verarbeitet werden.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.78);
  } finally {
    URL.revokeObjectURL(rawUrl);
  }
}


type PlaceSearchControlProps = {
  value: string;
  busy: boolean;
  onSearch: (term: string) => void | Promise<void>;
  onNearest: () => void | Promise<void>;
  onEdit?: () => void;
  ariaLabel?: string;
};

function PlaceSearchControl({
  value,
  busy,
  onSearch,
  onNearest,
  onEdit,
  ariaLabel = "Ort"
}: PlaceSearchControlProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="forecast-control forecast-location-control">
      <span className="forecast-control-icon" aria-hidden="true">⌖</span>
      <input
        aria-label={ariaLabel}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          onEdit?.();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          void onSearch(draft);
        }}
        placeholder="Ort eingeben · Enter"
        autoComplete="off"
      />
      <button
        className="forecast-nearest-place"
        type="button"
        onClick={() => void onNearest()}
        disabled={busy}
        title="Nächstgelegenen Ort über GPS verwenden"
        aria-label="Nächstgelegenen Ort verwenden"
      >
        {busy ? "…" : "◎"}
      </button>
      <span className="forecast-enter-hint" aria-hidden="true">↵</span>
    </div>
  );
}

function getCurrentGpsPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Standortbestimmung wird von diesem Gerät nicht unterstützt."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 15000
    });
  });
}


async function getNearestPlaceFromGps(): Promise<AtlasPlace> {
  const position = await getCurrentGpsPosition();
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;

  const response = await fetch(
    `/api/geocode?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || "Nächstgelegener Ort konnte nicht ermittelt werden.");
  }

  const result = await response.json() as AtlasPlace;
  return {
    latitude,
    longitude,
    label: result.label || "Aktueller Standort"
  };
}

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

function distanceKmToSegment(
  latitude: number,
  longitude: number,
  start: [number, number],
  end: [number, number]
) {
  const meanLat = ((latitude + start[0] + end[0]) / 3) * Math.PI / 180;
  const kmPerLat = 111.32;
  const kmPerLon = 111.32 * Math.cos(meanLat);
  const px = (longitude - start[1]) * kmPerLon;
  const py = (latitude - start[0]) * kmPerLat;
  const vx = (end[1] - start[1]) * kmPerLon;
  const vy = (end[0] - start[0]) * kmPerLat;
  const lengthSq = vx * vx + vy * vy;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, (px * vx + py * vy) / lengthSq)) : 0;
  const dx = px - t * vx;
  const dy = py - t * vy;
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToWaterKm(water: FishingWater, latitude: number, longitude: number) {
  if (water.route && water.route.length >= 2) {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 1; i < water.route.length; i += 1) {
      best = Math.min(best, distanceKmToSegment(latitude, longitude, water.route[i - 1], water.route[i]));
    }
    if (Number.isFinite(best)) return best;
  }
  if (water.latitude !== null && water.longitude !== null) {
    return distanceKm(latitude, longitude, water.latitude, water.longitude);
  }
  return Number.POSITIVE_INFINITY;
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
  const [atlasOpenedFromForecast, setAtlasOpenedFromForecast] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [catches, setCatches] = useState<EnhancedCatchEntry[]>([]);
  const [catchWaterId, setCatchWaterId] = useState("");
  const [catchPosition, setCatchPosition] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [catchWeather, setCatchWeather] = useState<CatchWeatherSnapshot | null>(null);
  const [catchAutoBusy, setCatchAutoBusy] = useState(false);
  const [catchAutoAttempted, setCatchAutoAttempted] = useState(false);
  const [catchAutoError, setCatchAutoError] = useState("");
  const [catchPhoto, setCatchPhoto] = useState<string | null>(null);
  const [catchPhotoViewer, setCatchPhotoViewer] = useState<{ src: string; title: string } | null>(null);
  const [catchSaveBusy, setCatchSaveBusy] = useState(false);
  const [editingCatchId, setEditingCatchId] = useState<string | null>(null);
  const [rodHandleLengthCm, setRodHandleLengthCm] = useState(48);
  const [measurePhoto, setMeasurePhoto] = useState<string | null>(null);
  const catchFormRef = useRef<HTMLFormElement | null>(null);
  const [freeHotspotBusy, setFreeHotspotBusy] = useState(false);
  const [dataMessage, setDataMessage] = useState("");
  const [localDataReady, setLocalDataReady] = useState(false);
  const [backupStatus, setBackupStatus] = useState("");
  const catchPhotoRef = useRef<HTMLInputElement | null>(null);
  const backupImportRef = useRef<HTMLInputElement | null>(null);
  const [importedSpots, setImportedSpots] = useState<FishingSpot[]>([]);
  const [userParkings, setUserParkings] = useState<UserParkingSpot[]>([]);
  const [userHotspots, setUserHotspots] = useState<UserFishingSpot[]>([]);
  const [atlasPointSaving, setAtlasPointSaving] = useState<"parking" | "hotspot" | null>(null);
  const [atlasPointMessage, setAtlasPointMessage] = useState("");
  const parkingPhotoRef = useRef<HTMLInputElement | null>(null);
  const hotspotPhotoRef = useRef<HTMLInputElement | null>(null);
  const [forecastFish, setForecastFish] = useState<Fish>("Zander");
  const [forecastQuery, setForecastQuery] = useState("");
  const [forecastPlace, setForecastPlace] = useState<AtlasPlace | null>(null);
  const [forecastBusy, setForecastBusy] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [forecastHours, setForecastHours] = useState<ForecastHour[]>([]);
  const [forecastDate, setForecastDate] = useState("");
  const [forecastSort, setForecastSort] = useState<"score" | "distance" | "name">("score");
  const [showAllForecast, setShowAllForecast] = useState(false);

  useEffect(() => {
    let active = true;
    const initialFavorites = loadFavorites();
    const savedHandleLength=Number(localStorage.getItem("wamifishing:rod-handle-length-cm"));
    if(Number.isFinite(savedHandleLength)&&savedHandleLength>0)setRodHandleLengthCm(savedHandleLength);
    const storedCatches = loadCatches() as EnhancedCatchEntry[];
    setFavorites(initialFavorites);

    void Promise.all([
      hydrateCatchPhotos(storedCatches),
      hydrateAndMigrateAtlasPoints<UserParkingSpot>(USER_PARKINGS_KEY),
      hydrateAndMigrateAtlasPoints<UserFishingSpot>(USER_HOTSPOTS_KEY)
    ]).then(([hydratedCatches, parkings, hotspots]) => {
      if (!active) return;
      setCatches(hydratedCatches);
      setUserParkings(parkings);
      setUserHotspots(hotspots);
      setLocalDataReady(true);
    }).catch((error) => {
      console.error("Lokale WamiFishing-Daten konnten nicht vollständig geladen werden:", error);
      if (active) {
        setCatches(storedCatches);
        setLocalDataReady(true);
      }
    });

    return () => { active = false; };
  }, []);

  // Laufende automatische Sicherung im Browser. Sie wird nach jeder Änderung
  // an Favoriten, Fangbuch, Parkplätzen oder Hot Spots aktualisiert.
  useEffect(() => {
    if (!localDataReady) return;
    const timer = window.setTimeout(() => {
      const backup: WamiFishingBackup = {
        format: "WamiFishing Navigator Backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        favorites,
        catches,
        parkings: userParkings,
        hotspots: userHotspots
      };
      try {
        saveAutomaticBackup(backup);
        const catchPhotos=catches.filter(entry=>Boolean(entry.photo)).length;
        setBackupStatus(`✓ Automatisch gesichert: ${catches.length} Fänge · ${catchPhotos} Fangfotos · ${userHotspots.length} Hot Spots · ${userParkings.length} Parkplätze`);
      } catch (error) {
        console.error("Automatische Datensicherung konnte nicht aktualisiert werden:", error);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [localDataReady, favorites, catches, userParkings, userHotspots]);

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

  async function searchWatersPlace(searchTerm?: string) {
    const term = (searchTerm ?? query).trim();
    if (!term) return;
    setQuery(term);
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


  async function useNearestWaterPlace() {
    setWaterSearchBusy(true);
    setWaterSearchError("");
    try {
      const place = await getNearestPlaceFromGps();
      setQuery(place.label);
      setWaterPlace(place);
      setFocusedWaterId(null);
    } catch (error) {
      setWaterSearchError(error instanceof Error ? error.message : "Standort konnte nicht bestimmt werden");
    } finally {
      setWaterSearchBusy(false);
    }
  }

const atlasWaters = useMemo(() => {
  return waters
    .filter((water) => {
      if (!atlasPlace) return true;
      if (water.latitude === null || water.longitude === null) return false;
      return distanceKm(atlasPlace.latitude, atlasPlace.longitude, water.latitude, water.longitude) <= ATLAS_RADIUS_KM;
    })
    .filter((water) => atlasCategory !== "elbe" || Boolean(water.route?.length))
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
}, [atlasPlace, atlasFish, atlasCategory]);

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

  async function searchAtlasPlace(searchTerm?: string) {
    setAtlasOpenedFromForecast(false);
    const term = (searchTerm ?? atlasQuery).trim();
    if (!term) return;
    setAtlasQuery(term);

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
    setAtlasOpenedFromForecast(false);
    setAtlasQuery("");
    setAtlasPlace(null);
    setAtlasFish("Alle");
    setAtlasCategory("all");
    setAtlasSearchError("");
    setFocusedWaterId(null);
  }


  async function useNearestAtlasPlace() {
    setAtlasOpenedFromForecast(false);
    setAtlasSearchBusy(true);
    setAtlasSearchError("");
    try {
      const place = await getNearestPlaceFromGps();
      setAtlasQuery(place.label);
      setAtlasPlace(place);
      setFocusedWaterId(null);
    } catch (error) {
      setAtlasSearchError(error instanceof Error ? error.message : "Standort konnte nicht bestimmt werden");
    } finally {
      setAtlasSearchBusy(false);
    }
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

  const SimilarCatchDiagnostic = ({ water, hour }: { water: FishingWater; hour: ForecastHour }) => {
    const [open, setOpen] = useState(false);
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

    useEffect(() => {
      if (!open) return;
      const oldOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
      window.addEventListener("keydown", handleKeyDown);
      return () => { document.body.style.overflow = oldOverflow; window.removeEventListener("keydown", handleKeyDown); };
    }, [open]);

    const modal = open && typeof document !== "undefined" ? createPortal(
      <div className="forecast-activity-modal-backdrop" onClick={() => setOpen(false)}>
        <div className="forecast-activity-modal" role="dialog" aria-modal="true" aria-label={`Ähnliche ${forecastFish}fänge in ${water.name}`} onClick={(event) => event.stopPropagation()}>
          <button type="button" className="forecast-activity-close" aria-label="Fanginfo schließen" onClick={() => setOpen(false)}>×</button>
          <h3>Ähnliche {forecastFish}fänge<br />in diesem Gewässer</h3>
          <div className="forecast-activity-direct-check">
            Aktuelles Gewässer: <strong>{water.name}</strong>
            <small>Vergleich zur besten Prognosezeit {new Date(hour.time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr</small>
          </div>
          <b className="forecast-activity-count">{local.length} passende Einzelfänge</b>
          {local.length ? <ul className="forecast-activity-modal-list">{local.slice(0, 20).map((event, index) => <li key={`${water.id}-similar-${event.caughtAt}-${index}`}>
            <span><strong>{event.caughtAt ? new Date(event.caughtAt).toLocaleDateString("de-DE") : "Fang"}</strong><small>{event.weather?.temperatureC != null ? `${Math.round(event.weather.temperatureC)} °C` : "–"} · {event.weather?.pressureHpa != null ? `${Math.round(event.weather.pressureHpa)} hPa` : "–"} · {event.weather?.windKmh != null ? `${Math.round(event.weather.windKmh)} km/h Wind` : "–"} · {event.weather?.cloudCoverPct != null ? `${Math.round(event.weather.cloudCoverPct)} % Wolken` : "–"}</small></span>
            <b>{event.timePrecision === "exact" ? "exakt" : event.timePrecision === "daypart" ? "Tageszeit" : "Fang"}</b>
          </li>)}</ul> : <p>Für dieses Gewässer gibt es aktuell keine verwertbaren {forecastFish}-Einzelfänge bei vergleichbaren Wetterbedingungen.</p>}
          <div className="forecast-activity-note"><span>ⓘ</span><small>Ähnlich bedeutet: Temperatur ±4 °C, Luftdruck ±8 hPa, Wind ±8 km/h und Bewölkung ±30 %. Berücksichtigt werden nur verwertbare Einzelfänge mit ausreichender Datenqualität. Die Treffer beeinflussen den 0–100-Score derzeit nicht.</small></div>
        </div>
      </div>, document.body) : null;

    return <>
      <span className="forecast-activity-diagnostic" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="forecast-activity-info-button" aria-label={`Ähnliche Fänge in ${water.name} anzeigen`} title="Ähnliche Fänge in diesem Gewässer anzeigen" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true); }}>i</button>
      </span>
      {modal}
    </>;
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
    setAtlasOpenedFromForecast(true);
    setView("atlas");
  }

  async function loadForecast(searchTerm?: string) {
    const term = (searchTerm ?? forecastQuery).trim();
    if (!term) return;
    setForecastQuery(term);
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

  async function useNearestForecastPlace() {
    setForecastBusy(true);
    setForecastError("");
    try {
      const place = await getNearestPlaceFromGps();
      setForecastQuery(place.label);
      setForecastPlace(place);

      const weather = await fetch(`/api/weather?lat=${place.latitude}&lon=${place.longitude}`);
      if (!weather.ok) throw new Error("Wetterdaten nicht verfügbar");
      const data = await weather.json() as { hours: ForecastHour[] };
      setForecastHours(data.hours || []);
      const availableDates = Array.from(new Set((data.hours || []).map((hour) => hour.time.slice(0, 10))));
      if (!forecastDate || !availableDates.includes(forecastDate)) {
        setForecastDate(availableDates[0] || "");
      }
    } catch (error) {
      setForecastError(error instanceof Error ? error.message : "Standort konnte nicht bestimmt werden");
    } finally {
      setForecastBusy(false);
    }
  }

  useEffect(() => { if (view === "forecast" && !forecastPlace && !forecastBusy) void loadForecast(); }, [view]);
  const focusedWater = focusedWaterId === selected.id && selected.latitude !== null && selected.longitude !== null ? selected : null;
  const mapWaters = focusedWater ? [focusedWater] : filtered;
  const selectedUserParkings = userParkings.filter((parking) => parking.waterId === selected.id);
  const selectedUserHotspots = userHotspots.filter((spot) => spot.waterId === selected.id);
  const visibleSpots = focusedWater ? [...selected.spots, ...selectedUserHotspots, ...importedSpots] : [];
  const visibleParkings = focusedWater ? [...(selected.parkings ?? []), ...selectedUserParkings] : [];
  const mappedCount = filtered.filter((water) => water.latitude !== null && water.longitude !== null).length;

  async function saveFreeHotspotAtCurrentLocation() {
    setFreeHotspotBusy(true);
    setAtlasPointMessage("");
    try {
      const position = await getCurrentGpsPosition();
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const accuracyM = Math.round(position.coords.accuracy);

      const nearest = waters
        .map((water) => ({ water, distance: distanceToWaterKm(water, latitude, longitude) }))
        .filter((item) => Number.isFinite(item.distance))
        .sort((a, b) => a.distance - b.distance)[0];

      // Avoid silently assigning a point to an unrelated water.
      if (!nearest || nearest.distance > 0.35) {
        setAtlasPointMessage("⚠ Kein Gewässer eindeutig in unmittelbarer Nähe erkannt. Hot Spot wurde nicht gespeichert.");
        return;
      }

      const item: UserFishingSpot = {
        id: `user-hotspot-${crypto.randomUUID()}`,
        waterId: nearest.water.id,
        name: "Eigener Hot Spot",
        latitude,
        longitude,
        tags: ["Eigener Hot Spot", "GPS frei erkannt"],
        note: `Freie GPS-Ortserkennung · ${nearest.water.name} · Abstand zum Gewässer ca. ${Math.round(nearest.distance * 1000)} m · GPS-Genauigkeit ca. ${accuracyM} m`,
        source: "Benutzer",
        createdAt: new Date().toISOString(),
        accuracyM
      };

      const next = [...userHotspots, item];
      saveLocalArray(USER_HOTSPOTS_KEY, withoutPhoto(next));
      setUserHotspots(next);
      setSelected(nearest.water);
      setFocusedWaterId(nearest.water.latitude !== null && nearest.water.longitude !== null ? nearest.water.id : null);
      setAtlasPointMessage(`✅ Hot Spot gespeichert · ${nearest.water.name} · ca. ${Math.round(nearest.distance * 1000)} m vom Gewässer.`);
    } catch (error) {
      const geoCode = typeof error === "object" && error !== null && "code" in error
        ? Number((error as { code?: number }).code)
        : 0;
      setAtlasPointMessage(`⚠ ${geoCode === 1 ? "Standortfreigabe wurde nicht erteilt." : "Standort konnte nicht bestimmt werden."}`);
    } finally {
      setFreeHotspotBusy(false);
    }
  }

  async function saveAtlasPoint(kind: "parking" | "hotspot", file: File) {
    setAtlasPointSaving(kind);
    setAtlasPointMessage("");

    try {
      const [position, photo] = await Promise.all([
        getCurrentGpsPosition(),
        imageFileToDataUrl(file)
      ]);

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const accuracyM = Math.round(position.coords.accuracy);
      const createdAt = new Date().toISOString();

      if (kind === "parking") {
        const item: UserParkingSpot = {
          id: `user-parking-${crypto.randomUUID()}`,
          waterId: selected.id,
          name: "Eigener Parkplatz",
          latitude,
          longitude,
          access: "public",
          accuracy: "verified",
          note: `Eigene GPS-Position · Genauigkeit ca. ${accuracyM} m`,
          photo,
          createdAt,
          accuracyM
        };
        const next = [...userParkings, item];
        await putAtlasPhoto(item.id, photo);
        saveLocalArray(USER_PARKINGS_KEY, withoutPhoto(next));
        setUserParkings(next);
        setAtlasPointMessage("✅ Parkplatz mit Position und Foto dauerhaft gespeichert.");
      } else {
        const item: UserFishingSpot = {
          id: `user-hotspot-${crypto.randomUUID()}`,
          waterId: selected.id,
          name: "Eigener Hot Spot",
          latitude,
          longitude,
          tags: ["Eigener Hot Spot"],
          note: `Eigene GPS-Position · Genauigkeit ca. ${accuracyM} m`,
          source: "Benutzer",
          photo,
          createdAt,
          accuracyM
        };
        const next = [...userHotspots, item];
        await putAtlasPhoto(item.id, photo);
        saveLocalArray(USER_HOTSPOTS_KEY, withoutPhoto(next));
        setUserHotspots(next);
        setAtlasPointMessage("✅ Hot Spot mit Position und Foto dauerhaft gespeichert.");
      }

      if (selected.latitude !== null && selected.longitude !== null) {
        setFocusedWaterId(selected.id);
      }
    } catch (error) {
      const geoCode = typeof error === "object" && error !== null && "code" in error
        ? Number((error as { code?: number }).code)
        : 0;
      const message = geoCode === 1
        ? "Standortfreigabe wurde nicht erteilt."
        : geoCode
          ? "Standort konnte nicht bestimmt werden."
          : error instanceof Error
            ? error.message
            : "Position und Foto konnten nicht gespeichert werden.";
      setAtlasPointMessage(`⚠ ${message}`);
    } finally {
      setAtlasPointSaving(null);
    }
  }

  function handleAtlasPhoto(kind: "parking" | "hotspot", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void saveAtlasPoint(kind, file);
  }

  async function deleteUserParking(id: string) {
    const next = userParkings.filter((item) => item.id !== id);
    try {
      saveLocalArray(USER_PARKINGS_KEY, withoutPhoto(next));
      await deleteAtlasPhoto(id);
      setUserParkings(next);
    } catch {
      setAtlasPointMessage("⚠ Parkplatz konnte nicht vollständig gelöscht werden.");
    }
  }

  async function deleteUserHotspot(id: string) {
    const next = userHotspots.filter((item) => item.id !== id);
    try {
      saveLocalArray(USER_HOTSPOTS_KEY, withoutPhoto(next));
      await deleteAtlasPhoto(id);
      setUserHotspots(next);
    } catch {
      setAtlasPointMessage("⚠ Hot Spot konnte nicht vollständig gelöscht werden.");
    }
  }

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
          .map((water) => ({
            water,
            distance: distanceToWaterKm(water, latitude, longitude)
          }))
          .filter((item) => Number.isFinite(item.distance))
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

  async function saveCatchPhotoToPhotoApp(photo:string, fishName?:string) {
    try {
      const response=await fetch(photo); const blob=await response.blob();
      const file=new File([blob],`WAMIFISHING-${(fishName||"Fang").replace(/[^\p{L}\p{N}_-]+/gu,"-")}-${new Date().toISOString().slice(0,10)}.jpg`,{type:blob.type||"image/jpeg"});
      if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) {
        await navigator.share({files:[file],title:"WAMIFISHING Fangfoto"});
      } else {
        const url=URL.createObjectURL(blob); const a=document.createElement("a");
        a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
        setDataMessage("📷 Fangfoto gespeichert. Auf iPhone/iPad anschließend über Teilen → Bild sichern in Fotos übernehmen.");
      }
    } catch(error) {
      if((error as Error)?.name!=="AbortError") setDataMessage("⚠ Fangfoto konnte nicht an die Foto-App übergeben werden.");
    }
  }

  async function addCatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const existing = editingCatchId ? catches.find((item) => item.id === editingCatchId) : undefined;
    const caughtAtValue = String(form.get("caughtAt") || "");
    const caughtAt = caughtAtValue ? new Date(caughtAtValue).toISOString() : (existing?.caughtAt ?? new Date().toISOString());
    const moon = moonInfoFor(new Date(caughtAt));
    const savePosition = form.get("savePosition") === "on";
    const waterId = catchWaterId || String(form.get("waterId") || "");
    if (!waterId) {
      setCatchAutoError("Bitte ein Gewässer auswählen.");
      return;
    }

    const entry: EnhancedCatchEntry = {
      ...(existing ?? {}),
      id: existing?.id ?? crypto.randomUUID(),
      caughtAt,
      waterId,
      fish: String(form.get("fish")) as Fish,
      lengthCm: Number(form.get("lengthCm")) || undefined,
      weightKg: Number(form.get("weightKg")) || undefined,
      lure: String(form.get("lure") || ""),
      note: String(form.get("note") || ""),
      method: String(form.get("method") || "") || undefined,
      depthM: Number(form.get("depthM")) || undefined,
      weather: existing?.weather ?? catchWeather ?? undefined,
      moonPhase: moon.phase,
      moonIllumination: moon.illumination,
      latitude: savePosition ? (existing?.latitude ?? catchPosition?.latitude) : undefined,
      longitude: savePosition ? (existing?.longitude ?? catchPosition?.longitude) : undefined,
      locationAccuracyM: savePosition ? (existing?.locationAccuracyM ?? catchPosition?.accuracy) : undefined,
      locationSource: savePosition && (existing?.latitude != null || catchPosition) ? "gps" : "manual"
    };

    setCatchSaveBusy(true);
    setCatchAutoError("");
    try {
      const finalPhoto = catchPhoto ?? existing?.photo;
      if (finalPhoto) await putDbPhoto(CATCH_PHOTO_STORE, entry.id, finalPhoto);
      const withPhotoEntry = { ...entry, photo: finalPhoto ?? undefined };
      const next = existing
        ? catches.map((item) => item.id === existing.id ? withPhotoEntry : item)
        : [withPhotoEntry, ...catches];

      saveCatches(withoutPhoto(next) as EnhancedCatchEntry[]);
      setCatches(next);
      setCatchPhoto(null);
      setEditingCatchId(null);
      formElement.reset();
      setCatchWaterId("");
    } catch (error) {
      setCatchAutoError(error instanceof Error ? error.message : "Fang konnte nicht dauerhaft gespeichert werden.");
    } finally {
      setCatchSaveBusy(false);
    }
  }

  function editCatch(entry: EnhancedCatchEntry) {
    setEditingCatchId(entry.id);
    setCatchWaterId(entry.waterId);
    setCatchPhoto(entry.photo ?? null);

    window.setTimeout(() => {
      const form = catchFormRef.current;
      if (!form) return;
      const setValue = (name: string, value: string | number | undefined) => {
        const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (field) field.value = value == null ? "" : String(value);
      };
      const localDate = new Date(entry.caughtAt);
      const offsetMs = localDate.getTimezoneOffset() * 60000;
      setValue("caughtAt", new Date(localDate.getTime() - offsetMs).toISOString().slice(0, 16));
      setValue("fish", entry.fish);
      setValue("lengthCm", entry.lengthCm);
      setValue("weightKg", entry.weightKg);
      setValue("method", entry.method);
      setValue("lure", entry.lure);
      setValue("depthM", entry.depthM);
      setValue("note", entry.note);
      const savePosition = form.elements.namedItem("savePosition") as HTMLInputElement | null;
      if (savePosition) savePosition.checked = entry.latitude != null && entry.longitude != null;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function cancelCatchEdit() {
    setEditingCatchId(null);
    setCatchPhoto(null);
    setCatchWaterId("");
    catchFormRef.current?.reset();
  }

  async function handleCatchPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setCatchPhoto(await imageFileToDataUrl(file));
    } catch (error) {
      setCatchAutoError(error instanceof Error ? error.message : "Fangfoto konnte nicht verarbeitet werden.");
    }
  }

  async function exportCurrentBackupJson() {
    setDataMessage("");
    try {
      // Wichtig: Fotos direkt aus IndexedDB ergänzen, nicht nur aus dem React-State.
      const catchesWithPhotos = await Promise.all(catches.map(async (entry) => ({
        ...entry,
        photo: entry.photo ?? await getDbPhoto(CATCH_PHOTO_STORE, entry.id)
      })));
      const parkingsWithPhotos = await Promise.all(userParkings.map(async (entry) => ({
        ...entry,
        photo: entry.photo ?? await getAtlasPhoto(entry.id)
      })));
      const hotspotsWithPhotos = await Promise.all(userHotspots.map(async (entry) => ({
        ...entry,
        photo: entry.photo ?? await getAtlasPhoto(entry.id)
      })));

      const backup: WamiFishingBackup = {
        format: "WamiFishing Navigator Backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        favorites,
        catches: catchesWithPhotos,
        parkings: parkingsWithPhotos,
        hotspots: hotspotsWithPhotos
      };

      const catchPhotos = catchesWithPhotos.filter((entry) => Boolean(entry.photo)).length;
      const blob = new Blob([JSON.stringify(backup)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wamifishing-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      // Dieselbe geprüfte Struktur zugleich als automatische Sicherung ablegen.
      saveAutomaticBackup(backup);
      setBackupStatus(`✓ JSON gesichert: ${catchesWithPhotos.length} Fänge · ${catchPhotos} Fangfotos · ${hotspotsWithPhotos.length} Hot Spots · ${parkingsWithPhotos.length} Parkplätze`);
      setDataMessage(`✅ JSON erstellt: ${catchesWithPhotos.length} Fänge · ${catchPhotos} Fangfotos · ${hotspotsWithPhotos.length} Hot Spots · ${parkingsWithPhotos.length} Parkplätze`);
    } catch (error) {
      console.error("JSON-Sicherung fehlgeschlagen:", error);
      setDataMessage("⚠ JSON-Sicherung konnte nicht erstellt werden.");
    }
  }

  async function restoreAutomaticBackup() {
    setDataMessage("");
    try {
      const backup = loadAutomaticBackup();
      if (!backup) {
        setDataMessage("⚠ Noch keine automatische Datensicherung vorhanden.");
        return;
      }

      if ((!backup.catches || backup.catches.length===0) && typeof window!=="undefined") {
        try {
          const fallback=JSON.parse(localStorage.getItem(AUTO_CATCH_BACKUP_KEY)||"null");
          if(Array.isArray(fallback?.catches)&&fallback.catches.length>0) backup.catches=fallback.catches;
        } catch {}
      }
      for (const entry of backup.catches) if (entry.photo) await putDbPhoto(CATCH_PHOTO_STORE, entry.id, entry.photo);
      for (const item of backup.parkings) if (item.photo) await putAtlasPhoto(item.id, item.photo);
      for (const item of backup.hotspots) if (item.photo) await putAtlasPhoto(item.id, item.photo);

      const restoredCatches = backup.catches.map(({ photo, ...entry }) => entry) as EnhancedCatchEntry[];
      const restoredParkings = withoutPhoto(backup.parkings) as UserParkingSpot[];
      const restoredHotspots = withoutPhoto(backup.hotspots) as UserFishingSpot[];

      saveCatches(restoredCatches);
      saveFavorites(Array.isArray(backup.favorites) ? backup.favorites : []);
      saveLocalArray(USER_PARKINGS_KEY, restoredParkings);
      saveLocalArray(USER_HOTSPOTS_KEY, restoredHotspots);

      setFavorites(Array.isArray(backup.favorites) ? backup.favorites : []);
      setCatches(backup.catches);
      setUserParkings(backup.parkings);
      setUserHotspots(backup.hotspots);
      setDataMessage(`✅ Automatische Sicherung wiederhergestellt: ${backup.catches.length} Fänge, ${backup.parkings.length} Parkplätze, ${backup.hotspots.length} Hot Spots.`);
    } catch (error) {
      setDataMessage(`⚠ ${error instanceof Error ? error.message : "Automatische Sicherung konnte nicht wiederhergestellt werden."}`);
    }
  }

  async function importDataBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setDataMessage("");
    try {
      const backup = JSON.parse(await file.text()) as WamiFishingBackup;
      if (!["WamiFishing Navigator Backup", "HarzFishing Navigator Backup"].includes(backup.format) || backup.version !== 1 ||
          !Array.isArray(backup.catches) || !Array.isArray(backup.parkings) || !Array.isArray(backup.hotspots)) {
        throw new Error("Die Datei ist keine gültige WamiFishing-Datensicherung.");
      }

      for (const entry of backup.catches) if (entry.photo) await putDbPhoto(CATCH_PHOTO_STORE, entry.id, entry.photo);
      for (const item of backup.parkings) if (item.photo) await putAtlasPhoto(item.id, item.photo);
      for (const item of backup.hotspots) if (item.photo) await putAtlasPhoto(item.id, item.photo);

      const restoredCatches = backup.catches.map(({ photo, ...entry }) => entry) as EnhancedCatchEntry[];
      const restoredParkings = withoutPhoto(backup.parkings) as UserParkingSpot[];
      const restoredHotspots = withoutPhoto(backup.hotspots) as UserFishingSpot[];
      saveCatches(restoredCatches);
      saveFavorites(Array.isArray(backup.favorites) ? backup.favorites : []);
      saveLocalArray(USER_PARKINGS_KEY, restoredParkings);
      saveLocalArray(USER_HOTSPOTS_KEY, restoredHotspots);

      setFavorites(Array.isArray(backup.favorites) ? backup.favorites : []);
      setCatches(backup.catches);
      setUserParkings(backup.parkings);
      setUserHotspots(backup.hotspots);
      setDataMessage(`✅ Datensicherung wiederhergestellt: ${backup.catches.length} Fänge, ${backup.parkings.length} Parkplätze, ${backup.hotspots.length} Hot Spots.`);
    } catch (error) {
      setDataMessage(`⚠ ${error instanceof Error ? error.message : "Datensicherung konnte nicht wiederhergestellt werden."}`);
    }
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
        <button className="brand" onClick={() => setView("dashboard")}><span>🎣</span><div><strong>WamiFishing</strong><small>WAMIFISHING V5.4 Beta</small></div></button>
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
        <div className="hero-card"><p className="eyebrow">WAMIFISHING</p><h1>Dein Angelrevier auf einer Karte.</h1><p>Bodetalsperren, LAV-Gewässer, Harzflüsse, Fangbuch, GPX und eine transparente, regelbasierte Angelprognose.</p><button onClick={()=>setView("waters")}>Gewässer entdecken</button></div>
        <div className="dashboard-grid">
          <article role="button" tabIndex={0} onClick={()=>setView("waters")}><span>🗺️</span><strong>{waters.length}</strong><p>Gewässerprofile im Katalog</p></article>
          <article role="button" tabIndex={0} onClick={()=>setView("waters")}><span>⭐</span><strong>{favorites.length}</strong><p>gespeicherte Favoriten</p></article>
          <article role="button" tabIndex={0} onClick={()=>setView("diary")}><span>🐟</span><strong>{catches.length}</strong><p>Fänge im Fangbuch</p></article>
          <article role="button" tabIndex={0} onClick={()=>setView("atlas")}><span>📍</span><strong>{userHotspots.length + userParkings.length}</strong><p>eigene Hotspots & Parkplätze</p></article>
        </div>
        <div className="panel"><h2>Automatische Prognose</h2><p>Ort und Zielfisch wählen: WamiFishing bewertet passende Gewässer im 20-km-Umkreis automatisch anhand der Wetterdaten.</p></div>
      </section>}
{view === "atlas" && (
  <section className="atlas-page">

    <aside className="atlas-sidebar">
      <h2>Angelatlas</h2>

      <div
        className="forecast-controls-modern waters-search-controls"
        style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, width: "100%" }}
      >
        <PlaceSearchControl
          value={atlasQuery}
          busy={atlasSearchBusy}
          onSearch={searchAtlasPlace}
          onNearest={useNearestAtlasPlace}
          onEdit={() => setAtlasSearchError("")}
        />
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
      <div className="atlas-special-filter atlas-free-location-action">
        <button
          type="button"
          onClick={()=>void saveFreeHotspotAtCurrentLocation()}
          disabled={freeHotspotBusy || atlasPointSaving !== null}
        >
          {freeHotspotBusy ? "⌖ Standort wird erkannt …" : "⌖ Hot Spot hier speichern"}
          <small>Ohne Gewässerauswahl · GPS ordnet automatisch zu</small>
        </button>
      </div>
      {(atlasPlace || atlasFish !== "Alle" || atlasCategory !== "all") && <button type="button" className="forecast-reset-filter" onClick={resetAtlasFilters}>× Filter aufheben</button>}
      {atlasPlace && <div className="forecast-meta-modern waters-search-meta"><div><strong>Atlas rund um {atlasPlace.label}</strong><span>20 km · {atlasWaters.length} passende Gewässer</span></div></div>}
      {atlasSearchError && <p className="forecast-error">⚠ {atlasSearchError}</p>}

      {!atlasOpenedFromForecast && (
        <>
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
              🅿 {water.parkings.length + userParkings.filter((item) => item.waterId === water.id).length} · 📍 {water.spots.length + userHotspots.filter((item) => item.waterId === water.id).length}
            </span>
          </button>
        ))}
      </div>
        </>
      )}
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
        <span>🅿️ {selected.parkings.length + selectedUserParkings.length} Parkplätze</span>
        <span>📍 {selected.spots.length + selectedUserHotspots.length} Erkundungspunkte</span>
      </div>

      {selected.route?.length ? (
        <div className="elbe-permission-card">
          <strong>🌊 Elbe-km {selected.riverKm}</strong>
          <span>{selected.bankSide === "both" ? "✅ Beide Ufer LAV-Strecke" : selected.bankSide === "left" ? "⬅️ Nur linkes Ufer LAV-Strecke" : "➡️ Nur rechtes Ufer LAV-Strecke"}</span>
          {selected.restrictions?.map((item) => <small key={item}>⚠ {item}</small>)}
          <small>Maßgeblich sind Gewässerverzeichnis, aktuelle LAV-Ergänzungen und Beschilderung vor Ort.</small>
        </div>
      ) : null}

      {selected.latitude !== null && selected.longitude !== null ? (
        <div className="atlas-primary-actions">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer">Google Navigation</a>
          <a href={`https://maps.apple.com/?daddr=${selected.latitude},${selected.longitude}&dirflg=d`} target="_blank" rel="noreferrer">Apple Navigation</a>
        </div>
      ) : (
        <p className="atlas-empty-note">Für dieses Gewässer ist noch keine Kartenposition gespeichert.</p>
      )}

      <div className="atlas-save-point-actions">
        <button
          type="button"
          onClick={() => parkingPhotoRef.current?.click()}
          disabled={atlasPointSaving !== null}
        >
          {atlasPointSaving === "parking" ? "📷 Speichere…" : "🅿️ Parkplatz speichern"}
          <small>Position + Foto</small>
        </button>
        <button
          type="button"
          onClick={() => hotspotPhotoRef.current?.click()}
          disabled={atlasPointSaving !== null}
        >
          {atlasPointSaving === "hotspot" ? "📷 Speichere…" : "📍 Hot Spot speichern"}
          <small>Position + Foto</small>
        </button>
        <input
          ref={parkingPhotoRef}
          className="atlas-hidden-photo-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => handleAtlasPhoto("parking", event)}
        />
        <input
          ref={hotspotPhotoRef}
          className="atlas-hidden-photo-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => handleAtlasPhoto("hotspot", event)}
        />
      </div>
      {atlasPointMessage && <p className="atlas-point-message">{atlasPointMessage}</p>}

      {(selected.parkings.length > 0 || selectedUserParkings.length > 0) && (
        <>
          <h3>Parkplätze / Ausgangspunkte</h3>
          <div className="atlas-nav-list">
            {[...selected.parkings.slice(0, 1), ...selectedUserParkings].map((parking) => {
              const own = "waterId" in parking;
              const ownParking = own ? parking as UserParkingSpot : null;
              return (
                <article key={parking.id}>
                  {ownParking?.photo && <img className="atlas-point-photo" src={ownParking.photo} alt="Foto des gespeicherten Parkplatzes" />}
                  <strong>{parking.name}</strong>
                  <small>{parking.note ?? (parking.access === "public" ? "Öffentlicher Parkplatz" : "Zufahrt eingeschränkt")}</small>
                  <div className="atlas-row-actions">
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${parking.latitude},${parking.longitude}&travelmode=driving`} target="_blank" rel="noreferrer">Google Auto</a>
                    <a href={`https://maps.apple.com/?daddr=${parking.latitude},${parking.longitude}&dirflg=d`} target="_blank" rel="noreferrer">Apple Auto</a>
                    {ownParking && <button type="button" onClick={() => deleteUserParking(parking.id)}>Löschen</button>}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {(selected.spots.length > 0 || selectedUserHotspots.length > 0) && (
        <>
          <h3>Erkundungspunkte</h3>
          <div className="atlas-nav-list">
            {[...selected.spots, ...selectedUserHotspots].map((spot) => {
              const parking = [...selected.parkings, ...selectedUserParkings].find((item) => item.id === spot.parkingId);
              const ownSpot = "waterId" in spot ? spot as UserFishingSpot : null;
              return (
                <article key={spot.id}>
                  {ownSpot?.photo && <img className="atlas-point-photo" src={ownSpot.photo} alt="Foto des gespeicherten Hot Spots" />}
                  <strong>{spot.name}</strong>
                  <small>{spot.risk ?? spot.note ?? "Zugang vor Ort prüfen."}</small>
                  <div className="atlas-row-actions">
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=walking`} target="_blank" rel="noreferrer">Zu Fuß ab Standort</a>
                    {parking && <a href={`https://www.google.com/maps/dir/?api=1&origin=${parking.latitude},${parking.longitude}&destination=${spot.latitude},${spot.longitude}&travelmode=walking`} target="_blank" rel="noreferrer">Ab Parkplatz</a>}
                    {ownSpot && <button type="button" onClick={() => deleteUserHotspot(spot.id)}>Löschen</button>}
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
        persistentRouteWaters={waters.filter((water) => Boolean((water.waterwayName && water.route?.length) || water.osmFeatureId))}
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
          <PlaceSearchControl
            value={query}
            busy={waterSearchBusy}
            onSearch={searchWatersPlace}
            onNearest={useNearestWaterPlace}
            onEdit={() => setWaterSearchError("")}
          />
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
          <div className="map-panel"><MapView waters={mapWaters} persistentRouteWaters={waters.filter((water) => Boolean((water.waterwayName && water.route?.length) || water.osmFeatureId))} spots={visibleSpots} parkings={visibleParkings} selectedWater={focusedWater} onSelect={selectAndFocus}/><div className="map-note">{focusedWater ? <><strong>{selected.name}</strong><span>{visibleParkings.length} Parkplatz{visibleParkings.length === 1 ? "" : "plätze"} · {visibleSpots.length} Hotspot{visibleSpots.length === 1 ? "" : "s"}</span><button type="button" onClick={()=>setFocusedWaterId(null)}>Alle Gewässer zeigen</button></> : <>{selected.latitude === null || selected.longitude === null ? <span>Für dieses Gewässer ist noch keine geprüfte Kartenposition gespeichert.</span> : <span>{mappedCount} von {filtered.length} Treffern sind bereits kartiert. Gewässer anklicken, um Parkplätze und Hotspots zu öffnen.</span>}</>}</div></div>
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
            <PlaceSearchControl
              value={forecastQuery}
              busy={forecastBusy}
              onSearch={loadForecast}
              onNearest={useNearestForecastPlace}
              onEdit={() => setForecastError("")}
            />
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
                <SimilarCatchDiagnostic water={bestForecast.water} hour={bestForecast.best.hour} />
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
                    <span className="forecast-catch-mini-line">🎣 <b>Ähnliche Fänge Gewässer</b> <SimilarCatchDiagnostic water={water} hour={best.hour} /></span>
                    <span className="forecast-catch-mini-line">📊 <b>Ähnliche Fänge Umkreis 20 km</b> <ActivityDiagnostic water={water} compact /></span>
                  </div>
                </div>
                <span className="forecast-score small">{best.result.score}/100</span><span className="forecast-open-arrow" aria-hidden="true">›</span>
                <div className="forecast-catch-compact forecast-other-catch-mobile">
                  <div className="forecast-catch-compact-row">
                    <span aria-hidden="true">🎣</span>
                    <b>Ähnliche Fänge Gewässer</b>
                    <SimilarCatchDiagnostic water={water} hour={best.hour} />
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
        const selectedCatchDistance = selectedCatchWater && catchPosition
          ? distanceToWaterKm(selectedCatchWater, catchPosition.latitude, catchPosition.longitude)
          : null;
        return <section className="page diary diary-v2">
          <form ref={catchFormRef} className="panel catch-entry-card" onSubmit={addCatch}>
            <div className="catch-entry-head">
              <div><p className="eyebrow">Lokales Fangbuch</p><h1>{editingCatchId ? "Fang bearbeiten" : "Fang eintragen"}</h1><p>{editingCatchId ? "Bestehenden Eintrag ergänzen oder korrigieren." : "Standort, Gewässer, Wetter und Mondphase werden automatisch vorbereitet."}</p></div>
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
              <label className="wide">Gewässer <select name="waterId" value={catchWaterId} onChange={(event)=>setCatchWaterId(event.target.value)} required><option value="">Gewässer auswählen …</option>{waters.slice().sort((a,b)=>a.name.localeCompare(b.name,"de")).map((water)=><option value={water.id} key={water.id}>{water.name}{water.lavNumber ? ` · ${water.lavNumber}` : ""}</option>)}</select></label><label className="wide">Datum / Uhrzeit <input name="caughtAt" type="datetime-local" defaultValue={new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}/></label>
              <label>Fischart <select name="fish" defaultValue="Zander">{fishOptions.filter(x=>x!=="Alle").map(x=><option key={x}>{x}</option>)}</select></label>
              <label>Länge <div className="catch-unit-field"><input name="lengthCm" type="number" min="0" step="0.1" inputMode="decimal" placeholder="0"/><span>cm</span></div></label>
              <label>Gewicht <div className="catch-unit-field"><input name="weightKg" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0"/><span>kg</span></div></label>
              <label>Fangmethode <select name="method" defaultValue="Spinnfischen"><option>Spinnfischen</option><option>Ansitz</option><option>Pose</option><option>Grundangeln</option><option>Fliegenfischen</option><option>Vertikalangeln</option><option>Sonstiges</option></select></label>
              <label>Köder <input name="lure" placeholder="z. B. 10 cm Gummifisch"/></label>
              <label>Fangtiefe <div className="catch-unit-field"><input name="depthM" type="number" min="0" step="0.1" inputMode="decimal" placeholder="optional"/><span>m</span></div></label>
              <label className="wide">Notiz <textarea name="note" rows={3} placeholder="optional – z. B. Bissphase, Struktur, Besonderheiten"/></label>
            </div>

            <div className="catch-photo-box">
              <button type="button" className="catch-photo-button" onClick={()=>catchPhotoRef.current?.click()}>
                📷 {catchPhoto ? "Fangfoto ändern" : "Fangfoto aufnehmen"}
              </button>
              <input ref={catchPhotoRef} className="atlas-hidden-photo-input" type="file" accept="image/*" capture="environment" onChange={handleCatchPhoto}/>
              {catchPhoto && <div className="catch-photo-preview"><img src={catchPhoto} alt="Vorschau Fangfoto"/><button type="button" onClick={()=>setCatchPhoto(null)}>× Foto entfernen</button></div>}
            </div>
            {catchPhoto && <div className="catch-photo-actions"><button type="button" className="catch-measure-button" onClick={()=>setMeasurePhoto(catchPhoto)}>📏 Länge aus Foto ermitteln</button><button type="button" className="catch-photo-save-button" onClick={()=>void saveCatchPhotoToPhotoApp(catchPhoto)}>📷 Foto in Fotos sichern</button></div>}
            <label className="catch-location-check"><input name="savePosition" type="checkbox" defaultChecked/> <span>🎯 Fangstelle mit GPS-Position speichern</span></label>
            <div className="catch-edit-actions"><button className="catch-save-button" type="submit" disabled={catchSaveBusy}>{catchSaveBusy ? "Speichere dauerhaft …" : editingCatchId ? "💾 Änderungen speichern" : "🎣 Fang speichern"}</button>{editingCatchId && <button className="catch-cancel-edit" type="button" onClick={cancelCatchEdit}>Abbrechen</button>}</div>
          </form>

          <div className="catch-history">
            <div className="catch-history-head"><div><p className="eyebrow">Eigene Datenbasis</p><h2>Gespeicherte Fänge</h2></div><strong>{catches.length}</strong></div>
            <div className="catch-list catch-list-v2">{catches.map(entry=>{
              const water = waters.find(w=>w.id===entry.waterId);
              return <article key={entry.id}>
                {entry.photo && <><button type="button" className="catch-history-photo-button" onClick={()=>setCatchPhotoViewer({ src: entry.photo!, title: `${entry.fish} · ${water?.name ?? entry.waterId}` })} aria-label="Fangfoto groß ansehen"><img className="catch-history-photo" src={entry.photo} alt={`Fangfoto ${entry.fish}`}/><span>📷 Foto ansehen</span></button><button type="button" className="catch-photo-save-button" onClick={()=>void saveCatchPhotoToPhotoApp(entry.photo!,entry.fish)}>📲 In Fotos sichern</button></>}
                <div className="catch-list-main"><strong>{entry.fish}</strong><p>{water?.name ?? entry.waterId} · {new Date(entry.caughtAt).toLocaleString("de-DE")}</p><small>{[entry.method, entry.lure, entry.depthM ? `${entry.depthM} m` : ""].filter(Boolean).join(" · ") || "Keine Zusatzangaben"}</small>{entry.weather && <small>🌤 {entry.weather.temperature.toFixed(0)} °C · {Math.round(entry.weather.pressure)} hPa · {Math.round(entry.weather.windSpeed)} km/h · {windDisplay(entry.weather.windDirection)}{entry.weather.windDirection != null ? ` (${Math.round(entry.weather.windDirection)}°)` : ""}</small>}{entry.moonPhase && <small>◐ {entry.moonPhase} · {entry.moonIllumination ?? 0} %</small>}{entry.photo && <button type="button" className="catch-photo-open-inline" onClick={()=>setCatchPhotoViewer({ src: entry.photo!, title: `${entry.fish} · ${water?.name ?? entry.waterId}` })}>📷 Fangfoto öffnen</button>}</div>
                <span className="catch-measure">{entry.lengthCm?`${entry.lengthCm} cm`:""}{entry.weightKg?`${entry.lengthCm?" · ":""}${entry.weightKg} kg`:""}</span><button type="button" className="catch-edit-button" onClick={()=>editCatch(entry)}>✏️ Bearbeiten</button>
              </article>;
            })}{!catches.length&&<p className="catch-empty">Noch keine Fänge gespeichert. Der erste Eintrag baut deine eigene Prognose-Datenbasis auf.</p>}</div>
          </div>
        </section>;
      })()}

      {catchPhotoViewer && typeof document !== "undefined" && createPortal(
        <div className="catch-photo-modal-backdrop" role="presentation" onClick={()=>setCatchPhotoViewer(null)}>
          <div className="catch-photo-modal" role="dialog" aria-modal="true" aria-label="Fangfoto" onClick={(event)=>event.stopPropagation()}>
            <div className="catch-photo-modal-head"><strong>{catchPhotoViewer.title}</strong><button type="button" onClick={()=>setCatchPhotoViewer(null)} aria-label="Foto schließen">×</button></div>
            <img src={catchPhotoViewer.src} alt={catchPhotoViewer.title}/>
            <div className="catch-photo-modal-actions">
              <a href={catchPhotoViewer.src} download={`wamifishing-fangfoto-${new Date().toISOString().slice(0,10)}.jpg`}>💾 Foto speichern</a>
              <button type="button" onClick={()=>setCatchPhotoViewer(null)}>Schließen</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {view === "settings" && <section className="page narrow"><div className="panel"><p className="eyebrow">V5.2 Beta</p><h1>Offline & Daten</h1><h3>Installierbare Web-App</h3><p>Manifest und Service Worker sind vorbereitet. Nach einem Produktions-Deployment kann die App über den Browser zum Startbildschirm hinzugefügt werden.</p><h3>Lokale Speicherung</h3><p>Favoriten, Fangbuch, Fangfotos, eigene Parkplätze und Hot Spots liegen lokal in diesem Browser. Fotos werden platzsparend im lokalen Bildspeicher abgelegt.</p>
        <h3>Fangfoto-Messung</h3><p>Der komplette Rutengriff dient als Maßstab für die 4-Punkt-Messung.</p><label className="rod-handle-setting">Rutengrifflänge <span><input type="number" min="10" max="150" step="0.1" value={rodHandleLengthCm} onChange={(e)=>{const v=Number(e.target.value);setRodHandleLengthCm(v);if(Number.isFinite(v)&&v>0)localStorage.setItem("wamifishing:rod-handle-length-cm",String(v));}}/> cm</span></label>
        <h3>Datensicherung</h3><p>WamiFishing aktualisiert die Sicherung automatisch bei Änderungen an Favoriten, Fangbuch, Fangfotos, Parkplätzen und Hot Spots. Eine Sicherung muss nicht mehr manuell erstellt werden.</p>{backupStatus && <p className="backup-status">{backupStatus}</p>}
        <div className="data-backup-actions"><button type="button" onClick={()=>void exportCurrentBackupJson()}>💾 Sicherung als JSON herunterladen</button><button type="button" onClick={()=>void restoreAutomaticBackup()}>↩ Automatische Sicherung wiederherstellen</button><button type="button" onClick={()=>backupImportRef.current?.click()}>📂 Alte Sicherungsdatei wiederherstellen</button><input ref={backupImportRef} className="atlas-hidden-photo-input" type="file" accept=".json,application/json" onChange={importDataBackup}/></div>
        {dataMessage && <p className="data-backup-message">{dataMessage}</p>}
        <h3>Amtliche Verlässlichkeit</h3><p>Die enthaltenen Gewässer sind technische Demonstrationsdaten. Vor dem Angeln gelten ausschließlich aktuelle Dokumente, Beschilderung und lokale Regeln.</p><button onClick={()=>{localStorage.clear();setFavorites([]);setCatches([]);setImportedSpots([])}}>Lokale App-Daten löschen</button></div></section>}

      {measurePhoto && <FishLengthMeasure photo={measurePhoto} handleLengthCm={rodHandleLengthCm} onClose={()=>setMeasurePhoto(null)} onApply={(cm)=>{const input=catchFormRef.current?.elements.namedItem("length") as HTMLInputElement|null;if(input)input.value=String(cm);setMeasurePhoto(null);}}/>}
      <footer>WamiFishing WAMIFISHING V5.4 Beta · Keine amtliche Gewässerkarte und keine Fanggarantie.</footer>
    </main>
  );
}
