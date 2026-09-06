import type { FishingWater } from "@/lib/types";

type WaterwayOverlay = Pick<FishingWater,
  "route" | "bankSide" | "riverKm" | "restrictions" | "waterwayName" | "sectionLabel" | "salmonid" | "salmonidRoute"
> & { latitude: number; longitude: number };

// Phase 1 der permanenten LAV-Fließgewässer-Layer.
// Grundlage: LAV-Gewässerverzeichnis 2022–2026. Die Route ist nur Suchkorridor
// zur Zuordnung der echten OSM-Wasserlinie; sie wird niemals selbst gezeichnet.
export const waterwayOverlayByLavNumber: Record<string, WaterwayOverlay> = {
// SELKE – durchgehende LAV-Darstellung nach dem Elbe/Saale-Schema
// Violett nur: Ackeburgbrücke – Kreisgrenze Salzlandkreis bei Gatersleben.
// Danach: 5-340-13 Kreisgrenze – Mündung in die Bode bei Rodersdorf.
"5-340-13": {
  waterwayName:"Selke",
  latitude:51.7900,
  longitude:11.2900,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Ackeburgbrücke – Gatersleben (Salmonidenstrecke); anschließend Kreisgrenze Salzlandkreis – Mündung in die Bode",
  restrictions:[
    "Violette Zusatzmarkierung nur auf der Salmonidenstrecke Ackeburgbrücke bis Kreisgrenze Salzlandkreis bei Gatersleben.",
    "Unterhalb der Kreisgrenze gilt LAV 5-340-13 bis zur Selkemündung bei Rodersdorf.",
    "Aktuelle LAV-Ergänzungen und örtliche Beschilderung beachten."
  ],
  // Gesamter darzustellender LAV-Verlauf – nur Suchkorridor; gezeichnet wird echte OSM-Geometrie.
  route:[
    [51.6835,11.2540],  // Ackeburgbrücke
    [51.7040,11.2820],
    [51.7103,11.2942],  // Meisdorf
    [51.7280,11.3210],
    [51.7350,11.3330],  // Ermsleben
    [51.7490,11.3470],  // Reinstedt
    [51.7670,11.3360],
    [51.7820,11.3120],  // Hoym
    [51.8050,11.2970],
    [51.8231,11.2870],  // Gatersleben / Kreisgrenze-Bereich
    [51.8400,11.2710],
    [51.8540,11.2520],
    [51.8660,11.2380],
    [51.87303,11.22911] // Selkemündung in die Bode
  ],
  salmonidRoute:[
    [51.6835,11.2540],
    [51.7040,11.2820],
    [51.7103,11.2942],
    [51.7280,11.3210],
    [51.7350,11.3330],
    [51.7490,11.3470],
    [51.7670,11.3360],
    [51.7820,11.3120],
    [51.8050,11.2970],
    [51.8231,11.2870]
  ]
},

  // SAALE – Hauptstrom
  "11-300-06": { waterwayName:"Saale", latitude:51.1583, longitude:11.8117, bankSide:"both", sectionLabel:"Landesgrenze Thüringen – Eisenbahnbrücke Eulau", restrictions:[], route:[[51.105,11.665],[51.135,11.720],[51.155,11.800],[51.175,11.865]] },
  "11-440-02": { waterwayName:"Saale", latitude:51.2322, longitude:11.9944, bankSide:"both", sectionLabel:"Eisenbahnbrücke Eulau – Kleinkorbetha; weiter bis Bad Dürrenberg zusammen mit 11-443-01 beidseitig", restrictions:[], route:[[51.175,11.865],[51.205,11.940],[51.235,12.000],[51.270,12.040],[51.300,12.065]] },
  "11-443-01": { waterwayName:"Saale", latitude:51.2700, longitude:12.0400, bankSide:"left", sectionLabel:"Kleinkorbetha – Einlauf Schleusengraben Bad Dürrenberg, linksseitig", restrictions:["Überlappt 11-440-02 rechtsseitig; zusammen ist dieser Teil beidseitig im LAV-Fonds."], route:[[51.260,12.030],[51.278,12.050],[51.300,12.065]] },
  "10-290-14": { waterwayName:"Saale", latitude:51.3617, longitude:12.0125, bankSide:"both", sectionLabel:"Oberwasser Wehr Bad Dürrenberg – Straßenbrücke B 91", restrictions:[], route:[[51.300,12.065],[51.330,12.030],[51.365,12.005],[51.405,11.978]] },
  "14-210-16": { waterwayName:"Saale", latitude:51.4764, longitude:11.9451, bankSide:"both", sectionLabel:"Straßenbrücke B 91 – Trompeterfelsen zwischen Halle und Brachwitz", restrictions:["Einschränkungen in Naturschutzgebieten beachten."], route:[[51.405,11.978],[51.445,11.955],[51.485,11.940],[51.525,11.900],[51.548,11.875]] },
  "10-370-17": { waterwayName:"Saale", latitude:51.5676, longitude:11.8310, bankSide:"both", sectionLabel:"Trompeterfelsen – Kreisgrenze Salzlandkreis bei Rothenburg", restrictions:[], route:[[51.548,11.875],[51.575,11.845],[51.610,11.805],[51.645,11.755]] },
  "6-110-14": { waterwayName:"Saale", latitude:51.7250, longitude:11.7283, bankSide:"both", sectionLabel:"Kreisgrenze Saalekreis bei Rothenburg – Einmündung Fuhne unterhalb Bernburg", restrictions:[], route:[[51.645,11.755],[51.685,11.735],[51.725,11.725],[51.765,11.740],[51.805,11.755]] },
  "6-111-13": { waterwayName:"Saale", latitude:51.8650, longitude:11.7650, bankSide:"both", sectionLabel:"Einmündung Fuhne – Höhe Ortslage Wispitz", restrictions:[], route:[[51.805,11.755],[51.835,11.755],[51.865,11.765],[51.895,11.790]] },
  "6-400-20": { waterwayName:"Saale", latitude:51.9089, longitude:11.8244, bankSide:"both", sectionLabel:"Saale im Altkreis Schönebeck", restrictions:["Örtliche Abschnittsgrenzen/Beschilderung des KAV Schönebeck beachten."], route:[[51.895,11.790],[51.910,11.820],[51.925,11.850]] },
  "6-402-07": { waterwayName:"Saale", latitude:51.9235, longitude:11.8626, bankSide:"left", sectionLabel:"Werkleitz – Elbmündung, linksseitig", restrictions:["Nur linksseitig beangelbar."], route:[[51.915,11.835],[51.930,11.875],[51.945,11.900]] },

  // BODE – Hauptstromabschnitte
  "5-340-09": { waterwayName:"Bode", latitude:51.7967, longitude:11.1633, bankSide:"both", salmonid:true, sectionLabel:"Einlauf Quarmbach – Selkemündung bei Rodersdorf", restrictions:["Salmonidenstrecken beachten."], route:[[51.780,11.095],[51.795,11.145],[51.805,11.200]] },
  "5-190-03": { waterwayName:"Bode", latitude:51.9100, longitude:11.1800, bankSide:"both", sectionLabel:"Einlauf Goldbach – Straßenbrücke Deesdorf", restrictions:[], route:[[51.835,11.180],[51.875,11.190],[51.915,11.205]] },
  "3-430-08": { waterwayName:"Bode", latitude:51.9900, longitude:11.3800, bankSide:"both", sectionLabel:"Mühlgraben an Bodebrücke Hadmersleben – Wehr Egeln-Nord (Oberwasser)", restrictions:[], route:[[51.985,11.300],[51.985,11.360],[51.980,11.430]] },
  "6-410-14": { waterwayName:"Bode", latitude:51.9500, longitude:11.4600, bankSide:"both", sectionLabel:"Wehr Egeln-Nord (Unterwasser) – Stappenbrücke Wolmirsleben", restrictions:[], route:[[51.980,11.430],[51.955,11.470],[51.930,11.500]] },
  "6-410-15": { waterwayName:"Bode", latitude:51.9033, longitude:11.5267, bankSide:"both", sectionLabel:"Wehr Rothenförde (Unterwasser) – Mühlengraben Neugattersleben", restrictions:[], route:[[51.925,11.505],[51.900,11.535],[51.875,11.575],[51.850,11.620]] },
  "6-111-04": { waterwayName:"Bode", latitude:51.8300, longitude:11.7300, bankSide:"both", sectionLabel:"Beginn Mühlgraben – Mündung in die Saale", restrictions:[], route:[[51.850,11.620],[51.835,11.675],[51.825,11.725],[51.815,11.755]] },

  // MULDE
  "7-120-21": { waterwayName:"Mulde", latitude:51.6058, longitude:12.4608, bankSide:"both", sectionLabel:"Landesgrenze Sachsen – Muldestausee", restrictions:["Linkes Ufer im Bereich Alte Mulde ausgenommen."], route:[[51.555,12.545],[51.585,12.505],[51.620,12.455],[51.655,12.400]] },
  "7-120-22": { waterwayName:"Mulde", latitude:51.6800, longitude:12.3200, bankSide:"both", sectionLabel:"ca. 750 m oberhalb Wehr Jeßnitz – Einmündung Mühlgraben", restrictions:[], route:[[51.665,12.350],[51.680,12.325],[51.695,12.305]] },
  "7-120-23": { waterwayName:"Mulde", latitude:51.7100, longitude:12.3000, bankSide:"both", sectionLabel:"ca. 500 m oberhalb Brücke – Brücke Raguhn", restrictions:[], route:[[51.695,12.305],[51.715,12.285],[51.735,12.270]] },
  "12-140-07": { waterwayName:"Mulde", latitude:51.8300, longitude:12.2600, bankSide:"both", sectionLabel:"Dessau/Jonitzer Mulde – amtliche Teilstrecken gemäß Gewässerverzeichnis", restrictions:["Mehrere getrennte Teilstrecken; genaue Brücken-/Einmündungsgrenzen und örtliche Beschilderung beachten."], route:[[51.800,12.245],[51.825,12.255],[51.850,12.270]] },

  // UNSTRUT
  "11-310-05": { waterwayName:"Unstrut", latitude:51.2344, longitude:11.6578, bankSide:"both", sectionLabel:"Landesgrenze Thüringen – Mündung in die Saale", restrictions:[], route:[[51.285,11.405],[51.270,11.500],[51.250,11.590],[51.235,11.660],[51.215,11.735]] },

  // MITTELLANDKANAL – nur amtlich eindeutig begrenzte km-Abschnitte
  "13-280-02": { waterwayName:"Mittellandkanal", latitude:52.2300, longitude:11.6600, bankSide:"both", riverKm:"318,4–320,10", sectionLabel:"Toter Arm, km 318,4–320,10", restrictions:[], route:[[52.229,11.625],[52.229,11.650],[52.230,11.680]] },
  "3-470-27": { waterwayName:"Mittellandkanal", latitude:52.2300, longitude:11.6800, bankSide:"left", riverKm:"320,10–321,10", sectionLabel:"km 320,10–321,10, nur Nordseite", restrictions:["Nur Nordseite. Die Farbe Blau bedeutet hier ausdrücklich Nordufer, nicht Fließrichtung-links."], route:[[52.230,11.680],[52.231,11.700]] },
  "4-130-36": { waterwayName:"Mittellandkanal", latitude:52.2367, longitude:11.7233, bankSide:"left", riverKm:"322,82–324,46", sectionLabel:"km 322,82–324,46, Nordufer", restrictions:["Nur Nordufer. Die Farbe Blau bedeutet hier ausdrücklich Nordufer."], route:[[52.233,11.720],[52.238,11.750]] },

  // ELBE-HAVEL-KANAL
  "4-130-15": { waterwayName:"Elbe-Havel-Kanal", latitude:52.2833, longitude:11.8447, bankSide:"both", riverKm:"326,67–344", sectionLabel:"km 326,67–344", restrictions:["Betriebsanlagenverordnung für Bundeswasserstraßen und LSG beachten."], route:[[52.245,11.765],[52.275,11.835],[52.320,11.910],[52.355,11.970]] },
  "4-171-26": { waterwayName:"Elbe-Havel-Kanal", latitude:52.3667, longitude:11.9900, bankSide:"both", riverKm:"344–353", sectionLabel:"km 344–353", restrictions:["Betriebsanlagenverordnung für Bundeswasserstraßen beachten."], route:[[52.355,11.970],[52.380,12.015],[52.400,12.060]] },
  "4-173-02": { waterwayName:"Elbe-Havel-Kanal", latitude:52.4100, longitude:12.0700, bankSide:"both", riverKm:"353–360", sectionLabel:"km 353–360", restrictions:["Betriebsanlagenverordnung für Bundeswasserstraßen beachten."], route:[[52.400,12.060],[52.410,12.105],[52.410,12.150]] },
  "4-170-16": { waterwayName:"Elbe-Havel-Kanal", latitude:52.4000, longitude:12.2100, bankSide:"both", sectionLabel:"km 360–364,5 sowie 365,7–372,8", restrictions:["Zwei getrennte Teilabschnitte; Betriebsanlagenverordnung für Bundeswasserstraßen beachten."], route:[[52.410,12.150],[52.405,12.195],[52.405,12.245],[52.420,12.320]] },
  "4-172-01": { waterwayName:"Elbe-Havel-Kanal", latitude:52.4033, longitude:12.1933, bankSide:"both", riverKm:"364,5–365,7", sectionLabel:"Brücke B1 Ortsausgang Genthin – Einmündung Neuer Graben", restrictions:["Betriebsanlagenverordnung für Bundeswasserstraßen beachten."], route:[[52.405,12.195],[52.405,12.220]] },
  // V21 – nächster geprüfter Fließgewässerblock nach Elbe-/Selke-Schema
  "6-100-10": { waterwayName:"Wipper", latitude:51.7698467, longitude:11.5751650, bankSide:"both", salmonid:true, sectionLabel:"Wipper vom Wehr/letzten Brücke Groß Schierstedt bis Brücke Osmarsleben", restrictions:["Salmonidengeprägte LAV-Strecke; aktuelle LAV-Regeln und örtliche Beschilderung beachten."], route:[[51.74764,11.52545],[51.75432,11.54625],[51.76412,11.56308],[51.775,11.585],[51.786,11.605],[51.792,11.62621]] },
  "9-390-22": { waterwayName:"Helme", latitude:51.4357667, longitude:11.1976556, bankSide:"both", salmonid:false, sectionLabel:"Helme ab ca. 200 m unterhalb Straßenbrücke Kelbra bis Landesgrenze südlich Katharinenrieth, einschließlich Nebengewässer", restrictions:["Barbe und Äsche ganzjährig geschont.", "Salmonidenstrecken und örtliche Beschilderung beachten.", "NSG/Fischschonbezirke im Verlauf beachten."], route:[[51.43582,11.04144],[51.445,11.085],[51.452,11.12],[51.445,11.16],[51.44425,11.19721],[51.44,11.235],[51.43,11.275],[51.42,11.315],[51.40983,11.35025]], salmonidRoute:[[51.442,11.175],[51.44425,11.19721],[51.442,11.215]] },
  "1-260-14": { waterwayName:"Ohre", latitude:52.5910233, longitude:10.9621700, bankSide:"both", salmonid:false, sectionLabel:"Ohre in Steimke", restrictions:[], route:[[52.61,10.935],[52.58807,10.96651],[52.575,10.985]] },
  "1-260-15": { waterwayName:"Ohre", latitude:52.5601400, longitude:10.9867600, bankSide:"both", salmonid:false, sectionLabel:"Ohre in Jahrstedt", restrictions:[], route:[[52.575,10.985],[52.56042,10.97528],[52.545,11.0]] },
  "3-200-34": { waterwayName:"Ohre", latitude:52.3295117, longitude:11.3955033, bankSide:"both", salmonid:false, sectionLabel:"Ohre von Straßenbrücke Calvörde bis Vahldorfer Brücke", restrictions:[], route:[[52.39487,11.29692],[52.37,11.335],[52.345,11.375],[52.32,11.41],[52.29,11.455],[52.2572,11.5011]] },
  "3-470-17": { waterwayName:"Ohre", latitude:52.2501725, longitude:11.5644600, bankSide:"both", salmonid:false, sectionLabel:"Ohre von Vahldorfer Brücke bis Ortsgrenze Wolmirstedt", restrictions:[], route:[[52.2572,11.5011],[52.25,11.545],[52.245,11.585],[52.24849,11.62674]] },
  "3-472-05": { waterwayName:"Ohre", latitude:52.2494967, longitude:11.6272467, bankSide:"both", salmonid:false, sectionLabel:"Ohre Stadtgebiet Wolmirstedt", restrictions:["LSG beachten."], route:[[52.245,11.61],[52.24849,11.62674],[52.255,11.645]] },
  "3-470-26": { waterwayName:"Ohre", latitude:52.2758980, longitude:11.7023480, bankSide:"both", salmonid:false, sectionLabel:"Ohre von Wolmirstedt bis Elbmündung", restrictions:["NSG „Rogätzer Hang“ beachten."], route:[[52.24849,11.62674],[52.258,11.665],[52.275,11.705],[52.292,11.745],[52.306,11.77]] },
  "1-260-11": { waterwayName:"Jeetze", latitude:52.8637633, longitude:11.1391400, bankSide:"both", salmonid:false, sectionLabel:"Jeetze von Dorfstraße im Amt Dambeck bis Landesgrenze", restrictions:[], route:[[52.80258,11.15484],[52.825,11.16],[52.85,11.155],[52.875,11.145],[52.9,11.125],[52.93,11.095]] },
  "1-380-13": { waterwayName:"Jeetze", latitude:52.8025267, longitude:11.1549467, bankSide:"both", salmonid:false, sectionLabel:"Jeetze bei Dambeck", restrictions:["Boote ohne Motor."], route:[[52.79,11.15],[52.80258,11.15484],[52.815,11.16]] },
  "7-273-11": { waterwayName:"Fuhne", latitude:51.6871214, longitude:11.8892471, bankSide:"both", salmonid:false, sectionLabel:"Fuhne von Einmündung der Riede bis Kreisgrenze", restrictions:[], route:[[51.64642,11.99855],[51.655,11.96],[51.67,11.92],[51.68343,11.87618],[51.7,11.845],[51.72,11.82],[51.735,11.805]] },
  "6-110-18": { waterwayName:"Fuhne", latitude:51.7745180, longitude:11.7800000, bankSide:"both", salmonid:false, sectionLabel:"Fuhne vom Viadukt bei Kleinwirschleben bis Mündung in die Saale", restrictions:[], route:[[51.74832,11.79622],[51.76,11.79],[51.775,11.78],[51.79,11.77],[51.79927,11.76378]] },


// AUTO BATCH 01 – exact OSM-name + official Angelatlas locality
"1-160-06": {
  waterwayName:"Wilhelmskanal",
  latitude:52.45,
  longitude:11.14,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Wilhelmskanal von Straße",
  restrictions:["Automatisch zugeordnet: LAV-Abschnitt und örtliche Beschilderung/aktuelle LAV-Ergänzungen beachten."],
  route:[[52.425000,11.105000],[52.450000,11.140000],[52.475000,11.175000]]
},
"1-160-22": {
  waterwayName:"Secantsgraben",
  latitude:52.66,
  longitude:11.45,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Secantsgraben von Str.-Br. Kalbe/M. –",
  restrictions:["Automatisch zugeordnet: LAV-Abschnitt und örtliche Beschilderung/aktuelle LAV-Ergänzungen beachten."],
  route:[[52.635000,11.415000],[52.660000,11.450000],[52.685000,11.485000]]
},
"2-421-01": {
  waterwayName:"Dollgraben",
  latitude:52.45,
  longitude:11.79,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Dollgraben",
  restrictions:["Automatisch zugeordnet: LAV-Abschnitt und örtliche Beschilderung/aktuelle LAV-Ergänzungen beachten."],
  route:[[52.425000,11.755000],[52.450000,11.790000],[52.475000,11.825000]]
},
"4-130-24": {
  waterwayName:"Niegripper Verbindungskanal",
  latitude:52.25,
  longitude:11.73,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Niegripper Verbindungskanal",
  restrictions:["Automatisch zugeordnet: LAV-Abschnitt und örtliche Beschilderung/aktuelle LAV-Ergänzungen beachten."],
  route:[[52.225000,11.695000],[52.250000,11.730000],[52.275000,11.765000]]
},
"4-130-32": {
  waterwayName:"Niegripper Altkanal",
  latitude:52.2733333,
  longitude:11.7933333,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Niegripper Altkanal (Teilfläche)",
  restrictions:["Automatisch zugeordnet: LAV-Abschnitt und örtliche Beschilderung/aktuelle LAV-Ergänzungen beachten."],
  route:[[52.248333,11.758333],[52.273333,11.793333],[52.298333,11.828333]]
},
"4-171-15": {
  waterwayName:"Pareyer Verbindungskanal",
  latitude:52.4033333,
  longitude:11.9733333,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Pareyer Verbindungskanal",
  restrictions:["Automatisch zugeordnet: LAV-Abschnitt und örtliche Beschilderung/aktuelle LAV-Ergänzungen beachten."],
  route:[[52.378333,11.938333],[52.403333,11.973333],[52.428333,12.008333]]
},
"5-340-06": {
  waterwayName:"Hauptseegraben",
  latitude:51.83,
  longitude:11.28,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Hauptseegraben von Kreisgrenze",
  restrictions:["Automatisch zugeordnet: LAV-Abschnitt und örtliche Beschilderung/aktuelle LAV-Ergänzungen beachten."],
  route:[[51.805000,11.245000],[51.830000,11.280000],[51.855000,11.315000]]
},
"6-110-13": {
  waterwayName:"Saalealtarm Aderstedt",
  latitude:51.78,
  longitude:11.7,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Saalealtarm Aderstedt",
  restrictions:["Automatisch zugeordnet: LAV-Abschnitt und örtliche Beschilderung/aktuelle LAV-Ergänzungen beachten."],
  route:[[51.755000,11.665000],[51.780000,11.700000],[51.805000,11.735000]]
},
"7-120-19": {
  waterwayName:"Lober-Leine-Kanal",
  latitude:51.59,
  longitude:12.41,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Lober-Leine-Kanal",
  restrictions:["Automatisch zugeordnet: LAV-Abschnitt und örtliche Beschilderung/aktuelle LAV-Ergänzungen beachten."],
  route:[[51.565000,12.375000],[51.590000,12.410000],[51.615000,12.445000]]
},
"8-183-14": {
  waterwayName:"Fließgraben",
  latitude:51.8566667,
  longitude:12.4133333,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Fließgraben von Straßenbrücke",
  restrictions:["Automatisch zugeordnet: LAV-Abschnitt und örtliche Beschilderung/aktuelle LAV-Ergänzungen beachten."],
  route:[[51.831667,12.378333],[51.856667,12.413333],[51.881667,12.448333]]
},
"8-250-12": {
  waterwayName:"Neugraben",
  latitude:51.74,
  longitude:13.03,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Neugraben von Landesgrenze bis",
  restrictions:["Automatisch zugeordnet: LAV-Abschnitt und örtliche Beschilderung/aktuelle LAV-Ergänzungen beachten."],
  route:[[51.715000,12.995000],[51.740000,13.030000],[51.765000,13.065000]]
},
"13-280-03": {
  waterwayName:"Rothenseer Verbindungskanal",
  latitude:52.2133333,
  longitude:11.6833333,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Rothenseer Verbindungskanal",
  restrictions:["Automatisch zugeordnet: LAV-Abschnitt und örtliche Beschilderung/aktuelle LAV-Ergänzungen beachten."],
  route:[[52.188333,11.648333],[52.213333,11.683333],[52.238333,11.718333]]
},


// AUTO BATCH 02 – exact OSM-name + official Angelatlas locality
"2-160-02": {
  waterwayName:"Secantsgraben",
  latitude:52.61,
  longitude:11.48,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Secantsgraben von Straßenbrücke",
  restrictions:["Automatisch zugeordnet: aktuelle LAV-Ergänzungen und örtliche Beschilderung beachten."],
  route:[[52.585000,11.445000],[52.610000,11.480000],[52.635000,11.515000]]
},
"3-261-05": {
  waterwayName:"Landgraben (1. Wiesengraben)",
  latitude:52.41,
  longitude:11.0,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Landgraben bei Oebisfelde",
  restrictions:["Automatisch zugeordnet: aktuelle LAV-Ergänzungen und örtliche Beschilderung beachten."],
  route:[[52.385000,10.965000],[52.410000,11.000000],[52.435000,11.035000]]
},
"4-171-12": {
  waterwayName:"Altarm Baggerelbe",
  latitude:52.42,
  longitude:11.99,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Baggerelbe bei Derben",
  restrictions:["Automatisch zugeordnet: aktuelle LAV-Ergänzungen und örtliche Beschilderung beachten."],
  route:[[52.395000,11.955000],[52.420000,11.990000],[52.445000,12.025000]]
},
"8-183-13": {
  waterwayName:"Kapengraben",
  latitude:51.8166667,
  longitude:12.4066667,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Kapengraben von ehem. B107 bis zur",
  restrictions:["Automatisch zugeordnet: aktuelle LAV-Ergänzungen und örtliche Beschilderung beachten."],
  route:[[51.791667,12.371667],[51.816667,12.406667],[51.841667,12.441667]]
},
"8-250-06": {
  waterwayName:"Schweinitzer Fließ",
  latitude:51.8133333,
  longitude:13.0666667,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Schweinitzer Fließ von Landesgrenze bis A, B, Bl, H, Pl, Ro, S 9,50 Einlauf Morgengraben bei Zwuschen/Dixförda",
  restrictions:["Automatisch zugeordnet: aktuelle LAV-Ergänzungen und örtliche Beschilderung beachten."],
  route:[[51.788333,13.031667],[51.813333,13.066667],[51.838333,13.101667]]
},


// AUTO BATCH 03 – SECTION SAFE / whole matched OSM feature only
"7-120-04": {
  waterwayName:"Alte Mulde Roitzschjora",
  latitude:51.59,
  longitude:12.49,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Alte Mulde Roitzschjora",
  restrictions:["Automatisch als vollständiges OSM-Gewässerfeature zugeordnet; aktuelle LAV-Ergänzungen und örtliche Beschilderung beachten."]
},
"7-120-34": {
  waterwayName:"Alte Mulde",
  latitude:51.645,
  longitude:12.345,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Alte Mulde in Friedersdorf",
  restrictions:["Automatisch als vollständiges OSM-Gewässerfeature zugeordnet; aktuelle LAV-Ergänzungen und örtliche Beschilderung beachten."]
},
"10-290-13": {
  waterwayName:"Saale-Leipzig-Kanal",
  latitude:51.35,
  longitude:12.16,
  bankSide:"both",
  salmonid:false,
  sectionLabel:"Saale-Leipzig-Kanal",
  restrictions:["Automatisch als vollständiges OSM-Gewässerfeature zugeordnet; aktuelle LAV-Ergänzungen und örtliche Beschilderung beachten."]
},

};
