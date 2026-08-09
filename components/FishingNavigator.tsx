"use client";

import dynamic from "next/dynamic";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { waters } from "@/data/waters";
import { calculateFishingScore } from "@/lib/forecast";
import { parseGpx, spotsToGpx } from "@/lib/gpx";
import { loadCatches, loadFavorites, saveCatches, saveFavorites } from "@/lib/storage";
import type { CatchEntry, Fish, FishingSpot, FishingWater, ForecastInputs, WaterModule } from "@/lib/types";

const MapView = dynamic(() => import("./MapView"), { ssr: false });
const fishOptions: Array<Fish | "Alle"> = ["Alle", "Zander", "Barsch", "Forelle", "Schleie", "Hecht", "Karpfen"];
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

const ATLAS_RADIUS_KM = 10;

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
const [regionFilter, setRegionFilter] =
  useState<"all" | "harz">("harz");
const [atlasQuery, setAtlasQuery] = useState("");
const [atlasPlace, setAtlasPlace] = useState<AtlasPlace | null>(null);
const [atlasSearchBusy, setAtlasSearchBusy] = useState(false);
const [atlasSearchError, setAtlasSearchError] = useState("");
const [atlasCategory, setAtlasCategory] =
  useState<AtlasCategory>("all");
  const [selected, setSelected] = useState<FishingWater>(waters[0]);
  const [focusedWaterId, setFocusedWaterId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [catches, setCatches] = useState<CatchEntry[]>([]);
  const [importedSpots, setImportedSpots] = useState<FishingSpot[]>([]);
  const [forecast, setForecast] = useState<ForecastInputs>({ fish: "Zander", hour: 21, windKmh: 12, pressureTrend: "falling", cloudCover: 70 });

  useEffect(() => { setFavorites(loadFavorites()); setCatches(loadCatches()); }, []);

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
        if (regionFilter === "all") return true;

        return (
            water.district.includes("Harz") ||
            water.module === "Bodetalsperren" ||
            water.module === "Harzflüsse"
        );
    })
    .filter((water) => module === "Alle" || water.module === module)
    .filter((water) => fish === "Alle" || water.fish.includes(fish))
    .filter((water) =>
        `${water.name} ${water.lavNumber ?? ""} ${water.district} ${water.module}`
            .toLowerCase()
            .includes(query.toLowerCase())
    )
    .sort((a, b) =>
        fish === "Alle"
            ? a.name.localeCompare(b.name, "de")
            : (b.rating[fish] ?? 0) - (a.rating[fish] ?? 0)
    ),
    [fish, module, query, regionFilter]);
const atlasWaters = useMemo(() => {
  return waters
    .filter((water) => {
      if (atlasPlace) {
        if (water.latitude === null || water.longitude === null) {
          return false;
        }

        return (
          distanceKm(
            atlasPlace.latitude,
            atlasPlace.longitude,
            water.latitude,
            water.longitude
          ) <= ATLAS_RADIUS_KM
        );
      }

      const searchText =
        `${water.name} ${water.lavNumber ?? ""} ${water.district} ${water.type}`
          .toLowerCase();

      return searchText.includes(atlasQuery.toLowerCase());
    })
    .filter((water) => {
      // Im Atlas kein versteckter Regionsfilter:
      // "Alle Gewässer" bedeutet wirklich der vollständige Katalog.
      switch (atlasCategory) {
        case "reservoirs":
          return water.module === "Bodetalsperren";

        case "rivers":
          return (
            water.module === "Harzflüsse" ||
            water.type.toLowerCase().includes("fließ")
          );

        case "lakes":
          return (
            water.type.toLowerCase().includes("see") ||
            water.type.toLowerCase().includes("teich") ||
            water.type.toLowerCase().includes("talsperre") ||
            water.type.toLowerCase().includes("kiesgrube")
          );

        case "parking":
          return water.parkings.length > 0;

        case "favorites":
          return favorites.includes(water.id);

        default:
          return true;
      }
    })
    .sort((a, b) => {
      if (
        atlasPlace &&
        a.latitude !== null &&
        a.longitude !== null &&
        b.latitude !== null &&
        b.longitude !== null
      ) {
        return (
          distanceKm(
            atlasPlace.latitude,
            atlasPlace.longitude,
            a.latitude,
            a.longitude
          ) -
          distanceKm(
            atlasPlace.latitude,
            atlasPlace.longitude,
            b.latitude,
            b.longitude
          )
        );
      }

      return a.name.localeCompare(b.name, "de");
    });
}, [atlasQuery, atlasPlace, atlasCategory, favorites]);

  async function searchAtlasPlace() {
    const term = atlasQuery.trim();

    if (!term) {
      setAtlasPlace(null);
      setAtlasSearchError("");
      return;
    }

    setAtlasSearchBusy(true);
    setAtlasSearchError("");

    try {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(term)}`
      );

      if (!response.ok) {
        throw new Error("Ortssuche fehlgeschlagen");
      }

      const result = (await response.json()) as {
        latitude?: number;
        longitude?: number;
        label?: string;
      };

      if (
        typeof result.latitude !== "number" ||
        typeof result.longitude !== "number"
      ) {
        setAtlasPlace(null);
        setAtlasSearchError(
          "Ort nicht gefunden – normale Gewässersuche bleibt aktiv."
        );
        return;
      }

      setAtlasPlace({
        latitude: result.latitude,
        longitude: result.longitude,
        label: result.label || term
      });
      setFocusedWaterId(null);
    } catch {
      setAtlasPlace(null);
      setAtlasSearchError(
        "Ortssuche derzeit nicht verfügbar – normale Gewässersuche bleibt aktiv."
      );
    } finally {
      setAtlasSearchBusy(false);
    }
  }

  const ranked = useMemo(() => waters.map((water) => ({ water, score: calculateFishingScore(water, forecast) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score), [forecast]);
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

  function addCatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const entry: CatchEntry = {
      id: crypto.randomUUID(), caughtAt: String(form.get("caughtAt")), waterId: String(form.get("waterId")), fish: String(form.get("fish")) as Fish,
      lengthCm: Number(form.get("lengthCm")) || undefined, weightKg: Number(form.get("weightKg")) || undefined,
      lure: String(form.get("lure")), note: String(form.get("note"))
    };
    const next = [entry, ...catches]; setCatches(next); saveCatches(next); event.currentTarget.reset();
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
        <div className="panel"><h2>Aktuelle Empfehlung aus deinen Eingaben</h2>{ranked[0] ? <div className="recommendation"><strong>{ranked[0].water.name}</strong><span>{ranked[0].score}/100</span><p>Für {forecast.fish}, basierend auf Uhrzeit, Wind, Bewölkung und Luftdrucktrend.</p></div> : <p>Keine passende Empfehlung.</p>}</div>
      </section>}
{view === "atlas" && (
  <section className="atlas-page">

    <aside className="atlas-sidebar">
      <h2>Angelatlas</h2>

      <input
        type="search"
        placeholder="Gewässer oder Ort suchen …"
        className="atlas-search"
        value={atlasQuery}
        enterKeyHint="search"
        onChange={(event) => {
          setAtlasQuery(event.target.value);
          setAtlasPlace(null);
          setAtlasSearchError("");
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;

          event.preventDefault();
          event.currentTarget.blur();
          void searchAtlasPlace();
        }}
      />

      {atlasPlace && (
        <small
          style={{
            display: "block",
            margin: "-10px 0 12px",
            color: "var(--muted)"
          }}
        >
          Umkreis {ATLAS_RADIUS_KM} km um {atlasPlace.label}
        </small>
      )}

      {atlasSearchBusy && (
        <small
          style={{
            display: "block",
            margin: "-10px 0 12px",
            color: "var(--muted)"
          }}
        >
          Ort wird gesucht …
        </small>
      )}

      {atlasSearchError && (
        <small
          style={{
            display: "block",
            margin: "-10px 0 12px",
            color: "var(--danger)"
          }}
        >
          {atlasSearchError}
        </small>
      )}

      <div className="atlas-categories-wrap">
        <button
          type="button"
          className="atlas-scroll-button"
          aria-label="Filter nach links"
          onClick={() => scrollAtlasCategories("left")}
        >
          ‹
        </button>

        <div ref={atlasCategoryRef} className="atlas-categories">
        <button
          className={atlasCategory === "all" ? "active" : ""}
          onClick={() => setAtlasCategory("all")}
        >
          🗺 Alle Gewässer
        </button>

        <button
          className={atlasCategory === "reservoirs" ? "active" : ""}
          onClick={() => setAtlasCategory("reservoirs")}
        >
          🎣 Bodetalsperren
        </button>

        <button
          className={atlasCategory === "rivers" ? "active" : ""}
          onClick={() => setAtlasCategory("rivers")}
        >
          🌊 Flüsse
        </button>

        <button
          className={atlasCategory === "lakes" ? "active" : ""}
          onClick={() => setAtlasCategory("lakes")}
        >
          🏞 Seen und Teiche
        </button>

        <button
          className={atlasCategory === "parking" ? "active" : ""}
          onClick={() => setAtlasCategory("parking")}
        >
          🅿 Mit Parkplatz
        </button>

        <button
          className={atlasCategory === "favorites" ? "active" : ""}
          onClick={() => setAtlasCategory("favorites")}
        >
          ⭐ Favoriten
        </button>
        </div>

        <button
          type="button"
          className="atlas-scroll-button"
          aria-label="Filter nach rechts"
          onClick={() => scrollAtlasCategories("right")}
        >
          ›
        </button>
      </div>

      <div className="atlas-swipe-hint">↔ Wischen für weitere Filter</div>

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
        <span>🐟 {selected.fish.length} Zielfische</span>
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
        <div className="toolbar"><input type="search" placeholder="Gewässer suchen …" value={query} onChange={(e)=>setQuery(e.target.value)} /><select value={module} onChange={(e)=>setModule(e.target.value as WaterModule|"Alle")}>{moduleOptions.map(x=><option key={x}>{x}</option>)}</select><div className="chips">{fishOptions.map((option)=><button key={option} className={fish===option?'active':''} onClick={()=>setFish(option)}>{option}</button>)}</div></div>
        <div className="workspace"><aside className="sidebar"><div className="sidebar-heading"><strong>{filtered.length} Gewässer</strong><span>Demo-/Prüfdaten</span></div><div className="water-list">{filtered.map((water)=><article key={water.id} className={`water-card ${selected.id===water.id?'selected':''}`} onClick={()=>selectAndFocus(water)}><div><h2>{water.name}</h2><p>{water.module} · {water.type}</p></div><button className="favorite" onClick={(e)=>{e.stopPropagation();toggleFavorite(water.id)}}>{favorites.includes(water.id)?'★':'☆'}</button><div className="fish-row">{water.fish.map(item=><span key={item}>{item} {'★'.repeat(water.rating[item]??0)}</span>)}</div></article>)}</div></aside>
          <div className="map-panel"><MapView waters={mapWaters} spots={visibleSpots} parkings={visibleParkings} selectedWater={focusedWater} onSelect={selectAndFocus}/><div className="map-note">{focusedWater ? <><strong>{selected.name}</strong><span>{visibleParkings.length} Parkplatz{visibleParkings.length === 1 ? "" : "plätze"} · {visibleSpots.length} Hotspot{visibleSpots.length === 1 ? "" : "s"}</span><button type="button" onClick={()=>setFocusedWaterId(null)}>Alle Gewässer zeigen</button></> : <>{selected.latitude === null || selected.longitude === null ? <span>Für dieses Gewässer ist noch keine geprüfte Kartenposition gespeichert.</span> : <span>{mappedCount} von {filtered.length} Treffern sind bereits kartiert. Gewässer anklicken, um Parkplätze und Hotspots zu öffnen.</span>}</>}</div></div>
          <aside className="details"><p className="eyebrow">Gewässerprofil</p><div className="water-stats">
  <div className="stat-card">
    <span>🐟</span>
    <strong>{selected.fish.length}</strong>
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
        ...selected.fish.map((f) => selected.rating[f] ?? 0),
        0
      )}
    </strong>
    <small>Top-Fisch</small>
  </div>
</div><h2>{selected.name}</h2><p>{selected.module} · {selected.type}{selected.lavNumber ? ` · ${selected.lavNumber}` : ""}</p><span className={`status ${selected.sourceStatus}`}>{selected.sourceStatus==='verified'?'Navigationsdaten vorhanden':selected.sourceStatus==='catalog'?'LAV-Katalog – Lage noch offen':'Arbeitsdaten – prüfen'}</span>{selected.areaHa && <p><strong>Fläche:</strong> {selected.areaHa} ha</p>}<h3>Zielfische</h3><div className="score-list">{selected.fish.length ? selected.fish.map(item=><div key={item}><span>{item}</span><strong>{'★'.repeat(selected.rating[item]??0)}</strong></div>) : <p>Keine deiner ausgewählten Zielfischarten im Basiskatalog erkannt.</p>}</div><h3>Hinweise</h3><ul>{selected.notes.map(note=><li key={note}>{note}</li>)}</ul>
          {selected.parkings.length > 0 && <><h3>Parkplätze / Ausgangspunkte</h3><div className="nav-list">{selected.parkings.map(p=><article key={p.id}><strong>{p.name}</strong><small>{p.access==='public'?'öffentlich':'Zufahrt eingeschränkt'} · {p.accuracy==='verified'?'belegt':'Näherungswert'}</small><div className="mini-actions"><a href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=driving`} target="_blank" rel="noreferrer">Google Auto</a><a href={`https://maps.apple.com/?daddr=${p.latitude},${p.longitude}&dirflg=d`} target="_blank" rel="noreferrer">Apple Auto</a></div></article>)}</div></>}
          {selected.spots.length > 0 && <><h3>Hotspots / Erkundungspunkte</h3><div className="nav-list">{selected.spots.map(spot=>{const parking=selected.parkings.find(p=>p.id===spot.parkingId);return <article key={spot.id}><strong>{spot.name}</strong><small>{spot.risk ?? spot.note ?? 'Zugang vor Ort prüfen.'}</small><div className="mini-actions"><a href={`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=walking`} target="_blank" rel="noreferrer">Zu Fuß ab Standort</a>{parking&&<a href={`https://www.google.com/maps/dir/?api=1&origin=${parking.latitude},${parking.longitude}&destination=${spot.latitude},${spot.longitude}&travelmode=walking`} target="_blank" rel="noreferrer">Zu Fuß ab Parkplatz</a>}</div></article>})}</div></>}
          <div className="button-row">{selected.latitude !== null && selected.longitude !== null && <a className="route-button" href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer">Zum Gewässer</a>}<button onClick={exportGpx} disabled={!visibleSpots.length}>GPX exportieren</button></div><label className="file-button">GPX importieren<input type="file" accept=".gpx,application/gpx+xml" onChange={importGpx}/></label></aside>
        </div>
      </section>}

      {view === "forecast" && <section className="page narrow"><div className="panel"><p className="eyebrow">Regelbasierte Prognose</p><h1>Wo lohnt es sich heute?</h1><p>Keine Wetter-API: Du trägst die beobachteten Bedingungen ein. Die Bewertung ist eine nachvollziehbare Heuristik, keine Fanggarantie.</p><div className="form-grid"><label>Zielfisch<select value={forecast.fish} onChange={(e)=>setForecast({...forecast,fish:e.target.value as Fish})}>{fishOptions.filter(x=>x!=="Alle").map(x=><option key={x}>{x}</option>)}</select></label><label>Uhrzeit<input type="number" min="0" max="23" value={forecast.hour} onChange={(e)=>setForecast({...forecast,hour:Number(e.target.value)})}/></label><label>Wind km/h<input type="number" min="0" max="100" value={forecast.windKmh} onChange={(e)=>setForecast({...forecast,windKmh:Number(e.target.value)})}/></label><label>Luftdrucktrend<select value={forecast.pressureTrend} onChange={(e)=>setForecast({...forecast,pressureTrend:e.target.value as ForecastInputs['pressureTrend']})}><option value="falling">fallend</option><option value="steady">gleichbleibend</option><option value="rising">steigend</option></select></label><label>Bewölkung %<input type="range" min="0" max="100" value={forecast.cloudCover} onChange={(e)=>setForecast({...forecast,cloudCover:Number(e.target.value)})}/><span>{forecast.cloudCover}%</span></label></div></div><div className="ranking">{ranked.map(({water,score})=><article key={water.id} onClick={()=>{setSelected(water);setView('waters')}}><div><strong>{water.name}</strong><p>{water.module} · {forecast.fish}</p></div><span>{score}/100</span></article>)}</div></section>}

      {view === "diary" && <section className="page diary"><form className="panel" onSubmit={addCatch}><p className="eyebrow">Lokales Fangbuch</p><h1>Fang eintragen</h1><div className="form-grid"><label>Datum und Uhrzeit<input name="caughtAt" type="datetime-local" required/></label><label>Gewässer<select name="waterId">{waters.map(w=><option value={w.id} key={w.id}>{w.name}</option>)}</select></label><label>Fisch<select name="fish">{fishOptions.filter(x=>x!=="Alle").map(x=><option key={x}>{x}</option>)}</select></label><label>Länge cm<input name="lengthCm" type="number" min="0" step="0.1"/></label><label>Gewicht kg<input name="weightKg" type="number" min="0" step="0.01"/></label><label>Köder<input name="lure" placeholder="z. B. 10 cm Gummifisch"/></label><label className="wide">Notiz<textarea name="note" rows={3}/></label></div><button type="submit">Fang speichern</button></form><div className="catch-list">{catches.map(entry=><article key={entry.id}><div><strong>{entry.fish}</strong><p>{waters.find(w=>w.id===entry.waterId)?.name ?? entry.waterId} · {new Date(entry.caughtAt).toLocaleString('de-DE')}</p><small>{entry.lure}{entry.note?` · ${entry.note}`:''}</small></div><span>{entry.lengthCm?`${entry.lengthCm} cm`:''}{entry.weightKg?` · ${entry.weightKg} kg`:''}</span></article>)}{!catches.length&&<p>Noch keine Fänge gespeichert.</p>}</div></section>}

      {view === "settings" && <section className="page narrow"><div className="panel"><p className="eyebrow">V5.2 Beta</p><h1>Offline & Daten</h1><h3>Installierbare Web-App</h3><p>Manifest und Service Worker sind vorbereitet. Nach einem Produktions-Deployment kann die App über den Browser zum Startbildschirm hinzugefügt werden.</p><h3>Lokale Speicherung</h3><p>Favoriten und Fangbuch liegen nur im Browser dieses Geräts. Es gibt noch kein Konto und keine Cloud-Synchronisierung.</p><h3>Amtliche Verlässlichkeit</h3><p>Die enthaltenen Gewässer sind technische Demonstrationsdaten. Vor dem Angeln gelten ausschließlich aktuelle Dokumente, Beschilderung und lokale Regeln.</p><button onClick={()=>{localStorage.clear();setFavorites([]);setCatches([]);setImportedSpots([])}}>Lokale App-Daten löschen</button></div></section>}

      <footer>HarzFishing Navigator V5.2 Beta · Keine amtliche Gewässerkarte und keine Fanggarantie.</footer>
    </main>
  );
}
