"use client";

import dynamic from "next/dynamic";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { waters } from "@/data/waters";
import { calculateFishingScore } from "@/lib/forecast";
import { parseGpx, spotsToGpx } from "@/lib/gpx";
import { loadCatches, loadFavorites, saveCatches, saveFavorites } from "@/lib/storage";
import type { CatchEntry, Fish, FishingSpot, FishingWater, ForecastInputs, WaterModule } from "@/lib/types";

const MapView = dynamic(() => import("./MapView"), { ssr: false });
const fishOptions: Array<Fish | "Alle"> = ["Alle", "Zander", "Barsch", "Forelle", "Schleie", "Hecht", "Karpfen"];
const moduleOptions: Array<WaterModule | "Alle"> = ["Alle", "Bodetalsperren", "LAV Sachsen-Anhalt", "Harzflüsse"];
type View = "dashboard" | "waters" | "forecast" | "diary" | "settings";

export default function FishingNavigator() {
  const [view, setView] = useState<View>("dashboard");
  const [fish, setFish] = useState<Fish | "Alle">("Alle");
  const [module, setModule] = useState<WaterModule | "Alle">("Alle");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FishingWater>(waters[0]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [catches, setCatches] = useState<CatchEntry[]>([]);
  const [importedSpots, setImportedSpots] = useState<FishingSpot[]>([]);
  const [forecast, setForecast] = useState<ForecastInputs>({ fish: "Zander", hour: 21, windKmh: 12, pressureTrend: "falling", cloudCover: 70 });

  useEffect(() => { setFavorites(loadFavorites()); setCatches(loadCatches()); }, []);

  const filtered = useMemo(() => waters
    .filter((water) => module === "Alle" || water.module === module)
    .filter((water) => fish === "Alle" || water.fish.includes(fish))
    .filter((water) => `${water.name} ${water.district} ${water.module}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => fish === "Alle" ? a.name.localeCompare(b.name, "de") : (b.rating[fish] ?? 0) - (a.rating[fish] ?? 0)), [fish, module, query]);

  const ranked = useMemo(() => waters.map((water) => ({ water, score: calculateFishingScore(water, forecast) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score), [forecast]);
  const visibleSpots = [...selected.spots, ...importedSpots];

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

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => setView("dashboard")}><span>🎣</span><div><strong>HarzFishing</strong><small>Navigator V3.5</small></div></button>
        <nav>{([['dashboard','Dashboard'],['waters','Gewässer'],['forecast','Prognose'],['diary','Fangbuch'],['settings','Einstellungen']] as [View,string][]).map(([id,label]) => <button key={id} className={view===id?'active':''} onClick={()=>setView(id)}>{label}</button>)}</nav>
      </header>

      {view === "dashboard" && <section className="page dashboard">
        <div className="hero-card"><p className="eyebrow">HarzFishing Navigator</p><h1>Dein Angelrevier auf einer Karte.</h1><p>Bodetalsperren, LAV-Gewässer, Harzflüsse, Fangbuch, GPX und eine transparente, regelbasierte Angelprognose.</p><button onClick={()=>setView("waters")}>Gewässer entdecken</button></div>
        <div className="dashboard-grid">
          <article><span>🗺️</span><strong>{waters.length}</strong><p>vorbereitete Gewässerprofile</p></article>
          <article><span>⭐</span><strong>{favorites.length}</strong><p>gespeicherte Favoriten</p></article>
          <article><span>🐟</span><strong>{catches.length}</strong><p>Fänge im lokalen Fangbuch</p></article>
          <article><span>📍</span><strong>{importedSpots.length}</strong><p>importierte GPX-Punkte</p></article>
        </div>
        <div className="panel"><h2>Aktuelle Empfehlung aus deinen Eingaben</h2>{ranked[0] ? <div className="recommendation"><strong>{ranked[0].water.name}</strong><span>{ranked[0].score}/100</span><p>Für {forecast.fish}, basierend auf Uhrzeit, Wind, Bewölkung und Luftdrucktrend.</p></div> : <p>Keine passende Empfehlung.</p>}</div>
      </section>}

      {view === "waters" && <section className="page">
        <div className="toolbar"><input type="search" placeholder="Gewässer suchen …" value={query} onChange={(e)=>setQuery(e.target.value)} /><select value={module} onChange={(e)=>setModule(e.target.value as WaterModule|"Alle")}>{moduleOptions.map(x=><option key={x}>{x}</option>)}</select><div className="chips">{fishOptions.map((option)=><button key={option} className={fish===option?'active':''} onClick={()=>setFish(option)}>{option}</button>)}</div></div>
        <div className="workspace"><aside className="sidebar"><div className="sidebar-heading"><strong>{filtered.length} Gewässer</strong><span>Demo-/Prüfdaten</span></div><div className="water-list">{filtered.map((water)=><article key={water.id} className={`water-card ${selected.id===water.id?'selected':''}`} onClick={()=>setSelected(water)}><div><h2>{water.name}</h2><p>{water.module} · {water.type}</p></div><button className="favorite" onClick={(e)=>{e.stopPropagation();toggleFavorite(water.id)}}>{favorites.includes(water.id)?'★':'☆'}</button><div className="fish-row">{water.fish.map(item=><span key={item}>{item} {'★'.repeat(water.rating[item]??0)}</span>)}</div></article>)}</div></aside>
          <div className="map-panel"><MapView waters={filtered} spots={visibleSpots} onSelect={setSelected}/></div>
          <aside className="details"><p className="eyebrow">Gewässerprofil</p><h2>{selected.name}</h2><p>{selected.module} · {selected.type}</p><span className={`status ${selected.sourceStatus}`}>{selected.sourceStatus==='verified'?'Verifiziert':'Demodaten – prüfen'}</span><h3>Zielfische</h3><div className="score-list">{selected.fish.map(item=><div key={item}><span>{item}</span><strong>{'★'.repeat(selected.rating[item]??0)}</strong></div>)}</div><h3>Hinweise</h3><ul>{selected.notes.map(note=><li key={note}>{note}</li>)}</ul><div className="button-row"><a className="route-button" href={`https://www.openstreetmap.org/directions?to=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer">Route öffnen</a><button onClick={exportGpx} disabled={!visibleSpots.length}>GPX exportieren</button></div><label className="file-button">GPX importieren<input type="file" accept=".gpx,application/gpx+xml" onChange={importGpx}/></label></aside>
        </div>
      </section>}

      {view === "forecast" && <section className="page narrow"><div className="panel"><p className="eyebrow">Regelbasierte Prognose</p><h1>Wo lohnt es sich heute?</h1><p>Keine Wetter-API: Du trägst die beobachteten Bedingungen ein. Die Bewertung ist eine nachvollziehbare Heuristik, keine Fanggarantie.</p><div className="form-grid"><label>Zielfisch<select value={forecast.fish} onChange={(e)=>setForecast({...forecast,fish:e.target.value as Fish})}>{fishOptions.filter(x=>x!=="Alle").map(x=><option key={x}>{x}</option>)}</select></label><label>Uhrzeit<input type="number" min="0" max="23" value={forecast.hour} onChange={(e)=>setForecast({...forecast,hour:Number(e.target.value)})}/></label><label>Wind km/h<input type="number" min="0" max="100" value={forecast.windKmh} onChange={(e)=>setForecast({...forecast,windKmh:Number(e.target.value)})}/></label><label>Luftdrucktrend<select value={forecast.pressureTrend} onChange={(e)=>setForecast({...forecast,pressureTrend:e.target.value as ForecastInputs['pressureTrend']})}><option value="falling">fallend</option><option value="steady">gleichbleibend</option><option value="rising">steigend</option></select></label><label>Bewölkung %<input type="range" min="0" max="100" value={forecast.cloudCover} onChange={(e)=>setForecast({...forecast,cloudCover:Number(e.target.value)})}/><span>{forecast.cloudCover}%</span></label></div></div><div className="ranking">{ranked.map(({water,score})=><article key={water.id} onClick={()=>{setSelected(water);setView('waters')}}><div><strong>{water.name}</strong><p>{water.module} · {forecast.fish}</p></div><span>{score}/100</span></article>)}</div></section>}

      {view === "diary" && <section className="page diary"><form className="panel" onSubmit={addCatch}><p className="eyebrow">Lokales Fangbuch</p><h1>Fang eintragen</h1><div className="form-grid"><label>Datum und Uhrzeit<input name="caughtAt" type="datetime-local" required/></label><label>Gewässer<select name="waterId">{waters.map(w=><option value={w.id} key={w.id}>{w.name}</option>)}</select></label><label>Fisch<select name="fish">{fishOptions.filter(x=>x!=="Alle").map(x=><option key={x}>{x}</option>)}</select></label><label>Länge cm<input name="lengthCm" type="number" min="0" step="0.1"/></label><label>Gewicht kg<input name="weightKg" type="number" min="0" step="0.01"/></label><label>Köder<input name="lure" placeholder="z. B. 10 cm Gummifisch"/></label><label className="wide">Notiz<textarea name="note" rows={3}/></label></div><button type="submit">Fang speichern</button></form><div className="catch-list">{catches.map(entry=><article key={entry.id}><div><strong>{entry.fish}</strong><p>{waters.find(w=>w.id===entry.waterId)?.name ?? entry.waterId} · {new Date(entry.caughtAt).toLocaleString('de-DE')}</p><small>{entry.lure}{entry.note?` · ${entry.note}`:''}</small></div><span>{entry.lengthCm?`${entry.lengthCm} cm`:''}{entry.weightKg?` · ${entry.weightKg} kg`:''}</span></article>)}{!catches.length&&<p>Noch keine Fänge gespeichert.</p>}</div></section>}

      {view === "settings" && <section className="page narrow"><div className="panel"><p className="eyebrow">V3.5</p><h1>Offline & Daten</h1><h3>Installierbare Web-App</h3><p>Manifest und Service Worker sind vorbereitet. Nach einem Produktions-Deployment kann die App über den Browser zum Startbildschirm hinzugefügt werden.</p><h3>Lokale Speicherung</h3><p>Favoriten und Fangbuch liegen nur im Browser dieses Geräts. Es gibt noch kein Konto und keine Cloud-Synchronisierung.</p><h3>Amtliche Verlässlichkeit</h3><p>Die enthaltenen Gewässer sind technische Demonstrationsdaten. Vor dem Angeln gelten ausschließlich aktuelle Dokumente, Beschilderung und lokale Regeln.</p><button onClick={()=>{localStorage.clear();setFavorites([]);setCatches([]);setImportedSpots([])}}>Lokale App-Daten löschen</button></div></section>}

      <footer>HarzFishing Navigator V3.5 · Keine amtliche Gewässerkarte und keine Fanggarantie.</footer>
    </main>
  );
}
