# Prognose V1.10 – Finaler Fangdaten-Stand

Dieser Stand schließt die Fangdaten-Erweiterung der Prognose ab.

## Sichtbare Prognosefaktoren

Der 0–100-Prognosewert basiert weiterhin auf den Wetter-/Astronomie- und artspezifischen Regeln. Sichtbar bleiben Tageszeit, Bewölkung, Wind, Temperatur, Luftdruck/Trend und Mondphase.

## Fangdaten als getrennte Evidenz

Für jeden Prognosekandidaten werden zwei getrennte Fangdatenebenen angezeigt:

1. **Ähnliche dokumentierte Fänge** – Treffer im konkreten Gewässer und im 20-km-Umkreis, soweit verwertbare Einzelfänge mit historischen Bedingungen vorliegen.
2. **Dokumentierte Fangaktivität** – aggregierte Community-Evidenz für das konkrete Gewässer und die Zahl passender Aktivitätsgewässer im 20-km-Umkreis.

Aggregierte Aktivitätsdaten verändern den 0–100-Score nicht. Nur ausreichend hochwertige Einzelfänge (Qualitätsklassen A–C) sind für spätere Wetterkorrelationen vorgesehen.

## Diagnose

Das Info-Symbol hinter der dokumentierten Fangaktivität öffnet pro Kandidat die im 20-km-Radius gefundenen Aktivitätsgewässer mit Name, LAV-Nummer, Entfernung, Aktivitätsstufe und Quelle. Die Diagnose bleibt bewusst kompakt und verändert keine Bewertung.

## Datenqualität

- A: Gewässer + Datum + exakte/stündliche Zeit
- B: Gewässer + Datum + Tagesphase
- C: Gewässer + Datum
- D: Gewässer + Monat/Jahr
- E: aggregierte/allgemeine Fangaktivität

Nur rechtmäßig bezogene, manuell kuratierte, offiziell per API bereitgestellte oder lizenzierte Daten verwenden.

## Abschlussentscheidung

Die Prognose trennt fachlich bewusst:

- **Prognose = Bedingungen**
- **Fangdaten = Evidenz**

Damit ist die Fangdaten-Integration für diesen Stand abgeschlossen. Eine spätere Kalibrierung des Scores soll erst erfolgen, wenn genügend hochwertige A–C-Einzelfänge vorliegen.
