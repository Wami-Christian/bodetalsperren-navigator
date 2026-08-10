// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { FishingSpot, FishingWater, ParkingSpot } from "@/lib/types";
import { waterTargetFish } from "@/lib/fish";

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
  selectedWater,
  onSelect
}: {
  waters: FishingWater[];
  spots: FishingSpot[];
  parkings: ParkingSpot[];
  selectedWater: FishingWater | null;
  onSelect: (water: FishingWater) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const selectRef = useRef(onSelect);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;

    const map = L.map(hostRef.current, {
      center: DEFAULT_CENTER,
      zoom: 9,
      scrollWheelZoom: true,
      zoomControl: false
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resize = window.setTimeout(() => map.invalidateSize(), 100);

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

      const coordinate: L.LatLngExpression = [
        water.latitude,
        water.longitude
      ];

      bounds.push(coordinate);

      L.marker(coordinate, { icon: waterIcon })
        .bindPopup(
          `<strong>${water.name}</strong><br>${water.module}<br>${
            waterTargetFish(water).join(" · ") || "Fischarten im Profil"
          }`
        )
        .on("click", () => selectRef.current(water))
        .addTo(layer);
    });

    parkings.forEach((parking) => {
      const coordinate: L.LatLngExpression = [
        parking.latitude,
        parking.longitude
      ];

      bounds.push(coordinate);

      const parkingLabel =
        parking.access === "public"
          ? "Öffentlicher Parkplatz"
          : "Eingeschränkter Ausgangspunkt";

      const routeUrl =
        `https://www.google.com/maps/dir/?api=1&destination=` +
        `${parking.latitude},${parking.longitude}&travelmode=driving`;

      L.marker(coordinate, { icon: parkingIcon })
        .bindPopup(
          `<strong>${parking.name}</strong><br>${parkingLabel}` +
          `<br><a href="${routeUrl}" target="_blank" rel="noreferrer">` +
          `Auto-Navigation öffnen</a>`
        )
        .addTo(layer);
    });

    spots.forEach((spot) => {
      const coordinate: L.LatLngExpression = [
        spot.latitude,
        spot.longitude
      ];

      bounds.push(coordinate);

      L.marker(coordinate, { icon: spotIcon })
        .bindPopup(
          `<strong>${spot.name}</strong><br>${spot.tags.join(" · ")}` +
          `<br>${spot.risk ?? spot.note ?? "Zugang prüfen"}`
        )
        .addTo(layer);
    });

    if (
      selectedWater &&
      selectedWater.latitude !== null &&
      selectedWater.longitude !== null
    ) {
      const center: L.LatLngExpression = [
        selectedWater.latitude,
        selectedWater.longitude
      ];

      if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds), {
          padding: [55, 55],
          maxZoom: 15,
          animate: true
        });
      } else {
        map.flyTo(center, 14, {
          animate: true,
          duration: 0.8
        });
      }

      window.setTimeout(() => map.invalidateSize(), 50);
      return;
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], 12);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), {
        padding: [40, 40],
        maxZoom: 10
      });
    } else {
      map.setView(DEFAULT_CENTER, 9);
    }
  }, [waters, spots, parkings, selectedWater?.id]);

  useEffect(() => {
    window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 80);
  }, [isFullscreen]);

  function zoomIn() {
    mapRef.current?.zoomIn();
  }

  function zoomOut() {
    mapRef.current?.zoomOut();
  }

  function toggleFullscreen() {
    setIsFullscreen((value) => !value);
  }

  return (
    <div
      className={
        isFullscreen
          ? "map-shell map-shell-fullscreen"
          : "map-shell"
      }
    >
      <div
        ref={hostRef}
        className="map"
        role="application"
        aria-label="Interaktive Gewässerkarte"
      />

      <div className="map-zoom-controls" aria-label="Kartenzoom">
        <button
          type="button"
          onClick={zoomIn}
          aria-label="Karte vergrößern"
        >
          +
        </button>
        <button
          type="button"
          onClick={zoomOut}
          aria-label="Karte verkleinern"
        >
          −
        </button>
      </div>

      {!isFullscreen && (
        <button
          type="button"
          className="map-fullscreen-button"
          onClick={toggleFullscreen}
          aria-label="Karte in Gesamtansicht öffnen"
          title="Gesamtansicht"
        >
          <span aria-hidden="true">⛶</span>
        </button>
      )}

      {isFullscreen && (
        <button
          type="button"
          className="map-fullscreen-close"
          onClick={() => setIsFullscreen(false)}
          aria-label="Gesamtansicht schließen"
          title="Gesamtansicht schließen"
        >
          <span aria-hidden="true">✕</span>
          <strong>Schließen</strong>
        </button>
      )}
    </div>
  );
}
