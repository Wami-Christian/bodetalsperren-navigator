HarzFishing Navigator – Elbe/LAV Integration

Geänderte Dateien:
- app/globals.css
- components/FishingNavigator.tsx
- components/MapView.tsx
- data/elbe-segments.ts (neu)
- data/waters.ts
- lib/types.ts

Funktionen:
- Atlas-Schalter „🌊 Elbe-LAV-Strecken“
- Elbeabschnitte als farbige Linien statt Gewässermarker
  grün = beidseitig, blau = linksseitig, orange = rechtsseitig
- Gewässerprofil zeigt Elb-km, Uferseite und Einschränkungen
- Schleuse Niegripp als Orientierungspunkt (kein Angelplatz)
- bestehende LAV-Katalogeinträge werden erweitert, keine Duplikate

Hinweis:
Die Flusskilometer/Uferangaben basieren auf dem LAV-Gewässerverzeichnis 2022–2026.
Die Liniengeometrie ist aktuell eine orientierende Nachzeichnung entlang der Elbe; rechtlich maßgeblich
sind immer Fluss-km, Uferseite, aktuelle LAV-Ergänzungen und Beschilderung vor Ort.

Prüfung: TypeScript tsc --noEmit erfolgreich.

UPDATE OSM-GEOMETRIE
- Elbe-LAV-Linien werden im Atlas aus der aktuellen OpenStreetMap-Elbe-Geometrie geladen.
- Quelle: WaterwayMap GeoJSON auf Basis von OpenStreetMap.
- Die lokalen Elbe-Koordinaten bleiben als Offline-/Dienst-Fallback erhalten.
- Die OSM-Linie wird automatisch anhand der hinterlegten LAV-Abschnitts-Endpunkte zugeschnitten.
- Rechtlich maßgeblich bleiben Fluss-km, Uferseite und aktuelle LAV-Bestimmungen.

Update 05.09.2026 – Elbe-Geometrie V2
------------------------------------
- Alle Elbe-LAV-Abschnitte verwenden die zusammengesetzte OSM-Flussgeometrie.
- Fragmentierte OSM-LineStrings werden über einen Graphen zu einem echten Flussweg verbunden.
- Keine groben Ersatz-Geraden mehr: bei fehlender/unklarer OSM-Geometrie erscheint nur ein Abschnittsmarker.
- Linienbreite reduziert: normal 4 px, ausgewählt 6 px; OSM-Wasserfläche und Uferdetails bleiben sichtbar.
- Gilt für sämtliche eingebauten Elbe-Datensätze, nicht nur Magdeburg/Niegripp.

Update 05.09.2026 – Elbe-Geometrie V3
- Browser lädt die OSM-Elbe nicht mehr direkt vom Fremdserver.
- Neue same-origin Next.js-Route /api/elbe-geometry dient als Proxy und Cache.
- Verhindert CORS-/Browserblockaden, durch die in V2 nur Abschnittsmarker sichtbar waren.
- Gilt für alle Elbe-LAV-Strecken.

V5 – OSM-Segmentverarbeitung
- OSM/Overpass-Datenquelle unverändert.
- Einzelne Elbe-Ways werden je LAV-Abschnitt in einem lokalen Korridor gefiltert.
- Kleine Lücken zwischen benachbarten Way-Endpunkten bis 300 m werden graphbasiert verbunden.
- Die alte Orientierungsroute wird nie gezeichnet, sondern ausschließlich als Suchkorridor verwendet.
- Plausibilitätsprüfungen verhindern Schleifen und Land-Abkürzungen.
