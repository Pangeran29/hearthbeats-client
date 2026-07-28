"use client";

import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";

import type { GpsHistoryPoint } from "@/types/gps";
import styles from "./journey-share-modal.module.css";

type SpeedBand = "slow" | "medium" | "fast";

type SpeedSegment = {
  band: SpeedBand;
  positions: LatLngExpression[];
};

type JourneyShareMapProps = {
  points: GpsHistoryPoint[];
  onReady: () => void;
};

const SPEED_COLORS: Record<SpeedBand, string> = {
  slow: "#168b52",
  medium: "#e7a400",
  fast: "#d93c32",
};

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = ((lat2 - lat1) * Math.PI) / 180;
  const longitudeDelta = ((lon2 - lon1) * Math.PI) / 180;
  const arc =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    earthRadiusMeters *
    Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc))
  );
}

function filterOutliers(points: GpsHistoryPoint[]) {
  if (points.length < 3) {
    return points;
  }

  return points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) {
      return true;
    }

    const previous = points[index - 1];
    const next = points[index + 1];
    const distanceFromPrevious = haversineMeters(
      previous.latitude,
      previous.longitude,
      point.latitude,
      point.longitude,
    );
    const distanceToNext = haversineMeters(
      point.latitude,
      point.longitude,
      next.latitude,
      next.longitude,
    );
    const distanceBetweenNeighbours = haversineMeters(
      previous.latitude,
      previous.longitude,
      next.latitude,
      next.longitude,
    );

    return !(
      distanceFromPrevious > 80 &&
      distanceToNext > 80 &&
      distanceBetweenNeighbours <
        Math.max(distanceFromPrevious, distanceToNext) * 0.5
    );
  });
}

function getSpeedBand(speedKph: number): SpeedBand {
  if (speedKph <= 20) {
    return "slow";
  }

  if (speedKph <= 50) {
    return "medium";
  }

  return "fast";
}

function buildSpeedSegments(points: GpsHistoryPoint[]): SpeedSegment[] {
  if (points.length < 2) {
    return [];
  }

  const segments: SpeedSegment[] = [];
  let band = getSpeedBand(points[1].speedKph);
  let positions: LatLngExpression[] = [
    [points[0].latitude, points[0].longitude],
    [points[1].latitude, points[1].longitude],
  ];

  for (let index = 2; index < points.length; index += 1) {
    const point = points[index];
    const nextBand = getSpeedBand(point.speedKph);
    const position: LatLngExpression = [point.latitude, point.longitude];

    if (nextBand === band) {
      positions.push(position);
      continue;
    }

    segments.push({ band, positions });
    const previous = points[index - 1];
    band = nextBand;
    positions = [
      [previous.latitude, previous.longitude],
      position,
    ];
  }

  segments.push({ band, positions });
  return segments;
}

function FitShareRoute({ points }: { points: GpsHistoryPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      return;
    }

    const bounds = points.map(
      (point) => [point.latitude, point.longitude] as [number, number],
    );

    map.fitBounds(bounds, {
      paddingTopLeft: [12, 24],
      paddingBottomRight: [12, 208],
      animate: false,
    });
    map.invalidateSize({ animate: false });
  }, [map, points]);

  return null;
}

export function JourneyShareMap({
  points,
  onReady,
}: JourneyShareMapProps) {
  const cleanedPoints = useMemo(() => filterOutliers(points), [points]);
  const segments = useMemo(
    () => buildSpeedSegments(cleanedPoints),
    [cleanedPoints],
  );
  const center: LatLngExpression = cleanedPoints[0]
    ? [cleanedPoints[0].latitude, cleanedPoints[0].longitude]
    : [-6.2038, 106.7854];
  const start = cleanedPoints[0];
  const end = cleanedPoints.at(-1);

  return (
    <MapContainer
      className={styles.shareMap}
      center={center}
      zoom={14}
      zoomSnap={0.25}
      zoomControl={false}
      attributionControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      zoomAnimation={false}
      fadeAnimation={false}
      markerZoomAnimation={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        crossOrigin="anonymous"
        eventHandlers={{
          load: onReady,
          tileerror: onReady,
        }}
      />
      <FitShareRoute points={cleanedPoints} />

      {segments.map((segment, index) => (
        <Polyline
          key={`${segment.band}-${index}`}
          positions={segment.positions}
          pathOptions={{
            color: SPEED_COLORS[segment.band],
            weight: 4,
            lineCap: "round",
            lineJoin: "round",
            opacity: 1,
          }}
          smoothFactor={1}
          interactive={false}
        />
      ))}

      {start ? (
        <CircleMarker
          center={[start.latitude, start.longitude]}
          radius={4}
          pathOptions={{
            color: "#fffdf8",
            fillColor: "#168b52",
            fillOpacity: 1,
            weight: 2,
          }}
          interactive={false}
        />
      ) : null}
      {end && end.id !== start?.id ? (
        <CircleMarker
          center={[end.latitude, end.longitude]}
          radius={4}
          pathOptions={{
            color: "#fffdf8",
            fillColor: "#c83e32",
            fillOpacity: 1,
            weight: 2,
          }}
          interactive={false}
        />
      ) : null}
    </MapContainer>
  );
}
