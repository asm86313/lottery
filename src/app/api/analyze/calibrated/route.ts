import { NextRequest } from "next/server";
import { getDrawsFromDb, saveAnalysis } from "@/lib/lotteryDb";
import {
  analyzeDraws,
  getNumbersFromDraw,
  generateCalibratedRecommendations,
} from "@/lib/analysis";

const STRATEGY_NAMES = [
  "전체 빈도 상위",
  "최근 50회 상위",
  "최근 20회 상위",
  "최근 10회 상위",
  "최근 5회 미출현+복귀",
  "전체 빈도 하위(역빈도)",
  "최장 미출현",
  "마르코프 직전 전이",
  "구간 균형",
  "홀수 집중",
  "짝수 집중",
  "끝자리 분산",
  "역대 동반 출현",
  "최다 득표 합의",
  "역투표 다크호스",
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
        const allDraws = await getDrawsFromDb();
        const sorted = [...allDraws].sort((a, b) => a.drwNo - b.drwNo);

        if (sorted.length < testCount + 30) {
          send({ type: "error", error: `최소 ${testCount + 30}회차 데이터가 필요합니다.` });
          controller.close();
          return;
        }

        const testDraws = sorted.slice(-testCount);
        const STRATEGY_COUNT = 15;
        const matchSums: number[] = Array(STRATEGY_COUNT).fill(0);
        const matchMatrix: number[][] = []; // [testDraw][strategy]

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
          const analysis = analyzeDraws(training);
          const winning = getNumbersFromDraw(testDraw);

          const drawMatches = analysis.recommendedSets.map((set, idx) => {
            const m = set.numbers.filter((n) => winning.includes(n)).length;
            matchSums[idx] += m;
            return m;
          });
          matchMatrix.push(drawMatches);
        }

        // ── 단계 2: 가중치 계산 ──────────────────────────────────────────
        const avgMatches = matchSums.map((s) => s / testCount);

        // min-max shift 후 정규화 (최하 전략도 최소 0.1 가중치 보장)
        const minAvg = Math.min(...avgMatches);
        const shifted = avgMatches.map((v) => Math.max(0, v - minAvg) + 0.1);
        const shiftedTotal = shifted.reduce((a, b) => a + b, 0);
        const weights = shifted.map((v) => v / shiftedTotal);

        // 전략 랭킹
        const strategyRanking = STRATEGY_NAMES.map((name, idx) => ({
          idx,
          name,
          avgMatch: avgMatches[idx],
          weight: weights[idx],
        })).sort((a, b) => b.avgMatch - a.avgMatch);

        send({
          type: "calibration",
          avgMatches,
          weights,
          strategyRanking,
          matchMatrix,
          testCount,
          baseline: (6 * 6) / 45, // 이론 기대값 0.8
        });

        // ── 단계 3: 최종 분석 + 보정 세트 생성 ──────────────────────────
        send({ type: "progress", message: "🔬 보정 가중치로 최종 분석 중...", step: testCount + 1, total: testCount + 1 });

        const finalAnalysis = analyzeDraws(allDraws);
        const calibratedSets = generateCalibratedRecommendations(
          finalAnalysis.recommendedSets,
          weights,
          finalAnalysis.numberStats
        );

        // 보정 세트 5개를 당첨 비교 이력에 저장 (예측 대상 = 최신 회차 + 1)
        const predictedDrawNo = finalAnalysis.latestDrawNo + 1;
        await saveAnalysis(predictedDrawNo, calibratedSets).catch(() => {});

        const allSets = [...finalAnalysis.recommendedSets, ...calibratedSets];

        send({
          type: "result",
          data: { ...finalAnalysis, recommendedSets: allSets },
          calibration: { avgMatches, weights, strategyRanking, testCount, baseline: (6 * 6) / 45 },
        });
      } catch (e) {
        send({ type: "error", error: String(e) });
      } finally {
        controller.close();
      }
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
