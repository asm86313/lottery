"use client";

import { SavedAnalysis } from "@/types/lottery";
import { useState, useEffect } from "react";
import ComparisonResult from "./ComparisonResult";
import NumberBall from "./NumberBall";

interface HistoryWithWinning extends SavedAnalysis {
  winningNumbers?: number[];
}

export default function AnalysisHistory() {
  const [histories, setHistories] = useState<HistoryWithWinning[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDrawNo, setSelectedDrawNo] = useState<number | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [latestDrawNo, setLatestDrawNo] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/analysis/history").then((res) => res.json()),
      fetch("/api/check-missing").then((res) => res.json()),
    ])
      .then(async ([historyJson, missingJson]) => {
        if (historyJson.success) {
          // 각 분석의 당첨 번호 조회
          const historiesWithWinning = await Promise.all(
            historyJson.data.map(async (h: SavedAnalysis) => {
              try {
                const compRes = await fetch(
                  `/api/analysis/compare?drawNo=${h.analyzed_draw_no}`
                );
                const compJson = await compRes.json();
                if (compJson.success) {
                  return {
                    ...h,
                    winningNumbers: compJson.winningNumbers,
                  };
                }
              } catch {}
              return h;
            })
          );
          setHistories(historiesWithWinning);
        }
        if (missingJson.success) setLatestDrawNo(missingJson.latestDrawNo);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCompare = (drawNo: number) => {
    setSelectedDrawNo(drawNo);
    setComparisonLoading(true);
  };

  if (loading) {
    return <div className="text-center text-gray-500">로드 중...</div>;
  }

  if (histories.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        저장된 분석 결과가 없습니다.
      </div>
    );
  }

  if (selectedDrawNo !== null) {
    return (
      <div>
        <button
          onClick={() => setSelectedDrawNo(null)}
          className="mb-4 px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
        >
          ← 돌아가기
        </button>
        <ComparisonResult
          drawNo={selectedDrawNo}
          onLoaded={() => setComparisonLoading(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-bold text-gray-800">분석 히스토리</h3>
      {latestDrawNo !== null && (
        <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded p-2">
          💡 현재 DB 최신 회차: <strong>{latestDrawNo}회</strong> · 당첨 비교는 분석 회차 다음 회차의 당첨 번호가 있을 때 가능합니다
        </div>
      )}
      <div className="space-y-2">
        {histories.map((h) => {
          const canCompare = latestDrawNo !== null && latestDrawNo > h.analyzed_draw_no;
          const nextDrawNo = h.analyzed_draw_no + 1;
          return (
            <div
              key={h.id}
              className={`bg-white rounded-lg border p-3 flex items-center justify-between transition ${
                canCompare
                  ? "border-gray-200 hover:shadow-md"
                  : "border-gray-100 opacity-60"
              }`}
            >
              <div className="flex-1">
                <div className="font-semibold text-gray-700 mb-2">
                  회차 {h.analyzed_draw_no} 분석 → {nextDrawNo}회 당첨
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  {new Date(h.created_at).toLocaleString("ko-KR")}
                </div>
                {h.winningNumbers && h.winningNumbers.length > 0 ? (
                  <div className="flex gap-1 flex-wrap">
                    {h.winningNumbers.map((n) => (
                      <NumberBall key={n} number={n} size="sm" />
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-amber-600">
                    {nextDrawNo}회 당첨 번호 대기 중
                  </div>
                )}
              </div>
              <button
                onClick={() => handleCompare(h.analyzed_draw_no)}
                disabled={comparisonLoading || !canCompare}
                title={
                  !canCompare
                    ? `${nextDrawNo}회차 당첨 번호가 업데이트되면 비교 가능`
                    : ""
                }
                className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                당첨 비교
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
