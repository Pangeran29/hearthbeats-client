import type { GpsHistoryApiResponse, GpsHistoryDataset, GpsHistoryPoint } from "@/types/gps";

const GPS_HISTORY_API_BASE_URL =
  process.env.GPS_HISTORY_API_BASE_URL ?? "http://147.93.156.141:5001/api";
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
  return [...points].sort((left, right) => {
    const leftTime = Date.parse(left.gpsTimestamp || left.serverReceivedAt);
    const rightTime = Date.parse(right.gpsTimestamp || right.serverReceivedAt);

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
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
}: {
  imei?: string;
  startAt?: string;
}): Promise<GpsHistoryDataset> {
  const effectiveImei = imei?.trim() || DEFAULT_IMEI;
  const effectiveStartAt = startAt?.trim() || DEFAULT_START_AT;

  try {
    const response = await fetch(
      `${GPS_HISTORY_API_BASE_URL}/devices/${encodeURIComponent(effectiveImei)}/locations?start_at=${encodeURIComponent(effectiveStartAt)}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return {
        status: "error",
        message: `API request failed with status ${response.status}.`,
        points: [],
        imei: effectiveImei,
        startAt: effectiveStartAt,
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
        latestServerReceivedAt: normalizeTimestamp(effectiveStartAt),
      };
    }

    return {
      status: "ready",
      points: sortPoints(payload.points.map((point, index) => toPoint(payload.imei, point, index))),
      imei: payload.imei,
      startAt: normalizeTimestamp(payload.start_at),
      latestServerReceivedAt: resolveLatestServerReceivedAt(payload),
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Failed to fetch GPS history from the API.",
      points: [],
      imei: effectiveImei,
      startAt: effectiveStartAt,
      latestServerReceivedAt: normalizeTimestamp(effectiveStartAt),
    };
  }
}
