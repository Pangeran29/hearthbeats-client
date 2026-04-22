import { NextResponse } from "next/server";

import { fetchGpsHistory } from "@/lib/gps-history";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const imei = url.searchParams.get("imei") ?? undefined;
  const startAt = url.searchParams.get("start_at") ?? undefined;
  const endAt = url.searchParams.get("end_at") ?? undefined;
  const dataset = await fetchGpsHistory({ imei, startAt, endAt });

  return NextResponse.json(dataset, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}