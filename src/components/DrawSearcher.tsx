"use client";

import { LotteryDraw } from "@/types/lottery";
import { useState } from "react";
import NumberBall from "./NumberBall";

export default function DrawSearcher() {
  const [searchNo, setSearchNo] = useState("");
  const [result, setResult] = useState<LotteryDraw | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchNo) {
      setError("회차 번호를 입력해주세요");
      return;
    }

    const drawNo = parseInt(searchNo, 10);
    if (isNaN(drawNo) || drawNo < 1) {
      setError("유효한 회차 번호를 입력해주세요");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/lottery/draw?drawNo=${drawNo}`);
      const json = await res.json();

      if (json.success) {
        setResult(json.data);
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-bold text-gray-800">회차 검색</h3>

      <div className="flex gap-2">
        <input
          type="number"
          min="1"
          value={searchNo}
          onChange={(e) => setSearchNo(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="회차 번호 입력 (예: 1234)"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition"
        >
          {loading ? "검색 중..." : "검색"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-white rounded-xl border border-indigo-200 p-6">
          <div className="mb-4">
            <div className="text-2xl font-bold text-indigo-600 mb-2">
              {result.drwNo}회 당첨 번호
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm text-gray-600 mb-2">당첨 번호</div>
            <div className="flex gap-2 flex-wrap">
              {[
                result.drwtNo1,
                result.drwtNo2,
                result.drwtNo3,
                result.drwtNo4,
                result.drwtNo5,
                result.drwtNo6,
              ].map((n) => (
                <NumberBall key={n} number={n} size="lg" />
              ))}
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="text-sm text-gray-600 mb-2">보너스 번호</div>
            <NumberBall number={result.bnusNo} size="lg" variant="bonus" />
          </div>
        </div>
      )}
    </div>
  );
}
