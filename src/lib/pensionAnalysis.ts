import {
  PensionDraw,
  PensionDigitStat,
  PensionGroupStat,
  PensionRecommendedSet,
  PensionAnalysisResult,
} from "@/types/lottery";

// ── 공개 유틸 ──────────────────────────────────────────────────────────────────
export function toPensionDigits(num: string): number[] {
  return num.padStart(6, "0").split("").map(Number);
}

// ── 공통 유틸 ──────────────────────────────────────────────────────────────────

function toDigits(num: string): number[] {
  return num.padStart(6, "0").split("").map(Number);
}

/**
 * 카이제곱 표준화 잔차 (z-score)
 * z > 0  → 기대값보다 많이 출현 (over-represented)
 * z < 0  → 기대값보다 적게 출현 (under-represented)
 * |z| > 1.96 → 95% 신뢰수준에서 통계적 유의성
 */
function chiSquareZ(count: number, total: number, bins: number): number {
  const expected = total / bins;
  return expected > 0 ? (count - expected) / Math.sqrt(expected) : 0;
}

function normalize(arr: number[]): number[] {
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum > 0 ? arr.map((v) => v / sum) : arr.map(() => 1 / arr.length);
}

function softmax(scores: number[], temp = 1.0): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp((s - max) / temp));
  const sum = exps.reduce((a, b) => a + b, 0);
  return sum > 0 ? exps.map((e) => e / sum) : scores.map(() => 1 / scores.length);
}

// 점수 배열 → [0,1] 정규화 → softmax → 가중 랜덤 추출
function stochasticDigit(posScores: number[], temp = 1.0): number {
  const min = Math.min(...posScores);
  const max = Math.max(...posScores);
  const range = max - min || 1;
  const probs = softmax(posScores.map((s) => (s - min) / range), temp);
  let r = Math.random();
  for (let d = 0; d < probs.length; d++) {
    r -= probs[d];
    if (r <= 0) return d;
  }
  return probs.length - 1;
}

function stochasticGroup(groupScores: number[], temp = 1.0): number {
  // groupScores[0] 은 사용 안 함, groupScores[1~5]
  const scores5 = groupScores.slice(1, 6);
  const min = Math.min(...scores5);
  const max = Math.max(...scores5);
  const range = max - min || 1;
  const probs = softmax(scores5.map((s) => (s - min) / range), temp);
  let r = Math.random();
  for (let g = 0; g < probs.length; g++) {
    r -= probs[g];
    if (r <= 0) return g + 1;
  }
  return 5;
}

// ── 핵심 분석 ──────────────────────────────────────────────────────────────────

export function analyzePensionDraws(draws: PensionDraw[]): PensionAnalysisResult {
  const sorted = [...draws].sort((a, b) => a.drwNo - b.drwNo);
  const total = sorted.length;
  const latestDrawNo = sorted[sorted.length - 1]?.drwNo ?? 0;
  const lastDraw = sorted[sorted.length - 1] ?? null;

  // ── 1. 전체 빈도 집계 ─────────────────────────────────────────────────────
  const digitCount: number[][] = Array.from({ length: 6 }, () => Array(10).fill(0));
  const groupCount: number[] = Array(6).fill(0); // index 1-5 사용

  sorted.forEach((draw) => {
    toDigits(draw.winNumber).forEach((d, pos) => { digitCount[pos][d]++; });
    if (draw.groupNo >= 1 && draw.groupNo <= 5) groupCount[draw.groupNo]++;
  });

  // ── 2. 지수 이동평균 (EMA, α=0.15) ───────────────────────────────────────
  // 최근 회차일수록 (1-α)^0 = 1 에 가깝고, 오래된 회차는 지수적으로 감소
  const ALPHA = 0.15;
  const emaRaw: number[][] = Array.from({ length: 6 }, () => Array(10).fill(0));
  const groupEmaRaw: number[] = Array(6).fill(0);

  sorted.forEach((draw, i) => {
    const w = Math.pow(1 - ALPHA, sorted.length - 1 - i);
    toDigits(draw.winNumber).forEach((d, pos) => { emaRaw[pos][d] += w; });
    if (draw.groupNo >= 1 && draw.groupNo <= 5) groupEmaRaw[draw.groupNo] += w;
  });

  // 자릿수별 합계가 1이 되도록 정규화
  const emaWeights: number[][] = emaRaw.map((posRaw) => normalize(posRaw));
  const groupEmaWeights = normalize(groupEmaRaw.slice(1, 6));

  // ── 3. 마르코프 전이 행렬 ─────────────────────────────────────────────────
  // transCount[pos][from_digit][to_digit] = 전이 횟수
  const transCount: number[][][] = Array.from({ length: 6 }, () =>
    Array.from({ length: 10 }, () => Array(10).fill(0))
  );
  const groupTransCount: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0));

  for (let i = 1; i < sorted.length; i++) {
    const prevDigits = toDigits(sorted[i - 1].winNumber);
    const currDigits = toDigits(sorted[i].winNumber);
    prevDigits.forEach((prev, pos) => { transCount[pos][prev][currDigits[pos]]++; });
    const pg = sorted[i - 1].groupNo;
    const cg = sorted[i].groupNo;
    if (pg >= 1 && pg <= 5 && cg >= 1 && cg <= 5) groupTransCount[pg][cg]++;
  }

  // 직전 회차의 각 자리 숫자를 기반으로 다음 숫자 전이 확률 계산
  const lastDigits = lastDraw ? toDigits(lastDraw.winNumber) : Array(6).fill(0);
  const markovNextProbs: number[][] = lastDigits.map((ld, pos) => {
    const row = transCount[pos][ld];
    return normalize(row);
  });

  const lastGroup = lastDraw?.groupNo ?? 1;
  const groupTransRow = groupTransCount[lastGroup] ?? Array(6).fill(0);
  const markovGroupProbs = normalize(groupTransRow.slice(1, 6));

  // ── 4. digitStats 구성 ────────────────────────────────────────────────────
  const digitStats: PensionDigitStat[] = [];
  for (let pos = 0; pos < 6; pos++) {
    for (let digit = 0; digit <= 9; digit++) {
      const count = digitCount[pos][digit];
      digitStats.push({
        position: pos + 1,
        digit,
        count,
        frequency: total > 0 ? (count / total) * 100 : 0,
        zScore: chiSquareZ(count, total, 10),
        emaWeight: emaWeights[pos][digit],
      });
    }
  }

  // ── 5. 조별 통계 ──────────────────────────────────────────────────────────
  const groupStats: PensionGroupStat[] = [];
  for (let g = 1; g <= 5; g++) {
    groupStats.push({
      group: g,
      count: groupCount[g],
      frequency: total > 0 ? (groupCount[g] / total) * 100 : 0,
    });
  }

  // ── 6. 추천 번호 생성 ─────────────────────────────────────────────────────
  const recommendations = generateRecommendations(
    digitCount, groupCount, total, sorted,
    emaWeights, markovNextProbs, markovGroupProbs
  );

  return {
    totalDraws: total,
    latestDrawNo,
    digitStats,
    groupStats,
    recommendations,
    recentDraws: [...sorted].reverse().slice(0, 20),
    lastDraw,
    markovNextProbs,
  };
}

// ── 5가지 추천 전략 (각자 독립적인 기준) ──────────────────────────────────────
//
// 기존 전략들(카이제곱/EMA/평균회귀)은 동일한 빈도 데이터에 가중치만 다르게
// 적용하므로 수렴 문제가 발생. 이를 해결하기 위해 각 전략이 다른 데이터 윈도우
// 또는 완전히 다른 선택 기준을 사용하도록 재설계.

function generateRecommendations(
  digitCount: number[][],
  groupCount: number[],
  total: number,
  sorted: PensionDraw[],
  emaWeights: number[][],
  markovNextProbs: number[][],
  markovGroupProbs: number[]
): PensionRecommendedSet[] {

  function calcScore(number: string): number {
    const digits = toDigits(number);
    const avg = digits.reduce((sum, d, pos) => sum + emaWeights[pos][d], 0) / 6;
    return Math.round(avg * 1000) / 10;
  }

  function make(groupNo: number, number: string, reason: string): PensionRecommendedSet {
    return { groupNo, number: number.padStart(6, "0"), reason, score: calcScore(number) };
  }

  // 확률적 번호 생성: posScores 배열로 각 자리 숫자를 가중 랜덤 추출
  function makeStochastic(
    posScores: number[][],  // [pos][digit 0-9] 점수
    groupScores: number[],  // [group 0-5] (0 인덱스 미사용)
    reason: string
  ): PensionRecommendedSet {
    const number = posScores.map((sc) => stochasticDigit(sc)).join("");
    const groupNo = stochasticGroup(groupScores);
    return make(groupNo, number, reason);
  }

  // ── 데이터 기간별 집계 ────────────────────────────────────────────────────

  const RECENT_N = Math.max(10, Math.min(30, Math.floor(total * 0.2)));
  const recentDraws = sorted.slice(-RECENT_N);
  const rdc: number[][] = Array.from({ length: 6 }, () => Array(10).fill(0));
  const rgc: number[] = Array(6).fill(0);
  recentDraws.forEach((d) => {
    toDigits(d.winNumber).forEach((digit, pos) => { rdc[pos][digit]++; });
    if (d.groupNo >= 1 && d.groupNo <= 5) rgc[d.groupNo]++;
  });

  const lastSeen: number[][] = Array.from({ length: 6 }, () => Array(10).fill(-1));
  sorted.forEach((draw, i) => {
    toDigits(draw.winNumber).forEach((d, pos) => { lastSeen[pos][d] = i; });
  });
  const groupLastSeen: number[] = Array(6).fill(-1);
  sorted.forEach((draw, i) => {
    if (draw.groupNo >= 1 && draw.groupNo <= 5) groupLastSeen[draw.groupNo] = i;
  });

  // ── 전략 1: 전체 빈도 기반 가중 추출 ────────────────────────────────────
  // 역대 전체 데이터 기준 출현 횟수를 가중치로 확률적 추출.
  // 매번 유력 숫자를 선호하되 다른 조합이 나올 수 있음.
  const s1 = makeStochastic(
    digitCount,
    groupCount,
    "전체 빈도 기반 — 역대 각 자리 출현 횟수 가중 추출"
  );

  // ── 전략 2: 최근 N회 단기 트렌드 가중 추출 ──────────────────────────────
  // 전체가 아닌 최근 기간만 집계해 최신 흐름을 반영.
  const s2 = makeStochastic(
    rdc,
    rgc,
    `단기 트렌드(최근 ${RECENT_N}회) — 최근 기간 출현 횟수 가중 추출`
  );

  // ── 전략 3: 최장 미출현 역가중 추출 ─────────────────────────────────────
  // 가장 오래 나오지 않은 숫자에 높은 가중치 (전략 1과 반대 기준).
  const absentScores = lastSeen.map((ls) =>
    ls.map((v) => v === -1 ? total + 1 : total - v)  // 오래 안 나올수록 높은 점수
  );
  const groupAbsent = groupLastSeen.map((v) => v === -1 ? total + 1 : total - v);
  const s3 = makeStochastic(
    absentScores,
    groupAbsent,
    "최장 미출현 역가중 — 각 자리 미출현 기간 역비례 가중 추출"
  );

  // ── 전략 4: 마르코프 직전 전이 확률 가중 추출 ───────────────────────────
  // 직전 회차 숫자 기반 전이 확률 분포로 추출.
  // 직전 회차가 바뀔 때마다 다른 분포가 적용됨.
  const s4 = makeStochastic(
    markovNextProbs,
    markovGroupProbs.map((p) => p * 100),  // 확률 → 점수 스케일
    "마르코프 직전 전이 — 직전 회차 숫자 기반 전이 확률 가중 추출"
  );

  // ── 전략 5: 2순위 우선 가중 추출 ─────────────────────────────────────────
  // 1순위 숫자에 페널티를 줘서 2~3순위 위주로 추출.
  // 전략 1과 차별화된 번호가 나올 확률이 높음.
  const secondaryScores = digitCount.map((pc) => {
    const maxVal = Math.max(...pc);
    // 최빈값(1위)에는 낮은 점수, 나머지에는 원래 점수 유지
    return pc.map((c) => (c === maxVal ? c * 0.2 : c + 0.5));
  });
  const gSecondary = groupCount.map((c, i) => {
    if (i === 0) return 0;
    const maxGc = Math.max(...groupCount.slice(1, 6));
    return c === maxGc ? c * 0.2 : c + 0.5;
  });
  const s5 = makeStochastic(
    secondaryScores,
    gSecondary,
    "2순위 우선 — 1순위 숫자 페널티 부여 후 가중 추출 (전략 1 보완)"
  );

  return [s1, s2, s3, s4, s5];
}

// ── 보정 앙상블 (백테스트 가중치 기반) ────────────────────────────────────────

/**
 * 백테스트로 측정한 전략별 성능 가중치를 받아 5개 보정 세트를 반환
 * weights: 전략 0~4에 대한 성능 가중치 (합=1)
 */
export function generateCalibratedPensionRecommendations(
  baseSets: PensionRecommendedSet[],
  weights: number[]
): PensionRecommendedSet[] {
  const N = baseSets.length;
  const w = weights.length === N ? weights : Array(N).fill(1 / N);

  // 자릿수별 weighted vote [pos][digit]
  const voteMatrix: number[][] = Array.from({ length: 6 }, () => Array(10).fill(0));
  // 조 weighted vote [group 1-5]
  const groupVote: number[] = Array(6).fill(0);

  baseSets.forEach((set, idx) => {
    toDigits(set.number).forEach((d, pos) => { voteMatrix[pos][d] += w[idx]; });
    if (set.groupNo >= 1 && set.groupNo <= 5) groupVote[set.groupNo] += w[idx];
  });

  function argmaxArr(arr: number[]): number {
    return arr.reduce((best, v, i) => (v > arr[best] ? i : best), 0);
  }

  function pickGroup(vote: number[]): number {
    return vote.slice(1).reduce((best, v, i) => (v > vote.slice(1)[best] ? i : best), 0) + 1;
  }

  function makeSet(digitArr: number[], groupNo: number, reason: string): PensionRecommendedSet {
    const number = digitArr.join("");
    const score = Math.round(
      digitArr.reduce((sum, d, pos) => sum + (voteMatrix[pos][d] / w.reduce((a, b) => a + b, 0)) * 100, 0) / 6 * 10
    ) / 10;
    return { groupNo, number, reason: `🔬 ${reason}`, score };
  }

  // 보정 1: 가중 투표 argmax (순수 합의)
  const cal1Digits = voteMatrix.map(argmaxArr);
  const cal1Group = pickGroup(groupVote);

  // 보정 2: 최고 성능 전략 2배 가중 강화
  const topIdx = w.indexOf(Math.max(...w));
  const topW2 = [...w];
  topW2[topIdx] = topW2[topIdx] * 2;
  const tw2Total = topW2.reduce((a, b) => a + b, 0);
  const vm2: number[][] = Array.from({ length: 6 }, () => Array(10).fill(0));
  const gv2: number[] = Array(6).fill(0);
  baseSets.forEach((set, idx) => {
    toDigits(set.number).forEach((d, pos) => { vm2[pos][d] += topW2[idx] / tw2Total; });
    if (set.groupNo >= 1 && set.groupNo <= 5) gv2[set.groupNo] += topW2[idx] / tw2Total;
  });
  const cal2Digits = vm2.map(argmaxArr);
  const cal2Group = pickGroup(gv2);

  // 보정 3: 가중치 제곱 초집중 (w²)
  const wSq = w.map((v) => v * v);
  const wSqTotal = wSq.reduce((a, b) => a + b, 0);
  const vm3: number[][] = Array.from({ length: 6 }, () => Array(10).fill(0));
  const gv3: number[] = Array(6).fill(0);
  baseSets.forEach((set, idx) => {
    toDigits(set.number).forEach((d, pos) => { vm3[pos][d] += wSq[idx] / wSqTotal; });
    if (set.groupNo >= 1 && set.groupNo <= 5) gv3[set.groupNo] += wSq[idx] / wSqTotal;
  });
  const cal3Digits = vm3.map(argmaxArr);
  const cal3Group = pickGroup(gv3);

  // 보정 4: 상위 2개 전략 평균
  const sortedIdx = [...w].map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const top2 = sortedIdx.slice(0, 2).map((x) => x.i);
  const vm4: number[][] = Array.from({ length: 6 }, () => Array(10).fill(0));
  const gv4: number[] = Array(6).fill(0);
  top2.forEach((idx) => {
    toDigits(baseSets[idx].number).forEach((d, pos) => { vm4[pos][d] += 0.5; });
    const g = baseSets[idx].groupNo;
    if (g >= 1 && g <= 5) gv4[g] += 0.5;
  });
  const cal4Digits = vm4.map(argmaxArr);
  const cal4Group = pickGroup(gv4);

  // 보정 5: 각 자리 2위 가중 숫자 혼합 (1위만 아닌 다양성 확보)
  const cal5Digits = voteMatrix.map((posVotes, pos) => {
    const ranked = [...posVotes].map((v, d) => ({ d, v })).sort((a, b) => b.v - a.v);
    // 짝수 자리는 2위, 홀수 자리는 1위
    return pos % 2 === 0 ? ranked[0].d : (ranked[1]?.d ?? ranked[0].d);
  });
  const cal5Group = cal1Group; // 조는 최고 합의 그대로

  return [
    makeSet(cal1Digits, cal1Group, "보정 1 — 자릿수별 가중 투표 argmax"),
    makeSet(cal2Digits, cal2Group, "보정 2 — 최고 성능 전략 2배 가중 강화"),
    makeSet(cal3Digits, cal3Group, "보정 3 — 가중치 제곱 초집중(w²)"),
    makeSet(cal4Digits, cal4Group, "보정 4 — 상위 2개 전략 평균"),
    makeSet(cal5Digits, cal5Group, "보정 5 — 교차 순위 다양성 혼합"),
  ];
}
