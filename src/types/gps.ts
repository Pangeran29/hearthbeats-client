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
