// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { FishingSpot, FishingWater, ParkingSpot } from "@/lib/types";
import { waterTargetFish } from "@/lib/fish";
import { elbeOrientationPoints, elbeRestrictionOverlays } from "@/data/elbe-segments";

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
const warningIcon = markerIcon("⚠️", "spot-marker");
const lockIcon = markerIcon("🔒", "spot-marker");

const ELBE_OSM_GEOJSON_URL = "/api/elbe-geometry";
const SAALE_OSM_GEOJSON_URL = "/api/saale-geometry";
const WATERWAY_ENDPOINTS: Record<string, string> = {
  Bode: "/api/bode-geometry",
  Selke: "/api/selke-geometry",
  Mulde: "/api/mulde-geometry",
  Unstrut: "/api/unstrut-geometry",
  Mittellandkanal: "/api/mittellandkanal-geometry",
  "Elbe-Havel-Kanal": "/api/elbe-havel-kanal-geometry",
  Wipper: "/api/wipper-geometry",
  Helme: "/api/helme-geometry",
  Ohre: "/api/ohre-geometry",
  Jeetze: "/api/jeetze-geometry",
  Fuhne: "/api/fuhne-geometry",
  "Wilhelmskanal": "/api/waterway-geometry?name=Wilhelmskanal",
  "Secantsgraben": "/api/waterway-geometry?name=Secantsgraben",
  "Dollgraben": "/api/waterway-geometry?name=Dollgraben",
  "Niegripper Verbindungskanal": "/api/waterway-geometry?name=Niegripper Verbindungskanal",
  "Niegripper Altkanal": "/api/waterway-geometry?name=Niegripper Altkanal",
  "Pareyer Verbindungskanal": "/api/waterway-geometry?name=Pareyer Verbindungskanal",
  "Hauptseegraben": "/api/waterway-geometry?name=Hauptseegraben",
  "Saalealtarm Aderstedt": "/api/waterway-geometry?name=Saalealtarm Aderstedt",
  "Lober-Leine-Kanal": "/api/waterway-geometry?name=Lober-Leine-Kanal",
  "Fließgraben": "/api/waterway-geometry?name=Fließgraben",
  "Neugraben": "/api/waterway-geometry?name=Neugraben",
  "Rothenseer Verbindungskanal": "/api/waterway-geometry?name=Rothenseer Verbindungskanal",
  "Secantsgraben": "/api/waterway-geometry?name=Secantsgraben",
  "Landgraben (1. Wiesengraben)": "/api/waterway-geometry?name=Landgraben (1. Wiesengraben)",
  "Altarm Baggerelbe": "/api/waterway-geometry?name=Altarm Baggerelbe",
  "Kapengraben": "/api/waterway-geometry?name=Kapengraben",
  "Schweinitzer Fließ": "/api/waterway-geometry?name=Schweinitzer Fließ",
  "Alte Mulde Roitzschjora": "/api/waterway-geometry?name=Alte Mulde Roitzschjora",
  "Alte Mulde": "/api/waterway-geometry?name=Alte Mulde",
  "Saale-Leipzig-Kanal": "/api/waterway-geometry?name=Saale-Leipzig-Kanal",
};

const LOCAL_WATERWAY_GEOMETRY: Record<string, string> = {
  Elbe: "/osm-geometries/elbe.geojson",
  Saale: "/osm-geometries/saale.geojson",
  Bode: "/osm-geometries/bode.geojson",
  Selke: "/osm-geometries/selke.geojson",
  Mulde: "/osm-geometries/mulde.geojson",
  Unstrut: "/osm-geometries/unstrut.geojson",
  Mittellandkanal: "/osm-geometries/mittellandkanal.geojson",
  "Elbe-Havel-Kanal": "/osm-geometries/elbe-havel-kanal.geojson",
  Wipper: "/osm-geometries/wipper.geojson",
  Helme: "/osm-geometries/helme.geojson",
  Ohre: "/osm-geometries/ohre.geojson",
  Jeetze: "/osm-geometries/jeetze.geojson",
  Fuhne: "/osm-geometries/fuhne.geojson",
  "Wilhelmskanal": "/osm-geometries/wilhelmskanal.geojson",
  "Secantsgraben": "/osm-geometries/secantsgraben.geojson",
  "Dollgraben": "/osm-geometries/dollgraben.geojson",
  "Niegripper Verbindungskanal": "/osm-geometries/niegripper-verbindungskanal.geojson",
  "Niegripper Altkanal": "/osm-geometries/niegripper-altkanal.geojson",
  "Pareyer Verbindungskanal": "/osm-geometries/pareyer-verbindungskanal.geojson",
  "Hauptseegraben": "/osm-geometries/hauptseegraben.geojson",
  "Saalealtarm Aderstedt": "/osm-geometries/saalealtarm-aderstedt.geojson",
  "Lober-Leine-Kanal": "/osm-geometries/lober-leine.geojson",
  "Fließgraben": "/osm-geometries/fliegraben.geojson",
  "Neugraben": "/osm-geometries/neugraben.geojson",
  "Rothenseer Verbindungskanal": "/osm-geometries/rothenseer-verbindungskanal.geojson",
  "Secantsgraben": "/osm-geometries/secantsgraben.geojson",
  "Landgraben (1. Wiesengraben)": "/osm-geometries/landgraben.geojson",
  "Altarm Baggerelbe": "/osm-geometries/baggerelbe-waterarea.geojson",
  "Kapengraben": "/osm-geometries/kapengraben.geojson",
  "Schweinitzer Fließ": "/osm-geometries/schweinitzer-flie.geojson",
  "Alte Mulde Roitzschjora": "/osm-geometries/alte-mulde-roitzschjora.geojson",
  "Alte Mulde": "/osm-geometries/alte-mulde.geojson",
  "Saale-Leipzig-Kanal": "/osm-geometries/saale-leipzig-kanal.geojson",
};

type LatLngTuple = [number, number];

function geoJsonLineCandidates(data: any): LatLngTuple[][] {
  const lines: LatLngTuple[][] = [];

  const addGeometry = (geometry: any) => {
    if (!geometry) return;
    if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
      lines.push(geometry.coordinates.map((p: number[]) => [p[1], p[0]] as LatLngTuple));
      return;
    }
    if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) {
      geometry.coordinates.forEach((line: number[][]) =>
        lines.push(line.map((p: number[]) => [p[1], p[0]] as LatLngTuple))
      );
      return;
    }

    // OSM-Altarme und ähnliche Gewässer sind häufig als natural=water Polygon
    // statt als waterway=*-Linie gespeichert. Für die LAV-Darstellung verwenden
    // wir die Außenkontur als echte, lokal aus dem PBF stammende Geometrie.
    if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
      const outerRing = geometry.coordinates[0];
      if (Array.isArray(outerRing)) {
        lines.push(outerRing.map((p: number[]) => [p[1], p[0]] as LatLngTuple));
      }
      return;
    }

    if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
      geometry.coordinates.forEach((polygon: number[][][]) => {
        const outerRing = polygon?.[0];
        if (Array.isArray(outerRing)) {
          lines.push(outerRing.map((p: number[]) => [p[1], p[0]] as LatLngTuple));
        }
      });
      return;
    }

    if (geometry.type === "GeometryCollection") {
      geometry.geometries?.forEach(addGeometry);
    }
  };

  if (data?.type === "FeatureCollection") {
    data.features?.forEach((feature: any) => addGeometry(feature.geometry));
  } else if (data?.type === "Feature") {
    addGeometry(data.geometry);
  } else {
    addGeometry(data);
  }

  return lines.filter((line) => line.length >= 2);
}

function distanceKm(a: LatLngTuple, b: LatLngTuple) {
  const latScale = 111.32;
  const lonScale = 111.32 * Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180);
  const dy = (a[0] - b[0]) * latScale;
  const dx = (a[1] - b[1]) * lonScale;
  return Math.sqrt(dx * dx + dy * dy);
}

function pointToSegmentDistanceKm(point: LatLngTuple, a: LatLngTuple, b: LatLngTuple) {
  const refLat = ((point[0] + a[0] + b[0]) / 3) * Math.PI / 180;
  const xScale = 111.32 * Math.cos(refLat);
  const yScale = 111.32;
  const px = point[1] * xScale;
  const py = point[0] * yScale;
  const ax = a[1] * xScale;
  const ay = a[0] * yScale;
  const bx = b[1] * xScale;
  const by = b[0] * yScale;
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const length2 = vx * vx + vy * vy;
  const t = length2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / length2)) : 0;
  const dx = px - (ax + t * vx);
  const dy = py - (ay + t * vy);
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToGuideKm(point: LatLngTuple, guide: LatLngTuple[]) {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < guide.length; i += 1) {
    best = Math.min(best, pointToSegmentDistanceKm(point, guide[i - 1], guide[i]));
  }
  return best;
}

function nodeKey(point: LatLngTuple) {
  // OSM-Knoten mit identischen Koordinaten bleiben direkt verbunden.
  return `${point[0].toFixed(5)},${point[1].toFixed(5)}`;
}

type GraphEdge = { to: string; weight: number; bridge?: boolean };
type ElbeGraph = {
  points: Map<string, LatLngTuple>;
  edges: Map<string, GraphEdge[]>;
};

function buildElbeGraph(lines: LatLngTuple[][]): ElbeGraph {
  const points = new Map<string, LatLngTuple>();
  const edges = new Map<string, GraphEdge[]>();
  const endpoints: string[] = [];

  const addEdgeByKey = (aKey: string, bKey: string, weight: number, bridge = false) => {
    if (aKey === bKey) return;
    if (!edges.has(aKey)) edges.set(aKey, []);
    if (!edges.has(bKey)) edges.set(bKey, []);
    if (!edges.get(aKey)!.some((edge) => edge.to === bKey)) {
      edges.get(aKey)!.push({ to: bKey, weight, bridge });
      edges.get(bKey)!.push({ to: aKey, weight, bridge });
    }
  };

  lines.forEach((line) => {
    if (line.length < 2) return;
    line.forEach((point) => points.set(nodeKey(point), point));
    for (let i = 1; i < line.length; i += 1) {
      const aKey = nodeKey(line[i - 1]);
      const bKey = nodeKey(line[i]);
      addEdgeByKey(aKey, bKey, distanceKm(line[i - 1], line[i]));
    }
    endpoints.push(nodeKey(line[0]), nodeKey(line[line.length - 1]));
  });

  // Overpass liefert die Elbe in vielen einzelnen Ways. In OSM sind direkt
  // aufeinanderfolgende Ways gelegentlich nicht exakt am selben Punkt getrennt.
  // Kleine Lücken bis 300 m werden deshalb nur zwischen Way-Endpunkten gebrückt.
  // Das ist klein genug, um keine quer durchs Gelände laufenden Abkürzungen zu bauen.
  const uniqueEndpoints = Array.from(new Set(endpoints));
  const BRIDGE_MAX_KM = 0.30;
  for (let i = 0; i < uniqueEndpoints.length; i += 1) {
    const aKey = uniqueEndpoints[i];
    const a = points.get(aKey);
    if (!a) continue;
    let nearestKey: string | null = null;
    let nearestDistance = BRIDGE_MAX_KM;
    for (let j = 0; j < uniqueEndpoints.length; j += 1) {
      if (i === j) continue;
      const bKey = uniqueEndpoints[j];
      const b = points.get(bKey);
      if (!b) continue;
      const d = distanceKm(a, b);
      if (d > 0.002 && d < nearestDistance) {
        nearestDistance = d;
        nearestKey = bKey;
      }
    }
    if (nearestKey) addEdgeByKey(aKey, nearestKey, nearestDistance * 1.15, true);
  }

  return { points, edges };
}

function nearestGraphNode(graph: ElbeGraph, target: LatLngTuple) {
  let bestKey: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  graph.points.forEach((point, key) => {
    const distance = distanceKm(point, target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestKey = key;
    }
  });
  return { key: bestKey, distance: bestDistance };
}

function nearestPointOnOsmLines(
  target: LatLngTuple,
  lines: LatLngTuple[][]
): LatLngTuple | null {
  if (!lines.length) return null;

  const lat0 = target[0] * Math.PI / 180;
  const cosLat = Math.max(0.15, Math.cos(lat0));

  const toXY = (point: LatLngTuple) => ({
    x: (point[1] - target[1]) * cosLat,
    y: point[0] - target[0]
  });

  let bestPoint: LatLngTuple | null = null;
  let bestD2 = Number.POSITIVE_INFINITY;

  for (const line of lines) {
    if (!line.length) continue;

    if (line.length === 1) {
      const p = toXY(line[0]);
      const d2 = p.x * p.x + p.y * p.y;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestPoint = line[0];
      }
      continue;
    }

    for (let i = 1; i < line.length; i += 1) {
      const a = toXY(line[i - 1]);
      const b = toXY(line[i]);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const denom = dx * dx + dy * dy;
      const t = denom > 0
        ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / denom))
        : 0;

      const px = a.x + t * dx;
      const py = a.y + t * dy;
      const d2 = px * px + py * py;

      if (d2 < bestD2) {
        bestD2 = d2;
        bestPoint = [
          line[i - 1][0] + t * (line[i][0] - line[i - 1][0]),
          line[i - 1][1] + t * (line[i][1] - line[i - 1][1])
        ];
      }
    }
  }

  return bestPoint;
}

function shortestGraphPath(graph: ElbeGraph, startKey: string, endKey: string) {
  const distance = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<string, string>();
  const open = new Set<string>([startKey]);

  while (open.size) {
    let current: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;
    open.forEach((key) => {
      const d = distance.get(key) ?? Number.POSITIVE_INFINITY;
      if (d < currentDistance) {
        current = key;
        currentDistance = d;
      }
    });
    if (!current) break;
    if (current === endKey) break;
    open.delete(current);

    for (const edge of graph.edges.get(current) ?? []) {
      const candidate = currentDistance + edge.weight;
      if (candidate < (distance.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        distance.set(edge.to, candidate);
        previous.set(edge.to, current);
        open.add(edge.to);
      }
    }
  }

  if (!distance.has(endKey)) return null;
  const keys = [endKey];
  let cursor = endKey;
  while (cursor !== startKey) {
    const before = previous.get(cursor);
    if (!before) return null;
    keys.push(before);
    cursor = before;
  }
  keys.reverse();
  return keys.map((key) => graph.points.get(key)!).filter(Boolean);
}


function polylineLengthKm(line: LatLngTuple[]) {
  let total = 0;
  for (let i = 1; i < line.length; i += 1) total += distanceKm(line[i - 1], line[i]);
  return total;
}

function pointAlongSegment(a: LatLngTuple, b: LatLngTuple, fraction: number): LatLngTuple {
  return [
    a[0] + (b[0] - a[0]) * fraction,
    a[1] + (b[1] - a[1]) * fraction
  ];
}

function slicePolylineByFraction(line: LatLngTuple[], startFraction: number, endFraction: number) {
  if (line.length < 2) return [] as LatLngTuple[];
  const start = Math.max(0, Math.min(1, startFraction));
  const end = Math.max(start, Math.min(1, endFraction));
  const total = polylineLengthKm(line);
  if (total <= 0) return [] as LatLngTuple[];

  const startDistance = total * start;
  const endDistance = total * end;
  const result: LatLngTuple[] = [];
  let travelled = 0;

  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1];
    const b = line[i];
    const segment = distanceKm(a, b);
    const segmentStart = travelled;
    const segmentEnd = travelled + segment;

    if (segmentEnd >= startDistance && segmentStart <= endDistance && segment > 0) {
      const localStart = Math.max(0, (startDistance - segmentStart) / segment);
      const localEnd = Math.min(1, (endDistance - segmentStart) / segment);
      const startPoint = pointAlongSegment(a, b, localStart);
      const endPoint = pointAlongSegment(a, b, localEnd);
      if (!result.length || distanceKm(result[result.length - 1], startPoint) > 0.001) result.push(startPoint);
      result.push(endPoint);
    }

    travelled = segmentEnd;
    if (travelled > endDistance) break;
  }

  return result;
}

function parseRiverKmRange(value?: string) {
  if (!value) return null;
  const matches = value.replace(/,/g, ".").match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
  if (!matches) return null;
  const from = Number(matches[1]);
  const to = Number(matches[2]);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  return { from, to };
}


type GuideProjection = { distanceKm: number; fraction: number };

function projectPointToGuide(point: LatLngTuple, guide: LatLngTuple[]): GuideProjection {
  if (guide.length < 2) return { distanceKm: Number.POSITIVE_INFINITY, fraction: 0 };

  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 1; i < guide.length; i += 1) {
    const length = distanceKm(guide[i - 1], guide[i]);
    segmentLengths.push(length);
    totalLength += length;
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestAlong = 0;
  let travelled = 0;

  for (let i = 1; i < guide.length; i += 1) {
    const a = guide[i - 1];
    const b = guide[i];
    const refLat = ((point[0] + a[0] + b[0]) / 3) * Math.PI / 180;
    const xScale = 111.32 * Math.cos(refLat);
    const yScale = 111.32;
    const px = point[1] * xScale;
    const py = point[0] * yScale;
    const ax = a[1] * xScale;
    const ay = a[0] * yScale;
    const bx = b[1] * xScale;
    const by = b[0] * yScale;
    const vx = bx - ax;
    const vy = by - ay;
    const wx = px - ax;
    const wy = py - ay;
    const length2 = vx * vx + vy * vy;
    const t = length2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / length2)) : 0;
    const dx = px - (ax + t * vx);
    const dy = py - (ay + t * vy);
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < bestDistance) {
      bestDistance = d;
      bestAlong = travelled + segmentLengths[i - 1] * t;
    }
    travelled += segmentLengths[i - 1];
  }

  return {
    distanceKm: bestDistance,
    fraction: totalLength > 0 ? Math.max(0, Math.min(1, bestAlong / totalLength)) : 0
  };
}

function osmElbeSectionParts(
  guide: LatLngTuple[],
  candidates: LatLngTuple[][]
): LatLngTuple[][] {
  if (guide.length < 2 || !candidates.length) return [];

  // V8: Wir verlangen keinen einzigen zusammenhängenden OSM-Pfad mehr.
  // Jeder echte Elbe-Way wird punktweise gegen den Abschnittskorridor geprüft.
  // Dadurch verschwinden LAV-Strecken nicht mehr wegen kleiner OSM-Way-Lücken.
  const CORRIDOR_KM = 4.0;
  const END_TOLERANCE_FRACTION = 0.015;
  const MIN_PART_KM = 0.08;
  const parts: { line: LatLngTuple[]; order: number }[] = [];

  candidates.forEach((line) => {
    if (line.length < 2) return;
    let current: LatLngTuple[] = [];
    let fractions: number[] = [];

    const flush = () => {
      if (current.length >= 2 && polylineLengthKm(current) >= MIN_PART_KM) {
        const order = fractions.reduce((a, b) => a + b, 0) / fractions.length;
        parts.push({ line: current, order });
      }
      current = [];
      fractions = [];
    };

    line.forEach((point) => {
      const projection = projectPointToGuide(point, guide);
      const inside = projection.distanceKm <= CORRIDOR_KM &&
        projection.fraction >= -END_TOLERANCE_FRACTION &&
        projection.fraction <= 1 + END_TOLERANCE_FRACTION;

      if (inside) {
        current.push(point);
        fractions.push(projection.fraction);
      } else {
        flush();
      }
    });
    flush();
  });

  parts.sort((a, b) => a.order - b.order);

  // Exakte doppelte Ways vermeiden, falls Overpass dieselbe Geometrie mehrfach liefert.
  const seen = new Set<string>();
  return parts
    .map((part) => part.line)
    .filter((line) => {
      const first = line[0];
      const last = line[line.length - 1];
      const key = `${first[0].toFixed(5)},${first[1].toFixed(5)}>${last[0].toFixed(5)},${last[1].toFixed(5)}:${line.length}`;
      const reverse = `${last[0].toFixed(5)},${last[1].toFixed(5)}>${first[0].toFixed(5)},${first[1].toFixed(5)}:${line.length}`;
      if (seen.has(key) || seen.has(reverse)) return false;
      seen.add(key);
      return true;
    });
}

function restrictionPartsByGuideFraction(
  parts: LatLngTuple[][],
  guide: LatLngTuple[],
  startFraction: number,
  endFraction: number
): LatLngTuple[][] {
  const result: LatLngTuple[][] = [];
  parts.forEach((line) => {
    let current: LatLngTuple[] = [];
    const flush = () => {
      if (current.length >= 2) result.push(current);
      current = [];
    };

    line.forEach((point) => {
      const projection = projectPointToGuide(point, guide);
      if (projection.fraction >= startFraction && projection.fraction <= endFraction) {
        current.push(point);
      } else {
        flush();
      }
    });
    flush();
  });
  return result;
}

function exactElbeSection(
  fallback: LatLngTuple[],
  candidates: LatLngTuple[][]
): LatLngTuple[] | null {
  if (fallback.length < 2 || !candidates.length) return null;
  const start = fallback[0];
  const end = fallback[fallback.length - 1];

  // Die grobe alte Route wird ausschließlich als Suchkorridor benutzt – sie wird
  // nie mehr gezeichnet. So bleiben Nebenarme und weit entfernte Elbe-Ways draußen.
  const CORRIDOR_KM = 4.0;
  const localCandidates = candidates.filter((line) => {
    if (line.length < 2) return false;
    const sampleStep = Math.max(1, Math.floor(line.length / 8));
    for (let i = 0; i < line.length; i += sampleStep) {
      if (distanceToGuideKm(line[i], fallback) <= CORRIDOR_KM) return true;
    }
    return distanceToGuideKm(line[line.length - 1], fallback) <= CORRIDOR_KM;
  });

  if (!localCandidates.length) return null;
  const graph = buildElbeGraph(localCandidates);
  if (!graph.points.size) return null;

  const startNode = nearestGraphNode(graph, start);
  const endNode = nearestGraphNode(graph, end);

  // Die Orientierungspunkte stammen aus einer älteren, nur groben Route. Etwas
  // Toleranz ist deshalb nötig; gezeichnet wird dennoch ausschließlich der OSM-Pfad.
  if (!startNode.key || !endNode.key || startNode.distance > 5 || endNode.distance > 5) {
    return null;
  }

  const path = shortestGraphPath(graph, startNode.key, endNode.key);
  if (!path || path.length < 2) return null;

  let pathLength = 0;
  for (let i = 1; i < path.length; i += 1) pathLength += distanceKm(path[i - 1], path[i]);
  const direct = distanceKm(start, end);

  // Verhindert, dass bei einem OSM-Nebenarm eine kilometerlange Schleife gewählt wird.
  if (pathLength > Math.max(55, direct * 3.2)) return null;

  // Zusätzliche Plausibilitätskontrolle: auch der fertige Pfad muss überwiegend
  // innerhalb des Korridors des betreffenden LAV-Abschnitts liegen.
  const tooFar = path.filter((point) => distanceToGuideKm(point, fallback) > 5.0).length;
  if (tooFar > Math.max(3, path.length * 0.08)) return null;

  return path;
}


const STANDING_WATER_OSM_TARGETS: Record<string, LatLngTuple> = {
  // Suchpunkt im bestätigten Gewässer
  "lüttgenbörnecke bei börnecke": [51.82895, 11.02396],
  "lüttgenbörnecker teich": [51.82895, 11.02396]
};

// Verifizierte Endpositionen liegen DIREKT auf der lokalen PBF-Ufergeometrie.
// Lüttgenbörnecke: östliches Ufer des tatsächlich im PBF enthaltenen Teichpolygons.
const VERIFIED_STANDING_WATER_MARKERS: Record<string, LatLngTuple> = {
  "zoberbergsee 2 inkl. „kleiner see“,": [51.8154215, 12.1815048],
  "zoberbergsee 1 im ot mosigkau": [51.8139567, 12.1787751],
  // Vom Nutzer bestätigter Referenzfall
  "lüttgenbörnecke bei börnecke": [51.829069, 11.024324],

  // Pappelteich Ermsleben: reales lokales PBF-Wasserpolygon,
  // Uferpunkt aus der Kachel 517_113; nicht die alte Angelatlas-Position.
  "pappelteich ermsleben": [51.7292278, 11.3157937],
  // OSM way 37570023 – Kiesgrube Röpzig
  "kiesgrube in röpzig": [51.4327979, 11.9408255],
  // OSM way 62447108 – Schachtteich Milzau
  "schachtteich milzau": [51.3716541, 11.9057310],
  // OSM way 113270552 – Tonloch Teicha
  "tonloch bei teicha": [51.5568757, 11.9494984],
  // OSM way 122996556 – Dorfteich Nauendorf
  "dorfteich nauendorf": [51.6020595, 11.8834343],
  // OSM way 58715055 – Naturbad Rehmsdorf
  "naturbad rehmsdorf": [51.0588620, 12.2139377],
  // OSM way 4444853 – Diepold
  "diepold": [51.8359287, 12.2652376],
  // OSM way 25691251 – Stillinge Nord
  "stillinge nord": [51.8532583, 12.2499923],
  // OSM way 25927865 – Rehsumpf
  "rehsumpf": [51.8267327, 12.2713275],
  // OSM way 102337347 – Kleiner Klietzer See
  "kleiner klietzer see": [52.6662622, 12.0615534],
  // OSM way 132470093 – Waldsteinbruch Hundisburg
  "waldsteinbruch hundisburg": [52.2573567, 11.4080217],
  // OSM way 171891411 – Zielitzer See
  "zielitzer see": [52.2886767, 11.6868247],
  // OSM way 67152293 – Steinbruch Dahlenwarsleben
  "steinbruch dahlenwarsleben": [52.1909794, 11.5651126],
  // OSM way 176298398 – Badeteich Güsen
  "badeteich bei güsen": [52.3475712, 11.9711627],
  // OSM way 168134307 – Lübser See
  "lübser see": [52.0125308, 11.9087394],
  "oberer teich pansfelde": [51.6568390, 11.2597260],
  "unterer teich pansfelde": [51.6568950, 11.2620380],
  "untere schwenneckestau bei pansfelde": [51.6577750, 11.2805390],
  "kragenteich roitzsch": [51.5762853, 12.2603801],
  "mansfelder teich": [51.5814909, 11.4316951],
  "alte kiesgrube katharinenrieth": [51.3975833, 11.3317126],
  "goethebruch petersberg": [51.5949558, 11.9555527],
  "schweinekolk bei niegripp": [52.2649055, 11.7553645],
  "schwarze elster von straßenbrücke jessen bis einmündung des neugrabens": [51.7872300, 12.9468300],
  "parkteich in braunsbedra": [51.2799840, 11.8804520],
  "tongrube bei ivenrode": [52.2799510, 11.2502180],
  "dorfteich sylda": [51.6800520, 11.4199870],
  "erlengrund bei teutschenthal": [51.4598950, 11.7800980],
  "griebehner teiche bei calbe": [51.9201570, 11.7796310],
  "großer see (bleesern) bei seegrehna": [51.8412544, 12.5731659],
  "mühlenteich deersheim": [51.9798570, 10.7801760],
  "steinbachteich deersheim": [51.9798570, 10.7801760],
  "großes wasserloch parey (kühn´s loch)": [52.3900720, 11.9799410],
  "cobra in bruckdorf": [51.4499160, 12.0198520],
  "tonloch östlich der alten schule": [51.4650440, 11.7644060],
  "alte kiesgrube berga": [51.4481849, 11.0198583],
  "anglerteiche apenburg": [52.7100540, 11.2001440],
  "dorfteich hohenwarsleben": [52.1799410, 11.5005030],
  "tonkuhle (badetonkuhle) in aschersleben": [51.7700770, 11.4703090],
  "tonkuhle nahry aschersleben": [51.7700770, 11.4703090],
  "rosianer stau": [52.0954660, 12.1750830],
  "kiesschacht in kroppenstedt": [51.9497480, 11.3201120],
  "dorfteich in breitenrode": [52.4598530, 10.9695840],
  "stadionteich in köthen": [51.7476286, 11.9614105],
  "klärteich taucha": [51.1903710, 12.0801070],
  "dahlener kiessee": [52.5752030, 11.8448240],
  "spitzenlöcher in elster": [51.8198850, 12.8098990],
  "tongrube in bruckdorf": [51.4499180, 12.0102570],
  "großer richard bei sandersdorf": [51.6199730, 12.2695340],
  "tagebaurestloch richard i (kleiner richard) bei sandersdorf": [51.6235067, 12.2687770],
  "durchstich bei pratau": [51.8497450, 12.6104730],
  "grube theodor bei roitzsch": [51.5844610, 12.2682850],
  "fahrt in preußlitz": [51.7302599, 11.8119223],
  "großer teich hinter der fahrt in preußlitz": [51.7302599, 11.8119223],
  "rohrteichwiese altenhausen": [52.2600630, 11.2698860],
  "kiesgrube bei roßla": [51.4597140, 11.0896780],
  "teiche am wasserwerk": [51.4896090, 12.1801220],
  "dorfteich sietzsch": [51.4896090, 12.1801220],
  "bucher lanke": [52.4799970, 11.9799300],
  "kiesgrube (gänseteich) zwintschöna": [51.4547240, 12.0452720],
  "zollau bei glindenberg": [52.2276608, 11.6955981],
  "mittelsbruch bei losenrade": [52.9701470, 11.7501350],
  "kiestagbau (badesee) bei prettin": [51.6700070, 12.9099920],
  "kiesgruben barbyer straße schönebeck": [52.0152380, 11.7750000],
  "damaschkeplan (2 teiche) bei calbe": [51.8694100, 11.7601990],
  "tagebau miltern": [52.5646900, 11.9051330],
  "große bräge bei wörlitz": [51.8498190, 12.4690760],
  "strandbad gütersee in köthen": [51.7695932, 11.9896717],
  "tonteich bülzig": [51.8903987, 12.7697490],
  "obere aue (fkk)": [51.4600900, 11.9284740],
  "kiesloch born bei derben": [52.4099260, 11.9910540],
  "kiesbaggerloch löber bei derben": [52.4099260, 11.9910540],
  "phönix nord": [51.0799990, 12.2601090],
  "neuer teich bei gernrode": [51.7062307, 11.1051042],
  "bergrat-müller teich bei gernrode": [51.6794461, 11.0648109],
  "erichsburger teich bei friedrichsbrunn": [51.6752824, 11.0669739],
  "teich am anglerheim (burggraben) in kalbe/milde": [52.6539274, 11.3981743],
  "pfefferteich bei salzwedel": [52.8514603, 11.1485079],
  "dorfteich plößnitz": [51.5341532, 12.0652090],
  "herrenteich bei tollwitz": [51.2774148, 12.1025467],
  "kleiner dorfteich wölkau": [51.3075118, 12.0485955],
  "saalealtarm leuna": [51.3166101, 12.0455021],
  "großkaynaer see": [51.2720851, 11.9530766],
  "gr.teich wölkau": [51.3075118, 12.0485955],
  "dorfteich kröllwitz": [51.3075118, 12.0485955],
  "pappelgrund bei teutschenthal": [51.4595951, 11.8487037],
  "mühlteich krosigk": [51.6132694, 11.9378527],
  "auensee bei granschütz": [51.1885094, 12.0508462],
  "mondsee pirkau bei hohenmölsen": [51.1381233, 12.1354041],
  "weiße grube altenroda": [51.2389802, 11.5444062],
  "neuer teich in meineweh": [51.0721663, 11.9934278],
  "alter elsterarm profen": [51.1274000, 12.2339834],
  "hainbergsee": [51.0369347, 12.2959388],
  "peisker an der straße zum ot roßlau": [51.8593458, 12.2375591],
  "fährsee an der straße zum ot roßlau": [51.8662199, 12.2385931],
  "die bach (hofsee) bei kleutsch": [51.7915123, 12.2958905],
  "karpfenteich biethe im ot roßlau": [51.8824022, 12.2235236],
  "erdkuhle bei rothensee": [52.1897452, 11.6610608],
  "dreier kolke bei zipkeleben": [52.1039191, 11.7073271],
  "barleber see i": [52.2246844, 11.6581946],
  "alte elbe kreuzhorst": [52.0830178, 11.6843535],
  "großer barrosee (teil 1)": [52.1898176, 11.6426651],
  "sternsee olvenstedt": [52.1480066, 11.5795058],
  "barrosee dreieck": [52.1902508, 11.6375782],
  "der placken (kuhlenhagen)": [52.0725094, 11.6917204],
  "barleber see ii": [52.2246844, 11.6581946],
  "alte elbe bei randau/calenberge": [52.0634050, 11.7341226],
  "kleiner posthornteich rechtsseitig am ortsausgang halle richtung oppin": [51.5195154, 11.9989049],
  "kirchteich in neustadt": [51.4740692, 11.9359962],
  "bruchsee in neustadt": [51.4834358, 11.9186451],
  "friedhofsteich neustadt": [51.4768157, 11.8772921],
  "hufeisensee in kanena": [51.4615269, 12.0314239],
  "ententeich in planena": [51.4207381, 11.9605635],
  "großer schönfelder see": [52.7379220, 12.0948957],
  "schönberger haken": [52.9043687, 11.8616725],
  "flachspuhl bei erxleben": [52.7460451, 11.7689231],
  "blauer see sandauerholz": [52.8078186, 11.9864191],
  "bleichwehl bei werben/elbe": [52.8628989, 11.9950477],
  "marschners loch bei werben/elbe": [52.8682455, 11.9960576],
  "wasserkuhle langes loch bei werben/elbe": [52.8655478, 12.0122190],
  "stadtwehl in werben/elbe": [52.8614999, 11.9870602],
  "köhnsee kläden": [52.6377331, 11.6494017],
  "schwanenteich in stendal": [52.6067776, 11.8677922],
  "fieber in stendal": [52.5472396, 11.7608292],
  "wahrburger tonkuhle": [52.5973029, 11.8056159],
  "ziegeleiteich in klein schwarzlosen": [52.4852556, 11.7898470],
  "altes kiesloch bei tangermünde": [52.5325466, 11.9657101],
  "neues kiesloch bei tangermünde": [52.5325466, 11.9657101],
  "jaeneckes teiche bei stendal": [52.5962038, 11.8812671],
  "holzmühlenteich in flechtingen": [52.3117134, 11.2099312],
  "mühlenteich bodendorf bei süplingen": [52.2886997, 11.2950991],
  "haidteich bei bebertal": [52.2561438, 11.3213091],
  "neuer teich in bebertal": [52.2504961, 11.3238898],
  "königsee bei bebertal": [52.2472057, 11.3429690],
  "schäferteich bei hörsingen": [52.2814850, 11.1602705],
  "wegenstedter teich bei calvörde": [52.3935243, 11.2845611],
  "törner see bei bülstringen": [52.3182731, 11.3426267],
  "papenteich bei emden": [52.2346566, 11.2991870],
  "priesterteich in eggenstedt": [52.1027856, 11.2341481],
  "bauernteich in schermke": [52.0570013, 11.2866326],
  "das grundlos bei heynburg": [51.9377313, 11.2535881],
  "tonkuhle bei altenweddingen": [51.9854166, 11.5037904],
  "moortalsee bei zielitz/farsleben": [52.2821284, 11.6709665],
  "alte kiesgrube (rabe) bei groß ammensleben": [52.2429342, 11.5458647],
  "jersleber see": [52.2318441, 11.5871259],
  "2 tonlöcher in elbeu bei wolmirstedt": [52.2332573, 11.6132501],
  "döbberitz bei glindenberg": [52.2465345, 11.6880667],
  "steinkolk bei glindenberg": [52.2608705, 11.6943152],
  "daukuhle bei samswegen": [52.2553760, 11.5824151],
  "pfennigsee bei farsleben": [52.2663992, 11.6720662],
  "an der tränke ochtmersleben": [52.1547595, 11.4114448],
  "fenn in möser": [52.2229583, 11.7872117],
  "große wehle bei niegripp": [52.2605104, 11.7517730],
  "katzenkolk bei schartau": [52.2792477, 11.7735949],
  "feldschlößchenkolk in burg": [52.2705483, 11.8719386],
  "dunker-see burg": [52.2934828, 11.8264325],
  "feuerlöschteich bei ferchland": [52.4297905, 12.0027455],
  "waldmühlenlanke bei parey": [52.3686061, 11.9614512],
  "herrensee parey": [52.3630134, 11.9422410],
  "prödeler see - 2 teiche": [52.0250868, 11.8964952],
  "halberstädter see 1 (badesee)": [51.9127514, 11.0859444],
  "halberstädter see ii": [51.9127514, 11.0859444],
  "bergrat-müller teich bei friedrichsbrunn": [51.6794461, 11.0648109],
  "kunstteich in ballenstedt": [51.7065880, 11.2386025],
  "großer dachsteich bei ballenstedt": [51.7138419, 11.2167647],
  "gondelteich in friedrichsbrunn": [51.6801191, 11.0443933],
  "gondelteich thale": [51.7581681, 11.0323233],
  "glockenteich ballenstedt": [51.7169219, 11.2139957],
  "flottenteich weddersleben": [51.7651025, 11.0947894],
  "ochsensumpfteich (früher petersstichel)": [51.7186172, 11.0278748],
  "dorfteich opperode": [51.7178701, 11.2621437],
  "großer schachtteich bei wienrode": [51.7643905, 10.9851694],
  "kleiner schachtteich bei wienrode": [51.7643905, 10.9851694],
  "gondelteich aschersleben": [51.7481010, 11.4395800],
  "dammloch beesenlaublingen": [51.7080560, 11.6859229],
  "lettenloch bei könnern": [51.6726431, 11.7540934],
  "großer wiendorfer teich": [51.7158175, 11.8230224],
  "taiga in gröna": [51.7663253, 11.7148351],
  "bläßsee in der aue bei altenburg": [51.8192571, 11.7703913],
  "schachtsee neugattersleben": [51.8595301, 11.7105059],
  "dorfteich bründel": [51.7469501, 11.6496409],
  "dorfteich plötzkau": [51.7466897, 11.6806474],
  "saalealtarm lesewitz bei plötzkau": [51.7489348, 11.7111468],
  "parkteich bei brumby": [51.9002469, 11.6820926],
  "beamtenteich grube alfred": [51.9433660, 11.8053945],
  "pappelteich grube alfred": [51.9460596, 11.8016010],
  "fährlake bei grünewalde": [52.0270671, 11.7447829],
  "röthe bei schönebeck": [52.0192264, 11.7715182],
  "norderney in schwarz": [51.8821804, 11.7991872],
  "bruch 1 bei breitenhagen": [51.9228717, 11.9347464],
  "bruch 2 bei breitenhagen": [51.9289795, 11.9277614],
  "bruch 3 bei breitenhagen": [51.9364141, 11.9309806],
  "badebruch bei breitenhagen": [51.9222518, 11.9361438],
  "krügersee bei breitenhagen": [51.9048427, 11.9524305],
  "kleiner dorfsee groß rosenburg": [51.9190644, 11.8934656],
  "salzteich bei löderburg": [51.8818312, 11.5502537],
  "großer schachtsee bei wolmirsleben": [51.9543535, 11.4665906],
  "seemann bei löderburg": [51.8755009, 11.5513281],
  "laake bei löderburg": [51.8795292, 11.5485021],
  "löderburger see": [51.8800020, 11.5309928],
  "kreuz-/salzteich löderburg": [51.8818312, 11.5502537],
  "alte mulde roitzschjora": [51.5977444, 12.4981606],
  "bürgermeisterteich jeßnitz": [51.6898124, 12.3004837],
  "auensee bei holzweißig": [51.6030084, 12.3305062],
  "dorfteich thalheim": [51.6526500, 12.2314095],
  "generalsteich schrenz": [51.5862731, 12.0742447],
  "tonkiete schortewitz": [51.6491735, 12.0304045],
  "deutsche grube zscherndorf": [51.6127533, 12.2797288],
  "möster altes wasser": [51.7691284, 12.2931877],
  "niesauer stillinge": [51.7634172, 12.2958360],
  "hausteich in reupzig": [51.7375146, 12.0689521],
  "zuckerteich bei osternienburg": [51.8113491, 12.0167197],
  "elsdorfer sandkiete": [51.7833192, 11.9644182],
  "magdalenenteich in aken": [51.8563989, 12.0365004],
  "bürgersee in aken": [51.8570568, 12.0739901],
  "baufeld wörbzig 1 - große kiesgrube linksseitig der straße von gröbzig nach wörbzig": [51.7045306, 11.8886603],
  "baufeld wörbzig 2 - kleinere kiesgrube linksseitig der straße von gröbzig nach wörbzig": [51.7123417, 11.8906855],
  "betonwerkteich 3 + 4 bei gröbzig": [51.6775806, 11.8929289],
  "schachtteich bei piethen": [51.6799667, 11.9455074],
  "pelzteich görzig": [51.6609502, 11.9978682],
  "dorfteich gnetsch": [51.6801936, 12.0731762],
  "gutsteich görzig": [51.6623241, 11.9920247],
  "grubenteich bei osternienburg": [51.7995752, 12.0327144],
  "kleine sandfürchen bei osternienburg": [51.7982308, 12.0433367],
  "baggerteich bei trebbichau/aken": [51.8175287, 12.0023617],
  "großer und kleiner parkteich in trebbichau/aken": [51.8157744, 12.0081439],
  "hasenteich bei osternienburg": [51.7984552, 12.0412428],
  "teich ii osternienburg": [51.7962648, 12.0428783],
  "mühlenteich wulfen": [51.8222923, 11.9299340],
  "kapellenteich wulfen": [51.8197209, 11.9390767],
  "angerteich wulfen": [51.8215731, 11.9368395],
  "holzplatzteich osternienburg": [51.8066345, 12.0325899],
  "roter teich osternienburg": [51.8055748, 12.0358212],
  "schulteich bei trebbichau/aken": [51.8127960, 12.0139701],
  "gödnitzer see": [51.9881642, 11.9212601],
  "großes loch bei steutz": [51.8743184, 12.0765897],
  "pfaffensee bei steckby": [51.8875635, 12.0316099],
  "großer wehl bei steutz": [51.8675940, 12.0593332],
  "strohwalder teich gräfenhainichen": [51.7411320, 12.4720981],
  "buchholzteich gräfenhainichen": [51.7297588, 12.4919461],
  "gänseteich in söllichau": [51.6242390, 12.6462856],
  "barbarasee bei gräfenhainichen": [51.7203356, 12.4404905],
  "margaretenhofteich bei oranienbaum": [51.8061631, 12.4029086],
  "talkenloch bei kakau": [51.7997802, 12.4646620],
  "stammhainigte bei wörlitz": [51.8559121, 12.4309486],
  "schiffinge bei vockerode": [51.8632272, 12.3325283],
  "roter see bei rotta": [51.7793858, 12.5592233],
  "schweinitzer fließ von landesgrenze bis einlauf morgengraben bei zwuschen/dixförda": [51.8153290, 13.0583773],
  "alte elbe in iserbegka bei elster": [51.8354402, 12.7911934],
  "das loch annaburg": [51.7253145, 13.0675330],
  "dorfteich klieken": [51.8878568, 12.3694642],
  "klinkerteich bei bad schmiedeberg": [51.6846723, 12.7476721],
  "streitlache bei pratau": [51.8491928, 12.6296611],
  "sandekolk bei pratau": [51.8464896, 12.6654983],
  "bleddiner riß": [51.7932102, 12.7941971],
  "moschkolk bei wartenburg": [51.8042162, 12.7768474],
  "blaues auge bei reinharz": [51.6985608, 12.7088246],
  "pfählen bei wartenburg": [51.8006495, 12.7782719],
  "schluft priesitz": [51.7069005, 12.8378897],
  "tiefe lache mit graben und loch bei seegrehna": [51.8549502, 12.5325007],
  "krummer see (bodemar) bei seegrehna": [51.8527357, 12.5570220],
  "blumenwinkel bei seegrehna": [51.8535694, 12.5673424],
  "drehkolk bei seegrehna": [51.8512114, 12.5681920],
  "hauskolk bei seegrehna": [51.8491430, 12.5714424],
  "alte badeanstalt kemberg": [51.7718144, 12.6256281],
  "espenkolk i und ii bei gallin/mühlanger": [51.8350263, 12.7619885],
  "mönchsteich (hausbergteich) bischofrode": [51.4925222, 11.5528955],
  "ottilienteich bei röblingen": [51.4672283, 11.6823529],
  "kleinwasserspeicher ziegelrode": [51.5532742, 11.4449467],
  "schäferteich in stedten": [51.4427560, 11.6845099],
  "tonloch lauraberg röblingen": [51.4573588, 11.6613640],
  "rüdels teich bei helfta": [51.5240807, 11.5612255],
  "tonloch bei hettstedt": [51.6353578, 11.5274274],
  "ölgrundteich bei hettstedt": [51.6672913, 11.5049040],
  "melmensee bei tilleda": [51.4083964, 11.1723791],
  "schloßteich rottleberode": [51.5183732, 10.9457337],
  "sackteich in sangerhausen": [51.4838099, 11.3133666],
  "stausee kelbra": [51.4320551, 11.0213153],
  "zweier- und dreierteich am rosarium sangerhausen": [51.4753447, 11.3083031],
  "affenteich gräfenhainichen": [51.7305454, 12.4922911],
  "wilde kölke i bei dabrun/melzwig": [51.8063328, 12.7411044],
  "hirschteich ballenstedt": [51.7079609, 11.2237359],
};

function verifiedStandingWaterMarker(water: FishingWater): LatLngTuple | null {
  return VERIFIED_STANDING_WATER_MARKERS[water.name.toLowerCase().trim()] ?? null;
}

function normalizeWaterName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(bei|in|am|an der|an den|der|die|das)\b/g, " ")
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function standingWaterOsmTarget(water: FishingWater): LatLngTuple | null {
  const exact = STANDING_WATER_OSM_TARGETS[water.name.toLowerCase().trim()];
  if (exact) return exact;
  const normalized = normalizeWaterName(water.name);
  for (const [name, coordinate] of Object.entries(STANDING_WATER_OSM_TARGETS)) {
    const n = normalizeWaterName(name);
    if (normalized === n || normalized.includes(n) || n.includes(normalized)) return coordinate;
  }
  return null;
}

function isStandingWaterType(water: FishingWater) {
  // Linien-/Fließgewässer haben bereits ihre eigene OSM/PBF-Snap-Logik.
  // Alle übrigen punktförmig geführten LAV-Gewässer behandeln wir als
  // stehende Gewässer. Dadurch funktionieren auch Einträge, deren Typ im
  // Katalog z. B. Weiher, Restloch oder Sonderbezeichnung lautet.
  if (water.waterwayName || water.route?.length) return false;
  const type = (water.type ?? "").toLowerCase();
  if (type.includes("fließ") || type.includes("fliess") || type.includes("fluss") || type.includes("kanal")) {
    return false;
  }
  return true;
}

async function loadStandingWaterNeighbourhood(latitude: number, longitude: number) {
  const baseLat = Math.floor(latitude * 10);
  const baseLon = Math.floor(longitude * 10);
  const jobs: Promise<LatLngTuple[][]>[] = [];
  for (let y = -1; y <= 1; y += 1) {
    for (let x = -1; x <= 1; x += 1) {
      const url = `/osm-standing-water-tiles/${baseLat + y}_${baseLon + x}.json`;
      jobs.push(fetch(url, { cache: "force-cache" }).then(r => r.ok ? r.json() : []).catch(() => []));
    }
  }
  return (await Promise.all(jobs)).flat();
}

export default function MapView({
  waters,
  persistentRouteWaters = [],
  spots,
  parkings,
  selectedWater,
  onSelect
}: {
  waters: FishingWater[];
  persistentRouteWaters?: FishingWater[];
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
  const [elbeOsmLines, setElbeOsmLines] = useState<LatLngTuple[][]>([]);
  const [saaleOsmLines, setSaaleOsmLines] = useState<LatLngTuple[][]>([]);
  const [waterwayOsmLines, setWaterwayOsmLines] = useState<Record<string, LatLngTuple[][]>>({});
  const [standingWaterSnaps, setStandingWaterSnaps] = useState<Record<string, LatLngTuple>>({});

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!selectedWater || selectedWater.latitude === null || selectedWater.longitude === null) return;
    if (!isStandingWaterType(selectedWater)) return;
    let cancelled = false;
    const raw: LatLngTuple = [selectedWater.latitude, selectedWater.longitude];
    const namedTarget = standingWaterOsmTarget(selectedWater);
    const searchPoint = namedTarget ?? raw;
    loadStandingWaterNeighbourhood(searchPoint[0], searchPoint[1]).then((lines) => {
      if (cancelled || !lines.length) return;
      const snapped = nearestPointOnOsmLines(searchPoint, lines);
      if (!snapped) return;

      // Ein namentlich aufgelöstes OSM-Gewässer darf nur sehr nah am
      // bestätigten OSM-Ziel liegen. Ohne Namensauflösung snappen wir nur
      // konservativ; dadurch kann ein ungenauer Angelatlas-Punkt nicht mehr
      // mehrere hundert Meter auf irgendeine fremde Wasserfläche springen.
      const d = distanceKm(searchPoint, snapped);
      const maxSnapKm = namedTarget ? 0.20 : 0.18;
      if (d > maxSnapKm) return;
      setStandingWaterSnaps(current => ({ ...current, [selectedWater.id]: snapped }));
    });
    return () => { cancelled = true; };
  }, [selectedWater]);

  useEffect(() => {
    if (![...waters, ...persistentRouteWaters].some((water) => water.riverKm && water.route?.length)) return;
    let cancelled = false;

    fetch(ELBE_OSM_GEOJSON_URL, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`OSM-Elbe ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setElbeOsmLines(geoJsonLineCandidates(data));
      })
      .catch(() => {
        // Dienst nicht erreichbar: keine ungenaue Ersatzlinie über Land zeichnen.
        if (!cancelled) setElbeOsmLines([]);
      });

    return () => { cancelled = true; };
  }, [waters.some((water) => Boolean(water.riverKm && water.route?.length)), persistentRouteWaters.some((water) => Boolean(water.riverKm && water.route?.length))]);

  useEffect(() => {
    if (![...waters, ...persistentRouteWaters].some((water) => water.waterwayName === "Saale" && water.route?.length)) return;
    let cancelled = false;

    fetch(SAALE_OSM_GEOJSON_URL, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`OSM-Saale ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setSaaleOsmLines(geoJsonLineCandidates(data));
      })
      .catch(() => {
        if (!cancelled) setSaaleOsmLines([]);
      });

    return () => { cancelled = true; };
  }, [waters.some((water) => water.waterwayName === "Saale" && Boolean(water.route?.length)), persistentRouteWaters.some((water) => water.waterwayName === "Saale" && Boolean(water.route?.length))]);

  useEffect(() => {
    const names = Array.from(new Set(
      [...waters, ...persistentRouteWaters]
        .map((water) => water.waterwayName)
        .filter((name): name is string => Boolean(name && name !== "Elbe" && name !== "Saale"))
    ));
    if (!names.length) {
      setWaterwayOsmLines({});
      return;
    }
    let cancelled = false;
    Promise.all(names.map(async (name) => {
      try {
        const localEndpoint = LOCAL_WATERWAY_GEOMETRY[name];
        const apiEndpoint = WATERWAY_ENDPOINTS[name];

        if (localEndpoint) {
          const localResponse = await fetch(localEndpoint, { cache: "force-cache" });
          if (localResponse.ok) {
            const localData = await localResponse.json();
            const localLines = geoJsonLineCandidates(localData);
            if (localLines.length) return [name, localLines] as const;
          }
        }

        if (!apiEndpoint) return [name, []] as const;
        const response = await fetch(apiEndpoint, { cache: "force-cache" });
        if (!response.ok) return [name, []] as const;
        const data = await response.json();
        return [name, geoJsonLineCandidates(data)] as const;
      } catch {
        return [name, []] as const;
      }
    })).then((entries) => {
      if (!cancelled) setWaterwayOsmLines(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [waters.map((water) => water.waterwayName ?? "").join("|"), persistentRouteWaters.map((water) => water.waterwayName ?? "").join("|")]);

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

    // Elbe-LAV-Strecken sind ein permanenter Hintergrund-Layer und werden
    // unabhängig von Suche/Filter immer gezeichnet. Treffer-Gewässer bestimmen
    // weiterhin allein den Kartenausschnitt.
    const persistentIds = new Set(persistentRouteWaters.map((water) => water.id));
    const routeWaters = [
      ...persistentRouteWaters,
      ...waters.filter((water) => water.route?.length && !persistentIds.has(water.id))
    ];
    const normalWaters = waters.filter((water) => !water.route?.length);

    routeWaters.forEach((water) => {
      if (water.latitude === null || water.longitude === null) return;

      const coordinate: L.LatLngExpression = [
        water.latitude,
        water.longitude
      ];

      // Permanente Fluss-Layer verändern den aktuellen Such-/Trefferausschnitt nicht.

      if (water.route?.length) {
        const sourceLines = water.waterwayName === "Elbe"
          ? elbeOsmLines
          : water.waterwayName === "Saale"
            ? saaleOsmLines
            : (water.waterwayName ? (waterwayOsmLines[water.waterwayName] ?? []) : []);
        const displayParts: LatLngTuple[][] = water.waterwayName
          ? osmElbeSectionParts(water.route as LatLngTuple[], sourceLines)
          : [water.route as LatLngTuple[]];
        // Route bleibt sichtbar, ohne fitBounds auf die komplette Elbe auszuweiten.
        const routeColor =
          water.bankSide === "both" ? "#18864b" :
          water.bankSide === "left" ? "#1565c0" : "#e56a00";
        const bankLabel =
          water.bankSide === "both" ? "beidseitig" :
          water.bankSide === "left" ? "nur linksseitig" : "nur rechtsseitig";
        const restrictionHtml = water.restrictions?.length
          ? `<br><strong>Hinweis:</strong> ${water.restrictions.join(" ")}`
          : "";

        if (displayParts.length) {
          // Salmonidengewässer bekommen nur EINE zusätzliche violette Kennzeichnung.
          // Sie liegt unter der LAV-Uferfarbe, damit grün/blau/orange weiterhin
          // eindeutig die Befischungsseite anzeigen.
          const salmonidDisplayParts: LatLngTuple[][] =
            water.salmonidRoute?.length && water.waterwayName
              ? osmElbeSectionParts(water.salmonidRoute as LatLngTuple[], sourceLines)
              : (water.salmonid ? displayParts : []);

          if (salmonidDisplayParts.length) {
            L.polyline(salmonidDisplayParts, {
              color: "#8b5cf6",
              weight: selectedWater?.id === water.id ? 11 : 9,
              opacity: 0.55,
              lineCap: "round",
              lineJoin: "round"
            })
              .bindPopup(
                `<strong>Salmonidengewässer</strong><br>${water.name}` +
                `<br><small>Zusätzliche violette Kennzeichnung; LAV-Regeln und Schonbestimmungen beachten.</small>`
              )
              .on("click", () => selectRef.current(water))
              .addTo(layer);
          }

          // Bewusst dezent: OSM-Wasserfläche bleibt sichtbar; die Farbe zeigt nur
          // die LAV-Berechtigung und überdeckt weder Fluss noch Uferdetails.
          L.polyline(displayParts, {
            color: routeColor,
            weight: selectedWater?.id === water.id ? 6 : 4,
            opacity: selectedWater?.id === water.id ? 0.9 : 0.72,
            lineCap: "round",
            lineJoin: "round"
          })
            .bindPopup(
              `<strong>${water.name}</strong><br>${water.sectionLabel ?? (water.riverKm ? `${water.waterwayName ?? "Gewässer"}-km ${water.riverKm}` : (water.waterwayName ?? "Fließgewässer"))} · ${bankLabel}` +
              `<br>${water.lavNumber ?? "LAV Sachsen-Anhalt"}${restrictionHtml}`
            )
            .on("click", () => selectRef.current(water))
            .addTo(layer);

          const riverRange = parseRiverKmRange(water.riverKm);
          if (riverRange && water.lavNumber) {
            elbeRestrictionOverlays
              .filter((restriction) => restriction.lavNumber === water.lavNumber)
              .forEach((restriction) => {
                const startFraction = (restriction.fromKm - riverRange.from) / (riverRange.to - riverRange.from);
                const endFraction = (restriction.toKm - riverRange.from) / (riverRange.to - riverRange.from);
                const warningParts = restrictionPartsByGuideFraction(
                  displayParts,
                  water.route as LatLngTuple[],
                  startFraction,
                  endFraction
                );
                if (!warningParts.length) return;

                const bankText =
                  restriction.bank === "right" ? "rechtes Ufer" :
                  restriction.bank === "left" ? "linkes Ufer" : "beide Ufer";

                L.polyline(warningParts, {
                  color: "#d32f2f",
                  weight: 7,
                  opacity: 0.92,
                  dashArray: "9 7",
                  lineCap: "round",
                  lineJoin: "round"
                })
                  .bindPopup(
                    `<strong>⚠️ Besondere Einschränkung</strong><br>${restriction.label}` +
                    `<br><small>${bankText} · Elb-km ${String(restriction.fromKm).replace(".", ",")}–${String(restriction.toKm).replace(".", ",")}</small>`
                  )
                  .addTo(layer);

                const middlePart = warningParts[Math.floor(warningParts.length / 2)];
                const middle = middlePart[Math.floor(middlePart.length / 2)];
                L.marker(middle, { icon: warningIcon })
                  .bindPopup(`<strong>⚠️ Uferbetretungsverbot</strong><br>${restriction.label}`)
                  .addTo(layer);
              });
          }
        } else {
          // Keine grobe Gerade über Land als Fallback: wenn die aktuelle
          // OSM-Geometrie nicht verfügbar/zuordenbar ist, nur ein dezenter
          // Mittelpunkt-Marker. So wird niemals eine falsche Angelgrenze gezeigt.
          L.circleMarker(coordinate, {
            radius: selectedWater?.id === water.id ? 7 : 5,
            color: routeColor,
            weight: 2,
            fillColor: "#ffffff",
            fillOpacity: 0.9
          })
            .bindPopup(
              `<strong>${water.name}</strong><br>${water.sectionLabel ?? (water.riverKm ? `${water.waterwayName ?? "Gewässer"}-km ${water.riverKm}` : (water.waterwayName ?? "Fließgewässer"))} · ${bankLabel}` +
              `<br>${water.lavNumber ?? "LAV Sachsen-Anhalt"}${restrictionHtml}` +
              `<br><small>Flusslinie momentan nicht geladen – amtliche Abschnittsgrenzen sind maßgeblich.</small>`
            )
            .on("click", () => selectRef.current(water))
            .addTo(layer);
        }
      }

      // Positions-Angelrute folgt Auswahl/Suche/Filter.
      // Die farbige LAV-Geometrie darf permanent sichtbar bleiben, die 🎣 jedoch nicht.
      const markerVisible = selectedWater
        ? water.id === selectedWater.id
        : waters.some((visibleWater) => visibleWater.id === water.id);

      if (markerVisible) {
        const markerSourceLines = water.waterwayName === "Elbe"
          ? elbeOsmLines
          : water.waterwayName === "Saale"
            ? saaleOsmLines
            : (water.waterwayName ? (waterwayOsmLines[water.waterwayName] ?? []) : []);
        const snappedCoordinate = nearestPointOnOsmLines(
          [water.latitude, water.longitude] as LatLngTuple,
          markerSourceLines
        ) ?? [water.latitude, water.longitude] as LatLngTuple;

        L.marker(snappedCoordinate, { icon: waterIcon })
          .bindPopup(
            `<strong>🎣 ${water.name}</strong><br>${water.lavNumber ?? "LAV Sachsen-Anhalt"}<br>` +
            `${water.sectionLabel ?? (water.waterwayName ?? "Fließgewässer")}<br>` +
            `<small>Positionsmarker des LAV-Abschnitts</small>`
          )
          .on("click", () => selectRef.current(water))
          .addTo(layer);
      }
    });

    normalWaters.forEach((water) => {
      if (water.latitude === null || water.longitude === null) return;

      const rawCoordinate: LatLngTuple = [water.latitude, water.longitude];
      const markerSourceLines = water.waterwayName === "Elbe"
        ? elbeOsmLines
        : water.waterwayName === "Saale"
          ? saaleOsmLines
          : (water.waterwayName ? (waterwayOsmLines[water.waterwayName] ?? []) : []);
      const coordinate = verifiedStandingWaterMarker(water) ??
        standingWaterSnaps[water.id] ??
        nearestPointOnOsmLines(rawCoordinate, markerSourceLines) ??
        rawCoordinate;

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

    const visibleLavNumbers = new Set(routeWaters.map((water) => water.lavNumber).filter(Boolean));
    elbeOrientationPoints
      .filter((point) => visibleLavNumbers.has(point.lavNumber))
      .forEach((point) => {
        const coordinate: L.LatLngExpression = [point.latitude, point.longitude];
        bounds.push(coordinate);
        L.marker(coordinate, { icon: lockIcon })
          .bindPopup(`<strong>🔒 ${point.name}</strong><br>${point.label}`)
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
      const selectedRaw: LatLngTuple = [
        selectedWater.latitude,
        selectedWater.longitude
      ];
      const center: L.LatLngExpression =
        verifiedStandingWaterMarker(selectedWater) ??
        standingWaterSnaps[selectedWater.id] ??
        selectedRaw;

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
  }, [waters, persistentRouteWaters, spots, parkings, selectedWater?.id, elbeOsmLines, saaleOsmLines, waterwayOsmLines, standingWaterSnaps]);

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
