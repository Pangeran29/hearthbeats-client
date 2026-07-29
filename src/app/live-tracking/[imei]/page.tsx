import { LiveTrackingViewer } from "@/components/live-tracking-viewer";
import {
  fetchDailyRideSummary,
  fetchDeviceActivity,
  fetchGpsHistory,
  fetchLatestGpsLocation,
  getTodayWibDate,
} from "@/lib/gps-history";

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
  const today = getTodayWibDate();
  const hasStartAt = Boolean(query.start_at);
  const isFixedRoute = Boolean(query.start_at && query.end_at);
  const [dataset, deviceActivity, dailyRideSummary] = await Promise.all([
    hasStartAt
      ? fetchGpsHistory({
          imei,
          startAt: query.start_at,
          endAt: isFixedRoute ? query.end_at : undefined,
        })
      : fetchLatestGpsLocation({ imei }),
    fetchDeviceActivity(imei),
    fetchDailyRideSummary({ imei, date: today }),
  ]);

  return (
    <LiveTrackingViewer
      dataset={dataset}
      mode={isFixedRoute ? "route" : hasStartAt ? "live-route" : "live"}
      deviceActivity={deviceActivity}
      dailyRideSummary={dailyRideSummary}
    />
  );
}
