import type {
  DailyRideSummary,
  DailyRideSummaryApiResponse,
  DeviceActivity,
  DeviceServiceApiResponse,
  DeviceServiceSummary,
  FuelCalibrationApiResponse,
  FuelCalibrationApiResult,
  FuelCalibrationDashboard,
  FuelCalibrationResult,
  GpsHistoryApiResponse,
  GpsHistoryDataset,
  GpsHistoryPoint,
  TrackingSessionsApiResponse,
  TrackingSessionsDataset,
} from "@/types/gps";

const DEFAULT_GPS_HISTORY_API_BASE_URL = "http://147.93.156.141:5001/api";

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
const WIB_OFFSET = "+07:00";

function formatWibDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function getTodayWibDate() {
  return formatWibDate(new Date());
}

export function wibDateToUtcRange(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const calendarDate = new Date(
    Date.UTC(yearNumber, monthNumber - 1, dayNumber),
  );
  const start = new Date(`${date}T00:00:00${WIB_OFFSET}`);
  const end = new Date(`${date}T23:59:59.999${WIB_OFFSET}`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    calendarDate.getUTCFullYear() !== yearNumber ||
    calendarDate.getUTCMonth() + 1 !== monthNumber ||
    calendarDate.getUTCDate() !== dayNumber
  ) {
    return null;
  }

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

function isTrackingSessionsApiResponse(
  value: unknown,
): value is TrackingSessionsApiResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.imei === "string" &&
    typeof record.date === "string" &&
    record.timezone === "Asia/Jakarta" &&
    Array.isArray(record.sessions) &&
    record.sessions.every((session) => {
      if (!session || typeof session !== "object") {
        return false;
      }

      const item = session as Record<string, unknown>;

      return (
        typeof item.id === "number" &&
        typeof item.started_at === "string" &&
        (item.ended_at === undefined ||
          item.ended_at === null ||
          typeof item.ended_at === "string") &&
        (item.state === "completed" || item.state === "ongoing") &&
        typeof item.duration_seconds === "number" &&
        Number.isFinite(item.duration_seconds) &&
        typeof item.distance_km === "number" &&
        Number.isFinite(item.distance_km)
      );
    })
  );
}

function isDailyRideSummaryApiResponse(
  value: unknown,
): value is DailyRideSummaryApiResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.imei === "string" &&
    typeof record.date === "string" &&
    record.timezone === "Asia/Jakarta" &&
    typeof record.generated_at === "string" &&
    (record.customer_name === undefined ||
      record.customer_name === null ||
      typeof record.customer_name === "string") &&
    typeof record.total_distance_km === "number" &&
    Number.isFinite(record.total_distance_km) &&
    typeof record.riding_seconds === "number" &&
    Number.isFinite(record.riding_seconds) &&
    typeof record.average_speed_kph === "number" &&
    Number.isFinite(record.average_speed_kph)
  );
}

function isDeviceServiceApiResponse(
  value: unknown,
): value is DeviceServiceApiResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const recommendation = record.next_recommendation;

  if (!recommendation || typeof recommendation !== "object") {
    return false;
  }

  const recommendationRecord = recommendation as Record<string, unknown>;

  return (
    typeof record.imei === "string" &&
    record.timezone === "Asia/Jakarta" &&
    typeof record.generated_at === "string" &&
    typeof record.total_tracked_distance_km === "number" &&
    Number.isFinite(record.total_tracked_distance_km) &&
    typeof record.next_milestone_km === "number" &&
    Number.isFinite(record.next_milestone_km) &&
    typeof record.distance_remaining_km === "number" &&
    Number.isFinite(record.distance_remaining_km) &&
    typeof recommendationRecord.code === "string" &&
    typeof recommendationRecord.interval_km === "number" &&
    typeof recommendationRecord.title === "string" &&
    Array.isArray(recommendationRecord.items) &&
    recommendationRecord.items.every((item) => typeof item === "string") &&
    Array.isArray(record.milestones) &&
    record.milestones.every((milestone) => {
      if (!milestone || typeof milestone !== "object") {
        return false;
      }

      const item = milestone as Record<string, unknown>;
      return (
        typeof item.milestone_number === "number" &&
        typeof item.milestone_km === "number" &&
        typeof item.achieved_on === "string" &&
        typeof item.recommendation_code === "string" &&
        typeof item.recommendation_label === "string" &&
        typeof item.recommendation_title === "string" &&
        Array.isArray(item.recommendation_items) &&
        item.recommendation_items.every(
          (recommendationItem) => typeof recommendationItem === "string",
        )
      );
    })
  );
}

export function getWibDayStartUtc(date = getTodayWibDate()) {
  return new Date(`${date}T00:00:00${WIB_OFFSET}`).toISOString();
}

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
    startAt: getWibDayStartUtc(),
  };
}

export async function fetchTrackingSessions({
  imei,
  date,
}: {
  imei?: string;
  date: string;
}): Promise<TrackingSessionsDataset> {
  const effectiveImei = imei?.trim() || DEFAULT_IMEI;

  try {
    const query = new URLSearchParams({ date });
    const requestUrl = `${GPS_HISTORY_API_BASE_URL}/devices/${encodeURIComponent(effectiveImei)}/sessions?${query.toString()}`;
    const response = await fetch(requestUrl, { cache: "no-store" });

    if (!response.ok) {
      return {
        status: "error",
        message: `API request failed with status ${response.status}.`,
        imei: effectiveImei,
        date,
        timezone: "Asia/Jakarta",
        sessions: [],
      };
    }

    const payload: unknown = await response.json();

    if (!isTrackingSessionsApiResponse(payload)) {
      return {
        status: "error",
        message: "API response did not match the expected session format.",
        imei: effectiveImei,
        date,
        timezone: "Asia/Jakarta",
        sessions: [],
      };
    }

    return {
      status: "ready",
      imei: payload.imei,
      date: payload.date,
      timezone: "Asia/Jakarta",
      sessions: payload.sessions.map((session) => ({
        id: session.id,
        startedAt: normalizeTimestamp(session.started_at),
        endedAt:
          typeof session.ended_at === "string"
            ? normalizeTimestamp(session.ended_at)
            : undefined,
        state: session.state,
        durationSeconds: session.duration_seconds,
        distanceKm: session.distance_km,
      })),
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? `Failed to fetch tracking sessions from ${GPS_HISTORY_API_BASE_URL}: ${error.message}`
          : "Failed to fetch tracking sessions from the API.",
      imei: effectiveImei,
      date,
      timezone: "Asia/Jakarta",
      sessions: [],
    };
  }
}

export async function fetchDailyRideSummary({
  imei,
  date,
}: {
  imei?: string;
  date: string;
}): Promise<DailyRideSummary> {
  const effectiveImei = imei?.trim() || DEFAULT_IMEI;
  const generatedAt = new Date().toISOString();
  const emptySummary = {
    imei: effectiveImei,
    date,
    timezone: "Asia/Jakarta" as const,
    generatedAt,
    totalDistanceKm: 0,
    ridingSeconds: 0,
    averageSpeedKph: 0,
  };

  try {
    const query = new URLSearchParams({ date });
    const requestUrl = `${GPS_HISTORY_API_BASE_URL}/devices/${encodeURIComponent(effectiveImei)}/daily-summary?${query.toString()}`;
    const response = await fetch(requestUrl, { cache: "no-store" });

    if (!response.ok) {
      return {
        status: "error",
        message: `API request failed with status ${response.status}.`,
        ...emptySummary,
      };
    }

    const payload: unknown = await response.json();

    if (!isDailyRideSummaryApiResponse(payload)) {
      return {
        status: "error",
        message: "API response did not match the expected daily summary format.",
        ...emptySummary,
      };
    }

    return {
      status: "ready",
      imei: payload.imei,
      date: payload.date,
      timezone: "Asia/Jakarta",
      generatedAt: normalizeTimestamp(payload.generated_at),
      customerName:
        typeof payload.customer_name === "string"
          ? payload.customer_name
          : undefined,
      totalDistanceKm: payload.total_distance_km,
      ridingSeconds: payload.riding_seconds,
      averageSpeedKph: payload.average_speed_kph,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? `Failed to fetch the daily ride summary from ${GPS_HISTORY_API_BASE_URL}: ${error.message}`
          : "Failed to fetch the daily ride summary from the API.",
      ...emptySummary,
    };
  }
}

export async function fetchDeviceServiceSummary(
  imei?: string,
): Promise<DeviceServiceSummary> {
  const effectiveImei = imei?.trim() || DEFAULT_IMEI;
  const emptySummary = {
    imei: effectiveImei,
    timezone: "Asia/Jakarta" as const,
    generatedAt: new Date().toISOString(),
    totalTrackedDistanceKm: 0,
    nextMilestoneKm: 1_000,
    distanceRemainingKm: 1_000,
    nextRecommendation: {
      code: "service_1000",
      intervalKm: 1_000,
      title: "Rekomendasi servis 1.000 km",
      items: [],
    },
    milestones: [],
  };

  try {
    const response = await fetch(
      `${GPS_HISTORY_API_BASE_URL}/devices/${encodeURIComponent(effectiveImei)}/service`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return {
        status: "error",
        message:
          response.status === 404
            ? "Perangkat tidak ditemukan."
            : `API request failed with status ${response.status}.`,
        ...emptySummary,
      };
    }

    const payload: unknown = await response.json();

    if (!isDeviceServiceApiResponse(payload)) {
      return {
        status: "error",
        message: "API response did not match the expected service format.",
        ...emptySummary,
      };
    }

    return {
      status: "ready",
      imei: payload.imei,
      timezone: "Asia/Jakarta",
      generatedAt: normalizeTimestamp(payload.generated_at),
      totalTrackedDistanceKm: payload.total_tracked_distance_km,
      nextMilestoneKm: payload.next_milestone_km,
      distanceRemainingKm: payload.distance_remaining_km,
      nextRecommendation: {
        code: payload.next_recommendation.code,
        intervalKm: payload.next_recommendation.interval_km,
        title: payload.next_recommendation.title,
        items: payload.next_recommendation.items,
      },
      milestones: payload.milestones.map((milestone) => ({
        milestoneNumber: milestone.milestone_number,
        milestoneKm: milestone.milestone_km,
        achievedOn: milestone.achieved_on,
        recommendationCode: milestone.recommendation_code,
        recommendationLabel: milestone.recommendation_label,
        recommendationTitle: milestone.recommendation_title,
        recommendationItems: milestone.recommendation_items,
      })),
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? `Failed to fetch service data from ${GPS_HISTORY_API_BASE_URL}: ${error.message}`
          : "Failed to fetch service data from the API.",
      ...emptySummary,
    };
  }
}

function isFuelCalibrationApiResult(
  value: unknown,
): value is FuelCalibrationApiResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "number" &&
    typeof record.started_at === "string" &&
    typeof record.completed_at === "string" &&
    typeof record.start_distance_km === "number" &&
    typeof record.end_distance_km === "number" &&
    typeof record.distance_traveled_km === "number" &&
    typeof record.liters === "number" &&
    (record.total_cost_idr === undefined ||
      record.total_cost_idr === null ||
      typeof record.total_cost_idr === "number") &&
    (record.fuel_type === undefined ||
      record.fuel_type === null ||
      typeof record.fuel_type === "string") &&
    typeof record.efficiency_km_per_liter === "number" &&
    (record.cost_per_km_idr === undefined ||
      record.cost_per_km_idr === null ||
      typeof record.cost_per_km_idr === "number") &&
    typeof record.riding_seconds === "number" &&
    typeof record.engine_on_seconds === "number" &&
    typeof record.trip_count === "number"
  );
}

function isFuelCalibrationApiResponse(
  value: unknown,
): value is FuelCalibrationApiResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const active = record.active_calibration;
  const activeIsValid =
    active === undefined ||
    active === null ||
    (typeof active === "object" &&
      typeof (active as Record<string, unknown>).id === "number" &&
      typeof (active as Record<string, unknown>).started_at === "string" &&
      typeof (active as Record<string, unknown>).start_distance_km ===
        "number" &&
      typeof (active as Record<string, unknown>).current_distance_km ===
        "number" &&
      typeof (active as Record<string, unknown>).distance_traveled_km ===
        "number" &&
      typeof (active as Record<string, unknown>).riding_seconds === "number" &&
      typeof (active as Record<string, unknown>).engine_on_seconds ===
        "number" &&
      typeof (active as Record<string, unknown>).trip_count === "number" &&
      typeof (active as Record<string, unknown>).elapsed_days === "number");
  const latest = record.latest_result;

  return (
    typeof record.imei === "string" &&
    record.timezone === "Asia/Jakarta" &&
    typeof record.generated_at === "string" &&
    (record.state === "not_started" ||
      record.state === "active" ||
      record.state === "completed") &&
    activeIsValid &&
    (latest === undefined ||
      latest === null ||
      isFuelCalibrationApiResult(latest)) &&
    Array.isArray(record.history) &&
    record.history.every(isFuelCalibrationApiResult)
  );
}

function mapFuelCalibrationResult(
  result: FuelCalibrationApiResult,
): FuelCalibrationResult {
  return {
    id: result.id,
    startedAt: normalizeTimestamp(result.started_at),
    completedAt: normalizeTimestamp(result.completed_at),
    startDistanceKm: result.start_distance_km,
    endDistanceKm: result.end_distance_km,
    distanceTraveledKm: result.distance_traveled_km,
    liters: result.liters,
    totalCostIdr: result.total_cost_idr ?? undefined,
    fuelType: result.fuel_type ?? undefined,
    efficiencyKmPerLiter: result.efficiency_km_per_liter,
    costPerKmIdr: result.cost_per_km_idr ?? undefined,
    ridingSeconds: result.riding_seconds,
    engineOnSeconds: result.engine_on_seconds,
    tripCount: result.trip_count,
  };
}

function mapFuelCalibrationDashboard(
  payload: FuelCalibrationApiResponse,
): FuelCalibrationDashboard {
  const active = payload.active_calibration;

  return {
    status: "ready",
    imei: payload.imei,
    timezone: "Asia/Jakarta",
    generatedAt: normalizeTimestamp(payload.generated_at),
    state: payload.state,
    activeCalibration: active
      ? {
          id: active.id,
          startedAt: normalizeTimestamp(active.started_at),
          startDistanceKm: active.start_distance_km,
          currentDistanceKm: active.current_distance_km,
          distanceTraveledKm: active.distance_traveled_km,
          ridingSeconds: active.riding_seconds,
          engineOnSeconds: active.engine_on_seconds,
          tripCount: active.trip_count,
          elapsedDays: active.elapsed_days,
          fuelType: active.fuel_type ?? undefined,
        }
      : undefined,
    latestResult: payload.latest_result
      ? mapFuelCalibrationResult(payload.latest_result)
      : undefined,
    history: payload.history.map(mapFuelCalibrationResult),
  };
}

function emptyFuelCalibrationDashboard(
  imei: string,
  message: string,
): FuelCalibrationDashboard {
  return {
    status: "error",
    message,
    imei,
    timezone: "Asia/Jakarta",
    generatedAt: new Date().toISOString(),
    state: "not_started",
    history: [],
  };
}

async function requestFuelCalibration(
  imei: string,
  path: string,
  init?: RequestInit,
): Promise<FuelCalibrationDashboard> {
  try {
    const response = await fetch(
      `${GPS_HISTORY_API_BASE_URL}/devices/${encodeURIComponent(imei)}${path}`,
      { cache: "no-store", ...init },
    );

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;
      const message =
        typeof errorPayload?.error === "string"
          ? errorPayload.error
          : `API request failed with status ${response.status}.`;
      return emptyFuelCalibrationDashboard(imei, message);
    }

    const payload: unknown = await response.json();
    return isFuelCalibrationApiResponse(payload)
      ? mapFuelCalibrationDashboard(payload)
      : emptyFuelCalibrationDashboard(
          imei,
          "API response did not match the expected fuel calibration format.",
        );
  } catch (error) {
    return emptyFuelCalibrationDashboard(
      imei,
      error instanceof Error
        ? `Failed to fetch fuel calibration data: ${error.message}`
        : "Failed to fetch fuel calibration data.",
    );
  }
}

export async function fetchFuelCalibrationDashboard(
  imei?: string,
): Promise<FuelCalibrationDashboard> {
  const effectiveImei = imei?.trim() || DEFAULT_IMEI;
  return requestFuelCalibration(effectiveImei, "/fuel-calibrations");
}

export async function startFuelCalibration({
  imei,
  fuelType,
}: {
  imei: string;
  fuelType?: string;
}) {
  return requestFuelCalibration(imei, "/fuel-calibrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fuel_type: fuelType || null }),
  });
}

export async function restartFuelCalibration({
  imei,
  fuelType,
}: {
  imei: string;
  fuelType?: string;
}) {
  return requestFuelCalibration(imei, "/fuel-calibrations/restart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fuel_type: fuelType || null }),
  });
}

export async function completeFuelCalibration({
  imei,
  calibrationId,
  liters,
  totalCostIdr,
  fuelType,
}: {
  imei: string;
  calibrationId: number;
  liters: number;
  totalCostIdr?: number;
  fuelType?: string;
}) {
  return requestFuelCalibration(
    imei,
    `/fuel-calibrations/${calibrationId}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        liters,
        total_cost_idr: totalCostIdr ?? null,
        fuel_type: fuelType || null,
        tank_full: true,
        no_missed_refuels: true,
      }),
    },
  );
}

export async function fetchDeviceActivity(
  imei?: string,
): Promise<DeviceActivity> {
  const effectiveImei = imei?.trim() || DEFAULT_IMEI;

  try {
    const response = await fetch(
      `${GPS_HISTORY_API_BASE_URL}/devices/${encodeURIComponent(effectiveImei)}/activity`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return {};
    }

    const payload: unknown = await response.json();

    if (!payload || typeof payload !== "object") {
      return {};
    }

    const device = payload as Record<string, unknown>;
    const lastSeenAt =
      device.imei === effectiveImei ? device.last_seen_at : undefined;
    const latestVoltageLevel =
      device.imei === effectiveImei
        ? device.latest_voltage_level
        : undefined;
    const latestEngineStatus =
      device.imei === effectiveImei
        ? device.latest_engine_status
        : undefined;
    const batteryReportedAt =
      device.imei === effectiveImei ? device.battery_reported_at : undefined;

    return {
      lastSeenAt:
        typeof lastSeenAt === "string"
          ? normalizeTimestamp(lastSeenAt)
          : undefined,
      engineStatus:
        latestEngineStatus === "on" || latestEngineStatus === "off"
          ? latestEngineStatus
          : "unknown",
      batteryVoltageLevel:
        typeof latestVoltageLevel === "number" &&
        Number.isInteger(latestVoltageLevel)
          ? latestVoltageLevel
          : undefined,
      batteryReportedAt:
        typeof batteryReportedAt === "string"
          ? normalizeTimestamp(batteryReportedAt)
          : undefined,
    };
  } catch {
    return {};
  }
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
  const effectiveStartAt = startAt?.trim() || getWibDayStartUtc();
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

export async function fetchLatestGpsLocation({
  imei,
}: {
  imei?: string;
}): Promise<GpsHistoryDataset> {
  const effectiveImei = imei?.trim() || DEFAULT_IMEI;
  const fallbackTimestamp = new Date().toISOString();

  try {
    const requestUrl = `${GPS_HISTORY_API_BASE_URL}/devices/${encodeURIComponent(effectiveImei)}/locations/latest`;
    const response = await fetch(requestUrl, { cache: "no-store" });

    if (!response.ok) {
      return {
        status: "error",
        message: `API request failed with status ${response.status}.`,
        points: [],
        imei: effectiveImei,
        startAt: fallbackTimestamp,
        latestServerReceivedAt: fallbackTimestamp,
      };
    }

    const payload: unknown = await response.json();

    if (!isApiResponse(payload)) {
      return {
        status: "error",
        message: "API response did not match the expected latest GPS format.",
        points: [],
        imei: effectiveImei,
        startAt: fallbackTimestamp,
        latestServerReceivedAt: fallbackTimestamp,
      };
    }

    return {
      status: "ready",
      points: sortPoints(
        payload.points.map((point, index) => toPoint(payload.imei, point, index)),
      ),
      imei: payload.imei,
      startAt: normalizeTimestamp(payload.start_at),
      latestServerReceivedAt: resolveLatestServerReceivedAt(payload),
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? `Failed to fetch the latest GPS location from ${GPS_HISTORY_API_BASE_URL}: ${error.message}`
          : "Failed to fetch the latest GPS location from the API.",
      points: [],
      imei: effectiveImei,
      startAt: fallbackTimestamp,
      latestServerReceivedAt: fallbackTimestamp,
    };
  }
}
