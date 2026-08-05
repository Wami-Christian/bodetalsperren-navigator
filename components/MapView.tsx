"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { FishingSpot, FishingWater, ParkingSpot } from "@/lib/types";

const waterIcon = L.divIcon({ className: "water-marker", html: "<span>🎣</span>", iconSize: [36, 36], iconAnchor: [18, 18] });
const spotIcon = L.divIcon({ className: "spot-marker", html: "<span>📍</span>", iconSize: [30, 30], iconAnchor: [15, 30] });
const parkingIcon = L.divIcon({ className: "parking-marker", html: "<span>🅿️</span>", iconSize: [30, 30], iconAnchor: [15, 30] });

function FitMarkers({ waters, spots, parkings }: { waters: FishingWater[]; spots: FishingSpot[]; parkings: ParkingSpot[] }) {
  const map = useMap();
  useEffect(() => {
    const coordinates: [number, number][] = [
      ...waters.filter((w) => w.latitude !== null && w.longitude !== null).map((w) => [w.latitude!, w.longitude!] as [number, number]),
      ...spots.map((s) => [s.latitude, s.longitude] as [number, number]),
      ...parkings.map((p) => [p.latitude, p.longitude] as [number, number])
    ];
    if (!coordinates.length) return;
    if (coordinates.length === 1) map.setView(coordinates[0], 13);
    else map.fitBounds(L.latLngBounds(coordinates), { padding: [40, 40] });
  }, [map, waters, spots, parkings]);
  return null;
}

export default function MapView({ waters, spots, parkings, onSelect }: { waters: FishingWater[]; spots: FishingSpot[]; parkings: ParkingSpot[]; onSelect: (water: FishingWater) => void }) {
  const mappedWaters = waters.filter((w) => w.latitude !== null && w.longitude !== null);
  return (
    <MapContainer center={[51.72, 11.1]} zoom={9} scrollWheelZoom className="map">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitMarkers waters={mappedWaters} spots={spots} parkings={parkings} />
      {mappedWaters.map((water) => (
        <Marker key={water.id} position={[water.latitude!, water.longitude!]} icon={waterIcon} eventHandlers={{ click: () => onSelect(water) }}>
          <Popup><strong>{water.name}</strong><br />{water.module}<br />{water.fish.join(" · ") || "Fischarten im Profil"}</Popup>
        </Marker>
      ))}
      {parkings.map((parking) => (
        <Marker key={`parking-${parking.id}`} position={[parking.latitude, parking.longitude]} icon={parkingIcon}>
          <Popup><strong>{parking.name}</strong><br />{parking.access === "public" ? "Öffentlicher Parkplatz" : "Eingeschränkter Ausgangspunkt"}</Popup>
        </Marker>
      ))}
      {spots.map((spot) => (
        <Marker key={spot.id} position={[spot.latitude, spot.longitude]} icon={spotIcon}>
          <Popup><strong>{spot.name}</strong><br />{spot.tags.join(" · ")}<br />{spot.risk ?? spot.note}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
