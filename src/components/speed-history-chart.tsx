"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SpeedHistoryChartPoint = {
  id: number;
  time: string;
  fullTime: string;
  speedKph: number;
};

type SpeedHistoryChartProps = {
  data: SpeedHistoryChartPoint[];
};

export function SpeedHistoryChart({ data }: SpeedHistoryChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid stroke="rgba(148, 163, 184, 0.25)" vertical={false} />
        <XAxis dataKey="fullTime" tickFormatter={(val) => new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} tickLine={false} axisLine={false} minTickGap={30} />
        <YAxis tickLine={false} axisLine={false} unit=" km/h" width={56} />
        <Tooltip
          formatter={(value) => [`${value ?? 0} km/h`, "Speed"]}
          labelFormatter={(label, payload) => payload?.[0]?.payload.fullTime ?? label}
        />
        <Line
          type="linear"
          dataKey="speedKph"
          stroke="#f97316"
          strokeWidth={3}
          dot={{ r: 3, fill: "#0f172a" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
