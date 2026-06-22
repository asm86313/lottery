"use client";

import { SavedAnalysis } from "@/types/lottery";
import { useState, useEffect } from "react";
import ComparisonResult from "./ComparisonResult";

export default function AnalysisHistory() {
  const [histories, setHistories] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDrawNo, setSelectedDrawNo] = useState<number | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  useEffect(() => {
    fetch("/api/analysis/history")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setHistories(json.data);
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
      <div className="space-y-2">
        {histories.map((h) => (
          <div
            key={h.id}
            className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between hover:shadow-md transition"
          >
            <div className="flex-1">
              <div className="font-semibold text-gray-700">
                회차 {h.analyzed_draw_no} 분석
              </div>
              <div className="text-xs text-gray-500">
                {new Date(h.created_at).toLocaleString("ko-KR")}
              </div>
            </div>
            <button
              onClick={() => handleCompare(h.analyzed_draw_no)}
              disabled={comparisonLoading}
              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              당첨 비교
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
