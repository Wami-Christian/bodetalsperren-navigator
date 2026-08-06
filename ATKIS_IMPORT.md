# Amtliche Gewässerdaten importieren

Dieses Update verwendet den kostenfrei online abrufbaren **INSPIRE-WFS ST Hydro – Physische Gewässer ATKIS Basis-DLM**.

Quellenvermerk: **© GeoBasis-DE / LVermGeo ST, Datenlizenz Deutschland – Namensnennung – 2.0**

## Dateien kopieren

Den Inhalt dieses ZIP direkt in das Projekt `bodetalsperren-navigator` kopieren und Überschreiben bestätigen.

## Kleiner Testlauf

Im Projektordner `cmd` öffnen:

```cmd
npm install
npm run import:atkis:test -- --email=DEINE-EMAIL
npm run build
```

Der erste Lauf lädt die amtlichen Gewässerobjekte und legt sie lokal in `data/atkis-hydro-cache.json` ab. Je nach Server und Datenmenge kann das einige Minuten dauern.

## Vollständiger Abgleich

```cmd
npm run import:atkis -- --email=DEINE-EMAIL
npm run build
```

Ergebnisse:

- `data/atkis-water-matches.generated.ts`: sichere Treffer, von der App automatisch verwendet
- `data/atkis-water-review.csv`: unsichere Treffer zur manuellen Prüfung
- `data/atkis-hydro-cache.json`: lokaler Cache der amtlichen Geometrien
- `data/locality-cache.json`: Ortsanker für interne LAV-Bezeichnungen

## Neu laden

Nur wenn der amtliche Datensatz neu abgerufen werden soll:

```cmd
npm run import:atkis -- --email=DEINE-EMAIL --refresh
```

## Sicherheitsprinzip

Ein Treffer wird nur automatisch kartiert, wenn Namensübereinstimmung oder die Kombination aus Ortsnähe, Gewässertyp und Fläche eindeutig genug ist. Unsichere Ergebnisse werden nicht automatisch veröffentlicht.
