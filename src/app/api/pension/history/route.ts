import { NextRequest, NextResponse } from "next/server";
import { getPensionDrawsFromDb } from "@/lib/pensionDb";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "20");

    const draws = await getPensionDrawsFromDb();
    const recent = [...draws]
      .sort((a, b) => b.drwNo - a.drwNo)
      .slice(0, limit);

    return NextResponse.json({ success: true, data: recent });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
