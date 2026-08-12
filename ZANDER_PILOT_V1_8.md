# Zander-Pilot V1.8

Kuratiertes Pilotset für öffentliche Fangaktivität in Sachsen-Anhalt.

Die Einträge sind bewusst **Qualitätsklasse E**: Sie belegen Fangaktivität bzw. das Vorkommen von Zander im jeweiligen Gewässerbereich, enthalten aber keine ausreichend präzisen Einzel-Fangzeitpunkte für Wetterkorrelationen.

Wichtig:
- `totalReports` ist die Gesamtzahl der auf der Quellseite gemeldeten Fänge, nicht die Zahl der Zanderfänge.
- `speciesRank=1` wird nur gesetzt, wenn Zander auf der Quellseite als häufigste gemeldete Fischart genannt wird.
- Das Mapping auf LAV-Abschnitte ist kuratiert und bleibt getrennt vom Wetter-Score.
- Keine Texte, Bilder oder personenbezogenen Profildaten der Plattform werden übernommen.

Test:

    npm install
    npm run catch:pilot

Erwartung: 7 Aktivitätsdatensätze, 7 LAV-Matches, 0 Review.
