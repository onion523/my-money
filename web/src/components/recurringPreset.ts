import type { RecurringItem } from '../api/client';
import { formatCurrency, recommendCategory } from './utils';

export function filterRecurringByType(
  items: RecurringItem[],
  type: 'expense' | 'income'
): RecurringItem[] {
  return items.filter(item => item.type === type);
}

export function formatRecurringOptionLabel(item: RecurringItem): string {
  const scopeTag = item.is_shared === 1 ? '[公帳]' : '[私帳]';
  return `${scopeTag} ${item.name} (${formatCurrency(item.amount)})`;
}

export interface RecurringPresetApplication {
  amount: string;
  note: string;
  category: string;
  recommendationHint: string | null;
}

export function applyRecurringPreset({
  item,
  type,
  currentCategory,
  isCategoryManuallyChanged,
  historyMemo,
}: {
  item: RecurringItem | undefined;
  type: 'expense' | 'income';
  currentCategory: string;
  isCategoryManuallyChanged: boolean;
  historyMemo: Map<string, string>;
}): RecurringPresetApplication | null {
  if (!item) return null;

  let category = currentCategory;
  let recommendationHint: string | null = null;

  if (!isCategoryManuallyChanged) {
    const rec = recommendCategory(item.name, type, historyMemo);
    if (rec) {
      category = rec.category;
      recommendationHint =
        rec.source === 'history'
          ? `依歷史習慣推薦【${rec.category}】`
          : `智慧推薦為【${rec.category}】`;
    }
  }

  return {
    amount: String(item.amount),
    note: item.name,
    category,
    recommendationHint,
  };
}

export function mergeRecurringPresetIntoForm<
  T extends { amount: string; note: string; category: string }
>(form: T, applied: RecurringPresetApplication | null): T {
  if (!applied) return form;
  return {
    ...form,
    amount: applied.amount,
    note: applied.note,
    category: applied.category,
  };
}

export function resetPresetSelectionOnTypeChange<
  T extends { type: 'expense' | 'income'; category: string }
>(
  form: T,
  nextType: 'expense' | 'income',
  setSelectedRecurringId: (id: string) => void
): T {
  setSelectedRecurringId('');
  return {
    ...form,
    type: nextType,
    category: nextType === 'expense' ? '餐飲' : '薪資',
  };
}
