import { GpsHistoryViewer } from "@/components/gps-history-viewer";
import { fetchGpsHistory, getDefaultGpsHistoryParams } from "@/lib/gps-history";

type DeviceHistoryPageProps = {
  params: Promise<{ imei: string }>;
  searchParams: Promise<{ start_at?: string }>;
};

export default async function DeviceHistoryPage({
  params,
  searchParams,
}: DeviceHistoryPageProps) {
  const { imei } = await params;
  const { start_at: startAt } = await searchParams;
  const defaults = getDefaultGpsHistoryParams();
  const dataset = await fetchGpsHistory({
    imei,
    startAt: startAt ?? defaults.startAt,
  });

  return <GpsHistoryViewer dataset={dataset} />;
}
