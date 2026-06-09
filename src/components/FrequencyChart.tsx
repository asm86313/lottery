"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { NumberStat } from "@/types/lottery";

interface FrequencyChartProps {
  stats: NumberStat[];
}

function getBarColor(number: number): string {
  if (number <= 10) return "#facc15";
  if (number <= 20) return "#3b82f6";
  if (number <= 30) return "#ef4444";
  if (number <= 40) return "#6b7280";
  return "#22c55e";
}

export default function FrequencyChart({ stats }: FrequencyChartProps) {
  const data = stats.map((s) => ({
    name: s.number,
    count: s.count,
    color: getBarColor(s.number),
  }));

  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9 }}
            interval={4}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value) => [`${value ?? 0}회`, "출현 횟수"] as [string, string]}
            labelFormatter={(label) => `번호 ${label}`}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
