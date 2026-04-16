import { GpsHistoryViewer } from "@/components/gps-history-viewer";
import { loadGpsHistory } from "@/lib/gps-history";

export default function Home() {
  const dataset = loadGpsHistory();

  return <GpsHistoryViewer dataset={dataset} />;
}
