import { LiveTrackingViewer } from "@/components/live-tracking-viewer";
import {
  fetchGpsHistory,
  fetchTrackingSessions,
  getTodayWibDate,
  wibDateToUtcRange,
} from "@/lib/gps-history";
import type { GpsHistoryDataset } from "@/types/gps";

type HistoryPageProps = {
  params: Promise<{ imei: string }>;
  searchParams: Promise<{ date?: string; session_id?: string }>;
};

export default async function HistoryPage({
  params,
  searchParams,
}: HistoryPageProps) {
  const { imei } = await params;
  const query = await searchParams;
  const today = getTodayWibDate();
  const requestedDate = query.date ?? today;
  const requestedRange = wibDateToUtcRange(requestedDate);
  const selectedDate = requestedRange ? requestedDate : today;
  const dateRange = requestedRange ?? wibDateToUtcRange(today);
  const sessionsDataset = await fetchTrackingSessions({
    imei,
    date: selectedDate,
  });
  const requestedSessionId = Number(query.session_id);
  const hasRequestedSession =
    typeof query.session_id === "string" &&
    Number.isSafeInteger(requestedSessionId) &&
    requestedSessionId > 0;
  const selectedSession =
    sessionsDataset.status === "ready" && hasRequestedSession
      ? sessionsDataset.sessions.find(
          (session) => session.id === requestedSessionId,
        )
      : undefined;
  const sessionSelectionError =
    typeof query.session_id === "string" &&
    sessionsDataset.status === "ready" &&
    !selectedSession
      ? "Perjalanan tidak ditemukan."
      : undefined;
  let dataset: GpsHistoryDataset = {
    status: "ready",
    points: [],
    imei,
    startAt: dateRange?.startAt ?? new Date().toISOString(),
    endAt: dateRange?.endAt,
    latestServerReceivedAt: dateRange?.startAt ?? new Date().toISOString(),
  };

  if (selectedSession) {
    dataset = await fetchGpsHistory({
      imei,
      startAt: selectedSession.startedAt,
      endAt: selectedSession.endedAt,
    });
  }

  return (
    <LiveTrackingViewer
      key={`${selectedDate}:${selectedSession?.id ?? "list"}`}
      dataset={dataset}
      mode="history"
      historyDate={selectedDate}
      sessionsDataset={sessionsDataset}
      selectedSession={selectedSession}
      dateError={requestedRange ? undefined : "Tanggal tidak valid."}
      sessionSelectionError={sessionSelectionError}
    />
  );
}
