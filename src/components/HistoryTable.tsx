"use client";

import { LotteryDraw } from "@/types/lottery";
import NumberBall from "./NumberBall";

interface HistoryTableProps {
  draws: LotteryDraw[];
}

export default function HistoryTable({ draws }: HistoryTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-3 text-gray-700 font-medium w-16">회차</th>
            <th className="text-left py-2 px-3 text-gray-700 font-medium">당첨번호</th>
            <th className="text-left py-2 px-3 text-gray-700 font-medium w-20">보너스</th>
          </tr>
        </thead>
        <tbody>
          {draws.map((draw) => (
            <tr key={draw.drwNo} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="py-2 px-3 font-bold text-gray-700">{draw.drwNo}</td>
              <td className="py-2 px-3">
                <div className="flex gap-1.5 flex-wrap">
                  {[draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6].map((n) => (
                    <NumberBall key={n} number={n} size="sm" />
                  ))}
                </div>
              </td>
              <td className="py-2 px-3">
                <NumberBall number={draw.bnusNo} size="sm" variant="bonus" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
