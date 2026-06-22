import { NextResponse } from "next/server";
import { getDrawsFromDb } from "@/lib/lotteryDb";

export async function GET() {
  try {
    const draws = await getDrawsFromDb();
    return NextResponse.json({
      success: true,
      exists: draws.length > 0,
      count: draws.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
