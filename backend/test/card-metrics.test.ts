import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHarness, FIXED_NOW, type Harness } from './harness';
import { calculateCardCutoffDates, computeCreditCardsReadOnlyMetrics } from '../src/handlers/accounts';

/**
 * ADR 0034 / #179：SQL 聚合版信用卡指標必須與「逐筆載入歷史交易」的原始演算法等價。
 * 此處以原始逐筆演算法（參考實作）為準，比對所有卡片的每個欄位（容許浮點加總順序誤差）。
 */
const SYSTEM = new Set(['信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷']);

async function referenceMetrics(db: D1Database, cards: any[]) {
  const out = new Map<string, Record<string, number>>();
  for (const card of cards) {
    const rows = (await db.prepare(
      'SELECT type, category, amount, date, is_shared, is_billed, defer_to_next_statement, unbilled_offset, reimbursement_id FROM transactions WHERE account_id = ? ORDER BY date DESC, created_at DESC, rowid DESC'
    ).bind(card.id).all()).results as any[];
    const { cutoffStatementDate, prevCutoffStatementDate } = calculateCardCutoffDates(card.statement_day, card.last_rollover_at);
    let uES = 0, uEP = 0, uRS = 0, uRP = 0, uYS = 0, bES = 0, bRS = 0, bYS = 0;
    for (const tx of rows) {
      if (tx.category === '信用卡還款') {
        const amt = Number(tx.amount || 0);
        const off = Math.min(amt, Number(tx.unbilled_offset || 0));
        const billedRepay = Math.max(0, amt - off);
        if (Number(tx.is_shared) === 1) { uYS += off; bYS += billedRepay; }
        continue;
      }
      if (SYSTEM.has(tx.category)) continue;
      let unb = false;
      if (cutoffStatementDate && prevCutoffStatementDate) {
        unb = tx.date > cutoffStatementDate || (tx.date > prevCutoffStatementDate && tx.date <= cutoffStatementDate && Number(tx.defer_to_next_statement) === 1);
      } else {
        unb = Number(tx.is_billed) === 0 || Number(tx.defer_to_next_statement) === 1;
      }
      const reimbursed = Boolean(tx.reimbursement_id && String(tx.reimbursement_id).trim() !== '');
      const shared = Number(tx.is_shared) === 1 && !(tx.type === 'expense' && reimbursed);
      const amt = Number(tx.amount || 0);
      if (unb) {
        if (tx.type === 'expense') { if (shared) uES += amt; else uEP += amt; }
        else if (tx.type === 'income') { if (shared) uRS += amt; else uRP += amt; }
      } else {
        if (tx.type === 'expense') { if (shared) bES += amt; }
        else if (tx.type === 'income') { if (shared) bRS += amt; }
      }
    }
    const newUnbilled = Math.max(0, uES + uEP - (uRS + uRP));
    const bal = Number(card.balance || 0);
    const netUS = Math.max(0, uES - uRS - uYS);
    const unbilled_shared_debt = Math.min(newUnbilled, netUS);
    const unbilled_personal_debt = Math.max(0, newUnbilled - unbilled_shared_debt);
    const netBS = Math.max(0, bES - bRS - bYS);
    const billed_shared_debt = Math.min(bal, netBS);
    const billed_personal_debt = Math.max(0, bal - billed_shared_debt);
    out.set(card.id, {
      balance: bal, unbilled: newUnbilled, billed_shared_debt, billed_personal_debt,
      unbilled_shared_debt, unbilled_personal_debt,
      shared_debt: billed_shared_debt + unbilled_shared_debt,
      personal_debt: billed_personal_debt + unbilled_personal_debt,
    });
  }
  return out;
}

describe('credit card metrics: SQL aggregate equals per-row reference', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness({ bulk: 1500 });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    // 補上帶 unbilled_offset 的還款、已報銷、含空白的 reimbursement_id、延後出帳等邊界資料
    await h.db.batch([
      h.db.prepare("INSERT INTO transactions (id,user_id,account_id,type,category,amount,date,is_shared,unbilled_offset,is_billed,created_at) VALUES ('rp1','u1','a_card1','expense','信用卡還款',3000,'2026-06-10',0,1200,0,'2026-06-10 09:00:00')"),
      h.db.prepare("INSERT INTO transactions (id,user_id,account_id,type,category,amount,date,is_shared,unbilled_offset,is_billed,created_at) VALUES ('rp2','u1','a_cardj','expense','信用卡還款',5000,'2026-06-12',1,5000,0,'2026-06-12 09:00:00')"),
      h.db.prepare("INSERT INTO transactions (id,user_id,account_id,type,category,amount,date,is_shared,unbilled_offset,is_billed,created_at) VALUES ('rp3','u2','a_card2','expense','信用卡還款',700,'2026-05-28',1,100,1,'2026-05-28 09:00:00')"),
      h.db.prepare("INSERT INTO transactions (id,user_id,account_id,type,category,amount,date,is_shared,is_billed,reimbursement_id,created_at) VALUES ('rb1','u1','a_cardj','expense','購物',999.99,'2026-06-01',1,0,'  ','2026-06-01 09:00:00')"),
      h.db.prepare("INSERT INTO transactions (id,user_id,account_id,type,category,amount,date,is_shared,is_billed,reimbursement_id,created_at) VALUES ('rb2','u1','a_cardj','expense','購物',123.45,'2026-06-02',1,1,'adv1','2026-06-02 09:00:00')"),
      h.db.prepare("INSERT INTO transactions (id,user_id,account_id,type,category,amount,date,is_shared,is_billed,defer_to_next_statement,created_at) VALUES ('df1','u1','a_card1','expense','餐飲',321.1,'2026-06-03',0,1,1,'2026-06-03 09:00:00')"),
      h.db.prepare("INSERT INTO transactions (id,user_id,account_id,type,category,amount,date,is_shared,is_billed,created_at) VALUES ('rf1','u1','a_card1','income','購物',250.5,'2026-06-08',1,0,'2026-06-08 09:00:00')"),
    ]);
  });

  afterAll(async () => {
    vi.useRealTimers();
    await h.dispose();
  });

  const variants: Array<[string, (c: any) => any]> = [
    ['as stored', c => c],
    ['no statement_day (is_billed fallback)', c => ({ ...c, statement_day: null })],
    ['with last_rollover_at', c => ({ ...c, last_rollover_at: '2026-06-06 02:00:00' })],
    ['statement_day 31', c => ({ ...c, statement_day: 31 })],
  ];

  for (const [label, tweak] of variants) {
    it(`matches reference (${label})`, async () => {
      const raw = (await h.db.prepare("SELECT * FROM accounts WHERE type = 'credit_card'").all()).results as any[];
      const cards = raw.map(tweak);
      const actual = await computeCreditCardsReadOnlyMetrics(h.db, cards);
      const expected = await referenceMetrics(h.db, cards);
      expect(actual.size).toBe(cards.length);
      for (const card of cards) {
        const a = actual.get(card.id)!;
        const e = expected.get(card.id)!;
        for (const key of Object.keys(e)) {
          expect(a[key as keyof typeof a], `${card.id}.${key}`).toBeCloseTo(e[key], 6);
        }
      }
    });
  }

  it('handles more cards than one query chunk and an empty list', async () => {
    expect((await computeCreditCardsReadOnlyMetrics(h.db, [])).size).toBe(0);
    const raw = (await h.db.prepare("SELECT * FROM accounts WHERE type = 'credit_card'").all()).results as any[];
    const many: any[] = [];
    for (let i = 0; i < 45; i++) many.push(...raw.map(c => ({ ...c })));
    const actual = await computeCreditCardsReadOnlyMetrics(h.db, many);
    const expected = await referenceMetrics(h.db, raw);
    for (const c of raw) expect(actual.get(c.id)!.unbilled).toBeCloseTo(expected.get(c.id)!.unbilled, 6);
  });
});
