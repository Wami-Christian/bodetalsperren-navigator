HarzFishing Generator V2 – SECTION SAFE

Auswertung:
LOCKED: 56
AUTO_WHOLE_FEATURE: 85
REVIEW_BOUNDARY: 40
UNMATCHED: 2

Neue Sicherheitsregel:
- Keine automatisch geschätzten +/-0,025° Routen mehr.
- Enthält der offizielle Abschnitt Wörter wie von/bis/km/Brücke/Wehr/Grenze,
  wird er NICHT automatisch freigegeben.
- Gewässer ohne explizite Teilstreckengrenze dürfen als vollständiges,
  exakt gematchtes OSM-Feature übernommen werden.
- Polygon/MultiPolygon ist gleichberechtigt zu LineString/MultiLineString.
- Bereits bestätigte LAV-Abschnitte bleiben LOCKED.

Damit verhindert der Generator künftig genau die zu weit reichende Kennzeichnung,
die wir bei der Baggerelbe als Risiko erkannt haben.
