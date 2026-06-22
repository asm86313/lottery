import { NextResponse } from "next/server";
import { getRecentAnalyses } from "@/lib/lotteryDb";

export async function GET() {
  try {
    const histories = await getRecentAnalyses(20);
    return NextResponse.json({
      success: true,
      data: histories,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
