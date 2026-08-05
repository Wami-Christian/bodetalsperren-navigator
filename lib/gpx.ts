import type { FishingSpot } from "@/lib/types";

export function spotsToGpx(name: string, spots: FishingSpot[]) {
  const points = spots.map((spot) =>
    `<wpt lat="${spot.latitude}" lon="${spot.longitude}"><name>${escapeXml(spot.name)}</name><desc>${escapeXml(spot.note ?? spot.tags.join(", "))}</desc></wpt>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="HarzFishing Navigator" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${escapeXml(name)}</name></metadata>${points}</gpx>`;
}

export function parseGpx(text: string): FishingSpot[] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  return Array.from(doc.querySelectorAll("wpt")).map((node, index) => ({
    id: `import-${Date.now()}-${index}`,
    name: node.querySelector("name")?.textContent?.trim() || `Importierter Punkt ${index + 1}`,
    latitude: Number(node.getAttribute("lat")),
    longitude: Number(node.getAttribute("lon")),
    tags: ["GPX-Import"],
    note: node.querySelector("desc")?.textContent?.trim() || undefined
  })).filter((spot) => Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude));
}

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[char] ?? char));
}
