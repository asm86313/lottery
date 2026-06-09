import { LotteryDraw } from "@/types/lottery";

const BASE_URL =
  "https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Referer: "https://www.dhlottery.co.kr/gameInfo.do?method=lotto645",
  Accept: "application/json, text/plain, */*",
};

export type FetchDrawResult =
  | { status: "ok"; draw: LotteryDraw }
  | { status: "not_found" }              // API returnValue !== "success" (실제로 없는 회차)
  | { status: "error"; reason: string }; // 네트워크/파싱 오류

export async function fetchDrawWithStatus(drawNo: number): Promise<FetchDrawResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${drawNo}`, {
      headers: HEADERS,
      cache: "no-store",
    });
  } catch (e) {
    // 실제 네트워크 오류 (DNS 실패, 연결 거부 등) → 재시도 대상
    return { status: "error", reason: e instanceof Error ? e.message : String(e) };
  }

  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    // JSON 파싱 실패 = 동행복권이 HTML 오류페이지 등 반환 → 없는 회차로 처리
    return { status: "not_found" };
  }

  if (data.returnValue !== "success") return { status: "not_found" };
  return {
    status: "ok",
    draw: {
      drwNo: data.drwNo as number,
      drwtNo1: data.drwtNo1 as number,
      drwtNo2: data.drwtNo2 as number,
      drwtNo3: data.drwtNo3 as number,
      drwtNo4: data.drwtNo4 as number,
      drwtNo5: data.drwtNo5 as number,
      drwtNo6: data.drwtNo6 as number,
      bnusNo: data.bnusNo as number,
    },
  };
}

// 네트워크 오류 시 최대 retries 번 재시도, not_found는 즉시 null 반환
export async function fetchDraw(drawNo: number, retries = 2): Promise<LotteryDraw | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await fetchDrawWithStatus(drawNo);
    if (result.status === "ok") return result.draw;
    if (result.status === "not_found") return null;
    if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  return null;
}

export async function fetchLatestDrawNo(): Promise<number> {
  // 날짜 기반 상한 추정 (실제보다 최대 2회 앞설 수 있음)
  const start = new Date("2002-12-07");
  const now = new Date();
  const estimated =
    Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

  // 추정치부터 내려오며 실제로 존재하는 최신 회차 탐색
  for (let no = estimated; no >= estimated - 3; no--) {
    const draw = await fetchDraw(no);
    if (draw) return no;
  }
  return estimated;
}
