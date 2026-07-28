"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";

import type { GpsHistoryPoint, TrackingSession } from "@/types/gps";
import styles from "./journey-share-modal.module.css";

const DynamicJourneyShareMap = dynamic(
  () =>
    import("@/components/journey-share-map").then(
      (module) => module.JourneyShareMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className={styles.mapPlaceholder}>Menyiapkan peta...</div>
    ),
  },
);

type JourneyShareModalProps = {
  isOpen: boolean;
  onClose: () => void;
  points: GpsHistoryPoint[];
  session: TrackingSession;
  distanceKm: number;
  peakSpeedKph: number;
};

function formatNumber(value: number, maximumFractionDigits: number) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

function formatDuration(seconds: number) {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}j ${minutes}m`;
  }

  return `${minutes} mnt`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function getJourneyTitle(value: string) {
  const hourPart = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  })
    .formatToParts(new Date(value))
    .find((part) => part.type === "hour")?.value;
  const hour = Number(hourPart);

  if (hour >= 4 && hour < 11) {
    return "Perjalanan Pagi";
  }

  if (hour >= 11 && hour < 15) {
    return "Perjalanan Siang";
  }

  if (hour >= 15 && hour < 18) {
    return "Perjalanan Sore";
  }

  return "Perjalanan Malam";
}

function MotorcycleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="12" cy="34" r="7" />
      <circle cx="37" cy="34" r="7" />
      <path d="M12 34h9l6-12h7l3 12M21 34l-6-14h8l7 14M28 17h7M18 15l5 5" />
    </svg>
  );
}

function HeartbeatsLogo() {
  return (
    <span className={styles.shareBrand}>
      <svg viewBox="0 0 42 28" aria-hidden="true">
        <path d="M2 15h8l3-8 6 16 4-8h8" />
        <path d="M27 15h13l-8 9" />
      </svg>
      <strong>Heartbeats</strong>
    </span>
  );
}

async function createShareBlob(node: HTMLElement) {
  await document.fonts.ready;
  const { toBlob } = await import("html-to-image");
  const previousStyles = {
    width: node.style.width,
    height: node.style.height,
    maxWidth: node.style.maxWidth,
    aspectRatio: node.style.aspectRatio,
  };

  node.style.width = "360px";
  node.style.height = "640px";
  node.style.maxWidth = "none";
  node.style.aspectRatio = "auto";
  window.dispatchEvent(new Event("resize"));

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  try {
    return await toBlob(node, {
      cacheBust: true,
      pixelRatio: 3,
      width: 360,
      height: 640,
      backgroundColor: "#f4f1ea",
    });
  } finally {
    node.style.width = previousStyles.width;
    node.style.height = previousStyles.height;
    node.style.maxWidth = previousStyles.maxWidth;
    node.style.aspectRatio = previousStyles.aspectRatio;
    window.dispatchEvent(new Event("resize"));
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function JourneyShareModal({
  isOpen,
  onClose,
  points,
  session,
  distanceKm,
  peakSpeedKph,
}: JourneyShareModalProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleDialogKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setIsMapReady(false);
      setMessage(null);
    }
  }, [isOpen, session.id]);

  if (!isOpen) {
    return null;
  }

  const portalRoot = typeof document === "undefined" ? null : document.body;

  if (!portalRoot) {
    return null;
  }

  const title = getJourneyTitle(session.startedAt);
  const endedAt = session.endedAt ?? session.startedAt;
  const fileName = `heartbeats-perjalanan-${formatDate(session.startedAt)
    .toLowerCase()
    .replaceAll(" ", "-")}.png`;
  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };
  const exportImage = async (share: boolean) => {
    if (!cardRef.current || !isMapReady || isExporting) {
      return;
    }

    setIsExporting(true);
    setMessage(null);

    try {
      const blob = await createShareBlob(cardRef.current);

      if (!blob) {
        throw new Error("Gambar tidak dapat dibuat.");
      }

      const file = new File([blob], fileName, { type: "image/png" });
      const canShareFile =
        share &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFile) {
        await navigator.share({
          title,
          text: `${title} bersama Heartbeats`,
          files: [file],
        });
        setMessage("Gambar perjalanan siap dibagikan.");
      } else {
        downloadBlob(blob, fileName);
        setMessage(
          share
            ? "Browser ini belum mendukung berbagi gambar. Gambar telah disimpan."
            : "Gambar perjalanan telah disimpan.",
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "Gambar perjalanan tidak dapat dibuat.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={handleBackdropClick}
      role="presentation"
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="journey-share-title"
      >
        <header className={styles.dialogHeader}>
          <div>
            <span>Bagikan perjalanan</span>
            <h2 id="journey-share-title">Pratinjau gambar</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Tutup pratinjau"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className={styles.previewViewport}>
          <div ref={cardRef} className={styles.shareCard}>
            <DynamicJourneyShareMap
              points={points}
              onReady={() => setIsMapReady(true)}
            />
            <div className={styles.readabilityFade} />
            <div className={styles.shareContent}>
              <div className={styles.shareIdentity}>
                <MotorcycleIcon />
                <HeartbeatsLogo />
              </div>
              <h3>{title}</h3>
              <div className={styles.shareStats}>
                <div>
                  <span>Jarak</span>
                  <strong>{formatNumber(distanceKm, 2)} km</strong>
                </div>
                <div>
                  <span>Durasi</span>
                  <strong>{formatDuration(session.durationSeconds)}</strong>
                </div>
                <div>
                  <span>Kecepatan tertinggi</span>
                  <strong>{Math.round(peakSpeedKph)} km/j</strong>
                </div>
              </div>
              <p>
                {formatDate(session.startedAt)} ·{" "}
                {formatClock(session.startedAt)}–{formatClock(endedAt)} WIB
              </p>
              <small>© OpenStreetMap contributors</small>
            </div>
          </div>
        </div>

        {!isMapReady ? (
          <p className={styles.statusMessage}>Menyiapkan detail peta...</p>
        ) : message ? (
          <p className={styles.statusMessage} role="status">
            {message}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => exportImage(false)}
            disabled={!isMapReady || isExporting}
          >
            Simpan gambar
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => exportImage(true)}
            disabled={!isMapReady || isExporting}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
            </svg>
            {isExporting ? "Membuat..." : "Bagikan"}
          </button>
        </div>
      </section>
    </div>,
    portalRoot,
  );
}
