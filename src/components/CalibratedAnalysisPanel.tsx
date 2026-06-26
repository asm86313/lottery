"use client";

import { useState, useCallback } from "react";
import { AnalysisResult } from "@/types/lottery";
import RecommendedSets from "./RecommendedSets";
import NumberBall from "./NumberBall";

interface StrategyRank {
  idx: number;
  name: string;
  avgMatch: number;
  weight: number;
}

interface CalibrationInfo {
  avgMatches: number[];
  weights: number[];
  strategyRanking: StrategyRank[];
  testCount: number;
  baseline: number;
}

interface CalibratedResult {
  data: AnalysisResult;
  calibration: CalibrationInfo;
}

const BAR_COLORS = [
  "bg-purple-400", "bg-blue-400", "bg-teal-400", "bg-orange-400", "bg-indigo-400",
  "bg-pink-400", "bg-yellow-400", "bg-cyan-400", "bg-lime-400", "bg-red-400",
  "bg-purple-300", "bg-blue-300", "bg-teal-300", "bg-orange-300", "bg-indigo-300",
];

export default function CalibratedAnalysisPanel() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressStep, setProgressStep] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [result, setResult] = useState<CalibratedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testCount, setTestCount] = useState(10);
  const [showAllStrategies, setShowAllStrategies] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress("연결 중...");
    setProgressStep(0);

    try {
      const res = await fetch(`/api/analyze/calibrated?testCount=${testCount}`);
      if (!res.ok || !res.body) throw new Error("요청 실패");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "progress") {
            setProgress(event.message);
            setProgressStep(event.step ?? 0);
            setProgressTotal(event.total ?? testCount + 1);
          } else if (event.type === "calibration") {
            // calibration info arrives before final result
          } else if (event.type === "result") {
            setResult({ data: event.data, calibration: event.calibration });
            setProgress("");
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [testCount]);

  const pct = progressTotal > 0 ? (progressStep / progressTotal) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* 설정 패널 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">🔬 자동 보정 분석</h3>
        <p className="text-xs text-gray-400 mb-4">
          최근 N회차를 자동으로 백테스트해 전략별 성능을 측정한 뒤,<br />
          성능이 높은 전략에 더 높은 가중치를 부여해 추천 번호를 생성합니다.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">테스트 회차 수</span>
            <select
              value={testCount}
              onChange={(e) => setTestCount(parseInt(e.target.value))}
              disabled={loading}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700"
            >
              <option value={5}>5회차 (빠름)</option>
              <option value={10}>10회차 (권장)</option>
              <option value={20}>20회차 (정밀)</option>
              <option value={30}>30회차 (느림)</option>
            </select>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
          >
            {loading ? "분석 중..." : "🔬 자동 보정 실행"}
          </button>
        </div>

        {/* 진행 바 */}
        {loading && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center">{progress}</p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs text-red-500">⚠️ {error}</p>
        )}
      </div>

      {result && (
        <>
          {/* 전략별 성능 차트 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">전략별 평균 일치 개수</h3>
              <span className="text-xs text-gray-400">
                기대값(랜덤): {result.calibration.baseline.toFixed(2)}개
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              최근 {result.calibration.testCount}회차 백테스트 결과 • 막대가 길수록 성능 높음
            </p>

            {/* 상위 5개만 먼저 표시 */}
            {result.calibration.strategyRanking.slice(0, showAllStrategies ? 15 : 5).map((s, rank) => (
              <div key={s.idx} className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] text-gray-400 w-4 shrink-0">{rank + 1}</span>
                <span className="text-xs text-gray-600 w-36 shrink-0 truncate">{s.name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 relative">
                  <div
                    className={`h-4 rounded-full ${BAR_COLORS[s.idx] ?? "bg-gray-400"} transition-all`}
                    style={{ width: `${Math.min((s.avgMatch / 3) * 100, 100)}%` }}
                  />
                  <span className="absolute right-2 top-0 text-[10px] text-gray-600 leading-4">
                    {s.avgMatch.toFixed(2)}개
                  </span>
                </div>
                <span className="text-[10px] text-indigo-500 w-10 text-right shrink-0">
                  {(s.weight * 100).toFixed(1)}%
                </span>
              </div>
            ))}

            <button
              onClick={() => setShowAllStrategies(!showAllStrategies)}
              className="mt-2 text-xs text-indigo-500 hover:text-indigo-700"
            >
              {showAllStrategies ? "▲ 접기" : `▼ 전체 보기 (${result.calibration.strategyRanking.length}개)`}
            </button>

            {/* 최고 성능 전략 배지 */}
            <div className="mt-3 flex gap-2 flex-wrap">
              {result.calibration.strategyRanking.slice(0, 3).map((s, i) => (
                <span key={s.idx} className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {s.name} ({s.avgMatch.toFixed(2)}개)
                </span>
              ))}
            </div>
          </div>

          {/* 🔬 보정 세트 (마지막 3개) */}
          <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
            <h3 className="text-sm font-bold text-indigo-800 mb-1">🔬 보정 추천 번호</h3>
            <p className="text-xs text-indigo-400 mb-3">
              성능 가중치를 적용해 생성된 5개 세트 — 백테스트 기반 최적화 · 당첨 비교 이력 자동 저장
            </p>
            <div className="flex flex-col gap-3">
              {result.data.recommendedSets.slice(-5).map((set, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-indigo-100 p-3 flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-bold text-indigo-600 shrink-0">보정 {idx + 1}</span>
                  <div className="flex gap-1 flex-wrap">
                    {set.numbers.map((n) => (
                      <NumberBall key={n} number={n} size="sm" />
                    ))}
                  </div>
                  <span className="ml-auto text-xs text-gray-400">점수 {set.score.toFixed(1)}</span>
                  <p className="w-full text-[11px] text-gray-400 mt-1">{set.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 전체 15개 전략 세트 (선택적 표시) */}
          {result.data.numberStats.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3">전체 추천 번호 (15개 전략)</h3>
              <RecommendedSets sets={result.data.recommendedSets.slice(0, 15)} />
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
            <p className="font-medium text-gray-600 mb-1">📊 해석 가이드</p>
            <p>
              평균 일치 개수가 랜덤 기대값(0.8개)보다 높을수록 해당 전략이 통계적으로 유의미합니다.
              보정 세트는 성능 높은 전략에 더 높은 가중치를 주어 생성한 메타 앙상블입니다.
              단, 매 회차는 독립 시행이므로 과거 성능이 미래를 보장하지 않습니다.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
