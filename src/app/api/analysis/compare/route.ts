import { NextRequest, NextResponse } from "next/server";
import { getAnalysisByDrawNo, getDrawsFromDb } from "@/lib/lotteryDb";
import { getNumbersFromDraw } from "@/lib/analysis";
import { MatchResult } from "@/types/lottery";

export async function GET(req: NextRequest) {
  try {
    const drawNo = req.nextUrl.searchParams.get("drawNo");
    if (!drawNo) {
      return NextResponse.json(
        { success: false, error: "drawNo 파라미터 필수" },
        { status: 400 }
      );
    }

    const targetDrawNo = parseInt(drawNo, 10); // 예측 대상 회차
    const analysis = await getAnalysisByDrawNo(targetDrawNo);
    if (!analysis) {
      return NextResponse.json(
        { success: false, error: "해당 회차의 분석 결과가 없습니다" },
        { status: 404 }
      );
    }

    const allDraws = await getDrawsFromDb();
    const targetDraw = allDraws.find((d) => d.drwNo === targetDrawNo); // 예측 대상 회차의 당첨 번호

    // 당첨 번호가 없어도 추천 세트는 반환
    let winningNumbers: number[] | undefined;
    let matches: MatchResult[] | undefined;
    let maxMatched: number | undefined;
    let bestStrategies: MatchResult[] | undefined;

    if (targetDraw) {
      winningNumbers = getNumbersFromDraw(targetDraw);
      matches = analysis.recommended_sets.map((set, index) => {
        const matched = set.numbers.filter((n) => winningNumbers!.includes(n));
        return {
          recommended_set_index: index,
          strategy_name: set.reason.split("(")[0].trim(),
          recommended_numbers: set.numbers,
          winning_numbers: winningNumbers!,
          matched_count: matched.length,
          matched_numbers: matched,
        };
      });

      maxMatched = Math.max(...matches.map((m) => m.matched_count), 0);
      bestStrategies = matches.filter((m) => m.matched_count === maxMatched);
    }

    return NextResponse.json({
      success: true,
      analyzedDrawNo: targetDrawNo,
      winningDrawNo: targetDrawNo,
      winningNumbers,
      matches,
      bestMatched: maxMatched,
      bestStrategies,
      recommendedSets: analysis.recommended_sets,
      hasWinning: !!targetDraw,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
