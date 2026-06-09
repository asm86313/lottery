import { LotteryDraw } from "@/types/lottery";

const BASE_URL =
  "https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Referer: "https://www.dhlottery.co.kr/gameInfo.do?method=lotto645",
  Accept: "application/json, text/plain, */*",
};

export async function fetchDraw(drawNo: number): Promise<LotteryDraw | null> {
  try {
    const res = await fetch(`${BASE_URL}${drawNo}`, {
      headers: HEADERS,
      cache: "no-store",
    });
    const data = await res.json();
    if (data.returnValue !== "success") return null;
    return {
      drwNo: data.drwNo,
      drwtNo1: data.drwtNo1,
      drwtNo2: data.drwtNo2,
      drwtNo3: data.drwtNo3,
      drwtNo4: data.drwtNo4,
      drwtNo5: data.drwtNo5,
      drwtNo6: data.drwtNo6,
      bnusNo: data.bnusNo,
    };
  } catch {
    return null;
  }
}

export async function fetchLatestDrawNo(): Promise<number> {
  // 1회 시작일: 2002-12-07 기준으로 현재까지 회차 계산
  const start = new Date("2002-12-07");
  const now = new Date();
  const weeks = Math.floor(
    (now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  return weeks + 1;
}
