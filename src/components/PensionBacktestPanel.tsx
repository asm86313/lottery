"use client";

import { useState } from "react";

interface MatchResult {
  strategyIndex: number;
  strategyName: string;
  recommendedGroup: number;
  recommendedNumber: string;
  winningGroup: number;
  winningNumber: string;
  groupMatched: boolean;
  digitMatchCount: number;
  prizeRank: number | null;
}

interface BacktestResult {
  trainedOn: number;
  testDrawNo: number;
  winningDraw: { drwNo: number; groupNo: number; winNumber: string };
  matches: MatchResult[];
  bestRank: number | null;
}

interface CalMatch {
  type: "base" | "calibrated";
  strategyIndex: number;
  strategyName: string;
  recommendedGroup: number;
  recommendedNumber: string;
  digitMatchCount: number;
  groupMatched: boolean;
  prizeRank: number | null;
}

interface CalResult {
  trainedOn: number;
  calibratedOn: number;
  testDrawNo: number;
  winningDraw: { drwNo: number; groupNo: number; winNumber: string };
  weights: number[];
  avgMatches: number[];
  baseMatches: CalMatch[];
  calMatches: CalMatch[];
  bestBaseRank: number | null;
  bestCalRank: number | null;
}

const GROUP_COLORS: Record<number, string> = {
  1: "bg-yellow-400 text-yellow-900", 2: "bg-blue-400 text-white",
  3: "bg-red-400 text-white", 4: "bg-gray-400 text-white", 5: "bg-green-500 text-white",
};
const RANK_STYLE: Record<number, { label: string; bg: string; text: string }> = {
  1: { label: "1등", bg: "bg-yellow-400", text: "text-yellow-900" },
  2: { label: "2등", bg: "bg-gray-300", text: "text-gray-800" },
  3: { label: "3등", bg: "bg-amber-200", text: "text-amber-800" },
  4: { label: "4등", bg: "bg-blue-100", text: "text-blue-700" },
  5: { label: "5등", bg: "bg-green-100", text: "text-green-700" },
};
const STRAT_BADGES = ["전빈", "단기", "미출", "MK", "2위"];
const STRAT_COLORS = [
  "bg-blue-100 text-blue-700", "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700", "bg-purple-100 text-purple-700",
  "bg-emerald-100 text-emerald-700",
];

function RankBadge({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="text-xs text-gray-300 px-2 py-0.5 rounded-full bg-gray-50">낙첨</span>;
  const s = RANK_STYLE[rank];
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s?.bg} ${s?.text}`}>{s?.label}</span>;
}

function DigitRow({ rec, win, label }: { rec: string; win: string; label: string }) {
  const rDigits = rec.padStart(6, "0").split("");
  const wDigits = win.padStart(6, "0").split("");
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-gray-400 w-8">{label}</span>
      {rDigits.map((d, i) => (
        <span key={i} className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${
          d === wDigits[i] ? "bg-emerald-400 text-white" : "bg-gray-100 text-gray-600"
        }`}>{d}</span>
      ))}
    </div>
  );
}

function MatchCard({ m, win }: { m: CalMatch | MatchResult; win: { groupNo: number; winNumber: string } }) {
  const strat = m as CalMatch;
  const idx = m.strategyIndex;
  const isCal = (m as CalMatch).type === "calibrated";
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-3 ${m.prizeRank !== null ? "border-green-300" : isCal ? "border-green-100" : "border-gray-100"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${isCal ? "bg-green-100 text-green-700" : (STRAT_COLORS[idx] ?? "bg-gray-100 text-gray-600")}`}>
            {isCal ? `보정 ${idx + 1}` : (STRAT_BADGES[idx] ?? `S${idx + 1}`)}
          </span>
          <span className="text-xs text-gray-500 truncate max-w-[180px]">{m.strategyName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {m.groupMatched && <span className="text-[11px] text-emerald-500 font-bold">조✓</span>}
          <span className="text-xs text-gray-400">{(m as CalMatch).digitMatchCount}/6자리</span>
          <RankBadge rank={m.prizeRank} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${GROUP_COLORS[strat.recommendedGroup] ?? "bg-gray-200"} ${m.groupMatched ? "ring-2 ring-emerald-400" : ""}`}>
            {strat.recommendedGroup}
          </span>
          <DigitRow rec={strat.recommendedNumber} win={win.winNumber.padStart(6, "0")} label="추천" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${GROUP_COLORS[win.groupNo] ?? "bg-gray-200"}`}>
            {win.groupNo}
          </span>
          <DigitRow rec={win.winNumber.padStart(6, "0")} win={win.winNumber.padStart(6, "0")} label="당첨" />
        </div>
      </div>
    </div>
  );
}

export default function PensionBacktestPanel() {
  const [drawNo, setDrawNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [calLoading, setCalLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [calResult, setCalResult] = useState<CalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calError, setCalError] = useState<string | null>(null);
  const [tab, setTab] = useState<"base" | "calibrated">("base");

  async function run() {
    const no = parseInt(drawNo);
    if (isNaN(no) || no < 2) { setError("유효한 회차를 입력하세요."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/pension/backtest?drawNo=${no}`);
      const json = await res.json();
      if (json.success) { setResult(json); setTab("base"); }
      else setError(json.error ?? "백테스트 실패");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function runCal() {
    const no = parseInt(drawNo);
    if (isNaN(no) || no < 2) { setCalError("유효한 회차를 입력하세요."); return; }
    setCalLoading(true); setCalError(null); setCalResult(null);
    try {
      const res = await fetch(`/api/pension/backtest/calibrated?drawNo=${no}`);
      const json = await res.json();
      if (json.success) { setCalResult(json); setTab("calibrated"); }
      else setCalError(json.error ?? "보정 백테스트 실패");
    } catch (e) { setCalError(String(e)); }
    finally { setCalLoading(false); }
  }

  const winDraw = result?.winningDraw ?? calResult?.winningDraw;
  const testNo = result?.testDrawNo ?? calResult?.testDrawNo ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* 입력 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">연금복권 회차 백테스트</h3>
        <p className="text-xs text-gray-400 mb-4">
          입력 회차 직전까지 데이터로 5개 전략 분석 → 실제 당첨번호 대조<br />
          <span className="text-green-600">🔬 보정 백테스트</span>는 내부 보정 가중치까지 계산하므로 더 느립니다.
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            value={drawNo}
            onChange={(e) => setDrawNo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="예: 321"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-400 [appearance:textfield]"
          />
          <button onClick={run} disabled={loading || calLoading}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
            {loading ? "..." : "기본"}
          </button>
          <button onClick={runCal} disabled={loading || calLoading}
            className="bg-green-800 hover:bg-green-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
            {calLoading ? "..." : "🔬 보정"}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">⚠️ {error}</p>}
        {calError && <p className="text-xs text-red-500 mt-1">⚠️ {calError}</p>}
      </div>

      {(result || calResult) && (
        <>
          {/* 탭 */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {result && (
              <button onClick={() => setTab("base")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "base" ? "bg-white text-green-600 shadow-sm" : "text-gray-600"}`}>
                기본 전략
              </button>
            )}
            {calResult && (
              <button onClick={() => setTab("calibrated")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "calibrated" ? "bg-white text-green-600 shadow-sm" : "text-gray-600"}`}>
                🔬 보정 비교
              </button>
            )}
          </div>

          {/* 당첨 번호 */}
          {winDraw && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-bold text-gray-500 mb-2">{testNo}회 실제 당첨번호</p>
              <div className="flex items-center gap-3">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black ${GROUP_COLORS[winDraw.groupNo] ?? "bg-gray-200"}`}>
                  {winDraw.groupNo}
                </span>
                <span className="text-gray-300">—</span>
                <span className="font-mono text-xl font-bold text-gray-800 tracking-widest">
                  {winDraw.winNumber.padStart(6, "0").split("").join(" ")}
                </span>
              </div>
            </div>
          )}

          {/* 기본 탭 */}
          {tab === "base" && result && winDraw && (
            <>
              <div className={`rounded-xl p-4 text-center ${result.bestRank !== null ? `${RANK_STYLE[result.bestRank]?.bg} ${RANK_STYLE[result.bestRank]?.text}` : "bg-gray-100 text-gray-600"}`}>
                <p className="text-xs mb-1 opacity-70">1~{result.trainedOn}회 학습 → {testNo}회 예측</p>
                {result.bestRank !== null
                  ? <p className="text-lg font-black">🏆 최고 성적: {RANK_STYLE[result.bestRank]?.label}</p>
                  : <p className="text-base font-bold">이번 회차는 당첨 없음</p>}
              </div>
              {result.matches.map((m) => (
                <MatchCard key={m.strategyIndex} m={{ ...m, type: "base", digitMatchCount: m.digitMatchCount } as CalMatch} win={winDraw} />
              ))}
            </>
          )}

          {/* 보정 비교 탭 */}
          {tab === "calibrated" && calResult && winDraw && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { rank: calResult.bestBaseRank, count: Math.max(...calResult.baseMatches.map(m => m.digitMatchCount)), label: "기본 5개 전략 최고" },
                  { rank: calResult.bestCalRank, count: Math.max(...calResult.calMatches.map(m => m.digitMatchCount)), label: "🔬 보정 5개 세트 최고" },
                ].map((s, i) => (
                  <div key={i} className={`rounded-xl p-3 text-center ${s.rank !== null ? `${RANK_STYLE[s.rank]?.bg} ${RANK_STYLE[s.rank]?.text}` : "bg-gray-100 text-gray-600"}`}>
                    <p className="text-[11px] mb-0.5 opacity-70">{s.label}</p>
                    {s.rank !== null ? <p className="text-base font-black">🏆 {RANK_STYLE[s.rank]?.label}</p>
                      : <p className="text-sm font-bold">최다 {s.count}자리</p>}
                  </div>
                ))}
              </div>
              <div className="bg-green-50 rounded-xl border border-green-100 p-3">
                <p className="text-xs font-bold text-green-700 mb-1">🔬 보정 정보 — 직전 {calResult.calibratedOn}회차 가중치 보정</p>
                <p className="text-xs text-green-500">
                  최고 가중 전략: {STRAT_BADGES[calResult.weights.indexOf(Math.max(...calResult.weights))] ?? "?"}
                  ({(Math.max(...calResult.weights) * 100).toFixed(1)}%)
                </p>
              </div>
              <h3 className="text-sm font-bold text-gray-700">🔬 보정 세트</h3>
              {calResult.calMatches.map((m) => <MatchCard key={m.strategyIndex} m={m} win={winDraw} />)}
              <h3 className="text-sm font-bold text-gray-700 mt-2">기본 전략 5개 결과</h3>
              {calResult.baseMatches.map((m) => <MatchCard key={m.strategyIndex} m={m} win={winDraw} />)}
            </>
          )}
        </>
      )}
    </div>
  );
}
