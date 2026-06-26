import { supabaseAdmin } from "./supabase";
import { PensionDraw, PensionRecommendedSet, PensionSavedAnalysis } from "@/types/lottery";

interface PensionDbRow {
  drw_no: number;
  group_no: number;
  win_number: string;
}

function rowToDraw(row: PensionDbRow): PensionDraw {
  return {
    drwNo: row.drw_no,
    groupNo: row.group_no,
    winNumber: row.win_number,
  };
}

export async function getPensionMaxDrawNo(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("pension_draws")
    .select("drw_no")
    .order("drw_no", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return 0;
  return data.drw_no;
}

export async function getPensionDrawsFromDb(): Promise<PensionDraw[]> {
  const PAGE = 1000;
  const allRows: PensionDbRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("pension_draws")
      .select("*")
      .order("drw_no", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error || !data || data.length === 0) break;
    allRows.push(...(data as PensionDbRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return allRows.map(rowToDraw);
}

export async function upsertPensionDraws(draws: PensionDraw[]): Promise<void> {
  if (draws.length === 0) return;

  const deduped = Array.from(new Map(draws.map((d) => [d.drwNo, d])).values());
  const rows: PensionDbRow[] = deduped.map((d) => ({
    drw_no: d.drwNo,
    group_no: d.groupNo,
    win_number: d.winNumber,
  }));

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabaseAdmin
      .from("pension_draws")
      .upsert(chunk, { onConflict: "drw_no" });
    if (error) throw new Error(`연금복권 DB upsert 실패: ${error.message}`);
  }
}

export async function hasPensionData(): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from("pension_draws")
    .select("drw_no", { count: "exact", head: true });

  if (error) return false;
  return (count ?? 0) > 0;
}

// ── 분석 결과 저장/조회 ───────────────────────────────────────────────────────

export async function savePensionAnalysis(
  analyzedDrawNo: number,
  recommendedSets: PensionRecommendedSet[]
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("pension_analysis_results")
    .insert({ analyzed_draw_no: analyzedDrawNo, recommended_sets: recommendedSets })
    .select("id")
    .single();

  if (error) throw new Error(`연금복권 분석 저장 실패: ${error.message}`);
  return data?.id ?? "";
}

export async function getRecentPensionAnalyses(limit = 20): Promise<PensionSavedAnalysis[]> {
  const { data, error } = await supabaseAdmin
    .from("pension_analysis_results")
    .select("id, analyzed_draw_no, created_at, recommended_sets")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    analyzed_draw_no: row.analyzed_draw_no,
    created_at: row.created_at,
    recommended_sets: row.recommended_sets,
  }));
}

export async function getPensionAnalysisByDrawNo(
  drawNo: number
): Promise<PensionSavedAnalysis | null> {
  const { data, error } = await supabaseAdmin
    .from("pension_analysis_results")
    .select("id, analyzed_draw_no, created_at, recommended_sets")
    .eq("analyzed_draw_no", drawNo)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    analyzed_draw_no: data.analyzed_draw_no,
    created_at: data.created_at,
    recommended_sets: data.recommended_sets,
  };
}

/** 특정 회차 당첨 번호 조회 (비교용) */
export async function getPensionDrawByNo(drawNo: number): Promise<PensionDraw | null> {
  const { data, error } = await supabaseAdmin
    .from("pension_draws")
    .select("*")
    .eq("drw_no", drawNo)
    .single();

  if (error || !data) return null;
  return rowToDraw(data as PensionDbRow);
}
