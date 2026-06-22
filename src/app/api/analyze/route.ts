import { analyzeDraws } from "@/lib/analysis";
import { getMaxDrawNo, getDrawsFromDb, saveAnalysis } from "@/lib/lotteryDb";
import { fetchLatestDrawNo } from "@/lib/lotteryApi";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({ type: "progress", message: "분석 중..." });

        const draws = await getDrawsFromDb();

        if (draws.length === 0) {
          send({ type: "error", error: "데이터가 없습니다. CSV를 먼저 import해 주세요." });
          controller.close();
          return;
        }

        const result = analyzeDraws(draws);
        const savedInDb = await getMaxDrawNo();
        const latestDrawNo = fetchLatestDrawNo();

        // 분석 결과 저장
        const analysisId = await saveAnalysis(savedInDb, result.recommendedSets);

        send({
          type: "result",
          success: true,
          data: result,
          meta: {
            latestDrawNo,
            savedInDb,
            analyzedCount: draws.length,
            newlyFetched: 0,
            analysisId,
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
