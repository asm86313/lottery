import { LotteryDraw, NumberStat, AnalysisResult, RecommendedSet } from "@/types/lottery";

export function getNumbersFromDraw(draw: LotteryDraw): number[] {
  return [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6];
}

// 1~45를 5개 구간으로 분류 (1-9, 10-19, 20-29, 30-39, 40-45)
function getZone(n: number): number {
  if (n <= 9) return 0;
  if (n <= 19) return 1;
  if (n <= 29) return 2;
  if (n <= 39) return 3;
  return 4;
}

// 추천 세트 생성 시 참고할 역대 통계 컨텍스트
interface HistoricalContext {
  sumMean: number;
  sumStd: number;
  oddCountDist: Record<number, number>; // 0~6개 홀수 개수별 출현 빈도
  latestNumbers: number[];
  sortedDraws: LotteryDraw[];
  acTargetMin: number; // 역대 AC값 평균 - 1σ
  acTargetMax: number; // 역대 AC값 평균 + 1σ
}

export function analyzeDraws(draws: LotteryDraw[]): AnalysisResult {
  const sorted = [...draws].sort((a, b) => a.drwNo - b.drwNo);
  const latestDrawNo = sorted[sorted.length - 1]?.drwNo ?? 0;
  const totalDraws = sorted.length;

  // 전체 빈도 집계
  const countMap: Record<number, number> = {};
  const lastSeenMap: Record<number, number> = {};
  const appearanceHistory: Record<number, number[]> = {};

  for (let n = 1; n <= 45; n++) {
    countMap[n] = 0;
    lastSeenMap[n] = 0;
    appearanceHistory[n] = [];
  }

  // 합계 / 홀짝 비율 분포 집계
  const sums: number[] = [];
  const oddCountDist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  sorted.forEach((draw) => {
    const numbers = getNumbersFromDraw(draw);
    numbers.forEach((n) => {
      countMap[n]++;
      lastSeenMap[n] = draw.drwNo;
      appearanceHistory[n].push(draw.drwNo);
    });
    sums.push(numbers.reduce((a, b) => a + b, 0));
    const oddCount = numbers.filter((n) => n % 2 !== 0).length;
    oddCountDist[oddCount]++;
  });

  // NumberStat 생성
  const numberStats: NumberStat[] = Array.from({ length: 45 }, (_, i) => {
    const n = i + 1;
    const count = countMap[n];
    const history = appearanceHistory[n];
    const lastDrawNo = lastSeenMap[n];
    const lastAppeared = lastDrawNo > 0 ? latestDrawNo - lastDrawNo : latestDrawNo;

    let gap = 0;
    if (history.length > 1) {
      const gaps = history.slice(1).map((v, idx) => v - history[idx]);
      gap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    }

    return {
      number: n,
      count,
      frequency: totalDraws > 0 ? (count / totalDraws) * 100 : 0,
      lastAppeared,
      lastDrawNo,
      gap,
    };
  });

  // 최근 50회 핫/콜드 번호
  const recent50 = sorted.slice(-50);
  const recentCount: Record<number, number> = {};
  for (let n = 1; n <= 45; n++) recentCount[n] = 0;
  recent50.forEach((draw) => {
    getNumbersFromDraw(draw).forEach((n) => recentCount[n]++);
  });

  const sortedByRecent = Object.entries(recentCount)
    .map(([n, c]) => ({ n: Number(n), c }))
    .sort((a, b) => b.c - a.c);

  const hotNumbers = sortedByRecent.slice(0, 10).map((x) => x.n);
  const coldNumbers = sortedByRecent.slice(-10).map((x) => x.n);

  // 장기 미출현 번호 (gap 대비 현재 공백이 큰 번호)
  const overdueNumbers = [...numberStats]
    .filter((s) => s.gap > 0)
    .sort((a, b) => b.lastAppeared - a.lastAppeared / b.gap - a.lastAppeared / a.gap)
    .slice(0, 10)
    .map((s) => s.number);

  // 역대 합계 평균/표준편차
  const sumMean = sums.reduce((a, b) => a + b, 0) / sums.length;
  const sumVariance = sums.reduce((a, b) => a + (b - sumMean) ** 2, 0) / sums.length;
  const sumStd = Math.sqrt(sumVariance);

  // 역대 AC값 분포 (AC = 번호 간 차이값의 고유 개수 - 5)
  const acValues = sorted.map((draw) => {
    const nums = getNumbersFromDraw(draw);
    const diffs = new Set<number>();
    for (let i = 0; i < nums.length; i++)
      for (let j = i + 1; j < nums.length; j++)
        diffs.add(Math.abs(nums[i] - nums[j]));
    return diffs.size - 5;
  });
  const acMean = acValues.reduce((a, b) => a + b, 0) / acValues.length;
  const acStd = Math.sqrt(acValues.reduce((a, b) => a + (b - acMean) ** 2, 0) / acValues.length);

  const ctx: HistoricalContext = {
    sumMean,
    sumStd,
    oddCountDist,
    latestNumbers: sorted.length > 0 ? getNumbersFromDraw(sorted[sorted.length - 1]) : [],
    sortedDraws: sorted,
    acTargetMin: Math.max(0, Math.round(acMean - acStd)),
    acTargetMax: Math.min(10, Math.round(acMean + acStd)),
  };

  const recommendedSets = generateRecommendations(numberStats, hotNumbers, coldNumbers, overdueNumbers, ctx);

  return {
    totalDraws,
    latestDrawNo,
    numberStats,
    hotNumbers,
    coldNumbers,
    overdueNumbers,
    recommendedSets,
    recentDraws: [...draws].sort((a, b) => b.drwNo - a.drwNo).slice(0, 50),
  };
}

function generateRecommendations(
  stats: NumberStat[],
  hotNumbers: number[],
  coldNumbers: number[],
  overdueNumbers: number[],
  ctx: HistoricalContext
): RecommendedSet[] {
  const sets: RecommendedSet[] = [];
  const SIMS = 500;

  // 복합 점수 계산 (빈도 + 최근성 + 과출현 패널티)
  const scored = stats.map((s) => {
    const freqScore = s.frequency / 100;
    const recencyScore = s.lastAppeared < 5 ? 1.2 : s.lastAppeared < 10 ? 1.0 : s.lastAppeared < 20 ? 0.8 : 0.6;
    const overdueBonus = overdueNumbers.includes(s.number) ? 1.3 : 1.0;
    return {
      number: s.number,
      score: freqScore * recencyScore * overdueBonus,
    };
  }).sort((a, b) => b.score - a.score);

  // 각 전략을 SIMS 회 반복해 가장 많이 뽑힌 6개 번호를 해당 세트의 최종 출력으로 사용

  // 세트 1: 핫번호 위주
  sets.push(runSimulation(() => buildBalancedSet(hotNumbers.slice(0, 10), stats, ctx, ""), "핫번호 중심 추천", stats, SIMS));

  // 세트 2: 복합 점수 상위
  const top20 = scored.slice(0, 20).map((s) => s.number);
  sets.push(runSimulation(() => buildBalancedSet(top20, stats, ctx, ""), "복합 점수 상위 추천", stats, SIMS));

  // 세트 3: 장기 미출현 + 핫번호 혼합
  const mixed = [...new Set([...overdueNumbers.slice(0, 5), ...hotNumbers.slice(0, 5)])];
  sets.push(runSimulation(() => buildBalancedSet(mixed, stats, ctx, ""), "미출현+핫번호 혼합 추천", stats, SIMS));

  // 세트 4: 통계 기반 랜덤
  sets.push(runSimulation(() => buildStatWeightedRandom(stats, ctx, ""), "통계 가중 랜덤 추천", stats, SIMS));

  // 세트 5: 콜드번호 반등 전략
  const coldMixed = [...coldNumbers.slice(0, 3), ...hotNumbers.slice(0, 7)];
  sets.push(runSimulation(() => buildBalancedSet(coldMixed, stats, ctx, ""), "콜드번호 반등 전략", stats, SIMS));

  // 세트 6: 전체 전략 통합 — 모든 전략의 시뮬레이션을 합산해 가장 많이 뽑힌 번호
  sets.push(runSimulation(() => {
    const pick = Math.floor(Math.random() * 5);
    if (pick === 0) return buildBalancedSet(hotNumbers.slice(0, 10), stats, ctx, "");
    if (pick === 1) return buildBalancedSet(top20, stats, ctx, "");
    if (pick === 2) return buildBalancedSet(mixed, stats, ctx, "");
    if (pick === 3) return buildStatWeightedRandom(stats, ctx, "");
    return buildBalancedSet(coldMixed, stats, ctx, "");
  }, "전략 통합 빈출 추천", stats, SIMS * 5));

  // 세트 7: 동반 출현 전략 — 자주 같이 나온 번호 쌍에서 가장 중심적인 번호
  const coPool = getCoOccurrencePool(ctx.sortedDraws);
  sets.push(runSimulation(() => finalizeSet(coPool, stats, ctx, ""), "동반 출현 전략", stats, SIMS));

  // 세트 8: 끝자리 분산 전략 — 6개 번호의 1의 자리가 최대한 겹치지 않는 조합
  const unitPool = getUnitDigitSpreadPool(stats);
  sets.push(runSimulation(
    () => finalizeSet(unitPool, stats, ctx, "", (c) => new Set(c.map((n) => n % 10)).size >= 5),
    "끝자리 분산 전략",
    stats,
    SIMS
  ));

  // 세트 9: AC값 최적화 전략 — 역대 당첨 번호의 AC값 최빈 구간을 타겟
  sets.push(runSimulation(() => buildACOptimizedSet(stats, ctx, ""), "AC값 최적화 전략", stats, SIMS));

  // 세트 10: 단기 트렌드 반전 전략 — 최근 6~20회에 빈출했으나 직전 5회에는 없는 번호
  const trendPool = getTrendReversalPool(ctx.sortedDraws);
  sets.push(runSimulation(() => finalizeSet(trendPool, stats, ctx, ""), "단기 트렌드 반전 전략", stats, SIMS));

  return sets;
}

function buildBalancedSet(candidates: number[], stats: NumberStat[], ctx: HistoricalContext, reason: string): RecommendedSet {
  const pool = [...candidates];
  // 6개 미만이면 stats 기준으로 보충
  const statsSorted = [...stats].sort((a, b) => b.count - a.count);
  let i = 0;
  while (pool.length < 15 && i < statsSorted.length) {
    if (!pool.includes(statsSorted[i].number)) pool.push(statsSorted[i].number);
    i++;
  }

  return finalizeSet(pool, stats, ctx, reason);
}

// 풀에서 6개를 뽑되, 역대 통계 기반 규칙(홀짝 비율/구간 분산/직전회차 중복/합계 범위)을
// 만족할 때까지 재시도. extraCheck로 전략별 추가 조건 전달 가능.
function finalizeSet(
  pool: number[],
  stats: NumberStat[],
  ctx: HistoricalContext,
  reason: string,
  extraCheck?: (c: number[]) => boolean
): RecommendedSet {
  let candidate: number[] = [];

  for (let attempt = 0; attempt < 50; attempt++) {
    const oddTarget = pickOddCountTarget(ctx.oddCountDist);
    candidate = selectWithBalance(pool, 6, oddTarget);

    // 직전 회차와 중복 2개 이하
    const overlap = candidate.filter((n) => ctx.latestNumbers.includes(n)).length;
    if (overlap > 2) continue;

    // 최소 3개 구간 이상 분산
    if (new Set(candidate.map(getZone)).size < 3) continue;

    // 합계가 역대 평균 ±1.5표준편차 범위 내
    const sum = candidate.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - ctx.sumMean) > ctx.sumStd * 1.5) continue;

    // 전략별 추가 조건
    if (extraCheck && !extraCheck(candidate)) continue;

    break;
  }

  const score = calcSetScore(candidate, stats);
  const sum = candidate.reduce((a, b) => a + b, 0);
  return { numbers: candidate.sort((a, b) => a - b), score, reason: `${reason} (합계 ${sum})` };
}

// 역대 홀수 개수 분포를 가중치로 삼아 목표 홀수 개수(0~6) 선택
function pickOddCountTarget(oddCountDist: Record<number, number>): number {
  const entries = Object.entries(oddCountDist).map(([k, v]) => [Number(k), v] as [number, number]);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) return 3;

  let r = Math.random() * total;
  for (const [oddCount, freq] of entries) {
    r -= freq;
    if (r <= 0) return oddCount;
  }
  return 3;
}

function selectWithBalance(pool: number[], count: number, oddCount: number): number[] {
  const odds = pool.filter((n) => n % 2 !== 0);
  const evens = pool.filter((n) => n % 2 === 0);
  const selected: number[] = [];

  const targetOdd = Math.min(oddCount, odds.length);
  const targetEven = count - targetOdd;

  shufflePick(odds, targetOdd).forEach((n) => selected.push(n));
  shufflePick(evens, Math.min(targetEven, evens.length)).forEach((n) => selected.push(n));

  // 부족하면 나머지로 보충
  const remaining = pool.filter((n) => !selected.includes(n));
  while (selected.length < count && remaining.length > 0) {
    selected.push(remaining.shift()!);
  }

  return selected;
}

function shufflePick(arr: number[], count: number): number[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function buildStatWeightedRandom(stats: NumberStat[], ctx: HistoricalContext, reason: string): RecommendedSet {
  const weights = stats.map((s) => ({ n: s.number, w: s.count + 1 }));
  const totalWeight = weights.reduce((sum, x) => sum + x.w, 0);

  let candidate: number[] = [];

  for (let attempt = 0; attempt < 30; attempt++) {
    const selected: number[] = [];
    while (selected.length < 6) {
      let rand = Math.random() * totalWeight;
      for (const { n, w } of weights) {
        rand -= w;
        if (rand <= 0 && !selected.includes(n)) {
          selected.push(n);
          break;
        }
      }
    }

    const overlap = selected.filter((n) => ctx.latestNumbers.includes(n)).length;
    if (overlap > 2) continue;

    if (new Set(selected.map(getZone)).size < 3) continue;

    const sum = selected.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - ctx.sumMean) > ctx.sumStd * 1.5) continue;

    candidate = selected;
    break;
  }

  if (candidate.length === 0) {
    // 폴백: 마지막 시도 결과라도 사용
    candidate = shufflePick(stats.map((s) => s.number), 6);
  }

  const score = calcSetScore(candidate, stats);
  const sum = candidate.reduce((a, b) => a + b, 0);
  return { numbers: candidate.sort((a, b) => a - b), score, reason: `${reason} (합계 ${sum})` };
}

function calcSetScore(numbers: number[], stats: NumberStat[]): number {
  const total = numbers.reduce((sum, n) => {
    const s = stats.find((x) => x.number === n);
    return sum + (s ? s.frequency : 0);
  }, 0);
  return Math.round((total / numbers.length) * 10) / 10;
}

// ── 세트 7: 동반 출현 ──────────────────────────────────────────────────────
// 가장 자주 같이 출현한 상위 30쌍에서 많이 등장하는 번호 상위 15개를 풀로 반환.
function getCoOccurrencePool(draws: LotteryDraw[]): number[] {
  const coCount: Record<string, number> = {};
  draws.forEach((draw) => {
    const nums = getNumbersFromDraw(draw);
    for (let i = 0; i < nums.length; i++)
      for (let j = i + 1; j < nums.length; j++) {
        const a = Math.min(nums[i], nums[j]);
        const b = Math.max(nums[i], nums[j]);
        const key = `${a}-${b}`;
        coCount[key] = (coCount[key] || 0) + 1;
      }
  });
  const topPairs = Object.entries(coCount).sort(([, a], [, b]) => b - a).slice(0, 30);
  const score: Record<number, number> = {};
  topPairs.forEach(([key, cnt]) => {
    const [a, b] = key.split("-").map(Number);
    score[a] = (score[a] || 0) + cnt;
    score[b] = (score[b] || 0) + cnt;
  });
  return Object.entries(score).sort(([, a], [, b]) => b - a).slice(0, 15).map(([n]) => Number(n));
}

// ── 세트 8: 끝자리 분산 ────────────────────────────────────────────────────
// 0~9 각 끝자리 그룹에서 빈도 상위 2개씩 추출해 20개 풀 구성.
function getUnitDigitSpreadPool(stats: NumberStat[]): number[] {
  const byUnit: Record<number, number[]> = {};
  for (let d = 0; d <= 9; d++) byUnit[d] = [];
  [...stats].sort((a, b) => b.count - a.count).forEach((s) => byUnit[s.number % 10].push(s.number));
  const pool: number[] = [];
  for (let d = 0; d <= 9; d++) byUnit[d].slice(0, 2).forEach((n) => pool.push(n));
  return pool;
}

// ── 세트 9: AC값 최적화 ────────────────────────────────────────────────────
// AC = 번호 간 차이값의 고유 개수 - 5. 역대 AC 평균±1σ 범위의 조합을 가중 랜덤으로 생성.
function calcAC(numbers: number[]): number {
  const diffs = new Set<number>();
  for (let i = 0; i < numbers.length; i++)
    for (let j = i + 1; j < numbers.length; j++)
      diffs.add(Math.abs(numbers[i] - numbers[j]));
  return diffs.size - (numbers.length - 1);
}

function buildACOptimizedSet(stats: NumberStat[], ctx: HistoricalContext, reason: string): RecommendedSet {
  const weights = stats.map((s) => ({ n: s.number, w: s.count + 1 }));
  const totalWeight = weights.reduce((sum, x) => sum + x.w, 0);
  let candidate: number[] = [];

  for (let attempt = 0; attempt < 80; attempt++) {
    const selected: number[] = [];
    while (selected.length < 6) {
      let rand = Math.random() * totalWeight;
      for (const { n, w } of weights) {
        rand -= w;
        if (rand <= 0 && !selected.includes(n)) { selected.push(n); break; }
      }
    }
    if (selected.length < 6) continue;
    const overlap = selected.filter((n) => ctx.latestNumbers.includes(n)).length;
    if (overlap > 2) continue;
    if (new Set(selected.map(getZone)).size < 3) continue;
    const sum = selected.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - ctx.sumMean) > ctx.sumStd * 1.5) continue;
    if (calcAC(selected) < ctx.acTargetMin || calcAC(selected) > ctx.acTargetMax) continue;
    candidate = selected;
    break;
  }

  if (candidate.length === 0) candidate = shufflePick(stats.map((s) => s.number), 6);
  const score = calcSetScore(candidate, stats);
  const sum = candidate.reduce((a, b) => a + b, 0);
  return { numbers: candidate.sort((a, b) => a - b), score, reason: `${reason} (합계 ${sum})` };
}

// ── 세트 10: 단기 트렌드 반전 ─────────────────────────────────────────────
// 최근 6~20회에 집중 출현했으나 직전 5회에는 없는 번호 상위 15개를 풀로 반환.
function getTrendReversalPool(draws: LotteryDraw[]): number[] {
  const last5 = new Set<number>();
  draws.slice(-5).forEach((d) => getNumbersFromDraw(d).forEach((n) => last5.add(n)));
  const count6to20: Record<number, number> = {};
  for (let n = 1; n <= 45; n++) count6to20[n] = 0;
  draws.slice(-20, -5).forEach((d) => getNumbersFromDraw(d).forEach((n) => count6to20[n]++));
  return Object.entries(count6to20)
    .filter(([n, c]) => !last5.has(Number(n)) && c > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([n]) => Number(n));
}

// 전략 함수를 iterations 회 반복해 가장 많이 뽑힌 6개 번호를 최종 출력으로 반환한다.
function runSimulation(
  generate: () => RecommendedSet,
  reason: string,
  stats: NumberStat[],
  iterations: number
): RecommendedSet {
  const freq: Record<number, number> = {};
  for (let n = 1; n <= 45; n++) freq[n] = 0;

  for (let i = 0; i < iterations; i++) {
    generate().numbers.forEach((n) => freq[n]++);
  }

  const result = Object.entries(freq)
    .map(([n, c]) => ({ n: Number(n), c }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 6)
    .map((x) => x.n)
    .sort((a, b) => a - b);

  const score = calcSetScore(result, stats);
  const sum = result.reduce((a, b) => a + b, 0);
  return { numbers: result, score, reason: `${reason} (합계 ${sum})` };
}
