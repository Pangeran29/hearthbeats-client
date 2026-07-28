export type GpsHistoryPoint = {
  id: number;
  sourceId?: number | string;
  imei: string;
  serverReceivedAt: string;
  gpsTimestamp: string;
  latitude: number;
  longitude: number;
  speedKph: number;
  course: number;
  satelliteCount: number;
  packetFamily: string;
  peerAddr: string;
};

export type GpsHistoryDataset =
  | {
      status: "ready";
      points: GpsHistoryPoint[];
      imei: string;
      startAt: string;
      endAt?: string;
      latestServerReceivedAt: string;
    }
  | {
      status: "error";
      message: string;
      points: GpsHistoryPoint[];
      imei: string;
      startAt: string;
      endAt?: string;
      latestServerReceivedAt: string;
    };

export type GpsHistoryApiPoint = {
  id?: number | string;
  server_received_at: string;
  gps_timestamp?: string | null;
  latitude: number | string;
  longitude: number | string;
  speed_kph: number | string;
  course: number | string;
  satellite_count: number | string;
};

export type GpsHistoryApiResponse = {
  imei: string;
  start_at: string;
  end_at?: string | null;
  latest_server_received_at?: string | null;
  points: GpsHistoryApiPoint[];
};

export type TrackingSession = {
  id: number;
  startedAt: string;
  endedAt?: string;
  state: "completed" | "ongoing";
  durationSeconds: number;
  distanceKm: number;
};

export type TrackingSessionsDataset =
  | {
      status: "ready";
      imei: string;
      date: string;
      timezone: "Asia/Jakarta";
      sessions: TrackingSession[];
    }
  | {
      status: "error";
      message: string;
      imei: string;
      date: string;
      timezone: "Asia/Jakarta";
      sessions: TrackingSession[];
    };

export type TrackingSessionsApiResponse = {
  imei: string;
  date: string;
  timezone: string;
  sessions: Array<{
    id: number;
    started_at: string;
    ended_at?: string | null;
    state: "completed" | "ongoing";
    duration_seconds: number;
    distance_km: number;
  }>;
};

export type DeviceActivity = {
  lastSeenAt?: string;
  batteryVoltageLevel?: number;
  batteryReportedAt?: string;
};
