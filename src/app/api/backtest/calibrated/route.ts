import { NextRequest, NextResponse } from "next/server";
import { getDrawsFromDb } from "@/lib/lotteryDb";
import {
  analyzeDraws,
  getNumbersFromDraw,
  generateCalibratedRecommendations,
} from "@/lib/analysis";

function calcPrizeRank(matchedCount: number, bonusMatched: boolean): number | null {
  if (matchedCount === 6) return 1;
  if (matchedCount === 5 && bonusMatched) return 2;
  if (matchedCount === 5) return 3;
  if (matchedCount === 4) return 4;
  if (matchedCount === 3) return 5;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const drawNo = parseInt(searchParams.get("drawNo") ?? "0");
    const calibrateOn = Math.min(parseInt(searchParams.get("calibrateOn") ?? "10"), 20);

    if (!drawNo) {
      return NextResponse.json({ success: false, error: "drawNo 파라미터 필수" }, { status: 400 });
    }

    const allDraws = await getDrawsFromDb();
    const target = allDraws.find((d) => d.drwNo === drawNo);
    if (!target) {
      return NextResponse.json(
        { success: false, error: `${drawNo}회 데이터가 DB에 없습니다.` },
        { status: 404 }
      );
    }

    const training = allDraws.filter((d) => d.drwNo < drawNo)
      .sort((a, b) => a.drwNo - b.drwNo);

    if (training.length < calibrateOn + 10) {
      return NextResponse.json(
        { success: false, error: `보정을 위해 최소 ${calibrateOn + 10}회 이전 데이터가 필요합니다.` },
        { status: 400 }
      );
    }

    // ── 보정 가중치 계산 ───────────────────────────────────────────────────────
    const calibWindow = training.slice(-calibrateOn);
    const STRAT_COUNT = 15;
    const matchSums: number[] = Array(STRAT_COUNT).fill(0);

    for (const calDraw of calibWindow) {
      const calTraining = training.filter((d) => d.drwNo < calDraw.drwNo);
      if (calTraining.length < 10) continue;
      const calAnalysis = analyzeDraws(calTraining);
      const calWinning = getNumbersFromDraw(calDraw);
      calAnalysis.recommendedSets.forEach((set, idx) => {
        if (idx < STRAT_COUNT) {
          matchSums[idx] += set.numbers.filter((n) => calWinning.includes(n)).length;
        }
      });
    }

    const avgMatches = matchSums.map((s) => s / calibrateOn);
    const minAvg = Math.min(...avgMatches);
    const shifted = avgMatches.map((v) => Math.max(0, v - minAvg) + 0.1);
    const total = shifted.reduce((a, b) => a + b, 0);
    const weights = shifted.map((v) => v / total);

    // ── 최종 분석 + 보정 세트 생성 ────────────────────────────────────────────
    const finalAnalysis = analyzeDraws(training);
    const calibratedSets = generateCalibratedRecommendations(
      finalAnalysis.recommendedSets,
      weights,
      finalAnalysis.numberStats
    );

    // ── 실제 당첨번호와 비교 ──────────────────────────────────────────────────
    const winning = getNumbersFromDraw(target);
    const bonus = target.bnusNo;

    const baseMatches = finalAnalysis.recommendedSets.map((set, idx) => {
      const matched = set.numbers.filter((n) => winning.includes(n));
      const bonusMatched = set.numbers.includes(bonus);
      return {
        type: "base" as const,
        strategyIndex: idx,
        strategyName: set.reason.split("—")[0].trim(),
        numbers: set.numbers,
        matchedNumbers: matched,
        matchedCount: matched.length,
        bonusMatched,
        prizeRank: calcPrizeRank(matched.length, bonusMatched),
      };
    });

    const calMatches = calibratedSets.map((set, idx) => {
      const matched = set.numbers.filter((n) => winning.includes(n));
      const bonusMatched = set.numbers.includes(bonus);
      return {
        type: "calibrated" as const,
        strategyIndex: idx,
        strategyName: set.reason,
        numbers: set.numbers,
        matchedNumbers: matched,
        matchedCount: matched.length,
        bonusMatched,
        prizeRank: calcPrizeRank(matched.length, bonusMatched),
      };
    });

    const bestBaseRank = baseMatches
      .filter((m) => m.prizeRank !== null)
      .sort((a, b) => (a.prizeRank ?? 99) - (b.prizeRank ?? 99))[0]?.prizeRank ?? null;
    const bestCalRank = calMatches
      .filter((m) => m.prizeRank !== null)
      .sort((a, b) => (a.prizeRank ?? 99) - (b.prizeRank ?? 99))[0]?.prizeRank ?? null;

    return NextResponse.json({
      success: true,
      trainedOn: training.length,
      calibratedOn: calibrateOn,
      testDrawNo: drawNo,
      winningNumbers: winning,
      bonusNumber: bonus,
      weights,
      avgMatches,
      baseMatches,
      calMatches,
      bestBaseRank,
      bestCalRank,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
