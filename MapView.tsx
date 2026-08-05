"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { FishingWater } from "@/lib/types";

const markerIcon = L.divIcon({
  className: "water-marker",
  html: "<span>🎣</span>",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function FitMarkers({ waters }: { waters: FishingWater[] }) {
  const map = useMap();

  useEffect(() => {
    if (!waters.length) return;
    if (waters.length === 1) {
      map.setView([waters[0].latitude, waters[0].longitude], 13);
      return;
    }
    const bounds = L.latLngBounds(waters.map((water) => [water.latitude, water.longitude]));
    map.fitBounds(bounds, { padding: [42, 42] });
  }, [map, waters]);

  return null;
}

export default function MapView({
  waters,
  onSelect,
}: {
  waters: FishingWater[];
  onSelect: (water: FishingWater) => void;
}) {
  return (
    <MapContainer center={[51.72, 11.23]} zoom={10} scrollWheelZoom className="map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitMarkers waters={waters} />
      {waters.map((water) => (
        <Marker
          key={water.id}
          position={[water.latitude, water.longitude]}
          icon={markerIcon}
          eventHandlers={{ click: () => onSelect(water) }}
          title={water.name}
        >
          <Popup>
            <strong>{water.name}</strong><br />
            {water.fish.join(" · ")}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
