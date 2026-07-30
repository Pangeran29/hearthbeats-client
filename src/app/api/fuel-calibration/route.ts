import { NextResponse } from "next/server";

import {
  completeFuelCalibration,
  restartFuelCalibration,
  startFuelCalibration,
} from "@/lib/gps-history";

export const dynamic = "force-dynamic";

type FuelCalibrationMutation =
  | {
      action: "start";
      imei: string;
      fuelType?: string;
    }
  | {
      action: "complete";
      imei: string;
      calibrationId: number;
      liters: number;
      totalCostIdr?: number;
      fuelType?: string;
    }
  | {
      action: "restart";
      imei: string;
      fuelType?: string;
    };

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | FuelCalibrationMutation
    | null;

  if (!payload || typeof payload.imei !== "string") {
    return NextResponse.json(
      { error: "Permintaan kalibrasi tidak valid." },
      { status: 400 },
    );
  }

  if (payload.action === "start") {
    const dashboard = await startFuelCalibration({
      imei: payload.imei,
      fuelType: payload.fuelType,
    });
    return NextResponse.json(dashboard, {
      status: dashboard.status === "ready" ? 201 : 400,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  if (payload.action === "restart") {
    const dashboard = await restartFuelCalibration({
      imei: payload.imei,
      fuelType: payload.fuelType,
    });
    return NextResponse.json(dashboard, {
      status: dashboard.status === "ready" ? 201 : 400,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  if (
    payload.action === "complete" &&
    Number.isSafeInteger(payload.calibrationId) &&
    payload.calibrationId > 0 &&
    typeof payload.liters === "number"
  ) {
    const dashboard = await completeFuelCalibration({
      imei: payload.imei,
      calibrationId: payload.calibrationId,
      liters: payload.liters,
      totalCostIdr: payload.totalCostIdr,
      fuelType: payload.fuelType,
    });
    return NextResponse.json(dashboard, {
      status: dashboard.status === "ready" ? 200 : 400,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  return NextResponse.json(
    { error: "Aksi kalibrasi tidak didukung." },
    { status: 400 },
  );
}
