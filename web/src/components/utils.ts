export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
}

export function today(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function thisMonth(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export const CATEGORIES = {
  expense: ['餐飲', '交通', '娛樂', '購物', '生活', '醫療', '教育', '其他'],
  income: ['薪資', '獎金', '投資', '兼職', '其他'],
};

export const CATEGORY_ICONS: Record<string, string> = {
  '餐飲': '🍜',
  '交通': '🚇',
  '娛樂': '🎮',
  '購物': '🛍️',
  '生活': '💡',
  '醫療': '💊',
  '教育': '📚',
  '薪資': '💵',
  '獎金': '🎁',
  '投資': '📈',
  '兼職': '💼',
  '信用卡還款': '💳',
  '其他': '📦',
};

export const CYCLE_LABELS: Record<string, string> = {
  monthly: '每月',
  bimonthly: '每雙月',
  quarterly: '每季',
  semiannual: '每半年',
  annual: '每年',
};

export const ACCOUNT_COLORS = [
  '#FF8A8A', '#FFD4A0', '#A8D8EA', '#95E1D3',
  '#F38181', '#FCE38A', '#EAFFD0', '#C9D6FF'
];

export function formatLocalDate(utcDateStr?: string): string {
  if (!utcDateStr) return '';
  let iso = utcDateStr;
  if (!iso.includes('T') && !iso.endsWith('Z')) {
    iso = iso.replace(' ', 'T') + 'Z';
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return utcDateStr.slice(0, 10);
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
