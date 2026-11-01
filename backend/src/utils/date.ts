// ADR-0034：Intl.DateTimeFormat 建構成本高，改為模組層單例重用
const TAIPEI_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/**
 * 取得 Asia/Taipei (UTC+8) 時區的日期字串 YYYY-MM-DD
 */
export function getTaipeiDateString(date: Date = new Date()): string {
  return TAIPEI_DATE_FORMATTER.format(date);
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
type ForecastDay = { dateStr: string; year: number; month: number; day: number };
let forecastDaysCache: { key: string; value: ForecastDay[] } | null = null;

export function getTaipeiForecastDays(days = 30): Array<{ dateStr: string; year: number; month: number; day: number }> {
  const now = new Date();
  const taipeiDateStr = getTaipeiDateString(now);
  const cacheKey = `${taipeiDateStr}:${days}`;
  // 同一台北日、同天數之結果相同，同一請求內多次呼叫直接重用（呼叫端皆唯讀使用）
  if (forecastDaysCache && forecastDaysCache.key === cacheKey) return forecastDaysCache.value;

  const result: ForecastDay[] = [];
  const [y, m, d] = taipeiDateStr.split('-').map(Number);

  // 台灣時間中午 12:00:00 (UTC 04:00:00)，避免跨日邊界問題
  const baseEpoch = Date.UTC(y, m - 1, d, 4, 0, 0);

  for (let offset = 0; offset < days; offset++) {
    // 台北固定 UTC+8 (無夏令時間)：台北日期 = (epoch + 8h) 之 UTC 日期，免逐日建構 Intl 格式器
    const taipei = new Date(baseEpoch + offset * 86400000 + 8 * 3600000);
    const year = taipei.getUTCFullYear();
    const month = taipei.getUTCMonth() + 1;
    const day = taipei.getUTCDate();
    result.push({
      dateStr: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      year,
      month,
      day
    });
  }
  forecastDaysCache = { key: cacheKey, value: result };
  return result;
}


/**
 * 將資料庫 UTC 時間字串 (例如 'YYYY-MM-DD HH:mm:ss' 或 ISO 字串) 轉換為 Asia/Taipei (UTC+8) 之 HH:mm 字串
 */
export function formatTaipeiTime(utcDateStr?: string | null): string {
  if (!utcDateStr) return '';
  const trimmed = utcDateStr.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;

  let iso = trimmed;
  if (!iso.includes('T') && !iso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
    iso = iso.replace(' ', 'T') + 'Z';
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';

  // Asia/Taipei 固定為 UTC+8 (無夏令時間)
  const taipeiDate = new Date(d.getTime() + 8 * 3600 * 1000);
  const hh = String(taipeiDate.getUTCHours()).padStart(2, '0');
  const mm = String(taipeiDate.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

