import rawHistory from "@/data/gps-history.json";
import type { GpsHistoryDataset, GpsHistoryPoint } from "@/types/gps";

const REQUIRED_KEYS = [
  "id",
  "imei",
  "serverReceivedAt",
  "gpsTimestamp",
  "latitude",
  "longitude",
  "speedKph",
  "course",
  "satelliteCount",
  "packetFamily",
  "peerAddr",
] as const;

function isGpsHistoryPoint(value: unknown): value is GpsHistoryPoint {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return REQUIRED_KEYS.every((key) => key in record);
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

export function loadGpsHistory(): GpsHistoryDataset {
  try {
    const input = rawHistory as unknown;

    if (!Array.isArray(input)) {
      return {
        status: "error",
        message: "Dataset must be an array of GPS history rows.",
        points: [],
      };
    }

    const points = input.filter(isGpsHistoryPoint);

    if (points.length !== input.length) {
      return {
        status: "error",
        message: "Some GPS rows are missing required fields.",
        points: sortPoints(points),
      };
    }

    return {
      status: "ready",
      points: sortPoints(points),
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to parse GPS history dataset.",
      points: [],
    };
  }
}
