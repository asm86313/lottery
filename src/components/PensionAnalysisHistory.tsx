"use client";

import { useState, useEffect } from "react";
import { PensionSavedAnalysis, PensionMatchResult, PensionRecommendedSet } from "@/types/lottery";

const GROUP_COLORS: Record<number, string> = {
  1: "bg-yellow-400 text-yellow-900",
  2: "bg-blue-400 text-white",
  3: "bg-red-400 text-white",
  4: "bg-gray-400 text-white",
  5: "bg-green-500 text-white",
};

const STRATEGY_BADGES = ["전빈", "단기", "미출", "MK", "2위"];
const STRATEGY_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
  "bg-purple-100 text-purple-700",
  "bg-emerald-100 text-emerald-700",
];

const RANK_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "1등", color: "bg-yellow-400 text-yellow-900 font-black" },
  2: { label: "2등", color: "bg-gray-300 text-gray-800 font-bold" },
  3: { label: "3등", color: "bg-amber-200 text-amber-800 font-bold" },
  4: { label: "4등", color: "bg-blue-100 text-blue-700 font-semibold" },
  5: { label: "5등", color: "bg-green-100 text-green-700 font-semibold" },
};

function NumberDisplay({
  number,
  winNumber,
  showDiff = false,
}: {
  number: string;
  winNumber?: string;
  showDiff?: boolean;
}) {
  const digits = number.padStart(6, "0").split("");
  const winDigits = winNumber?.padStart(6, "0").split("") ?? [];
  return (
    <span className="inline-flex gap-0.5 font-mono">
      {digits.map((d, i) => {
        const matched = showDiff && winDigits[i] === d;
        return (
          <span
            key={i}
            className={`w-5 h-5 rounded text-xs flex items-center justify-center font-bold ${
              matched
                ? "bg-emerald-400 text-white"
                : showDiff
                ? "bg-red-100 text-red-600"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {d}
          </span>
        );
      })}
    </span>
  );
}

interface HistoryWithWinning extends PensionSavedAnalysis {
  winningGroup?: number;
  winningNumber?: string;
}

type DetailView = "recommend" | "compare";

export default function PensionAnalysisHistory() {
  const [histories, setHistories] = useState<HistoryWithWinning[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [detailView, setDetailView] = useState<DetailView>("recommend");
  const [compareData, setCompareData] = useState<{
    matches: PensionMatchResult[];
    bestRank: number | null;
    hasWinning: boolean;
  } | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [filterDrawNo, setFilterDrawNo] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/pension/analysis/history")
      .then((r) => r.json())
      .then(async (json) => {
        if (!json.success) { setLoading(false); return; }

        // 각 분석의 실제 당첨 번호를 병렬로 조회
        const withWinning: HistoryWithWinning[] = await Promise.all(
          (json.data as PensionSavedAnalysis[]).map(async (h) => {
            try {
              const res = await fetch(
                `/api/pension/analysis/compare?drawNo=${h.analyzed_draw_no}`
              );
              const cj = await res.json();
              if (cj.success && cj.winningDraw) {
                return {
                  ...h,
                  winningGroup: cj.winningDraw.groupNo,
                  winningNumber: cj.winningDraw.winNumber,
                };
              }
            } catch {}
            return h;
          })
        );
        setHistories(withWinning);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function loadCompare(drawNo: number) {
    setCompareLoading(true);
    setCompareData(null);
    try {
      const res = await fetch(`/api/pension/analysis/compare?drawNo=${drawNo}`);
      const json = await res.json();
      if (json.success) {
        setCompareData({
          matches: json.matches ?? [],
          bestRank: json.bestRank,
          hasWinning: json.hasWinning,
        });
      }
    } catch {}
    setCompareLoading(false);
  }

  function handleSelect(drawNo: number) {
    setSelected(drawNo);
    setDetailView("recommend");
    setCompareData(null);
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-8">로드 중...</div>;
  }

  if (histories.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        저장된 분석 결과가 없습니다.
        <br />
        <span className="text-xs">분석 실행 시 자동 저장됩니다.</span>
      </div>
    );
  }

  const selectedHistory = histories.find((h) => h.analyzed_draw_no === selected);
  const uniqueDrawNos = Array.from(
    new Set(histories.map((h) => h.analyzed_draw_no))
  ).sort((a, b) => b - a);
  const filtered = filterDrawNo
    ? histories.filter((h) => h.analyzed_draw_no === filterDrawNo)
    : histories;

  // ── 상세 보기 ─────────────────────────────────────────────────────────────
  if (selected !== null && selectedHistory) {
    return (
      <div className="flex flex-col gap-4">
        {/* 상단 탭 + 돌아가기 */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setDetailView("recommend")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                detailView === "recommend"
                  ? "bg-white text-green-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              🎯 추천 번호
            </button>
            <button
              onClick={() => {
                setDetailView("compare");
                if (!compareData) loadCompare(selected);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                detailView === "compare"
                  ? "bg-white text-green-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              📋 당첨 비교
            </button>
          </div>
          <button
            onClick={() => setSelected(null)}
            className="ml-auto text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
          >
            ← 목록
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-700 mb-1">
            🎯 {selected}회 예측 번호
          </p>
          <p className="text-xs text-gray-400 mb-4">
            {selected - 1}회까지의 데이터로 분석 ·{" "}
            {new Date(selectedHistory.created_at).toLocaleString("ko-KR")}
          </p>

          {/* 추천 번호 탭 */}
          {detailView === "recommend" && (
            <div className="flex flex-col gap-3">
              {selectedHistory.recommended_sets.map((set: PensionRecommendedSet, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${STRATEGY_COLORS[idx] ?? ""}`}>
                    {STRATEGY_BADGES[idx]}
                  </span>
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                      GROUP_COLORS[set.groupNo] ?? "bg-gray-200"
                    }`}
                  >
                    {set.groupNo}
                  </span>
                  <span className="text-gray-400">—</span>
                  <NumberDisplay number={set.number} />
                  <span className="ml-auto text-xs text-gray-400">점수 {set.score.toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}

          {/* 당첨 비교 탭 */}
          {detailView === "compare" && (
            <>
              {compareLoading && (
                <div className="text-center text-gray-400 py-6">비교 데이터 로드 중...</div>
              )}
              {!compareLoading && compareData && !compareData.hasWinning && (
                <div className="text-center py-6 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-amber-700 font-medium">⏳ {selected}회 실제 당첨 번호 대기 중</p>
                  <p className="text-xs text-amber-500 mt-1">
                    {selected}회 당첨 번호를 DB에 입력하면 자동으로 비교됩니다.
                  </p>
                </div>
              )}
              {!compareLoading && compareData?.hasWinning && compareData.matches.length > 0 && (
                <div className="flex flex-col gap-3">
                  {/* 최고 등수 배너 */}
                  {compareData.bestRank !== null ? (
                    <div
                      className={`text-center py-3 rounded-xl text-sm font-bold ${
                        RANK_LABELS[compareData.bestRank]?.color ?? "bg-gray-100"
                      }`}
                    >
                      🏆 최고 성적: {RANK_LABELS[compareData.bestRank]?.label ?? `${compareData.bestRank}등`}
                    </div>
                  ) : (
                    <div className="text-center py-3 rounded-xl text-sm text-gray-500 bg-gray-50">
                      이번 회차는 당첨 없음
                    </div>
                  )}

                  {/* 당첨 번호 */}
                  {compareData.matches[0] && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
                      <span className="text-xs font-bold text-green-700 shrink-0">당첨</span>
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                          GROUP_COLORS[compareData.matches[0].winningGroup] ?? "bg-gray-200"
                        }`}
                      >
                        {compareData.matches[0].winningGroup}
                      </span>
                      <span className="text-gray-400">—</span>
                      <NumberDisplay number={compareData.matches[0].winningNumber} />
                    </div>
                  )}

                  {/* 전략별 비교 */}
                  {compareData.matches.map((m) => (
                    <div
                      key={m.strategyIndex}
                      className={`flex items-center gap-2 p-3 rounded-xl border ${
                        m.prizeRank !== null
                          ? "border-green-300 bg-green-50"
                          : "border-gray-100 bg-white"
                      }`}
                    >
                      <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${STRATEGY_COLORS[m.strategyIndex] ?? ""}`}>
                        {STRATEGY_BADGES[m.strategyIndex]}
                      </span>
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          GROUP_COLORS[m.recommendedGroup] ?? "bg-gray-200"
                        } ${m.groupMatched ? "ring-2 ring-emerald-400" : ""}`}
                      >
                        {m.recommendedGroup}
                      </span>
                      <span className="text-gray-300">—</span>
                      <NumberDisplay
                        number={m.recommendedNumber}
                        winNumber={m.winningNumber}
                        showDiff
                      />
                      <div className="ml-auto flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">
                          {m.digitMatchCount}/6
                          {m.groupMatched && (
                            <span className="text-emerald-500 ml-1">조✓</span>
                          )}
                        </span>
                        {m.prizeRank !== null ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${RANK_LABELS[m.prizeRank]?.color ?? ""}`}>
                            {RANK_LABELS[m.prizeRank]?.label}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                            낙첨
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  <p className="text-[11px] text-gray-400 mt-1">
                    초록 숫자 = 자릿수 일치 / 빨강 = 불일치 / 조 테두리 = 조 일치
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── 목록 보기 ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">분석 이력</h3>
        {uniqueDrawNos.length > 1 && (
          <select
            value={filterDrawNo ?? "all"}
            onChange={(e) =>
              setFilterDrawNo(e.target.value === "all" ? null : parseInt(e.target.value))
            }
            className="text-xs border border-gray-200 rounded-lg px-2 py-1"
          >
            <option value="all">전체 회차</option>
            {uniqueDrawNos.map((no) => (
              <option key={no} value={no}>{no}회</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((h) => (
          <div
            key={h.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800">
                🎯 {h.analyzed_draw_no}회 예측
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {h.analyzed_draw_no - 1}회까지 데이터 기반 ·{" "}
                {new Date(h.created_at).toLocaleString("ko-KR")}
              </p>
              {h.winningGroup && h.winningNumber ? (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-500">{h.analyzed_draw_no}회 당첨</span>
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      GROUP_COLORS[h.winningGroup] ?? "bg-gray-200"
                    }`}
                  >
                    {h.winningGroup}
                  </span>
                  <NumberDisplay number={h.winningNumber} />
                </div>
              ) : (
                <p className="text-xs text-amber-500 mt-1">
                  ⏳ {h.analyzed_draw_no}회 당첨 번호 대기 중
                </p>
              )}
            </div>
            <button
              onClick={() => handleSelect(h.analyzed_draw_no)}
              className="shrink-0 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              상세확인
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
