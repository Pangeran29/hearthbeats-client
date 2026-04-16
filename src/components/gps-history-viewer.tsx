"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useEffect, useRef } from "react";

import type { GpsHistoryDataset, GpsHistoryPoint } from "@/types/gps";
import styles from "./gps-history-viewer.module.css";

const DynamicHistoryMap = dynamic(
  () => import("@/components/history-map").then((mod) => mod.HistoryMap),
  {
    ssr: false,
    loading: () => (
      <div className={styles.emptyState}>
        <div>
          <p className={styles.stateTitle}>Loading map</p>
          <p>Preparing route tiles and location markers.</p>
        </div>
      </div>
    ),
  },
);

const DynamicSpeedHistoryChart = dynamic(
  () =>
    import("@/components/speed-history-chart").then(
      (mod) => mod.SpeedHistoryChart,
    ),
  {
    ssr: false,
    loading: () => <div className={styles.chartLoading}>Loading chart</div>,
  },
);

type ViewerProps = {
  dataset: GpsHistoryDataset;
};

function toInputDateTime(value: string) {
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
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

function buildRange(points: GpsHistoryPoint[]) {
  if (points.length === 0) {
    return { start: "", end: "" };
  }

  return {
    start: toInputDateTime(points[0].gpsTimestamp),
    end: toInputDateTime(
      points.at(-1)?.gpsTimestamp ?? points[0].gpsTimestamp,
    ),
  };
}

export function GpsHistoryViewer({ dataset }: ViewerProps) {
  const allPoints = dataset.points;
  const imeis = useMemo(
    () => Array.from(new Set(allPoints.map((point) => point.imei))).sort(),
    [allPoints],
  );
  const initialImei = imeis[0] ?? "";
  const initialPoints = allPoints.filter((point) => point.imei === initialImei);
  const initialRange = buildRange(initialPoints);

  const [selectedImei, setSelectedImei] = useState(initialImei);
  const [startDateTime, setStartDateTime] = useState(initialRange.start);
  const [endDateTime, setEndDateTime] = useState(initialRange.end);
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  const [showShareWidget, setShowShareWidget] = useState(false);
  const [shareDuration, setShareDuration] = useState<number>(1);
  const [isCopied, setIsCopied] = useState(false);
  
  const [isSharedLink, setIsSharedLink] = useState(false);
  const [isLinkExpired, setIsLinkExpired] = useState(false);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    const searchParams = new URLSearchParams(window.location.search);
    const imeiQuery = searchParams.get("imei");
    const expiresQuery = searchParams.get("expires");

    if (imeiQuery && expiresQuery) {
      setIsSharedLink(true);
      if (Date.now() > parseInt(expiresQuery, 10)) {
        setIsLinkExpired(true);
      } else {
        setSelectedImei(imeiQuery);
        // Start simulation right away for shared viewer
        setIsPlaying(true);
      }
    }
  }, []);

  const pointsForImei = useMemo(
    () => allPoints.filter((point) => point.imei === selectedImei),
    [allPoints, selectedImei],
  );

  const isInvalidRange =
    startDateTime !== "" &&
    endDateTime !== "" &&
    Date.parse(startDateTime) > Date.parse(endDateTime);

  const filteredPoints = useMemo(() => {
    if (isInvalidRange) {
      return [];
    }

    return pointsForImei
      .filter((point) => {
        const timestamp = Date.parse(point.gpsTimestamp || point.serverReceivedAt);
        const startsAfter =
          startDateTime === "" || timestamp >= Date.parse(startDateTime);
        const endsBefore =
          endDateTime === "" || timestamp <= Date.parse(endDateTime);

        return startsAfter && endsBefore;
      })
      .sort((a, b) => Date.parse(a.gpsTimestamp) - Date.parse(b.gpsTimestamp));
  }, [endDateTime, isInvalidRange, pointsForImei, startDateTime]);

  useEffect(() => {
    if (!isPlaying || filteredPoints.length === 0) {
      return;
    }

    const intervalMs = 1000 / playbackSpeed;
    const intervalId = setInterval(() => {
      setSelectedPointId((currentId) => {
        const targetId = currentId ?? filteredPoints[0].id;
        const currentIndex = filteredPoints.findIndex((p) => p.id === targetId);
        
        if (currentIndex === -1 || currentIndex === filteredPoints.length - 1) {
          setIsPlaying(false);
          return targetId;
        }

        return filteredPoints[currentIndex + 1].id;
      });
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [isPlaying, playbackSpeed, filteredPoints]);

  const activeSelectedPointId = filteredPoints.some(
    (point) => point.id === selectedPointId,
  )
    ? selectedPointId
    : (filteredPoints.at(-1)?.id ?? null);

  const selectedPointIndex = filteredPoints.findIndex(
    (p) => p.id === activeSelectedPointId,
  );
  
  const visiblePoints =
    selectedPointIndex === -1
      ? filteredPoints
      : filteredPoints.slice(0, selectedPointIndex + 1);

  const chartData = visiblePoints.map((point) => ({
    id: point.id,
    time: new Date(point.gpsTimestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    fullTime: formatDateTime(point.gpsTimestamp),
    speedKph: point.speedKph,
  }));

  const selectedPoint =
    filteredPoints.find((point) => point.id === activeSelectedPointId) ?? null;

  if (!isMounted) {
    return (
      <main className={styles.page}>
        <section className={styles.shell}>
          <div className={styles.emptyState}>
            <div>
              <p className={styles.stateTitle}>Loading viewer...</p>
              <p>Preparing map and location history.</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (isLinkExpired) {
    return (
      <main className={styles.page}>
        <section className={styles.shell}>
          <div className={styles.expiredState}>
            <h2>Link Expired ⏰</h2>
            <p>
              This live location tracking link has expired and is no longer valid.
              Please request a new tracking link from the vehicle owner.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (dataset.status === "error" && dataset.points.length === 0) {
    return (
      <main className={styles.page}>
        <section className={styles.shell}>
          <div className={styles.errorState}>
            <div>
              <p className={styles.stateTitle}>Dataset failed to load</p>
              <p>{dataset.message}</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.hero}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className={styles.eyebrow}>GPS History Viewer</span>
            {!isSharedLink && (
              <button
                className={styles.shareDurationBtnActive}
                style={{ borderRadius: '99px', padding: '0.6rem 1rem' }}
                onClick={() => setShowShareWidget(!showShareWidget)}
              >
                Share Live Location 🔗
              </button>
            )}
          </div>
          <h1>Historical route playback without the backend wait.</h1>
          <p>
            This prototype reads normalized location history from a local JSON file,
            plots each GPS point on the map, and keeps the route, chart, and table in
            sync while you filter by IMEI and date range.
          </p>

          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span>IMEI</span>
              <strong>{selectedImei || "Unavailable"}</strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Visible points</span>
              <strong>
                {visiblePoints.length} <small style={{ fontSize: "1rem", color: "var(--ink-3)" }}>/ {filteredPoints.length}</small>
              </strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Approx. route length</span>
              <strong>{formatDistance(visiblePoints)}</strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Peak speed</span>
              <strong>
                {visiblePoints.length === 0
                  ? "0 km/h"
                  : `${Math.max(...visiblePoints.map((point) => point.speedKph))} km/h`}
              </strong>
            </article>
          </div>
        </header>
        {!isSharedLink ? (
          <section className={styles.filterBar}>
            <div className={styles.field}>
              <label htmlFor="imei">Device IMEI</label>
              <select
                id="imei"
                value={selectedImei}
                onChange={(event) => {
                  const nextImei = event.target.value;
                  const nextPoints = allPoints.filter((point) => point.imei === nextImei);
                  const nextRange = buildRange(nextPoints);

                  setSelectedImei(nextImei);
                  setStartDateTime(nextRange.start);
                  setEndDateTime(nextRange.end);
                  setSelectedPointId(nextPoints.at(-1)?.id ?? null);
                }}
              >
                {imeis.map((imei) => (
                  <option key={imei} value={imei}>
                    {imei}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="startDateTime">Start date/time</label>
              <input
                id="startDateTime"
                type="datetime-local"
                value={startDateTime}
                onChange={(event) => setStartDateTime(event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="endDateTime">End date/time</label>
              <input
                id="endDateTime"
                type="datetime-local"
                value={endDateTime}
                onChange={(event) => setEndDateTime(event.target.value)}
              />
            </div>
          </section>
        ) : null}

        {!isSharedLink && showShareWidget ? (
          <section className={styles.shareWidget}>
            <div className={styles.shareHeader}>
              <h3>🔗 Share Live Location</h3>
              <div className={styles.shareDurations}>
                {[1, 8, 12].map((hours) => (
                  <button
                    key={hours}
                    className={`${styles.shareDurationBtn} ${
                      shareDuration === hours ? styles.shareDurationBtnActive : ""
                    }`}
                    onClick={() => {
                      setShareDuration(hours);
                      setIsCopied(false);
                    }}
                  >
                    {hours} {hours === 1 ? "Hour" : "Hours"}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.shareLinkBox}>
              <input
                type="text"
                readOnly
                className={styles.shareLinkInput}
                value={`${window.location.origin}${window.location.pathname}?imei=${selectedImei}&expires=${
                  Date.now() + shareDuration * 60 * 60 * 1000
                }`}
              />
              <button
                className={`${styles.copyBtn} ${isCopied ? styles.copyBtnSuccess : ""}`}
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}?imei=${selectedImei}&expires=${
                    Date.now() + shareDuration * 60 * 60 * 1000
                  }`;
                  navigator.clipboard.writeText(url).then(() => {
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 3000);
                  });
                }}
              >
                {isCopied ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </section>
        ) : null}

        {!isInvalidRange && filteredPoints.length > 0 ? (
          <section className={styles.playbackBar}>
            <div className={styles.playbackControls}>
              <button
                type="button"
                className={`${styles.playbackBtn} ${isPlaying ? styles.playbackBtnActive : ""}`}
                onClick={() => {
                  if (!isPlaying) {
                    const isAtEnd =
                      activeSelectedPointId ===
                      (filteredPoints.at(-1)?.id ?? null);
                    if (isAtEnd && filteredPoints.length > 0) {
                      setSelectedPointId(filteredPoints[0].id);
                    }
                  }
                  setIsPlaying(!isPlaying);
                }}
              >
                {isPlaying ? "Pause Simulation" : "Simulate Live Tracking"}
              </button>
              
              <select
                className={styles.playbackSpeedSelect}
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              >
                <option value={1}>1x Speed</option>
                <option value={2}>2x Speed</option>
                <option value={5}>5x Speed</option>
                <option value={10}>10x Speed</option>
                <option value={20}>20x Speed</option>
              </select>
            </div>
            <div className={styles.playbackProgress}>
              Point{" "}
              {filteredPoints.findIndex((p) => p.id === activeSelectedPointId) + 1}{" "}
              of {filteredPoints.length}
            </div>
          </section>
        ) : null}

        {dataset.status === "error" ? (
          <section className={styles.errorState}>
            <div>
              <p className={styles.stateTitle}>Dataset warning</p>
              <p>{dataset.message}</p>
            </div>
          </section>
        ) : null}

        {isInvalidRange ? (
          <section className={styles.errorState}>
            <div>
              <p className={styles.stateTitle}>Invalid date range</p>
              <p>Start time must be earlier than or equal to the end time.</p>
            </div>
          </section>
        ) : filteredPoints.length === 0 ? (
          <section className={styles.emptyState}>
            <div>
              <p className={styles.stateTitle}>No matching history</p>
              <p>Try widening the selected time range for this device.</p>
            </div>
          </section>
        ) : (
          <section className={styles.layout}>
            <article className={`${styles.panel} ${styles.mapPanel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Map Route</h2>
                  <p>Polyline, start/end markers, and clickable history points.</p>
                </div>
                <span className={styles.badge}>
                  {filteredPoints[0].packetFamily.replaceAll("_", " ")}
                </span>
              </div>

              <div className={styles.mapWrap}>
                <DynamicHistoryMap
                  points={visiblePoints}
                  selectedPointId={activeSelectedPointId}
                  onSelectPoint={setSelectedPointId}
                />
              </div>
            </article>

            <article className={`${styles.panel} ${styles.historyPanel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>History Line & Timeline</h2>
                  <p>Speed trend on top, chronological rows underneath.</p>
                </div>
                <span className={styles.hint}>
                  Selected point:{" "}
                  {selectedPoint ? formatDateTime(selectedPoint.gpsTimestamp) : "None"}
                </span>
              </div>

              <div className={styles.chartWrap}>
                <DynamicSpeedHistoryChart data={chartData} />
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>GPS time</th>
                      <th>Server time</th>
                      <th>Latitude</th>
                      <th>Longitude</th>
                      <th>Speed</th>
                      <th>Course</th>
                      <th>Sats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePoints.map((point) => {
                      const rowClassName =
                        point.id === activeSelectedPointId
                          ? `${styles.tableRow} ${styles.selectedRow}`
                          : styles.tableRow;

                      return (
                        <tr
                          key={point.id}
                          className={rowClassName}
                          onClick={() => setSelectedPointId(point.id)}
                        >
                          <td>{formatDateTime(point.gpsTimestamp)}</td>
                          <td>{formatDateTime(point.serverReceivedAt)}</td>
                          <td>{formatCoordinate(point.latitude)}</td>
                          <td>{formatCoordinate(point.longitude)}</td>
                          <td>{point.speedKph} km/h</td>
                          <td>{point.course}&deg;</td>
                          <td>{point.satelliteCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}
      </section>
    </main>
  );
}
