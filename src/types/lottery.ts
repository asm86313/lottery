export interface LotteryDraw {
  drwNo: number;
  drwtNo1: number;
  drwtNo2: number;
  drwtNo3: number;
  drwtNo4: number;
  drwtNo5: number;
  drwtNo6: number;
  bnusNo: number;
}

export interface NumberStat {
  number: number;
  count: number;
  frequency: number;   // percentage
  lastAppeared: number; // rounds ago
  lastDrawNo: number;
  gap: number;          // average gap between appearances
  zScore: number;       // chi-square standardized residual (>0 = over-represented)
  emaWeight: number;    // EMA-normalized weight (0~1, sums to 1 across all 45 numbers)
}

export interface AnalysisResult {
  totalDraws: number;
  latestDrawNo: number;
  numberStats: NumberStat[];
  hotNumbers: number[];      // top 10 most frequent in last 50 draws
  coldNumbers: number[];     // least frequent in last 50 draws
  overdueNumbers: number[];  // numbers with longest absence
  recommendedSets: RecommendedSet[];
  recentDraws: LotteryDraw[];
  // 마르코프: 직전 회차 번호 기반 다음 회차 각 번호의 전이 확률 [index=number-1]
  markovNextProbs: number[];
}

export interface RecommendedSet {
  numbers: number[];
  score: number;
  reason: string;
}

export interface SavedAnalysis {
  id: string;
  analyzed_draw_no: number; // 분석 기준 회차
  created_at: string;
  recommended_sets: RecommendedSet[];
}

export interface MatchResult {
  recommended_set_index: number; // 0~9 중 몇 번째 전략
  strategy_name: string;
  recommended_numbers: number[];
  winning_numbers: number[];
  matched_count: number; // 맞춘 개수
  matched_numbers: number[];
}

// ─── 연금복권720+ ─────────────────────────────────────────────────────────────

export interface PensionDraw {
  drwNo: number;
  groupNo: number;   // 조 1~5
  winNumber: string; // 6자리 당첨번호 (예: "123456")
}

export interface PensionDigitStat {
  position: number;  // 1~6 (자릿수)
  digit: number;     // 0~9
  count: number;
  frequency: number; // percentage
  zScore: number;    // chi-square standardized residual (>0 = over-represented)
  emaWeight: number; // EMA-normalized weight (0~1, sums to 1 per position)
}

export interface PensionGroupStat {
  group: number;     // 1~5
  count: number;
  frequency: number; // percentage
}

export interface PensionRecommendedSet {
  groupNo: number;
  number: string;  // 6자리
  reason: string;
  score: number;
}

export interface PensionSavedAnalysis {
  id: string;
  analyzed_draw_no: number;
  created_at: string;
  recommended_sets: PensionRecommendedSet[];
}

export interface PensionMatchResult {
  strategyIndex: number;
  strategyName: string;
  recommendedGroup: number;
  recommendedNumber: string;
  winningGroup: number;
  winningNumber: string;
  groupMatched: boolean;
  digitMatchCount: number;    // 0~6 (자리별 일치 개수)
  suffixMatchCount: number;   // 뒤에서부터 연속 일치 자릿수 (등수 판정용)
  prizeRank: number | null;   // 1~5등 or null
}

export interface PensionAnalysisResult {
  totalDraws: number;
  latestDrawNo: number;
  digitStats: PensionDigitStat[];
  groupStats: PensionGroupStat[];
  recommendations: PensionRecommendedSet[];
  recentDraws: PensionDraw[];
  lastDraw: PensionDraw | null;
  // Markov: P(next digit | last draw's digit) per position [pos][next_digit]
  markovNextProbs: number[][];
}
