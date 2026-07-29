import { NextResponse } from "next/server";

import { fetchDailyRideSummary, getTodayWibDate } from "@/lib/gps-history";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const imei = url.searchParams.get("imei") ?? undefined;
  const date = url.searchParams.get("date") ?? getTodayWibDate();
  const summary = await fetchDailyRideSummary({ imei, date });

  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
