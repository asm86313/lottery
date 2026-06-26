import { NextRequest, NextResponse } from "next/server";
import { upsertPensionDraws } from "@/lib/pensionDb";
import { PensionDraw } from "@/types/lottery";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { drwNo, groupNo, winNumber } = body as PensionDraw;

    if (!drwNo || !groupNo || !winNumber) {
      return NextResponse.json(
        { success: false, error: "drwNo, groupNo, winNumber 필수" },
        { status: 400 }
      );
    }
    if (groupNo < 1 || groupNo > 5) {
      return NextResponse.json(
        { success: false, error: "조는 1~5 사이여야 합니다." },
        { status: 400 }
      );
    }
    if (!/^\d{6}$/.test(winNumber.padStart(6, "0"))) {
      return NextResponse.json(
        { success: false, error: "번호는 6자리 숫자여야 합니다." },
        { status: 400 }
      );
    }

    await upsertPensionDraws([{ drwNo, groupNo, winNumber: winNumber.padStart(6, "0") }]);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
