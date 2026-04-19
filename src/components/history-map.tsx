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
  ZoomControl,
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
  isSheetExpanded: boolean;
};

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Remove GPS spike outliers.
 * A spike is a point that jumps far from both its neighbours while
 * those neighbours remain close to each other — a clear sign of
 * momentary GPS noise rather than real movement.
 */
function filterOutliers(points: GpsHistoryPoint[]): GpsHistoryPoint[] {
  if (points.length < 3) return [...points];

  const SPIKE_METERS = 80;

  const cleaned: GpsHistoryPoint[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dPrev = haversineMeters(
      prev.latitude, prev.longitude, curr.latitude, curr.longitude,
    );
    const dNext = haversineMeters(
      curr.latitude, curr.longitude, next.latitude, next.longitude,
    );
    const dNeighbours = haversineMeters(
      prev.latitude, prev.longitude, next.latitude, next.longitude,
    );

    // Point is a spike if it's far from both neighbours
    // but the neighbours themselves are close to each other
    const isSpike =
      dPrev > SPIKE_METERS &&
      dNext > SPIKE_METERS &&
      dNeighbours < Math.max(dPrev, dNext) * 0.5;

    if (!isSpike) {
      cleaned.push(curr);
    }
  }

  cleaned.push(points[points.length - 1]);
  return cleaned;
}

/**
 * Split points into continuous route segments.
 * A new segment starts when two consecutive points imply an
 * unrealistically high speed or have a very large absolute gap,
 * which indicates a GPS jump or data from a separate trip.
 */
function buildSegments(points: GpsHistoryPoint[]): LatLngExpression[][] {
  if (points.length === 0) return [];

  const MAX_REALISTIC_SPEED_KMH = 150;
  const MAX_ABSOLUTE_GAP_METERS = 500;

  const segments: LatLngExpression[][] = [];
  let current: LatLngExpression[] = [
    [points[0].latitude, points[0].longitude],
  ];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dist = haversineMeters(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude,
    );
    const timeDiffSec =
      Math.abs(
        Date.parse(curr.gpsTimestamp) - Date.parse(prev.gpsTimestamp),
      ) / 1000;

    const impliedSpeedKmh =
      timeDiffSec > 0 ? (dist / timeDiffSec) * 3.6 : Infinity;

    // Break the segment when the jump is unrealistic
    const shouldBreak =
      impliedSpeedKmh > MAX_REALISTIC_SPEED_KMH ||
      dist > MAX_ABSOLUTE_GAP_METERS;

    if (shouldBreak) {
      if (current.length > 0) {
        segments.push(current);
      }
      current = [];
    }

    current.push([curr.latitude, curr.longitude]);
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

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
      if (map.getZoom() < 16) {
        map.flyTo([selectedPoint.latitude, selectedPoint.longitude], 17, {
          duration: 0.7,
        });
      } else {
        map.panTo([selectedPoint.latitude, selectedPoint.longitude], {
          animate: true,
          duration: 0.3,
        });
      }
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

function SyncControlOffsets({ isSheetExpanded }: { isSheetExpanded: boolean }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const bottomControls = container.querySelectorAll<HTMLElement>(".leaflet-bottom");

    let bottomOffset = "250px";

    if (isSheetExpanded) {
      bottomOffset = "78dvh";

      if (window.innerWidth >= 1120) {
        bottomOffset = "64dvh";
      } else if (window.innerWidth >= 760) {
        bottomOffset = "70dvh";
      }
    } else if (window.innerWidth >= 760) {
      bottomOffset = "270px";
    }

    bottomControls.forEach((element) => {
      element.style.bottom = `calc(${bottomOffset} + env(safe-area-inset-bottom) + 12px)`;
    });

    return () => {
      bottomControls.forEach((element) => {
        element.style.bottom = "";
      });
    };
  }, [isSheetExpanded, map]);

  return null;
}

export function HistoryMap({
  points,
  selectedPointId,
  onSelectPoint,
  isSheetExpanded,
}: HistoryMapProps) {
  const cleanedPoints = useMemo(() => filterOutliers(points), [points]);
  const segments = useMemo(() => buildSegments(cleanedPoints), [cleanedPoints]);

  const center: LatLngExpression =
    points.length > 0
      ? [points[0].latitude, points[0].longitude]
      : [-6.2038, 106.7854];
  const startPoint = points[0] ?? null;
  const endPoint = points.at(-1) ?? null;

  return (
    <MapContainer
      center={center}
      zoom={15}
      className={styles.map}
      scrollWheelZoom
      zoomControl={false}
    >
      <TileLayer
        attribution="&copy; Google Maps"
        url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
      />
      <ZoomControl position="bottomright" />
      <FitBounds points={points} selectedPointId={selectedPointId} />
      <SyncControlOffsets isSheetExpanded={isSheetExpanded} />

      {segments.map((segment, idx) =>
        segment.length > 1 ? (
          <Polyline
            key={idx}
            positions={segment}
            pathOptions={{
              color: "#ff6b35",
              weight: 4,
              lineCap: "round",
              lineJoin: "round",
              opacity: 0.85,
            }}
            smoothFactor={1.5}
          />
        ) : null,
      )}

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

      {cleanedPoints.map((point) => {
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
