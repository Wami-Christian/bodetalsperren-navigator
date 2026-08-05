import type { FishingWater } from "@/lib/types";
import { lavCatalog } from "./lav-catalog";

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

const featured: FishingWater[] = [
  {
    id:"rappbodetalsperre", name:"Rappbodetalsperre", module:"Bodetalsperren", type:"Talsperre", district:"Harz",
    latitude:51.7376, longitude:10.8914, fish:["Zander","Barsch","Hecht"], rating:{Zander:4,Barsch:4,Hecht:4},
    notes:["Navigationsdaten aus Bodetalsperren Navigator V3.1 übernommen.","Erkundungspunkte sind keine amtlich freigegebenen Angelstellen; Beschilderung und Zugangsregeln prüfen."],
    spots:[...rappbodeSpots], parkings:[...rappbodeParkings], sourceStatus:"verified"
  },
  {
    id:"wendefurther-talsperre", name:"Wendefurther Talsperre", module:"Bodetalsperren", type:"Talsperre", district:"Harz",
    latitude:51.7385, longitude:10.9255, fish:["Barsch","Hecht","Karpfen"], rating:{Barsch:4,Hecht:4,Karpfen:3},
    notes:["Parkplatz und Uferpunkt aus der Vorversion übernommen; örtliche Sperrbereiche prüfen."],
    spots:[{id:"E7",name:"Wendefurth – Ufer nahe Staumauer",latitude:51.736270,longitude:10.901098,parkingId:"12",tags:["Erkundung"],source:"Aus FPG-Merkblattkarte näherungsweise am Ufer abgeleitet.",risk:"Technische Sperrbereiche und örtliche Schilder beachten."}],
    parkings:[rappbodeParkings[11]], sourceStatus:"verified"
  },
  {
    id:"kunstteich-ballenstedt",name:"Kunstteich Ballenstedt",module:"LAV Sachsen-Anhalt",type:"Teich",district:"Harz",latitude:51.704,longitude:11.215,
    fish:["Zander","Barsch","Schleie"],rating:{Zander:4,Barsch:4,Schleie:4},notes:["Kartierter Arbeitsdatensatz; Gewässernummer und Bestimmungen aktuell im Angelatlas prüfen."],
    spots:[],parkings:[],sourceStatus:"demo"
  },
  {
    id:"selke-meisdorf",name:"Selke bei Meisdorf",module:"Harzflüsse",type:"Fließgewässer",district:"Harz",latitude:51.710,longitude:11.298,
    fish:["Forelle"],rating:{Forelle:5},notes:["Salmoniden-, Schon- und Sperrstrecken zwingend aktuell prüfen."],spots:[],parkings:[],sourceStatus:"demo"
  },
  {
    id:"ditfurter-kiessee",name:"Ditfurter Kiessee",module:"LAV Sachsen-Anhalt",type:"Kiesgrube",district:"Harz",latitude:51.829,longitude:11.197,
    fish:["Zander","Barsch"],rating:{Zander:5,Barsch:4},notes:["Exakte Gewässerzuordnung, Grenzen und Zugang aktuell prüfen."],spots:[],parkings:[],sourceStatus:"demo"
  },
  {
    id:"siebersteinteich",name:"Großer Siebersteinteich",module:"LAV Sachsen-Anhalt",type:"Teich",district:"Harz",latitude:51.690,longitude:11.165,
    fish:["Schleie","Barsch"],rating:{Schleie:4,Barsch:3},notes:["Ufer-, Natur- und Schutzregeln aktuell prüfen."],spots:[],parkings:[],sourceStatus:"demo"
  }
];

const featuredLavNumbers = new Set(featured.map(w => w.lavNumber).filter(Boolean));
export const waters: FishingWater[] = [...featured, ...lavCatalog.filter(w => !featuredLavNumbers.has(w.lavNumber))];
