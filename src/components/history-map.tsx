"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import {
  AttributionControl,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";

import type { GpsHistoryPoint } from "@/types/gps";
import styles from "./history-map.module.css";

const startIcon = L.divIcon({
  className: styles.markerBadge,
  html:
    '<span class="' +
    `${styles.routeMarker} ${styles.routeMarkerStart}` +
    '">Start</span>',
  iconSize: [52, 28],
  iconAnchor: [26, 14],
  popupAnchor: [0, -12],
});

const endIcon = L.divIcon({
  className: styles.markerBadge,
  html:
    '<span class="' +
    `${styles.routeMarker} ${styles.routeMarkerEnd}` +
    '">End</span>',
  iconSize: [46, 28],
  iconAnchor: [23, 14],
  popupAnchor: [0, -12],
});

function createLatestLocationIcon(isActive: boolean) {
  const color = isActive ? "#168b52" : "#e4512b";

  return L.divIcon({
    className: styles.markerBadge,
    html: `<span class="${styles.latestLocationPin}"><svg viewBox="0 0 40 48" aria-hidden="true"><path d="M20 46C17.8 42.7 6 30.9 6 19A14 14 0 0 1 34 19c0 11.9-11.8 23.7-14 27Z" fill="${color}" stroke="#fffdf8" stroke-width="3"/><circle cx="20" cy="19" r="6" fill="#fffdf8"/></svg></span>`,
    iconSize: [40, 48],
    iconAnchor: [20, 46],
    popupAnchor: [0, -42],
  });
}

type HistoryMapProps = {
  mode?: "live" | "live-route" | "history" | "route";
  points: GpsHistoryPoint[];
  selectedPointId: number | null;
  onSelectPoint: (pointId: number) => void;
  isSheetExpanded: boolean;
  latestIsActive?: boolean;
};

type SpeedBand = "slow" | "medium" | "fast";

type SpeedSegment = {
  band: SpeedBand;
  positions: LatLngExpression[];
};

const SPEED_BAND_COLORS: Record<SpeedBand, string> = {
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
 * Group adjacent route legs by the speed reported at each leg's endpoint.
 * Every new group starts at the previous point so the colored line stays
 * visually continuous.
 */
function buildSpeedSegments(points: GpsHistoryPoint[]): SpeedSegment[] {
  if (points.length < 2) return [];

  const getBand = (speedKph: number): SpeedBand => {
    if (speedKph <= 20) return "slow";
    if (speedKph <= 50) return "medium";
    return "fast";
  };

  const segments: SpeedSegment[] = [];
  let currentBand = getBand(points[1].speedKph);
  let currentPositions: LatLngExpression[] = [
    [points[0].latitude, points[0].longitude],
    [points[1].latitude, points[1].longitude],
  ];

  for (let index = 2; index < points.length; index += 1) {
    const point = points[index];
    const band = getBand(point.speedKph);
    const position: LatLngExpression = [point.latitude, point.longitude];

    if (band === currentBand) {
      currentPositions.push(position);
      continue;
    }

    segments.push({ band: currentBand, positions: currentPositions });
    const previousPoint = points[index - 1];
    currentBand = band;
    currentPositions = [
      [previousPoint.latitude, previousPoint.longitude],
      position,
    ];
  }

  segments.push({ band: currentBand, positions: currentPositions });
  return segments;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function getShiftedCenter(
  map: L.Map,
  point: GpsHistoryPoint,
  isSheetExpanded: boolean,
) {
  const sheetHeightPx = isSheetExpanded
    ? Math.min(window.innerHeight * 0.68, 620)
    : 214;
  const targetZoom = Math.max(map.getZoom(), 17);
  const projected = map.project(
    [point.latitude, point.longitude],
    targetZoom,
  );
  const shifted = projected.add([0, sheetHeightPx * 0.45]);

  return {
    center: map.unproject(shifted, targetZoom),
    zoom: targetZoom,
  };
}

function fitRouteInView(
  map: L.Map,
  points: GpsHistoryPoint[],
  isSheetExpanded: boolean,
) {
  const coordinates = points.map(
    (point) => [point.latitude, point.longitude] as [number, number],
  );
  const uniqueCoordinates = new Set(
    coordinates.map(([latitude, longitude]) => `${latitude}:${longitude}`),
  );

  if (uniqueCoordinates.size === 1) {
    const [latitude, longitude] = coordinates[0];
    map.setView([latitude, longitude], 17, { animate: false });
    return;
  }

  const requestedBottomPadding = isSheetExpanded
    ? Math.min(Math.round(window.innerHeight * 0.7), 640)
    : 300;
  const topPadding = 32;
  const minimumVisibleHeight = 120;
  const bottomPadding = Math.min(
    requestedBottomPadding,
    Math.max(120, map.getSize().y - topPadding - minimumVisibleHeight),
  );
  const symmetricVerticalPadding = Math.round(
    (topPadding + bottomPadding) / 2,
  );
  const verticalOffset = Math.round((bottomPadding - topPadding) / 2);
  const bounds = L.latLngBounds(coordinates);

  map.fitBounds(bounds, {
    paddingTopLeft: [32, symmetricVerticalPadding],
    paddingBottomRight: [32, symmetricVerticalPadding],
    animate: false,
  });
  map.panBy([0, verticalOffset], { animate: false });
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
      const target = getShiftedCenter(map, selectedPoint, isSheetExpanded);

      if (map.getZoom() < 16) {
        map.flyTo(target.center, target.zoom, {
          duration: 0.7,
        });
      } else {
        map.panTo(target.center, {
          animate: true,
          duration: 0.3,
        });
      }
      return;
    }

    fitRouteInView(map, points, isSheetExpanded);
  }, [isSheetExpanded, map, points, selectedPointId]);

  return null;
}

function RecenterControl({
  point,
  isSheetExpanded,
}: {
  point: GpsHistoryPoint;
  isSheetExpanded: boolean;
}) {
  const map = useMap();

  const recenter = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const target = getShiftedCenter(map, point, isSheetExpanded);
    map.flyTo(target.center, target.zoom, {
      duration: 0.55,
    });
  };

  return createPortal(
    <button
      type="button"
      className={styles.recenterButton}
      onClick={recenter}
      onPointerDown={(event) => event.stopPropagation()}
      aria-label="Kembali ke posisi GPS terbaru"
      title="Kembali ke posisi GPS terbaru"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    </button>,
    map.getContainer(),
  );
}

function RouteOverviewControl({
  isSheetExpanded,
  points,
}: {
  isSheetExpanded: boolean;
  points: GpsHistoryPoint[];
}) {
  const map = useMap();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const button = buttonRef.current;

    if (!button) {
      return;
    }

    let lastActivationAt = 0;

    const showFullRoute = (event: Event) => {
      L.DomEvent.stop(event);
      const activatedAt = Date.now();

      if (activatedAt - lastActivationAt < 300) {
        return;
      }

      lastActivationAt = activatedAt;
      fitRouteInView(map, points, isSheetExpanded);
    };
    const stopMapGesture = (event: Event) => {
      L.DomEvent.stopPropagation(event);
    };

    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.on(button, "pointerdown", stopMapGesture);
    L.DomEvent.on(button, "pointerup", showFullRoute);
    L.DomEvent.on(button, "click", showFullRoute);

    return () => {
      L.DomEvent.off(button, "pointerdown", stopMapGesture);
      L.DomEvent.off(button, "pointerup", showFullRoute);
      L.DomEvent.off(button, "click", showFullRoute);
    };
  }, [isSheetExpanded, map, points]);

  return createPortal(
    <button
      ref={buttonRef}
      type="button"
      className={styles.recenterButton}
      style={{
        bottom: isSheetExpanded
          ? "calc(min(68dvh, 620px) + 64px + env(safe-area-inset-bottom) + 52px)"
          : "calc(330px + env(safe-area-inset-bottom))",
      }}
      aria-label="Tampilkan seluruh rute"
      title="Tampilkan seluruh rute"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    </button>,
    map.getContainer(),
  );
}

function SyncControlOffsets({ isSheetExpanded }: { isSheetExpanded: boolean }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const bottomControls = container.querySelectorAll<HTMLElement>(".leaflet-bottom");

    const bottomOffset = isSheetExpanded
      ? "calc(min(68dvh, 620px) + 64px)"
      : "278px";

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

function SpeedLegend({ isSheetExpanded }: { isSheetExpanded: boolean }) {
  const map = useMap();

  return createPortal(
    <aside
      className={styles.speedLegend}
      style={{
        bottom: isSheetExpanded
          ? "calc(min(68dvh, 620px) + 64px + env(safe-area-inset-bottom) + 12px)"
          : "calc(278px + env(safe-area-inset-bottom) + 12px)",
      }}
      aria-label="Keterangan warna kecepatan rute"
    >
      <span>
        <i className={styles.speedSlow} />
        Pelan
        <small>0–20</small>
      </span>
      <span>
        <i className={styles.speedMedium} />
        Sedang
        <small>21–50</small>
      </span>
      <span>
        <i className={styles.speedFast} />
        Cepat
        <small>&gt;50 km/j</small>
      </span>
    </aside>,
    map.getContainer(),
  );
}

export function HistoryMap({
  mode = "history",
  points,
  selectedPointId,
  onSelectPoint,
  isSheetExpanded,
  latestIsActive = false,
}: HistoryMapProps) {
  const isLivePoint = mode === "live";
  const isLiveRoute = mode === "live-route";
  const isFixedRoute = mode === "history" || mode === "route";
  const showsRoute = !isLivePoint;
  const cleanedPoints = useMemo(() => filterOutliers(points), [points]);
  const speedSegments = useMemo(
    () => (showsRoute ? buildSpeedSegments(cleanedPoints) : []),
    [cleanedPoints, showsRoute],
  );
  const routePositions = useMemo(
    () =>
      cleanedPoints.map(
        (point) =>
          [point.latitude, point.longitude] as LatLngExpression,
      ),
    [cleanedPoints],
  );

  const center: LatLngExpression =
    points.length > 0
      ? [points[0].latitude, points[0].longitude]
      : [-6.2038, 106.7854];
  const startPoint = points[0] ?? null;
  const endPoint = points.at(-1) ?? null;
  const selectedPoint =
    points.find((point) => point.id === selectedPointId) ?? null;
  const selectedPointIsEndpoint =
    selectedPoint?.id === startPoint?.id || selectedPoint?.id === endPoint?.id;

  return (
    <MapContainer
      center={center}
      zoom={15}
      className={styles.map}
      scrollWheelZoom
      zoomControl={false}
      attributionControl={false}
    >
      <AttributionControl position="bottomright" prefix={false} />
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds
        points={points}
        selectedPointId={selectedPointId}
        isSheetExpanded={isSheetExpanded}
      />
      <SyncControlOffsets isSheetExpanded={isSheetExpanded} />
      {showsRoute && points.length > 1 ? (
        <SpeedLegend isSheetExpanded={isSheetExpanded} />
      ) : null}
      {showsRoute && points.length > 1 ? (
        <RouteOverviewControl
          isSheetExpanded={isSheetExpanded}
          points={points}
        />
      ) : null}
      {isLivePoint && endPoint ? (
        <RecenterControl
          point={endPoint}
          isSheetExpanded={isSheetExpanded}
        />
      ) : null}

      {routePositions.length > 1 ? (
        <Polyline
          positions={routePositions}
          pathOptions={{
            color: "#fffdf8",
            weight: 17,
            lineCap: "round",
            lineJoin: "round",
            opacity: 1,
          }}
          smoothFactor={1.5}
          interactive={false}
        />
      ) : null}

      {speedSegments.map((segment, index) =>
        segment.positions.length > 1 ? (
          <Polyline
            key={`${segment.band}-${index}`}
            positions={segment.positions}
            pathOptions={{
              color: SPEED_BAND_COLORS[segment.band],
              weight: 10,
              lineCap: "round",
              lineJoin: "round",
              opacity: 1,
            }}
            smoothFactor={1.5}
            interactive={false}
          />
        ) : null,
      )}

      {(isLivePoint || isLiveRoute) && endPoint ? (
        <Marker
          position={[endPoint.latitude, endPoint.longitude]}
          icon={createLatestLocationIcon(latestIsActive)}
          eventHandlers={{ click: () => onSelectPoint(endPoint.id) }}
        >
          <Popup>
            <strong>{latestIsActive ? "Motor aktif" : "Posisi terakhir"}</strong>
            <br />
            Diterima {formatTimestamp(endPoint.serverReceivedAt)}
            <br />
            <span>Kecepatan: {endPoint.speedKph} km/j</span>
            <br />
            <span>
              Koordinat: {formatCoordinate(endPoint.latitude)},{" "}
              {formatCoordinate(endPoint.longitude)}
            </span>
          </Popup>
        </Marker>
      ) : null}

      {showsRoute &&
      startPoint &&
      (!isLiveRoute || startPoint.id !== endPoint?.id) ? (
        <Marker
          position={[startPoint.latitude, startPoint.longitude]}
          icon={startIcon}
          eventHandlers={{ click: () => onSelectPoint(startPoint.id) }}
        >
          <Popup>
            <strong>Titik mulai</strong>
            <br />
            {formatTimestamp(startPoint.serverReceivedAt)}
            <br />
            <span>Kecepatan: {startPoint.speedKph} km/j</span>
            <br />
            <span>
              Koordinat: {formatCoordinate(startPoint.latitude)},{" "}
              {formatCoordinate(startPoint.longitude)}
            </span>
          </Popup>
        </Marker>
      ) : null}

      {isFixedRoute && endPoint && endPoint.id !== startPoint?.id ? (
        <Marker
          position={[endPoint.latitude, endPoint.longitude]}
          icon={endIcon}
          eventHandlers={{ click: () => onSelectPoint(endPoint.id) }}
        >
          <Popup>
            <strong>Titik akhir</strong>
            <br />
            {formatTimestamp(endPoint.serverReceivedAt)}
            <br />
            <span>Kecepatan: {endPoint.speedKph} km/j</span>
            <br />
            <span>
              Koordinat: {formatCoordinate(endPoint.latitude)},{" "}
              {formatCoordinate(endPoint.longitude)}
            </span>
          </Popup>
        </Marker>
      ) : null}

      {showsRoute && selectedPoint && !selectedPointIsEndpoint ? (
        <CircleMarker
          center={[selectedPoint.latitude, selectedPoint.longitude]}
          radius={7}
          pathOptions={{
            color: "#fffdf8",
            fillColor: "#20231f",
            fillOpacity: 1,
            weight: 3,
          }}
        >
          <Popup>
            <div className={styles.popup}>
              <strong>{formatTimestamp(selectedPoint.serverReceivedAt)}</strong>
              <span>Kecepatan: {selectedPoint.speedKph} km/j</span>
              <span>
                Koordinat: {formatCoordinate(selectedPoint.latitude)},{" "}
                {formatCoordinate(selectedPoint.longitude)}
              </span>
              <span>Arah: {selectedPoint.course}&deg;</span>
            </div>
          </Popup>
        </CircleMarker>
      ) : null}
    </MapContainer>
  );
}
