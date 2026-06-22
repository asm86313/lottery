import { NextRequest, NextResponse } from "next/server";
import { getDrawsFromDb } from "@/lib/lotteryDb";

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
    const draws = await getDrawsFromDb();
    const draw = draws.find((d) => d.drwNo === targetDrawNo);

    if (!draw) {
      return NextResponse.json(
        { success: false, error: `${targetDrawNo}회차 데이터가 없습니다` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: draw,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
