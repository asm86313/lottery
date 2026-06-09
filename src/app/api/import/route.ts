import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { upsertDraws } from "@/lib/lotteryDb";
import { LotteryDraw } from "@/types/lottery";

const DRW_NO_CANDIDATES = ["회차", "No", "no", "drwNo", "draw_no"];
const BONUS_CANDIDATES   = ["보너스", "보너스번호", "bonus", "bnusNo"];

function findIndex(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(
      (h) => h.trim().toLowerCase() === c.trim().toLowerCase()
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * 컬럼 매핑 (위치 기반)
 * - 회차 컬럼을 찾고, 그 다음 6개 컬럼을 번호1~6으로 사용
 * - 보너스 컬럼은 이름으로 탐색
 */
function mapColumns(headers: string[]): {
  drwNoCol: string;
  nosCol: string[];
  bonusCol: string;
} | { error: string } {
  const drwNoIdx = findIndex(headers, DRW_NO_CANDIDATES);
  if (drwNoIdx === -1)
    return { error: `회차 컬럼을 찾을 수 없습니다. 헤더: ${headers.join(", ")}` };

  const bonusIdx = findIndex(headers, BONUS_CANDIDATES);
  if (bonusIdx === -1)
    return { error: `보너스 컬럼을 찾을 수 없습니다. 헤더: ${headers.join(", ")}` };

  // 회차 다음 6개를 번호 컬럼으로 사용
  const nosCol = headers.slice(drwNoIdx + 1, drwNoIdx + 7);
  if (nosCol.length < 6)
    return { error: `번호 컬럼이 6개 미만입니다. 회차(${headers[drwNoIdx]}) 뒤 컬럼: ${nosCol.join(", ")}` };

  return {
    drwNoCol: headers[drwNoIdx],
    nosCol,
    bonusCol: headers[bonusIdx],
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file)
      return NextResponse.json({ success: false, error: "파일이 없습니다." }, { status: 400 });

    const text = await file.text();
    const { data, errors } = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    }) as Papa.ParseResult<Record<string, string>>;

    if (errors.length > 0 && data.length === 0)
      return NextResponse.json({ success: false, error: "CSV 파싱 실패: " + errors[0].message }, { status: 400 });

    if (data.length === 0)
      return NextResponse.json({ success: false, error: "데이터가 없습니다." }, { status: 400 });

    const headers = Object.keys(data[0]);
    const mapped = mapColumns(headers);
    if ("error" in mapped)
      return NextResponse.json({ success: false, error: mapped.error }, { status: 400 });

    const { drwNoCol, nosCol, bonusCol } = mapped;

    // 천단위 쉼표 제거 후 파싱 (예: "1,227" → 1227)
    const toInt = (s: string) => parseInt((s ?? "").replace(/,/g, "").trim());

    const draws: LotteryDraw[] = [];
    for (const row of data) {
      const drwNo = toInt(row[drwNoCol]);
      if (isNaN(drwNo)) continue;

      draws.push({
        drwNo,
        drwtNo1: toInt(row[nosCol[0]]),
        drwtNo2: toInt(row[nosCol[1]]),
        drwtNo3: toInt(row[nosCol[2]]),
        drwtNo4: toInt(row[nosCol[3]]),
        drwtNo5: toInt(row[nosCol[4]]),
        drwtNo6: toInt(row[nosCol[5]]),
        bnusNo:  toInt(row[bonusCol]),
      });
    }

    const valid = draws.filter(
      (d) =>
        !isNaN(d.drwtNo1) && !isNaN(d.drwtNo2) && !isNaN(d.drwtNo3) &&
        !isNaN(d.drwtNo4) && !isNaN(d.drwtNo5) && !isNaN(d.drwtNo6) &&
        !isNaN(d.bnusNo)
    );

    if (valid.length === 0)
      return NextResponse.json({ success: false, error: "유효한 데이터가 없습니다." }, { status: 400 });

    await upsertDraws(valid);

    return NextResponse.json({ success: true, imported: valid.length });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
