import { FuelCalibrationViewer } from "@/components/fuel-calibration-viewer";
import {
  fetchDeviceActivity,
  fetchFuelCalibrationDashboard,
} from "@/lib/gps-history";

type FuelPageProps = {
  params: Promise<{ imei: string }>;
};

export default async function FuelPage({ params }: FuelPageProps) {
  const { imei } = await params;
  const [dashboard, deviceActivity] = await Promise.all([
    fetchFuelCalibrationDashboard(imei),
    fetchDeviceActivity(imei),
  ]);

  return (
    <FuelCalibrationViewer
      dashboard={dashboard}
      deviceActivity={deviceActivity}
    />
  );
}
