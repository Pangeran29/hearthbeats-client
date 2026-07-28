"use client";

/*
 * THESIS: a calm motorcycle roadbook, not a fleet dashboard.
 * OWN-WORLD: warm paper, charcoal ink, and route orange frame a real map.
 * STORY: locate the motorcycle, judge data freshness, then inspect the journey.
 * FIRST VIEWPORT: map, latest state, and the next navigation choice stay visible.
 * FORM: a centered phone canvas with one map, one sheet, and two destinations.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { GpsHistoryDataset, GpsHistoryPoint } from "@/types/gps";
import styles from "./gps-history-viewer.module.css";

const DynamicHistoryMap = dynamic(
  () => import("@/components/history-map").then((mod) => mod.HistoryMap),
  {
    ssr: false,
    loading: () => <div className={styles.mapLoading}>Menyiapkan peta...</div>,
  },
);

type TrackingMode = "live" | "live-route" | "history" | "route";

type LiveTrackingViewerProps = {
  dataset: GpsHistoryDataset;
  mode: TrackingMode;
  startDate?: string;
  endDate?: string;
  rangeError?: string;
};

const LIVE_POLL_INTERVAL_MS = 10_000;
const TIMELINE_LIMIT = 40;
const COLLAPSED_SHEET_HEIGHT = 214;
const MAX_EXPANDED_SHEET_HEIGHT = 620;
const SHEET_SWIPE_THRESHOLD = 32;
const SHEET_SWIPE_VELOCITY = 0.35;

type SheetDrag = {
  pointerId: number;
  startY: number;
  startHeight: number;
  lastY: number;
  lastTime: number;
  velocityY: number;
};

function formatTime(value: string, includeDate = false) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: includeDate ? "numeric" : undefined,
    month: includeDate ? "short" : undefined,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatDateRange(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) {
    return "Pilih rentang tanggal";
  }

  const formatter = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  return `${formatter.format(new Date(`${startDate}T12:00:00+07:00`))} - ${formatter.format(
    new Date(`${endDate}T12:00:00+07:00`),
  )}`;
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function formatElapsedDuration(startAt: string, endAt: number) {
  const startTime = Date.parse(startAt);

  if (Number.isNaN(startTime)) {
    return "-";
  }

  const totalMinutes = Math.max(0, Math.floor((endAt - startTime) / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days} hr ${hours} jam`;
  }

  if (hours > 0) {
    return `${hours} jam ${minutes} mnt`;
  }

  return `${minutes} mnt`;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineKm(left: GpsHistoryPoint, right: GpsHistoryPoint) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(right.latitude - left.latitude);
  const lonDelta = toRadians(right.longitude - left.longitude);
  const leftLat = toRadians(left.latitude);
  const rightLat = toRadians(right.latitude);
  const arc =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lonDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function calculateDistance(points: GpsHistoryPoint[]) {
  let totalKm = 0;

  for (let index = 1; index < points.length; index += 1) {
    totalKm += haversineKm(points[index - 1], points[index]);
  }

  return totalKm;
}

function getPointKey(point: GpsHistoryPoint) {
  return point.sourceId !== undefined
    ? `source:${String(point.sourceId)}`
    : `${point.serverReceivedAt}:${point.latitude}:${point.longitude}`;
}

function normalizePointIds(points: GpsHistoryPoint[]) {
  return points.map((point, index) => ({ ...point, id: index + 1 }));
}

function getFreshness(value: string, now: number) {
  const receivedAt = Date.parse(value);

  if (Number.isNaN(receivedAt)) {
    return {
      isActive: false,
      tone: "offline",
      label: "Waktu tidak diketahui",
    };
  }

  const ageSeconds = Math.max(0, Math.floor((now - receivedAt) / 1000));
  const ageMinutes = Math.floor(ageSeconds / 60);
  const isActive = ageSeconds < 5 * 60;

  if (isActive) {
    return { isActive, tone: "live", label: "Motor aktif" };
  }

  let elapsed = `${ageMinutes} mnt lalu`;

  if (ageMinutes >= 24 * 60) {
    elapsed = `${Math.floor(ageMinutes / (24 * 60))} hari lalu`;
  } else if (ageMinutes >= 60) {
    elapsed = `${Math.floor(ageMinutes / 60)} jam lalu`;
  }

  return {
    isActive,
    tone: "offline",
    label: `Terakhir aktif ${elapsed}`,
  };
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </svg>
  );
}

function HeartbeatMark() {
  return (
    <svg
      aria-hidden="true"
      className={styles.brandMark}
      viewBox="0 0 32 32"
      fill="none"
    >
      <path
        d="M3 17h6l2.8-7 5.1 14L20 17h9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LiveTrackingViewer({
  dataset,
  mode,
  startDate,
  endDate,
  rangeError,
}: LiveTrackingViewerProps) {
  const initialPoints = normalizePointIds(dataset.points);
  const isLiveMode = mode === "live" || mode === "live-route";
  const hasRouteDetails = mode !== "live";
  const isHistoryDestination = mode === "history" || mode === "route";
  const [points, setPoints] = useState(initialPoints);
  const [selectedPointId, setSelectedPointId] = useState<number | null>(
    isLiveMode ? initialPoints.at(-1)?.id ?? null : null,
  );
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [sheetDragHeight, setSheetDragHeight] = useState<number | null>(null);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const sheetDragRef = useRef<SheetDrag | null>(null);
  const sheetDragCleanupRef = useRef<(() => void) | null>(null);
  const didDragSheetRef = useRef(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const latestTimestampRef = useRef(dataset.latestServerReceivedAt);
  const nextIdRef = useRef(initialPoints.length);

  useEffect(() => {
    return () => sheetDragCleanupRef.current?.();
  }, []);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!isLiveMode || dataset.status !== "ready") {
      return;
    }

    let mounted = true;
    let requestInFlight = false;

    const refresh = async () => {
      if (requestInFlight) {
        return;
      }

      requestInFlight = true;

      try {
        const response = await fetch(
          `/api/gps-history?imei=${encodeURIComponent(dataset.imei)}&start_at=${encodeURIComponent(
            latestTimestampRef.current,
          )}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("Pembaruan lokasi gagal.");
        }

        const payload: GpsHistoryDataset = await response.json();

        if (!mounted || payload.status === "error") {
          if (mounted && payload.status === "error") {
            setPollError(payload.message);
          }
          return;
        }

        latestTimestampRef.current =
          payload.latestServerReceivedAt || latestTimestampRef.current;
        setPollError(null);

        setPoints((current) => {
          const keys = new Set(current.map(getPointKey));
          const merged = [...current];

          for (const point of payload.points) {
            if (keys.has(getPointKey(point))) {
              continue;
            }

            nextIdRef.current += 1;
            keys.add(getPointKey(point));
            merged.push({ ...point, id: nextIdRef.current });
          }

          const latest = merged.at(-1);
          if (latest) {
            setSelectedPointId(latest.id);
          }
          return merged;
        });
      } catch (error) {
        if (mounted) {
          setPollError(
            error instanceof Error ? error.message : "Pembaruan lokasi gagal.",
          );
        }
      } finally {
        requestInFlight = false;
      }
    };

    const interval = window.setInterval(refresh, LIVE_POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [dataset.imei, dataset.status, isLiveMode]);

  const latestPoint = points.at(-1) ?? null;
  const peakSpeed =
    points.length > 0 ? Math.max(...points.map((point) => point.speedKph)) : 0;
  const distance = calculateDistance(points);
  const elapsedTracking = formatElapsedDuration(dataset.startAt, now);
  const freshness = getFreshness(
    latestPoint?.serverReceivedAt ?? dataset.latestServerReceivedAt,
    now,
  );
  const mapPoints =
    mode === "live" ? (latestPoint ? [latestPoint] : []) : points;
  const timelinePoints = points.slice(-TIMELINE_LIMIT).reverse();
  const historyHref = `/live-tracking/${encodeURIComponent(dataset.imei)}/history`;
  const liveHref = `/live-tracking/${encodeURIComponent(dataset.imei)}`;
  const hasError = dataset.status === "error";
  const datasetError =
    dataset.status === "error"
      ? "Lokasi belum bisa dimuat. Periksa koneksi lalu buka kembali halaman ini."
      : null;

  const getExpandedSheetHeight = () =>
    Math.min(window.innerHeight * 0.68, MAX_EXPANDED_SHEET_HEIGHT);

  const handleSheetPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!hasRouteDetails || event.button !== 0) {
      return;
    }

    event.preventDefault();
    sheetDragCleanupRef.current?.();
    const now = performance.now();
    const startHeight = isSheetExpanded
      ? getExpandedSheetHeight()
      : COLLAPSED_SHEET_HEIGHT;

    sheetDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight,
      lastY: event.clientY,
      lastTime: now,
      velocityY: 0,
    };
    didDragSheetRef.current = false;
    setSheetDragHeight(startHeight);
    setIsSheetDragging(true);

    const moveSheet = (moveEvent: PointerEvent) => {
      const drag = sheetDragRef.current;

      if (!drag || drag.pointerId !== moveEvent.pointerId) {
        return;
      }

      moveEvent.preventDefault();
      const moveTime = performance.now();
      const elapsed = Math.max(moveTime - drag.lastTime, 1);
      const deltaY = moveEvent.clientY - drag.startY;
      const expandedHeight = getExpandedSheetHeight();
      const nextHeight = Math.min(
        expandedHeight,
        Math.max(COLLAPSED_SHEET_HEIGHT, drag.startHeight - deltaY),
      );

      drag.velocityY = (moveEvent.clientY - drag.lastY) / elapsed;
      drag.lastY = moveEvent.clientY;
      drag.lastTime = moveTime;
      didDragSheetRef.current =
        didDragSheetRef.current || Math.abs(deltaY) > 8;
      setSheetDragHeight(nextHeight);
    };

    const finishSheet = (finishEvent: PointerEvent) => {
      const drag = sheetDragRef.current;

      if (!drag || drag.pointerId !== finishEvent.pointerId) {
        return;
      }

      const deltaY = finishEvent.clientY - drag.startY;
      const movedFarEnough = Math.abs(deltaY) >= SHEET_SWIPE_THRESHOLD;
      const movedFastEnough =
        Math.abs(drag.velocityY) >= SHEET_SWIPE_VELOCITY;
      const didDrag =
        didDragSheetRef.current || movedFarEnough || movedFastEnough;

      if (didDrag) {
        const currentHeight = Math.min(
          getExpandedSheetHeight(),
          Math.max(
            COLLAPSED_SHEET_HEIGHT,
            drag.startHeight - deltaY,
          ),
        );
        const shouldExpand = movedFastEnough
          ? drag.velocityY < 0
          : movedFarEnough
            ? deltaY < 0
            : currentHeight >
              (COLLAPSED_SHEET_HEIGHT + getExpandedSheetHeight()) / 2;
        setIsSheetExpanded(shouldExpand);
      }

      didDragSheetRef.current = didDrag;
      sheetDragRef.current = null;
      sheetDragCleanupRef.current?.();
      setSheetDragHeight(null);
      setIsSheetDragging(false);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", moveSheet);
      window.removeEventListener("pointerup", finishSheet);
      window.removeEventListener("pointercancel", finishSheet);
      sheetDragCleanupRef.current = null;
    };

    sheetDragCleanupRef.current = cleanup;
    window.addEventListener("pointermove", moveSheet, { passive: false });
    window.addEventListener("pointerup", finishSheet);
    window.addEventListener("pointercancel", finishSheet);
  };

  const handleSheetClick = () => {
    if (didDragSheetRef.current) {
      didDragSheetRef.current = false;
      return;
    }

    setIsSheetExpanded((current) => !current);
  };

  return (
    <main className={styles.viewport}>
      <section className={styles.appCanvas}>
        <header className={styles.topBar}>
          <HeartbeatMark />
          <div className={styles.vehicleIdentity}>
            <strong>Motor Saya</strong>
            <span>IMEI {dataset.imei}</span>
          </div>
          <div
            className={`${styles.freshness} ${
              mode === "route" ? styles.routeTone : styles[freshness.tone]
            }`}
          >
            <span />
            {mode === "route"
              ? "Rute perjalanan"
              : mode === "live-route" && freshness.isActive
                ? "Melacak langsung"
                : freshness.label}
          </div>
        </header>

        {mode === "history" ? (
          <form className={styles.datePanel} method="get">
            <div className={styles.datePanelHeading}>
              <div>
                <strong>Riwayat perjalanan</strong>
                <span>{formatDateRange(startDate, endDate)}</span>
              </div>
              <button type="submit">Tampilkan</button>
            </div>
            <div className={styles.dateFields}>
              <label>
                <span>Dari</span>
                <input
                  type="date"
                  name="start_date"
                  defaultValue={startDate}
                  required
                />
              </label>
              <label>
                <span>Sampai</span>
                <input
                  type="date"
                  name="end_date"
                  defaultValue={endDate}
                  required
                />
              </label>
            </div>
            {rangeError ? <p className={styles.fieldError}>{rangeError}</p> : null}
          </form>
        ) : null}

        <section className={styles.mapRegion} aria-label="Peta lokasi motor">
          <DynamicHistoryMap
            key={mode}
            mode={mode}
            points={mapPoints}
            selectedPointId={selectedPointId}
            onSelectPoint={setSelectedPointId}
            isSheetExpanded={isSheetExpanded}
            latestIsActive={freshness.isActive}
          />

          {(hasError || pollError) && (
            <div
              className={`${styles.warning} ${
                mode === "history" ? styles.warningHistory : ""
              }`}
              role="status"
            >
              <strong>Data belum dapat diperbarui</strong>
              <span>{pollError ?? datasetError}</span>
            </div>
          )}

          {points.length === 0 && !hasError ? (
            <div className={styles.emptyMap}>
              <strong>Belum ada titik lokasi</strong>
              <span>
                {mode === "live"
                  ? "Lokasi hari ini akan muncul saat perangkat mengirim data."
                  : mode === "live-route"
                    ? "Belum ada lokasi sejak waktu mulai. Halaman akan memperbarui data secara otomatis."
                  : "Coba pilih rentang tanggal lain."}
              </span>
            </div>
          ) : null}
        </section>

        <section
          className={`${styles.bottomSheet} ${
            !hasRouteDetails
              ? styles.liveSheet
              : isSheetExpanded
                ? styles.sheetExpanded
                : styles.sheetCollapsed
          } ${isSheetDragging ? styles.sheetDragging : ""}`}
          style={
            hasRouteDetails && sheetDragHeight !== null
              ? { height: `${sheetDragHeight}px` }
              : undefined
          }
        >
          {hasRouteDetails ? (
            <button
              type="button"
              className={styles.sheetHandle}
              onClick={handleSheetClick}
              onPointerDown={handleSheetPointerDown}
              aria-expanded={isSheetExpanded}
            >
              <span className={styles.sheetGrip} />
              <span className={styles.srOnly}>
                {isSheetExpanded
                  ? "Tutup detail perjalanan"
                  : "Buka detail perjalanan"}
              </span>
            </button>
          ) : (
            <div className={styles.sheetHandle} aria-hidden="true">
              <span className={styles.sheetGrip} />
            </div>
          )}

          <div className={styles.sheetScroll}>
            <div className={styles.sheetHeading}>
              <div>
                <span>
                  {mode === "live"
                    ? freshness.isActive
                      ? "Motor aktif"
                      : "Posisi terakhir"
                    : mode === "live-route"
                      ? `Tracking sejak ${formatTime(dataset.startAt, true)}`
                    : "Ringkasan rute"}
                </span>
                <h1>
                  {latestPoint
                    ? isLiveMode
                      ? `Diterima ${formatTime(latestPoint.serverReceivedAt, true)}`
                      : formatTime(latestPoint.serverReceivedAt, true)
                    : "Belum tersedia"}
                </h1>
              </div>
              <div className={styles.speedMetric}>
                <strong>{Math.round(latestPoint?.speedKph ?? 0)}</strong>
                <span>km/j</span>
              </div>
            </div>

            {hasRouteDetails ? (
              <div className={styles.metrics}>
                <div>
                  <span>Jarak</span>
                  <strong>{distance.toFixed(2)} km</strong>
                </div>
                <div>
                  <span>Kecepatan tertinggi</span>
                  <strong>{Math.round(peakSpeed)} km/j</strong>
                </div>
                <div>
                  <span>{mode === "live-route" ? "Durasi" : "Titik GPS"}</span>
                  <strong>
                    {mode === "live-route" ? elapsedTracking : points.length}
                  </strong>
                </div>
              </div>
            ) : (
              <div className={styles.metrics}>
                <div>
                  <span>Kecepatan</span>
                  <strong>{Math.round(latestPoint?.speedKph ?? 0)} km/j</strong>
                </div>
                <div>
                  <span>Sinyal GPS</span>
                  <strong>
                    {latestPoint ? `${latestPoint.satelliteCount} satelit` : "-"}
                  </strong>
                </div>
                <div>
                  <span>Arah</span>
                  <strong>{latestPoint ? `${Math.round(latestPoint.course)}°` : "-"}</strong>
                </div>
              </div>
            )}

            <div className={styles.latestDetails}>
              <div>
                <span>Koordinat</span>
                <strong>
                  {latestPoint
                    ? `${formatCoordinate(latestPoint.latitude)}, ${formatCoordinate(
                        latestPoint.longitude,
                      )}`
                    : "-"}
                </strong>
              </div>
              <div>
                <span>{!hasRouteDetails ? "Status" : "Sinyal GPS"}</span>
                <strong>
                  {!hasRouteDetails
                    ? latestPoint
                      ? freshness.isActive
                        ? "Motor aktif"
                        : "Tidak aktif"
                      : "-"
                    : latestPoint
                      ? `${latestPoint.satelliteCount} satelit`
                      : "-"}
                </strong>
              </div>
            </div>

            {hasRouteDetails ? <section className={styles.timeline}>
              <div className={styles.timelineHeading}>
                <h2>Catatan perjalanan</h2>
                <span>{Math.min(points.length, TIMELINE_LIMIT)} titik terbaru</span>
              </div>
              {timelinePoints.length === 0 ? (
                <p className={styles.timelineEmpty}>Belum ada data perjalanan.</p>
              ) : (
                <div className={styles.timelineList}>
                  {timelinePoints.map((point) => (
                    <button
                      type="button"
                      key={point.id}
                      className={
                        point.id === selectedPointId
                          ? `${styles.timelineItem} ${styles.timelineItemSelected}`
                          : styles.timelineItem
                      }
                      onClick={() => setSelectedPointId(point.id)}
                    >
                      <span className={styles.timelineDot} />
                      <span className={styles.timelineContent}>
                        <strong>{formatTime(point.serverReceivedAt, true)}</strong>
                        <span>
                          {formatCoordinate(point.latitude)},{" "}
                          {formatCoordinate(point.longitude)}
                        </span>
                      </span>
                      <span className={styles.timelineReading}>
                        <strong>{Math.round(point.speedKph)} km/j</strong>
                        <span>{point.satelliteCount} satelit</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section> : null}
          </div>
        </section>

        <nav className={styles.bottomNav} aria-label="Navigasi pelacakan">
          <Link
            href={liveHref}
            className={isLiveMode ? styles.navActive : undefined}
            aria-current={isLiveMode ? "page" : undefined}
          >
            <MapIcon />
            <span>Live</span>
          </Link>
          <Link
            href={historyHref}
            className={isHistoryDestination ? styles.navActive : undefined}
            aria-current={isHistoryDestination ? "page" : undefined}
          >
            <HistoryIcon />
            <span>Riwayat</span>
          </Link>
        </nav>
      </section>
    </main>
  );
}
