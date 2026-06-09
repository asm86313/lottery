"use client";

import { useState, useCallback } from "react";
import { AnalysisResult } from "@/types/lottery";
import StatsSummary from "@/components/StatsSummary";
import HotColdPanel from "@/components/HotColdPanel";
import FrequencyChart from "@/components/FrequencyChart";
import RecommendedSets from "@/components/RecommendedSets";
import HistoryTable from "@/components/HistoryTable";
import CsvImport from "@/components/CsvImport";

type Tab = "recommend" | "analysis" | "history";

interface MissingInfo {
  missingDrawNos: number[];
  latestDrawNo: number;
}

function describeMissing(nos: number[]): string {
  if (nos.length === 0) return "";
  if (nos.length <= 20) return nos.join(", ") + "회";

  // 연속 구간으로 묶어서 표시
  const ranges: string[] = [];
  let start = nos[0];
  let end = nos[0];
  for (let i = 1; i < nos.length; i++) {
    if (nos[i] === end + 1) {
      end = nos[i];
    } else {
      ranges.push(start === end ? `${start}회` : `${start}~${end}회`);
      start = nos[i];
      end = nos[i];
    }
  }
  ranges.push(start === end ? `${start}회` : `${start}~${end}회`);

  if (ranges.length <= 6) return ranges.join(", ");
  return ranges.slice(0, 5).join(", ") + ` 외 ${ranges.length - 5}개 구간`;
}

export default function Home() {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [meta, setMeta] = useState<{ latestDrawNo: number; savedInDb: number; analyzedCount: number; newlyFetched: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("recommend");
  const [progress, setProgress] = useState("");
  const [missingModal, setMissingModal] = useState<MissingInfo | null>(null);

  const doAnalysis = useCallback(async (skipFetch: boolean, upToDrawNo?: number) => {
    setMissingModal(null);
    setLoading(true);
    setError(null);
    setProgress(
      upToDrawNo
        ? `${upToDrawNo}회차까지 분석 중...`
        : skipFetch ? "DB 데이터 분석 중..." : "데이터 수집 및 분석 중..."
    );

    try {
      const params = new URLSearchParams();
      if (skipFetch) params.set("skipFetch", "true");

      const res = await fetch(`/api/analyze?${params}`);
      const json = await res.json();

      if (!json.success) throw new Error(json.error ?? "분석 실패");

      setData(json.data);
      setMeta(json.meta ?? null);
      setProgress("");
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

      if (json.missingDrawNos.length > 0) {
        setLoading(false);
        setProgress("");
        setMissingModal({ missingDrawNos: json.missingDrawNos, latestDrawNo: json.latestDrawNo });
        return;
      }

      setLoading(false);
      setProgress("");
      doAnalysis(false, json.storedCount);
      return;
    } catch (e) {
      console.warn("check-missing 실패:", e);
    }

    setLoading(false);
    setProgress("");
    doAnalysis(false);
  }, [doAnalysis]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "recommend", label: "🎯 추천 번호" },
    { key: "analysis", label: "📊 통계 분석" },
    { key: "history", label: "📋 당첨 이력" },
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
            <p className="text-xs text-gray-500 mt-0.5">
              동행복권 전체 회차 데이터 기반 통계 분석
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {meta && (
              <span className="text-xs text-gray-400 hidden sm:block">
                DB {meta.savedInDb}회 · 분석 {meta.analyzedCount}회
                {meta.newlyFetched > 0 && (
                  <span className="ml-1 text-green-600 font-medium">+{meta.newlyFetched} 신규</span>
                )}
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

      {/* 누락 회차 확인 모달 */}
      {missingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              <h2 className="text-base font-bold text-gray-800">DB에 없는 회차 발견</h2>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700">
              <p className="font-semibold text-gray-900 mb-2">
                누락 회차 <span className="text-indigo-600">{missingModal.missingDrawNos.length}개</span>
              </p>
              <p className="text-gray-500 leading-relaxed break-words">
                {describeMissing(missingModal.missingDrawNos)}
              </p>
            </div>

            <p className="text-sm text-gray-700">
              동행복권에서 누락된 회차 데이터를 가져오시겠습니까?
            </p>

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => doAnalysis(false, missingModal.latestDrawNo)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors"
              >
                확인 (가져오기)
              </button>
              <button
                onClick={() => doAnalysis(true, missingModal.missingDrawNos[0] - 1)}
                className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              >
                취소 (DB만 분석)
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 초기 상태 */}
        {!data && !loading && !error && (
          <div className="flex flex-col items-center gap-8 py-12">
            <div className="text-center">
              <div className="text-6xl mb-3">🎱</div>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">로또 번호 분석기</h2>
              <p className="text-gray-500 text-sm">DB에 데이터가 있으면 바로 분석합니다.</p>
            </div>
            <button
              onClick={() => startAnalysis()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold text-lg transition-colors shadow-lg shadow-indigo-200"
            >
              분석 시작하기
            </button>
            <div className="w-full max-w-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">DB가 비어있다면 CSV로 데이터를 추가하세요</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <CsvImport />
            </div>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-gray-600 font-medium">{progress || "분석 중..."}</p>
            <p className="text-gray-400 text-sm">
              전체 회차 데이터를 가져오는 중입니다. 잠시만 기다려주세요.
            </p>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-600 font-medium">⚠️ {error}</p>
            <button
              onClick={() => startAnalysis()}
              className="mt-3 text-sm text-red-500 underline"
            >
              다시 시도
            </button>
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
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    tab === t.key
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* 탭 콘텐츠 */}
            {tab === "recommend" && (
              <div className="flex flex-col gap-6">
                <HotColdPanel
                  hotNumbers={data.hotNumbers}
                  coldNumbers={data.coldNumbers}
                  overdueNumbers={data.overdueNumbers}
                  stats={data.numberStats}
                />
                <div>
                  <h2 className="text-base font-semibold text-gray-800 mb-3">
                    추천 번호 세트
                  </h2>
                  <RecommendedSets sets={data.recommendedSets} />
                </div>
              </div>
            )}

            {tab === "analysis" && (
              <div className="flex flex-col gap-6">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <h2 className="text-base font-semibold text-gray-800 mb-4">
                    번호별 출현 빈도 (전체 회차)
                  </h2>
                  <FrequencyChart stats={data.numberStats} />
                  <div className="flex gap-4 mt-3 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> 1~10</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> 11~20</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> 21~30</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-500 inline-block" /> 31~40</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> 41~45</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <h2 className="text-base font-semibold text-gray-800 mb-4">
                    번호별 상세 통계
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-500 text-xs">
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
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
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
                              <td className="text-right py-2 px-2 font-semibold">{s.count}</td>
                              <td className="text-right py-2 px-2 text-gray-500">
                                {s.frequency.toFixed(1)}%
                              </td>
                              <td className="text-right py-2 px-2 text-gray-500">
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
                              <td className="text-right py-2 px-2 text-gray-500">
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

            {tab === "history" && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h2 className="text-base font-semibold text-gray-800 mb-4">
                  최근 20회 당첨번호
                </h2>
                <HistoryTable draws={data.recentDraws} />
              </div>
            )}

            <p className="text-xs text-gray-400 text-center pb-4">
              ※ 이 프로그램은 통계 분석 기반 참고용이며, 당첨을 보장하지 않습니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}