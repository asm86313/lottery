import { NextResponse } from "next/server";
import { getPensionDrawsFromDb } from "@/lib/pensionDb";
import { analyzePensionDraws } from "@/lib/pensionAnalysis";

export async function GET() {
  try {
    const draws = await getPensionDrawsFromDb();
    if (draws.length === 0) {
      return NextResponse.json(
        { success: false, error: "연금복권 데이터가 없습니다. CSV를 먼저 업로드하세요." },
        { status: 400 }
      );
    }

    const result = analyzePensionDraws(draws);
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
