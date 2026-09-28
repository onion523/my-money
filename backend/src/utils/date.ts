/**
 * 取得 Asia/Taipei (UTC+8) 時區的日期字串 YYYY-MM-DD
 */
export function getTaipeiDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * 取得 Asia/Taipei (UTC+8) 時區之年月日結構
 */
export function getTaipeiDate(date: Date = new Date()): { year: number; month: number; day: number; dateStr: string } {
  const dateStr = getTaipeiDateString(date);
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
    day: parseInt(dayStr, 10),
    dateStr
  };
}

/**
 * 取得從台北今天開始往後推 N 天之台北時區日期物件清單
 */
export function getTaipeiForecastDays(days = 30): Array<{ dateStr: string; month: number; day: number }> {
  const result: Array<{ dateStr: string; month: number; day: number }> = [];
  const now = new Date();
  const taipeiDateStr = getTaipeiDateString(now);
  const [y, m, d] = taipeiDateStr.split('-').map(Number);
  
  // 台灣時間中午 12:00:00 (UTC 04:00:00)，避免跨日邊界問題
  const baseEpoch = Date.UTC(y, m - 1, d, 4, 0, 0);

  for (let offset = 0; offset < days; offset++) {
    const curDate = new Date(baseEpoch + offset * 86400000);
    const dateStr = getTaipeiDateString(curDate);
    const parts = dateStr.split('-').map(Number);
    result.push({
      dateStr,
      month: parts[1],
      day: parts[2]
    });
  }
  return result;
}
