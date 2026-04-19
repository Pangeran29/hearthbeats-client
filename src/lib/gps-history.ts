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
    typeof record.gps_timestamp === "string" &&
    typeof record.latitude === "number" &&
    typeof record.longitude === "number" &&
    typeof record.speed_kph === "number" &&
    typeof record.course === "number" &&
    typeof record.satellite_count === "number"
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
    Array.isArray(record.points) &&
    record.points.every(isApiPoint)
  );
}

function toPoint(
  imei: string,
  point: GpsHistoryApiResponse["points"][number],
  index: number,
): GpsHistoryPoint {
  return {
    id: index + 1,
    imei,
    serverReceivedAt: normalizeTimestamp(point.server_received_at),
    gpsTimestamp: normalizeTimestamp(point.gps_timestamp),
    latitude: point.latitude,
    longitude: point.longitude,
    speedKph: point.speed_kph,
    course: point.course,
    satelliteCount: point.satellite_count,
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
      };
    }

    return {
      status: "ready",
      points: sortPoints(payload.points.map((point, index) => toPoint(payload.imei, point, index))),
      imei: payload.imei,
      startAt: normalizeTimestamp(payload.start_at),
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Failed to fetch GPS history from the API.",
      points: [],
      imei: effectiveImei,
      startAt: effectiveStartAt,
    };
  }
}
