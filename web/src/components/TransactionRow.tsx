import React from 'react';
import { Transaction } from '../api/client';
import { CATEGORY_ICONS, formatCurrency, formatDate } from './utils';

interface TransactionRowProps {
  tx: Transaction;
  showDate?: boolean;
  actions?: React.ReactNode;
}

export default function TransactionRow({ tx, showDate = false, actions }: TransactionRowProps) {
  return (
    <div className="tx-item">
      <div className={`tx-icon ${tx.type}`}>
        {CATEGORY_ICONS[tx.category] || (tx.type === 'income' ? '💰' : '💸')}
      </div>
      <div className="tx-info">
        <div className="tx-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>{tx.category}</span>
          {tx.note && <span className="text-muted" style={{ fontWeight: 400 }}>· {tx.note}</span>}
          {tx.is_shared === 0 ? (
            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.7rem', padding: '1px 6px' }}>
              🔒 私帳
            </span>
          ) : (
            <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontSize: '0.7rem', padding: '1px 6px' }}>
              🏠 公帳
            </span>
          )}
          {tx.is_billed === 1 && (
            <span className="badge" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', fontSize: '0.7rem', padding: '1px 6px' }}>
              📑 已出帳
            </span>
          )}
          {tx.defer_to_next_statement === 1 && tx.is_billed === 0 && (
            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#D97706', fontSize: '0.7rem', padding: '1px 6px' }}>
              🗓️ 延至下期
            </span>
          )}
        </div>
        <div className="tx-meta" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
          <span>
            {showDate ? `${formatDate(tx.date)} · ` : ''}帳戶：{tx.account_name || '預設帳戶'}
          </span>
          {tx.user_name && (
            <span className="badge badge-safe" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
              👤 {tx.user_name}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-md" style={{ flexShrink: 0 }}>
        <div className={`tx-amount ${tx.type}`} style={{ fontSize: '1.05rem', whiteSpace: 'nowrap' }}>
          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
        </div>
        {actions && <div className="flex gap-xs">{actions}</div>}
      </div>
    </div>
  );
}
