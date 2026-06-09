import { NextRequest, NextResponse } from "next/server";
import { fetchDraw, fetchLatestDrawNo } from "@/lib/lotteryApi";
import { analyzeDraws } from "@/lib/analysis";
import { getMaxDrawNo, getDrawsFromDb, upsertDraws } from "@/lib/lotteryDb";

const REQUEST_DELAY_MS = 200;
const DB_FLUSH_INTERVAL = 50;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const skipFetch = searchParams.get("skipFetch") === "true";

  try {
    const latestDrawNo = await fetchLatestDrawNo();
    const maxInDb = await getMaxDrawNo();

    const missingFrom = maxInDb + 1;
    const missingCount = latestDrawNo - maxInDb;

    if (missingCount > 0 && !skipFetch) {
      let buffer: Awaited<ReturnType<typeof fetchDraw>>[] = [];

      for (let drawNo = missingFrom; drawNo <= latestDrawNo; drawNo++) {
        const draw = await fetchDraw(drawNo);
        if (draw) buffer.push(draw);

        if (buffer.length >= DB_FLUSH_INTERVAL || drawNo === latestDrawNo) {
          const valid = buffer.filter(Boolean) as NonNullable<typeof buffer[0]>[];
          if (valid.length > 0) await upsertDraws(valid);
          buffer = [];
        }

        if (drawNo < latestDrawNo) await sleep(REQUEST_DELAY_MS);
      }
    }

    const draws = await getDrawsFromDb();

    if (draws.length === 0) {
      return NextResponse.json(
        { success: false, error: "데이터가 없습니다. CSV를 먼저 import해 주세요." },
        { status: 500 }
      );
    }

    const result = analyzeDraws(draws);

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        latestDrawNo,
        savedInDb: await getMaxDrawNo(),
        analyzedCount: draws.length,
        newlyFetched: missingCount > 0 ? missingCount : 0,
      },
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
