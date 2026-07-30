"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, useTransition } from "react";

import type {
  DeviceActivity,
  FuelCalibrationDashboard,
  FuelCalibrationResult,
} from "@/types/gps";
import styles from "./fuel-calibration-viewer.module.css";

type FuelCalibrationViewerProps = {
  dashboard: FuelCalibrationDashboard;
  deviceActivity?: DeviceActivity;
};

type Sheet = "start" | "restart" | "complete" | null;

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: digits,
    minimumFractionDigits: value > 0 && value < 10 ? 1 : 0,
  }).format(value);
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string, withYear = false) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}j ${minutes}m`;
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

function MotorcycleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="m6 17 4-7h4l4 7M9 13h7M12 10l-2-3h3" />
    </svg>
  );
}

function BatteryIcon({ level }: { level?: number }) {
  const normalized =
    typeof level === "number" ? Math.min(6, Math.max(0, level)) : 0;
  const fillWidth = level === undefined ? 0 : 2 + (normalized / 6) * 12;

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
  if (level === 0) return { label: "Habis", tone: styles.statusCritical };
  if (level === 1) return { label: "Kritis", tone: styles.statusCritical };
  if (level === 2) return { label: "Rendah", tone: styles.statusWarning };
  if (level === 5 || level === 6) {
    return {
      label: level === 6 ? "Penuh" : "Baik",
      tone: styles.statusGood,
    };
  }
  return {
    label: level === undefined ? "Tidak diketahui" : "Cukup",
    tone: styles.statusNeutral,
  };
}

function getEngineStatus(status?: DeviceActivity["engineStatus"]) {
  if (status === "on") {
    return { label: "Motor hidup", tone: styles.statusGood };
  }
  if (status === "off") {
    return { label: "Motor mati", tone: styles.statusNeutral };
  }
  return { label: "Status tidak diketahui", tone: styles.statusNeutral };
}

function ResultMetrics({ result }: { result: FuelCalibrationResult }) {
  return (
    <div className={styles.resultMetrics}>
      <div>
        <strong>{formatNumber(result.distanceTraveledKm, 1)} km</strong>
        <span>Jarak</span>
      </div>
      <div>
        <strong>{formatNumber(result.liters, 2)} L</strong>
        <span>BBM digunakan</span>
      </div>
      <div>
        <strong>{formatDuration(result.ridingSeconds)}</strong>
        <span>Waktu berkendara</span>
      </div>
      <div>
        <strong>{result.tripCount}</strong>
        <span>Perjalanan</span>
      </div>
      <div>
        <strong>
          {result.costPerKmIdr === undefined
            ? "—"
            : `${formatRupiah(Math.round(result.costPerKmIdr))}/km`}
        </strong>
        <span>Biaya perjalanan</span>
      </div>
    </div>
  );
}

export function FuelCalibrationViewer({
  dashboard,
  deviceActivity,
}: FuelCalibrationViewerProps) {
  const [currentDashboard, setCurrentDashboard] = useState(dashboard);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [fuelType, setFuelType] = useState("");
  const [liters, setLiters] = useState("");
  const [cost, setCost] = useState("");
  const [tankFull, setTankFull] = useState(false);
  const [noMissedRefuels, setNoMissedRefuels] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [expandedResultId, setExpandedResultId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const battery = getBatteryStatus(deviceActivity?.batteryVoltageLevel);
  const engine = getEngineStatus(deviceActivity?.engineStatus);
  const encodedImei = encodeURIComponent(currentDashboard.imei);
  const liveHref = `/live-tracking/${encodedImei}`;
  const historyHref = `${liveHref}/history`;
  const serviceHref = `${liveHref}/service`;
  const fuelHref = `${liveHref}/fuel`;
  const active = currentDashboard.activeCalibration;
  const latest = currentDashboard.latestResult;

  useEffect(() => {
    if (!sheet) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) {
        setSheet(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPending, sheet]);

  const mutate = async (body: Record<string, unknown>) => {
    setMutationError(null);
    const response = await fetch("/api/fuel-calibration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as
      | FuelCalibrationDashboard
      | { error?: string };

    if (!response.ok || !("status" in payload) || payload.status === "error") {
      const message =
        "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Kalibrasi belum dapat disimpan.";
      throw new Error(message);
    }

    setCurrentDashboard(payload);
    setSheet(null);
    setFuelType("");
    setLiters("");
    setCost("");
    setTankFull(false);
    setNoMissedRefuels(false);
    router.refresh();
  };

  const handleStart = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tankFull) {
      setMutationError("Konfirmasi bahwa tangki sudah diisi penuh.");
      return;
    }
    startTransition(async () => {
      try {
        await mutate({
          action: sheet === "restart" ? "restart" : "start",
          imei: currentDashboard.imei,
          fuelType: fuelType.trim() || undefined,
        });
      } catch (error) {
        setMutationError(
          error instanceof Error ? error.message : "Kalibrasi gagal dimulai.",
        );
      }
    });
  };

  const handleComplete = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const litersNumber = Number(liters.replace(",", "."));
    const costNumber = cost.trim() ? Number(cost.replace(/\D/g, "")) : undefined;

    if (!active || !Number.isFinite(litersNumber) || litersNumber <= 0) {
      setMutationError("Masukkan jumlah BBM yang valid.");
      return;
    }
    if (!tankFull || !noMissedRefuels) {
      setMutationError("Lengkapi kedua konfirmasi agar hasil tetap valid.");
      return;
    }

    startTransition(async () => {
      try {
        await mutate({
          action: "complete",
          imei: currentDashboard.imei,
          calibrationId: active.id,
          liters: litersNumber,
          totalCostIdr: costNumber,
          fuelType: fuelType.trim() || undefined,
        });
      } catch (error) {
        setMutationError(
          error instanceof Error
            ? error.message
            : "Kalibrasi gagal diselesaikan.",
        );
      }
    });
  };

  return (
    <main className={styles.viewport}>
      <section className={styles.appCanvas}>
        <header className={styles.topBar}>
          <HeartbeatMark />
          <div className={styles.vehicleIdentity}>
            <strong>Motor Saya</strong>
            <span>IMEI {currentDashboard.imei}</span>
          </div>
          <div className={styles.headerStatus}>
            <span className={engine.tone}>
              <i aria-hidden="true" />
              {engine.label}
            </span>
            <span className={`${styles.batteryStatus} ${battery.tone}`}>
              <BatteryIcon level={deviceActivity?.batteryVoltageLevel} />
              {battery.label}
            </span>
          </div>
        </header>

        <div className={styles.scrollArea}>
          {currentDashboard.status === "error" ? (
            <section className={styles.errorState} role="alert">
              <span className={styles.loadingIcon}>
                <FuelIcon />
              </span>
              <h1>Data BBM belum tersedia</h1>
              <p>
                {currentDashboard.message ??
                  "Periksa koneksi lalu coba buka kembali halaman ini."}
              </p>
              <button type="button" onClick={() => router.refresh()}>
                Coba lagi
              </button>
            </section>
          ) : currentDashboard.state === "not_started" ? (
            <section className={styles.onboarding}>
              <h1>Kalibrasi BBM</h1>
              <div className={styles.onboardingRoad} aria-hidden="true">
                <span>1</span>
                <i />
                <span>2</span>
              </div>
              <div className={styles.onboardingCopy}>
                <h2>Kenali konsumsi BBM motor</h2>
                <p>Ukur berdasarkan dua kali pengisian tangki penuh.</p>
                <ol>
                  <li>
                    <strong>Isi penuh untuk memulai</strong>
                    <span>Catat saat tangki pertama kali diisi penuh.</span>
                  </li>
                  <li>
                    <strong>Berkendara seperti biasa</strong>
                    <span>Heartbeats mengumpulkan data perjalanan otomatis.</span>
                  </li>
                  <li>
                    <strong>Isi penuh kembali</strong>
                    <span>Masukkan liter untuk menghitung hasil.</span>
                  </li>
                </ol>
              </div>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => {
                  setMutationError(null);
                  setTankFull(false);
                  setSheet("start");
                }}
              >
                Mulai kalibrasi
              </button>
            </section>
          ) : currentDashboard.state === "active" && active ? (
            <>
              <section className={styles.calibrationProgress}>
                <h1>Kalibrasi BBM</h1>
                <div className={styles.roadJourney}>
                  <div className={styles.roadLine} aria-hidden="true" />
                  <div className={`${styles.roadPoint} ${styles.pointComplete}`}>
                    <span>1</span>
                    <i>
                      <FuelIcon />
                    </i>
                    <div>
                      <strong>Isi penuh pertama</strong>
                      <small>
                        {formatDate(active.startedAt)} ·{" "}
                        {formatNumber(active.startDistanceKm, 0)} km
                      </small>
                    </div>
                  </div>
                  <div className={`${styles.roadPoint} ${styles.pointCurrent}`}>
                    <i>
                      <MotorcycleIcon />
                    </i>
                    <div>
                      <strong>Sekarang</strong>
                      <small>
                        {formatNumber(active.distanceTraveledKm, 1)} km sejak
                        kalibrasi dimulai
                      </small>
                    </div>
                  </div>
                  <div className={`${styles.roadPoint} ${styles.pointFuture}`}>
                    <span>2</span>
                    <i>
                      <FuelIcon />
                    </i>
                    <div>
                      <strong>Isi penuh kedua</strong>
                      <small>Catat ketika mengisi penuh kembali.</small>
                    </div>
                  </div>
                </div>
                <div className={styles.progressMetrics}>
                  <div>
                    <strong>{active.tripCount}</strong>
                    <span>perjalanan</span>
                  </div>
                  <div>
                    <strong>{formatDuration(active.ridingSeconds)}</strong>
                    <span>berkendara</span>
                  </div>
                  <div>
                    <strong>{active.elapsedDays}</strong>
                    <span>hari berjalan</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => {
                    setMutationError(null);
                    setFuelType(active.fuelType ?? "");
                    setTankFull(false);
                    setNoMissedRefuels(false);
                    setSheet("complete");
                  }}
                >
                  Selesaikan kalibrasi
                </button>
                <p className={styles.validityNote}>
                  Pastikan tidak ada isi BBM lain yang terlewat.
                </p>
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => {
                    setMutationError(null);
                    setFuelType(active.fuelType ?? "");
                    setTankFull(false);
                    setSheet("restart");
                  }}
                >
                  Ada pengisian terlewat? Mulai ulang
                </button>
              </section>
              {latest ? (
                <section className={styles.lastResult}>
                  <span>Hasil terakhir</span>
                  <strong>
                    {formatNumber(latest.efficiencyKmPerLiter, 1)} km/L
                  </strong>
                  <small>
                    {formatDate(latest.startedAt)}–
                    {formatDate(latest.completedAt, true)}
                  </small>
                </section>
              ) : null}
            </>
          ) : latest ? (
            <>
              <section className={styles.resultHero}>
                <h1>Hasil kalibrasi</h1>
                <div className={styles.completedRoute}>
                  <span>1</span>
                  <i />
                  <span>2</span>
                </div>
                <div className={styles.efficiency}>
                  <span aria-hidden="true">✓</span>
                  <strong>
                    {formatNumber(latest.efficiencyKmPerLiter, 1)}
                    <small>km/L</small>
                  </strong>
                  <p>
                    {formatDate(latest.startedAt)}–
                    {formatDate(latest.completedAt, true)}
                  </p>
                </div>
                <ResultMetrics result={latest} />
              </section>

              <section className={styles.resultObservation}>
                <strong>
                  {currentDashboard.history.length > 1
                    ? "Hasil terbaru sudah dibandingkan"
                    : "Kalibrasi pertama tersimpan"}
                </strong>
                <p>
                  {currentDashboard.history.length > 1
                    ? (() => {
                        const previous =
                          currentDashboard.history[1].efficiencyKmPerLiter;
                        const difference =
                          previous > 0
                            ? ((latest.efficiencyKmPerLiter - previous) /
                                previous) *
                              100
                            : 0;
                        return `${difference >= 0 ? "Naik" : "Turun"} ${formatNumber(
                          Math.abs(difference),
                          1,
                        )}% dari kalibrasi sebelumnya.`;
                      })()
                    : "Kalibrasi ulang untuk melihat perubahan konsumsi BBM."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMutationError(null);
                    setTankFull(false);
                    setSheet("start");
                  }}
                >
                  Kalibrasi ulang
                </button>
              </section>

              <section className={styles.historySection}>
                <h2>Riwayat kalibrasi</h2>
                <div className={styles.historyList}>
                  {currentDashboard.history.map((result) => {
                    const expanded = expandedResultId === result.id;
                    return (
                      <article key={result.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedResultId(expanded ? null : result.id)
                          }
                          aria-expanded={expanded}
                        >
                          <span className={styles.historyCheck}>✓</span>
                          <span>
                            <strong>
                              {formatDate(result.startedAt)}–
                              {formatDate(result.completedAt)}
                            </strong>
                            <small>Kalibrasi lengkap</small>
                          </span>
                          <strong>
                            {formatNumber(result.efficiencyKmPerLiter, 1)} km/L
                          </strong>
                          <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
                        </button>
                        {expanded ? <ResultMetrics result={result} /> : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            </>
          ) : null}
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
          <Link href={serviceHref}>
            <ServiceIcon />
            <span>Servis</span>
          </Link>
          <Link href={fuelHref} className={styles.navActive} aria-current="page">
            <FuelIcon />
            <span>BBM</span>
          </Link>
        </nav>

        {sheet ? (
          <div
            className={styles.sheetBackdrop}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !isPending) {
                setSheet(null);
              }
            }}
          >
            <section
              className={styles.formSheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby="fuel-sheet-title"
            >
              <span className={styles.sheetHandle} aria-hidden="true" />
              <h2 id="fuel-sheet-title">
                {sheet === "start"
                  ? "Mulai kalibrasi"
                  : sheet === "restart"
                    ? "Mulai ulang kalibrasi"
                  : "Selesaikan kalibrasi"}
              </h2>
              <p>
                {sheet === "start"
                  ? "Catat checkpoint ketika tangki pertama sudah penuh."
                  : sheet === "restart"
                    ? "Kalibrasi aktif dibatalkan dan checkpoint pertama diganti dengan pengisian penuh saat ini."
                  : "Masukkan BBM pada pengisian penuh kedua."}
              </p>
              <form
                onSubmit={sheet === "complete" ? handleComplete : handleStart}
              >
                <label>
                  Tanggal & waktu
                  <input
                    value={formatDateTime(
                      sheet === "start"
                        ? currentDashboard.generatedAt
                        : new Date().toISOString(),
                    )}
                    readOnly
                  />
                </label>
                {sheet === "complete" ? (
                  <>
                    <label>
                      Jumlah BBM
                      <span className={styles.fieldWithUnit}>
                        <input
                          inputMode="decimal"
                          placeholder="6,4"
                          value={liters}
                          onChange={(event) => setLiters(event.target.value)}
                          required
                          autoFocus
                        />
                        <span>L</span>
                      </span>
                    </label>
                    <label>
                      Total biaya <small>(opsional)</small>
                      <span className={styles.fieldWithUnit}>
                        <span>Rp</span>
                        <input
                          inputMode="numeric"
                          placeholder="89.600"
                          value={cost}
                          onChange={(event) => setCost(event.target.value)}
                        />
                      </span>
                    </label>
                  </>
                ) : null}
                <label>
                  Jenis BBM <small>(opsional)</small>
                  <select
                    value={fuelType}
                    onChange={(event) => setFuelType(event.target.value)}
                  >
                    <option value="">Pilih jenis BBM</option>
                    <option value="Pertalite">Pertalite</option>
                    <option value="Pertamax">Pertamax</option>
                    <option value="Pertamax Green">Pertamax Green</option>
                    <option value="Pertamax Turbo">Pertamax Turbo</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </label>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={tankFull}
                    onChange={(event) => setTankFull(event.target.checked)}
                  />
                  <span>Tangki sudah penuh</span>
                </label>
                {sheet === "complete" ? (
                  <label className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={noMissedRefuels}
                      onChange={(event) =>
                        setNoMissedRefuels(event.target.checked)
                      }
                    />
                    <span>Tidak ada isi BBM lain yang terlewat</span>
                  </label>
                ) : null}
                {mutationError ? (
                  <p className={styles.formError} role="alert">
                    {mutationError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isPending}
                >
                  {isPending
                    ? "Menyimpan..."
                    : sheet === "start"
                      ? "Catat isi penuh pertama"
                      : sheet === "restart"
                        ? "Mulai ulang dari sekarang"
                      : "Hitung hasil kalibrasi"}
                </button>
                <button
                  type="button"
                  className={styles.cancelButton}
                  disabled={isPending}
                  onClick={() => setSheet(null)}
                >
                  Batal
                </button>
              </form>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
