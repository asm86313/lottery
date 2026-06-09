"use client";

interface StatsSummaryProps {
  totalDraws: number;
  latestDrawNo: number;
}

export default function StatsSummary({ totalDraws, latestDrawNo }: StatsSummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { label: "최신 회차", value: `${latestDrawNo}회`, icon: "🎯" },
        { label: "분석 회차", value: `${totalDraws}회`, icon: "📊" },
        { label: "번호 범위", value: "1 ~ 45", icon: "🔢" },
        { label: "추출 번호", value: "6개", icon: "✨" },
      ].map((item) => (
        <div
          key={item.label}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1"
        >
          <span className="text-xl">{item.icon}</span>
          <span className="text-2xl font-bold text-gray-800">{item.value}</span>
          <span className="text-xs text-gray-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
