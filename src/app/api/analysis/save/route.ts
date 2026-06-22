import { NextRequest, NextResponse } from "next/server";
import { getDrawsFromDb, saveAnalysis } from "@/lib/lotteryDb";
import { analyzeDraws } from "@/lib/analysis";

export async function POST(req: NextRequest) {
  try {
    const allDraws = await getDrawsFromDb();
    if (allDraws.length === 0) {
      return NextResponse.json(
        { success: false, error: "분석할 데이터가 없습니다" },
        { status: 400 }
      );
    }

    const latestDrawNo = Math.max(...allDraws.map((d) => d.drwNo));
    const analysis = analyzeDraws(allDraws);
    const analysisId = await saveAnalysis(latestDrawNo, analysis.recommendedSets);

    return NextResponse.json({
      success: true,
      analysisId,
      analyzedDrawNo: latestDrawNo,
      recommendedSets: analysis.recommendedSets,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
