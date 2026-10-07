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
import { WAMIFISHING_VERSION_LABEL } from "@/lib/version";

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

type ShareVisibility = "private" | "friends" | "public";

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
  visibility?: ShareVisibility;
};

type UserParkingSpot = ParkingSpot & {
  waterId: string;
  photo?: string;
  createdAt: string;
  accuracyM?: number;
  visibility?: ShareVisibility;
};

type ManualWater = FishingWater & {
  manual: true;
  createdAt: string;
  positionSource: "gps" | "map";
  ownership: "private" | "club" | "public" | "lease" | "unknown";
  clubName?: string;
  permitsAvailableAt?: string;
  guestFishing?: "yes" | "no" | "unknown";
  permission?: "free" | "membership" | "guest-card" | "special" | "unknown";
  informationSource?: "own" | "club" | "rules" | "permit" | "internet" | "other";
  informationDate?: string;
  visibility: "private" | "friends" | "public";
  description?: string;
};

type UserFishingSpot = FishingSpot & {
  waterId: string;
  photo?: string;
  createdAt: string;
  accuracyM?: number;
  visibility?: ShareVisibility;
};

const USER_PARKINGS_KEY = "harzfishing:user-parkings";
const USER_HOTSPOTS_KEY = "harzfishing:user-hotspots";
const MANUAL_WATERS_KEY = "wamifishing:manual-waters";
const APP_PARKING_CHANGES_KEY = "wamifishing:app-parking-changes";

type AppParkingChange = {
  waterId: string;
  parkingId: string;
  status: "hidden" | "deleted" | "corrected";
  reason?: string;
  latitude?: number;
  longitude?: number;
  changedAt: string;
};

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
const ATLAS_DB_VERSION = 3;
const ATLAS_PHOTO_STORE = "point-photos";
const CATCH_PHOTO_STORE = "catch-photos";
const BACKUP_STORE = "backups";

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
      if (!db.objectStoreNames.contains(BACKUP_STORE)) db.createObjectStore(BACKUP_STORE);
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

async function clearDbStore(store: string) {
  const db = await openAtlasDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Lokaler Bildspeicher konnte nicht geleert werden."));
      tx.onabort = () => reject(tx.error ?? new Error("Löschen des lokalen Bildspeichers wurde abgebrochen."));
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [points, setPoints] = useState<MeasurePoint[]>([]);
  const [imageReady, setImageReady] = useState(false);
  const labels = ["Griff Anfang", "Griff Ende", "Maulspitze", "Schwanzspitze"];

  const distance = (a?: MeasurePoint, b?: MeasurePoint) => {
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const handleDistance = distance(points[0], points[1]);
  const fishDistance = distance(points[2], points[3]);
  const result = points.length === 4 && handleDistance > 0
    ? (fishDistance / handleDistance) * handleLengthCm
    : null;

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      imageRef.current = image;
      setImageReady(true);
    };
    image.onerror = () => {
      if (cancelled) return;
      imageRef.current = null;
      setImageReady(false);
    };
    image.src = photo;
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [photo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !imageReady) return;

    const availableWidth = Math.max(1, Math.min(900, window.innerWidth - 40));
    const naturalWidth = Math.max(1, image.naturalWidth || image.width);
    const naturalHeight = Math.max(1, image.naturalHeight || image.height);
    const scale = Math.min(1, availableWidth / naturalWidth);
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const drawLine = (a?: MeasurePoint, b?: MeasurePoint) => {
      if (!a || !b) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    };

    drawLine(points[0], points[1]);
    drawLine(points[2], points[3]);

    points.forEach((point, index) => {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = index < 2 ? "#fff" : "#ffd54f";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#111";
      ctx.stroke();
    });
  }, [points, imageReady]);

  function addPoint(e: React.MouseEvent<HTMLCanvasElement>) {
    if (points.length >= 4) return;
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || canvas.width <= 0 || canvas.height <= 0) return;

    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    setPoints(current => current.length >= 4 ? current : [...current, { x, y }]);
  }

  return <div className="fish-measure-overlay"><div className="fish-measure-panel"><div className="fish-measure-head"><div><strong>📏 Fischlänge aus Foto</strong><small>Rutengriff: {handleLengthCm.toFixed(1)} cm</small></div><button type="button" onClick={onClose}>✕</button></div><p className="fish-measure-help">{points.length<4?`Punkt ${points.length+1}: ${labels[points.length]} antippen`:"Messpunkte vollständig."}</p><div className="fish-measure-canvas-wrap"><canvas ref={canvasRef} onClick={addPoint}/></div><div className="fish-measure-actions"><button type="button" disabled={!points.length} onClick={()=>setPoints(v=>v.slice(0,-1))}>↶ Punkt zurück</button><button type="button" disabled={!points.length} onClick={()=>setPoints([])}>Neu messen</button>{result!==null&&Number.isFinite(result)&&<strong>{result.toFixed(1)} cm</strong>}<button type="button" disabled={result===null||!Number.isFinite(result)} onClick={()=>result!==null&&Number.isFinite(result)&&onApply(Math.round(result))}>✓ Länge übernehmen</button></div></div></div>;
}

type WamiFishingBackup = {
  format: "WamiFishing Navigator Backup";
  version: 1;
  exportedAt: string;
  favorites: string[];
  catches: EnhancedCatchEntry[];
  parkings: UserParkingSpot[];
  hotspots: UserFishingSpot[];
  manualWaters?: ManualWater[];
  appParkingChanges?: AppParkingChange[];
};

const AUTO_BACKUP_KEY = "wamifishing:auto-backup-v1";
const PREVIOUS_AUTO_BACKUP_KEY = "wamifishing:auto-backup-previous-v1";
const AUTO_CATCH_BACKUP_KEY = "wamifishing:auto-catches-v1";

function isValidAutomaticBackup(value: unknown): value is WamiFishingBackup {
  const backup = value as WamiFishingBackup | null;
  return Boolean(backup && backup.format === "WamiFishing Navigator Backup" && backup.version === 1 &&
    Array.isArray(backup.catches) && Array.isArray(backup.parkings) && Array.isArray(backup.hotspots));
}

function backupItemCount(backup: WamiFishingBackup) {
  return backup.catches.length + backup.parkings.length + backup.hotspots.length + (backup.manualWaters?.length ?? 0) + (backup.appParkingChanges?.length ?? 0);
}

const CLOUD_USER_KEY = "wamifishing:cloud-user-id-v1";
const DEVICE_ID_KEY = "wamifishing:device-id-v1";
function getDeviceId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_ID_KEY)?.trim() || "";
  if (!id) { id = `device-${crypto.randomUUID()}`; localStorage.setItem(DEVICE_ID_KEY, id); }
  return id;
}

function getCloudUserId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(CLOUD_USER_KEY)?.trim() || "";
  if (!id) {
    id = `user-${crypto.randomUUID()}`;
    localStorage.setItem(CLOUD_USER_KEY, id);
  }
  return id;
}

function cloudUserHeaders(extra?: Record<string, string>) {
  return { ...(extra ?? {}), "X-WamiFishing-User": getCloudUserId() };
}

async function loadCloudBackup(): Promise<WamiFishingBackup | null> {
  const response = await fetch("/api/wamifishing-backup", { cache: "no-store", headers: cloudUserHeaders() });
  if (!response.ok) throw new Error("Cloud-Sicherung konnte nicht gelesen werden.");
  const value = await response.json() as unknown;
  if (isValidAutomaticBackup(value)) return value;
  const wrapped = value as { backup?: unknown } | null;
  return wrapped && isValidAutomaticBackup(wrapped.backup) ? wrapped.backup : null;
}

async function saveCloudBackup(backup: WamiFishingBackup) {
  // Fotos können den kompletten JSON-Backup schnell über das Request-Limit eines
  // Serverless-Aufrufs bringen. Deshalb wird die Sicherung in kleine Textblöcke
  // zerlegt und serverseitig wieder als eine Sicherung zusammengesetzt.
  const payload = JSON.stringify(backup);
  const chunkSize = 900_000;
  const total = Math.max(1, Math.ceil(payload.length / chunkSize));
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  for (let index = 0; index < total; index += 1) {
    const chunk = payload.slice(index * chunkSize, (index + 1) * chunkSize);
    const response = await fetch("/api/wamifishing-backup", {
      method: "PUT",
      headers: cloudUserHeaders({
        "Content-Type": "text/plain; charset=utf-8",
        "X-WamiFishing-Upload": uploadId,
        "X-WamiFishing-Part": String(index),
        "X-WamiFishing-Total": String(total),
      }),
      body: chunk,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Cloud-Sicherung konnte nicht gespeichert werden.${detail ? ` ${detail}` : ""}`);
    }
  }
}

async function deleteCloudBackup() {
  const response = await fetch("/api/wamifishing-backup", { method: "DELETE", headers: cloudUserHeaders() });
  if (!response.ok) throw new Error("Cloud-Sicherung konnte nicht gelöscht werden.");
}

async function saveAutomaticBackup(backup: WamiFishingBackup) {
  const db = await openAtlasDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BACKUP_STORE, "readwrite");
      const store = tx.objectStore(BACKUP_STORE);
      const getCurrent = store.get("current");
      getCurrent.onsuccess = () => {
        if (isValidAutomaticBackup(getCurrent.result)) store.put(getCurrent.result, "previous");
        store.put(backup, "current");
      };
      getCurrent.onerror = () => reject(getCurrent.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Automatische Sicherung konnte nicht gespeichert werden."));
      tx.onabort = () => reject(tx.error ?? new Error("Automatische Sicherung wurde abgebrochen."));
    });
  } finally { db.close(); }
}

async function loadAutomaticBackup(): Promise<WamiFishingBackup | null> {
  const candidates: WamiFishingBackup[] = [];
  try {
    const db = await openAtlasDb();
    try {
      for (const key of ["current", "previous"]) {
        const value = await new Promise<unknown>((resolve, reject) => {
          const tx = db.transaction(BACKUP_STORE, "readonly");
          const request = tx.objectStore(BACKUP_STORE).get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        if (isValidAutomaticBackup(value)) candidates.push(value);
      }
    } finally { db.close(); }
  } catch { /* Legacy-Fallback folgt. */ }

  // Alte localStorage-Sicherungen bleiben lesbar, werden aber nicht mehr neu beschrieben.
  if (typeof window !== "undefined") {
    for (const key of [AUTO_BACKUP_KEY, PREVIOUS_AUTO_BACKUP_KEY]) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as unknown;
        if (isValidAutomaticBackup(parsed)) candidates.push(parsed);
      } catch {}
    }
  }
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.exportedAt.localeCompare(a.exportedAt))[0];
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
          event.currentTarget.blur();
        }}
        placeholder="Ort oder Gewässer · Enter"
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
  const atlasStaticPageRef = useRef<HTMLElement | null>(null);
  const atlasCategoryRef = useRef<HTMLDivElement | null>(null);
  const atlasScrollRailTouchYRef = useRef<number | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [showIntroVideo, setShowIntroVideo] = useState(false);
  const [atlasViewportHeight, setAtlasViewportHeight] = useState<number | null>(null);
  useEffect(() => {
    if (view !== "atlas") {
      setAtlasViewportHeight(null);
      return;
    }

    const updateAtlasHeight = () => {
      if (window.innerWidth > 900 || !atlasStaticPageRef.current) {
        setAtlasViewportHeight(null);
        return;
      }
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const top = atlasStaticPageRef.current.getBoundingClientRect().top;
      setAtlasViewportHeight(Math.max(240, Math.floor(viewportHeight - top)));
    };

    updateAtlasHeight();
    const viewport = window.visualViewport;
    window.addEventListener("resize", updateAtlasHeight);
    window.addEventListener("orientationchange", updateAtlasHeight);
    viewport?.addEventListener("resize", updateAtlasHeight);
    viewport?.addEventListener("scroll", updateAtlasHeight);

    return () => {
      window.removeEventListener("resize", updateAtlasHeight);
      window.removeEventListener("orientationchange", updateAtlasHeight);
      viewport?.removeEventListener("resize", updateAtlasHeight);
      viewport?.removeEventListener("scroll", updateAtlasHeight);
    };
  }, [view]);

  const [watersVisibleCount, setWatersVisibleCount] = useState(60);
  const [mobileSelectedWaterId, setMobileSelectedWaterId] = useState<string | null>(null);
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
  const [watersFavoritesOnly, setWatersFavoritesOnly] = useState(false);
  const [watersHotspotsOnly, setWatersHotspotsOnly] = useState(false);
  const [diaryCatchesOnly, setDiaryCatchesOnly] = useState(false);
  const [atlasPersonalPointsOnly, setAtlasPersonalPointsOnly] = useState(false);
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
  const [cloudSyncReady, setCloudSyncReady] = useState(false);
  const [backupStatus, setBackupStatus] = useState("");
  const [cloudUserId, setCloudUserId] = useState("");
  const [cloudUserDraft, setCloudUserDraft] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authIsAdmin, setAuthIsAdmin] = useState(false);
  const [authEmailDraft, setAuthEmailDraft] = useState("");
  const [authNameDraft, setAuthNameDraft] = useState("");
  const [authOtp, setAuthOtp] = useState("");
  const [authOtpSent, setAuthOtpSent] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authVerifyBusy, setAuthVerifyBusy] = useState(false);
  const [socialName, setSocialName] = useState("");
  const [friendCode, setFriendCode] = useState("");
  const [friendCodeDraft, setFriendCodeDraft] = useState("");
  const [friendAddCode, setFriendAddCode] = useState("");
  const [friends, setFriends] = useState<Array<{userId:string;name:string;friendCode:string}>>([]);
  const [friendRequests, setFriendRequests] = useState<Array<{fromUserId:string;fromName:string;fromCode:string;createdAt:string}>>([]);
  const [socialMessage, setSocialMessage] = useState("");
  const [sharedCatches, setSharedCatches] = useState<Array<EnhancedCatchEntry & {ownerId:string;ownerName:string}>>([]);
  const [sharedParkings, setSharedParkings] = useState<Array<UserParkingSpot & {ownerId:string;ownerName:string}>>([]);
  const [sharedHotspots, setSharedHotspots] = useState<Array<UserFishingSpot & {ownerId:string;ownerName:string}>>([]);
  const catchPhotoRef = useRef<HTMLInputElement | null>(null);
  const backupFileRef = useRef<HTMLInputElement | null>(null);
  const [importedSpots, setImportedSpots] = useState<FishingSpot[]>([]);
  const [userParkings, setUserParkings] = useState<UserParkingSpot[]>([]);
  const [userHotspots, setUserHotspots] = useState<UserFishingSpot[]>([]);
  const [manualWaters, setManualWaters] = useState<ManualWater[]>([]);
  const [appParkingChanges, setAppParkingChanges] = useState<AppParkingChange[]>([]);
  const [showAddWater, setShowAddWater] = useState(false);
  const [manualWaterPosition, setManualWaterPosition] = useState<{latitude:number;longitude:number;source:"gps"|"map"}|null>(null);
  const [manualWaterMessage, setManualWaterMessage] = useState("");
  const [manualWaterPositionBusy, setManualWaterPositionBusy] = useState(false);
  const [manualWaterOwnership, setManualWaterOwnership] = useState<ManualWater["ownership"]>("unknown");
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
    setManualWaters(loadLocalArray<ManualWater>(MANUAL_WATERS_KEY));
    setAppParkingChanges(loadLocalArray<AppParkingChange>(APP_PARKING_CHANGES_KEY));

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

  useEffect(() => {
    let active = true;
    void fetch("/api/wamifishing-auth", { cache: "no-store" }).then(async response => {
      const data = await response.json() as { user?: { email?: string; isAdmin?: boolean } | null };
      if (!active) return;
      const email = data.user?.email ?? "";
      setAuthEmail(email);
      setAuthIsAdmin(Boolean(data.user?.isAdmin));
      if (email) setAuthEmailDraft(email);
      setAuthChecked(true);
    }).catch(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  async function requestAccess() {
    try {
      setAuthMessage("Zugangsanfrage wird gesendet …");
      const response = await fetch("/api/wamifishing-auth", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"request", name:authNameDraft, email:authEmailDraft, deviceId:getDeviceId(), dataUserId:getCloudUserId() }) });
      const data = await response.json() as {error?:string;message?:string};
      if (!response.ok) throw new Error(data.error || "Zugangsanfrage fehlgeschlagen.");
      setAuthMessage(`✓ ${data.message || "Zugangsanfrage gesendet."}`);
    } catch (error) { setAuthMessage(`⚠ ${error instanceof Error ? error.message : String(error)}`); }
  }

  async function sendLoginCode() {
    try {
      setAuthMessage("Code wird gesendet …");
      const response = await fetch("/api/wamifishing-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", email: authEmailDraft, deviceId: getDeviceId(), dataUserId: getCloudUserId() }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Anmeldecode konnte nicht gesendet werden.");
      setAuthOtpSent(true); setAuthMessage("✓ 6-stelliger Code wurde per E-Mail gesendet.");
    } catch (error) { setAuthMessage(`⚠ ${error instanceof Error ? error.message : String(error)}`); }
  }
  async function verifyLoginCode(codeOverride?: string) {
    const code = (codeOverride ?? authOtp).replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6 || authVerifyBusy) return;
    try {
      setAuthVerifyBusy(true);
      setAuthMessage("Code wird geprüft …");
      const response = await fetch("/api/wamifishing-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", email: authEmailDraft, token: code, deviceId: getDeviceId(), dataUserId: getCloudUserId() }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Anmeldung fehlgeschlagen.");
      setAuthMessage("✓ Angemeldet. WamiFishing wird neu geladen …");
      window.location.reload();
    } catch (error) { setAuthMessage(`⚠ ${error instanceof Error ? error.message : String(error)}`); }
    finally { setAuthVerifyBusy(false); }
  }
  async function logoutEmail() {
    await fetch("/api/wamifishing-auth", { method: "DELETE" }).catch(() => undefined);
    window.location.reload();
  }

  async function requestAccountDeletion() {
    if (!authEmail) { setDataMessage("⚠ Bitte zuerst anmelden."); return; }
    if (!window.confirm(`Löschung des Kontos ${authEmail} und aller zugehörigen WamiFishing-Daten anfordern? Die Daten werden noch nicht gelöscht; die Anfrage muss zuerst in der Administration bestätigt werden.`)) return;
    try {
      setDataMessage("Löschanfrage wird gespeichert …");
      const response = await fetch("/api/wamifishing-privacy", { method: "POST", headers: cloudUserHeaders() });
      const data = await response.json() as { error?: string; alreadyPending?: boolean };
      if (!response.ok) throw new Error(data.error || "Löschanfrage konnte nicht gespeichert werden.");
      setDataMessage(data.alreadyPending ? "✓ Es liegt bereits eine Löschanfrage vor." : "✓ Löschanfrage wurde an die Administration übermittelt. Bis zur Bestätigung bleiben Konto und Daten unverändert erhalten.");
    } catch (error) {
      setDataMessage(`⚠ ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  useEffect(() => {
    const id = getCloudUserId();
    setCloudUserId(id);
    setCloudUserDraft(id);
  }, []);

  useEffect(() => { if (cloudUserId && authEmail) void loadSocialProfile(); }, [cloudUserId, authEmail]);

  async function loadSocialProfile() {
    try {
      const response = await fetch("/api/wamifishing-social", { cache:"no-store", headers: cloudUserHeaders() });
      const data = await response.json() as {profile?: {name:string;friendCode:string;friends?: Array<{userId:string;name:string;friendCode:string}>;incoming?: Array<{fromUserId:string;fromName:string;fromCode:string;createdAt:string}>} | null};
      if (data.profile) { setSocialName(data.profile.name || ""); setFriendCode(data.profile.friendCode || ""); setFriendCodeDraft(data.profile.friendCode || ""); setFriends(data.profile.friends || []); setFriendRequests(data.profile.incoming || []); }
      else if (!friendCodeDraft) setFriendCodeDraft(`WAMI-${crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase()}`);
    } catch (error) { console.error("Freundeprofil konnte nicht geladen werden:", error); }
  }

  async function socialPost(body: Record<string,string>) {
    const response = await fetch("/api/wamifishing-social", { method:"POST", headers: cloudUserHeaders({"Content-Type":"application/json"}), body:JSON.stringify(body) });
    const data = await response.json() as {error?:string}; if (!response.ok) throw new Error(data.error || "Freundefunktion fehlgeschlagen."); return data;
  }
  async function saveSocialProfile() { try { await socialPost({action:"save-profile",name:socialName,friendCode:friendCodeDraft}); setSocialMessage("✓ Profil gespeichert."); await loadSocialProfile(); } catch(e){setSocialMessage(`⚠ ${e instanceof Error?e.message:String(e)}`);} }
  async function sendFriendRequest() { try { await socialPost({action:"request",friendCode:friendAddCode}); setFriendAddCode(""); setSocialMessage("✓ Freundschaftsanfrage gesendet."); } catch(e){setSocialMessage(`⚠ ${e instanceof Error?e.message:String(e)}`);} }
  async function acceptFriend(fromUserId:string) { try { await socialPost({action:"accept",fromUserId}); setSocialMessage("✓ Freund hinzugefügt."); await loadSocialProfile(); await loadSharedData(); } catch(e){setSocialMessage(`⚠ ${e instanceof Error?e.message:String(e)}`);} }
  async function removeFriend(friendUserId:string, name:string) { if (!window.confirm(`Freundschaft mit ${name} wirklich beenden? Inhalte mit Sichtbarkeit „Freunde“ sind danach gegenseitig nicht mehr sichtbar.`)) return; try { await socialPost({action:"remove-friend",friendUserId}); setSocialMessage("✓ Freundschaft beendet."); await loadSocialProfile(); await loadSharedData(); } catch(e){setSocialMessage(`⚠ ${e instanceof Error?e.message:String(e)}`);} }
  async function loadSharedData() {
    try {
      const response = await fetch("/api/wamifishing-shared", { cache:"no-store", headers: cloudUserHeaders() });
      if (!response.ok) return;
      const data = await response.json() as {catches?: typeof sharedCatches; parkings?: typeof sharedParkings; hotspots?: typeof sharedHotspots};
      setSharedCatches(data.catches ?? []); setSharedParkings(data.parkings ?? []); setSharedHotspots(data.hotspots ?? []);
    } catch (error) { console.error("Freigegebene Daten konnten nicht geladen werden:", error); }
  }
  function visibilityLabel(value?: ShareVisibility) { return value === "public" ? "🌍 Öffentlich" : value === "friends" ? "👥 Freunde" : "🔒 Privat"; }
  function setCatchVisibility(id:string, visibility:ShareVisibility) { setCatches(items=>items.map(item=>item.id===id?{...item,visibility}:item)); }
  function setParkingVisibility(id:string, visibility:ShareVisibility) { setUserParkings(items=>items.map(item=>item.id===id?{...item,visibility}:item)); }
  function setHotspotVisibility(id:string, visibility:ShareVisibility) { setUserHotspots(items=>items.map(item=>item.id===id?{...item,visibility}:item)); }
  useEffect(() => { if (authEmail) { void loadSocialProfile(); void loadSharedData(); } }, [cloudUserId, authEmail]);

  function connectCloudProfile() {
    const next = cloudUserDraft.trim();
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(next)) {
      setDataMessage("⚠ Der Sync-Code ist ungültig.");
      return;
    }
    if (next === cloudUserId) {
      setDataMessage("✓ Dieses Gerät verwendet bereits diesen Sync-Code.");
      return;
    }
    if (!window.confirm("Dieses Gerät mit dem eingegebenen Benutzerprofil verbinden? Danach wird die App neu geladen und der Cloudstand dieses Profils verwendet.")) return;
    localStorage.setItem(CLOUD_USER_KEY, next);
    window.location.reload();
  }

  // Beim Start zuerst die gemeinsame Cloud-Sicherung prüfen. Wichtig: Bis das
  // abgeschlossen ist, darf ein leerer Safari-Speicher niemals die Cloud überschreiben.
  useEffect(() => {
    if (!localDataReady || !authChecked || !authEmail) return;
    let cancelled = false;
    void (async () => {
      try {
        const cloud = await loadCloudBackup();
        if (cancelled) return;
        // Wichtig für Löschungen: Nicht die Anzahl der Datensätze entscheidet,
        // sondern ausschließlich welcher Datenstand zuletzt geändert wurde.
        // createCurrentBackup() bekommt "jetzt" als exportedAt und darf deshalb
        // nicht zum Versionsvergleich benutzt werden.
        const persistedLocal = await loadAutomaticBackup();
        const local = persistedLocal ?? await createCurrentBackup();
        const cloudHasData = Boolean(cloud && backupItemCount(cloud) > 0);
        const localHasData = backupItemCount(local) > 0;
        if (cloud && (
          !persistedLocal ||
          cloud.exportedAt > persistedLocal.exportedAt ||
          (cloudHasData && !localHasData)
        )) {
          await applyBackup(cloud);
          if (!cancelled) setBackupStatus(`☁ Cloud geladen: ${cloud.catches.length} Fänge · ${cloud.hotspots.length} Hot Spots · ${cloud.parkings.length} Parkplätze`);
        } else if (backupItemCount(local) > 0 && (!cloud || local.exportedAt > cloud.exportedAt)) {
          await saveCloudBackup(local);
        }
      } catch (error) {
        console.error("Cloud-Synchronisierung beim Start fehlgeschlagen:", error);
        if (!cancelled) setBackupStatus("⚠ Cloud nicht erreichbar – lokale Daten bleiben erhalten");
      } finally {
        if (!cancelled) setCloudSyncReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [localDataReady, authChecked, authEmail]);

  // Geräteübergreifender Abgleich: Solange WamiFishing geöffnet ist, regelmäßig
  // einen neueren Cloud-Datenstand übernehmen. Dadurch kommen auch Löschungen vom
  // Handy am PC an, ohne dass die Seite neu gestartet werden muss.
  useEffect(() => {
    if (!localDataReady || !cloudSyncReady) return;
    let cancelled = false;
    let running = false;

    const pullNewerCloudState = async () => {
      if (cancelled || running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const [cloud, local] = await Promise.all([loadCloudBackup(), loadAutomaticBackup()]);
        if (!cancelled && cloud && (
          !local ||
          cloud.exportedAt > local.exportedAt ||
          (backupItemCount(cloud) > 0 && backupItemCount(local) === 0)
        )) {
          await applyBackup(cloud);
          if (!cancelled) setBackupStatus(`☁ Synchronisiert: ${cloud.catches.length} Fänge · ${cloud.hotspots.length} Hot Spots · ${cloud.parkings.length} Parkplätze`);
        }
      } catch (error) {
        console.error("Laufender Cloud-Abgleich fehlgeschlagen:", error);
      } finally {
        running = false;
      }
    };

    const timer = window.setInterval(() => { void pullNewerCloudState(); }, 5 * 60 * 1000);
    const onFocus = () => { void pullNewerCloudState(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [localDataReady, cloudSyncReady]);

  // Laufende automatische Sicherung lokal UND in der gemeinsamen Vercel-Cloud. Nach jeder Änderung wird immer
  // der vollständige Datenbestand inklusive der in IndexedDB liegenden Fotos gesichert.
  useEffect(() => {
    if (!localDataReady || !cloudSyncReady) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
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
          if (cancelled) return;

          const backup: WamiFishingBackup = {
            format: "WamiFishing Navigator Backup",
            version: 1,
            exportedAt: new Date().toISOString(),
            favorites,
            catches: catchesWithPhotos,
            parkings: parkingsWithPhotos,
            hotspots: hotspotsWithPhotos,
            manualWaters,
            appParkingChanges
          };
          await saveAutomaticBackup(backup);
          await saveCloudBackup(backup);
          const catchPhotos = catchesWithPhotos.filter(entry => Boolean(entry.photo)).length;
          setBackupStatus(`☁ Automatisch gesichert: ${catchesWithPhotos.length} Fänge · ${catchPhotos} Fangfotos · ${hotspotsWithPhotos.length} Hot Spots · ${parkingsWithPhotos.length} Parkplätze`);
        } catch (error) {
          console.error("Automatische Datensicherung konnte nicht aktualisiert werden:", error);
          if (!cancelled) setBackupStatus("⚠ Automatische Sicherung fehlgeschlagen");
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [localDataReady, cloudSyncReady, favorites, catches, userParkings, userHotspots, manualWaters, appParkingChanges]);

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

  const allWaters = useMemo(() => [...waters, ...manualWaters], [manualWaters]);

  useEffect(() => {
    if (!localDataReady || !cloudSyncReady || !socialName.trim()) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/wamifishing-shared", { method:"PUT", headers: cloudUserHeaders({"Content-Type":"application/json"}), body: JSON.stringify({
        catches: catches.filter(x=>(x.visibility ?? "private")!=="private"),
        parkings: userParkings.filter(x=>(x.visibility ?? "private")!=="private"),
        hotspots: userHotspots.filter(x=>(x.visibility ?? "private")!=="private")
      }) }).then(()=>loadSharedData()).catch(error=>console.error("Freigaben konnten nicht veröffentlicht werden:",error));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [localDataReady, cloudSyncReady, socialName, catches, userParkings, userHotspots]);

  const filtered = useMemo(() => allWaters
    .filter((water) => {
      if (!waterPlace) return true;
      if (water.latitude === null || water.longitude === null) return false;
      return distanceKm(waterPlace.latitude, waterPlace.longitude, water.latitude, water.longitude) <= 20;
    })
    .filter((water) => !watersFavoritesOnly || favorites.includes(water.id))
    .filter((water) => !watersHotspotsOnly || userHotspots.some((spot) => spot.waterId === water.id))
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
    [fish, waterPlace, allWaters, watersFavoritesOnly, watersHotspotsOnly, favorites, userHotspots]);

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
  // Nicht auf jede Neuberechnung von `filtered` reagieren:
  // z. B. Hotspot löschen darf das geöffnete Gewässer nicht austauschen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, waterPlace, fish, watersFavoritesOnly, watersHotspotsOnly]);

  function findWaterBySearchTerm(term: string) {
    const normalized = term.trim().toLocaleLowerCase("de");
    if (!normalized) return null;
    return allWaters.find((water) => water.name.toLocaleLowerCase("de") === normalized) ??
      allWaters.find((water) => water.name.toLocaleLowerCase("de").startsWith(normalized)) ??
      allWaters.find((water) => water.name.toLocaleLowerCase("de").includes(normalized)) ?? null;
  }

  function resetWatersSelectionForNewPlace() {
    setFish("Alle");
    setWatersFavoritesOnly(false);
    setWatersHotspotsOnly(false);
    setMobileSelectedWaterId(null);
    setFocusedWaterId(null);
    setWatersVisibleCount(60);
  }

  async function searchWatersPlace(searchTerm?: string) {
    const term = (searchTerm ?? query).trim();
    if (!term) return;
    resetWatersSelectionForNewPlace();
    setQuery(term);
    setWaterSearchBusy(true);
    setWaterSearchError("");
    try {
      const waterMatch = findWaterBySearchTerm(term);
      if (waterMatch && waterMatch.latitude !== null && waterMatch.longitude !== null) {
        setWaterPlace({ latitude: waterMatch.latitude, longitude: waterMatch.longitude, label: waterMatch.name });
        setSelected(waterMatch);
        setFocusedWaterId(waterMatch.id);
        return;
      }
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
    setWatersFavoritesOnly(false);
    setWatersHotspotsOnly(false);
    setWaterSearchError("");
    setFocusedWaterId(null);
    setMobileSelectedWaterId(null);
    setWatersVisibleCount(60);
  }


  async function useNearestWaterPlace() {
    resetWatersSelectionForNewPlace();
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
  return allWaters
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
}, [atlasPlace, atlasFish, atlasCategory, allWaters]);

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
      const waterMatch = findWaterBySearchTerm(term);
      if (waterMatch && waterMatch.latitude !== null && waterMatch.longitude !== null) {
        setAtlasPlace({ latitude: waterMatch.latitude, longitude: waterMatch.longitude, label: waterMatch.name });
        setSelected(waterMatch);
        setFocusedWaterId(waterMatch.id);
        return;
      }
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`);
      if (!response.ok) throw new Error("Ort oder Gewässer nicht gefunden");

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
    setAtlasPersonalPointsOnly(false);
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
  const selectedAppParkings = (selected.parkings ?? []).flatMap((parking) => {
    const change = appParkingChanges.find((item) => item.waterId === selected.id && item.parkingId === parking.id);
    if (change?.status === "hidden" || change?.status === "deleted") return [];
    if (change?.status === "corrected" && change.latitude != null && change.longitude != null) {
      return [{ ...parking, latitude: change.latitude, longitude: change.longitude, note: `${parking.note ?? "App-Parkplatz"} · Position von dir korrigiert` }];
    }
    return [parking];
  });
  const selectedUserHotspots = userHotspots.filter((spot) => spot.waterId === selected.id);
  const selectedSharedParkings = sharedParkings.filter((parking) => parking.waterId === selected.id);
  const selectedSharedHotspots = sharedHotspots.filter((spot) => spot.waterId === selected.id);
  const visibleSpots = focusedWater ? [...selected.spots, ...selectedUserHotspots, ...importedSpots] : [];
  const visibleParkings = focusedWater ? [...selectedAppParkings, ...selectedUserParkings] : [];
  const mappedCount = filtered.filter((water) => water.latitude !== null && water.longitude !== null).length;

  function nearbyWatersForPosition(latitude: number, longitude: number) {
    // Sowohl Kataloggewässer als auch selbst angelegte Gewässer berücksichtigen.
    const ranked = allWaters
      .map((water) => ({ water, distance: distanceToWaterKm(water, latitude, longitude) }))
      .filter((item) => Number.isFinite(item.distance))
      .sort((a, b) => a.distance - b.distance);

    if (!ranked.length) return [];

    // Parkplätze können etwas vom Ufer entfernt liegen. Deshalb zeigen wir neben
    // dem nächsten Gewässer weitere realistische Kandidaten im Umfeld an.
    const nearestDistance = ranked[0].distance;
    const limitKm = Math.max(0.75, nearestDistance + 1.0);
    return ranked.filter((item) => item.distance <= limitKm).slice(0, 6);
  }

  function chooseNearbyWater(latitude: number, longitude: number): { water: FishingWater; distance: number } | null {
    const candidates = nearbyWatersForPosition(latitude, longitude);
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];

    const lines = candidates.map((item, index) =>
      `${index + 1}. ${item.water.name} · ${Math.round(item.distance * 1000)} m`
    );
    const answer = window.prompt(
      `Mehrere Gewässer liegen in der Nähe.\n\n${lines.join("\n")}\n\nNummer auswählen (Vorschlag: 1):`,
      "1"
    );
    if (answer === null) return null;
    const index = Number.parseInt(answer.trim(), 10) - 1;
    return candidates[index] ?? candidates[0];
  }

  async function saveFreePointAtCurrentLocation(kind: "parking" | "hotspot") {
    setFreeHotspotBusy(true);
    setAtlasPointMessage("");
    try {
      const position = await getCurrentGpsPosition();
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const accuracyM = Math.round(position.coords.accuracy);
      const chosen = chooseNearbyWater(latitude, longitude);

      if (!chosen) {
        setAtlasPointMessage(`⚠ Kein passendes Gewässer gewählt. ${kind === "parking" ? "Parkplatz" : "Hot Spot"} wurde nicht gespeichert.`);
        return;
      }

      const createdAt = new Date().toISOString();
      if (kind === "parking") {
        const item: UserParkingSpot = {
          id: `user-parking-${crypto.randomUUID()}`,
          waterId: chosen.water.id,
          name: "Eigener Parkplatz",
          latitude,
          longitude,
          access: "public",
          accuracy: "verified",
          note: `Freie GPS-Ortserkennung · ${chosen.water.name} · Abstand zum Gewässer ca. ${Math.round(chosen.distance * 1000)} m · GPS-Genauigkeit ca. ${accuracyM} m`,
          createdAt,
          accuracyM,
          visibility: "private"
        };
        const next = [...userParkings, item];
        saveLocalArray(USER_PARKINGS_KEY, withoutPhoto(next));
        setUserParkings(next);
      } else {
        const item: UserFishingSpot = {
          id: `user-hotspot-${crypto.randomUUID()}`,
          waterId: chosen.water.id,
          name: "Eigener Hot Spot",
          latitude,
          longitude,
          tags: ["Eigener Hot Spot", "GPS frei erkannt"],
          note: `Freie GPS-Ortserkennung · ${chosen.water.name} · Abstand zum Gewässer ca. ${Math.round(chosen.distance * 1000)} m · GPS-Genauigkeit ca. ${accuracyM} m`,
          source: "Benutzer",
          createdAt,
          accuracyM,
          visibility: "private"
        };
        const next = [...userHotspots, item];
        saveLocalArray(USER_HOTSPOTS_KEY, withoutPhoto(next));
        setUserHotspots(next);
      }

      setSelected(chosen.water);
      setFocusedWaterId(chosen.water.latitude !== null && chosen.water.longitude !== null ? chosen.water.id : null);
      setAtlasPointMessage(`✅ ${kind === "parking" ? "Parkplatz" : "Hot Spot"} gespeichert · ${chosen.water.name} · ca. ${Math.round(chosen.distance * 1000)} m vom Gewässer.`);
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
      const chosen = chooseNearbyWater(latitude, longitude);

      if (!chosen) {
        setAtlasPointMessage(`⚠ Kein Gewässer gewählt. ${kind === "parking" ? "Parkplatz" : "Hot Spot"} wurde nicht gespeichert.`);
        return;
      }

      if (kind === "parking") {
        const item: UserParkingSpot = {
          id: `user-parking-${crypto.randomUUID()}`,
          waterId: chosen.water.id,
          name: "Eigener Parkplatz",
          latitude,
          longitude,
          access: "public",
          accuracy: "verified",
          note: `Eigene GPS-Position · ${chosen.water.name} · Abstand zum Gewässer ca. ${Math.round(chosen.distance * 1000)} m · Genauigkeit ca. ${accuracyM} m`,
          photo,
          createdAt,
          accuracyM,
          visibility: "private"
        };
        const next = [...userParkings, item];
        await putAtlasPhoto(item.id, photo);
        saveLocalArray(USER_PARKINGS_KEY, withoutPhoto(next));
        setUserParkings(next);
      } else {
        const item: UserFishingSpot = {
          id: `user-hotspot-${crypto.randomUUID()}`,
          waterId: chosen.water.id,
          name: "Eigener Hot Spot",
          latitude,
          longitude,
          tags: ["Eigener Hot Spot"],
          note: `Eigene GPS-Position · ${chosen.water.name} · Abstand zum Gewässer ca. ${Math.round(chosen.distance * 1000)} m · Genauigkeit ca. ${accuracyM} m`,
          source: "Benutzer",
          photo,
          createdAt,
          accuracyM,
          visibility: "private"
        };
        const next = [...userHotspots, item];
        await putAtlasPhoto(item.id, photo);
        saveLocalArray(USER_HOTSPOTS_KEY, withoutPhoto(next));
        setUserHotspots(next);
      }

      setSelected(chosen.water);
      setFocusedWaterId(chosen.water.latitude !== null && chosen.water.longitude !== null ? chosen.water.id : null);
      setAtlasPointMessage(`✅ ${kind === "parking" ? "Parkplatz" : "Hot Spot"} gespeichert · ${chosen.water.name} · ca. ${Math.round(chosen.distance * 1000)} m vom Gewässer.`);
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
    const parking = userParkings.find((item) => item.id === id);
    if (!window.confirm(`Eigenen Parkplatz${parking?.name ? ` „${parking.name}“` : ""} wirklich löschen?`)) return;
    const next = userParkings.filter((item) => item.id !== id);
    try {
      saveLocalArray(USER_PARKINGS_KEY, withoutPhoto(next));
      await deleteAtlasPhoto(id);
      setUserParkings(next);
      if (cloudSyncReady) {
        const backup = await createCurrentBackup();
        backup.parkings = withoutPhoto(next) as UserParkingSpot[];
        backup.exportedAt = new Date().toISOString();
        await saveAutomaticBackup(backup);
        await saveCloudBackup(backup);
      }
    } catch {
      setAtlasPointMessage("⚠ Parkplatz konnte nicht vollständig gelöscht werden.");
    }
  }

  async function deleteUserHotspot(id: string) {
    const hotspot = userHotspots.find((item) => item.id === id);
    if (!window.confirm(`Eigenen Hotspot${hotspot?.name ? ` „${hotspot.name}“` : ""} wirklich löschen?`)) return;
    const next = userHotspots.filter((item) => item.id !== id);
    try {
      saveLocalArray(USER_HOTSPOTS_KEY, withoutPhoto(next));
      await deleteAtlasPhoto(id);
      setUserHotspots(next);
      if (cloudSyncReady) {
        const backup = await createCurrentBackup();
        backup.hotspots = withoutPhoto(next) as UserFishingSpot[];
        backup.exportedAt = new Date().toISOString();
        await saveAutomaticBackup(backup);
        await saveCloudBackup(backup);
      }
    } catch {
      setAtlasPointMessage("⚠ Hot Spot konnte nicht vollständig gelöscht werden.");
    }
  }

  function saveAppParkingChange(change: AppParkingChange) {
    const next = [...appParkingChanges.filter((item) => !(item.waterId === change.waterId && item.parkingId === change.parkingId)), change];
    setAppParkingChanges(next);
    saveLocalArray(APP_PARKING_CHANGES_KEY, next);
  }

  function hideAppParking(parkingId: string) {
    if (!window.confirm("Diesen App-Parkplatz für dich ausblenden?")) return;
    saveAppParkingChange({ waterId: selected.id, parkingId, status: "hidden", changedAt: new Date().toISOString() });
  }

  function deleteAppParking(parkingId: string) {
    if (!window.confirm("Diesen App-Parkplatz wirklich löschen? Er wird in deiner WamiFishing-Ansicht dauerhaft entfernt.")) return;
    const reason = window.prompt("Grund (optional): Privatgrund, Zufahrt gesperrt, nicht mehr vorhanden, falscher Eintrag …", "") ?? "";
    saveAppParkingChange({ waterId: selected.id, parkingId, status: "deleted", reason: reason.trim() || undefined, changedAt: new Date().toISOString() });
  }

  function correctAppParkingGps(parkingId: string) {
    if (!navigator.geolocation) { setAtlasPointMessage("⚠ GPS ist auf diesem Gerät nicht verfügbar."); return; }
    setAtlasPointMessage("⌖ Neue Parkplatzposition wird per GPS bestimmt …");
    navigator.geolocation.getCurrentPosition((position) => {
      saveAppParkingChange({ waterId: selected.id, parkingId, status: "corrected", latitude: position.coords.latitude, longitude: position.coords.longitude, changedAt: new Date().toISOString() });
      setAtlasPointMessage(`✓ Parkplatzposition korrigiert · ±${Math.round(position.coords.accuracy)} m`);
    }, () => setAtlasPointMessage("⚠ Parkplatzposition konnte nicht bestimmt werden."), { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 });
  }

  async function deleteManualWater(id: string) {
    const linkedHotspots = userHotspots.filter((item) => item.waterId === id).length;
    const linkedParkings = userParkings.filter((item) => item.waterId === id).length;
    const linkedCatches = catches.filter((item) => item.waterId === id).length;
    const suffix = linkedHotspots || linkedParkings || linkedCatches ? `\n\nZugeordnet bleiben: ${linkedHotspots} Hotspots, ${linkedParkings} Parkplätze, ${linkedCatches} Fänge.` : "";
    if (!window.confirm(`Eigenes Gewässer „${selected.name}“ wirklich löschen?${suffix}`)) return;
    const next = manualWaters.filter((item) => item.id !== id);
    setManualWaters(next); saveLocalArray(MANUAL_WATERS_KEY, next);
    if (cloudSyncReady) {
      void (async () => {
        try {
          const backup = await createCurrentBackup();
          backup.manualWaters = next;
          backup.exportedAt = new Date().toISOString();
          await saveAutomaticBackup(backup);
          await saveCloudBackup(backup);
        } catch (error) {
          console.error("Gelöschtes eigenes Gewässer konnte nicht sofort synchronisiert werden:", error);
        }
      })();
    }
    setMobileSelectedWaterId(null);
    setWatersVisibleCount(60);
    const fallback = waters.find((water) => water.id !== id); if (fallback) { setSelected(fallback); setFocusedWaterId(null); }
  }

  function selectAndFocus(water: FishingWater) {
  setSelected(water);

  setFocusedWaterId(
    water.latitude !== null && water.longitude !== null
      ? water.id
      : null
  );

  if (window.innerWidth <= 900 && view === "waters") {
    setMobileSelectedWaterId(water.id);
    window.setTimeout(() => {
      document.querySelector(".waters-mobile-selected-card")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
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

        const waterDistances = waters
          .map((water) => ({
            water,
            distance: distanceToWaterKm(water, latitude, longitude),
            followsRoute: Boolean(water.route && water.route.length >= 2)
          }))
          .filter((item) => Number.isFinite(item.distance));

        // Fangbuch: Wenn der GPS-Punkt direkt an einer kartierten Fließgewässer-Route
        // liegt, hat diese Vorrang vor punktförmig gespeicherten Seen/Altarmen.
        // So wird z. B. an der Elbe nicht versehentlich eine nahe „Alte Elbe“ gewählt.
        const nearbyRoute = waterDistances
          .filter((item) => item.followsRoute && item.distance <= 0.20)
          .sort((a, b) => a.distance - b.distance)[0];

        const nearest = nearbyRoute ?? waterDistances
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
      locationSource: savePosition && (existing?.latitude != null || catchPosition) ? "gps" : "manual",
      visibility: existing?.visibility ?? "private"
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

  async function useGpsForManualWater() {
    setManualWaterPositionBusy(true); setManualWaterMessage("");
    try {
      const pos = await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:30000}));
      setManualWaterPosition({latitude:pos.coords.latitude,longitude:pos.coords.longitude,source:"gps"});
      setManualWaterMessage(`✓ GPS-Position übernommen · ±${Math.round(pos.coords.accuracy)} m`);
    } catch { setManualWaterMessage("⚠ GPS-Position konnte nicht bestimmt werden."); }
    finally { setManualWaterPositionBusy(false); }
  }

  function saveManualWater(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!manualWaterPosition) { setManualWaterMessage("⚠ Bitte zuerst GPS-Position oder einen Punkt auf der Karte wählen."); return; }
    const name=String(form.get("name")??"").trim();
    if(!name){setManualWaterMessage("⚠ Bitte einen Gewässernamen eingeben.");return;}
    const fishList=fishOptions.filter((x): x is Fish=>x!=="Alle" && form.getAll("fish").includes(x));
    const typeRaw=String(form.get("waterType")??"See");
    const type: FishingWater["type"] = typeRaw==="Fluss"||typeRaw==="Bach"||typeRaw==="Kanal" ? "Fließgewässer" : typeRaw==="Kies-/Baggersee" ? "Kiesgrube" : typeRaw==="Talsperre" ? "Talsperre" : typeRaw==="Teich" ? "Teich" : "See";
    const item: ManualWater={
      id:`manual-${Date.now()}`,name,module:"LAV Sachsen-Anhalt",type,district:String(form.get("district")??"Eigener Eintrag"),
      latitude:manualWaterPosition.latitude,longitude:manualWaterPosition.longitude,fish:fishList,rating:{},notes:[String(form.get("description")??"")].filter(Boolean),spots:[],parkings:[],sourceStatus:"catalog",
      manual:true,createdAt:new Date().toISOString(),positionSource:manualWaterPosition.source,ownership:manualWaterOwnership,
      clubName:String(form.get("clubName")??"").trim()||undefined,permitsAvailableAt:String(form.get("permitsAvailableAt")??"").trim()||undefined,
      guestFishing:String(form.get("guestFishing")??"unknown") as ManualWater["guestFishing"],permission:String(form.get("permission")??"unknown") as ManualWater["permission"],
      informationSource:String(form.get("informationSource")??"own") as ManualWater["informationSource"],informationDate:String(form.get("informationDate")??"")||undefined,
      visibility:"private",description:String(form.get("description")??"").trim()||undefined
    };
    const next=[...manualWaters,item]; setManualWaters(next); saveLocalArray(MANUAL_WATERS_KEY,next); setSelected(item); setFocusedWaterId(item.id);
    setManualWaterMessage(`✓ ${name} gespeichert · zunächst Privat`); setShowAddWater(false); setManualWaterPosition(null);
  }

  async function createCurrentBackup(): Promise<WamiFishingBackup> {
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
    return {
      format: "WamiFishing Navigator Backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      favorites,
      catches: catchesWithPhotos,
      parkings: parkingsWithPhotos,
      hotspots: hotspotsWithPhotos,
      manualWaters,
      appParkingChanges
    };
  }

  async function applyBackup(backup: WamiFishingBackup) {
    for (const entry of backup.catches) if (entry.photo) await putDbPhoto(CATCH_PHOTO_STORE, entry.id, entry.photo);
    for (const item of backup.parkings) if (item.photo) await putAtlasPhoto(item.id, item.photo);
    for (const item of backup.hotspots) if (item.photo) await putAtlasPhoto(item.id, item.photo);

    const restoredCatches = backup.catches.map(({ photo, ...entry }) => entry) as EnhancedCatchEntry[];
    const restoredParkings = withoutPhoto(backup.parkings) as UserParkingSpot[];
    const restoredHotspots = withoutPhoto(backup.hotspots) as UserFishingSpot[];
    const restoredFavorites = Array.isArray(backup.favorites) ? backup.favorites : [];
    const restoredManualWaters = Array.isArray(backup.manualWaters) ? backup.manualWaters : [];
    const restoredAppParkingChanges = Array.isArray(backup.appParkingChanges) ? backup.appParkingChanges : [];

    saveCatches(restoredCatches);
    saveFavorites(restoredFavorites);
    saveLocalArray(USER_PARKINGS_KEY, restoredParkings);
    saveLocalArray(USER_HOTSPOTS_KEY, restoredHotspots);
    saveLocalArray(MANUAL_WATERS_KEY, restoredManualWaters);
    saveLocalArray(APP_PARKING_CHANGES_KEY, restoredAppParkingChanges);
    setFavorites(restoredFavorites);
    setCatches(backup.catches);
    setUserParkings(backup.parkings);
    setUserHotspots(backup.hotspots);
    setManualWaters(restoredManualWaters);
    setAppParkingChanges(restoredAppParkingChanges);
    // Ein aus der Cloud übernommener Stand wird nur lokal gespeichert.
    // Niemals hier wieder in die Cloud schreiben: Sonst kann ein zweites Gerät
    // beim Einlesen einen älteren Stand zurückschreiben und Löschungen rückgängig machen.
    await saveAutomaticBackup(backup);
  }

  async function exportBackupFile() {
    setDataMessage("");
    try {
      const backup = await createCurrentBackup();
      await saveAutomaticBackup(backup);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wamifishing-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      const photos = [...backup.catches, ...backup.parkings, ...backup.hotspots].filter(item => Boolean(item.photo)).length;
      setDataMessage(`✅ Sicherungsdatei erstellt: ${backup.catches.length} Fänge · ${backup.parkings.length} Parkplätze · ${backup.hotspots.length} Hot Spots · ${photos} Fotos.`);
    } catch (error) {
      setDataMessage(`⚠ ${error instanceof Error ? error.message : "Sicherungsdatei konnte nicht erstellt werden."}`);
    }
  }

  async function importBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setDataMessage("");
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isValidAutomaticBackup(parsed)) throw new Error("Die Datei ist keine gültige WamiFishing-Sicherung.");
      const backup = parsed as WamiFishingBackup;
      const photos = [...backup.catches, ...backup.parkings, ...backup.hotspots].filter(item => Boolean(item.photo)).length;
      const summary = `${backup.catches.length} Fänge · ${backup.parkings.length} Parkplätze · ${backup.hotspots.length} Hot Spots · ${photos} Fotos`;
      if (!window.confirm(`Diese Sicherung enthält:

${summary}

Aktuellen Datenbestand damit ersetzen?`)) return;
      await applyBackup(backup);
      setDataMessage(`✅ Wiederhergestellt: ${summary}.`);
    } catch (error) {
      setDataMessage(`⚠ ${error instanceof Error ? error.message : "Sicherung konnte nicht wiederhergestellt werden."}`);
    }
  }

  async function restoreAutomaticBackup() {
    setDataMessage("");
    try {
      const cloudBackup = await loadCloudBackup().catch(() => null);
      const localBackup = await loadAutomaticBackup();
      const backup = cloudBackup && localBackup
        ? (backupItemCount(cloudBackup) >= backupItemCount(localBackup) ? cloudBackup : localBackup)
        : (cloudBackup ?? localBackup);
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
      await applyBackup(backup);
      setDataMessage(`✅ Automatische Sicherung wiederhergestellt: ${backup.catches.length} Fänge, ${backup.parkings.length} Parkplätze, ${backup.hotspots.length} Hot Spots.`);
    } catch (error) {
      setDataMessage(`⚠ ${error instanceof Error ? error.message : "Automatische Sicherung konnte nicht wiederhergestellt werden."}`);
    }
  }

  async function deleteAllPersonalData() {
    if (!window.confirm("Wirklich alle persönlichen WamiFishing-Daten löschen? Fänge, Fotos, Parkplätze, Hot Spots, Favoriten und die automatische Sicherung werden entfernt.")) return;
    setDataMessage("");
    try {
      // Zuerst die Sicherung entfernen, damit gelöschte Daten nicht wieder auftauchen.
      localStorage.removeItem(AUTO_BACKUP_KEY);
      localStorage.removeItem(PREVIOUS_AUTO_BACKUP_KEY);
      localStorage.removeItem(AUTO_CATCH_BACKUP_KEY);
      await clearDbStore(BACKUP_STORE);
      await deleteCloudBackup();
      saveCatches([]);
      saveFavorites([]);
      saveLocalArray(USER_PARKINGS_KEY, []);
      saveLocalArray(USER_HOTSPOTS_KEY, []);
      await Promise.all([clearDbStore(CATCH_PHOTO_STORE), clearDbStore(ATLAS_PHOTO_STORE)]);

      setFavorites([]);
      setCatches([]);
      setUserParkings([]);
      setUserHotspots([]);
      setImportedSpots([]);
      setBackupStatus("Keine Sicherung vorhanden");
      setDataMessage("✅ Persönliche WamiFishing-Daten wurden gelöscht.");
    } catch (error) {
      setDataMessage(`⚠ ${error instanceof Error ? error.message : "Daten konnten nicht vollständig gelöscht werden."}`);
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

  useEffect(() => {
    setWatersVisibleCount(60);
  }, [query, fish, waterPlace, watersFavoritesOnly, watersHotspotsOnly]);

  useEffect(() => {
    if (view !== "waters") setMobileSelectedWaterId(null);
  }, [view]);

  function openProfilePhoto(src: string, title: string) {
    setCatchPhotoViewer({ src, title });
  }

  if (!authChecked) {
    return <main><section className="page narrow"><div className="panel"><p className="eyebrow">{WAMIFISHING_VERSION_LABEL}</p><h1>WamiFishing</h1><p>Anmeldung wird geprüft …</p></div></section></main>;
  }

  if (!authEmail) {
    return (
      <main>
        <section className="page narrow">
          <div className="panel">
            <p className="eyebrow">{WAMIFISHING_VERSION_LABEL}</p>
            <h1>🎣 WamiFishing</h1>
            <h3>📧 Anmeldung & Jahresfreigabe</h3>
            {!authOtpSent && <p>Mit deiner freigeschalteten E-Mail-Adresse kannst du WamiFishing auf bis zu drei Geräten nutzen. Neue Benutzer beantragen den Zugang einmalig.</p>}
            {!authOtpSent && <>
              <label style={{display:"block",width:"100%",marginBottom:14,fontWeight:700}}>Name
                <input style={{display:"block",width:"100%",boxSizing:"border-box",marginTop:6}} value={authNameDraft} onChange={e=>setAuthNameDraft(e.target.value)} autoComplete="name" placeholder="Vor- und Nachname"/>
              </label>
              <label style={{display:"block",width:"100%",marginBottom:16,fontWeight:700}}>E-Mail-Adresse
                <input style={{display:"block",width:"100%",boxSizing:"border-box",marginTop:6}} type="email" value={authEmailDraft} onChange={e=>setAuthEmailDraft(e.target.value)} autoComplete="email" placeholder="name@beispiel.de"/>
              </label>
              <div className="data-backup-actions"><button type="button" onClick={()=>void requestAccess()}>📝 Neuer Benutzer: Zugang beantragen</button><button type="button" onClick={()=>void sendLoginCode()}>✉️ Bestehendes Konto: Anmeldecode senden</button></div>
            </>}
            {authOtpSent && <>
              <p className="backup-status">Wir haben dir eine E-Mail mit dem Code an <strong>{authEmailDraft}</strong> gesendet.</p>
              <p>Bitte gib den 6-stelligen Code hier ein.</p>
              <label style={{display:"block",width:"100%",fontWeight:700}}>Anmeldecode
                <input style={{display:"block",width:"100%",boxSizing:"border-box",marginTop:6,textAlign:"center",fontSize:"1.35rem",letterSpacing:"0.3em"}} inputMode="numeric" value={authOtp} onChange={e=>{const code=e.target.value.replace(/\D/g,"").slice(0,6);setAuthOtp(code);if(code.length===6)void verifyLoginCode(code);}} autoComplete="one-time-code" autoFocus/>
              </label>
              <p className="backup-status">{authVerifyBusy ? "Code wird automatisch geprüft …" : "Die Anmeldung startet automatisch mit der 6. Ziffer."}</p>
            </>}
            {authMessage&&(!authOtpSent || authMessage.startsWith("⚠"))&&<p className="data-backup-message">{authMessage}</p>}
          </div>
        </section>
        <button type="button" className="intro-video-button" onClick={()=>setShowIntroVideo(true)}>▶ Erklärungsvideo</button>
        {showIntroVideo && typeof document !== "undefined" && createPortal(<div className="intro-video-overlay" role="dialog" aria-modal="true" aria-label="WamiFishing Erklärungsvideo" onClick={()=>setShowIntroVideo(false)}><div className="intro-video-dialog" onClick={e=>e.stopPropagation()}><button type="button" className="intro-video-close" aria-label="Video schließen" onClick={()=>setShowIntroVideo(false)}>✕</button><video src="/wamifishing-erklaervideo.mp4" controls autoPlay playsInline preload="metadata" onEnded={()=>setShowIntroVideo(false)} /></div></div>, document.body)}
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => setView("dashboard")}><span>🎣🐟</span><div><strong>WamiFishing</strong><span className="brand-tagline">Dein Angelrevier</span><small>{WAMIFISHING_VERSION_LABEL}</small></div></button>
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
              ["atlas", "🗺 Atlas"],
              ["waters", "🐟 Gewässer"],
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

      {view === "dashboard" && <section className="page dashboard dashboard-v602">
        <div className="dashboard-actions">
          <button className="dashboard-action dashboard-action-parking" type="button" onClick={()=>parkingPhotoRef.current?.click()} disabled={freeHotspotBusy || atlasPointSaving !== null}>
            <span className="dashboard-action-icon">🅿️</span><strong>{freeHotspotBusy ? "Standort wird erkannt …" : "Parkplatz speichern"}</strong><span className="dashboard-action-arrow">›</span>
          </button>
          <button className="dashboard-action dashboard-action-hotspot" type="button" onClick={()=>hotspotPhotoRef.current?.click()} disabled={freeHotspotBusy || atlasPointSaving !== null}>
            <span className="dashboard-action-icon">📍</span><strong>{freeHotspotBusy ? "Standort wird erkannt …" : "Hotspot speichern"}</strong><span className="dashboard-action-arrow">›</span>
          </button>
          <button className="dashboard-action dashboard-action-catch" type="button" onClick={()=>setView("diary")}>
            <span className="dashboard-action-icon">🐟</span><strong>Fang eintragen</strong><span className="dashboard-action-arrow">›</span>
          </button>
          <button className="dashboard-action dashboard-action-water" type="button" onClick={()=>{setShowAddWater(true);setManualWaterMessage("");}}>
            <span className="dashboard-action-icon">🏞️</span><strong>Gewässer hinzufügen</strong><span className="dashboard-action-arrow">›</span>
          </button>
          <input ref={parkingPhotoRef} className="atlas-hidden-photo-input" type="file" accept="image/*" capture="environment" onChange={(event)=>handleAtlasPhoto("parking", event)}/>
          <input ref={hotspotPhotoRef} className="atlas-hidden-photo-input" type="file" accept="image/*" capture="environment" onChange={(event)=>handleAtlasPhoto("hotspot", event)}/>
        </div>
        {atlasPointMessage && <p className="atlas-point-message">{atlasPointMessage}</p>}

        <div className="dashboard-shortcuts">
          <button type="button" onClick={()=>setView("settings")}><span>👤</span><strong>Profil</strong><b>›</b></button>
          <button type="button" onClick={()=>setView("settings")}><span>👥</span><strong>Freunde</strong><b>›</b></button>
          <button type="button" onClick={()=>setView("settings")}><span>☁️</span><strong>Cloud</strong><b>›</b></button>
          <button type="button" onClick={()=>setView("settings")}><span>ⓘ</span><strong>Info</strong><b>›</b></button>
        </div>

        <div className="dashboard-mini-stats">
          <button type="button" onClick={()=>{setWatersFavoritesOnly(false);setView("waters");}}><span>🗺️</span><strong>{allWaters.length}</strong><small>Profile</small><b>›</b></button>
          <button type="button" onClick={()=>{setQuery("");setWaterPlace(null);setFish("Alle");setWatersFavoritesOnly(true);setView("waters");}}><span>⭐</span><strong>{favorites.length}</strong><small>Favoriten</small><b>›</b></button>
          <button type="button" onClick={()=>{setDiaryCatchesOnly(true);setView("diary");}}><span>🐟</span><strong>{catches.length}</strong><small>Fänge</small><b>›</b></button>
          <button type="button" onClick={()=>{setQuery("");setWaterPlace(null);setFish("Alle");setWatersFavoritesOnly(false);setWatersHotspotsOnly(true);setView("waters");}}><span>📍</span><strong>{userHotspots.length}</strong><small>Spots</small><b>›</b></button>
        </div>
      </section>}
      {view === "dashboard" && <button type="button" className="intro-video-button" onClick={()=>setShowIntroVideo(true)}>▶ Erklärungsvideo</button>}
      {showIntroVideo && typeof document !== "undefined" && createPortal(<div className="intro-video-overlay" role="dialog" aria-modal="true" aria-label="WamiFishing Erklärungsvideo" onClick={()=>setShowIntroVideo(false)}><div className="intro-video-dialog" onClick={e=>e.stopPropagation()}><button type="button" className="intro-video-close" aria-label="Video schließen" onClick={()=>setShowIntroVideo(false)}>✕</button><video src="/wamifishing-erklaervideo.mp4" controls autoPlay playsInline preload="metadata" onEnded={()=>setShowIntroVideo(false)} /></div></div>, document.body)}
{view === "atlas" && (
  <section ref={atlasStaticPageRef} className="atlas-static-page" style={atlasViewportHeight ? { height: `${atlasViewportHeight}px` } : undefined}>
    <div className="atlas-static-filter">
      <strong>Aktueller Filter</strong>
      <span>
        {waterPlace ? waterPlace.label : "Alle Orte"}
        {" · "}{fish === "Alle" ? "Alle Fischarten" : fish}
        {" · 20 km · "}{filtered.length} Gewässer
      </span>
      <button type="button" onClick={() => setView("waters")}>Filter / Gewässer ändern</button>
    </div>

    <div className="atlas-static-map">
      <MapView
        waters={focusedWater ? [focusedWater] : mapWaters}
        persistentRouteWaters={waters.filter((water) => Boolean((water.waterwayName && water.route?.length) || water.osmFeatureId))}
        spots={visibleSpots}
        parkings={visibleParkings}
        selectedWater={focusedWater}
        onSelect={selectAndFocus}
      />
      <div className="map-note">
        {focusedWater ? (
          <>
            <strong>{selected.name}</strong>
            <span>{visibleParkings.length} Parkplätze · {visibleSpots.length} Hotspots</span>
            <button type="button" onClick={() => setFocusedWaterId(null)}>Alle Filtertreffer zeigen</button>
          </>
        ) : (
          <span>{mappedCount} von {filtered.length} Filtertreffern sind kartiert.</span>
        )}
      </div>
    </div>
  </section>
)}
            {view === "waters" && <section className="page">
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
          <div className="forecast-control waters-filter-count" aria-label="Anzahl Gewässer im Filter" title="Anzahl Gewässer im Filter">
            <span className="forecast-control-icon" aria-hidden="true">🐟</span><strong>{filtered.length}</strong>
          </div>
        </div>
        {watersFavoritesOnly && <div className="forecast-meta-modern waters-search-meta waters-search-meta-below"><div><strong>⭐ Gespeicherte Favoriten</strong><span>{filtered.length} Gewässer</span></div></div>}
        {watersHotspotsOnly && <div className="forecast-meta-modern waters-search-meta waters-search-meta-below"><div><strong>📍 Gewässer mit eigenen Hotspots</strong><span>{filtered.length} Gewässer · {userHotspots.length} Hotspots</span></div></div>}
        {(waterPlace || fish !== "Alle" || watersFavoritesOnly || watersHotspotsOnly) && <button type="button" className="forecast-reset-filter" onClick={resetWatersFilters}>× Filter aufheben</button>}

        {waterSearchError && <p className="forecast-error">⚠ {waterSearchError}</p>}
        </div>
        <div className="workspace waters-without-map"><aside className="sidebar"><div className="sidebar-heading"><strong>{filtered.length} Gewässer</strong><span>Demo-/Prüfdaten</span></div><div className="water-list">{mobileSelectedWaterId && selected.id === mobileSelectedWaterId && (
              <div className="waters-mobile-selection">
                <button type="button" className="waters-mobile-back" onClick={() => setMobileSelectedWaterId(null)}>← Zurück zur Gewässerliste</button>
                <article className="water-card selected waters-mobile-selected-card">
                  <div><h2>{selected.name}</h2><p>{selected.module} · {selected.type}</p></div>
                  <button className="favorite" onClick={(e)=>{e.stopPropagation();toggleFavorite(selected.id)}}>{favorites.includes(selected.id)?'★':'☆'}</button>
                  <div className="fish-row">{waterTargetFish(selected).map(item=><span key={item}>{item} {'★'.repeat(targetFishRating(selected,item))}</span>)}</div>
                </article>
              </div>
            )}
            <div className={mobileSelectedWaterId ? "waters-list-mobile-hidden" : ""}>
              {filtered.slice(0, watersVisibleCount).map((water)=><article key={water.id} className={`water-card ${selected.id===water.id?'selected':''}`} onClick={()=>selectAndFocus(water)}><div><h2>{water.name}</h2><p>{water.module} · {water.type}</p></div><button className="favorite" onClick={(e)=>{e.stopPropagation();toggleFavorite(water.id)}}>{favorites.includes(water.id)?'★':'☆'}</button><div className="fish-row">{waterTargetFish(water).map(item=><span key={item}>{item} {'★'.repeat(targetFishRating(water,item))}</span>)}</div></article>)}
              {watersVisibleCount < filtered.length && (
                <button type="button" className="waters-load-more" onClick={() => setWatersVisibleCount((count) => count + 60)}>
                  Weitere 60 Gewässer anzeigen · {filtered.length - watersVisibleCount} übrig
                </button>
              )}
            </div>
          </div></aside>
          <aside className={`details ${mobileSelectedWaterId ? "waters-mobile-profile-visible" : "waters-mobile-profile-hidden"}`}><p className="eyebrow">Gewässerprofil</p><div className="water-stats">
  <div className="stat-card">
    <span>🐟</span>
    <strong>{waterTargetFish(selected).length}</strong>
    <small>Zielfische</small>
  </div>

  <div className="stat-card">
    <span>📍</span>
    <strong>{selected.spots.length + selectedUserHotspots.length}</strong>
    <small>Hotspots</small>
  </div>

  <div className="stat-card">
    <span>🅿️</span>
    <strong>{selectedAppParkings.length + selectedUserParkings.length}</strong>
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
          {(selectedAppParkings.length > 0 || selectedUserParkings.length > 0) && <><h3>Parkplätze / Ausgangspunkte</h3><div className="nav-list">{[...selectedAppParkings, ...selectedUserParkings].map(p=><article key={p.id}><strong>{p.name}</strong><small>{p.note ?? `${p.access==='public'?'öffentlich':'Zufahrt eingeschränkt'} · ${p.accuracy==='verified'?'belegt':'Näherungswert'}`}</small>{'photo' in p && typeof p.photo === 'string' && p.photo && <button type="button" className="water-profile-photo-button" onClick={() => openProfilePhoto(typeof p.photo === "string" ? p.photo : "", typeof p.name === "string" && p.name ? p.name : "Parkplatz")} aria-label="Parkplatzfoto groß anzeigen"><img src={p.photo} alt="Parkplatz"/></button>}<div className="mini-actions"><a href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=driving`} target="_blank" rel="noreferrer">Google Auto</a><a href={`https://maps.apple.com/?daddr=${p.latitude},${p.longitude}&dirflg=d`} target="_blank" rel="noreferrer">Apple Auto</a>{"waterId" in p ? <><select value={(p as UserParkingSpot).visibility ?? "private"} onChange={e=>setParkingVisibility(p.id,e.target.value as ShareVisibility)} aria-label="Sichtbarkeit Parkplatz"><option value="private">🔒 Privat</option><option value="friends">👥 Freunde</option><option value="public">🌍 Öffentlich</option></select><button type="button" onClick={()=>deleteUserParking(p.id)}>🗑️ Löschen</button></> : <div className="app-parking-edit-actions" style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,width:"100%",gridColumn:"1 / -1"}}><button type="button" onClick={()=>correctAppParkingGps(p.id)}>📍 Position</button><button type="button" onClick={()=>hideAppParking(p.id)}>🚫 Ausblenden</button><button type="button" onClick={()=>deleteAppParking(p.id)}>🗑️ Löschen</button></div>}</div></article>)}</div></>}
          {(selected.spots.length > 0 || selectedUserHotspots.length > 0) && <><h3>Hotspots / Erkundungspunkte</h3><div className="nav-list">{[...selected.spots, ...selectedUserHotspots].map(spot=>{const parking=[...selectedAppParkings, ...selectedUserParkings].find(p=>p.id===spot.parkingId);return <article key={spot.id}><strong>{spot.name}</strong><small>{spot.risk ?? spot.note ?? 'Zugang vor Ort prüfen.'}</small>{'photo' in spot && typeof spot.photo === 'string' && spot.photo && <button type="button" className="water-profile-photo-button" onClick={() => openProfilePhoto(typeof spot.photo === "string" ? spot.photo : "", typeof spot.name === "string" && spot.name ? spot.name : "Hotspot")} aria-label="Hotspotfoto groß anzeigen"><img src={spot.photo} alt="Hotspot"/></button>}<div className="mini-actions"><a href={`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=walking`} target="_blank" rel="noreferrer">Zu Fuß ab Standort</a>{parking&&<a href={`https://www.google.com/maps/dir/?api=1&origin=${parking.latitude},${parking.longitude}&destination=${spot.latitude},${spot.longitude}&travelmode=walking`} target="_blank" rel="noreferrer">Zu Fuß ab Parkplatz</a>}{"waterId" in spot && <><select value={(spot as UserFishingSpot).visibility ?? "private"} onChange={e=>setHotspotVisibility(spot.id,e.target.value as ShareVisibility)} aria-label="Sichtbarkeit Hotspot"><option value="private">🔒 Privat</option><option value="friends">👥 Freunde</option><option value="public">🌍 Öffentlich</option></select><button type="button" onClick={()=>deleteUserHotspot(spot.id)}>🗑️ Löschen</button></>}</div></article>})}</div></>}
          {"manual" in selected && selected.manual === true && <div className="button-row"><button type="button" onClick={()=>void deleteManualWater(selected.id)}>🗑️ Eigenes Gewässer löschen</button></div>}
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
        const selectedCatchWater = allWaters.find((water) => water.id === catchWaterId);
        const selectedCatchDistance = selectedCatchWater && catchPosition
          ? distanceToWaterKm(selectedCatchWater, catchPosition.latitude, catchPosition.longitude)
          : null;
        return <section className="page diary diary-v2">
          {!diaryCatchesOnly && <form ref={catchFormRef} className="panel catch-entry-card" onSubmit={addCatch}>
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
              <label className="wide">Gewässer <select name="waterId" value={catchWaterId} onChange={(event)=>setCatchWaterId(event.target.value)} required><option value="">Gewässer auswählen …</option>{allWaters.slice().sort((a,b)=>a.name.localeCompare(b.name,"de")).map((water)=><option value={water.id} key={water.id}>{water.name}{water.lavNumber ? ` · ${water.lavNumber}` : ""}</option>)}</select></label><label className="wide">Datum / Uhrzeit <input name="caughtAt" type="datetime-local" defaultValue={new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}/></label>
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
          </form>}

          <div className="catch-history">
            <div className="catch-history-head"><div><p className="eyebrow">Eigene Datenbasis</p><h2>Gespeicherte Fänge</h2></div><strong>{catches.length}</strong></div>
            <div className="catch-list catch-list-v2">{catches.map(entry=>{
              const water = allWaters.find(w=>w.id===entry.waterId);
              return <article key={entry.id}>
                {entry.photo && <><button type="button" className="catch-history-photo-button" onClick={()=>setCatchPhotoViewer({ src: entry.photo!, title: `${entry.fish} · ${water?.name ?? entry.waterId}` })} aria-label="Fangfoto groß ansehen"><img className="catch-history-photo" src={entry.photo} alt={`Fangfoto ${entry.fish}`}/><span>📷 Foto ansehen</span></button><button type="button" className="catch-photo-save-button" onClick={()=>void saveCatchPhotoToPhotoApp(entry.photo!,entry.fish)}>📲 In Fotos sichern</button></>}
                <div className="catch-list-main"><strong>{entry.fish}</strong><p>{water?.name ?? entry.waterId} · {new Date(entry.caughtAt).toLocaleString("de-DE")}</p><small>{[entry.method, entry.lure, entry.depthM ? `${entry.depthM} m` : ""].filter(Boolean).join(" · ") || "Keine Zusatzangaben"}</small>{entry.weather && <small>🌤 {entry.weather.temperature.toFixed(0)} °C · {Math.round(entry.weather.pressure)} hPa · {Math.round(entry.weather.windSpeed)} km/h · {windDisplay(entry.weather.windDirection)}{entry.weather.windDirection != null ? ` (${Math.round(entry.weather.windDirection)}°)` : ""}</small>}{entry.moonPhase && <small>◐ {entry.moonPhase} · {entry.moonIllumination ?? 0} %</small>}{entry.photo && <button type="button" className="catch-photo-open-inline" onClick={()=>setCatchPhotoViewer({ src: entry.photo!, title: `${entry.fish} · ${water?.name ?? entry.waterId}` })}>📷 Fangfoto öffnen</button>}</div>
                <span className="catch-measure">{entry.lengthCm?`${entry.lengthCm} cm`:""}{entry.weightKg?`${entry.lengthCm?" · ":""}${entry.weightKg} kg`:""}</span><select value={entry.visibility ?? "private"} onChange={e=>setCatchVisibility(entry.id,e.target.value as ShareVisibility)} aria-label="Sichtbarkeit Fang"><option value="private">🔒 Privat</option><option value="friends">👥 Freunde</option><option value="public">🌍 Öffentlich</option></select><button type="button" className="catch-edit-button" onClick={()=>{setDiaryCatchesOnly(false);editCatch(entry);}}>✏️ Bearbeiten</button>
              </article>;
            })}{!catches.length&&<p className="catch-empty">Noch keine Fänge gespeichert. Der erste Eintrag baut deine eigene Prognose-Datenbasis auf.</p>}</div>
            {sharedCatches.length>0 && <><div className="catch-history-head"><div><p className="eyebrow">Freunde & Öffentlich</p><h2>Freigegebene Fänge</h2></div><strong>{sharedCatches.length}</strong></div><div className="catch-list catch-list-v2">{sharedCatches.map(entry=>{const water=allWaters.find(w=>w.id===entry.waterId);return <article key={`${entry.ownerId}-${entry.id}`}><div className="catch-list-main"><strong>{entry.fish}</strong><p>{water?.name ?? entry.waterId} · von {entry.ownerName}</p><small>{visibilityLabel(entry.visibility)} · {new Date(entry.caughtAt).toLocaleString("de-DE")}</small></div><span className="catch-measure">{entry.lengthCm?`${entry.lengthCm} cm`:""}</span></article>})}</div></>}
          </div>
        </section>;
      })()}

      {catchPhotoViewer && typeof document !== "undefined" && createPortal(
        <div className="catch-photo-modal-backdrop" role="presentation" onClick={()=>setCatchPhotoViewer(null)}>
          <div className="catch-photo-modal" role="dialog" aria-modal="true" aria-label="Fangfoto" onClick={(event)=>event.stopPropagation()}>
            <div className="catch-photo-modal-head"><strong>{catchPhotoViewer.title}</strong><button type="button" className="photo-back-button" onClick={()=>setCatchPhotoViewer(null)} aria-label="Zurück zum Gewässerprofil">← Zurück</button></div>
            <img src={catchPhotoViewer.src} alt={catchPhotoViewer.title}/>
            <div className="catch-photo-modal-actions">
              <a href={catchPhotoViewer.src} download={`wamifishing-fangfoto-${new Date().toISOString().slice(0,10)}.jpg`}>💾 Foto speichern</a>
              <button type="button" onClick={()=>setCatchPhotoViewer(null)}>Schließen</button>
            </div>
          </div>
        </div>,
        document.body
      )}


      {showAddWater && <div className="fish-measure-overlay"><div className="fish-measure-panel manual-water-panel">
        <div className="fish-measure-head"><div><strong>➕ Gewässer manuell hinzufügen</strong><small>{WAMIFISHING_VERSION_LABEL} · eigener Eintrag</small></div><button type="button" onClick={()=>setShowAddWater(false)}>✕</button></div>
        <form className="catch-form" onSubmit={saveManualWater}>
          <h3>1. Position</h3><div className="data-backup-actions"><button type="button" onClick={()=>void useGpsForManualWater()} disabled={manualWaterPositionBusy}>📍 {manualWaterPositionBusy?"GPS wird ermittelt …":"Per GPS-Koordinaten"}</button><button type="button" onClick={()=>{setManualWaterPosition(null);setManualWaterMessage("Tippe jetzt auf der Karte auf die Gewässerposition.");}}>🗺️ Aus Karte</button></div>
          {manualWaterMessage&&<p className="atlas-point-message">{manualWaterMessage}</p>}
          {manualWaterPosition?.source==="map" || (!manualWaterPosition && manualWaterMessage.includes("Karte")) ? <div style={{height:280,borderRadius:14,overflow:"hidden"}}><MapView waters={[]} spots={[]} parkings={[]} selectedWater={null} onSelect={()=>{}} onMapClick={(lat,lon)=>{setManualWaterPosition({latitude:lat,longitude:lon,source:"map"});setManualWaterMessage(`✓ Kartenposition gewählt · ${lat.toFixed(5)}, ${lon.toFixed(5)}`);}} selectionPoint={manualWaterPosition}/></div>:null}
          {manualWaterPosition&&<small>Koordinaten: {manualWaterPosition.latitude.toFixed(6)}, {manualWaterPosition.longitude.toFixed(6)} · {manualWaterPosition.source==="gps"?"GPS":"Karte"}</small>}
          <h3>2. Grunddaten</h3><label className="wide">Gewässername *<input name="name" required placeholder="z. B. Mühlenteich"/></label><label>Gewässerart<select name="waterType" defaultValue="See"><option>See</option><option>Teich</option><option>Fluss</option><option>Bach</option><option>Kanal</option><option>Talsperre</option><option>Kies-/Baggersee</option><option>Altarm</option><option>Hafen</option><option>Sonstiges</option></select></label><label>Region / Ort<input name="district" placeholder="optional"/></label>
          <h3>3. Zugang & Berechtigung</h3><label>Gewässerstatus<select value={manualWaterOwnership} onChange={e=>setManualWaterOwnership(e.target.value as ManualWater["ownership"])}><option value="unknown">Unbekannt</option><option value="public">Öffentlich / frei zugänglich</option><option value="club">Vereinsgewässer</option><option value="private">Privatgewässer</option><option value="lease">Pachtgewässer</option></select></label><label>Angelberechtigung<select name="permission" defaultValue="unknown"><option value="unknown">Unbekannt</option><option value="free">Frei beangelbar</option><option value="membership">Vereinsmitgliedschaft erforderlich</option><option value="guest-card">Gast-/Tageskarte erhältlich</option><option value="special">Besondere Genehmigung erforderlich</option></select></label>
          {(manualWaterOwnership==="club"||manualWaterOwnership==="lease")&&<><label>Verein / Verband<input name="clubName"/></label><label>Gastangler<select name="guestFishing" defaultValue="unknown"><option value="unknown">Unbekannt</option><option value="yes">Ja</option><option value="no">Nein</option></select></label></>}
          <label className="wide">Angelkarten erhältlich bei<input name="permitsAvailableAt" placeholder="Verein, Geschäft, Webseite …"/></label>
          <h3>4. Fischarten</h3><div className="manual-fish-grid">{fishOptions.filter(x=>x!=="Alle").map(x=><label key={x}><input type="checkbox" name="fish" value={x}/>{x}</label>)}</div>
          <h3>5. Hinweise & Quelle</h3><label className="wide">Beschreibung / Sonderbestimmungen<textarea name="description" rows={3}/></label><label>Informationsquelle<select name="informationSource" defaultValue="own"><option value="own">Eigene Kenntnis</option><option value="club">Verein</option><option value="rules">Gewässerordnung</option><option value="permit">Angelkarte</option><option value="internet">Internet</option><option value="other">Sonstige</option></select></label><label>Stand der Information<input name="informationDate" type="date" defaultValue={new Date().toISOString().slice(0,10)}/></label>
          <p><strong>🔒 Sichtbarkeit: Privat.</strong> Freunde/Öffentlich wird mit der kommenden User- und Teilenfunktion aktiviert.</p>
          <div className="fish-measure-actions"><button type="button" onClick={()=>setShowAddWater(false)}>Abbrechen</button><button type="submit">✓ Gewässer speichern</button></div>
        </form>
      </div></div>}

      {view === "settings" && (sharedCatches.length+sharedParkings.length+sharedHotspots.length)>0 && <section className="page narrow"><div className="panel"><p className="eyebrow">Freunde</p><h2>👥 Freigegebene Inhalte</h2><p>{sharedCatches.length} Fänge · {sharedHotspots.length} Hotspots · {sharedParkings.length} Parkplätze sind für dich freigegeben.</p><div className="nav-list">{sharedHotspots.map(x=><article key={`${x.ownerId}-${x.id}`}><strong>📍 {x.name}</strong><small>{x.ownerName} · {visibilityLabel(x.visibility)}</small></article>)}{sharedParkings.map(x=><article key={`${x.ownerId}-${x.id}`}><strong>🅿️ {x.name}</strong><small>{x.ownerName} · {visibilityLabel(x.visibility)}</small></article>)}</div></div></section>}
      {view === "settings" && <section className="page narrow"><div className="panel"><p className="eyebrow">{WAMIFISHING_VERSION_LABEL}</p><h1>Offline & Daten</h1><h3>Installierbare Web-App</h3><p>Manifest und Service Worker sind vorbereitet. Nach einem Produktions-Deployment kann die App über den Browser zum Startbildschirm hinzugefügt werden.</p><h3>Lokale Speicherung</h3><p>Favoriten, Fangbuch, Fangfotos, eigene Parkplätze und Hot Spots liegen lokal in diesem Browser. Fotos werden platzsparend im lokalen Bildspeicher abgelegt.</p>
        <h3>Fangfoto-Messung</h3><p>Der komplette Rutengriff dient als Maßstab für die 4-Punkt-Messung.</p><label className="rod-handle-setting">Rutengrifflänge <span><input type="number" min="10" max="150" step="0.1" value={rodHandleLengthCm} onChange={(e)=>{const v=Number(e.target.value);setRodHandleLengthCm(v);if(Number.isFinite(v)&&v>0)localStorage.setItem("wamifishing:rod-handle-length-cm",String(v));}}/> cm</span></label>
        <h3>📧 Anmeldung & Cloudspeicherung</h3><p><strong>{WAMIFISHING_VERSION_LABEL} verwendet eine Jahresfreigabe per E-Mail. Neue Benutzer beantragen den Zugang einmalig; nach der Zahlungskontrolle wird das Konto für 1 Jahr freigeschaltet.</strong> Weitere eigene Geräte werden beim Versand des Anmeldecodes automatisch registriert, solange weniger als drei Geräte hinterlegt sind. Auf PC, iPhone und iPad verwendest du dieselbe E-Mail-Adresse; der bisherige Sync-Code dient im Hintergrund nur noch zur Übernahme deiner vorhandenen Daten.</p>{authEmail ? <><p className="backup-status">✓ Angemeldet als <strong>{authEmail}</strong></p><div className="data-backup-actions"><button type="button" onClick={()=>void logoutEmail()}>Abmelden</button>{authIsAdmin&&<button type="button" onClick={()=>{window.location.href="/admin"}}>⚙️ Administration</button>}</div></> : <><label className="wide">Name<input value={authNameDraft} onChange={e=>setAuthNameDraft(e.target.value)} autoComplete="name" placeholder="Vor- und Nachname"/></label><label className="wide">E-Mail-Adresse<input type="email" value={authEmailDraft} onChange={e=>setAuthEmailDraft(e.target.value)} autoComplete="email" placeholder="name@beispiel.de"/></label><p className="backup-status">Geräte-ID: <strong>{getDeviceId()}</strong></p><div className="data-backup-actions"><button type="button" onClick={()=>void requestAccess()}>📝 Zugang beantragen</button><button type="button" onClick={()=>void sendLoginCode()}>✉️ Anmeldecode senden</button></div>{authOtpSent && <><label className="wide">6-stelliger Code<input inputMode="numeric" value={authOtp} onChange={e=>{const code=e.target.value.replace(/\D/g,"").slice(0,6);setAuthOtp(code);if(code.length===6)void verifyLoginCode(code);}} autoComplete="one-time-code"/></label><div className="data-backup-actions"><button type="button" onClick={()=>void verifyLoginCode()}>✓ Anmelden</button></div></>}{authMessage&&<p className="data-backup-message">{authMessage}</p>}</>}{backupStatus && <p className="backup-status">{backupStatus}</p>}
        <h3>🔐 Datenschutz & Konto</h3>
        {authEmail ? <><p>Dein WamiFishing-Konto ist mit <strong>{authEmail}</strong> angemeldet. Du kannst hier die vollständige Löschung deines Kontos und der zugehörigen persönlichen Cloud-Daten beantragen. <strong>Die Daten werden nicht sofort gelöscht.</strong> Die Anfrage muss zuerst in der Administration bestätigt werden.</p><div className="data-backup-actions"><button type="button" onClick={()=>void requestAccountDeletion()}>🗑️ Konto- und Datenlöschung anfordern</button></div></> : <p>Für eine Löschanfrage musst du angemeldet sein.</p>}
        <h3>👥 Freunde</h3><div className="social-profile-stack"><label>Anzeigename<input value={socialName} onChange={e=>setSocialName(e.target.value)} placeholder="z. B. Wami" maxLength={40}/></label><label>Mein Freundescode<input value={friendCodeDraft} onChange={e=>setFriendCodeDraft(e.target.value.toUpperCase())} autoCapitalize="characters" autoCorrect="off" spellCheck={false}/></label><div className="data-backup-actions"><button type="button" onClick={()=>void saveSocialProfile()}>✓ Profil / Freundescode speichern</button></div>
        <label>Freund hinzufügen<input value={friendAddCode} onChange={e=>setFriendAddCode(e.target.value.toUpperCase())} placeholder="WAMI-XXXXXXXX" autoCapitalize="characters" autoCorrect="off" spellCheck={false}/></label><div className="data-backup-actions"><button type="button" onClick={()=>void sendFriendRequest()} disabled={!friendAddCode.trim()}>➕ Freundschaftsanfrage senden</button><button type="button" onClick={()=>void loadSocialProfile()}>↻ Aktualisieren</button></div></div>
        {friendRequests.length>0&&<div className="nav-list"><h4>Offene Anfragen</h4>{friendRequests.map(r=><article key={r.fromUserId}><strong>{r.fromName}</strong><small>{r.fromCode}</small><div className="mini-actions"><button type="button" onClick={()=>void acceptFriend(r.fromUserId)}>✓ Annehmen</button></div></article>)}</div>}
        {friends.length>0?<div className="nav-list"><h4>Meine Freunde</h4>{friends.map(f=><article key={f.userId}><strong>👤 {f.name}</strong><small>{f.friendCode}</small><div className="mini-actions"><button type="button" onClick={()=>void removeFriend(f.userId,f.name)}>Freundschaft beenden</button></div></article>)}</div>:<p><small>Noch keine bestätigten Freunde.</small></p>}
        <p><small><strong>Datenschutz:</strong> Jeder Eintrag bleibt standardmäßig privat. 🔒 Privat = nur du · 👥 Freunde = bestätigte Freunde · 🌍 Öffentlich = alle angemeldeten WamiFishing-Nutzer. Fremde Einträge sind nur lesbar und können von dir nicht geändert oder gelöscht werden.</small></p>{socialMessage&&<p className="data-backup-message">{socialMessage}</p>}
        <div className="data-backup-actions"><button type="button" onClick={()=>void restoreAutomaticBackup()}>↩ Daten wiederherstellen</button><button type="button" onClick={()=>void deleteAllPersonalData()}>🗑 Daten löschen</button></div>
        {dataMessage && <p className="data-backup-message">{dataMessage}</p>}
        <h3>Amtliche Verlässlichkeit</h3><p>Die enthaltenen Gewässer sind technische Demonstrationsdaten. Vor dem Angeln gelten ausschließlich aktuelle Dokumente, Beschilderung und lokale Regeln.</p></div></section>}

      {measurePhoto && <FishLengthMeasure photo={measurePhoto} handleLengthCm={rodHandleLengthCm} onClose={()=>setMeasurePhoto(null)} onApply={(cm)=>{const input=catchFormRef.current?.elements.namedItem("lengthCm") as HTMLInputElement|null;if(input)input.value=String(cm);setMeasurePhoto(null);}}/>}
      <footer>WamiFishing WAMIFISHING {WAMIFISHING_VERSION_LABEL} · Keine amtliche Gewässerkarte und keine Fanggarantie.<br/><a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a></footer>
    </main>
  );
}
