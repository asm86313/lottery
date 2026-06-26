"use client";

import { PensionRecommendedSet, PensionDigitStat, PensionGroupStat, PensionDraw } from "@/types/lottery";

interface Props {
  recommendations: PensionRecommendedSet[];
  digitStats: PensionDigitStat[];
  groupStats: PensionGroupStat[];
  lastDraw: PensionDraw | null;
  markovNextProbs: number[][];
}

const GROUP_COLORS: Record<number, string> = {
  1: "bg-yellow-400 text-yellow-900",
  2: "bg-blue-400 text-white",
  3: "bg-red-400 text-white",
  4: "bg-gray-400 text-white",
  5: "bg-green-500 text-white",
};

const GROUP_BORDER: Record<number, string> = {
  1: "border-yellow-400",
  2: "border-blue-400",
  3: "border-red-400",
  4: "border-gray-400",
  5: "border-green-500",
};

const DIGIT_BG = [
  "bg-violet-50 border-violet-200",
  "bg-blue-50 border-blue-200",
  "bg-cyan-50 border-cyan-200",
  "bg-teal-50 border-teal-200",
  "bg-green-50 border-green-200",
  "bg-yellow-50 border-yellow-200",
];

// z-score에 따른 셀 색상
function zScoreColor(z: number): string {
  if (z >= 2.0) return "bg-emerald-500 text-white font-bold";
  if (z >= 1.0) return "bg-emerald-200 text-emerald-900 font-semibold";
  if (z >= 0.3) return "bg-emerald-50 text-emerald-800";
  if (z > -0.3) return "bg-gray-50 text-gray-500";
  if (z > -1.0) return "bg-red-50 text-red-700";
  if (z > -2.0) return "bg-red-200 text-red-900 font-semibold";
  return "bg-red-500 text-white font-bold";
}

// EMA 트렌드 표시 (ema weight vs 균일 기대값 10%)
function emaTrendIcon(ema: number): { icon: string; color: string } {
  const diff = ema - 0.1; // 균일분포 기대값
  if (diff > 0.03) return { icon: "↑↑", color: "text-emerald-600" };
  if (diff > 0.01) return { icon: "↑", color: "text-emerald-500" };
  if (diff > -0.01) return { icon: "–", color: "text-gray-400" };
  if (diff > -0.03) return { icon: "↓", color: "text-red-400" };
  return { icon: "↓↓", color: "text-red-600" };
}

const STRATEGY_LABELS = [
  { badge: "전빈", color: "bg-blue-100 text-blue-700",    title: "전체 빈도 최빈값" },
  { badge: "단기", color: "bg-teal-100 text-teal-700",    title: "단기 트렌드" },
  { badge: "미출", color: "bg-orange-100 text-orange-700", title: "자릿수별 최장 미출현" },
  { badge: "MK",   color: "bg-purple-100 text-purple-700", title: "마르코프 직전 전이" },
  { badge: "2위",  color: "bg-emerald-100 text-emerald-700", title: "2순위 보완" },
];

export default function PensionRecommendedSets({
  recommendations,
  digitStats,
  groupStats,
  lastDraw,
  markovNextProbs,
}: Props) {
  const positions = [1, 2, 3, 4, 5, 6];

  return (
    <div className="flex flex-col gap-5">
      {/* ── 추천 번호 카드 ────────────────────────────────────────────────── */}
      {recommendations.map((set, idx) => {
        const meta = STRATEGY_LABELS[idx] ?? STRATEGY_LABELS[0];
        return (
          <div
            key={idx}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
          >
            <div className="flex items-start justify-between mb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-md ${meta.color}`}>
                  {meta.badge}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-700">{meta.title}</p>
                  <p className="text-xs text-gray-400 truncate">{set.reason}</p>
                </div>
              </div>
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg shrink-0">
                점수 {set.score.toFixed(1)}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* 조 */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-400">조</span>
                <span
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${
                    GROUP_COLORS[set.groupNo] ?? "bg-gray-200 text-gray-700"
                  }`}
                >
                  {set.groupNo}
                </span>
              </div>

              <span className="text-gray-200 text-xl">—</span>

              {/* 6자리 번호 */}
              <div className="flex gap-1.5 flex-wrap">
                {set.number.padStart(6, "0").split("").map((digit, dIdx) => {
                  const stat = digitStats.find(
                    (s) => s.position === dIdx + 1 && s.digit === Number(digit)
                  );
                  const z = stat?.zScore ?? 0;
                  return (
                    <div key={dIdx} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-400">{dIdx + 1}자리</span>
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg font-black ${
                          DIGIT_BG[dIdx] ?? "bg-gray-50 border-gray-200"
                        }`}
                      >
                        {digit}
                      </div>
                      {/* z-score 도트 */}
                      <span className="text-[10px] text-gray-400">
                        {z >= 0 ? "+" : ""}{z.toFixed(1)}σ
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* ── 카이제곱 통계 히트맵 ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800">카이제곱 편향 히트맵</h3>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
              과출현 (+σ)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-500 inline-block" />
              미출현 (-σ)
            </span>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mb-3">
          균일분포(10%) 기대값 대비 각 숫자의 통계적 편차 (|σ| &gt; 1.96 = 95% 유의)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center">
            <thead>
              <tr className="text-gray-400">
                <th className="py-1 px-1 text-left w-8">숫자</th>
                {positions.map((pos) => (
                  <th key={pos} className="py-1 px-1 min-w-[52px]">{pos}자리</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, digit) => (
                <tr key={digit} className="border-t border-gray-50">
                  <td className="py-1 px-1 font-bold text-gray-700 text-left">{digit}</td>
                  {positions.map((pos) => {
                    const stat = digitStats.find(
                      (s) => s.position === pos && s.digit === digit
                    );
                    const z = stat?.zScore ?? 0;
                    const ema = stat?.emaWeight ?? 0.1;
                    const trend = emaTrendIcon(ema);
                    return (
                      <td key={pos} className="py-1 px-0.5">
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] w-full justify-center ${zScoreColor(z)}`}
                        >
                          {z >= 0 ? "+" : ""}{z.toFixed(1)}
                          <span className={`text-[9px] ${trend.color}`}>{trend.icon}</span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          σ 옆 화살표는 EMA 트렌드 (↑↑ 최근 상승 / ↓↓ 최근 하락)
        </p>
      </div>

      {/* ── 마르코프 전이 예측 ────────────────────────────────────────────── */}
      {lastDraw && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-1">마르코프 전이 확률</h3>
          <p className="text-[11px] text-gray-400 mb-3">
            직전 회차 ({lastDraw.drwNo}회 |{" "}
            <span className={`inline-block px-1 rounded text-[10px] font-bold ${GROUP_COLORS[lastDraw.groupNo] ?? ""}`}>
              {lastDraw.groupNo}조
            </span>{" "}
            {lastDraw.winNumber.padStart(6, "0").split("").join(" ")}) 기준,
            역대 전이 데이터에서 다음 회차 각 자리의 상위 3개 예측 숫자
          </p>
          <div className="flex gap-2 flex-wrap">
            {markovNextProbs.map((probs, posIdx) => {
              const lastDigit = Number(lastDraw.winNumber.padStart(6, "0")[posIdx]);
              const top3 = probs
                .map((p, d) => ({ d, p }))
                .sort((a, b) => b.p - a.p)
                .slice(0, 3);

              return (
                <div
                  key={posIdx}
                  className={`flex-1 min-w-[90px] border rounded-xl p-3 ${DIGIT_BG[posIdx]}`}
                >
                  <p className="text-[11px] text-gray-500 mb-1 font-medium">
                    {posIdx + 1}자리
                    <span className="text-gray-400"> ({lastDigit}→)</span>
                  </p>
                  {top3.map(({ d, p }, rank) => (
                    <div key={d} className="flex items-center justify-between gap-1 mt-0.5">
                      <span
                        className={`text-xs font-bold ${rank === 0 ? "text-gray-900" : "text-gray-500"}`}
                      >
                        {d}
                      </span>
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full mx-1">
                        <div
                          className="h-1.5 bg-blue-400 rounded-full"
                          style={{ width: `${Math.min(p * 200, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">{(p * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 조별 통계 ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-3">조별 출현 통계</h3>
        <div className="flex gap-2 flex-wrap">
          {groupStats.map((gs) => {
            const expectedPct = 20; // 5개 조이므로 균일분포 기대값 20%
            const deviation = gs.frequency - expectedPct;
            return (
              <div
                key={gs.group}
                className={`flex-1 min-w-[80px] rounded-xl p-3 text-center border-2 ${
                  GROUP_BORDER[gs.group] ?? "border-gray-200"
                } bg-white`}
              >
                <span
                  className={`inline-flex w-8 h-8 rounded-full text-sm font-black items-center justify-center mx-auto mb-2 ${
                    GROUP_COLORS[gs.group] ?? "bg-gray-200"
                  }`}
                >
                  {gs.group}
                </span>
                <p className="text-xs text-gray-500">{gs.count}회</p>
                <p className="text-sm font-bold text-gray-800">{gs.frequency.toFixed(1)}%</p>
                <p className={`text-[10px] font-medium ${deviation > 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {deviation > 0 ? "+" : ""}{deviation.toFixed(1)}%p
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          기대값 대비 편차 (+/-%p). 균일분포 기대값은 각 조 20%.
        </p>
      </div>
    </div>
  );
}
