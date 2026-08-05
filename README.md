# HarzFishing Navigator V3.6 – LAV-Katalog & Navigation

Dieses Update verbindet die neue Next.js-Oberfläche mit den Navigationsfunktionen des früheren **Bodetalsperren Navigator V3.1**.

## Neu in V3.6

- Auto-Navigation zu Parkplätzen/Ausgangspunkten mit Google Maps und Apple Karten
- Fußnavigation vom aktuellen Standort zu Erkundungspunkten
- Fußnavigation vom zugeordneten Parkplatz zum Erkundungspunkt
- Parkplatz- und Hotspotmarker auf der Karte
- 12 Ausgangspunkte und 9 Erkundungspunkte aus der Vorversion übernommen
- durchsuchbarer LAV-Basiskatalog mit **1.138 Einträgen** aus dem Gewässerverzeichnis 2022–2026
- Suche nach Gewässername, Kreis und Gewässernummer
- Zielfischfilter für Zander, Barsch, Forelle, Schleie, Hecht und Karpfen

## Wichtige Datenabgrenzung

Der LAV-Katalog wurde technisch aus der offiziellen Druckausgabe 2022–2026 extrahiert. Das Verzeichnis ist Änderungen und jährlichen Ergänzungen unterworfen. Vor dem Angeln gelten ausschließlich der aktuelle Angelatlas, aktuelle Ergänzungen, Beschilderungen, Schutzgebietsregeln und örtliche Bestimmungen.

Die meisten Katalogeinträge besitzen zunächst **keine Kartenkoordinate**. Sie sind dennoch vollständig suchbar. Kartenpunkte, Parkplätze und Hotspots werden schrittweise ergänzt und müssen vor Veröffentlichung geprüft werden.

## Bestehendes GitHub-/Vercel-Projekt aktualisieren

Den Inhalt dieses Ordners in das Repository kopieren und vorhandene Dateien ersetzen. Danach:

```bash
npm install
npm run build
git add .
git commit -m "Restore parking navigation and add LAV water catalog"
git push
```

Vercel startet nach dem Push automatisch ein neues Deployment.

## Hauptdateien

- `data/lav-catalog.ts` – extrahierter LAV-Basiskatalog
- `data/waters.ts` – kartierte Gewässer, Parkplätze und Erkundungspunkte
- `components/FishingNavigator.tsx` – Suche, Profile und Navigation
- `components/MapView.tsx` – Gewässer-, Parkplatz- und Hotspotmarker

## Entwicklung

```bash
npm install
npm run dev
```
