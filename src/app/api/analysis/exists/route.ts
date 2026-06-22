import { NextResponse } from "next/server";
import { getRecentAnalyses } from "@/lib/lotteryDb";

export async function GET() {
  try {
    const analyses = await getRecentAnalyses(1);
    return NextResponse.json({
      success: true,
      exists: analyses.length > 0,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
