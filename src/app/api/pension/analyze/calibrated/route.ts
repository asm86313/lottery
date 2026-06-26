import { NextRequest } from "next/server";
import { getPensionDrawsFromDb, savePensionAnalysis } from "@/lib/pensionDb";
import {
  analyzePensionDraws,
  generateCalibratedPensionRecommendations,
  toPensionDigits,
} from "@/lib/pensionAnalysis";

const STRATEGY_NAMES = [
  "전체 빈도 최빈값",
  "단기 트렌드(최근 N회)",
  "자릿수별 최장 미출현",
  "마르코프 직전 전이",
  "2순위 보완",
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testCount = Math.min(parseInt(searchParams.get("testCount") ?? "10"), 30);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const allDraws = await getPensionDrawsFromDb();
        const sorted = [...allDraws].sort((a, b) => a.drwNo - b.drwNo);

        if (sorted.length < testCount + 10) {
          send({ type: "error", error: `최소 ${testCount + 10}회차 데이터 필요합니다.` });
          controller.close();
          return;
        }

        const testDraws = sorted.slice(-testCount);
        const STRAT_COUNT = 5;
        const matchSums: number[] = Array(STRAT_COUNT).fill(0);
        const matchMatrix: number[][] = [];

        // ── 단계 1: 백테스트 ──────────────────────────────────────────────
        for (let i = 0; i < testCount; i++) {
          const testDraw = testDraws[i];
          send({
            type: "progress",
            message: `📊 ${i + 1}/${testCount} 백테스트 중... (${testDraw.drwNo}회)`,
            step: i + 1,
            total: testCount + 1,
          });

          const training = allDraws.filter((d) => d.drwNo < testDraw.drwNo);
          const analysis = analyzePensionDraws(training);
          const winDigits = toPensionDigits(testDraw.winNumber);

          const drawMatches = analysis.recommendations.map((set) => {
            const recDigits = toPensionDigits(set.number);
            return recDigits.filter((d, pos) => d === winDigits[pos]).length;
          });
          drawMatches.forEach((m, idx) => { matchSums[idx] += m; });
          matchMatrix.push(drawMatches);
        }

        // ── 단계 2: 가중치 계산 ──────────────────────────────────────────
        const avgMatches = matchSums.map((s) => s / testCount);
        const minAvg = Math.min(...avgMatches);
        const shifted = avgMatches.map((v) => Math.max(0, v - minAvg) + 0.1);
        const total = shifted.reduce((a, b) => a + b, 0);
        const weights = shifted.map((v) => v / total);

        const strategyRanking = STRATEGY_NAMES.map((name, idx) => ({
          idx, name, avgMatch: avgMatches[idx], weight: weights[idx],
        })).sort((a, b) => b.avgMatch - a.avgMatch);

        send({
          type: "calibration",
          avgMatches,
          weights,
          strategyRanking,
          matchMatrix,
          testCount,
          baseline: 6 / 10, // 이론 기대값: 각 자리 10% 확률 × 6자리 = 0.6
        });

        // ── 단계 3: 최종 보정 분석 ────────────────────────────────────────
        send({ type: "progress", message: "🔬 보정 가중치로 최종 분석 중...", step: testCount + 1, total: testCount + 1 });

        const finalAnalysis = analyzePensionDraws(allDraws);
        const calibratedSets = generateCalibratedPensionRecommendations(
          finalAnalysis.recommendations,
          weights
        );

        // 예측 대상 회차로 DB 저장
        const predictedDrawNo = finalAnalysis.latestDrawNo + 1;
        await savePensionAnalysis(predictedDrawNo, calibratedSets).catch(() => {});

        send({
          type: "result",
          data: { ...finalAnalysis, recommendations: [...finalAnalysis.recommendations, ...calibratedSets] },
          calibration: { avgMatches, weights, strategyRanking, testCount, baseline: 6 / 10 },
        });
      } catch (e) {
        send({ type: "error", error: String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
