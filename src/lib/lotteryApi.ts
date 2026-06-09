// 1회차: 2002-12-07(토), 이후 매주 토요일
export function fetchLatestDrawNo(): number {
  const start = new Date("2002-12-07");
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
}
