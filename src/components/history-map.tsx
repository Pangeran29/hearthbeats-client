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
 * Build one continuous route segment from the cleaned points.
 * We intentionally avoid speed/time-based splitting because
 * tracker packet timing can be bursty and create false breaks.
 */
function buildSegments(points: GpsHistoryPoint[]): LatLngExpression[][] {
  if (points.length < 2) return [];

  return [
    points.map((point) => [point.latitude, point.longitude] as LatLngExpression),
  ];
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function FitBounds({
  points,
  selectedPointId,
  isSheetExpanded,
}: {
  points: GpsHistoryPoint[];
  selectedPointId: number | null;
  isSheetExpanded: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      return;
    }

    const selectedPoint =
      points.find((point) => point.id === selectedPointId) ?? null;

    if (selectedPoint) {
      const isWideDesktop = window.innerWidth >= 1120;
      const sheetHeightRatio = window.innerWidth >= 760 ? 0.4 : 0.5;
      const sheetHeightPx = isSheetExpanded
        ? isWideDesktop
          ? 0
          : window.innerHeight * sheetHeightRatio
        : window.innerWidth >= 760
          ? isWideDesktop
            ? 0
            : 250
          : 220;
      const projected = map.project([selectedPoint.latitude, selectedPoint.longitude]);
      const shifted = projected.subtract([0, sheetHeightPx * 0.18]);
      const shiftedLatLng = map.unproject(shifted);

      if (map.getZoom() < 16) {
        map.flyTo(shiftedLatLng, 17, {
          duration: 0.7,
        });
      } else {
        map.panTo(shiftedLatLng, {
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

    const bottomPadding = window.innerWidth >= 1120
      ? 64
      : isSheetExpanded
        ? window.innerWidth >= 760
          ? Math.round(window.innerHeight * 0.42)
          : Math.round(window.innerHeight * 0.52)
        : window.innerWidth >= 760
          ? 300
          : 260;

    map.fitBounds(coordinates as LatLngBoundsExpression, {
      paddingTopLeft: [32, 32],
      paddingBottomRight: [32, bottomPadding],
    });
  }, [isSheetExpanded, map, points, selectedPointId]);

  return null;
}

function SyncControlOffsets({ isSheetExpanded }: { isSheetExpanded: boolean }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const bottomControls = container.querySelectorAll<HTMLElement>(".leaflet-bottom");

    let bottomOffset = "250px";

    if (window.innerWidth >= 1120) {
      bottomOffset = "20px";
    } else if (isSheetExpanded) {
      bottomOffset = window.innerWidth >= 760 ? "40dvh" : "50dvh";
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
  const latestPointId = endPoint?.id ?? null;

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
      <FitBounds
        points={points}
        selectedPointId={selectedPointId}
        isSheetExpanded={isSheetExpanded}
      />
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
            {formatTimestamp(startPoint.serverReceivedAt)}
            <br />
            <span>Speed: {startPoint.speedKph} km/h</span>
            <br />
            <span>
              Coord: {formatCoordinate(startPoint.latitude)},{" "}
              {formatCoordinate(startPoint.longitude)}
            </span>
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
            {formatTimestamp(endPoint.serverReceivedAt)}
            <br />
            <span>Speed: {endPoint.speedKph} km/h</span>
            <br />
            <span>
              Coord: {formatCoordinate(endPoint.latitude)},{" "}
              {formatCoordinate(endPoint.longitude)}
            </span>
          </Popup>
        </Marker>
      ) : null}

      {cleanedPoints.map((point) => {
        const isSelected = point.id === selectedPointId;
        const isLatest = point.id === latestPointId;

        return (
          <CircleMarker
            key={point.id}
            center={[point.latitude, point.longitude]}
            radius={isSelected ? 8 : isLatest ? 7 : 5}
            pathOptions={{
              color: isSelected
                ? "#0f172a"
                : isLatest
                  ? "#1d4ed8"
                  : "#fff7ed",
              fillColor: isSelected
                ? "#fb7185"
                : isLatest
                  ? "#3b82f6"
                  : "#f97316",
              fillOpacity: 0.95,
              weight: isSelected ? 3 : isLatest ? 2 : 1,
            }}
            eventHandlers={{ click: () => onSelectPoint(point.id) }}
          >
            <Popup>
              <div className={styles.popup}>
                <strong>{formatTimestamp(point.serverReceivedAt)}</strong>
                <span>Speed: {point.speedKph} km/h</span>
                <span>
                  Coord: {formatCoordinate(point.latitude)}, {formatCoordinate(point.longitude)}
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
