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
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import type {
  DailyRideSummary,
  DeviceActivity,
  GpsHistoryDataset,
  GpsHistoryPoint,
  TrackingSession,
  TrackingSessionsDataset,
} from "@/types/gps";
import { JourneyShareModal } from "./journey-share-modal";
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
  historyDate?: string;
  sessionsDataset?: TrackingSessionsDataset;
  selectedSession?: TrackingSession;
  deviceActivity?: DeviceActivity;
  dailyRideSummary?: DailyRideSummary;
  dateError?: string;
  sessionSelectionError?: string;
};

const LIVE_POLL_INTERVAL_MS = 10_000;
const DAILY_SUMMARY_POLL_INTERVAL_MS = 60_000;
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

function formatCalendarDate(value?: string) {
  if (!value) {
    return "Pilih tanggal";
  }

  const formatter = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  return formatter.format(new Date(`${value}T12:00:00+07:00`));
}

function formatClock(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatRouteDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatDurationSeconds(value: number) {
  const totalMinutes = Math.max(0, Math.floor(value / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours} jam ${minutes} mnt`;
  }

  return `${minutes} mnt`;
}

function formatWibDateKey(value: number) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatWibGreeting(value: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    }).format(new Date(value)),
  );

  if (hour >= 5 && hour < 11) {
    return "Selamat pagi";
  }
  if (hour >= 11 && hour < 15) {
    return "Selamat siang";
  }
  if (hour >= 15 && hour < 18) {
    return "Selamat sore";
  }
  return "Selamat malam";
}

function formatDecimal(value: number, digits: number) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatRidingTime(value: number) {
  const totalMinutes =
    value > 0 ? Math.max(1, Math.round(value / 60)) : 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}j ${minutes}m` : `${hours} jam`;
  }

  return `${minutes} mnt`;
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
  let tone = "stale";

  if (ageMinutes >= 24 * 60) {
    elapsed = `${Math.floor(ageMinutes / (24 * 60))} hari lalu`;
  } else if (ageMinutes >= 60) {
    elapsed = `${Math.floor(ageMinutes / 60)} jam lalu`;
  }

  if (ageMinutes >= 60) {
    tone = "offline";
  }

  return {
    isActive,
    tone,
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

function ServiceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5l-7.7 7.7a2.1 2.1 0 0 0 3 3l7.7-7.7a4 4 0 0 0 5-5L18 5l-2.4 2.4-2.3-2.3Z" />
    </svg>
  );
}

function FuelIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 21V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17M3 21h15" />
      <path d="M8 6h5v4H8zM16 7h2l2 2v7a2 2 0 0 0 2 2V9l-2-2" />
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

function BatteryIcon({ level }: { level?: number }) {
  const normalizedLevel =
    typeof level === "number" ? Math.min(6, Math.max(0, level)) : 0;
  const fillWidth = level === undefined ? 0 : 2 + (normalizedLevel / 6) * 12;

  return (
    <svg viewBox="0 0 22 14" aria-hidden="true">
      <rect x="1" y="2" width="17" height="10" rx="2" />
      <path d="M20 5v4" />
      {fillWidth > 0 ? (
        <rect
          className={styles.batteryFill}
          x="3"
          y="4"
          width={fillWidth}
          height="6"
          rx="1"
        />
      ) : null}
    </svg>
  );
}

function getBatteryStatus(level?: number) {
  switch (level) {
    case 0:
      return { label: "Habis", tone: "batteryCritical" };
    case 1:
      return { label: "Kritis", tone: "batteryCritical" };
    case 2:
      return { label: "Rendah", tone: "batteryWarning" };
    case 3:
      return { label: "Cukup", tone: "batteryNeutral" };
    case 4:
      return { label: "Sedang", tone: "batteryNeutral" };
    case 5:
      return { label: "Baik", tone: "batteryGood" };
    case 6:
      return { label: "Penuh", tone: "batteryGood" };
    default:
      return { label: "Tidak diketahui", tone: "batteryNeutral" };
  }
}

function getEngineStatus(status?: DeviceActivity["engineStatus"]) {
  if (status === "on") {
    return { label: "Motor hidup", tone: "engineOn" };
  }

  if (status === "off") {
    return { label: "Motor mati", tone: "engineOff" };
  }

  return { label: "Status tidak diketahui", tone: "engineUnknown" };
}

export function LiveTrackingViewer({
  dataset,
  mode,
  historyDate,
  sessionsDataset,
  selectedSession,
  deviceActivity,
  dailyRideSummary,
  dateError,
  sessionSelectionError,
}: LiveTrackingViewerProps) {
  const initialPoints = normalizePointIds(dataset.points);
  const isLiveDestination = mode === "live" || mode === "live-route";
  const isHistoryIndex = mode === "history" && !selectedSession;
  const isHistorySelected = mode === "history" && Boolean(selectedSession);
  const shouldPoll =
    isLiveDestination || selectedSession?.state === "ongoing";
  const hasRouteDetails = mode !== "live" && !isHistoryIndex;
  const hasSheetInteraction = mode !== "live";
  const isHistoryDestination = mode === "history" || mode === "route";
  const [points, setPoints] = useState(initialPoints);
  const [selectedPointId, setSelectedPointId] = useState<number | null>(
    shouldPoll ? initialPoints.at(-1)?.id ?? null : null,
  );
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [sheetDragHeight, setSheetDragHeight] = useState<number | null>(null);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const sheetDragRef = useRef<SheetDrag | null>(null);
  const sheetDragCleanupRef = useRef<(() => void) | null>(null);
  const didDragSheetRef = useRef(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isDatePending, startDateTransition] = useTransition();
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [currentDailySummary, setCurrentDailySummary] =
    useState(dailyRideSummary);
  const router = useRouter();
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
    if (!shouldPoll || dataset.status !== "ready") {
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
  }, [dataset.imei, dataset.status, shouldPoll]);

  useEffect(() => {
    if (mode !== "live") {
      return;
    }

    let mounted = true;
    let requestInFlight = false;

    const refresh = async () => {
      if (requestInFlight) {
        return;
      }

      requestInFlight = true;
      const date = formatWibDateKey(Date.now());

      try {
        const response = await fetch(
          `/api/daily-summary?imei=${encodeURIComponent(
            dataset.imei,
          )}&date=${encodeURIComponent(date)}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          return;
        }

        const payload: DailyRideSummary = await response.json();
        if (mounted) {
          setCurrentDailySummary(payload);
        }
      } catch {
        // Preserve the last successful summary while connectivity recovers.
      } finally {
        requestInFlight = false;
      }
    };

    const interval = window.setInterval(
      refresh,
      DAILY_SUMMARY_POLL_INTERVAL_MS,
    );
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [dataset.imei, mode]);

  const latestPoint = points.at(-1) ?? null;
  const peakSpeed =
    points.length > 0 ? Math.max(...points.map((point) => point.speedKph)) : 0;
  const distance = calculateDistance(points);
  const freshness = getFreshness(
    latestPoint?.serverReceivedAt ?? dataset.latestServerReceivedAt,
    now,
  );
  const batteryStatus = getBatteryStatus(
    deviceActivity?.batteryVoltageLevel,
  );
  const engineStatus = getEngineStatus(deviceActivity?.engineStatus);
  const mapPoints =
    mode === "live" ? (latestPoint ? [latestPoint] : []) : points;
  const mapMode =
    isHistorySelected && selectedSession?.state === "ongoing"
      ? "live-route"
      : isHistorySelected
        ? "route"
        : mode;
  const historyHref = `/live-tracking/${encodeURIComponent(dataset.imei)}/history`;
  const liveHref = `/live-tracking/${encodeURIComponent(dataset.imei)}`;
  const serviceHref = `/live-tracking/${encodeURIComponent(dataset.imei)}/service`;
  const fuelHref = `/live-tracking/${encodeURIComponent(dataset.imei)}/fuel`;
  const latestCoordinates = latestPoint
    ? `${formatCoordinate(latestPoint.latitude)}, ${formatCoordinate(
        latestPoint.longitude,
      )}`
    : null;
  const readyDailySummary =
    currentDailySummary?.status === "ready" ? currentDailySummary : null;
  const greeting = formatWibGreeting(
    currentDailySummary?.generatedAt ?? dataset.latestServerReceivedAt,
  );
  const greetingName = currentDailySummary?.customerName?.trim();
  const dailySummaryDate =
    currentDailySummary?.date ?? formatWibDateKey(now);
  const hasError = dataset.status === "error";
  const datasetError =
    dataset.status === "error"
      ? "Lokasi belum bisa dimuat. Periksa koneksi lalu buka kembali halaman ini."
      : null;
  const historySessions = sessionsDataset?.sessions ?? [];
  const sessionsError =
    sessionsDataset?.status === "error"
      ? "Daftar perjalanan belum bisa dimuat. Coba lagi beberapa saat."
      : null;
  const routeStartAt = selectedSession?.startedAt ?? dataset.startAt;
  const routeEndAt = selectedSession?.endedAt ?? dataset.endAt;
  const routeDuration =
    selectedSession?.state === "completed"
      ? formatDurationSeconds(selectedSession.durationSeconds)
      : formatElapsedDuration(
          routeStartAt,
          routeEndAt ? Date.parse(routeEndAt) : now,
        );
  const routeTimeRange = `${formatClock(routeStartAt)} - ${
    routeEndAt ? formatClock(routeEndAt) : "sekarang"
  }`;

  const handleHistorySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dateInput = event.currentTarget.elements.namedItem(
      "date",
    ) as HTMLInputElement | null;
    const date = dateInput?.value;

    if (!date) {
      return;
    }

    startDateTransition(() => {
      router.push(`${historyHref}?date=${encodeURIComponent(date)}`, {
        scroll: false,
      });
    });
  };

  const getExpandedSheetHeight = () =>
    Math.min(window.innerHeight * 0.68, MAX_EXPANDED_SHEET_HEIGHT);

  const handleSheetPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!hasSheetInteraction || event.button !== 0) {
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
          <div className={styles.headerStatus}>
            <div
              className={`${styles.statusItem} ${styles.connectionStatus} ${
                styles[engineStatus.tone]
              }`}
              aria-label={engineStatus.label}
            >
              <span aria-hidden="true" />
              <span>{engineStatus.label}</span>
            </div>
            <div
              className={`${styles.statusItem} ${styles.batteryStatus} ${
                styles[batteryStatus.tone]
              }`}
              aria-label={`Baterai ${batteryStatus.label}`}
              title={
                deviceActivity?.batteryReportedAt
                  ? `Status baterai diterima ${formatTime(
                      deviceActivity.batteryReportedAt,
                      true,
                    )}`
                  : "Status baterai belum tersedia"
              }
            >
              <BatteryIcon level={deviceActivity?.batteryVoltageLevel} />
              <span aria-hidden="true">{batteryStatus.label}</span>
            </div>
          </div>
        </header>

        {isHistoryIndex ? (
          <form
            className={styles.datePanel}
            method="get"
            onSubmit={handleHistorySubmit}
            aria-busy={isDatePending}
          >
            <div className={styles.datePanelHeading}>
              <strong>Riwayat perjalanan</strong>
              <span>{formatCalendarDate(historyDate)}</span>
            </div>
            <div className={styles.dateFields}>
              <label>
                <span className={styles.srOnly}>Tanggal perjalanan</span>
                <input
                  key={historyDate}
                  type="date"
                  name="date"
                  defaultValue={historyDate}
                  required
                />
              </label>
              <button type="submit" disabled={isDatePending}>
                {isDatePending ? "Memuat..." : "Tampilkan"}
              </button>
            </div>
            {dateError ? (
              <p className={styles.fieldError}>{dateError}</p>
            ) : null}
          </form>
        ) : null}

        <section className={styles.mapRegion} aria-label="Peta lokasi motor">
          <DynamicHistoryMap
            key={`${mapMode}-${selectedSession?.id ?? "none"}`}
            mode={mapMode}
            points={mapPoints}
            selectedPointId={selectedPointId}
            onSelectPoint={setSelectedPointId}
            isSheetExpanded={isSheetExpanded}
            latestIsActive={freshness.isActive}
          />

          {selectedSession?.state === "completed" && points.length > 1 ? (
            <button
              type="button"
              className={styles.mapShareButton}
              style={{
                bottom: isSheetExpanded
                  ? "calc(min(68dvh, 620px) + 64px + env(safe-area-inset-bottom) + 110px)"
                  : "calc(388px + env(safe-area-inset-bottom))",
              }}
              onClick={() => setIsShareOpen(true)}
              aria-label="Bagikan perjalanan"
              title="Bagikan perjalanan"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
              </svg>
            </button>
          ) : null}

          {(hasError || pollError) && (
            <div
              className={`${styles.warning} ${
                isHistoryIndex ? styles.warningHistory : ""
              }`}
              role="status"
            >
              <strong>Data belum dapat diperbarui</strong>
              <span>{pollError ?? datasetError}</span>
            </div>
          )}

          {(isHistoryIndex || points.length === 0) && !hasError ? (
            <div className={styles.emptyMap}>
              <strong>
                {isHistoryIndex
                  ? "Pilih perjalanan"
                  : "Belum ada titik GPS"}
              </strong>
              <span>
                {isHistoryIndex
                  ? "Pilih salah satu sesi untuk melihat rute di peta."
                  : mode === "live"
                  ? "Posisi akan muncul saat perangkat mengirim data GPS."
                  : mode === "live-route"
                    ? "Belum ada lokasi sejak waktu mulai. Halaman akan memperbarui data secara otomatis."
                    : isHistorySelected
                      ? "Belum ada titik GPS untuk perjalanan ini."
                      : "Belum ada lokasi pada periode ini."}
              </span>
            </div>
          ) : null}
        </section>

        <section
          className={`${styles.bottomSheet} ${
            !hasSheetInteraction
              ? styles.liveSheet
              : isSheetExpanded
                ? styles.sheetExpanded
                : styles.sheetCollapsed
          } ${isSheetDragging ? styles.sheetDragging : ""}`}
          style={
            hasSheetInteraction && sheetDragHeight !== null
              ? { height: `${sheetDragHeight}px` }
              : undefined
          }
        >
          {hasSheetInteraction ? (
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
            {isHistoryIndex ? (
              <section className={styles.sessionPicker}>
                <div className={styles.sessionPickerHeading}>
                  <div>
                    <span>{formatCalendarDate(historyDate)}</span>
                    <h1>{historySessions.length} perjalanan</h1>
                  </div>
                  <span>Pilih sesi</span>
                </div>

                {sessionSelectionError ? (
                  <p className={styles.sessionNotice}>
                    {sessionSelectionError}
                  </p>
                ) : null}
                {sessionsError ? (
                  <p className={styles.sessionNotice}>{sessionsError}</p>
                ) : null}

                {sessionsDataset?.status === "ready" &&
                historySessions.length === 0 ? (
                  <div className={styles.sessionEmpty}>
                    <strong>Belum ada perjalanan</strong>
                    <span>
                      Tidak ada sesi motor pada tanggal yang dipilih.
                    </span>
                  </div>
                ) : (
                  <div className={styles.sessionList}>
                    {historySessions.map((session) => (
                      <Link
                        key={session.id}
                        className={styles.sessionItem}
                        href={`${historyHref}?date=${encodeURIComponent(
                          historyDate ?? "",
                        )}&session_id=${session.id}`}
                      >
                        <span className={styles.sessionTime}>
                          <strong>
                            {formatClock(session.startedAt)} -{" "}
                            {session.endedAt
                              ? formatClock(session.endedAt)
                              : "sekarang"}
                          </strong>
                          <small>
                            {formatDurationSeconds(session.durationSeconds)} ·{" "}
                            {session.distanceKm.toFixed(2)} km
                          </small>
                        </span>
                        <span
                          className={`${styles.sessionState} ${
                            session.state === "ongoing"
                              ? styles.sessionOngoing
                              : ""
                          }`}
                        >
                          {session.state === "ongoing"
                            ? "Sedang berlangsung"
                            : "Selesai"}
                        </span>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <>
                {isHistorySelected ? (
                  <Link
                    className={styles.historyBackLink}
                    href={`${historyHref}?date=${encodeURIComponent(
                      historyDate ?? "",
                    )}`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                    Semua perjalanan
                  </Link>
                ) : null}
            {hasRouteDetails ? (
              <>
                <div className={styles.sheetHeading}>
                  <div>
                    <span>
                      Ringkasan rute · {formatRouteDate(routeStartAt)}
                    </span>
                    <h1>{routeTimeRange}</h1>
                  </div>
                  <div className={styles.durationMetric}>
                    <strong>{routeDuration}</strong>
                    <span>Durasi</span>
                  </div>
                </div>

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
                    <span>Titik GPS</span>
                    <strong>{points.length}</strong>
                  </div>
                </div>

                <div className={styles.latestDetails}>
                  <div>
                    <span>Koordinat</span>
                    <strong>{latestCoordinates ?? "-"}</strong>
                  </div>
                  <div>
                    <span>Sinyal GPS</span>
                    <strong>
                      {latestPoint
                        ? `${latestPoint.satelliteCount} satelit`
                        : "-"}
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.liveSummary}>
                <div className={styles.dailySummaryHeading}>
                  <p>
                    {greeting}
                    {greetingName ? `, ${greetingName}` : ""}
                  </p>
                  <h1>Ringkasan perjalanan hari ini</h1>
                  <time dateTime={dailySummaryDate}>
                    {formatCalendarDate(dailySummaryDate)}
                  </time>
                </div>

                <div className={styles.dailyMetrics}>
                  <div>
                    <strong>
                      {readyDailySummary
                        ? formatDecimal(
                            readyDailySummary.totalDistanceKm,
                            2,
                          )
                        : "—"}
                      {readyDailySummary ? <small>km</small> : null}
                    </strong>
                    <span>Jarak tempuh</span>
                  </div>
                  <div>
                    <strong>
                      {readyDailySummary
                        ? formatRidingTime(readyDailySummary.ridingSeconds)
                        : "—"}
                    </strong>
                    <span>Waktu berkendara</span>
                  </div>
                  <div>
                    <strong>
                      {readyDailySummary
                        ? formatDecimal(
                            readyDailySummary.averageSpeedKph,
                            1,
                          )
                        : "—"}
                      {readyDailySummary ? <small>km/j</small> : null}
                    </strong>
                    <span>Kecepatan rata-rata</span>
                  </div>
                </div>

                <div className={styles.latestPosition}>
                  <span>Posisi terakhir</span>
                  <strong>
                    {latestPoint
                      ? `Diterima ${formatTime(
                          latestPoint.serverReceivedAt,
                          true,
                        )}`
                      : "Belum tersedia"}
                  </strong>
                  <small>{latestCoordinates ?? "-"}</small>
                </div>
              </div>
            )}

              </>
            )}
          </div>
        </section>

        <nav className={styles.bottomNav} aria-label="Navigasi pelacakan">
          <Link
            href={liveHref}
            className={isLiveDestination ? styles.navActive : undefined}
            aria-current={isLiveDestination ? "page" : undefined}
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
          <Link href={serviceHref}>
            <ServiceIcon />
            <span>Servis</span>
          </Link>
          <Link href={fuelHref}>
            <FuelIcon />
            <span>BBM</span>
          </Link>
        </nav>
        {selectedSession?.state === "completed" && points.length > 1 ? (
          <JourneyShareModal
            isOpen={isShareOpen}
            onClose={() => setIsShareOpen(false)}
            points={points}
            session={selectedSession}
            distanceKm={selectedSession.distanceKm}
            peakSpeedKph={peakSpeed}
          />
        ) : null}
      </section>
    </main>
  );
}
