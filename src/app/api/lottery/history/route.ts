import { NextRequest, NextResponse } from "next/server";
import { getDrawsFromDb } from "@/lib/lotteryDb";

export async function GET(req: NextRequest) {
  try {
    const limit = req.nextUrl.searchParams.get("limit")
      ? parseInt(req.nextUrl.searchParams.get("limit")!, 10)
      : 100;

    const draws = await getDrawsFromDb();
    const sorted = [...draws].sort((a, b) => b.drwNo - a.drwNo).slice(0, limit);

    return NextResponse.json({
      success: true,
      data: sorted,
      totalCount: draws.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
