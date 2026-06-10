"use client";

import { useRef, useState } from "react";

export default function CsvImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleFile(file: File) {
    setStatus("loading");
    setMessage("");
    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/import", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setStatus("ok");
      setMessage(`${json.imported}회차 데이터 저장 완료!`);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "오류 발생");
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
      <h3 className="text-sm font-bold text-blue-800 mb-1">CSV 데이터 Import</h3>
      <p className="text-xs text-blue-600 mb-3">
        동행복권 사이트 → 당첨번호 조회 → 엑셀 저장 → CSV 변환 후 업로드
      </p>

      <div
        className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center cursor-pointer hover:bg-blue-100 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {status === "loading" ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-sm text-blue-600">업로드 중...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl">📂</span>
            <span className="text-sm text-blue-700 font-medium">CSV 파일을 클릭하거나 드래그하여 업로드</span>
            <span className="text-xs text-blue-400">.csv 파일만 지원</span>
          </div>
        )}
      </div>

      {status === "ok" && (
        <p className="mt-2 text-sm text-green-700 font-medium">✅ {message}</p>
      )}
      {status === "error" && (
        <p className="mt-2 text-sm text-red-600">⚠️ {message}</p>
      )}

      <details className="mt-3">
        <summary className="text-xs text-blue-500 cursor-pointer">CSV 만드는 방법 보기</summary>
        <ol className="mt-2 text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>동행복권(dhlottery.co.kr) → 로또6/45 → 당첨번호 조회</li>
          <li>조회 후 상단 <strong>엑셀 저장</strong> 클릭</li>
          <li>Excel에서 열기 → <strong>다른 이름으로 저장 → CSV UTF-8</strong> 선택</li>
          <li>저장된 .csv 파일을 위 영역에 업로드</li>
        </ol>
      </details>
    </div>
  );
}
