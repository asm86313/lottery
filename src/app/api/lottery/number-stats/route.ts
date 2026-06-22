import { NextResponse } from "next/server";
import { getDrawsFromDb } from "@/lib/lotteryDb";
import { getNumbersFromDraw } from "@/lib/analysis";
import { NumberStat } from "@/types/lottery";

export async function GET() {
  try {
    const draws = await getDrawsFromDb();
    const sorted = [...draws].sort((a, b) => a.drwNo - b.drwNo);
    const totalDraws = sorted.length;

    if (totalDraws === 0) {
      return NextResponse.json(
        { success: false, error: "데이터가 없습니다" },
        { status: 400 }
      );
    }

    const countMap: Record<number, number> = {};
    const lastSeenMap: Record<number, number> = {};
    const appearanceHistory: Record<number, number[]> = {};

    for (let n = 1; n <= 45; n++) {
      countMap[n] = 0;
      lastSeenMap[n] = 0;
      appearanceHistory[n] = [];
    }

    const latestDrawNo = sorted[sorted.length - 1].drwNo;

    sorted.forEach((draw) => {
      const numbers = getNumbersFromDraw(draw);
      numbers.forEach((n) => {
        countMap[n]++;
        lastSeenMap[n] = draw.drwNo;
        appearanceHistory[n].push(draw.drwNo);
      });
    });

    const numberStats: NumberStat[] = Array.from({ length: 45 }, (_, i) => {
      const n = i + 1;
      const count = countMap[n];
      const history = appearanceHistory[n];
      const lastDrawNo = lastSeenMap[n];
      const lastAppeared = lastDrawNo > 0 ? latestDrawNo - lastDrawNo : latestDrawNo;

      let gap = 0;
      if (history.length > 1) {
        const gaps = history.slice(1).map((v, idx) => v - history[idx]);
        gap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
      }

      return {
        number: n,
        count,
        frequency: totalDraws > 0 ? (count / totalDraws) * 100 : 0,
        lastAppeared,
        lastDrawNo,
        gap,
      };
    });

    return NextResponse.json({
      success: true,
      data: numberStats.sort((a, b) => b.count - a.count),
      totalDraws,
      latestDrawNo,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
