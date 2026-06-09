import { NextRequest, NextResponse } from "next/server";
import { upsertDraws } from "@/lib/lotteryDb";
import { LotteryDraw } from "@/types/lottery";

export async function POST(request: NextRequest) {
  try {
    const { draws } = (await request.json()) as { draws: LotteryDraw[] };
    if (!Array.isArray(draws) || draws.length === 0) {
      return NextResponse.json({ success: false, error: "draws 배열이 비어있습니다." }, { status: 400 });
    }
    await upsertDraws(draws);
    return NextResponse.json({ success: true, saved: draws.length });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
