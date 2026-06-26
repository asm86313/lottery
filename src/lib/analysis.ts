import { LotteryDraw, NumberStat, AnalysisResult, RecommendedSet } from "@/types/lottery";

// ── 공통 유틸 ──────────────────────────────────────────────────────────────────

export function getNumbersFromDraw(draw: LotteryDraw): number[] {
  return [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6];
}

function getZone(n: number): number {
  if (n <= 9) return 0;
  if (n <= 19) return 1;
  if (n <= 29) return 2;
  if (n <= 39) return 3;
  return 4;
}

/**
 * 카이제곱 표준화 잔차 (z-score)
 * z > 0  → 기대값보다 과출현 (over-represented)
 * z < 0  → 기대값보다 미출현 (under-represented)
 * |z| > 1.96 → 95% 신뢰수준 통계적 유의성
 */
function chiSquareZ(count: number, total: number, bins: number): number {
  const expected = (total * 6) / bins; // 로또: 매 회차 6개 뽑음
  return expected > 0 ? (count - expected) / Math.sqrt(expected) : 0;
}

function normalize(arr: number[]): number[] {
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum > 0 ? arr.map((v) => v / sum) : arr.map(() => 1 / arr.length);
}

/**
 * Softmax → 확률분포 변환
 * temp 낮을수록 고득점 집중, 높을수록 균일 (=더 많은 랜덤성)
 */
function softmax(scores: number[], temp = 1.0): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp((s - max) / temp));
  const sum = exps.reduce((a, b) => a + b, 0);
  return sum > 0 ? exps.map((e) => e / sum) : scores.map(() => 1 / scores.length);
}

/**
 * 가중 무작위 추출 (비복원)
 * probs[i] = 번호 (i+1)의 확률 → 6개 샘플 반환
 */
function weightedSample(probs: number[]): number[] {
  const pool = probs.map((p, i) => ({ n: i + 1, p }));
  const result: number[] = [];
  for (let pick = 0; pick < 6 && pool.length > 0; pick++) {
    const total = pool.reduce((s, x) => s + x.p, 0);
    let r = Math.random() * total;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].p;
      if (r <= 0) { result.push(pool.splice(j, 1)[0].n); break; }
    }
  }
  return result;
}

// ── 전략 생성에 필요한 컨텍스트 ───────────────────────────────────────────────

interface HistoricalCtx {
  latestNumbers: number[];    // 직전 회차 당첨번호 (중복 제한용)
  sortedDraws: LotteryDraw[]; // 전체 회차 정렬 데이터 (기간 분석용)
}

function makeSet(numbers: number[], stats: NumberStat[], reason: string): RecommendedSet {
  const score = calcSetScore(numbers, stats);
  const sum = numbers.reduce((a, b) => a + b, 0);
  return { numbers, score, reason: `${reason} (합계 ${sum})` };
}

function calcSetScore(numbers: number[], stats: NumberStat[]): number {
  const total = numbers.reduce((sum, n) => {
    const s = stats.find((x) => x.number === n);
    return sum + (s ? s.frequency : 0);
  }, 0);
  return Math.round((total / numbers.length) * 10) / 10;
}

// ── 메인 분석 ─────────────────────────────────────────────────────────────────

export function analyzeDraws(draws: LotteryDraw[]): AnalysisResult {
  const sorted = [...draws].sort((a, b) => a.drwNo - b.drwNo);
  const total = sorted.length;
  const latestDrawNo = sorted[sorted.length - 1]?.drwNo ?? 0;

  // ── 1. 기본 빈도 집계 ────────────────────────────────────────────────────
  const countMap: Record<number, number> = {};
  const lastSeenMap: Record<number, number> = {};
  const appearanceHistory: Record<number, number[]> = {};
  for (let n = 1; n <= 45; n++) { countMap[n] = 0; lastSeenMap[n] = 0; appearanceHistory[n] = []; }

  sorted.forEach((draw) => {
    const nums = getNumbersFromDraw(draw);
    nums.forEach((n) => {
      countMap[n]++;
      lastSeenMap[n] = draw.drwNo;
      appearanceHistory[n].push(draw.drwNo);
    });
  });

  // ── 2. EMA (α=0.15) ──────────────────────────────────────────────────────
  const ALPHA = 0.15;
  const emaRaw: number[] = Array(46).fill(0);
  sorted.forEach((draw, i) => {
    const w = Math.pow(1 - ALPHA, total - 1 - i);
    getNumbersFromDraw(draw).forEach((n) => { emaRaw[n] += w; });
  });
  const emaSum = emaRaw.reduce((a, b) => a + b, 0);
  const emaWeights = emaRaw.map((v) => (emaSum > 0 ? v / emaSum : 1 / 45));

  // ── 3. 마르코프 전이 행렬 (45×45) ────────────────────────────────────────
  // transCount[i][j] = i가 있는 다음 회차에 j가 나온 횟수 (1-indexed → index i-1)
  const transCount: number[][] = Array.from({ length: 45 }, () => Array(45).fill(0));
  for (let i = 1; i < sorted.length; i++) {
    const prev = getNumbersFromDraw(sorted[i - 1]);
    const curr = getNumbersFromDraw(sorted[i]);
    prev.forEach((p) => curr.forEach((c) => { transCount[p - 1][c - 1]++; }));
  }

  // 마르코프: 직전 회차 번호 기반 다음 번호 확률 분포
  const lastNums = sorted.length > 0 ? getNumbersFromDraw(sorted[sorted.length - 1]) : [];
  const markovRaw = Array(45).fill(0);
  if (lastNums.length > 0) {
    lastNums.forEach((n) => {
      const row = transCount[n - 1];
      const rowSum = row.reduce((a, b) => a + b, 0);
      if (rowSum > 0) {
        row.forEach((c, j) => { markovRaw[j] += c / rowSum; });
      }
    });
  }
  const markovNextProbs = normalize(markovRaw);

  // ── 4. NumberStat 구성 ────────────────────────────────────────────────────
  const recent50 = sorted.slice(-50);
  const recentCount: Record<number, number> = {};
  for (let n = 1; n <= 45; n++) recentCount[n] = 0;
  recent50.forEach((draw) => getNumbersFromDraw(draw).forEach((n) => recentCount[n]++));
  const sortedByRecent = [...Array(45).keys()]
    .map((i) => ({ n: i + 1, c: recentCount[i + 1] }))
    .sort((a, b) => b.c - a.c);
  const hotNumbers = sortedByRecent.slice(0, 10).map((x) => x.n);
  const coldNumbers = sortedByRecent.slice(-10).map((x) => x.n);

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
      frequency: total > 0 ? (count / total) * 100 : 0,
      lastAppeared,
      lastDrawNo,
      gap,
      zScore: chiSquareZ(count, total, 45),
      emaWeight: emaWeights[n],
    };
  });

  const overdueNumbers = [...numberStats]
    .filter((s) => s.gap > 0)
    .sort((a, b) => b.lastAppeared / b.gap - a.lastAppeared / a.gap)
    .slice(0, 10)
    .map((s) => s.number);

  const ctx: HistoricalCtx = {
    latestNumbers: lastNums,
    sortedDraws: sorted,
  };

  // ── 5. 추천 번호 생성 ─────────────────────────────────────────────────────
  const recommendedSets = generateRecommendations(
    numberStats, ctx, markovNextProbs
  );

  return {
    totalDraws: total,
    latestDrawNo,
    numberStats,
    hotNumbers,
    coldNumbers,
    overdueNumbers,
    recommendedSets,
    recentDraws: [...draws].sort((a, b) => b.drwNo - a.drwNo).slice(0, 50),
    markovNextProbs,
  };
}

// ── 15가지 전략 (다른 기간·기준·구조 + 확률적 샘플링으로 매번 다른 결과) ──────
//
// 각 전략은 다른 데이터 윈도우/기준으로 SCORE 배열을 정의하고,
// softmax → 가중 랜덤 추출로 번호를 선택한다.
// → 매 분석마다 통계적으로 유력한 번호 중에서 다른 조합이 출력됨.

function generateRecommendations(
  stats: NumberStat[],
  ctx: HistoricalCtx,
  markovNextProbs: number[]
): RecommendedSet[] {
  const draws = ctx.sortedDraws;

  // ── 핵심 헬퍼 ──────────────────────────────────────────────────────────────

  // scores를 [0,1]로 정규화 후 softmax → 확률적 6개 추출
  // temp 낮을수록 고점수 집중, 높을수록 균일(더 랜덤)
  function spick(
    scores: number[],   // 길이 45, index i = 번호 (i+1)의 점수
    reason: string,
    temp = 1.0
  ): RecommendedSet {
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 1;
    const normalized = scores.map((s) => (s - min) / range);
    const probs = softmax(normalized, temp);

    for (let attempt = 0; attempt < 150; attempt++) {
      const candidate = weightedSample(probs);
      const overlap = candidate.filter((n) => ctx.latestNumbers.includes(n)).length;
      if (overlap > 2) continue;
      if (new Set(candidate.map(getZone)).size < 3) continue;
      return makeSet(candidate.sort((a, b) => a - b), stats, reason);
    }
    // 폴백: 확률 상위 6개 (제약 무시)
    const top6 = probs.map((p, i) => ({ n: i + 1, p }))
      .sort((a, b) => b.p - a.p).slice(0, 6)
      .map((x) => x.n).sort((a, b) => a - b);
    return makeSet(top6, stats, reason);
  }

  // 특정 기간 draws에서 번호별 출현 횟수 계산 (index 1~45)
  function cntInWindow(window: LotteryDraw[]): number[] {
    const cnt = Array(46).fill(0);
    window.forEach((d) => getNumbersFromDraw(d).forEach((n) => { cnt[n]++; }));
    return cnt;
  }

  // scores 배열 생성 헬퍼 (번호 1~45 → index 0~44)
  function sc(fn: (n: number) => number): number[] {
    return Array.from({ length: 45 }, (_, i) => fn(i + 1));
  }

  // ── Group A: 다른 기간 빈도 (데이터 윈도우 다양화) ────────────────────────

  const cntAll = cntInWindow(draws);
  const cnt50  = cntInWindow(draws.slice(-50));
  const cnt20  = cntInWindow(draws.slice(-20));
  const cnt10  = cntInWindow(draws.slice(-10));

  // 전략 1: 전체 빈도 — 역대 전 회차 출현 횟수 가중 추출
  const s1 = spick(sc((n) => cntAll[n]),
    "전체 빈도 기반 — 역대 전 회차 출현 횟수 가중 추출");

  // 전략 2: 최근 50회 빈도 — 최근 50회차 기준 빈도 가중 추출
  const s2 = spick(sc((n) => cnt50[n]),
    "최근 50회 빈도 기반 — 최근 50회차 출현 횟수 가중 추출");

  // 전략 3: 최근 20회 빈도 — 최근 20회차 기준 빈도 가중 추출
  const s3 = spick(sc((n) => cnt20[n]),
    "최근 20회 빈도 기반 — 최근 20회차 출현 횟수 가중 추출");

  // 전략 4: 최근 10회 빈도 — 초단기 트렌드 가중 추출
  const s4 = spick(sc((n) => cnt10[n]),
    "최근 10회 빈도 기반 — 초단기 트렌드 출현 횟수 가중 추출");

  // 전략 5: 최근 5회 미출현 + 전체 빈도 — 소강 후 복귀 압력 가중 추출
  const recent5 = new Set<number>();
  draws.slice(-5).forEach((d) => getNumbersFromDraw(d).forEach((n) => recent5.add(n)));
  const s5 = spick(sc((n) => recent5.has(n) ? 0 : cntAll[n] + 1),
    "최근 5회 미출현 + 전체 빈도 — 소강 후 복귀 압력 가중 추출");

  // ── Group B: 반대·특수 기준 ────────────────────────────────────────────────

  // 전략 6: 역빈도 — 적게 나온 번호에 높은 가중치 (평균 회귀)
  const maxCnt = Math.max(...cntAll.slice(1, 46));
  const s6 = spick(sc((n) => maxCnt - cntAll[n] + 1),
    "역빈도 기반 — 전체 최소 출현 번호 역가중 추출 (평균 회귀)");

  // 전략 7: 최장 미출현 — 마지막 출현 이후 경과 회차 가중 추출
  const s7 = spick(stats.map((s) => s.lastAppeared + 1),
    "최장 미출현 기반 — 마지막 출현 이후 경과 회차 가중 추출");

  // 전략 8: 마르코프 직전 전이 — 직전 회차 기반 전이 확률 가중 추출
  const s8 = spick(markovNextProbs.map((p) => p + 1e-6),
    "마르코프 직전 전이 — 직전 회차 번호 기반 전이 확률 가중 추출");

  // ── Group C: 구조적 가중치 (홀짝·구간·끝자리·동반) ────────────────────────

  // 전략 9: 구간 균형 — 5개 구간에 균등 가중치 + 구간 내 빈도 가중
  const zoneBonus = (n: number) => {
    const z = getZone(n);
    const zoneTotal = Array.from({ length: 45 }, (_, i) => i + 1)
      .filter((m) => getZone(m) === z).reduce((s, m) => s + cntAll[m], 0) || 1;
    return (cntAll[n] / zoneTotal) * (1 / (z + 1) + 1); // 구간별 정규화
  };
  const s9 = spick(sc(zoneBonus), "구간 균형 기반 — 구간별 상대 빈도 가중 추출");

  // 전략 10: 홀수 집중 — 홀수 1.8배 가중 + 전체 빈도
  const s10 = spick(sc((n) => cntAll[n] * (n % 2 !== 0 ? 1.8 : 1.0)),
    "홀수 집중 기반 — 홀수에 1.8배 가중치 부여 추출");

  // 전략 11: 짝수 집중 — 짝수 1.8배 가중 + 전체 빈도
  const s11 = spick(sc((n) => cntAll[n] * (n % 2 === 0 ? 1.8 : 1.0)),
    "짝수 집중 기반 — 짝수에 1.8배 가중치 부여 추출");

  // 전략 12: 끝자리 분산 — 끝자리(unit digit) 희소 그룹에 보너스
  const unitCnt: number[] = Array(10).fill(0);
  for (let n = 1; n <= 45; n++) unitCnt[n % 10] += cntAll[n];
  const s12 = spick(sc((n) => {
    const unitWeight = 1 / (unitCnt[n % 10] + 1);
    return cntAll[n] * unitWeight * 10;
  }), "끝자리 분산 기반 — 희소 끝자리 그룹에 역가중 부여 추출");

  // 전략 13: 역대 동반 출현 — 자주 함께 나온 번호 쌍에서 가중 추출
  const coCount: Record<string, number> = {};
  draws.forEach((draw) => {
    const nums = getNumbersFromDraw(draw);
    for (let i = 0; i < nums.length; i++)
      for (let j = i + 1; j < nums.length; j++) {
        const key = `${Math.min(nums[i], nums[j])}-${Math.max(nums[i], nums[j])}`;
        coCount[key] = (coCount[key] ?? 0) + 1;
      }
  });
  const coScore: number[] = Array(46).fill(0);
  Object.entries(coCount).sort(([, a], [, b]) => b - a).slice(0, 50)
    .forEach(([key, cnt]) => {
      const [a, b] = key.split("-").map(Number);
      coScore[a] += cnt; coScore[b] += cnt;
    });
  const s13 = spick(sc((n) => coScore[n] + 1),
    "역대 동반 출현 기반 — 상위 50쌍 빈도 가중 추출");

  // ── Group D: 투표 조합 (1~13의 결과를 집계) ────────────────────────────────

  const baseSets = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13];
  const votes: number[] = Array(46).fill(0);
  baseSets.forEach((set) => set.numbers.forEach((n) => { votes[n]++; }));

  // 전략 14: 최다 득표 합의 — 13개 전략의 투표 결과 가중 추출
  const s14 = spick(sc((n) => votes[n] + 0.1),
    "최다 득표 합의 기반 — 13개 전략 투표 결과 가중 추출");

  // 전략 15: 역투표 다크호스 — 13개 전략이 외면한 번호 역가중 추출
  const s15 = spick(sc((n) => (1 / (votes[n] + 1)) * (cntAll[n] + 1)),
    "역투표 다크호스 기반 — 외면받은 번호 중 전체 빈도 역가중 추출");

  return [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15];
}

// ── 보정 앙상블 (외부 가중치 기반) ─────────────────────────────────────────────

/**
 * 백테스트로 측정한 전략별 성능 가중치를 받아 3개 보정 세트를 반환
 * weights: 전략 0~14에 대한 성능 가중치 (합=1)
 */
export function generateCalibratedRecommendations(
  baseSets: RecommendedSet[],
  weights: number[],
  stats: NumberStat[]
): RecommendedSet[] {
  const N = baseSets.length;
  const w = weights.length === N ? weights : Array(N).fill(1 / N);

  // 가중 투표 집계 [index = number-1, 값 = 가중 득표]
  const voteW: number[] = Array(45).fill(0);
  baseSets.forEach((set, idx) => {
    set.numbers.forEach((n) => { voteW[n - 1] += w[idx]; });
  });

  const ranked = Array.from({ length: 45 }, (_, i) => i + 1)
    .sort((a, b) => voteW[b - 1] - voteW[a - 1]);

  function pick6(pool: number[]): number[] {
    return pool.slice(0, 6).sort((a, b) => a - b);
  }

  function scoreSet(numbers: number[]): number {
    const total = numbers.reduce((sum, n) => {
      const s = stats.find((x) => x.number === n);
      return sum + (s ? s.frequency : 0);
    }, 0);
    return Math.round((total / 6) * 10) / 10;
  }

  function label(numbers: number[], name: string): RecommendedSet {
    const sum = numbers.reduce((a, b) => a + b, 0);
    return { numbers, score: scoreSet(numbers), reason: `🔬 ${name} (합계 ${sum})` };
  }

  // 보정 세트 1: 가중 투표 순위 상위 6개 (순수 성능 기반)
  const cal1 = pick6(ranked);

  // 보정 세트 2: 최고 성능 전략의 번호를 2배 가중 후 재투표
  const topIdx = w.indexOf(Math.max(...w));
  const topNums = new Set(baseSets[topIdx]?.numbers ?? []);
  const boosted = [...ranked].sort((a, b) => {
    const aScore = voteW[a - 1] + (topNums.has(a) ? Math.max(...w) : 0);
    const bScore = voteW[b - 1] + (topNums.has(b) ? Math.max(...w) : 0);
    return bScore - aScore;
  });
  const cal2 = pick6(boosted);

  // 보정 세트 3: 구간 균형 (1~9, 10~19, 20~29, 30~39, 40~45 고른 분포) + 가중 투표
  const zoneGroups: number[][] = [[], [], [], [], []];
  ranked.forEach((n) => {
    const z = n <= 9 ? 0 : n <= 19 ? 1 : n <= 29 ? 2 : n <= 39 ? 3 : 4;
    zoneGroups[z].push(n);
  });
  const cal3: number[] = [];
  zoneGroups.forEach((g) => { if (g.length > 0) cal3.push(g[0]); });
  ranked.filter((n) => !cal3.includes(n)).forEach((n) => {
    if (cal3.length < 6) cal3.push(n);
  });

  // 보정 세트 4: 성능 제곱 가중치 — 최고 성능 전략에 초집중 (w² 적용)
  const voteW2: number[] = Array(45).fill(0);
  baseSets.forEach((set, idx) => {
    set.numbers.forEach((n) => { voteW2[n - 1] += w[idx] * w[idx]; });
  });
  const ranked2 = Array.from({ length: 45 }, (_, i) => i + 1)
    .sort((a, b) => voteW2[b - 1] - voteW2[a - 1]);
  const cal4 = pick6(ranked2);

  // 보정 세트 5: 홀짝 3:3 균형 + 가중 투표
  // 역대 당첨에서 홀수 3개·짝수 3개가 가장 흔한 조합
  const oddRanked = ranked.filter((n) => n % 2 !== 0);
  const evenRanked = ranked.filter((n) => n % 2 === 0);
  const cal5 = [...oddRanked.slice(0, 3), ...evenRanked.slice(0, 3)]
    .sort((a, b) => a - b);

  return [
    label(cal1,                        "보정 1 — 성능 가중 투표 순위 상위 6개"),
    label(cal2.sort((a, b) => a - b),  "보정 2 — 최고 성능 전략 가중 강화"),
    label(cal3.sort((a, b) => a - b),  "보정 3 — 구간 균형 가중 투표"),
    label(cal4,                        "보정 4 — 성능 제곱 가중치 초집중"),
    label(cal5,                        "보정 5 — 홀짝 3:3 균형 가중 투표"),
  ];
}
