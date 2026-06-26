"use client";

import { useState, useRef } from "react";

interface Props {
  onImported: () => void;
}

export default function PensionCsvImport({ onImported }: Props) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/pension/import", { method: "POST", body: formData });
      const json = await res.json();
      if (json.success) {
        setResult({ success: true, message: `${json.imported}회차 데이터가 저장되었습니다.` });
        onImported();
      } else {
        setResult({ success: false, message: json.error ?? "업로드 실패" });
      }
    } catch (e) {
      setResult({ success: false, message: String(e) });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-bold text-gray-800 mb-1">CSV 데이터 업로드</h3>
      <p className="text-xs text-gray-500 mb-4">
        동행복권 사이트에서 연금복권720+ 당첨번호 CSV를 내려받아 업로드하세요.
        <br />
        필수 컬럼: <span className="font-mono bg-gray-100 px-1 rounded">회차</span>,{" "}
        <span className="font-mono bg-gray-100 px-1 rounded">조</span>,{" "}
        <span className="font-mono bg-gray-100 px-1 rounded">번호</span>
      </p>

      <div
        className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <div className="text-3xl mb-2">📄</div>
        <p className="text-sm text-gray-600 font-medium">
          {uploading ? "업로드 중..." : "클릭하거나 파일을 드래그하세요"}
        </p>
        <p className="text-xs text-gray-400 mt-1">CSV 파일만 지원</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {result && (
        <div
          className={`mt-3 p-3 rounded-lg text-sm ${
            result.success
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-600"
          }`}
        >
          {result.success ? "✅ " : "⚠️ "}
          {result.message}
        </div>
      )}

      <div className="mt-4 bg-gray-50 rounded-lg p-3">
        <p className="text-xs font-bold text-gray-700 mb-1">CSV 예시 형식</p>
        <pre className="text-xs text-gray-500 font-mono whitespace-pre-wrap">
{`회차,조,번호
193,1,123456
192,3,789012
191,2,345678`}
        </pre>
      </div>
    </div>
  );
}
