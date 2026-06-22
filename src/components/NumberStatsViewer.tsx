"use client";

import { NumberStat } from "@/types/lottery";
import { useState, useEffect } from "react";
import NumberBall from "./NumberBall";

export default function NumberStatsViewer() {
  const [stats, setStats] = useState<NumberStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"count" | "frequency" | "lastAppeared">(
    "count"
  );

  useEffect(() => {
    fetch("/api/lottery/number-stats")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setStats(json.data);
        else setError(json.error);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  const sortedStats = [...stats].sort((a, b) => {
    if (sortBy === "count") return b.count - a.count;
    if (sortBy === "frequency") return b.frequency - a.frequency;
    return a.lastAppeared - b.lastAppeared;
  });

  if (loading) {
    return <div className="text-center text-gray-500">로드 중...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500">오류: {error}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">번호별 통계</h3>
        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(e.target.value as "count" | "frequency" | "lastAppeared")
          }
          className="px-3 py-1 border border-gray-300 rounded text-sm"
        >
          <option value="count">출현 횟수순</option>
          <option value="frequency">출현율순</option>
          <option value="lastAppeared">미출현 기간순</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-3">번호</th>
              <th className="text-right py-3 px-3">출현 횟수</th>
              <th className="text-right py-3 px-3">출현율</th>
              <th className="text-right py-3 px-3">마지막 회차</th>
              <th className="text-right py-3 px-3">미출현 기간</th>
              <th className="text-right py-3 px-3">평균 간격</th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.map((s) => (
              <tr key={s.number} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-3">
                  <NumberBall number={s.number} size="sm" />
                </td>
                <td className="text-right py-3 px-3 font-bold text-indigo-600">
                  {s.count}회
                </td>
                <td className="text-right py-3 px-3 text-gray-700">
                  {s.frequency.toFixed(1)}%
                </td>
                <td className="text-right py-3 px-3 text-gray-700">
                  {s.lastDrawNo}회
                </td>
                <td className="text-right py-3 px-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      s.lastAppeared > 20
                        ? "bg-red-100 text-red-700"
                        : s.lastAppeared > 10
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {s.lastAppeared}회
                  </span>
                </td>
                <td className="text-right py-3 px-3 text-gray-700">
                  {s.gap}회
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
