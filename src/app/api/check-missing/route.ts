import { NextRequest, NextResponse } from "next/server";
import { fetchLatestDrawNo } from "@/lib/lotteryApi";
import { getMaxDrawNo } from "@/lib/lotteryDb";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const untilDraw = searchParams.get("until")
    ? Number(searchParams.get("until"))
    : undefined;

  try {
    const latestDrawNo = untilDraw ?? (await fetchLatestDrawNo());
    const maxInDb = await getMaxDrawNo();

    const missing: number[] = [];
    for (let i = maxInDb + 1; i <= latestDrawNo; i++) {
      missing.push(i);
    }

    return NextResponse.json({
      success: true,
      latestDrawNo,
      storedCount: maxInDb,
      missingDrawNos: missing,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
