import type { Fish, FishingWater } from "@/lib/types";
import { targetFishRating, waterHasTargetFish } from "@/lib/fish";

export type ForecastHour = { time:string; temperature:number; precipitation:number; precipitationProbability:number; cloudCover:number; pressure:number; windSpeed:number; windDirection:number; isDay:number; sunrise:string; sunset:string; pressureTrend:number };
export type ScoreResult = { score:number; reasons:string[]; waterTemperature:number; dayPhase:string; moonPhase:string };

const profiles: Record<Fish,{lowLight:number; clouds:number; rain:number; wind:number; fallingPressure:number; temp:[number,number]}> = {
 Aal:{lowLight:18,clouds:5,rain:8,wind:4,fallingPressure:5,temp:[15,25]},
 Zander:{lowLight:18,clouds:10,rain:5,wind:8,fallingPressure:10,temp:[14,22]},
 Barsch:{lowLight:8,clouds:6,rain:2,wind:8,fallingPressure:4,temp:[12,22]},
 Blei:{lowLight:8,clouds:4,rain:4,wind:4,fallingPressure:4,temp:[14,24]},
 Forelle:{lowLight:8,clouds:7,rain:5,wind:5,fallingPressure:3,temp:[7,16]},
 Schleie:{lowLight:10,clouds:4,rain:4,wind:4,fallingPressure:5,temp:[16,24]},
 Hecht:{lowLight:8,clouds:9,rain:3,wind:8,fallingPressure:6,temp:[8,18]},
 Karpfen:{lowLight:6,clouds:3,rain:4,wind:6,fallingPressure:4,temp:[18,26]},
 Plötze:{lowLight:6,clouds:4,rain:2,wind:5,fallingPressure:3,temp:[10,22]},
 Rotfeder:{lowLight:7,clouds:3,rain:2,wind:4,fallingPressure:3,temp:[14,24]}
};
function moonInfo(date:Date){const syn=29.53058867; const known=Date.UTC(2000,0,6,18,14); const age=((((date.getTime()-known)/86400000)%syn)+syn)%syn; const phase=age<1.85||age>27.7?'Neumond':age<7.38?'zunehmend':age<9.23?'erstes Viertel':age<14.77?'zunehmend':age<16.61?'Vollmond':age<22.15?'abnehmend':age<24?'letztes Viertel':'abnehmend'; return {age,phase};}
function estimateWaterTemp(hour:ForecastHour){const month=new Date(hour.time).getMonth()+1; const seasonal=[4,4,6,9,13,17,20,21,18,13,8,5][month-1]; return Math.max(2,Math.min(27,seasonal*.7+hour.temperature*.3));}
export function calculateAutomaticFishingScore(water:FishingWater, fish:Fish, hour:ForecastHour):ScoreResult {
 if(!waterHasTargetFish(water, fish)) return {score:0,reasons:[],waterTemperature:0,dayPhase:'',moonPhase:''};
 const p=profiles[fish]; let score=42 + targetFishRating(water, fish)*4; const reasons:string[]=[];
 const d=new Date(hour.time); const h=d.getHours(); const low=h<=7||h>=19||hour.isDay===0;
 if(low){score+=p.lowLight; reasons.push('Dämmerung/Nacht günstig');}
 if(hour.cloudCover>=60){score+=p.clouds; reasons.push(`${Math.round(hour.cloudCover)} % Bewölkung`);}
 if(hour.windSpeed>=6&&hour.windSpeed<=22){score+=p.wind; reasons.push(`${Math.round(hour.windSpeed)} km/h Wind`);} else if(hour.windSpeed>32){score-=10; reasons.push('starker Wind');}
 if(hour.precipitation>0&&hour.precipitation<4){score+=p.rain; reasons.push('leichter Niederschlag');} else if(hour.precipitation>=8){score-=8; reasons.push('starker Niederschlag');}
 if(hour.pressureTrend<=-1.5){score+=p.fallingPressure; reasons.push('Luftdruck fällt');} else if(hour.pressureTrend>=2){score-=4; reasons.push('Luftdruck steigt deutlich');}
 const wt=estimateWaterTemp(hour); if(wt>=p.temp[0]&&wt<=p.temp[1]){score+=8; reasons.push(`Wasser ~${wt.toFixed(0)} °C günstig`);} else score-=5;
 const moon=moonInfo(d); if((moon.age<2||moon.age>27.5||Math.abs(moon.age-14.77)<2)&&fish==='Zander'){score+=2; reasons.push(`${moon.phase} kleiner Bonus`);}
 const dayPhase=hour.isDay===0?'Nacht':(h<=8?'Morgen':h>=18?'Abend':'Tag');
 return {score:Math.max(0,Math.min(100,Math.round(score))),reasons,waterTemperature:wt,dayPhase,moonPhase:moon.phase};
}
