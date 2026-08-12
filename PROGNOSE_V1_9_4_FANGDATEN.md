# Prognose V1.9.4 – kompakte Fangdaten-Evidenz

Für jede Prognose-Kachel werden zwei getrennte Evidenzarten berechnet und kompakt angezeigt:

1. **Ähnliche Fänge**: Einzelfänge derselben Fischart mit verwertbaren historischen Wetterdaten. Vergleichsfenster: Temperatur ±4 °C, Luftdruck ±8 hPa, Wind ±8 km/h, Bewölkung ±30 %. Ausgabe getrennt für das konkrete Gewässer und den 20-km-Umkreis dieses Gewässers.
2. **Dokumentierte Fangaktivität**: aggregierte Community-Aktivität aus `data/catch-activity.ts`. Direkte Aktivität wird über die LAV-Nummer zugeordnet; die Umkreiszahl zählt andere Aktivitäts-Gewässer derselben Fischart innerhalb von 20 km der jeweiligen Kandidatenposition.

Beide Ebenen bleiben vom 0–100-Prognosescore getrennt. Die Berechnung erfolgt für **jede Kandidaten-Kachel individuell**.
