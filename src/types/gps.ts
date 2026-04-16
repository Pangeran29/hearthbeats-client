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
    }
  | {
      status: "error";
      message: string;
      points: GpsHistoryPoint[];
    };
