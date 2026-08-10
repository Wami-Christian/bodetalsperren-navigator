# LAV-Gewässerkoordinaten ergänzen

Dieses Update ergänzt eine **lokale, wiederaufnehmbare Geokodierung** für die LAV-Gewässer. Die App übernimmt ausschließlich automatisch als ausreichend sicher bewertete Treffer. Unsichere Treffer landen in einer Prüfliste.

## Einmalig testen

Öffne im Projektordner die Eingabeaufforderung und starte zunächst zehn Einträge:

```cmd
npm run enrich:coordinates:test -- --email=DEINE-EMAIL-ADRESSE
```

Danach entstehen beziehungsweise ändern sich:

- `data/geocoding-cache.json` – Cache, damit keine Anfrage doppelt gestellt wird
- `data/lav-coordinates.generated.ts` – von der App verwendete Koordinaten
- `data/lav-coordinate-review.csv` – unsichere oder nicht gefundene Treffer

Anschließend testen:

```cmd
npm run build
```

## Gesamten Katalog verarbeiten

```cmd
npm run enrich:coordinates -- --email=DEINE-EMAIL-ADRESSE
```

Die Abfragen laufen absichtlich nur einzeln und mit Pause. Für rund 1.100 Gewässer dauert ein kompletter Lauf mindestens etwa 25 Minuten, bei mehreren Suchvarianten auch deutlich länger. Der Vorgang kann mit `Strg+C` gestoppt und später fortgesetzt werden; der Cache bleibt erhalten.

Teilweise verarbeiten:

```cmd
npm run enrich:coordinates -- --email=DEINE-EMAIL-ADRESSE --limit=100
```

Weitere Blöcke:

```cmd
npm run enrich:coordinates -- --email=DEINE-EMAIL-ADRESSE --start=100 --limit=100
```

## Qualitätsregeln

- Nur Treffer mit hoher Namens-, Landkreis- und Gewässertyp-Übereinstimmung werden automatisch in der Karte verwendet.
- Unsichere Treffer erscheinen in `data/lav-coordinate-review.csv`.
- Die Koordinaten sind Navigationshilfen, keine amtliche Festlegung von Angelbereichen, Zugängen oder Parkrechten.
- Parkplätze werden in diesem Schritt bewusst **nicht automatisch erfunden**. Sie folgen in einer getrennten, überprüfbaren Datenstufe.

## Nach erfolgreichem Lauf

In GitHub Desktop sollten die erzeugten Daten als Änderungen erscheinen. Commit-Vorschlag:

```text
Add matched LAV water coordinates
```

Danach `Push origin`; Vercel veröffentlicht die neuen Kartenpunkte automatisch.
