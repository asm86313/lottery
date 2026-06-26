// 연금복권720+: 1회차 = 1999년 10월 마지막 목요일
// 이후 매월 마지막 목요일 추첨
const FIRST_YEAR = 1999;
const FIRST_MONTH = 10; // 1-indexed

/** 해당 연월의 마지막 목요일 날짜 반환 */
function getLastThursdayOfMonth(year: number, month: number): Date {
  const lastDay = new Date(year, month, 0); // 해당 월의 마지막 날
  const dow = lastDay.getDay(); // 0=일, 4=목
  const offset = dow >= 4 ? dow - 4 : dow + 3;
  return new Date(year, month - 1, lastDay.getDate() - offset);
}

/**
 * 현재 기준 예상 최신 연금복권 회차 번호 반환
 * 이번 달 추첨(마지막 목요일)이 아직 지나지 않았으면 전달 기준으로 계산
 */
export function fetchLatestPensionDrawNo(): number {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // 1-indexed

  const drawDate = getLastThursdayOfMonth(year, month);

  // 오늘이 이번 달 추첨일보다 이전이면 지난 달 기준
  if (now < drawDate) {
    month--;
    if (month === 0) {
      month = 12;
      year--;
    }
  }

  return (year - FIRST_YEAR) * 12 + (month - FIRST_MONTH) + 1;
}

/** 회차 번호 → 해당 추첨일(마지막 목요일) 반환 */
export function pensionDrawNoToDate(drawNo: number): Date {
  const totalMonths = drawNo - 1;
  const year = FIRST_YEAR + Math.floor((totalMonths + FIRST_MONTH - 1) / 12);
  const month = ((totalMonths + FIRST_MONTH - 1) % 12) + 1;
  return getLastThursdayOfMonth(year, month);
}
