# HarzFishing Navigator V3.5

Umbau des Bodetalsperren-Navigators zu einer modularen Angel-Web-App.

## Funktionen

- Module für Bodetalsperren, LAV Sachsen-Anhalt und Harzflüsse
- Leaflet-Karte mit Gewässern und Spot-Markern
- Filter nach Modul, Zielfisch und Suchtext
- Favoriten im Local Storage
- lokales Fangbuch
- transparente regelbasierte Angelprognose
- GPX-Import und GPX-Export
- PWA-Manifest und einfacher Service Worker
- responsive Oberfläche

## Start

```bash
npm install
npm run dev
```

Dann `http://localhost:3000` öffnen.

## Bestehendes GitHub-Projekt aktualisieren

Am sichersten in einem Branch:

```bash
git checkout -b feature/harzfishing-v3.5
# Dateien dieses Projekts in das vorhandene Repository übernehmen
git add .
git commit -m "Upgrade to HarzFishing Navigator V3.5"
git push -u origin feature/harzfishing-v3.5
```

## Wichtig zu den Gewässerdaten

`data/waters.ts` enthält technische Demodaten. Koordinaten, LAV-Nummern, Grenzen,
Fischbestände, Zugänge, Schonstrecken und Sonderbestimmungen müssen vor einer
Veröffentlichung anhand aktueller offizieller Quellen verifiziert werden.

## Nächste technische Ausbaustufen

- amtliche Datenimport-Pipeline mit Prüfstatus
- echte Wetter- und Pegel-Schnittstellen über serverseitige API-Routen
- Nutzerkonten und Cloud-Synchronisierung
- Kartenpakete für echten Offlinebetrieb; OpenStreetMap-Kacheln dürfen nicht
  ungeprüft massenhaft offline gespeichert werden
- Fotos im Fangbuch über Object Storage
