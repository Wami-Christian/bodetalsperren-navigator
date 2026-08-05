// @ts-nocheck
"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { FishingSpot, FishingWater, ParkingSpot } from "@/lib/types";

const DEFAULT_CENTER: L.LatLngExpression = [51.72, 11.1];

function markerIcon(symbol: string, className: string) {
  return L.divIcon({
    className,
    html: `<span aria-hidden="true">${symbol}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 30],
    popupAnchor: [0, -28]
  });
}

const waterIcon = markerIcon("🎣", "water-marker");
const spotIcon = markerIcon("📍", "spot-marker");
const parkingIcon = markerIcon("🅿️", "parking-marker");

export default function MapView({
  waters,
  spots,
  parkings,
  onSelect
}: {
  waters: FishingWater[];
  spots: FishingSpot[];
  parkings: ParkingSpot[];
  onSelect: (water: FishingWater) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;

    const map = L.map(hostRef.current, {
      center: DEFAULT_CENTER,
      zoom: 9,
      scrollWheelZoom: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;

    const resize = window.setTimeout(() => map.invalidateSize(), 50);
    return () => {
      window.clearTimeout(resize);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    waters.forEach((water) => {
      if (water.latitude === null || water.longitude === null) return;
      const coordinate: L.LatLngExpression = [water.latitude, water.longitude];
      bounds.push(coordinate);
      const marker = L.marker(coordinate, { icon: waterIcon })
        .bindPopup(`<strong>${water.name}</strong><br>${water.module}<br>${water.fish.join(" · ") || "Fischarten im Profil"}`)
        .on("click", () => onSelect(water));
      marker.addTo(layer);
    });

    parkings.forEach((parking) => {
      const coordinate: L.LatLngExpression = [parking.latitude, parking.longitude];
      bounds.push(coordinate);
      L.marker(coordinate, { icon: parkingIcon })
        .bindPopup(`<strong>${parking.name}</strong><br>${parking.access === "public" ? "Öffentlicher Parkplatz" : "Eingeschränkter Ausgangspunkt"}`)
        .addTo(layer);
    });

    spots.forEach((spot) => {
      const coordinate: L.LatLngExpression = [spot.latitude, spot.longitude];
      bounds.push(coordinate);
      L.marker(coordinate, { icon: spotIcon })
        .bindPopup(`<strong>${spot.name}</strong><br>${spot.tags.join(" · ")}<br>${spot.risk ?? spot.note ?? "Zugang prüfen"}`)
        .addTo(layer);
    });

    if (bounds.length === 1) map.setView(bounds[0], 13);
    else if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13 });
  }, [waters, spots, parkings, onSelect]);

  return <div ref={hostRef} className="map" role="application" aria-label="Interaktive Gewässerkarte" />;
}
