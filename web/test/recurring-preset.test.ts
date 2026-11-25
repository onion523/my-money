import { describe, expect, it } from 'vitest';
import type { RecurringItem } from '../src/api/client';
import {
  applyRecurringPreset,
  filterRecurringByType,
  formatRecurringOptionLabel,
  mergeRecurringPresetIntoForm,
  resetPresetSelectionOnTypeChange,
} from '../src/components/recurringPreset';

const makeRecurring = (overrides: Partial<RecurringItem> = {}): RecurringItem => ({
  id: 'rec-1',
  user_id: 'user-1',
  account_id: 'acc-1',
  name: '房租',
  type: 'expense',
  amount: 20000,
  cycle: 'monthly',
  day_of_cycle: 5,
  is_shared: 1,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('recurringPreset helpers', () => {
  it('filters recurring items by current transaction type', () => {
    const items = [
      makeRecurring({ id: 'e1', type: 'expense', name: '房租' }),
      makeRecurring({ id: 'i1', type: 'income', name: '薪資' }),
      makeRecurring({ id: 'e2', type: 'expense', name: 'Netflix' }),
    ];

    expect(filterRecurringByType(items, 'expense').map(i => i.id)).toEqual(['e1', 'e2']);
    expect(filterRecurringByType(items, 'income').map(i => i.id)).toEqual(['i1']);
  });

  it('formats option label with [公帳] or [私帳] prefix and formatted amount (including weekly cycle items)', () => {
    const sharedItem = makeRecurring({ name: '房租', amount: 20000, is_shared: 1 });
    const personalItem = makeRecurring({ name: 'Netflix', amount: 390, is_shared: 0 });
    const weeklyItem = makeRecurring({ name: '每週教練課', amount: 500, cycle: 'weekly', day_of_cycle: 3, is_shared: 0 });

    expect(formatRecurringOptionLabel(sharedItem)).toBe('[公帳] 房租 ($20,000)');
    expect(formatRecurringOptionLabel(personalItem)).toBe('[私帳] Netflix ($390)');
    expect(formatRecurringOptionLabel(weeklyItem)).toBe('[私帳] 每週教練課 ($500)');
  });

  it('returns null when no recurring item is selected (empty option)', () => {
    const result = applyRecurringPreset({
      item: undefined,
      type: 'expense',
      currentCategory: '餐飲',
      isCategoryManuallyChanged: false,
      historyMemo: new Map(),
    });

    expect(result).toBeNull();
  });

  it('applies amount and note from recurring item and recommends category when not manually changed', () => {
    const item = makeRecurring({ name: 'Netflix 訂閱', amount: 390, is_shared: 0, account_id: 'acc-card' });

    const result = applyRecurringPreset({
      item,
      type: 'expense',
      currentCategory: '餐飲',
      isCategoryManuallyChanged: false,
      historyMemo: new Map([['Netflix 訂閱', '娛樂']]),
    });

    expect(result).toEqual({
      amount: '390',
      note: 'Netflix 訂閱',
      category: '娛樂',
      recommendationHint: '依歷史習慣推薦【娛樂】',
    });
  });

  it('preserves manually changed category when applying recurring preset', () => {
    const item = makeRecurring({ name: 'Netflix 訂閱', amount: 390 });

    const result = applyRecurringPreset({
      item,
      type: 'expense',
      currentCategory: '其他支出',
      isCategoryManuallyChanged: true,
      historyMemo: new Map([['Netflix 訂閱', '娛樂']]),
    });

    expect(result).toEqual({
      amount: '390',
      note: 'Netflix 訂閱',
      category: '其他支出',
      recommendationHint: null,
    });
  });

  it('merges preset into form while strictly preserving account_id and is_shared', () => {
    const baseForm = {
      account_id: '',
      type: 'expense' as const,
      category: '餐飲',
      amount: '100',
      note: '舊備註',
      is_shared: 0,
    };

    const updated = mergeRecurringPresetIntoForm(baseForm, {
      amount: '20000',
      note: '房租',
      category: '居住',
      recommendationHint: null,
    });

    expect(updated).toEqual({
      account_id: '',
      type: 'expense',
      category: '居住',
      amount: '20000',
      note: '房租',
      is_shared: 0,
    });

    // Clearing selection (null) preserves existing amount and note
    expect(mergeRecurringPresetIntoForm(updated, null)).toEqual(updated);
  });

  it('resets selected recurring preset id when switching transaction type', () => {
    let selectedId = 'rec-1';
    const next = resetPresetSelectionOnTypeChange(
      { type: 'expense' as const, category: '居住', amount: '20000', note: '房租' },
      'income',
      id => { selectedId = id; }
    );

    expect(selectedId).toBe('');
    expect(next).toEqual({
      type: 'income',
      category: '薪資',
      amount: '20000',
      note: '房租',
    });
  });
});
