import { NextRequest } from "next/server";
import { fetchDraw, fetchLatestDrawNo } from "@/lib/lotteryApi";
import { analyzeDraws } from "@/lib/analysis";
import { getMaxDrawNo, getDrawsFromDb, upsertDraws } from "@/lib/lotteryDb";
import { LotteryDraw } from "@/types/lottery";

const REQUEST_DELAY_MS = 200;
const DB_FLUSH_INTERVAL = 50;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const skipFetch = searchParams.get("skipFetch") === "true";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const latestDrawNo = await fetchLatestDrawNo();
        const maxInDb = await getMaxDrawNo();

        const missingFrom = maxInDb + 1;
        const missingCount = latestDrawNo - maxInDb;

        if (missingCount > 0 && !skipFetch) {
          let buffer: LotteryDraw[] = [];

          for (let drawNo = missingFrom; drawNo <= latestDrawNo; drawNo++) {
            send({ type: "progress", message: `${drawNo}회 데이터 가져오는 중...` });

            const draw = await fetchDraw(drawNo);
            if (draw) {
              const nums = [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6].join(", ");
              const msg = `[${draw.drwNo}회] ${nums} | 보너스 ${draw.bnusNo}`;
              console.log(`[fetch] ${msg}`);
              send({ type: "log", message: msg });
              buffer.push(draw);
            } else {
              const msg = `[${drawNo}회] 동행복권에 없음 (skip)`;
              console.log(`[fetch] ${msg}`);
              send({ type: "log", message: msg });
            }

            if (buffer.length >= DB_FLUSH_INTERVAL || drawNo === latestDrawNo) {
              if (buffer.length > 0) {
                send({ type: "progress", message: `DB에 저장 중... (${buffer[0].drwNo}~${buffer[buffer.length - 1].drwNo}회)` });
                await upsertDraws(buffer);
                const saved = `DB 저장 완료: ${buffer[0].drwNo}~${buffer[buffer.length - 1].drwNo}회 (${buffer.length}개)`;
                console.log(`[db] ${saved}`);
                send({ type: "log", message: saved });
              }
              buffer = [];
            }

            if (drawNo < latestDrawNo) await sleep(REQUEST_DELAY_MS);
          }
        }

        send({ type: "progress", message: "분석 중..." });

        const draws = await getDrawsFromDb();

        if (draws.length === 0) {
          send({ type: "error", error: "데이터가 없습니다. CSV를 먼저 import해 주세요." });
          controller.close();
          return;
        }

        const result = analyzeDraws(draws);
        const savedInDb = await getMaxDrawNo();

        send({
          type: "result",
          success: true,
          data: result,
          meta: {
            latestDrawNo,
            savedInDb,
            analyzedCount: draws.length,
            newlyFetched: missingCount > 0 ? missingCount : 0,
          },
        });
      } catch (error) {
        console.error("Analysis error:", error);
        send({ type: "error", error: String(error) });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
