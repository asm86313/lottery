import { NextRequest, NextResponse } from "next/server";
import { getRecentPensionAnalyses } from "@/lib/pensionDb";

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20");
    const data = await getRecentPensionAnalyses(limit);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
