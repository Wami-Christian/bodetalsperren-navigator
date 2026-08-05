"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { waters } from "@/data/waters";
import type { Fish, FishingWater } from "@/lib/types";

const MapView = dynamic(() => import("./MapView"), { ssr: false });
const fishOptions: Array<Fish | "Alle"> = ["Alle", "Zander", "Barsch", "Forelle", "Schleie"];

export default function FishingNavigator() {
  const [fish, setFish] = useState<Fish | "Alle">("Alle");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FishingWater | null>(waters[0]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("harz-fishing-favorites");
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  const filtered = useMemo(() => {
    return waters
      .filter((water) => fish === "Alle" || water.fish.includes(fish))
      .filter((water) => water.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        if (fish === "Alle") return a.name.localeCompare(b.name, "de");
        return (b.rating[fish] ?? 0) - (a.rating[fish] ?? 0);
      });
  }, [fish, query]);

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("harz-fishing-favorites", JSON.stringify(next));
  }

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">Bodetalsperrennavigator · Erweiterung</p>
          <h1>HarzFishing Navigator</h1>
          <p>Persönliche Gewässerwahl für Zander, Barsch, Forelle und Schleie.</p>
        </div>
        <span className="badge">MVP · Demodaten</span>
      </header>

      <section className="toolbar" aria-label="Gewässerfilter">
        <input
          type="search"
          placeholder="Gewässer suchen …"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Gewässer suchen"
        />
        <div className="chips">
          {fishOptions.map((option) => (
            <button
              key={option}
              className={fish === option ? "active" : ""}
              onClick={() => setFish(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      <section className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <strong>{filtered.length} Gewässer</strong>
            <span>nach Eignung sortiert</span>
          </div>
          <div className="water-list">
            {filtered.map((water) => (
              <article
                key={water.id}
                className={`water-card ${selected?.id === water.id ? "selected" : ""}`}
                onClick={() => setSelected(water)}
              >
                <div>
                  <h2>{water.name}</h2>
                  <p>{water.type} · Landkreis {water.district}</p>
                </div>
                <button
                  className="favorite"
                  onClick={(event) => { event.stopPropagation(); toggleFavorite(water.id); }}
                  aria-label={`${water.name} als Favorit markieren`}
                >
                  {favorites.includes(water.id) ? "★" : "☆"}
                </button>
                <div className="fish-row">
                  {water.fish.map((item) => (
                    <span key={item}>{item} {"★".repeat(water.rating[item] ?? 0)}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </aside>

        <div className="map-panel">
          <MapView waters={filtered} onSelect={setSelected} />
        </div>

        <aside className="details">
          {selected ? (
            <>
              <p className="eyebrow">Gewässerprofil</p>
              <h2>{selected.name}</h2>
              <p>{selected.type} · Landkreis {selected.district}</p>
              <h3>Zielfische</h3>
              <div className="score-list">
                {selected.fish.map((item) => (
                  <div key={item}><span>{item}</span><strong>{"★".repeat(selected.rating[item] ?? 0)}</strong></div>
                ))}
              </div>
              <h3>Hinweise</h3>
              <ul>{selected.notes.map((note) => <li key={note}>{note}</li>)}</ul>
              <a
                className="route-button"
                href={`https://www.openstreetmap.org/directions?to=${selected.latitude},${selected.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                Route öffnen
              </a>
            </>
          ) : <p>Wähle ein Gewässer aus.</p>}
        </aside>
      </section>

      <footer>
        Keine amtliche Gewässerkarte. Vor dem Angeln immer Angelatlas, Gewässerverzeichnis,
        aktuelle Ergänzungen, Beschilderung und lokale Bestimmungen prüfen.
      </footer>
    </main>
  );
}
