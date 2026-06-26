"use client";

import { useState } from "react";
import NumberBall from "./NumberBall";

interface BacktestMatch {
  strategyIndex: number;
  strategyName: string;
  recommendedNumbers: number[];
  matchedNumbers: number[];
  matchedCount: number;
  bonusMatched: boolean;
  prizeRank: number | null;
}

interface BacktestResult {
  trainedOn: number;
  testDrawNo: number;
  winningNumbers: number[];
  bonusNumber: number;
  matches: BacktestMatch[];
  bestMatchCount: number;
  bestRank: number | null;
}

interface CalMatch {
  type: "base" | "calibrated";
  strategyIndex: number;
  strategyName: string;
  numbers: number[];
  matchedNumbers: number[];
  matchedCount: number;
  bonusMatched: boolean;
  prizeRank: number | null;
}

interface CalResult {
  trainedOn: number;
  calibratedOn: number;
  testDrawNo: number;
  winningNumbers: number[];
  bonusNumber: number;
  weights: number[];
  avgMatches: number[];
  baseMatches: CalMatch[];
  calMatches: CalMatch[];
  bestBaseRank: number | null;
  bestCalRank: number | null;
}

const RANK_STYLE: Record<number, { label: string; bg: string; text: string }> = {
  1: { label: "1등", bg: "bg-yellow-400", text: "text-yellow-900" },
  2: { label: "2등", bg: "bg-gray-300", text: "text-gray-800" },
  3: { label: "3등", bg: "bg-amber-200", text: "text-amber-800" },
  4: { label: "4등", bg: "bg-blue-100", text: "text-blue-700" },
  5: { label: "5등", bg: "bg-green-100", text: "text-green-700" },
};

const STRATEGY_LABELS = [
  "전체", "50회", "20회", "10회", "복귀",
  "역빈", "미출", "MK", "구간", "홀수",
  "짝수", "끝자", "동반", "득표", "다크",
];
const STRATEGY_COLORS = [
  "bg-blue-100 text-blue-700", "bg-sky-100 text-sky-700",
  "bg-cyan-100 text-cyan-700", "bg-teal-100 text-teal-700",
  "bg-emerald-100 text-emerald-700", "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-700", "bg-purple-100 text-purple-700",
  "bg-indigo-100 text-indigo-700", "bg-pink-100 text-pink-700",
  "bg-rose-100 text-rose-700", "bg-lime-100 text-lime-700",
  "bg-green-100 text-green-700", "bg-violet-100 text-violet-700",
  "bg-gray-100 text-gray-700",
];
const CAL_COLORS = [
  "bg-indigo-200 text-indigo-800",
  "bg-indigo-200 text-indigo-800",
  "bg-indigo-200 text-indigo-800",
  "bg-indigo-200 text-indigo-800",
  "bg-indigo-200 text-indigo-800",
];

function RankBadge({ rank }: { rank: number | null }) {
  if (rank === null)
    return <span className="text-xs text-gray-300 px-2 py-0.5 rounded-full bg-gray-50">낙첨</span>;
  const s = RANK_STYLE[rank];
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s?.bg} ${s?.text}`}>{s?.label}</span>;
}

function SummaryBanner({ rank, count, label }: { rank: number | null; count: number; label: string }) {
  const s = rank !== null ? RANK_STYLE[rank] : null;
  return (
    <div className={`rounded-xl p-3 text-center ${s ? `${s.bg} ${s.text}` : "bg-gray-100 text-gray-600"}`}>
      <p className="text-[11px] mb-0.5 opacity-70">{label}</p>
      {rank !== null
        ? <p className="text-base font-black">🏆 {s?.label}</p>
        : <p className="text-sm font-bold">최다 {count}개 일치 (낙첨)</p>
      }
    </div>
  );
}

export default function BacktestPanel() {
  const [drawNo, setDrawNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [calLoading, setCalLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [calResult, setCalResult] = useState<CalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calError, setCalError] = useState<string | null>(null);
  const [tab, setTab] = useState<"base" | "calibrated">("base");

  async function runBacktest() {
    const no = parseInt(drawNo);
    if (isNaN(no) || no < 2) { setError("유효한 회차 번호를 입력하세요."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/backtest?drawNo=${no}`);
      const json = await res.json();
      if (json.success) { setResult(json); setTab("base"); }
      else setError(json.error ?? "백테스트 실패");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function runCalibratedBacktest() {
    const no = parseInt(drawNo);
    if (isNaN(no) || no < 2) { setCalError("유효한 회차 번호를 입력하세요."); return; }
    setCalLoading(true); setCalError(null); setCalResult(null);
    try {
      const res = await fetch(`/api/backtest/calibrated?drawNo=${no}`);
      const json = await res.json();
      if (json.success) { setCalResult(json); setTab("calibrated"); }
      else setCalError(json.error ?? "보정 백테스트 실패");
    } catch (e) { setCalError(String(e)); }
    finally { setCalLoading(false); }
  }

  const winNumbers = result?.winningNumbers ?? calResult?.winningNumbers ?? [];
  const bonusNum = result?.bonusNumber ?? calResult?.bonusNumber ?? 0;
  const testNo = result?.testDrawNo ?? calResult?.testDrawNo ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* 입력 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">회차 백테스트</h3>
        <p className="text-xs text-gray-400 mb-4">
          입력 회차 직전까지 데이터로 분석 → 실제 당첨번호 대조<br />
          <span className="text-indigo-400">🔬 보정 백테스트</span>는 내부 보정 가중치까지 계산하므로 더 느립니다.
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            value={drawNo}
            onChange={(e) => setDrawNo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runBacktest()}
            placeholder="예: 1229"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-indigo-400 [appearance:textfield]"
          />
          <button
            onClick={runBacktest}
            disabled={loading || calLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "기본"}
          </button>
          <button
            onClick={runCalibratedBacktest}
            disabled={loading || calLoading}
            className="bg-indigo-800 hover:bg-indigo-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
          >
            {calLoading ? "..." : "🔬 보정"}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">⚠️ {error}</p>}
        {calError && <p className="text-xs text-red-500 mt-1">⚠️ {calError}</p>}
      </div>

      {/* 탭 전환 */}
      {(result || calResult) && (
        <>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {result && (
              <button
                onClick={() => setTab("base")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === "base" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-600"
                }`}
              >
                기본 전략
              </button>
            )}
            {calResult && (
              <button
                onClick={() => setTab("calibrated")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === "calibrated" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-600"
                }`}
              >
                🔬 보정 비교
              </button>
            )}
          </div>

          {/* 당첨 번호 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold text-gray-500 mb-2">{testNo}회 실제 당첨번호</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {winNumbers.map((n) => <NumberBall key={n} number={n} size="md" />)}
              <span className="text-gray-300 mx-1">+</span>
              <div className="relative">
                <NumberBall number={bonusNum} size="md" />
                <span className="absolute -top-1 -right-1 text-[8px] bg-yellow-400 text-yellow-900 rounded-full px-1 font-bold">보</span>
              </div>
            </div>
          </div>

          {/* ── 기본 탭 ── */}
          {tab === "base" && result && (
            <>
              <SummaryBanner
                rank={result.bestRank}
                count={result.bestMatchCount}
                label={`1~${result.trainedOn}회 학습 → ${result.testDrawNo}회 예측 (기본 15개 전략)`}
              />
              <div className="flex flex-col gap-3">
                {result.matches.map((m) => (
                  <div key={m.strategyIndex} className={`bg-white rounded-xl border shadow-sm p-4 ${m.prizeRank !== null ? "border-green-300" : "border-gray-100"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${STRATEGY_COLORS[m.strategyIndex] ?? "bg-gray-100 text-gray-600"}`}>
                          {STRATEGY_LABELS[m.strategyIndex] ?? `S${m.strategyIndex + 1}`}
                        </span>
                        <span className="text-xs text-gray-500 truncate max-w-[200px]">{m.strategyName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{m.matchedCount}개</span>
                        {m.bonusMatched && <span className="text-xs text-yellow-600 font-bold">보+</span>}
                        <RankBadge rank={m.prizeRank} />
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {m.recommendedNumbers.map((n) => (
                        <NumberBall key={n} number={n} size="sm" highlight={m.matchedNumbers.includes(n)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── 보정 비교 탭 ── */}
          {tab === "calibrated" && calResult && (
            <>
              {/* 요약 비교 */}
              <div className="grid grid-cols-2 gap-3">
                <SummaryBanner
                  rank={calResult.bestBaseRank}
                  count={Math.max(...calResult.baseMatches.map((m) => m.matchedCount))}
                  label="기본 15개 전략 최고"
                />
                <SummaryBanner
                  rank={calResult.bestCalRank}
                  count={Math.max(...calResult.calMatches.map((m) => m.matchedCount))}
                  label="🔬 보정 5개 세트 최고"
                />
              </div>

              {/* 보정 정보 */}
              <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-3">
                <p className="text-xs font-bold text-indigo-700 mb-1">
                  🔬 보정 정보 — 직전 {calResult.calibratedOn}회차 가중치 보정
                </p>
                <p className="text-xs text-indigo-500">
                  최고 가중 전략: {STRATEGY_LABELS[calResult.weights.indexOf(Math.max(...calResult.weights))] ?? "?"}
                  ({(Math.max(...calResult.weights) * 100).toFixed(1)}%)
                </p>
              </div>

              {/* 🔬 보정 세트 */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">🔬 보정 추천 세트</h3>
                <div className="flex flex-col gap-2">
                  {calResult.calMatches.map((m, idx) => (
                    <div key={idx} className={`bg-white rounded-xl border shadow-sm p-3 ${m.prizeRank !== null ? "border-green-300" : "border-indigo-100"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${CAL_COLORS[idx] ?? "bg-indigo-100 text-indigo-700"}`}>
                            보정 {idx + 1}
                          </span>
                          <span className="text-xs text-gray-500 truncate max-w-[180px]">{m.strategyName}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400">{m.matchedCount}개</span>
                          <RankBadge rank={m.prizeRank} />
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {m.numbers.map((n) => (
                          <NumberBall key={n} number={n} size="sm" highlight={m.matchedNumbers.includes(n)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 기본 전략 요약 */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">기본 전략 15개 결과</h3>
                <div className="flex flex-col gap-2">
                  {calResult.baseMatches.map((m) => (
                    <div key={m.strategyIndex} className={`bg-white rounded-xl border shadow-sm p-3 ${m.prizeRank !== null ? "border-green-300" : "border-gray-100"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${STRATEGY_COLORS[m.strategyIndex] ?? "bg-gray-100 text-gray-600"}`}>
                            {STRATEGY_LABELS[m.strategyIndex] ?? `S${m.strategyIndex + 1}`}
                          </span>
                          <span className="text-xs text-gray-400 truncate max-w-[160px]">{m.strategyName}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400">{m.matchedCount}개</span>
                          <RankBadge rank={m.prizeRank} />
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {m.numbers.map((n) => (
                          <NumberBall key={n} number={n} size="sm" highlight={m.matchedNumbers.includes(n)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
            <p>로또 6/45 이론 1등 확률: 1/8,145,060. 통계 모델은 참고용이며 당첨을 보장하지 않습니다.</p>
          </div>
        </>
      )}
    </div>
  );
}
