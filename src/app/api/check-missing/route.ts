import { NextResponse } from "next/server";
import { fetchLatestDrawNo } from "@/lib/lotteryApi";
import { getMaxDrawNo } from "@/lib/lotteryDb";

export async function GET() {
  try {
    const latestDrawNo = fetchLatestDrawNo();
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
