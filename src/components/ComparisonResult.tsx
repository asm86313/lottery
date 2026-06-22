"use client";

import { MatchResult } from "@/types/lottery";
import { useEffect, useState } from "react";
import NumberBall from "./NumberBall";

interface ComparisonResultProps {
  drawNo: number;
  onLoaded: () => void;
}

interface ComparisonData {
  winningNumbers: number[];
  matches: MatchResult[];
  bestMatched: number;
  bestStrategies: MatchResult[];
  recommendedSets?: { numbers: number[]; reason: string }[];
}

export default function ComparisonResult({ drawNo, onLoaded }: ComparisonResultProps) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/analysis/compare?drawNo=${drawNo}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData({
            winningNumbers: json.winningNumbers,
            matches: json.matches,
            bestMatched: json.bestMatched,
            bestStrategies: json.bestStrategies,
            recommendedSets: json.recommendedSets,
          });
        } else {
          setError(json.error);
        }
        onLoaded();
      })
      .catch((err) => {
        setError(String(err));
        onLoaded();
      });
  }, [drawNo, onLoaded]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-500">로드 중...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 추천 번호 10개 세트 */}
      {data.recommendedSets && data.recommendedSets.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h4 className="font-bold text-gray-800 mb-4">분석 결과 (10가지 추천 번호)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.recommendedSets.map((set, idx) => (
              <div key={idx} className="border border-gray-200 rounded p-2">
                <div className="text-xs font-semibold text-gray-700 mb-2">
                  <span className="inline-block w-5 h-5 bg-indigo-600 text-white rounded-full text-center text-[10px] leading-5 mr-1">
                    {idx + 1}
                  </span>
                  {set.reason}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {set.numbers.map((n) => (
                    <NumberBall key={n} number={n} size="sm" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 당첨 번호 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h4 className="font-bold text-gray-800 mb-3">당첨 번호 (회차 {drawNo + 1})</h4>
        <div className="flex gap-2 flex-wrap">
          {data.winningNumbers.map((n) => (
            <NumberBall key={n} number={n} size="md" highlight />
          ))}
        </div>
      </div>

      {/* 최고 성적 전략 */}
      {data.bestStrategies.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h4 className="font-bold text-amber-900 mb-3">
            🏆 최고 성적: {data.bestMatched}개 맞춤
          </h4>
          <div className="space-y-2">
            {data.bestStrategies.map((m) => (
              <div
                key={m.recommended_set_index}
                className="bg-white rounded p-2"
              >
                <div className="text-sm font-semibold text-amber-900">
                  전략 {m.recommended_set_index + 1}: {m.strategy_name}
                </div>
                <div className="flex gap-1 flex-wrap mt-1">
                  {m.recommended_numbers.map((n) => (
                    <span
                      key={n}
                      className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full ${
                        m.matched_numbers.includes(n)
                          ? "bg-amber-500 text-white"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 모든 전략 비교 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h4 className="font-bold text-gray-800 mb-3">전체 전략 비교</h4>
        <div className="space-y-3">
          {data.matches.map((m) => (
            <div
              key={m.recommended_set_index}
              className="border border-gray-200 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-gray-700">
                  전략 {m.recommended_set_index + 1}: {m.strategy_name}
                </div>
                <span
                  className={`text-sm font-bold px-2 py-0.5 rounded ${
                    m.matched_count === data.bestMatched
                      ? "bg-amber-200 text-amber-900"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {m.matched_count}개
                </span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {m.recommended_numbers.map((n) => (
                  <span
                    key={n}
                    className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full transition ${
                      m.matched_numbers.includes(n)
                        ? "bg-green-500 text-white scale-110"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
