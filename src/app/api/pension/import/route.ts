import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { upsertPensionDraws } from "@/lib/pensionDb";
import { PensionDraw } from "@/types/lottery";

const DRW_NO_CANDIDATES = ["회차", "No", "no", "drwNo", "draw_no", "round"];
const GROUP_CANDIDATES = ["조", "group", "group_no", "1등조", "1등(조)"];
const NUMBER_CANDIDATES = ["번호", "number", "win_number", "1등번호", "1등(번호)", "당첨번호"];

function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(
      (h) => h.trim().toLowerCase() === c.trim().toLowerCase()
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

// "1조 123456" 또는 "1 123456" 같은 결합 형식 파싱
function parseCombined(value: string): { group: number; number: string } | null {
  const m = value.trim().match(/^(\d)\s*조?\s*(\d{6})$/);
  if (!m) return null;
  return { group: parseInt(m[1]), number: m[2] };
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
    const drwNoIdx = findCol(headers, DRW_NO_CANDIDATES);
    if (drwNoIdx === -1)
      return NextResponse.json({ success: false, error: `회차 컬럼을 찾을 수 없습니다. 헤더: ${headers.join(", ")}` }, { status: 400 });

    const groupIdx = findCol(headers, GROUP_CANDIDATES);
    const numberIdx = findCol(headers, NUMBER_CANDIDATES);
    const toInt = (s: string) => parseInt((s ?? "").replace(/,/g, "").trim());

    const draws: PensionDraw[] = [];
    for (const row of data) {
      const drwNo = toInt(row[headers[drwNoIdx]]);
      if (isNaN(drwNo)) continue;

      // 조·번호 분리 컬럼이 있을 때
      if (groupIdx !== -1 && numberIdx !== -1) {
        const groupNo = toInt(row[headers[groupIdx]]);
        const winNumber = (row[headers[numberIdx]] ?? "").trim().replace(/\s/g, "").padStart(6, "0");
        if (isNaN(groupNo) || groupNo < 1 || groupNo > 5) continue;
        if (!/^\d{6}$/.test(winNumber)) continue;
        draws.push({ drwNo, groupNo, winNumber });
        continue;
      }

      // 결합 컬럼 시도 (번호 컬럼에서 "1조 123456" 형식)
      if (numberIdx !== -1) {
        const parsed = parseCombined(row[headers[numberIdx]] ?? "");
        if (parsed) {
          draws.push({ drwNo, groupNo: parsed.group, winNumber: parsed.number });
          continue;
        }
      }

      // 헤더 이름 없이 위치로 추론: drwNo 다음 컬럼을 조, 그 다음을 번호로 간주
      const nextGroup = toInt(row[headers[drwNoIdx + 1]]);
      const nextNumber = (row[headers[drwNoIdx + 2]] ?? "").trim().padStart(6, "0");
      if (!isNaN(nextGroup) && nextGroup >= 1 && nextGroup <= 5 && /^\d{6}$/.test(nextNumber)) {
        draws.push({ drwNo, groupNo: nextGroup, winNumber: nextNumber });
      }
    }

    if (draws.length === 0)
      return NextResponse.json({ success: false, error: "유효한 연금복권 데이터가 없습니다. 헤더(조, 번호)를 확인해주세요." }, { status: 400 });

    await upsertPensionDraws(draws);
    return NextResponse.json({ success: true, imported: draws.length });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
