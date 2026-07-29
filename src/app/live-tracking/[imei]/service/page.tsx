import { ServiceViewer } from "@/components/service-viewer";
import {
  fetchDeviceActivity,
  fetchDeviceServiceSummary,
} from "@/lib/gps-history";

type ServicePageProps = {
  params: Promise<{ imei: string }>;
};

export default async function ServicePage({ params }: ServicePageProps) {
  const { imei } = await params;
  const [summary, deviceActivity] = await Promise.all([
    fetchDeviceServiceSummary(imei),
    fetchDeviceActivity(imei),
  ]);

  return (
    <ServiceViewer summary={summary} deviceActivity={deviceActivity} />
  );
}
