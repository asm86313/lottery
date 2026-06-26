import { NextRequest, NextResponse } from "next/server";
import { getPensionAnalysisByDrawNo, getPensionDrawByNo } from "@/lib/pensionDb";
import { PensionMatchResult } from "@/types/lottery";

/**
 * 등수 판정 (연금복권720+ 기준)
 * 1등: 조 일치 + 6자리 모두 일치
 * 2등: 조 불일치 + 6자리 모두 일치
 * 3등: 뒤 5자리 일치 (앞 1자리 불일치)
 * 4등: 뒤 4자리 일치
 * 5등: 뒤 3자리 일치
 */
function calcPrizeRank(
  rec: string,
  win: string,
  groupMatched: boolean
): { prizeRank: number | null; suffixMatchCount: number; digitMatchCount: number } {
  const recDigits = rec.padStart(6, "0").split("").map(Number);
  const winDigits = win.padStart(6, "0").split("").map(Number);

  const digitMatchCount = recDigits.filter((d, i) => d === winDigits[i]).length;

  // 뒤에서부터 연속 일치 자릿수
  let suffixMatchCount = 0;
  for (let i = 5; i >= 0; i--) {
    if (recDigits[i] === winDigits[i]) suffixMatchCount++;
    else break;
  }

  let prizeRank: number | null = null;
  if (digitMatchCount === 6) {
    prizeRank = groupMatched ? 1 : 2;
  } else if (suffixMatchCount >= 5) {
    prizeRank = 3;
  } else if (suffixMatchCount >= 4) {
    prizeRank = 4;
  } else if (suffixMatchCount >= 3) {
    prizeRank = 5;
  }

  return { prizeRank, suffixMatchCount, digitMatchCount };
}

const STRATEGY_NAMES = [
  "카이제곱 양의 편향",
  "마르코프 전이",
  "지수 이동평균",
  "평균 회귀",
  "앙상블 통합",
];

export async function GET(request: NextRequest) {
  try {
    const drawNo = request.nextUrl.searchParams.get("drawNo");
    if (!drawNo) {
      return NextResponse.json({ success: false, error: "drawNo 파라미터 필수" }, { status: 400 });
    }

    const targetDrawNo = parseInt(drawNo, 10);
    const analysis = await getPensionAnalysisByDrawNo(targetDrawNo);
    if (!analysis) {
      return NextResponse.json(
        { success: false, error: "해당 회차의 분석 결과가 없습니다." },
        { status: 404 }
      );
    }

    const winningDraw = await getPensionDrawByNo(targetDrawNo);

    let matches: PensionMatchResult[] | undefined;
    let bestRank: number | null = null;

    if (winningDraw) {
      matches = analysis.recommended_sets.map((set, idx) => {
        const groupMatched = set.groupNo === winningDraw.groupNo;
        const { prizeRank, suffixMatchCount, digitMatchCount } = calcPrizeRank(
          set.number,
          winningDraw.winNumber,
          groupMatched
        );
        if (prizeRank !== null && (bestRank === null || prizeRank < bestRank)) {
          bestRank = prizeRank;
        }
        return {
          strategyIndex: idx,
          strategyName: STRATEGY_NAMES[idx] ?? set.reason,
          recommendedGroup: set.groupNo,
          recommendedNumber: set.number.padStart(6, "0"),
          winningGroup: winningDraw.groupNo,
          winningNumber: winningDraw.winNumber.padStart(6, "0"),
          groupMatched,
          digitMatchCount,
          suffixMatchCount,
          prizeRank,
        } satisfies PensionMatchResult;
      });
    }

    return NextResponse.json({
      success: true,
      analyzedDrawNo: targetDrawNo,
      recommendedSets: analysis.recommended_sets,
      winningDraw: winningDraw ?? null,
      matches: matches ?? null,
      bestRank,
      hasWinning: !!winningDraw,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
