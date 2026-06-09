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
  frequency: number; // percentage
  lastAppeared: number; // rounds ago
  lastDrawNo: number;
  gap: number; // average gap between appearances
}

export interface AnalysisResult {
  totalDraws: number;
  latestDrawNo: number;
  numberStats: NumberStat[];
  hotNumbers: number[]; // top 10 most frequent in last 50 draws
  coldNumbers: number[]; // least frequent in last 50 draws
  overdueNumbers: number[]; // numbers with longest absence
  recommendedSets: RecommendedSet[];
  recentDraws: LotteryDraw[];
}

export interface RecommendedSet {
  numbers: number[];
  score: number;
  reason: string;
}
