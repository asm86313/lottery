import { NextRequest, NextResponse } from "next/server";
import { getDrawsFromDb } from "@/lib/lotteryDb";
import { analyzeDraws, getNumbersFromDraw } from "@/lib/analysis";

function calcPrizeRank(matched: number[], bonusMatched: boolean): number | null {
  switch (matched.length) {
    case 6: return 1;
    case 5: return bonusMatched ? 2 : 3;
    case 4: return 4;
    case 3: return 5;
    default: return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = parseInt(searchParams.get("from") ?? "0");
    const to = parseInt(searchParams.get("to") ?? "0");

    if (!from || !to || from >= to) {
      return NextResponse.json(
        { success: false, error: "from, to 파라미터가 필요합니다. (from < to)" },
        { status: 400 }
      );
    }
    if (to - from > 50) {
      return NextResponse.json(
        { success: false, error: "최대 50회차까지 테스트 가능합니다." },
        { status: 400 }
      );
    }

    const allDraws = await getDrawsFromDb();
    const drawNos = Array.from({ length: to - from + 1 }, (_, i) => from + i);

    // 전략 수
    const strategyCount = analyzeDraws(allDraws.filter((d) => d.drwNo < from)).recommendedSets.length;

    // 전략별 누적 통계
    const strategyStats: {
      totalMatches: number;
      matchCounts: number[];
      prizes: (number | null)[];
      bestMatch: number;
    }[] = Array.from({ length: strategyCount }, () => ({
      totalMatches: 0,
      matchCounts: [],
      prizes: [],
      bestMatch: 0,
    }));

    const drawResults: {
      drawNo: number;
      winningNumbers: number[];
      bonusNumber: number;
      strategyResults: {
        strategyIndex: number;
        matchedCount: number;
        prizeRank: number | null;
      }[];
    }[] = [];

    for (const drawNo of drawNos) {
      const target = allDraws.find((d) => d.drwNo === drawNo);
      if (!target) continue;

      const trainingDraws = allDraws.filter((d) => d.drwNo < drawNo);
      if (trainingDraws.length === 0) continue;

      const analysis = analyzeDraws(trainingDraws);
      const winning = getNumbersFromDraw(target);
      const bonus = target.bnusNo;

      const strategyResults = analysis.recommendedSets.map((set, idx) => {
        const matched = set.numbers.filter((n) => winning.includes(n));
        const bonusMatched = set.numbers.includes(bonus);
        const prizeRank = calcPrizeRank(matched, bonusMatched);

        strategyStats[idx].totalMatches += matched.length;
        strategyStats[idx].matchCounts.push(matched.length);
        strategyStats[idx].prizes.push(prizeRank);
        if (matched.length > strategyStats[idx].bestMatch) {
          strategyStats[idx].bestMatch = matched.length;
        }

        return { strategyIndex: idx, matchedCount: matched.length, prizeRank };
      });

      drawResults.push({ drawNo, winningNumbers: winning, bonusNumber: bonus, strategyResults });
    }

    const tested = drawResults.length;

    const summary = strategyStats.map((s, idx) => ({
      strategyIndex: idx,
      avgMatch: tested > 0 ? Math.round((s.totalMatches / tested) * 100) / 100 : 0,
      bestMatch: s.bestMatch,
      match3Plus: s.matchCounts.filter((c) => c >= 3).length,
      match4Plus: s.matchCounts.filter((c) => c >= 4).length,
      prizes: s.prizes.filter((p) => p !== null),
    }));

    // 전략별 평균 기반 앙상블 최적 가중치 계산
    const avgMatches = summary.map((s) => s.avgMatch);
    const totalAvg = avgMatches.reduce((a, b) => a + b, 0);
    const optimalWeights = totalAvg > 0
      ? avgMatches.map((v) => Math.round((v / totalAvg) * 100) / 100)
      : avgMatches.map(() => 1 / strategyCount);

    return NextResponse.json({
      success: true,
      tested,
      from,
      to,
      summary,
      optimalWeights,
      drawResults,
      baseline: 6 * 6 / 45, // 이론적 기대 일치 개수 (0.8)
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
