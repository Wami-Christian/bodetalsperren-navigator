import type { FishingWater } from "@/lib/types";
import { lavCatalog } from "./lav-catalog";
import { lavCoordinateIndex } from "./lav-coordinates.generated";
import { atkisWaterMatchIndex } from "./atkis-water-matches.generated";

const rappbodeParkings: FishingWater["parkings"] = [
  { id:"1", name:"Alte Rübeländer Straße – Beginn Betonstraße", latitude:51.718578, longitude:10.876041, access:"restricted", accuracy:"approx", note:"Eingeschränkte Zufahrt / Abstellpunkt" },
  { id:"2", name:"Alte Heerstraße – Waldkante", latitude:51.715027, longitude:10.860164, access:"restricted", accuracy:"approx", note:"Eingeschränkte Zufahrt / Abstellpunkt" },
  { id:"3", name:"Birkenallee", latitude:51.702304, longitude:10.845620, access:"restricted", accuracy:"approx", note:"Eingeschränkte Zufahrt / Abstellpunkt" },
  { id:"4", name:"Parkplatz am Rotestein", latitude:51.729181, longitude:10.880881, access:"public", accuracy:"verified", note:"Öffentlicher Parkplatz" },
  { id:"5", name:"Parkplatz Stemberghaus", latitude:51.721871, longitude:10.896238, access:"public", accuracy:"verified", note:"Öffentlicher Parkplatz" },
  { id:"6", name:"Parkplatz B81", latitude:51.733332, longitude:10.884947, access:"public", accuracy:"approx", note:"Öffentlicher Parkplatz" },
  { id:"7", name:"Parkplatz Rappbodetalsperre Ost", latitude:51.742403, longitude:10.888020, access:"public", accuracy:"verified", note:"Öffentlicher Parkplatz" },
  { id:"8", name:"Parkplatz Rappbodetalsperre Nord", latitude:51.767209, longitude:10.836927, access:"public", accuracy:"approx", note:"Öffentlicher Parkplatz" },
  { id:"9", name:"Waldparkplatz Rappbodetalsperre", latitude:51.781315, longitude:10.796820, access:"public", accuracy:"approx", note:"Öffentlicher Parkplatz" },
  { id:"10", name:"Alte Rübeländer Straße – Beginn Lange", latitude:51.774641, longitude:10.790456, access:"restricted", accuracy:"approx", note:"Eingeschränkte Zufahrt / Abstellpunkt" },
  { id:"11", name:"Königshütte – Zufahrt zur Staumauer", latitude:51.788785, longitude:10.721493, access:"restricted", accuracy:"approx", note:"Eingeschränkte Zufahrt / Abstellpunkt" },
  { id:"12", name:"Parkplatz an der Staumauer", latitude:51.743033, longitude:10.897782, access:"public", accuracy:"approx", note:"Öffentlicher Parkplatz" }
];

const rappbodeSpots: FishingWater["spots"] = [
  { id:"E1", name:"Rotestein – Ufererkundung West", latitude:51.729404, longitude:10.873333, parkingId:"4", tags:["Erkundung"], source:"Aus FPG-Merkblattkarte näherungsweise am Ufer abgeleitet.", risk:"Steiles Gelände möglich; Zugang vor Ort prüfen." },
  { id:"E2", name:"Stemberghaus – Ufererkundung Nordwest", latitude:51.733218, longitude:10.875310, parkingId:"5", tags:["Erkundung"], source:"Aus FPG-Merkblattkarte näherungsweise am Ufer abgeleitet.", risk:"Längerer Fußweg und steile Ufer möglich." },
  { id:"E3", name:"B81 – südliche Bucht", latitude:51.738769, longitude:10.873540, parkingId:"6", tags:["Erkundung"], source:"Aus FPG-Merkblattkarte näherungsweise am Ufer abgeleitet.", risk:"Uferzugang und Schutzbereiche prüfen." },
  { id:"E4", name:"Rappbode Ost – Ufererkundung", latitude:51.740823, longitude:10.885714, parkingId:"7", tags:["Erkundung"], source:"Aus FPG-Merkblattkarte näherungsweise am Ufer abgeleitet.", risk:"Nähe technischer Anlagen; Beschilderung besonders beachten." },
  { id:"E5", name:"Nordarm Ost – Ufererkundung", latitude:51.754401, longitude:10.861068, parkingId:"8", tags:["Erkundung"], source:"Aus FPG-Merkblattkarte näherungsweise am Ufer abgeleitet.", risk:"Waldwege und tatsächliche Uferzugänglichkeit prüfen." },
  { id:"E6", name:"Nordarm West – Ufererkundung", latitude:51.763580, longitude:10.826655, parkingId:"9", tags:["Erkundung"], source:"Aus FPG-Merkblattkarte näherungsweise am Ufer abgeleitet.", risk:"Entfernung und Gelände können erheblich abweichen." }
];


const trautensteinParkings: FishingWater["parkings"] = [
  {
    id:"TR-P1",
    name:"Parkplatz Dorfgemeinschaftshaus Trautenstein",
    latitude:51.6879,
    longitude:10.7788,
    access:"public",
    accuracy:"approx",
    note:"Öffentlicher Ausgangspunkt im Ort; längerer Fußweg zur Vorsperre. Position vor Ort prüfen."
  }
];

const trautensteinSpots: FishingWater["spots"] = [
  {
    id:"TR-E1",
    name:"Vorsperrdamm Rappbode – Erkundung",
    latitude:51.704148,
    longitude:10.790162,
    parkingId:"TR-P1",
    tags:["Staumauer","Erkundung"],
    source:"Gewässerkoordinate und öffentlich beschriebener Rundweg ab Trautenstein.",
    risk:"Kein ausgewiesener Angel-Hotspot; Schutzbereiche, Beschilderung und tatsächlichen Uferzugang prüfen."
  }
];

const hasselParkings: FishingWater["parkings"] = [
  {
    id:"HA-P1",
    name:"Wanderparkplatz Hagenmühle / Hasselvorsperre",
    latitude:51.697893,
    longitude:10.843684,
    access:"public",
    accuracy:"approx",
    note:"Öffentlich dokumentierter Wander- und Ausgangspunkt unterhalb der Hagenmühle; Parkregeln vor Ort beachten."
  }
];

const hasselSpots: FishingWater["spots"] = [
  {
    id:"HA-E1",
    name:"Hasselvorsperre – Staumauerbereich",
    latitude:51.706111,
    longitude:10.830278,
    parkingId:"HA-P1",
    tags:["Staumauer","Erkundung"],
    source:"Öffentlich beschriebener Rundweg vom Wanderparkplatz zur Staumauer.",
    risk:"Etwa 3 km Fußweg; technische Bereiche, Trinkwasserschutz und Beschilderung beachten."
  },
  {
    id:"HA-E2",
    name:"Hasselvorsperre – rechtes Ufer, Erkundung",
    latitude:51.7019,
    longitude:10.8370,
    parkingId:"HA-P1",
    tags:["Ufer","Erkundung"],
    source:"Näherungsweise entlang des öffentlich beschriebenen Rundwegs.",
    risk:"Kein bestätigter Angelplatz; Uferzugang und Schutzregeln vor Ort prüfen."
  }
];

const koenigshuetteParkings: FishingWater["parkings"] = [
  {
    id:"KO-P1",
    name:"Wanderparkplatz Tanner Straße / L98",
    latitude:51.738729,
    longitude:10.764647,
    access:"public",
    accuracy:"verified",
    note:"Kostenlose Parkflächen am südlichen Ortsausgang Königshütte Richtung Tanne."
  }
];

const koenigshuetteSpots: FishingWater["spots"] = [
  {
    id:"KO-E1",
    name:"Trogfurther Brücke – Staumauer",
    latitude:51.738611,
    longitude:10.793333,
    parkingId:"KO-P1",
    tags:["Staumauer","Erkundung"],
    source:"Öffentlich beschriebener Rundweg vom Parkplatz Tanner Straße zur Trogfurther Brücke.",
    risk:"Mehrkilometriger Fußweg; technische Anlagen und örtliche Sperrbereiche beachten."
  },
  {
    id:"KO-E2",
    name:"Königshütter Talsperre – westliches Ufer",
    latitude:51.7390,
    longitude:10.7820,
    parkingId:"KO-P1",
    tags:["Ufer","Erkundung"],
    source:"Näherungsweise entlang des öffentlichen Rundwegs.",
    risk:"Kein bestätigter Angelplatz; Wege- und Uferzugang vor Ort prüfen."
  }
];

const mandelholzParkings: FishingWater["parkings"] = [
  {
    id:"MA-P1",
    name:"Parkplatz Mandelholz / Hotel Grüne Tanne",
    latitude:51.7434,
    longitude:10.7236,
    access:"public",
    accuracy:"approx",
    note:"Öffentlich beschriebener Parkplatz gegenüber dem Hotel; Nutzungs- und Übernachtungsregeln vor Ort beachten."
  }
];

const mandelholzSpots: FishingWater["spots"] = [
  {
    id:"MA-E1",
    name:"Mandelholz – westlicher Zugang zur Kalten Bode",
    latitude:51.7444,
    longitude:10.7290,
    parkingId:"MA-P1",
    tags:["Zugang","Erkundung"],
    source:"Näherungsweise vom öffentlich beschriebenen Parkplatz am Hotel in Richtung Staubecken.",
    risk:"Wasserstand und Uferzugang können stark schwanken; Schutz- und Hochwasserhinweise beachten."
  },
  {
    id:"MA-E2",
    name:"Mandelholztalsperre – Dammnähe, Erkundung",
    latitude:51.745556,
    longitude:10.736389,
    parkingId:"MA-P1",
    tags:["Staudamm","Erkundung"],
    source:"Koordinate des Hochwasserschutzbeckens; Zugang zu Fuß vor Ort prüfen.",
    risk:"Technische Anlage; mögliche Sperrbereiche und wechselnde Wasserstände beachten."
  }
];

const wendefurthParkings: FishingWater["parkings"] = [
  {
    id:"WE-P1",
    name:"Parkplatz Bootsverleih / Seeterrasse Wendefurth",
    latitude:51.740433,
    longitude:10.918291,
    access:"public",
    accuracy:"verified",
    note:"Öffentlich erreichbarer Ausgangspunkt Am Stausee 2; Öffnungszeiten und Parkbeschilderung beachten."
  },
  {
    id:"WE-P2",
    name:"Parkplatz nahe Rappbode-Staumauer",
    latitude:51.743033,
    longitude:10.897782,
    access:"public",
    accuracy:"approx",
    note:"Aus Vorversion übernommener Ausgangspunkt; genaue Parkfläche und Beschilderung prüfen."
  }
];

const wendefurthSpots: FishingWater["spots"] = [
  {
    id:"WE-E1",
    name:"Wendefurth – Ufer am Bootsverleih",
    latitude:51.74029,
    longitude:10.91528,
    parkingId:"WE-P1",
    tags:["Ufer","Bootsverleih","Erkundung"],
    source:"Öffentlich dokumentierter Bootsverleih und Seezugang.",
    risk:"Betriebsflächen und Bootsverkehr berücksichtigen; Angel- und Bootsregeln aktuell prüfen."
  },
  {
    id:"WE-E2",
    name:"Wendefurth – Ufer nahe Rappbode-Staumauer",
    latitude:51.736270,
    longitude:10.901098,
    parkingId:"WE-P2",
    tags:["Staumauer","Erkundung"],
    source:"Aus FPG-Merkblattkarte näherungsweise am Ufer abgeleitet.",
    risk:"Technische Sperrbereiche und örtliche Schilder beachten."
  }
];

const fpgBaseNotes = [
  "Fischarten nach Fischereipachtgemeinschaft Bodetalsperren e.V.; aktuelle Gewässerordnung und Angelberechtigung prüfen.",
  "Fahrzeuge ausschließlich auf offiziellen Parkplätzen abstellen; nicht direkt ans Gewässer fahren.",
  "Parkplätze und Erkundungspunkte sind nur enthalten, wenn sie bereits belastbar dokumentiert wurden."
];

const featured: FishingWater[] = [
  {
    id:"rappbodetalsperre", name:"Rappbodetalsperre", module:"Bodetalsperren", type:"Talsperre", district:"Harz",
    latitude:51.74004, longitude:10.89342, areaHa:"390.00",
    fish:["Zander","Barsch","Hecht","Forelle","Karpfen","Schleie"],
    rating:{Zander:4,Barsch:4,Hecht:4,Forelle:3,Karpfen:3,Schleie:3},
    notes:[...fpgBaseNotes,"Keine Gastangelkarten für die Rappbodetalsperre.","Weitere offiziell genannte Arten: Aal, Seeforelle, Bachforelle und Weißfisch.","Keine Boote auf der Trinkwassertalsperre."],
    spots:[...rappbodeSpots], parkings:[...rappbodeParkings], sourceStatus:"verified"
  },
  {
    id:"vorsperre-rappbode-trautenstein", name:"Vorsperre Rappbode – Trautenstein", module:"Bodetalsperren", type:"Talsperre", district:"Harz",
    latitude:51.705556, longitude:10.794167,
    fish:["Zander","Barsch","Hecht","Forelle","Karpfen","Schleie"],
    rating:{Zander:4,Barsch:4,Hecht:4,Forelle:4,Karpfen:3,Schleie:3},
    notes:[...fpgBaseNotes,"Weitere offiziell genannte Arten: Aal, Regenbogenforelle und Weißfisch.","Trinkwasser- und Schutzregeln besonders beachten."],
    spots:[...trautensteinSpots], parkings:[...trautensteinParkings], sourceStatus:"verified"
  },
  {
    id:"vorsperre-hassel-hasselfelde", name:"Vorsperre Hassel – Hasselfelde", module:"Bodetalsperren", type:"Talsperre", district:"Harz",
    latitude:51.706111, longitude:10.830278, areaHa:"25.00",
    fish:["Zander","Barsch","Hecht","Karpfen","Schleie"],
    rating:{Zander:4,Barsch:4,Hecht:4,Karpfen:3,Schleie:3},
    notes:[...fpgBaseNotes,"Weitere offiziell genannte Arten: Aal und Weißfisch.","Trinkwasser- und Schutzregeln besonders beachten."],
    spots:[...hasselSpots], parkings:[...hasselParkings], sourceStatus:"verified"
  },
  {
    id:"ueberleitungssperre-koenigshuette", name:"Überleitungssperre Königshütte – Trogfurther Brücke", module:"Bodetalsperren", type:"Talsperre", district:"Harz",
    latitude:51.738611, longitude:10.793333, areaHa:"32.00",
    fish:["Zander","Barsch","Hecht","Forelle","Karpfen","Schleie"],
    rating:{Zander:4,Barsch:4,Hecht:4,Forelle:4,Karpfen:3,Schleie:3},
    notes:[...fpgBaseNotes,"Weitere offiziell genannte Arten: Aal, Regenbogenforelle und Weißfisch.","Technische Anlagen und örtliche Sperrbereiche beachten."],
    spots:[...koenigshuetteSpots], parkings:[...koenigshuetteParkings], sourceStatus:"verified"
  },
  {
    id:"hwr-kalte-bode-mandelholz", name:"HWR Kalte Bode – Mandelholz", module:"Bodetalsperren", type:"Talsperre", district:"Harz",
    latitude:51.745556, longitude:10.736389,
    fish:["Zander","Barsch","Hecht","Forelle","Karpfen","Schleie"],
    rating:{Zander:4,Barsch:4,Hecht:4,Forelle:4,Karpfen:3,Schleie:3},
    notes:[...fpgBaseNotes,"Weitere offiziell genannte Arten: Aal, Regenbogenforelle und Weißfisch.","Hochwasserrückhaltebecken: Wasserstand, Zugänglichkeit und Sperrungen können sich ändern."],
    spots:[...mandelholzSpots], parkings:[...mandelholzParkings], sourceStatus:"verified"
  },
  {
    id:"wendefurther-talsperre", name:"Talsperre Wendefurth", module:"Bodetalsperren", type:"Talsperre", district:"Harz",
    latitude:51.7385, longitude:10.9255,
    fish:["Zander","Barsch","Hecht","Forelle","Karpfen","Schleie"],
    rating:{Zander:4,Barsch:4,Hecht:4,Forelle:4,Karpfen:3,Schleie:3},
    notes:[...fpgBaseNotes,"Weitere offiziell genannte Arten: Aal, Regenbogenforelle und Weißfisch.","Bootsangeln nur auf Wendefurth und nur mit Booten des genannten Bootsverleihers; aktuelle Bedingungen prüfen.","Parkplatz und Uferpunkt aus der Vorversion übernommen; örtliche Sperrbereiche prüfen."],
    spots:[...wendefurthSpots],
    parkings:[...wendefurthParkings], sourceStatus:"verified"
  },
  {
    id:"5-340-05-kunstteich-in-ballenstedt", name:"Kunstteich in Ballenstedt", lavNumber:"5-340-05", module:"LAV Sachsen-Anhalt", type:"Teich", district:"Harz", latitude:51.704, longitude:11.215,
    fish:["Hecht","Karpfen","Schleie"], areaHa:"2.60", rating:{Hecht:3,Karpfen:3,Schleie:3},
    notes:["LAV-Katalogdaten 2022–2026; aktuelle Ergänzungen und Beschilderung prüfen.","Kartenposition ist ein Arbeitsdatensatz und muss vor Veröffentlichung verifiziert werden."], spots:[], parkings:[], sourceStatus:"demo"
  },
  {
    id:"selke-meisdorf", name:"Selke bei Meisdorf", module:"Harzflüsse", type:"Fließgewässer", district:"Harz", latitude:51.710, longitude:11.298,
    fish:["Forelle"], rating:{Forelle:5}, notes:["Salmoniden-, Schon- und Sperrstrecken zwingend aktuell prüfen."], spots:[], parkings:[], sourceStatus:"demo"
  },
  {
    id:"5-340-08-kiesgrube-bei-dittfurt", name:"Kiesgrube bei Dittfurt", lavNumber:"5-340-08", module:"LAV Sachsen-Anhalt", type:"Kiesgrube", district:"Harz", latitude:51.829, longitude:11.197,
    fish:["Barsch","Zander"], areaHa:"32.05", rating:{Barsch:4,Zander:4}, notes:["LAV-Katalog: Gewässer 5-340-08; aktuelle Fischarten, Grenzen und Zugänge prüfen.","Kartenposition ist ein Arbeitsdatensatz und muss vor Veröffentlichung verifiziert werden."], spots:[], parkings:[], sourceStatus:"demo"
  },
  {
    id:"5-340-10-groer-siebersteinsteich-bei-ballenstedt-a-b-bl-h-k-4-20-pl-ro-s", name:"Großer Siebersteinsteich bei Ballenstedt", lavNumber:"5-340-10", module:"LAV Sachsen-Anhalt", type:"Teich", district:"Harz", latitude:51.690, longitude:11.165,
    fish:["Barsch","Hecht","Karpfen","Schleie"], areaHa:"4.20", rating:{Barsch:3,Hecht:3,Karpfen:3,Schleie:4}, notes:["Name, Fläche und Fischcodes aus dem LAV-Katalogdatensatz bereinigt.","Ufer-, Natur- und Schutzregeln sowie die Kartenposition aktuell prüfen."], spots:[], parkings:[], sourceStatus:"demo"
  }
];

const featuredLavNumbers = new Set(featured.map(w => w.lavNumber).filter(Boolean));

const enrichedLavCatalog: FishingWater[] = lavCatalog.map((water) => {
  const official = atkisWaterMatchIndex[water.id];
  if (official?.status === "matched" && official.latitude != null && official.longitude != null) {
    return {
      ...water,
      latitude: official.latitude,
      longitude: official.longitude,
      notes: [
        ...water.notes,
        `OSM-Mehrquellenabgleich automatisch zugeordnet (${Math.round((official.confidence ?? 0) * 100)} % Konfidenz). Zuordnung vor der Nutzung prüfen.`,
        official.source ? `Geodatenquelle: ${official.source}` : "",
      ].filter(Boolean),
    };
  }

  const osm = lavCoordinateIndex[water.id];
  if (osm?.status === "matched" && osm.latitude != null && osm.longitude != null) {
    return {
      ...water,
      latitude: osm.latitude,
      longitude: osm.longitude,
      notes: [
        ...water.notes,
        `Ersatzweise mit OpenStreetMap/Nominatim zugeordnet (${Math.round((osm.confidence ?? 0) * 100)} % Konfidenz). Lage vor der Nutzung prüfen.`,
      ],
    };
  }

  return water;
});

export const waters: FishingWater[] = [
  ...featured,
  ...enrichedLavCatalog.filter(w => !featuredLavNumbers.has(w.lavNumber)),
];
