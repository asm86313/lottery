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

    const targetDrawNo = parseInt(drawNo, 10);
    const analysis = await getAnalysisByDrawNo(targetDrawNo);
    if (!analysis) {
      return NextResponse.json(
        { success: false, error: "해당 회차의 분석 결과가 없습니다" },
        { status: 404 }
      );
    }

    const allDraws = await getDrawsFromDb();
    const targetDraw = allDraws.find((d) => d.drwNo === targetDrawNo + 1);
    if (!targetDraw) {
      return NextResponse.json(
        { success: false, error: "해당 회차의 당첨 번호가 없습니다" },
        { status: 404 }
      );
    }

    const winningNumbers = getNumbersFromDraw(targetDraw);
    const matches: MatchResult[] = analysis.recommended_sets.map(
      (set, index) => {
        const matched = set.numbers.filter((n) => winningNumbers.includes(n));
        return {
          recommended_set_index: index,
          strategy_name: set.reason.split("(")[0].trim(),
          recommended_numbers: set.numbers,
          winning_numbers: winningNumbers,
          matched_count: matched.length,
          matched_numbers: matched,
        };
      }
    );

    const maxMatched = Math.max(...matches.map((m) => m.matched_count), 0);
    const bestStrategies = matches.filter((m) => m.matched_count === maxMatched);

    return NextResponse.json({
      success: true,
      analyzedDrawNo: targetDrawNo,
      winningDrawNo: targetDrawNo + 1,
      winningNumbers,
      matches,
      bestMatched: maxMatched,
      bestStrategies,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
