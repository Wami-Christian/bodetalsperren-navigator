export type CatchActivity = {
  species: string;
  waterName: string;
  lavNumber: string;
  provider: string;
  url: string;
  totalReports?: number;
  speciesReports?: number;
  speciesRank?: number;
  activityLabel: "sehr hoch" | "hoch" | "mittel" | "gering";
  observedAt: string;
  confidence: number;
  quality: "E";
};

export const catchActivity: CatchActivity[] = [
  {species:"Zander",waterName:"Elbe und Alte Elbe",lavNumber:"13-280-23",provider:"ALLE ANGELN",url:"https://www.alleangeln.de/gewaesser/elbe-magdeburg",totalReports:3727,speciesRank:1,activityLabel:"sehr hoch",observedAt:"2026-08-11",confidence:.85,quality:"E"},
  {species:"Zander",waterName:"Industriehafen Magdeburg",lavNumber:"13-280-05",provider:"ALLE ANGELN",url:"https://www.alleangeln.de/gewaesser/industriehafen-magdeburg",speciesRank:1,activityLabel:"hoch",observedAt:"2026-08-11",confidence:.90,quality:"E"},
  {species:"Zander",waterName:"Elbe von km 305 - km 320 beidseitig",lavNumber:"6-400-22",provider:"ALLE ANGELN",url:"https://www.alleangeln.de/gewaesser/elbe-sch%C3%B6nebeck",totalReports:998,speciesRank:1,activityLabel:"sehr hoch",observedAt:"2026-08-11",confidence:.85,quality:"E"},
  {species:"Zander",waterName:"Elbe km 334-350 beidseitig",lavNumber:"4-130-18",provider:"ALLE ANGELN",url:"https://www.alleangeln.de/gewaesser/elbe-hohenwarthe",totalReports:504,speciesRank:1,activityLabel:"hoch",observedAt:"2026-08-11",confidence:.80,quality:"E"},
  {species:"Zander",waterName:"Elbe-Havel-Kanal km 326, 67- km 344",lavNumber:"4-130-15",provider:"ALLE ANGELN",url:"https://www.alleangeln.de/gewaesser/elbe-havel-kanal-niegripp",speciesRank:1,activityLabel:"hoch",observedAt:"2026-08-11",confidence:.80,quality:"E"},
  {species:"Zander",waterName:"Saale von Straßenbrücke B 91",lavNumber:"14-210-16",provider:"ALLE ANGELN",url:"https://www.alleangeln.de/gewaesser/saale-halle-saale",totalReports:2335,activityLabel:"mittel",observedAt:"2026-08-11",confidence:.65,quality:"E"},
  {species:"Zander",waterName:"Saale von Kreisgrenze Saalekreis bis",lavNumber:"6-110-14",provider:"ALLE ANGELN",url:"https://www.alleangeln.de/gewaesser/saale-alsleben-saale",activityLabel:"hoch",observedAt:"2026-08-11",confidence:.75,quality:"E"}
];
