import React from 'react';
import { Home, Lock, FileText, CalendarClock, User, CheckCircle2, HandCoins } from 'lucide-react';
import { Transaction } from '../api/client';
import { formatCurrency, formatDate, formatTxTime } from './utils';
import { CategoryIcon } from './icons';

interface TransactionRowProps {
  tx: Transaction;
  showDate?: boolean;
  actions?: React.ReactNode;
}

export default function TransactionRow({ tx, showDate = false, actions }: TransactionRowProps) {
  const timeStr = formatTxTime(tx.created_at);
  const timePrefix = showDate
    ? `${formatDate(tx.date)}${timeStr ? ` ${timeStr}` : ''} · `
    : `${timeStr ? `${timeStr} · ` : ''}`;

  return (
    <div className="tx-item">
      <div className={`tx-icon ${tx.type}`}>
        <CategoryIcon category={tx.category} size={18} />
      </div>
      <div className="tx-info">
        <div className="tx-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>{tx.category}</span>
          {tx.note && <span className="text-muted" style={{ fontWeight: 400 }}>· {tx.note}</span>}
          {tx.is_shared === 0 ? (
            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.7rem', padding: '1px 6px', gap: 3 }}>
              <Lock size={11} style={{ flexShrink: 0 }} />
              <span>私帳</span>
            </span>
          ) : tx.account_is_joint === 1 ? (
            <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontSize: '0.7rem', padding: '1px 6px', gap: 3 }}>
              <Home size={11} style={{ flexShrink: 0 }} />
              <span>公帳</span>
            </span>
          ) : tx.reimbursement_id ? (
            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.7rem', padding: '1px 6px', gap: 3 }}>
              <CheckCircle2 size={11} style={{ flexShrink: 0 }} />
              <span>公帳 · 已撥款</span>
            </span>
          ) : (
            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontSize: '0.7rem', padding: '1px 6px', gap: 3 }}>
              <HandCoins size={11} style={{ flexShrink: 0 }} />
              <span>公帳 · 待報銷</span>
            </span>
          )}
          {tx.is_billed === 1 && (
            <span className="badge" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', fontSize: '0.7rem', padding: '1px 6px', gap: 3 }}>
              <FileText size={11} style={{ flexShrink: 0 }} />
              <span>已出帳</span>
            </span>
          )}
          {tx.defer_to_next_statement === 1 && tx.is_billed === 0 && (
            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#D97706', fontSize: '0.7rem', padding: '1px 6px', gap: 3 }}>
              <CalendarClock size={11} style={{ flexShrink: 0 }} />
              <span>延至下期</span>
            </span>
          )}
        </div>
        <div className="tx-meta" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
          <span>
            {timePrefix}帳戶：{tx.account_name || '預設帳戶'}
          </span>
          {tx.user_name && (
            <span className="badge badge-safe" style={{ fontSize: '0.7rem', padding: '1px 6px', gap: 3 }}>
              <User size={11} style={{ flexShrink: 0 }} />
              <span>{tx.user_name}</span>
            </span>
          )}
        </div>
      </div>
      <div className="tx-side">
        <div className={`tx-amount ${tx.type}`} style={{ fontSize: '1.05rem', whiteSpace: 'nowrap' }}>
          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
        </div>
        {actions && <div className="tx-actions">{actions}</div>}
      </div>
    </div>
  );
}

