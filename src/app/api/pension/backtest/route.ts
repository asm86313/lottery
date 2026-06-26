import { NextRequest, NextResponse } from "next/server";
import { getPensionDrawsFromDb } from "@/lib/pensionDb";
import { analyzePensionDraws, toPensionDigits } from "@/lib/pensionAnalysis";
import { PensionDraw } from "@/types/lottery";

function suffixMatchCount(rec: string, win: string): number {
  const r = rec.padStart(6, "0").split("").map(Number);
  const w = win.padStart(6, "0").split("").map(Number);
  let count = 0;
  for (let i = 5; i >= 0; i--) {
    if (r[i] === w[i]) count++;
    else break;
  }
  return count;
}

function calcPrizeRank(rec: string, win: string, groupMatched: boolean): number | null {
  const r = toPensionDigits(rec);
  const w = toPensionDigits(win);
  const allMatch = r.every((d, i) => d === w[i]);
  if (allMatch) return groupMatched ? 1 : 2;
  const suffix = suffixMatchCount(rec, win);
  if (suffix >= 5) return 3;
  if (suffix >= 4) return 4;
  if (suffix >= 3) return 5;
  return null;
}

const STRATEGY_NAMES = [
  "전체 빈도 최빈값",
  "단기 트렌드(최근 N회)",
  "자릿수별 최장 미출현",
  "마르코프 직전 전이",
  "2순위 보완",
];

export async function GET(request: NextRequest) {
  try {
    const drawNo = parseInt(request.nextUrl.searchParams.get("drawNo") ?? "0");
    if (!drawNo) return NextResponse.json({ success: false, error: "drawNo 파라미터 필수" }, { status: 400 });

    const allDraws = await getPensionDrawsFromDb();
    const target: PensionDraw | undefined = allDraws.find((d) => d.drwNo === drawNo);
    if (!target) return NextResponse.json({ success: false, error: `${drawNo}회 데이터가 DB에 없습니다.` }, { status: 404 });

    const training = allDraws.filter((d) => d.drwNo < drawNo);
    if (training.length === 0) return NextResponse.json({ success: false, error: "학습 데이터 없음" }, { status: 400 });

    const analysis = analyzePensionDraws(training);
    const winDigits = toPensionDigits(target.winNumber);

    const matches = analysis.recommendations.map((set, idx) => {
      const recDigits = toPensionDigits(set.number);
      const digitMatchCount = recDigits.filter((d, i) => d === winDigits[i]).length;
      const groupMatched = set.groupNo === target.groupNo;
      const prizeRank = calcPrizeRank(set.number, target.winNumber, groupMatched);
      return {
        strategyIndex: idx,
        strategyName: STRATEGY_NAMES[idx] ?? set.reason,
        recommendedGroup: set.groupNo,
        recommendedNumber: set.number.padStart(6, "0"),
        winningGroup: target.groupNo,
        winningNumber: target.winNumber.padStart(6, "0"),
        groupMatched,
        digitMatchCount,
        suffixMatchCount: suffixMatchCount(set.number, target.winNumber),
        prizeRank,
      };
    });

    const bestRank = matches
      .filter((m) => m.prizeRank !== null)
      .sort((a, b) => (a.prizeRank ?? 99) - (b.prizeRank ?? 99))[0]?.prizeRank ?? null;

    return NextResponse.json({
      success: true,
      trainedOn: training.length,
      testDrawNo: drawNo,
      winningDraw: target,
      matches,
      bestRank,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
