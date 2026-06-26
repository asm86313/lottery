"use client";

import { useState, useCallback } from "react";
import { PensionAnalysisResult } from "@/types/lottery";

interface StrategyRank { idx: number; name: string; avgMatch: number; weight: number; }
interface CalibrationInfo {
  avgMatches: number[]; weights: number[];
  strategyRanking: StrategyRank[]; testCount: number; baseline: number;
}
interface CalibratedResult { data: PensionAnalysisResult; calibration: CalibrationInfo; }

const GROUP_COLORS: Record<number, string> = {
  1: "bg-yellow-400 text-yellow-900", 2: "bg-blue-400 text-white",
  3: "bg-red-400 text-white", 4: "bg-gray-400 text-white", 5: "bg-green-500 text-white",
};

const DIGIT_BG = [
  "bg-violet-50 border-violet-200", "bg-blue-50 border-blue-200",
  "bg-cyan-50 border-cyan-200", "bg-teal-50 border-teal-200",
  "bg-green-50 border-green-200", "bg-yellow-50 border-yellow-200",
];

const BAR_COLORS = [
  "bg-purple-400", "bg-blue-400", "bg-teal-400", "bg-orange-400", "bg-indigo-400",
];

export default function PensionCalibratedPanel() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressStep, setProgressStep] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [result, setResult] = useState<CalibratedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testCount, setTestCount] = useState(10);

  const run = useCallback(async () => {
    setLoading(true); setError(null); setResult(null);
    setProgress("연결 중..."); setProgressStep(0);

    try {
      const res = await fetch(`/api/pension/analyze/calibrated?testCount=${testCount}`);
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
          } else if (event.type === "result") {
            setResult({ data: event.data, calibration: event.calibration });
            setProgress("");
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [testCount]);

  const pct = progressTotal > 0 ? (progressStep / progressTotal) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* 설정 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">🔬 연금복권 자동 보정 분석</h3>
        <p className="text-xs text-gray-400 mb-4">
          최근 N회차 백테스트로 자릿수 일치 성능을 측정한 뒤 성능 가중치로 5개 보정 번호를 생성합니다.<br />
          보정 결과는 당첨 비교 이력에 자동 저장됩니다.
        </p>
        <div className="flex items-center gap-3">
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
          <button
            onClick={run}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
          >
            {loading ? "분석 중..." : "🔬 자동 보정 실행"}
          </button>
        </div>
        {loading && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-gray-500 text-center">{progress}</p>
          </div>
        )}
        {error && <p className="mt-3 text-xs text-red-500">⚠️ {error}</p>}
      </div>

      {result && (
        <>
          {/* 전략별 성능 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">전략별 평균 자릿수 일치</h3>
              <span className="text-xs text-gray-400">이론 기대값: {result.calibration.baseline.toFixed(2)}자리</span>
            </div>
            {result.calibration.strategyRanking.map((s, rank) => (
              <div key={s.idx} className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] text-gray-400 w-4">{rank + 1}</span>
                <span className="text-xs text-gray-600 w-32 shrink-0 truncate">{s.name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 relative">
                  <div
                    className={`h-4 rounded-full ${BAR_COLORS[s.idx] ?? "bg-gray-400"}`}
                    style={{ width: `${Math.min((s.avgMatch / 2) * 100, 100)}%` }}
                  />
                  <span className="absolute right-2 top-0 text-[10px] text-gray-600 leading-4">
                    {s.avgMatch.toFixed(2)}자리
                  </span>
                </div>
                <span className="text-[10px] text-green-600 w-10 text-right">{(s.weight * 100).toFixed(1)}%</span>
              </div>
            ))}
            <div className="mt-3 flex gap-2 flex-wrap">
              {result.calibration.strategyRanking.slice(0, 3).map((s, i) => (
                <span key={s.idx} className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-100">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {s.name} ({s.avgMatch.toFixed(2)}자리)
                </span>
              ))}
            </div>
          </div>

          {/* 🔬 보정 5세트 */}
          <div className="bg-green-50 rounded-xl border border-green-200 p-4">
            <h3 className="text-sm font-bold text-green-800 mb-1">🔬 보정 추천 번호 (5세트)</h3>
            <p className="text-xs text-green-500 mb-3">성능 가중치 적용 · 당첨 비교 이력 자동 저장</p>
            <div className="flex flex-col gap-3">
              {result.data.recommendations.slice(-5).map((set, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-green-100 p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-green-700 shrink-0">보정 {idx + 1}</span>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${GROUP_COLORS[set.groupNo] ?? "bg-gray-200"}`}>
                      {set.groupNo}
                    </span>
                    <span className="text-gray-300">—</span>
                    <div className="flex gap-1">
                      {set.number.padStart(6, "0").split("").map((d, dIdx) => (
                        <div key={dIdx} className="flex flex-col items-center gap-0.5">
                          <span className="text-[9px] text-gray-400">{dIdx + 1}</span>
                          <span className={`w-7 h-7 rounded-lg border flex items-center justify-center text-sm font-bold ${DIGIT_BG[dIdx] ?? "bg-gray-50"}`}>
                            {d}
                          </span>
                        </div>
                      ))}
                    </div>
                    <span className="ml-auto text-xs text-gray-400">점수 {set.score.toFixed(1)}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">{set.reason}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
            <p className="font-medium text-gray-600 mb-1">📊 해석 가이드</p>
            <p>자릿수 기대값은 6자리 × 1/10 = 0.6자리입니다. 기대값보다 높은 전략이 통계적으로 유의미합니다.
            보정 세트는 성능 높은 전략에 더 높은 가중치를 주어 자릿수별 투표로 생성됩니다.</p>
          </div>
        </>
      )}
    </div>
  );
}
