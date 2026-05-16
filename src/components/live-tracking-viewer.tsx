"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import type { GpsHistoryDataset, GpsHistoryPoint } from "@/types/gps";
import styles from "./gps-history-viewer.module.css";

const DynamicHistoryMap = dynamic(
  () => import("@/components/history-map").then((mod) => mod.HistoryMap),
  {
    ssr: false,
    loading: () => (
      <div className={styles.emptyState}>
        <div>
          <p className={styles.stateTitle}>Loading live map</p>
          <p>Preparing route tiles and location markers.</p>
        </div>
      </div>
    ),
  },
);

type LiveTrackingViewerProps = {
  dataset: GpsHistoryDataset;
};

const LIVE_POLL_INTERVAL_MS = 10_000;
const SHEET_DRAG_THRESHOLD_PX = 24;

function toInputDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function formatShortDateTime(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta",
      }).format(date);
}

function formatShortDateTimeWithSeconds(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta",
      }).format(date);
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function formatDistance(points: GpsHistoryPoint[]) {
  if (points.length < 2) {
    return "0 km";
  }

  let totalKm = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    totalKm += haversineKm(previous, current);
  }

  return `${totalKm.toFixed(2)} km`;
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

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function parseRangeStart(value: string) {
  return Date.parse(value);
}

function parseRangeEndInclusive(value: string) {
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return parsed;
  }

  // datetime-local is minute precision here, so include the whole minute.
  return parsed + 59_999;
}

function buildRange(points: GpsHistoryPoint[], fallbackStartAt: string) {
  if (points.length === 0) {
    const normalizedFallback = toInputDateTime(fallbackStartAt);
    return { start: normalizedFallback, end: normalizedFallback };
  }

  return {
    start: toInputDateTime(points[0].serverReceivedAt || fallbackStartAt),
    end: toInputDateTime(
      points.at(-1)?.serverReceivedAt ?? points[0].serverReceivedAt ?? fallbackStartAt,
    ),
  };
}

function getPointKey(point: GpsHistoryPoint) {
  if (point.sourceId !== undefined && point.sourceId !== null) {
    return `source:${String(point.sourceId)}`;
  }

  return [
    point.gpsTimestamp,
    point.serverReceivedAt,
    point.latitude,
    point.longitude,
    point.speedKph,
    point.course,
    point.satelliteCount,
  ].join("|");
}

function normalizePointIds(points: GpsHistoryPoint[]) {
  return points.map((point, index) => ({
    ...point,
    id: index + 1,
  }));
}

export function LiveTrackingViewer({ dataset }: LiveTrackingViewerProps) {
  const isReady = dataset.status === "ready";
  const hasFixedEndAt = Boolean(dataset.endAt);
  const initialPoints = isReady ? normalizePointIds(dataset.points) : [];
  const initialRange = buildRange(initialPoints, dataset.startAt);

  const [points, setPoints] = useState<GpsHistoryPoint[]>(initialPoints);
  const [startDateTime] = useState(initialRange.start);
  const [endDateTime, setEndDateTime] = useState(initialRange.end);
  const [selectedPointId, setSelectedPointId] = useState<number | null>(
    initialPoints.at(-1)?.id ?? null,
  );
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const [sheetDragOffset, setSheetDragOffset] = useState(0);
  const [pollError, setPollError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState(
    isReady ? dataset.latestServerReceivedAt : dataset.startAt,
  );

  const nextIdRef = useRef(initialPoints.length);
  const latestTimestampRef = useRef(lastRefreshAt);
  const selectedPointIdRef = useRef<number | null>(selectedPointId);
  const followEndRef = useRef(true);
  const dragStartYRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    latestTimestampRef.current = lastRefreshAt;
  }, [lastRefreshAt]);

  useEffect(() => {
    selectedPointIdRef.current = selectedPointId;
  }, [selectedPointId]);

  const isInvalidRange =
    startDateTime !== "" &&
    endDateTime !== "" &&
    parseRangeStart(startDateTime) > parseRangeEndInclusive(endDateTime);

  const filteredPoints = useMemo(() => {
    if (isInvalidRange) {
      return [];
    }

    const parsedStart = startDateTime === "" ? null : parseRangeStart(startDateTime);
    const parsedEnd = endDateTime === "" ? null : parseRangeEndInclusive(endDateTime);

    return points.filter((point) => {
      const timestamp = Date.parse(point.serverReceivedAt);
      const startsAfter =
        parsedStart === null || timestamp >= parsedStart;
      const endsBefore = parsedEnd === null || timestamp <= parsedEnd;

      return startsAfter && endsBefore;
    });
  }, [endDateTime, isInvalidRange, points, startDateTime]);

  const mapPoints = filteredPoints;

  const activeSelectedPointId = mapPoints.some(
    (point) => point.id === selectedPointId,
  )
    ? selectedPointId
    : mapPoints.at(-1)?.id ?? null;
  const peakSpeed =
    mapPoints.length === 0
      ? "0 km/h"
      : `${Math.max(...mapPoints.map((point) => point.speedKph))} km/h`;
  const startPoint = mapPoints[0] ?? null;
  const endPoint = mapPoints.at(-1) ?? null;
  const liveStatus = `${points.length} points live`;

  useEffect(() => {
    if (!isReady || hasFixedEndAt) {
      return;
    }

    let isMounted = true;
    let isRequestInFlight = false;

    const applyLatestCursor = (cursor: string) => {
      latestTimestampRef.current = cursor;
      setLastRefreshAt(cursor);

      if (followEndRef.current) {
        setEndDateTime(toInputDateTime(cursor));
      }
    };

    const appendFreshPoints = (incomingPoints: GpsHistoryPoint[]) => {
      setPoints((currentPoints) => {
        const currentKeys = new Set(currentPoints.map(getPointKey));
        const currentLastPointId = currentPoints.at(-1)?.id ?? null;
        let nextId = nextIdRef.current;
        const mergedPoints = [...currentPoints];
        let appendedCount = 0;

        for (const point of incomingPoints) {
          const pointKey = getPointKey(point);

          if (currentKeys.has(pointKey)) {
            continue;
          }

          nextId += 1;
          currentKeys.add(pointKey);
          mergedPoints.push({
            ...point,
            id: nextId,
          });
          appendedCount += 1;
        }

        nextIdRef.current = nextId;

        if (appendedCount > 0) {
          const latestPoint = mergedPoints.at(-1);
          if (latestPoint) {
            if (
              selectedPointIdRef.current === null ||
              selectedPointIdRef.current === currentLastPointId
            ) {
              setSelectedPointId(latestPoint.id);
            }
          }
        }

        return mergedPoints;
      });
    };

    const refresh = async () => {
      if (isRequestInFlight) {
        return;
      }

      isRequestInFlight = true;

      try {
        const response = await fetch(
          `/api/gps-history?imei=${encodeURIComponent(dataset.imei)}&start_at=${encodeURIComponent(latestTimestampRef.current)}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(`Live refresh failed with status ${response.status}.`);
        }

        const payload: GpsHistoryDataset = await response.json();

        if (!isMounted) {
          return;
        }

        if (payload.status === "error") {
          setPollError(payload.message);
          return;
        }

        setPollError(null);
        applyLatestCursor(payload.latestServerReceivedAt || latestTimestampRef.current);

        if (payload.points.length === 0) {
          return;
        }

        appendFreshPoints(payload.points.map((point, index) => ({
          ...point,
          id: index + 1,
        })));
      } catch (error) {
        if (isMounted) {
          setPollError(
            error instanceof Error ? error.message : "Failed to refresh live data.",
          );
        }
      } finally {
        isRequestInFlight = false;
      }
    };

    const intervalId = window.setInterval(refresh, LIVE_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [dataset.imei, dataset.startAt, hasFixedEndAt, isReady]);

  if (!isReady && dataset.points.length === 0) {
    return (
      <main className={styles.page}>
        <section className={styles.errorState}>
          <div>
            <p className={styles.stateTitle}>Dataset failed to load</p>
            <p>{dataset.message}</p>
          </div>
        </section>
      </main>
    );
  }

  if (isInvalidRange) {
    return (
      <main className={styles.page}>
        <section className={styles.errorState}>
          <div>
            <p className={styles.stateTitle}>Invalid date range</p>
            <p>Start time must be earlier than or equal to the end time.</p>
          </div>
        </section>
      </main>
    );
  }

  if (filteredPoints.length === 0) {
    return (
      <main className={styles.page}>
        <section className={styles.emptyState}>
          <div>
            <p className={styles.stateTitle}>No matching history</p>
            <p>Try widening the selected time range for this device.</p>
          </div>
        </section>
      </main>
    );
  }

  const onSheetPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragStartYRef.current = event.clientY;
    setIsDraggingSheet(true);
    setSheetDragOffset(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onSheetPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStartYRef.current === null) {
      return;
    }

    const delta = event.clientY - dragStartYRef.current;
    const clampedDelta = Math.max(-220, Math.min(220, delta));
    setSheetDragOffset(clampedDelta);
  };

  const onSheetPointerUp = () => {
    if (dragStartYRef.current === null) {
      return;
    }

    const delta = sheetDragOffset;
    const movedEnough = Math.abs(delta) >= SHEET_DRAG_THRESHOLD_PX;

    if (movedEnough) {
      suppressNextClickRef.current = true;
      setIsSheetExpanded(delta < 0);
    }

    dragStartYRef.current = null;
    setIsDraggingSheet(false);
    setSheetDragOffset(0);
  };

  const onSheetClick = () => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    setIsSheetExpanded((current) => !current);
  };

  return (
    <main className={styles.page}>
      <section className={styles.mapShell}>
        <section className={styles.mapPane}>
          <div className={styles.liveBadge}>Live tracking</div>
          <DynamicHistoryMap
            points={mapPoints}
            selectedPointId={activeSelectedPointId}
            onSelectPoint={setSelectedPointId}
            isSheetExpanded={isSheetExpanded}
          />

          {dataset.status === "error" ? (
            <section className={`${styles.overlayCard} ${styles.warningBanner}`}>
              <p className={styles.warningTitle}>Dataset warning</p>
              <p>{dataset.message}</p>
            </section>
          ) : null}

          {pollError ? (
            <section className={`${styles.overlayCard} ${styles.warningBanner}`}>
              <p className={styles.warningTitle}>Live refresh warning</p>
              <p>{pollError}</p>
            </section>
          ) : null}
        </section>

        <section
          className={`${styles.bottomSheet} ${
            isSheetExpanded ? styles.sheetExpanded : styles.sheetCollapsed
          } ${isDraggingSheet ? styles.sheetDragging : ""}`}
          style={{ transform: `translateY(${sheetDragOffset}px)` }}
        >
          <button
            type="button"
            className={styles.sheetHandle}
            onPointerDown={onSheetPointerDown}
            onPointerMove={onSheetPointerMove}
            onPointerUp={onSheetPointerUp}
            onPointerCancel={onSheetPointerUp}
            onClick={onSheetClick}
            aria-expanded={isSheetExpanded}
          >
            <span className={styles.sheetGrip} />
            <span className={styles.sheetTitle}>Live route details</span>
            <span className={styles.sheetAction}>
              {isSheetExpanded ? "Collapse" : "Expand"}
            </span>
          </button>

          <div className={styles.sheetContent}>
            <div className={styles.statsRow}>
              <article className={styles.statCard}>
                <span>Distance</span>
                <strong>{formatDistance(mapPoints)}</strong>
              </article>
              <article className={styles.statCard}>
                <span>Peak speed</span>
                <strong>{peakSpeed}</strong>
              </article>
              <article className={styles.statCard}>
                <span>{liveStatus}</span>
                <strong>{mapPoints.length} shown on map</strong>
              </article>
            </div>

            <div className={styles.detailStack}>
              <div className={styles.routeSummary}>
                <article className={styles.infoCard}>
                  <span className={styles.infoLabel}>Start</span>
                  <strong className={styles.infoValue}>
                    {startPoint ? formatShortDateTime(startPoint.serverReceivedAt) : "Unavailable"}
                  </strong>
                </article>
                <article className={styles.infoCard}>
                  <span className={styles.infoLabel}>Latest</span>
                  <strong className={styles.infoValue}>
                    {endPoint ? formatShortDateTime(endPoint.serverReceivedAt) : "Unavailable"}
                  </strong>
                </article>
              </div>

              <section className={styles.timelinePanel}>
                <div className={styles.sectionHeader}>
                  <h2>Timeline</h2>
                  <span>Tap a row to focus the map</span>
                </div>

                <div className={styles.timelineList}>
                  {filteredPoints.map((point) => {
                    const itemClassName =
                      point.id === activeSelectedPointId
                        ? `${styles.timelineItem} ${styles.timelineItemSelected}`
                        : styles.timelineItem;

                    return (
                      <button
                        type="button"
                        key={point.id}
                        className={itemClassName}
                        onClick={() => setSelectedPointId(point.id)}
                      >
                        <div className={styles.timelineMain}>
                          <strong>
                            {formatShortDateTimeWithSeconds(point.serverReceivedAt)}
                          </strong>
                          <span>{point.speedKph} km/h</span>
                        </div>
                        <div className={styles.timelineMeta}>
                          <span>
                            {formatCoordinate(point.latitude)}, {formatCoordinate(point.longitude)}
                          </span>
                          <span>
                            {point.satelliteCount} sats • {point.course}&deg;
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
