import { LiveTrackingViewer } from "@/components/live-tracking-viewer";
import { fetchGpsHistory, getDefaultGpsHistoryParams } from "@/lib/gps-history";

type LiveTrackingPageProps = {
  params: Promise<{ imei: string }>;
  searchParams: Promise<{ start_at?: string }>;
};

export default async function LiveTrackingPage({
  params,
  searchParams,
}: LiveTrackingPageProps) {
  const { imei } = await params;
  const { start_at: startAt } = await searchParams;
  const defaults = getDefaultGpsHistoryParams();
  const dataset = await fetchGpsHistory({
    imei,
    startAt: startAt ?? defaults.startAt,
  });

  return <LiveTrackingViewer dataset={dataset} />;
}