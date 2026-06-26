import { NextResponse } from "next/server";
import { getPensionDrawsFromDb, savePensionAnalysis } from "@/lib/pensionDb";
import { analyzePensionDraws } from "@/lib/pensionAnalysis";

export async function POST() {
  try {
    const draws = await getPensionDrawsFromDb();
    if (draws.length === 0) {
      return NextResponse.json(
        { success: false, error: "연금복권 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const result = analyzePensionDraws(draws);
    // analyzed_draw_no = 예측 대상 회차 (최신 데이터 회차 + 1)
    const predictedDrawNo = result.latestDrawNo + 1;
    const id = await savePensionAnalysis(predictedDrawNo, result.recommendations);

    return NextResponse.json({
      success: true,
      id,
      analyzedDrawNo: predictedDrawNo,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
