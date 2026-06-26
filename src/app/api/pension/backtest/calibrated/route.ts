import { NextRequest, NextResponse } from "next/server";
import { getPensionDrawsFromDb } from "@/lib/pensionDb";
import {
  analyzePensionDraws,
  generateCalibratedPensionRecommendations,
  toPensionDigits,
} from "@/lib/pensionAnalysis";

function suffixMatch(rec: string, win: string): number {
  const r = rec.padStart(6, "0").split("").map(Number);
  const w = win.padStart(6, "0").split("").map(Number);
  let cnt = 0;
  for (let i = 5; i >= 0; i--) {
    if (r[i] === w[i]) cnt++;
    else break;
  }
  return cnt;
}

function calcPrizeRank(rec: string, win: string, groupMatched: boolean): number | null {
  const r = toPensionDigits(rec);
  const w = toPensionDigits(win);
  if (r.every((d, i) => d === w[i])) return groupMatched ? 1 : 2;
  const s = suffixMatch(rec, win);
  if (s >= 5) return 3;
  if (s >= 4) return 4;
  if (s >= 3) return 5;
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

    const allDraws = await getPensionDrawsFromDb();
    const target = allDraws.find((d) => d.drwNo === drawNo);
    if (!target) {
      return NextResponse.json({ success: false, error: `${drawNo}회 데이터 없음` }, { status: 404 });
    }

    const training = allDraws.filter((d) => d.drwNo < drawNo)
      .sort((a, b) => a.drwNo - b.drwNo);

    if (training.length < calibrateOn + 5) {
      return NextResponse.json(
        { success: false, error: `최소 ${calibrateOn + 5}회 이전 데이터 필요` },
        { status: 400 }
      );
    }

    // ── 보정 가중치 계산 ───────────────────────────────────────────────────────
    const calibWindow = training.slice(-calibrateOn);
    const STRAT_COUNT = 5;
    const matchSums: number[] = Array(STRAT_COUNT).fill(0);

    for (const calDraw of calibWindow) {
      const calTraining = training.filter((d) => d.drwNo < calDraw.drwNo);
      if (calTraining.length < 5) continue;
      const calAnalysis = analyzePensionDraws(calTraining);
      const winDigits = toPensionDigits(calDraw.winNumber);
      calAnalysis.recommendations.forEach((set, idx) => {
        if (idx < STRAT_COUNT) {
          matchSums[idx] += toPensionDigits(set.number)
            .filter((d, pos) => d === winDigits[pos]).length;
        }
      });
    }

    const avgMatches = matchSums.map((s) => s / calibrateOn);
    const minAvg = Math.min(...avgMatches);
    const shifted = avgMatches.map((v) => Math.max(0, v - minAvg) + 0.1);
    const total = shifted.reduce((a, b) => a + b, 0);
    const weights = shifted.map((v) => v / total);

    // ── 최종 분석 + 보정 세트 생성 ────────────────────────────────────────────
    const finalAnalysis = analyzePensionDraws(training);
    const calibratedSets = generateCalibratedPensionRecommendations(
      finalAnalysis.recommendations,
      weights
    );

    // ── 비교 ──────────────────────────────────────────────────────────────────
    const winDigits = toPensionDigits(target.winNumber);

    const baseMatches = finalAnalysis.recommendations.map((set, idx) => {
      const recDigits = toPensionDigits(set.number);
      const digitMatchCount = recDigits.filter((d, i) => d === winDigits[i]).length;
      const groupMatched = set.groupNo === target.groupNo;
      return {
        type: "base" as const,
        strategyIndex: idx,
        strategyName: set.reason,
        recommendedGroup: set.groupNo,
        recommendedNumber: set.number.padStart(6, "0"),
        digitMatchCount,
        groupMatched,
        prizeRank: calcPrizeRank(set.number, target.winNumber, groupMatched),
      };
    });

    const calMatches = calibratedSets.map((set, idx) => {
      const recDigits = toPensionDigits(set.number);
      const digitMatchCount = recDigits.filter((d, i) => d === winDigits[i]).length;
      const groupMatched = set.groupNo === target.groupNo;
      return {
        type: "calibrated" as const,
        strategyIndex: idx,
        strategyName: set.reason,
        recommendedGroup: set.groupNo,
        recommendedNumber: set.number.padStart(6, "0"),
        digitMatchCount,
        groupMatched,
        prizeRank: calcPrizeRank(set.number, target.winNumber, groupMatched),
      };
    });

    const bestBaseRank = baseMatches.filter((m) => m.prizeRank !== null)
      .sort((a, b) => (a.prizeRank ?? 99) - (b.prizeRank ?? 99))[0]?.prizeRank ?? null;
    const bestCalRank = calMatches.filter((m) => m.prizeRank !== null)
      .sort((a, b) => (a.prizeRank ?? 99) - (b.prizeRank ?? 99))[0]?.prizeRank ?? null;

    return NextResponse.json({
      success: true,
      trainedOn: training.length,
      calibratedOn: calibrateOn,
      testDrawNo: drawNo,
      winningDraw: target,
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
