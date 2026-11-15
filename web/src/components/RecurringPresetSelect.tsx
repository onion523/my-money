import type { RecurringItem } from '../api/client';
import {
  applyRecurringPreset,
  filterRecurringByType,
  formatRecurringOptionLabel,
  type RecurringPresetApplication,
} from './recurringPreset';

interface RecurringPresetSelectProps {
  id?: string;
  items: RecurringItem[];
  type: 'expense' | 'income';
  selectedId: string;
  currentCategory: string;
  isCategoryManuallyChanged: boolean;
  historyMemo: Map<string, string>;
  onApply: (nextId: string, applied: RecurringPresetApplication | null) => void;
}

export default function RecurringPresetSelect({
  id = 'recurring-preset-select',
  items,
  type,
  selectedId,
  currentCategory,
  isCategoryManuallyChanged,
  historyMemo,
  onApply,
}: RecurringPresetSelectProps) {
  const filtered = filterRecurringByType(items, type);
  if (filtered.length === 0) return null;

  return (
    <div className="input-group">
      <label className="input-label" htmlFor={id}>
        帶入週期{type === 'expense' ? '支出' : '收入'}項目（選填）
      </label>
      <select
        id={id}
        className="input"
        value={selectedId}
        onChange={e => {
          const nextId = e.target.value;
          const matched = filtered.find(item => item.id === nextId);
          const applied = applyRecurringPreset({
            item: matched,
            type,
            currentCategory,
            isCategoryManuallyChanged,
            historyMemo,
          });
          onApply(nextId, applied);
        }}
      >
        <option value="">-- 不套用（手動輸入） --</option>
        {filtered.map(item => (
          <option key={item.id} value={item.id}>
            {formatRecurringOptionLabel(item)}
          </option>
        ))}
      </select>
    </div>
  );
}
