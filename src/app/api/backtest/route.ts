import { NextRequest, NextResponse } from "next/server";
import { getDrawsFromDb } from "@/lib/lotteryDb";
import { analyzeDraws, getNumbersFromDraw } from "@/lib/analysis";
import { LotteryDraw } from "@/types/lottery";

interface BacktestMatch {
  strategyIndex: number;
  strategyName: string;
  recommendedNumbers: number[];
  matchedNumbers: number[];
  matchedCount: number;
  bonusMatched: boolean;
  prizeRank: number | null;
}

function calcPrizeRank(
  matched: number[],
  bonusMatched: boolean
): number | null {
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
    const testDrawNo = parseInt(searchParams.get("drawNo") ?? "0");

    if (!testDrawNo) {
      return NextResponse.json(
        { success: false, error: "drawNo 파라미터가 필요합니다." },
        { status: 400 }
      );
    }

    const allDraws = await getDrawsFromDb();

    const targetDraw = allDraws.find((d) => d.drwNo === testDrawNo);
    if (!targetDraw) {
      return NextResponse.json(
        { success: false, error: `${testDrawNo}회 당첨 데이터가 DB에 없습니다.` },
        { status: 404 }
      );
    }

    // 테스트 회차 직전까지만 학습 데이터로 사용
    const trainingDraws: LotteryDraw[] = allDraws.filter(
      (d) => d.drwNo < testDrawNo
    );
    if (trainingDraws.length === 0) {
      return NextResponse.json(
        { success: false, error: "학습 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const analysis = analyzeDraws(trainingDraws);
    const winningNumbers = getNumbersFromDraw(targetDraw);
    const bonusNumber = targetDraw.bnusNo;

    const matches: BacktestMatch[] = analysis.recommendedSets.map((set, idx) => {
      const matched = set.numbers.filter((n) => winningNumbers.includes(n));
      const bonusMatched = set.numbers.includes(bonusNumber);
      return {
        strategyIndex: idx,
        strategyName: set.reason.split("—")[0].trim(),
        recommendedNumbers: set.numbers,
        matchedNumbers: matched,
        matchedCount: matched.length,
        bonusMatched,
        prizeRank: calcPrizeRank(matched, bonusMatched),
      };
    });

    const bestMatchCount = Math.max(...matches.map((m) => m.matchedCount));
    const bestRank = matches
      .filter((m) => m.prizeRank !== null)
      .sort((a, b) => (a.prizeRank ?? 99) - (b.prizeRank ?? 99))[0]?.prizeRank ?? null;

    return NextResponse.json({
      success: true,
      trainedOn: trainingDraws.length,
      testDrawNo,
      winningNumbers,
      bonusNumber,
      matches,
      bestMatchCount,
      bestRank,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
