export type GpsHistoryPoint = {
  id: number;
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
      latestServerReceivedAt: string;
    }
  | {
      status: "error";
      message: string;
      points: GpsHistoryPoint[];
      imei: string;
      startAt: string;
      latestServerReceivedAt: string;
    };

export type GpsHistoryApiPoint = {
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
  latest_server_received_at?: string | null;
  points: GpsHistoryApiPoint[];
};
