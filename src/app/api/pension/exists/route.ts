import { NextResponse } from "next/server";
import { hasPensionData } from "@/lib/pensionDb";

export async function GET() {
  try {
    const exists = await hasPensionData();
    return NextResponse.json({ success: true, exists });
  } catch (e) {
    return NextResponse.json({ success: false, exists: false, error: String(e) });
  }
}
