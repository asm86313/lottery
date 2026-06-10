"use client";

import { RecommendedSet } from "@/types/lottery";
import NumberBall from "./NumberBall";

interface RecommendedSetsProps {
  sets: RecommendedSet[];
}

export default function RecommendedSets({ sets }: RecommendedSetsProps) {
  return (
    <div className="flex flex-col gap-4">
      {sets.map((set, idx) => (
        <div
          key={idx}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-indigo-600 text-white rounded-full text-xs flex items-center justify-center font-bold">
                {idx + 1}
              </span>
              <span className="text-sm font-medium text-gray-700">{set.reason}</span>
            </div>
            <span className="text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded-full">
              점수 {set.score.toFixed(1)}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {set.numbers.map((n) => (
              <NumberBall key={n} number={n} size="md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
