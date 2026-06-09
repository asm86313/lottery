"use client";

import { NumberStat } from "@/types/lottery";
import NumberBall from "./NumberBall";

interface HotColdPanelProps {
  hotNumbers: number[];
  coldNumbers: number[];
  overdueNumbers: number[];
  stats: NumberStat[];
}

function getCount(stats: NumberStat[], n: number) {
  return stats.find((s) => s.number === n)?.count ?? 0;
}

export default function HotColdPanel({
  hotNumbers,
  coldNumbers,
  overdueNumbers,
  stats,
}: HotColdPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-orange-50 rounded-xl border border-orange-100 p-4">
        <h3 className="text-sm font-semibold text-orange-700 mb-1">
          🔥 핫번호 <span className="font-normal text-orange-500">(최근 50회 다빈도)</span>
        </h3>
        <div className="flex flex-wrap gap-2 mt-3">
          {hotNumbers.map((n) => (
            <NumberBall
              key={n}
              number={n}
              variant="hot"
              showCount
              count={getCount(stats, n)}
            />
          ))}
        </div>
      </div>

      <div className="bg-sky-50 rounded-xl border border-sky-100 p-4">
        <h3 className="text-sm font-semibold text-sky-700 mb-1">
          ❄️ 콜드번호 <span className="font-normal text-sky-500">(최근 50회 저빈도)</span>
        </h3>
        <div className="flex flex-wrap gap-2 mt-3">
          {coldNumbers.map((n) => (
            <NumberBall
              key={n}
              number={n}
              variant="cold"
              showCount
              count={getCount(stats, n)}
            />
          ))}
        </div>
      </div>

      <div className="bg-purple-50 rounded-xl border border-purple-100 p-4">
        <h3 className="text-sm font-semibold text-purple-700 mb-1">
          ⏳ 장기 미출현 <span className="font-normal text-purple-500">(반등 예상)</span>
        </h3>
        <div className="flex flex-wrap gap-2 mt-3">
          {overdueNumbers.slice(0, 10).map((n) => (
            <NumberBall
              key={n}
              number={n}
              variant="overdue"
              showCount
              count={getCount(stats, n)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
