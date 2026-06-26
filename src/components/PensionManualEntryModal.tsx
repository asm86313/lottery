"use client";

import { useState } from "react";

interface Props {
  missingDrawNos: number[];
  latestDrawNo: number;
  onSaved: (drawNo: number) => void;
  onDone: () => void;
}

const GROUP_COLORS: Record<number, string> = {
  1: "bg-yellow-400 text-yellow-900",
  2: "bg-blue-400 text-white",
  3: "bg-red-400 text-white",
  4: "bg-gray-400 text-white",
  5: "bg-green-500 text-white",
};

export default function PensionManualEntryModal({
  missingDrawNos,
  onSaved,
  onDone,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [group, setGroup] = useState<string>("1");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  const drawNo = missingDrawNos[idx];
  const total = missingDrawNos.length;

  function reset() {
    setGroup("1");
    setDigits(["", "", "", "", "", ""]);
    setErr(null);
  }

  async function handleSave() {
    const groupNo = Number(group);
    if (isNaN(groupNo) || groupNo < 1 || groupNo > 5) {
      setErr("조는 1~5 사이 숫자입니다.");
      return;
    }
    if (digits.some((d) => d === "" || isNaN(Number(d)) || Number(d) < 0 || Number(d) > 9)) {
      setErr("번호 각 자리는 0~9 숫자를 입력하세요.");
      return;
    }

    const winNumber = digits.join("");
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/pension/save-draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drwNo: drawNo, groupNo, winNumber }),
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
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800">연금복권 누락 회차 입력</h2>
          <span className="text-sm text-gray-500">{idx + 1} / {total}</span>
        </div>

        {/* 진행 바 */}
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all"
            style={{ width: `${(saved.size / total) * 100}%` }}
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
                  ? "bg-green-600 border-green-600 text-white"
                  : "border-gray-200 text-gray-700 hover:border-green-300"
              }`}
            >
              {no}회
            </button>
          ))}
        </div>

        {/* 입력 영역 */}
        <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-4">
          <p className="text-sm font-bold text-gray-700">{drawNo}회 당첨번호 입력</p>

          {/* 조 선택 */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">조 (1~5)</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((g) => (
                <button
                  key={g}
                  onClick={() => setGroup(String(g))}
                  className={`flex-1 py-2 rounded-xl text-sm font-black transition-all border-2 ${
                    Number(group) === g
                      ? `${GROUP_COLORS[g]} border-transparent`
                      : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 6자리 번호 */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">번호 (각 자리 0~9)</p>
            <div className="flex gap-1.5">
              {digits.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-400">{i + 1}자리</span>
                  <input
                    type="number"
                    min={0}
                    max={9}
                    value={v}
                    onChange={(e) => {
                      const next = [...digits];
                      const val = e.target.value.slice(-1); // 마지막 1자리만
                      next[i] = val;
                      setDigits(next);
                      // 자동 포커스 이동
                      if (val !== "" && i < 5) {
                        const inputs = document.querySelectorAll<HTMLInputElement>(
                          "[data-pension-digit]"
                        );
                        inputs[i + 1]?.focus();
                      }
                    }}
                    data-pension-digit
                    placeholder={String(i)}
                    className="w-full border border-gray-200 rounded-xl text-center text-lg font-bold py-2.5 text-gray-900 bg-white focus:outline-none focus:border-green-400 [appearance:textfield]"
                  />
                </div>
              ))}
            </div>
          </div>

          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        {/* 선택된 번호 미리보기 */}
        {digits.every((d) => d !== "") && (
          <div className="flex items-center gap-3 justify-center bg-green-50 rounded-xl py-2 px-4">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                GROUP_COLORS[Number(group)] ?? "bg-gray-200"
              }`}
            >
              {group}
            </span>
            <span className="text-gray-400">—</span>
            <span className="font-mono text-xl font-bold text-gray-800 tracking-widest">
              {digits.join(" ")}
            </span>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
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
          className="text-sm text-gray-500 hover:text-gray-700 text-center"
        >
          {saved.size > 0 ? `${saved.size}개 저장 완료 → 분석 시작` : "입력 없이 분석하기"}
        </button>
      </div>
    </div>
  );
}
