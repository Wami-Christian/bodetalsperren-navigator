import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "HarzFishing Navigator",
  description: "Gewässer, Fangbuch, Angelprognose und GPX für den Harz.",
  manifest: "/manifest.webmanifest"
};
export const viewport: Viewport = { themeColor: "#0d4d43", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}<script dangerouslySetInnerHTML={{__html:`if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}`}} /></body></html>;
}
