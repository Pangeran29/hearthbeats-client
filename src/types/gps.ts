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
    }
  | {
      status: "error";
      message: string;
      points: GpsHistoryPoint[];
      imei: string;
      startAt: string;
    };

export type GpsHistoryApiPoint = {
  server_received_at: string;
  gps_timestamp: string;
  latitude: number;
  longitude: number;
  speed_kph: number;
  course: number;
  satellite_count: number;
};

export type GpsHistoryApiResponse = {
  imei: string;
  start_at: string;
  points: GpsHistoryApiPoint[];
};
