"use client";

import { PensionDraw } from "@/types/lottery";

interface Props {
  draws: PensionDraw[];
}

const GROUP_COLORS: Record<number, string> = {
  1: "bg-yellow-100 text-yellow-800",
  2: "bg-blue-100 text-blue-800",
  3: "bg-red-100 text-red-800",
  4: "bg-gray-100 text-gray-800",
  5: "bg-green-100 text-green-800",
};

export default function PensionHistoryTable({ draws }: Props) {
  if (draws.length === 0) {
    return (
      <div className="text-center text-sm text-gray-400 py-6">
        데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-gray-500 text-xs">
            <th className="text-left py-2 px-3">회차</th>
            <th className="text-center py-2 px-3">조</th>
            <th className="text-center py-2 px-3">당첨번호</th>
          </tr>
        </thead>
        <tbody>
          {draws.map((draw) => (
            <tr key={draw.drwNo} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 px-3 font-medium text-gray-700">{draw.drwNo}회</td>
              <td className="py-2 px-3 text-center">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                    GROUP_COLORS[draw.groupNo] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {draw.groupNo}조
                </span>
              </td>
              <td className="py-2 px-3 text-center">
                <span className="font-mono text-base font-bold text-gray-800 tracking-widest">
                  {draw.winNumber.padStart(6, "0").split("").join(" ")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
