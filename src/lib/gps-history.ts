import type { GpsHistoryApiResponse, GpsHistoryDataset, GpsHistoryPoint } from "@/types/gps";

const DEFAULT_GPS_HISTORY_API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:5001/api"
    : "http://147.93.156.141:5001/api";

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function isLocalHostUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function resolveGpsHistoryApiBaseUrl() {
  const configured = process.env.GPS_HISTORY_API_BASE_URL;

  if (!configured) {
    return DEFAULT_GPS_HISTORY_API_BASE_URL;
  }

  const normalized = normalizeApiBaseUrl(configured);

  // Guard against misconfigured production deployments that still point to localhost.
  if (process.env.NODE_ENV === "production" && isLocalHostUrl(normalized)) {
    return "http://147.93.156.141:5001/api";
  }

  return normalized;
}

const GPS_HISTORY_API_BASE_URL = resolveGpsHistoryApiBaseUrl();
const DEFAULT_IMEI = "866221070478388";
const DEFAULT_START_AT = "2026-04-18T10:00:00Z";

function normalizeTimestamp(value: string) {
  if (!value) {
    return value;
  }

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  return `${value}Z`;
}

function normalizeOptionalTimestamp(value?: string) {
  if (!value) {
    return undefined;
  }

  return normalizeTimestamp(value);
}

function isNumberLike(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    if (normalized === "") {
      return false;
    }

    return Number.isFinite(Number(normalized));
  }

  return false;
}

function toNumber(value: number | string, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function sortPoints(points: GpsHistoryPoint[]) {
  const parseTime = (value: string) => {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  return [...points].sort((left, right) => {
    // Keep route chronology aligned to ingestion time because gpsTimestamp
    // can be stale/out-of-order for some devices.
    const leftServerTime = parseTime(left.serverReceivedAt);
    const rightServerTime = parseTime(right.serverReceivedAt);

    if (leftServerTime !== rightServerTime) {
      return leftServerTime - rightServerTime;
    }

    const leftGpsTime = parseTime(left.gpsTimestamp);
    const rightGpsTime = parseTime(right.gpsTimestamp);

    if (leftGpsTime !== rightGpsTime) {
      return leftGpsTime - rightGpsTime;
    }

    return left.id - right.id;
  });
}

function isApiPoint(value: unknown): value is GpsHistoryApiResponse["points"][number] {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.server_received_at === "string" &&
    (record.gps_timestamp === undefined ||
      record.gps_timestamp === null ||
      typeof record.gps_timestamp === "string") &&
    isNumberLike(record.latitude) &&
    isNumberLike(record.longitude) &&
    isNumberLike(record.speed_kph) &&
    isNumberLike(record.course) &&
    isNumberLike(record.satellite_count)
  );
}

function isApiResponse(value: unknown): value is GpsHistoryApiResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.imei === "string" &&
    typeof record.start_at === "string" &&
    (record.end_at === undefined ||
      record.end_at === null ||
      typeof record.end_at === "string") &&
    (record.latest_server_received_at === undefined ||
      record.latest_server_received_at === null ||
      typeof record.latest_server_received_at === "string") &&
    Array.isArray(record.points) &&
    record.points.every(isApiPoint)
  );
}

function resolveLatestServerReceivedAt(payload: GpsHistoryApiResponse) {
  if (payload.latest_server_received_at) {
    return normalizeTimestamp(payload.latest_server_received_at);
  }

  const fallbackFromPoints = payload.points.at(-1)?.server_received_at;

  if (fallbackFromPoints) {
    return normalizeTimestamp(fallbackFromPoints);
  }

  return normalizeTimestamp(payload.start_at);
}

function toPoint(
  imei: string,
  point: GpsHistoryApiResponse["points"][number],
  index: number,
): GpsHistoryPoint {
  const gpsTimestamp =
    typeof point.gps_timestamp === "string" && point.gps_timestamp.trim() !== ""
      ? point.gps_timestamp
      : point.server_received_at;

  return {
    id: index + 1,
    sourceId: point.id,
    imei,
    serverReceivedAt: normalizeTimestamp(point.server_received_at),
    gpsTimestamp: normalizeTimestamp(gpsTimestamp),
    latitude: toNumber(point.latitude),
    longitude: toNumber(point.longitude),
    speedKph: toNumber(point.speed_kph),
    course: toNumber(point.course),
    satelliteCount: Math.round(toNumber(point.satellite_count)),
    packetFamily: "api_location",
    peerAddr: "",
  };
}

export function getDefaultGpsHistoryParams() {
  return {
    imei: DEFAULT_IMEI,
    startAt: DEFAULT_START_AT,
  };
}

export async function fetchGpsHistory({
  imei,
  startAt,
  endAt,
}: {
  imei?: string;
  startAt?: string;
  endAt?: string;
}): Promise<GpsHistoryDataset> {
  const effectiveImei = imei?.trim() || DEFAULT_IMEI;
  const effectiveStartAt = startAt?.trim() || DEFAULT_START_AT;
  const effectiveEndAt = endAt?.trim() || undefined;

  const queryParams = new URLSearchParams({
    start_at: effectiveStartAt,
  });

  if (effectiveEndAt) {
    queryParams.set("end_at", effectiveEndAt);
  }

  try {
    const requestUrl = `${GPS_HISTORY_API_BASE_URL}/devices/${encodeURIComponent(effectiveImei)}/locations?${queryParams.toString()}`;

    const response = await fetch(
      requestUrl,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return {
        status: "error",
        message: `API request failed with status ${response.status}.`,
        points: [],
        imei: effectiveImei,
        startAt: effectiveStartAt,
        endAt: normalizeOptionalTimestamp(effectiveEndAt),
        latestServerReceivedAt: normalizeTimestamp(effectiveStartAt),
      };
    }

    const payload: unknown = await response.json();

    if (!isApiResponse(payload)) {
      return {
        status: "error",
        message: "API response did not match the expected GPS history format.",
        points: [],
        imei: effectiveImei,
        startAt: effectiveStartAt,
        endAt: normalizeOptionalTimestamp(effectiveEndAt),
        latestServerReceivedAt: normalizeTimestamp(effectiveStartAt),
      };
    }

    return {
      status: "ready",
      points: sortPoints(
        payload.points.map((point, index) => toPoint(payload.imei, point, index)),
      ),
      imei: payload.imei,
      startAt: normalizeTimestamp(payload.start_at),
      endAt: normalizeOptionalTimestamp(payload.end_at ?? effectiveEndAt),
      latestServerReceivedAt: resolveLatestServerReceivedAt(payload),
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? `Failed to fetch GPS history from ${GPS_HISTORY_API_BASE_URL}: ${error.message}`
          : "Failed to fetch GPS history from the API.",
      points: [],
      imei: effectiveImei,
      startAt: effectiveStartAt,
      endAt: normalizeOptionalTimestamp(effectiveEndAt),
      latestServerReceivedAt: normalizeTimestamp(effectiveStartAt),
    };
  }
}
