# HarzFishing Navigator V5.2.1 Beta

Next.js-Anwendung für Bodetalsperren, LAV-Gewässer, Harzflüsse, Parkplätze, Hotspots, Fangbuch, GPX und eine nachvollziehbare Angelprognose.

## Enthalten

- Kartenansicht mit Leaflet und OpenStreetMap
- Auto-Navigation zu Parkplätzen über Google Maps und Apple Karten
- Fußnavigation zum Hotspot sowie vom zugeordneten Parkplatz
- LAV-Basiskatalog mit mehr als 1.100 Einträgen
- Suche, Modul- und Zielfischfilter
- Favoriten und lokales Fangbuch
- GPX-Import und -Export
- regelbasierte Prognose nach Zielfisch, Uhrzeit, Wind, Bewölkung und Luftdrucktrend
- PWA-Manifest, Icons und Service Worker

## Lokal starten

```bash
npm install
npm run dev
```

Danach `http://localhost:3000` öffnen.

## Produktionsprüfung

```bash
npm run build
```

## Datenhinweis

Katalog- und Demodaten ersetzen keine aktuellen amtlichen Unterlagen. Gewässergrenzen, Zugänge, Schonzeiten, Sperrungen und Sonderbestimmungen müssen vor Ort sowie in den aktuellen LAV-Dokumenten geprüft werden.
