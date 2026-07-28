import { LiveTrackingViewer } from "@/components/live-tracking-viewer";
import { fetchGpsHistory, getDefaultGpsHistoryParams } from "@/lib/gps-history";

type LiveTrackingPageProps = {
  params: Promise<{ imei: string }>;
  searchParams: Promise<{ start_at?: string; end_at?: string }>;
};

export default async function LiveTrackingPage({
  params,
  searchParams,
}: LiveTrackingPageProps) {
  const { imei } = await params;
  const query = await searchParams;
  const defaults = getDefaultGpsHistoryParams();
  const hasStartAt = Boolean(query.start_at);
  const isFixedRoute = Boolean(query.start_at && query.end_at);
  const dataset = await fetchGpsHistory({
    imei,
    startAt: hasStartAt ? query.start_at : defaults.startAt,
    endAt: isFixedRoute ? query.end_at : undefined,
  });

  return (
    <LiveTrackingViewer
      dataset={dataset}
      mode={isFixedRoute ? "route" : hasStartAt ? "live-route" : "live"}
    />
  );
}
