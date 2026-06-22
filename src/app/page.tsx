"use client";

import { useState, useCallback, useEffect } from "react";
import { AnalysisResult } from "@/types/lottery";
import StatsSummary from "@/components/StatsSummary";
import HotColdPanel from "@/components/HotColdPanel";
import FrequencyChart from "@/components/FrequencyChart";
import RecommendedSets from "@/components/RecommendedSets";
import HistoryTable from "@/components/HistoryTable";
import CsvImport from "@/components/CsvImport";
import AnalysisHistory from "@/components/AnalysisHistory";
import LotteryHistoryViewer from "@/components/LotteryHistoryViewer";
import NumberStatsViewer from "@/components/NumberStatsViewer";
import DrawSearcher from "@/components/DrawSearcher";

type Tab = "recommend" | "analysis" | "history" | "analysis-compare" | "lottery-history" | "number-stats" | "draw-search";

interface MissingInfo {
  missingDrawNos: number[];
  latestDrawNo: number;
}

// 누락 회차 수동 입력 모달
function ManualEntryModal({
  missingDrawNos,
  onSaved,
  onDone,
}: {
  missingDrawNos: number[];
  onSaved: (drawNo: number) => void;
  onDone: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [nums, setNums] = useState(["", "", "", "", "", ""]);
  const [bonus, setBonus] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  const drawNo = missingDrawNos[idx];
  const total = missingDrawNos.length;

  function reset() {
    setNums(["", "", "", "", "", ""]);
    setBonus("");
    setErr(null);
  }

  async function handleSave() {
    const parsed = nums.map(Number);
    const bonusNum = Number(bonus);

    if (parsed.some((n) => isNaN(n) || n < 1 || n > 45)) {
      setErr("번호는 1~45 사이 숫자를 입력하세요.");
      return;
    }
    if (isNaN(bonusNum) || bonusNum < 1 || bonusNum > 45) {
      setErr("보너스 번호는 1~45 사이 숫자를 입력하세요.");
      return;
    }
    if (new Set([...parsed, bonusNum]).size !== 7) {
      setErr("중복 번호가 있습니다.");
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      const sorted = [...parsed].sort((a, b) => a - b);
      const res = await fetch("/api/save-draws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draws: [{
            drwNo: drawNo,
            drwtNo1: sorted[0], drwtNo2: sorted[1], drwtNo3: sorted[2],
            drwtNo4: sorted[3], drwtNo5: sorted[4], drwtNo6: sorted[5],
            bnusNo: bonusNum,
          }],
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setSaved((prev) => new Set(prev).add(drawNo));
      onSaved(drawNo);
      reset();
      if (idx < total - 1) setIdx(idx + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800">누락 회차 입력</h2>
          <span className="text-sm text-gray-600">{idx + 1} / {total}</span>
        </div>

        {/* 진행 바 */}
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-indigo-500 h-1.5 rounded-full transition-all"
            style={{ width: `${((saved.size) / total) * 100}%` }}
          />
        </div>

        {/* 회차 목록 */}
        <div className="flex gap-1 flex-wrap max-h-20 overflow-y-auto">
          {missingDrawNos.map((no, i) => (
            <button
              key={no}
              onClick={() => { setIdx(i); reset(); }}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                saved.has(no)
                  ? "bg-green-100 border-green-300 text-green-700"
                  : i === idx
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "border-gray-200 text-gray-700 hover:border-indigo-300"
              }`}
            >
              {no}회
            </button>
          ))}
        </div>

        {/* 현재 회차 입력 */}
        <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm font-bold text-gray-700">
            {drawNo}회 당첨번호 입력
          </p>
          <div className="flex gap-1">
            {nums.map((v, i) => (
              <input
                key={i}
                type="number"
                min={1}
                max={45}
                value={v}
                onChange={(e) => {
                  const next = [...nums];
                  next[i] = e.target.value;
                  setNums(next);
                }}
                placeholder={String(i + 1)}
                className="w-full border border-gray-200 rounded-lg text-center text-sm py-2 text-gray-900 bg-white focus:outline-none focus:border-indigo-400 [appearance:textfield]"
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-700 shrink-0">보너스</span>
            <input
              type="number"
              min={1}
              max={45}
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
              placeholder="보너스"
              className="w-24 border border-yellow-300 rounded-lg text-center text-sm py-2 text-gray-900 bg-white focus:outline-none focus:border-yellow-400 [appearance:textfield]"
            />
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          {idx < total - 1 && (
            <button
              onClick={() => { setIdx(idx + 1); reset(); }}
              className="px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm transition-colors"
            >
              건너뛰기 →
            </button>
          )}
        </div>

        <button
          onClick={onDone}
          className="text-sm text-gray-600 hover:text-gray-600 text-center"
        >
          {saved.size > 0 ? `${saved.size}개 저장 완료 → 분석 시작` : "DB만 분석하기"}
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [meta, setMeta] = useState<{ latestDrawNo: number; savedInDb: number; analyzedCount: number; newlyFetched: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("recommend");
  const [progress, setProgress] = useState("");
  const [missingModal, setMissingModal] = useState<MissingInfo | null>(null);
  const [hasAnalysisHistory, setHasAnalysisHistory] = useState(false);
  const [hasLotteryData, setHasLotteryData] = useState(false);

  const loadLatestAnalysis = useCallback(async () => {
    try {
      const res = await fetch("/api/analysis/history?limit=1");
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        const latestAnalysis = json.data[0];
        const mockData: AnalysisResult = {
          totalDraws: 0,
          latestDrawNo: latestAnalysis.analyzed_draw_no,
          numberStats: [],
          hotNumbers: [],
          coldNumbers: [],
          overdueNumbers: [],
          recommendedSets: latestAnalysis.recommended_sets,
          recentDraws: [],
        };
        setData(mockData);
      }
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/analysis/exists").then((res) => res.json()),
      fetch("/api/lottery/exists").then((res) => res.json()),
    ])
      .then(([analysisRes, lotteryRes]) => {
        if (analysisRes.success && analysisRes.exists) {
          setHasAnalysisHistory(true);
          loadLatestAnalysis();
        }
        if (lotteryRes.success && lotteryRes.exists) {
          setHasLotteryData(true);
        }
      })
      .catch(() => {});
  }, [loadLatestAnalysis]);

  const doAnalysis = useCallback(async () => {
    setMissingModal(null);
    setLoading(true);
    setError(null);
    setProgress("분석 중...");

    try {
      const res = await fetch("/api/analyze");
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
          } else if (event.type === "result") {
            setData(event.data);
            setMeta(event.meta ?? null);
            setProgress("");
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
      setProgress("");
    } finally {
      setLoading(false);
    }
  }, []);

  const startAnalysis = useCallback(async () => {
    setLoading(true);
    setProgress("DB 확인 중...");

    try {
      const res = await fetch("/api/check-missing");
      const json = await res.json();

      if (!json.success) throw new Error(json.error ?? "DB 확인 실패");

      setLoading(false);
      setProgress("");

      if (json.missingDrawNos.length > 0) {
        setMissingModal({ missingDrawNos: json.missingDrawNos, latestDrawNo: json.latestDrawNo });
        return;
      }

      doAnalysis();
    } catch (e) {
      console.warn("check-missing 실패:", e);
      setLoading(false);
      setProgress("");
      doAnalysis();
    }
  }, [doAnalysis]);

  const tabs: { key: Tab; label: string; requiresAnalysis: boolean }[] = [
    { key: "lottery-history", label: "🎲 당첨 번호 조회", requiresAnalysis: false },
    { key: "number-stats", label: "📈 번호별 통계", requiresAnalysis: false },
    { key: "draw-search", label: "🔍 회차 검색", requiresAnalysis: false },
    { key: "recommend", label: "🎯 추천 번호", requiresAnalysis: true },
    { key: "analysis", label: "📊 통계 분석", requiresAnalysis: true },
    { key: "analysis-compare", label: "✅ 당첨 비교", requiresAnalysis: true },
    { key: "history", label: "📋 당첨 이력", requiresAnalysis: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              🍀 로또 번호 분석기
            </h1>
            <p className="text-xs text-gray-700 mt-0.5">
              동행복권 전체 회차 데이터 기반 통계 분석
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {meta && (
              <span className="text-xs text-gray-600 hidden sm:block">
                DB {meta.savedInDb}회 · 분석 {meta.analyzedCount}회
              </span>
            )}
            <button
              onClick={() => startAnalysis()}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "분석 중..." : "분석"}
            </button>
          </div>
        </div>
      </header>

      {/* 누락 회차 수동 입력 모달 */}
      {missingModal && (
        <ManualEntryModal
          missingDrawNos={missingModal.missingDrawNos}
          onSaved={() => {}}
          onDone={doAnalysis}
        />
      )}

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 초기 상태 */}
        {!data && !loading && !error && !missingModal && (
          <div className="flex flex-col items-center gap-8 py-12">
            <div className="text-center">
              <div className="text-6xl mb-3">🎱</div>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">로또 번호 분석기</h2>
              <p className="text-gray-700 text-sm">DB에 데이터가 있으면 바로 분석합니다.</p>
            </div>
            <button
              onClick={() => startAnalysis()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold text-lg transition-colors shadow-lg shadow-indigo-200"
            >
              분석 시작하기
            </button>
            <div className="w-full max-w-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-600">DB가 비어있다면 CSV로 데이터를 추가하세요</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <CsvImport />
            </div>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-gray-600 font-medium">{progress || "분석 중..."}</p>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-600 font-medium">⚠️ {error}</p>
            <button
              onClick={() => { setError(null); startAnalysis(); }}
              className="mt-3 text-sm text-red-500 underline"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 분석 없이도 모든 탭 접근 가능 */}
        {!data && !loading && !error && (
          <div className="flex flex-col gap-6">
            {/* 탭 */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
              {tabs.map((t) => {
                const isDisabled =
                  t.requiresAnalysis &&
                  !data &&
                  !(t.key === "history" && hasLotteryData);
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      tab === t.key
                        ? "bg-white text-indigo-600 shadow-sm"
                        : isDisabled
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-gray-700 hover:text-gray-700"
                    }`}
                    disabled={isDisabled}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* 분석 필요 안내 */}
            {tab !== "lottery-history" &&
              tab !== "number-stats" &&
              tab !== "draw-search" && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 text-center">
                  <p className="text-indigo-700 font-medium mb-3">📊 분석이 필요합니다</p>
                  <p className="text-sm text-indigo-600 mb-4">
                    이 탭을 보려면 먼저 분석을 실행해주세요.
                  </p>
                  <button
                    onClick={() => startAnalysis()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    분석 시작하기
                  </button>
                </div>
              )}

            {/* 탭 컨텐츠 */}
            {tab === "lottery-history" && <LotteryHistoryViewer />}
            {tab === "number-stats" && <NumberStatsViewer />}
            {tab === "draw-search" && <DrawSearcher />}
          </div>
        )}

        {/* 결과 */}
        {data && !loading && (
          <div className="flex flex-col gap-6">
            <StatsSummary
              totalDraws={data.totalDraws}
              latestDrawNo={data.latestDrawNo}
            />

            {/* 탭 */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    tab === t.key
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-700 hover:text-gray-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "recommend" && (
              <div className="flex flex-col gap-6">
                {data.numberStats && data.numberStats.length > 0 && (
                  <HotColdPanel
                    hotNumbers={data.hotNumbers}
                    coldNumbers={data.coldNumbers}
                    overdueNumbers={data.overdueNumbers}
                    stats={data.numberStats}
                  />
                )}
                <div>
                  <h2 className="text-base font-bold text-gray-800 mb-3">
                    {data.numberStats && data.numberStats.length > 0
                      ? "추천 번호 세트"
                      : "추천 번호"}
                  </h2>
                  {data.recommendedSets && data.recommendedSets.length > 0 ? (
                    <RecommendedSets sets={data.recommendedSets} />
                  ) : (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center text-gray-500">
                      추천 번호 데이터를 불러올 수 없습니다.
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "analysis" && (
              <div className="flex flex-col gap-6">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <h2 className="text-base font-bold text-gray-800 mb-4">
                    번호별 출현 빈도 (전체 회차)
                  </h2>
                  <FrequencyChart stats={data.numberStats} />
                  <div className="flex gap-4 mt-3 text-xs text-gray-700 flex-wrap">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> 1~10</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> 11~20</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> 21~30</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-500 inline-block" /> 31~40</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> 41~45</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <h2 className="text-base font-bold text-gray-800 mb-4">
                    번호별 상세 통계
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-700 text-xs">
                          <th className="text-left py-2 px-2">번호</th>
                          <th className="text-right py-2 px-2">출현 횟수</th>
                          <th className="text-right py-2 px-2">출현율</th>
                          <th className="text-right py-2 px-2">마지막 회차</th>
                          <th className="text-right py-2 px-2">미출현 기간</th>
                          <th className="text-right py-2 px-2">평균 간격</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...data.numberStats]
                          .sort((a, b) => b.count - a.count)
                          .map((s) => (
                            <tr
                              key={s.number}
                              className="border-b border-gray-50 hover:bg-gray-50"
                            >
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-gray-900"
                                    style={{
                                      backgroundColor:
                                        s.number <= 10
                                          ? "#fef08a"
                                          : s.number <= 20
                                          ? "#93c5fd"
                                          : s.number <= 30
                                          ? "#fca5a5"
                                          : s.number <= 40
                                          ? "#d1d5db"
                                          : "#86efac",
                                    }}
                                  >
                                    {s.number}
                                  </span>
                                </div>
                              </td>
                              <td className="text-right py-2 px-2 font-bold text-gray-700">{s.count}</td>
                              <td className="text-right py-2 px-2 text-gray-700">
                                {s.frequency.toFixed(1)}%
                              </td>
                              <td className="text-right py-2 px-2 text-gray-700">
                                {s.lastDrawNo}회
                              </td>
                              <td className="text-right py-2 px-2">
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full ${
                                    s.lastAppeared > 20
                                      ? "bg-purple-100 text-purple-700"
                                      : s.lastAppeared > 10
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-green-100 text-green-700"
                                  }`}
                                >
                                  {s.lastAppeared}회
                                </span>
                              </td>
                              <td className="text-right py-2 px-2 text-gray-700">
                                {s.gap}회
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === "lottery-history" && <LotteryHistoryViewer />}

            {tab === "number-stats" && <NumberStatsViewer />}

            {tab === "draw-search" && <DrawSearcher />}

            {tab === "analysis-compare" && (
              <AnalysisHistory />
            )}

            {tab === "history" && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h2 className="text-base font-bold text-gray-800 mb-4">
                  최근 50회 당첨번호
                </h2>
                <HistoryTable draws={data.recentDraws} />
              </div>
            )}

            <p className="text-xs text-gray-600 text-center pb-4">
              ※ 이 프로그램은 통계 분석 기반 참고용이며, 당첨을 보장하지 않습니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
