# Fangdaten-Collector V0.1

Experimentelle, vom Prognose-Score getrennte Datenebene.

## Grundsatz
Keine Webseiten-Scraper. Importiert werden nur manuell erfasste Daten, offiziell freigegebene APIs oder lizenzierte Exporte. Fremde Beitragstexte werden nicht benötigt; gespeichert werden nur strukturierte Fangereignisse und Quellenverweise.

## Pipeline
1. Fangereignis im Schema `data/catch-events.schema.json` erfassen/importieren.
2. Gewässer/LAV-Nummer und Koordinaten zuordnen.
3. Historisches Wetter ergänzen: `npm run catch:weather -- data/catch-events.json data/catch-events.enriched.json`
4. Erste Statistik: `npm run catch:analyze -- data/catch-events.enriched.json`
5. Erst nach ausreichender Stichprobe und Qualitätsprüfung Gewichtungen der Prognose kalibrieren.

## Qualitätsregeln
- exaktes Gewässer + Datum + Uhrzeit: hohe Verwertbarkeit
- nur Region/Tag: niedrige Verwertbarkeit
- Dubletten anhand Provider + externalId bzw. URL entfernen
- keine Fangwahrscheinlichkeit aus der Zahl geposteter Fänge ableiten (Reporting-Bias)
- Mond/Wetter werden nachträglich aus Zeit und Position berechnet

## Reddit
Nur nach offiziell genehmigtem API-/Developer-Zugang aktivieren. Kein HTML-Scraping.
