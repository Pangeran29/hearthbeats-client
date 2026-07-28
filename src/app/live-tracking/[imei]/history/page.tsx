import { LiveTrackingViewer } from "@/components/live-tracking-viewer";
import {
  fetchGpsHistory,
  getDefaultHistoryDates,
  wibDateRangeToUtc,
} from "@/lib/gps-history";

type HistoryPageProps = {
  params: Promise<{ imei: string }>;
  searchParams: Promise<{ start_date?: string; end_date?: string }>;
};

export default async function HistoryPage({
  params,
  searchParams,
}: HistoryPageProps) {
  const { imei } = await params;
  const query = await searchParams;
  const defaults = getDefaultHistoryDates();
  const startDate = query.start_date ?? defaults.startDate;
  const endDate = query.end_date ?? defaults.endDate;
  const range = wibDateRangeToUtc(startDate, endDate);

  if (!range) {
    const fallbackRange = wibDateRangeToUtc(
      defaults.startDate,
      defaults.endDate,
    );

    const dataset = await fetchGpsHistory({
      imei,
      startAt: fallbackRange?.startAt,
      endAt: fallbackRange?.endAt,
    });

    return (
      <LiveTrackingViewer
        dataset={dataset}
        mode="history"
        startDate={startDate}
        endDate={endDate}
        rangeError="Tanggal mulai harus lebih awal atau sama dengan tanggal selesai."
      />
    );
  }

  const dataset = await fetchGpsHistory({
    imei,
    startAt: range.startAt,
    endAt: range.endAt,
  });

  return (
    <LiveTrackingViewer
      dataset={dataset}
      mode="history"
      startDate={startDate}
      endDate={endDate}
    />
  );
}
