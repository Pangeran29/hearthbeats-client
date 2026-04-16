"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

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

    return pointsForImei.filter((point) => {
      const timestamp = Date.parse(point.gpsTimestamp || point.serverReceivedAt);
      const startsAfter =
        startDateTime === "" || timestamp >= Date.parse(startDateTime);
      const endsBefore =
        endDateTime === "" || timestamp <= Date.parse(endDateTime);

      return startsAfter && endsBefore;
    });
  }, [endDateTime, isInvalidRange, pointsForImei, startDateTime]);

  const activeSelectedPointId = filteredPoints.some(
    (point) => point.id === selectedPointId,
  )
    ? selectedPointId
    : (filteredPoints.at(-1)?.id ?? null);

  const chartData = filteredPoints.map((point) => ({
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
          <span className={styles.eyebrow}>GPS History Viewer</span>
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
              <strong>{filteredPoints.length}</strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Approx. route length</span>
              <strong>{formatDistance(filteredPoints)}</strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Peak speed</span>
              <strong>
                {filteredPoints.length === 0
                  ? "0 km/h"
                  : `${Math.max(...filteredPoints.map((point) => point.speedKph))} km/h`}
              </strong>
            </article>
          </div>
        </header>

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
                  points={filteredPoints}
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
                    {filteredPoints.map((point) => {
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
