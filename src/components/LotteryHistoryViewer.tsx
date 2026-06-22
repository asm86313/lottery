"use client";

import { LotteryDraw } from "@/types/lottery";
import { useState, useEffect } from "react";
import NumberBall from "./NumberBall";

export default function LotteryHistoryViewer() {
  const [draws, setDraws] = useState<LotteryDraw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/lottery/history?limit=100")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setDraws(json.data);
        else setError(json.error);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-center text-gray-500">로드 중...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500">오류: {error}</div>;
  }

  if (draws.length === 0) {
    return <div className="text-center text-gray-500">데이터가 없습니다</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-bold text-gray-800">최근 당첨 번호</h3>
      <div className="space-y-2">
        {draws.map((draw) => (
          <div
            key={draw.drwNo}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-lg text-indigo-600">
                {draw.drwNo}회
              </div>
            </div>
            <div className="flex gap-2 flex-wrap mb-2">
              {[
                draw.drwtNo1,
                draw.drwtNo2,
                draw.drwtNo3,
                draw.drwtNo4,
                draw.drwtNo5,
                draw.drwtNo6,
              ].map((n) => (
                <NumberBall key={n} number={n} size="md" />
              ))}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-600">보너스:</span>
              <NumberBall number={draw.bnusNo} size="md" variant="bonus" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
