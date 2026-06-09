import { supabaseAdmin } from "./supabase";
import { LotteryDraw } from "@/types/lottery";

export interface DbRow {
  drw_no: number;
  drwt_no1: number;
  drwt_no2: number;
  drwt_no3: number;
  drwt_no4: number;
  drwt_no5: number;
  drwt_no6: number;
  bnus_no: number;
}

function rowToDraw(row: DbRow): LotteryDraw {
  return {
    drwNo: row.drw_no,
    drwtNo1: row.drwt_no1,
    drwtNo2: row.drwt_no2,
    drwtNo3: row.drwt_no3,
    drwtNo4: row.drwt_no4,
    drwtNo5: row.drwt_no5,
    drwtNo6: row.drwt_no6,
    bnusNo: row.bnus_no,
  };
}

function drawToRow(draw: LotteryDraw): DbRow {
  return {
    drw_no: draw.drwNo,
    drwt_no1: draw.drwtNo1,
    drwt_no2: draw.drwtNo2,
    drwt_no3: draw.drwtNo3,
    drwt_no4: draw.drwtNo4,
    drwt_no5: draw.drwtNo5,
    drwt_no6: draw.drwtNo6,
    bnus_no: draw.bnusNo,
  };
}

/** DB에 저장된 가장 높은 회차 번호 반환. 없으면 0 */
export async function getMaxDrawNo(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("lottery_draws")
    .select("drw_no")
    .order("drw_no", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return 0;
  return data.drw_no;
}

/**
 * DB에서 당첨 데이터 조회
 * @param fromDrawNo 이 회차 이상만 조회 (미지정 시 전체)
 * @param limit 최대 N개 (최신 기준 역순 후 재정렬)
 */
export async function getDrawsFromDb(fromDrawNo?: number): Promise<LotteryDraw[]> {
  // Supabase max_rows 설정(기본 1000)을 우회하기 위해 페이지네이션으로 전체 조회
  const PAGE = 1000;
  const allRows: DbRow[] = [];
  let from = 0;

  while (true) {
    let query = supabaseAdmin
      .from("lottery_draws")
      .select("*")
      .order("drw_no", { ascending: true })
      .range(from, from + PAGE - 1);

    if (fromDrawNo) query = query.lte("drw_no", fromDrawNo);

    const { data, error } = await query;
    if (error || !data || data.length === 0) break;

    allRows.push(...(data as DbRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return allRows.map(rowToDraw);
}

/** 새 회차들을 DB에 upsert */
export async function upsertDraws(draws: LotteryDraw[]): Promise<void> {
  if (draws.length === 0) return;

  // 같은 배치 내 중복 drw_no 제거 (마지막 값 우선)
  const deduped = Array.from(
    new Map(draws.map((d) => [d.drwNo, d])).values()
  );
  const rows = deduped.map(drawToRow);
  // 청크 단위로 insert (Supabase 단건 제한 대비)
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabaseAdmin
      .from("lottery_draws")
      .upsert(chunk, { onConflict: "drw_no" });
    if (error) throw new Error(`DB upsert 실패: ${error.message}`);
  }
}
