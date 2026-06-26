import { NextResponse } from "next/server";
import { fetchLatestPensionDrawNo } from "@/lib/pensionLotteryApi";
import { getPensionMaxDrawNo } from "@/lib/pensionDb";

export async function GET() {
  try {
    const latestDrawNo = fetchLatestPensionDrawNo();
    const maxInDb = await getPensionMaxDrawNo();

    const missingDrawNos: number[] = [];
    for (let i = maxInDb + 1; i <= latestDrawNo; i++) {
      missingDrawNos.push(i);
    }

    return NextResponse.json({
      success: true,
      latestDrawNo,
      maxInDb,
      missingDrawNos,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
