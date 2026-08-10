import type { FishingWater } from "@/lib/types";

export type BodetalsperrenPremiumData = Partial<
  Pick<
    FishingWater,
    | "name"
    | "latitude"
    | "longitude"
    | "areaHa"
    | "fish"
    | "rating"
    | "notes"
    | "parkings"
    | "spots"
    | "sourceStatus"
  >
>;

export const bodetalsperrenPremium: Record<
  string,
  BodetalsperrenPremiumData
> = {
  "rappbodetalsperre": {
    name: "Rappbodetalsperre",
    latitude: 51.74004,
    longitude: 10.89342,
    areaHa: "390.00",
    fish: ["Zander", "Barsch", "Hecht", "Forelle", "Karpfen", "Schleie"],
    rating: {
      Zander: 4,
      Barsch: 4,
      Hecht: 4,
      Forelle: 3,
      Karpfen: 3,
      Schleie: 3
    },
    notes: [
      "Fischarten nach Fischereipachtgemeinschaft Bodetalsperren; aktuelle Gewässerordnung und Angelberechtigung prüfen.",
      "Fahrzeuge ausschließlich auf offiziellen Parkplätzen abstellen; nicht direkt ans Gewässer fahren.",
      "Keine Gastangelkarten für die Rappbodetalsperre.",
      "Weitere genannte Arten: Aal, Seeforelle, Bachforelle und Weißfisch.",
      "Keine Boote auf der Trinkwassertalsperre.",
      "Erkundungspunkte sind keine amtlich freigegebenen Angelstellen."
    ],
    parkings: [
      { id: "RB-P1", name: "Alte Rübeländer Straße – Beginn Betonstraße", latitude: 51.718578, longitude: 10.876041, access: "restricted", accuracy: "approx", note: "Eingeschränkte Zufahrt beziehungsweise Abstellpunkt; örtliche Beschilderung prüfen." },
      { id: "RB-P2", name: "Alte Heerstraße – Waldkante", latitude: 51.715027, longitude: 10.860164, access: "restricted", accuracy: "approx", note: "Eingeschränkte Zufahrt beziehungsweise Abstellpunkt; örtliche Beschilderung prüfen." },
      { id: "RB-P3", name: "Birkenallee", latitude: 51.702304, longitude: 10.845620, access: "restricted", accuracy: "approx", note: "Eingeschränkte Zufahrt beziehungsweise Abstellpunkt; örtliche Beschilderung prüfen." },
      { id: "RB-P4", name: "Parkplatz am Rotestein", latitude: 51.729181, longitude: 10.880881, access: "public", accuracy: "verified", note: "Öffentlicher Parkplatz." },
      { id: "RB-P5", name: "Parkplatz Stemberghaus", latitude: 51.721871, longitude: 10.896238, access: "public", accuracy: "verified", note: "Öffentlicher Parkplatz." },
      { id: "RB-P6", name: "Parkplatz B81", latitude: 51.733332, longitude: 10.884947, access: "public", accuracy: "approx", note: "Öffentlicher Ausgangspunkt; genaue Parkfläche prüfen." },
      { id: "RB-P7", name: "Parkplatz Rappbodetalsperre Ost", latitude: 51.742403, longitude: 10.888020, access: "public", accuracy: "verified", note: "Öffentlicher Parkplatz." },
      { id: "RB-P8", name: "Parkplatz Rappbodetalsperre Nord", latitude: 51.767209, longitude: 10.836927, access: "public", accuracy: "approx", note: "Öffentlicher Ausgangspunkt; genaue Parkfläche prüfen." },
      { id: "RB-P9", name: "Waldparkplatz Rappbodetalsperre", latitude: 51.781315, longitude: 10.796820, access: "public", accuracy: "approx", note: "Öffentlicher Ausgangspunkt; Wege- und Parkregeln prüfen." },
      { id: "RB-P10", name: "Alte Rübeländer Straße – Beginn Lange", latitude: 51.774641, longitude: 10.790456, access: "restricted", accuracy: "approx", note: "Eingeschränkte Zufahrt beziehungsweise Abstellpunkt." },
      { id: "RB-P11", name: "Königshütte – Zufahrt zur Staumauer", latitude: 51.788785, longitude: 10.721493, access: "restricted", accuracy: "approx", note: "Eingeschränkte Zufahrt beziehungsweise Abstellpunkt." },
      { id: "RB-P12", name: "Parkplatz an der Staumauer", latitude: 51.743033, longitude: 10.897782, access: "public", accuracy: "approx", note: "Öffentlicher Ausgangspunkt; genaue Parkfläche und Beschilderung prüfen." }
    ],
    spots: [
      { id: "RB-E1", name: "Rotestein – Ufererkundung West", latitude: 51.729404, longitude: 10.873333, parkingId: "RB-P4", tags: ["Erkundung"], source: "Aus vorhandener Merkblattkarte näherungsweise am Ufer abgeleitet.", risk: "Steiles Gelände möglich; Zugang und Schutzregeln vor Ort prüfen." },
      { id: "RB-E2", name: "Stemberghaus – Ufererkundung Nordwest", latitude: 51.733218, longitude: 10.875310, parkingId: "RB-P5", tags: ["Erkundung"], source: "Aus vorhandener Merkblattkarte näherungsweise am Ufer abgeleitet.", risk: "Längerer Fußweg und steile Ufer möglich." },
      { id: "RB-E3", name: "B81 – südliche Bucht", latitude: 51.738769, longitude: 10.873540, parkingId: "RB-P6", tags: ["Erkundung"], source: "Aus vorhandener Merkblattkarte näherungsweise am Ufer abgeleitet.", risk: "Uferzugang und Schutzbereiche prüfen." },
      { id: "RB-E4", name: "Rappbode Ost – Ufererkundung", latitude: 51.740823, longitude: 10.885714, parkingId: "RB-P7", tags: ["Erkundung"], source: "Aus vorhandener Merkblattkarte näherungsweise am Ufer abgeleitet.", risk: "Nähe technischer Anlagen; Beschilderung besonders beachten." },
      { id: "RB-E5", name: "Nordarm Ost – Ufererkundung", latitude: 51.754401, longitude: 10.861068, parkingId: "RB-P8", tags: ["Erkundung"], source: "Näherungsweise entlang vorhandener Wege.", risk: "Waldwege und tatsächliche Uferzugänglichkeit prüfen." },
      { id: "RB-E6", name: "Nordarm West – Ufererkundung", latitude: 51.763580, longitude: 10.826655, parkingId: "RB-P9", tags: ["Erkundung"], source: "Näherungsweise entlang vorhandener Wege.", risk: "Entfernung und Gelände können erheblich abweichen." }
    ],
    sourceStatus: "verified"
  },

  "vorsperre-rappbode-trautenstein": {
    name: "Vorsperre Rappbode – Trautenstein",
    latitude: 51.705556,
    longitude: 10.794167,
    fish: ["Zander", "Barsch", "Hecht", "Forelle", "Karpfen", "Schleie"],
    rating: {
      Zander: 4,
      Barsch: 4,
      Hecht: 4,
      Forelle: 4,
      Karpfen: 3,
      Schleie: 3
    },
    notes: [
      "Aktuelle Gewässerordnung, Trinkwasser- und Schutzregeln prüfen.",
      "Weitere genannte Arten: Aal, Regenbogenforelle und Weißfisch.",
      "Der Ausgangspunkt im Ort bedeutet einen längeren Fußweg zur Vorsperre."
    ],
    parkings: [
      { id: "TR-P1", name: "Parkplatz Dorfgemeinschaftshaus Trautenstein", latitude: 51.6879, longitude: 10.7788, access: "public", accuracy: "approx", note: "Öffentlicher Ausgangspunkt im Ort; längerer Fußweg zur Vorsperre. Position und Parkregeln prüfen." }
    ],
    spots: [
      { id: "TR-E1", name: "Vorsperrdamm Rappbode – Erkundung", latitude: 51.704148, longitude: 10.790162, parkingId: "TR-P1", tags: ["Staumauer", "Erkundung"], source: "Gewässerkoordinate und öffentlich beschriebener Rundweg ab Trautenstein.", risk: "Kein ausgewiesener Angel-Hotspot; Schutzbereiche, Beschilderung und tatsächlichen Uferzugang prüfen." }
    ],
    sourceStatus: "verified"
  },

  "vorsperre-hassel-hasselfelde": {
    name: "Vorsperre Hassel – Hasselfelde",
    latitude: 51.706111,
    longitude: 10.830278,
    areaHa: "25.00",
    fish: ["Zander", "Barsch", "Hecht", "Karpfen", "Schleie"],
    rating: {
      Zander: 4,
      Barsch: 4,
      Hecht: 4,
      Karpfen: 3,
      Schleie: 3
    },
    notes: [
      "Aktuelle Gewässerordnung, Trinkwasser- und Schutzregeln prüfen.",
      "Weitere genannte Arten: Aal und Weißfisch.",
      "Vom Wanderparkplatz bis zur Staumauer ist ein längerer Fußweg einzuplanen."
    ],
    parkings: [
      { id: "HA-P1", name: "Wanderparkplatz Hagenmühle / Hasselvorsperre", latitude: 51.697893, longitude: 10.843684, access: "public", accuracy: "approx", note: "Öffentlich dokumentierter Wander- und Ausgangspunkt; Parkregeln vor Ort beachten." }
    ],
    spots: [
      { id: "HA-E1", name: "Hasselvorsperre – Staumauerbereich", latitude: 51.706111, longitude: 10.830278, parkingId: "HA-P1", tags: ["Staumauer", "Erkundung"], source: "Öffentlich beschriebener Rundweg vom Wanderparkplatz zur Staumauer.", risk: "Etwa 3 km Fußweg; technische Bereiche, Trinkwasserschutz und Beschilderung beachten." },
      { id: "HA-E2", name: "Hasselvorsperre – rechtes Ufer", latitude: 51.7019, longitude: 10.8370, parkingId: "HA-P1", tags: ["Ufer", "Erkundung"], source: "Näherungsweise entlang des beschriebenen Rundwegs.", risk: "Kein bestätigter Angelplatz; Uferzugang und Schutzregeln vor Ort prüfen." }
    ],
    sourceStatus: "verified"
  },

  "ueberleitungssperre-koenigshuette": {
    name: "Überleitungssperre Königshütte – Trogfurther Brücke",
    latitude: 51.738611,
    longitude: 10.793333,
    areaHa: "32.00",
    fish: ["Zander", "Barsch", "Hecht", "Forelle", "Karpfen", "Schleie"],
    rating: {
      Zander: 4,
      Barsch: 4,
      Hecht: 4,
      Forelle: 4,
      Karpfen: 3,
      Schleie: 3
    },
    notes: [
      "Aktuelle Gewässerordnung sowie technische und örtliche Sperrbereiche prüfen.",
      "Weitere genannte Arten: Aal, Regenbogenforelle und Weißfisch.",
      "Vom Parkplatz Tanner Straße ist ein mehrkilometriger Fußweg möglich."
    ],
    parkings: [
      { id: "KO-P1", name: "Wanderparkplatz Tanner Straße / L98", latitude: 51.738729, longitude: 10.764647, access: "public", accuracy: "verified", note: "Kostenlose Parkflächen am südlichen Ortsausgang Königshütte Richtung Tanne." }
    ],
    spots: [
      { id: "KO-E1", name: "Trogfurther Brücke – Staumauer", latitude: 51.738611, longitude: 10.793333, parkingId: "KO-P1", tags: ["Staumauer", "Erkundung"], source: "Öffentlich beschriebener Rundweg vom Parkplatz Tanner Straße.", risk: "Mehrkilometriger Fußweg; technische Anlagen und örtliche Sperrbereiche beachten." },
      { id: "KO-E2", name: "Königshütter Talsperre – westliches Ufer", latitude: 51.7390, longitude: 10.7820, parkingId: "KO-P1", tags: ["Ufer", "Erkundung"], source: "Näherungsweise entlang des öffentlichen Rundwegs.", risk: "Kein bestätigter Angelplatz; Wege- und Uferzugang vor Ort prüfen." }
    ],
    sourceStatus: "verified"
  },

  "hwr-kalte-bode-mandelholz": {
    name: "HWR Kalte Bode – Mandelholz",
    latitude: 51.745556,
    longitude: 10.736389,
    fish: ["Zander", "Barsch", "Hecht", "Forelle", "Karpfen", "Schleie"],
    rating: {
      Zander: 4,
      Barsch: 4,
      Hecht: 4,
      Forelle: 4,
      Karpfen: 3,
      Schleie: 3
    },
    notes: [
      "Aktuelle Gewässerordnung und örtliche Schutzregeln prüfen.",
      "Weitere genannte Arten: Aal, Regenbogenforelle und Weißfisch.",
      "Als Hochwasserrückhaltebecken können Wasserstand, Zugänglichkeit und Sperrungen stark wechseln."
    ],
    parkings: [
      { id: "MA-P1", name: "Parkplatz Mandelholz / Hotel Grüne Tanne", latitude: 51.7434, longitude: 10.7236, access: "public", accuracy: "approx", note: "Öffentlich beschriebener Parkplatz gegenüber dem Hotel; Nutzungs- und Parkregeln vor Ort beachten." }
    ],
    spots: [
      { id: "MA-E1", name: "Mandelholz – westlicher Zugang zur Kalten Bode", latitude: 51.7444, longitude: 10.7290, parkingId: "MA-P1", tags: ["Zugang", "Erkundung"], source: "Näherungsweise vom beschriebenen Parkplatz in Richtung Staubecken.", risk: "Wasserstand und Uferzugang können stark schwanken; Schutz- und Hochwasserhinweise beachten." },
      { id: "MA-E2", name: "Mandelholztalsperre – Dammnähe", latitude: 51.745556, longitude: 10.736389, parkingId: "MA-P1", tags: ["Staudamm", "Erkundung"], source: "Koordinate des Hochwasserschutzbeckens; Zugang zu Fuß vor Ort prüfen.", risk: "Technische Anlage; mögliche Sperrbereiche und wechselnde Wasserstände beachten." }
    ],
    sourceStatus: "verified"
  },

  "wendefurther-talsperre": {
    name: "Talsperre Wendefurth",
    latitude: 51.7385,
    longitude: 10.9255,
    fish: ["Zander", "Barsch", "Hecht", "Forelle", "Karpfen", "Schleie"],
    rating: {
      Zander: 4,
      Barsch: 4,
      Hecht: 4,
      Forelle: 4,
      Karpfen: 3,
      Schleie: 3
    },
    notes: [
      "Aktuelle Gewässerordnung und Angelberechtigung prüfen.",
      "Weitere genannte Arten: Aal, Regenbogenforelle und Weißfisch.",
      "Bootsangeln nur auf Wendefurth und nur unter den jeweils aktuellen Bedingungen des Bootsverleihers.",
      "Betriebsflächen, Bootsverkehr und technische Sperrbereiche berücksichtigen."
    ],
    parkings: [
      { id: "WE-P1", name: "Parkplatz Bootsverleih / Seeterrasse Wendefurth", latitude: 51.740433, longitude: 10.918291, access: "public", accuracy: "verified", note: "Öffentlich erreichbarer Ausgangspunkt Am Stausee 2; Öffnungszeiten und Parkbeschilderung beachten." },
      { id: "WE-P2", name: "Parkplatz nahe Rappbode-Staumauer", latitude: 51.743033, longitude: 10.897782, access: "public", accuracy: "approx", note: "Aus Vorversion übernommener Ausgangspunkt; genaue Parkfläche und Beschilderung prüfen." }
    ],
    spots: [
      { id: "WE-E1", name: "Wendefurth – Ufer am Bootsverleih", latitude: 51.74029, longitude: 10.91528, parkingId: "WE-P1", tags: ["Ufer", "Bootsverleih", "Erkundung"], source: "Öffentlich dokumentierter Bootsverleih und Seezugang.", risk: "Betriebsflächen und Bootsverkehr berücksichtigen; Angel- und Bootsregeln aktuell prüfen." },
      { id: "WE-E2", name: "Wendefurth – Ufer nahe Rappbode-Staumauer", latitude: 51.736270, longitude: 10.901098, parkingId: "WE-P2", tags: ["Staumauer", "Erkundung"], source: "Aus vorhandener Merkblattkarte näherungsweise am Ufer abgeleitet.", risk: "Technische Sperrbereiche und örtliche Schilder beachten." }
    ],
    sourceStatus: "verified"
  }
};
