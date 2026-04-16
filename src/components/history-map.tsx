"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";

import type { GpsHistoryPoint } from "@/types/gps";
import styles from "./history-map.module.css";

const startIcon = L.divIcon({
  className: styles.markerBadge,
  html: '<span class="' + styles.markerInner + '">S</span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const endIcon = L.divIcon({
  className: styles.markerBadge,
  html: '<span class="' + styles.markerInner + '">E</span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

type HistoryMapProps = {
  points: GpsHistoryPoint[];
  selectedPointId: number | null;
  onSelectPoint: (pointId: number) => void;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function FitBounds({
  points,
  selectedPointId,
}: {
  points: GpsHistoryPoint[];
  selectedPointId: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      return;
    }

    const selectedPoint =
      points.find((point) => point.id === selectedPointId) ?? null;

    if (selectedPoint) {
      map.flyTo([selectedPoint.latitude, selectedPoint.longitude], 17, {
        duration: 0.7,
      });
      return;
    }

    const coordinates = points.map(
      (point) => [point.latitude, point.longitude] as [number, number],
    );

    const uniqueCoordinates = new Set(
      coordinates.map(([latitude, longitude]) => `${latitude}:${longitude}`),
    );

    if (uniqueCoordinates.size === 1) {
      const [latitude, longitude] = coordinates[0];
      map.setView([latitude, longitude], 17);
      return;
    }

    map.fitBounds(coordinates as LatLngBoundsExpression, {
      padding: [32, 32],
    });
  }, [map, points, selectedPointId]);

  return null;
}

export function HistoryMap({
  points,
  selectedPointId,
  onSelectPoint,
}: HistoryMapProps) {
  const positions = useMemo<LatLngExpression[]>(
    () => points.map((point) => [point.latitude, point.longitude]),
    [points],
  );

  const center = positions[0] ?? ([-6.2038, 106.7854] as LatLngExpression);
  const startPoint = points[0] ?? null;
  const endPoint = points.at(-1) ?? null;

  return (
    <MapContainer center={center} zoom={15} className={styles.map} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} selectedPointId={selectedPointId} />

      {positions.length > 1 ? (
        <Polyline positions={positions} pathOptions={{ color: "#ff6b35", weight: 4 }} />
      ) : null}

      {startPoint ? (
        <Marker
          position={[startPoint.latitude, startPoint.longitude]}
          icon={startIcon}
          eventHandlers={{ click: () => onSelectPoint(startPoint.id) }}
        >
          <Popup>
            <strong>Start point</strong>
            <br />
            {formatTimestamp(startPoint.gpsTimestamp)}
          </Popup>
        </Marker>
      ) : null}

      {endPoint && endPoint.id !== startPoint?.id ? (
        <Marker
          position={[endPoint.latitude, endPoint.longitude]}
          icon={endIcon}
          eventHandlers={{ click: () => onSelectPoint(endPoint.id) }}
        >
          <Popup>
            <strong>End point</strong>
            <br />
            {formatTimestamp(endPoint.gpsTimestamp)}
          </Popup>
        </Marker>
      ) : null}

      {points.map((point) => {
        const isSelected = point.id === selectedPointId;

        return (
          <CircleMarker
            key={point.id}
            center={[point.latitude, point.longitude]}
            radius={isSelected ? 8 : 5}
            pathOptions={{
              color: isSelected ? "#0f172a" : "#fff7ed",
              fillColor: isSelected ? "#fb7185" : "#f97316",
              fillOpacity: 0.95,
              weight: isSelected ? 3 : 1,
            }}
            eventHandlers={{ click: () => onSelectPoint(point.id) }}
          >
            <Popup>
              <div className={styles.popup}>
                <strong>{formatTimestamp(point.gpsTimestamp)}</strong>
                <span>Speed: {point.speedKph} km/h</span>
                <span>
                  Coord: {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                </span>
                <span>Course: {point.course}&deg;</span>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
