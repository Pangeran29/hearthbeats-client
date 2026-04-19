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

function buildRange(points: GpsHistoryPoint[], fallbackStartAt: string) {
  if (points.length === 0) {
    const normalizedFallback = toInputDateTime(fallbackStartAt);
    return { start: normalizedFallback, end: normalizedFallback };
  }

  return {
    start: toInputDateTime(points[0].gpsTimestamp || fallbackStartAt),
    end: toInputDateTime(
      points.at(-1)?.gpsTimestamp ?? points[0].gpsTimestamp ?? fallbackStartAt,
    ),
  };
}

function getPointKey(point: GpsHistoryPoint) {
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

function getLatestTimestamp(points: GpsHistoryPoint[], fallback: string) {
  return points.at(-1)?.gpsTimestamp || points.at(-1)?.serverReceivedAt || fallback;
}

function normalizePointIds(points: GpsHistoryPoint[]) {
  return points.map((point, index) => ({
    ...point,
    id: index + 1,
  }));
}

export function LiveTrackingViewer({ dataset }: LiveTrackingViewerProps) {
  const isReady = dataset.status === "ready";
  const initialPoints = isReady ? normalizePointIds(dataset.points) : [];
  const initialRange = buildRange(initialPoints, dataset.startAt);

  const [points, setPoints] = useState<GpsHistoryPoint[]>(initialPoints);
  const [startDateTime, setStartDateTime] = useState(initialRange.start);
  const [endDateTime, setEndDateTime] = useState(initialRange.end);
  const [selectedPointId, setSelectedPointId] = useState<number | null>(
    initialPoints.at(-1)?.id ?? null,
  );
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState(
    isReady ? getLatestTimestamp(initialPoints, dataset.startAt) : dataset.startAt,
  );

  const nextIdRef = useRef(initialPoints.length);
  const latestTimestampRef = useRef(lastRefreshAt);
  const selectedPointIdRef = useRef<number | null>(selectedPointId);
  const followEndRef = useRef(true);

  useEffect(() => {
    latestTimestampRef.current = lastRefreshAt;
  }, [lastRefreshAt]);

  useEffect(() => {
    selectedPointIdRef.current = selectedPointId;
  }, [selectedPointId]);

  const isInvalidRange =
    startDateTime !== "" &&
    endDateTime !== "" &&
    Date.parse(startDateTime) > Date.parse(endDateTime);

  const filteredPoints = useMemo(() => {
    if (isInvalidRange) {
      return [];
    }

    return points.filter((point) => {
      const timestamp = Date.parse(point.gpsTimestamp || point.serverReceivedAt);
      const startsAfter =
        startDateTime === "" || timestamp >= Date.parse(startDateTime);
      const endsBefore = endDateTime === "" || timestamp <= Date.parse(endDateTime);

      return startsAfter && endsBefore;
    });
  }, [endDateTime, isInvalidRange, points, startDateTime]);

  const activeSelectedPointId = filteredPoints.some(
    (point) => point.id === selectedPointId,
  )
    ? selectedPointId
    : filteredPoints.at(-1)?.id ?? null;
  const peakSpeed =
    filteredPoints.length === 0
      ? "0 km/h"
      : `${Math.max(...filteredPoints.map((point) => point.speedKph))} km/h`;
  const startPoint = filteredPoints[0] ?? null;
  const endPoint = filteredPoints.at(-1) ?? null;
  const liveStatus = `${points.length} points live`;

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let isMounted = true;
    let isRequestInFlight = false;

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
            latestTimestampRef.current = getLatestTimestamp(
              mergedPoints,
              dataset.startAt,
            );
            setLastRefreshAt(latestTimestampRef.current);

            if (followEndRef.current) {
              setEndDateTime(toInputDateTime(latestTimestampRef.current));
            }

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

        if (payload.points.length === 0) {
          latestTimestampRef.current = payload.startAt || latestTimestampRef.current;
          setLastRefreshAt(latestTimestampRef.current);
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
  }, [dataset.imei, dataset.startAt, isReady]);

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

  return (
    <main className={styles.page}>
      <section className={styles.mapShell}>
        <div className={styles.liveBadge}>Live tracking</div>
        <DynamicHistoryMap
          points={filteredPoints}
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

        <section
          className={`${styles.bottomSheet} ${
            isSheetExpanded ? styles.sheetExpanded : styles.sheetCollapsed
          }`}
        >
          <button
            type="button"
            className={styles.sheetHandle}
            onClick={() => setIsSheetExpanded((current) => !current)}
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
                <strong>{formatDistance(filteredPoints)}</strong>
              </article>
              <article className={styles.statCard}>
                <span>Peak speed</span>
                <strong>{peakSpeed}</strong>
              </article>
              <article className={styles.statCard}>
                <span>{liveStatus}</span>
                <strong>{formatShortDateTime(lastRefreshAt)}</strong>
              </article>
            </div>

            <div className={styles.detailStack}>
              <article className={styles.infoCard}>
                <span className={styles.infoLabel}>Live page</span>
                <strong className={styles.infoValue}>
                  /live-tracking/{dataset.imei}?start_at={dataset.startAt}
                </strong>
              </article>

              <div className={styles.rangeGrid}>
                <label className={styles.field}>
                  <span>Visible start</span>
                  <input
                    type="datetime-local"
                    value={startDateTime}
                    onChange={(event) => setStartDateTime(event.target.value)}
                  />
                </label>

                <label className={styles.field}>
                  <span>Visible end</span>
                  <input
                    type="datetime-local"
                    value={endDateTime}
                    onChange={(event) => {
                      followEndRef.current = false;
                      setEndDateTime(event.target.value);
                    }}
                  />
                </label>
              </div>

              <div className={styles.routeSummary}>
                <article className={styles.infoCard}>
                  <span className={styles.infoLabel}>Start</span>
                  <strong className={styles.infoValue}>
                    {startPoint ? formatShortDateTime(startPoint.gpsTimestamp) : "Unavailable"}
                  </strong>
                </article>
                <article className={styles.infoCard}>
                  <span className={styles.infoLabel}>Last sync</span>
                  <strong className={styles.infoValue}>{formatShortDateTime(lastRefreshAt)}</strong>
                </article>
                <article className={styles.infoCard}>
                  <span className={styles.infoLabel}>Latest</span>
                  <strong className={styles.infoValue}>
                    {endPoint ? formatShortDateTime(endPoint.gpsTimestamp) : "Unavailable"}
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
                          <strong>{formatShortDateTime(point.gpsTimestamp)}</strong>
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