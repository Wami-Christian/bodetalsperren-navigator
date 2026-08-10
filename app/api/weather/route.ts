import { NextRequest, NextResponse } from "next/server";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const lat=Number(request.nextUrl.searchParams.get("lat")), lon=Number(request.nextUrl.searchParams.get("lon"));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)) return NextResponse.json({error:"Ungültige Koordinaten"},{status:400});
 const u=new URL("https://api.open-meteo.com/v1/forecast");
 u.searchParams.set("latitude",String(lat));u.searchParams.set("longitude",String(lon));u.searchParams.set("timezone","Europe/Berlin");u.searchParams.set("forecast_days","16");
 u.searchParams.set("hourly","temperature_2m,precipitation,precipitation_probability,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,is_day");u.searchParams.set("daily","sunrise,sunset");
 const r=await fetch(u,{next:{revalidate:1800}}); if(!r.ok) return NextResponse.json({error:"Wetterdienst nicht erreichbar"},{status:502}); const x=await r.json();
 const daily=new Map<string,{sunrise:string;sunset:string}>(); (x.daily?.time||[]).forEach((d:string,i:number)=>daily.set(d,{sunrise:x.daily.sunrise[i],sunset:x.daily.sunset[i]}));
 const hours=(x.hourly?.time||[]).map((time:string,i:number)=>{const day=daily.get(time.slice(0,10)); const prev=i>=6?x.hourly.pressure_msl[i-6]:x.hourly.pressure_msl[i]; return {time,temperature:x.hourly.temperature_2m[i],precipitation:x.hourly.precipitation[i],precipitationProbability:x.hourly.precipitation_probability[i]??0,cloudCover:x.hourly.cloud_cover[i],pressure:x.hourly.pressure_msl[i],windSpeed:x.hourly.wind_speed_10m[i],windDirection:x.hourly.wind_direction_10m[i],isDay:x.hourly.is_day[i],sunrise:day?.sunrise??"",sunset:day?.sunset??"",pressureTrend:x.hourly.pressure_msl[i]-prev};});
 return NextResponse.json({hours},{headers:{"Cache-Control":"public, s-maxage=1800, stale-while-revalidate=3600"}});
}
