## V1.9.3 – Fangdaten lokal + 20-km-Evidenz

Die Prognose trennt dokumentierte Einzelfänge bei ähnlichen Wetterbedingungen in Treffer am konkreten Gewässer und weitere Treffer im 20-km-Umkreis. Aggregierte Klasse-E-Communitydaten bleiben nur Kontext und werden nicht als bedingungsbezogene Einzelfänge gezählt. Der 0–100-Score bleibt unverändert.

# HarzFishing – ATKIS Hydro Importer

Erweitert den vorhandenen LAV-Katalog um amtliche Gewässerpositionen aus dem INSPIRE-WFS Sachsen-Anhalt. Das Update bevorzugt amtliche ATKIS-Treffer und verwendet vorhandene Nominatim-Treffer nur als Ersatz.

Siehe `ATKIS_IMPORT.md`.

## Fangdaten V1.7 – Qualitätsklassen und Fangaktivität

Zusätzliche Laborbefehle:

- `npm run catch:quality` klassifiziert Fangereignisse in A–E.
  - A: Gewässer + Datum + exakte/stündliche Zeit
  - B: Gewässer + Datum + Tagesphase
  - C: Gewässer + Datum
  - D: Gewässer + Monat/Jahr
  - E: nur aggregierte/allgemeine Fangaktivität
- `npm run catch:activity` importiert aggregierte Fangaktivität aus `data/catch-activity-import.csv` und matcht sie streng auf den LAV-Katalog.

Wichtig: Aktivitätsdaten der Klasse E verändern den Prognose-Score noch nicht. Sie sind eine getrennte Evidenzschicht. Nur Daten verwenden, die rechtmäßig manuell, über eine offizielle API oder per lizenzierter Quelle bezogen wurden.

## V1.10 – Finaler Fangdaten-Stand

Die Fangdaten-Integration der Prognose ist abgeschlossen. Wetter/Astronomie bleiben der eigentliche 0–100-Score; dokumentierte Einzelfänge und aggregierte Fangaktivität werden als getrennte Evidenz pro Gewässer sowie im 20-km-Umkreis dargestellt. Details stehen in `PROGNOSE_V1_10_FINAL.md`.
