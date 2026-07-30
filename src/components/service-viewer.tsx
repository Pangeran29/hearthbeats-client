"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  DeviceActivity,
  DeviceServiceSummary,
} from "@/types/gps";
import styles from "./service-viewer.module.css";

type ServiceViewerProps = {
  summary: DeviceServiceSummary;
  deviceActivity?: DeviceActivity;
};

function formatDistance(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: value > 0 && value < 10 ? 1 : 0,
    maximumFractionDigits,
  }).format(value);
}

function formatWholeKm(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00+07:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
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

function BatteryIcon({ level }: { level?: number }) {
  const normalizedLevel =
    typeof level === "number" ? Math.min(6, Math.max(0, level)) : 0;
  const fillWidth = level === undefined ? 0 : 2 + (normalizedLevel / 6) * 12;

  return (
    <svg viewBox="0 0 22 14" aria-hidden="true">
      <rect x="1" y="2" width="17" height="10" rx="2" />
      <path d="M20 5v4" />
      {fillWidth > 0 ? (
        <rect x="3" y="4" width={fillWidth} height="6" rx="1" />
      ) : null}
    </svg>
  );
}

function getBatteryStatus(level?: number) {
  if (level === 0) {
    return { label: "Habis", tone: styles.batteryCritical };
  }
  if (level === 1) {
    return { label: "Kritis", tone: styles.batteryCritical };
  }
  if (level === 2) {
    return { label: "Rendah", tone: styles.batteryWarning };
  }
  if (level === 5 || level === 6) {
    return {
      label: level === 6 ? "Penuh" : "Baik",
      tone: styles.batteryGood,
    };
  }

  return {
    label: level === undefined ? "Tidak diketahui" : "Cukup",
    tone: styles.batteryNeutral,
  };
}

function getEngineStatus(status?: DeviceActivity["engineStatus"]) {
  if (status === "on") {
    return { label: "Motor hidup", tone: styles.engineOn };
  }

  if (status === "off") {
    return { label: "Motor mati", tone: styles.engineOff };
  }

  return { label: "Status tidak diketahui", tone: styles.engineUnknown };
}

export function ServiceViewer({
  summary,
  deviceActivity,
}: ServiceViewerProps) {
  const [expandedMilestoneKm, setExpandedMilestoneKm] = useState<number | null>(
    null,
  );
  const [isRetrying, startRetry] = useTransition();
  const router = useRouter();
  const battery = getBatteryStatus(deviceActivity?.batteryVoltageLevel);
  const engine = getEngineStatus(deviceActivity?.engineStatus);
  const encodedImei = encodeURIComponent(summary.imei);
  const liveHref = `/live-tracking/${encodedImei}`;
  const historyHref = `${liveHref}/history`;
  const serviceHref = `${liveHref}/service`;
  const fuelHref = `${liveHref}/fuel`;
  const intervalProgress = Math.min(
    100,
    Math.max(0, 100 - (summary.distanceRemainingKm / 1_000) * 100),
  );
  const milestoneCount = summary.milestones.length;
  const milestoneDescription =
    milestoneCount === 0
      ? "Belum ada pencapaian dari data GPS."
      : `${milestoneCount} pencapaian terbaru dari data GPS.`;

  return (
    <main className={styles.viewport}>
      <section className={styles.appCanvas}>
        <header className={styles.topBar}>
          <HeartbeatMark />
          <div className={styles.vehicleIdentity}>
            <strong>Motor Saya</strong>
            <span>IMEI {summary.imei}</span>
          </div>
          <div className={styles.headerStatus}>
            <div
              className={`${styles.connectionStatus} ${engine.tone}`}
              aria-label={engine.label}
            >
              <span aria-hidden="true" />
              <span>{engine.label}</span>
            </div>
            <div
              className={`${styles.batteryStatus} ${battery.tone}`}
              aria-label={`Baterai ${battery.label}`}
            >
              <BatteryIcon level={deviceActivity?.batteryVoltageLevel} />
              <span aria-hidden="true">{battery.label}</span>
            </div>
          </div>
        </header>

        <div className={styles.scrollArea}>
          {summary.status === "error" ? (
            <section className={styles.errorState} role="alert">
              <span className={styles.errorIcon}>
                <ServiceIcon />
              </span>
              <h1>Data servis belum tersedia</h1>
              <p>
                Jarak terpantau belum bisa dimuat. Periksa koneksi lalu coba
                lagi.
              </p>
              <button
                type="button"
                disabled={isRetrying}
                onClick={() => startRetry(() => router.refresh())}
              >
                {isRetrying ? "Memuat..." : "Coba lagi"}
              </button>
            </section>
          ) : (
            <>
              <section className={styles.odometerSection}>
                <span>Total jarak terpantau</span>
                <p className={styles.odometerValue}>
                  <strong>
                    {formatDistance(summary.totalTrackedDistanceKm, 2)}
                  </strong>
                  <small>km</small>
                </p>

                <div className={styles.progressCopy}>
                  <strong>
                    {formatDistance(summary.distanceRemainingKm, 1)} km lagi
                  </strong>
                  <span>
                    menuju {formatWholeKm(summary.nextMilestoneKm)} km
                  </span>
                </div>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-label="Progres menuju milestone berikutnya"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(intervalProgress)}
                >
                  <span style={{ width: `${intervalProgress}%` }} />
                </div>
              </section>

              <section className={styles.timelineSection}>
                <div className={styles.timelineHeading}>
                  <div>
                    <h2>Jejak milestone</h2>
                    <p>{milestoneDescription}</p>
                  </div>
                  <span>{milestoneCount}</span>
                </div>

                <ol className={styles.timeline}>
                  <li className={styles.upcomingMilestone}>
                    <span className={styles.timelineNode}>
                      {Math.round(summary.nextMilestoneKm / 1_000)}
                    </span>
                    <div>
                      <span>Milestone berikutnya · Belum tercapai</span>
                      <strong>
                        {formatWholeKm(summary.nextMilestoneKm)} km
                      </strong>
                      <small>
                        {summary.nextRecommendation.title} · Rekomendasi terbuka
                        setelah milestone tercapai.
                      </small>
                    </div>
                  </li>

                  <li className={styles.currentDistance}>
                    <span className={styles.timelineNode} aria-hidden="true">
                      <span />
                    </span>
                    <div>
                      <span>Jarak saat ini</span>
                      <strong>
                        {formatDistance(summary.totalTrackedDistanceKm, 2)} km
                        terpantau
                      </strong>
                      <small>
                        {formatDistance(summary.distanceRemainingKm, 1)} km lagi
                        menuju milestone berikutnya
                      </small>
                    </div>
                  </li>

                  {summary.milestones.map((milestone) => {
                    const isExpanded =
                      expandedMilestoneKm === milestone.milestoneKm;

                    return (
                      <li key={milestone.milestoneKm}>
                        <span className={styles.timelineNode}>
                          {milestone.milestoneNumber}
                        </span>
                        <div>
                          <span>{formatDate(milestone.achievedOn)}</span>
                          <strong>
                            {formatWholeKm(milestone.milestoneKm)} km tercapai
                          </strong>
                          <small>{milestone.recommendationTitle}</small>
                          <button
                            type="button"
                            className={styles.recommendationToggle}
                            aria-expanded={isExpanded}
                            onClick={() =>
                              setExpandedMilestoneKm(
                                isExpanded ? null : milestone.milestoneKm,
                              )
                            }
                          >
                            {isExpanded
                              ? "Tutup rekomendasi"
                              : "Lihat rekomendasi"}
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d={
                                  isExpanded
                                    ? "m18 15-6-6-6 6"
                                    : "m6 9 6 6 6-6"
                                }
                              />
                            </svg>
                          </button>
                          {isExpanded ? (
                            <ul className={styles.milestoneChecklist}>
                              {milestone.recommendationItems.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <p className={styles.disclaimer}>
                Rekomendasi ini bersifat panduan. Sesuaikan dengan buku servis
                dan kondisi motor.
              </p>
            </>
          )}
        </div>

        <nav className={styles.bottomNav} aria-label="Navigasi pelacakan">
          <Link href={liveHref}>
            <MapIcon />
            <span>Live</span>
          </Link>
          <Link href={historyHref}>
            <HistoryIcon />
            <span>Riwayat</span>
          </Link>
          <Link
            href={serviceHref}
            className={styles.navActive}
            aria-current="page"
          >
            <ServiceIcon />
            <span>Servis</span>
          </Link>
          <Link href={fuelHref}>
            <FuelIcon />
            <span>BBM</span>
          </Link>
        </nav>
      </section>
    </main>
  );
}
