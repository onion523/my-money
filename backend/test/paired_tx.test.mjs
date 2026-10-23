import test from 'node:test';
import assert from 'node:assert/strict';
import { findPairedTransaction, PAIRED_CATEGORIES } from '../src/handlers/transactions.ts';

test('Paired TX Suite - PAIRED_CATEGORIES 定義', () => {
  assert.deepEqual(PAIRED_CATEGORIES, ['信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷']);
});

test('Paired TX Suite - 直接依 pair_tx_id 匹配夥伴交易', async () => {
  const existing = {
    id: 'tx_out_1',
    pair_tx_id: 'tx_in_1',
    category: '內部轉帳',
    type: 'expense',
    amount: 500,
    date: '2026-10-23'
  };

  const db = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('SELECT * FROM transactions WHERE id = ?') && args[0] === 'tx_in_1') {
            return { id: 'tx_in_1', pair_tx_id: 'tx_out_1', category: '內部轉帳', type: 'income', amount: 500, date: '2026-10-23' };
          }
          return null;
        }
      })
    })
  };

  const partner = await findPairedTransaction(db, existing, ['user_1']);
  assert.ok(partner);
  assert.equal(partner.id, 'tx_in_1');
});

test('Paired TX Suite - 反向 lookup (pair_tx_id = existing.id) 並自動自癒', async () => {
  const existing = {
    id: 'tx_out_2',
    pair_tx_id: null,
    category: 'ATM提款',
    type: 'expense',
    amount: 1000,
    date: '2026-10-23'
  };

  let updateCalled = false;
  const db = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('WHERE pair_tx_id = ?') && args[0] === 'tx_out_2') {
            return { id: 'tx_in_2', pair_tx_id: 'tx_out_2', category: 'ATM提款', type: 'income', amount: 1000, date: '2026-10-23' };
          }
          return null;
        },
        run: async () => {
          if (sql.includes('UPDATE transactions SET pair_tx_id = ? WHERE id = ?')) {
            updateCalled = true;
          }
          return { success: true };
        }
      })
    })
  };

  const partner = await findPairedTransaction(db, existing, ['user_1']);
  assert.ok(partner);
  assert.equal(partner.id, 'tx_in_2');
  assert.equal(updateCalled, true, '反向命中時應補寫 pair_tx_id 進行自癒');
});

test('Paired TX Suite - 歷史交易模糊自癒 (Legacy Fallback Matching)', async () => {
  const existing = {
    id: 'tx_legacy_1',
    pair_tx_id: null,
    category: '公帳代墊報銷',
    type: 'expense',
    amount: 2500,
    date: '2026-10-20',
    created_at: '2026-10-20 10:00:00'
  };

  let batchExecuted = false;
  const db = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => null,
        all: async () => {
          if (sql.includes('WHERE user_id IN (?)')) {
            return {
              results: [
                {
                  id: 'tx_legacy_2',
                  pair_tx_id: null,
                  category: '公帳代墊報銷',
                  type: 'income',
                  amount: 2500,
                  date: '2026-10-20',
                  created_at: '2026-10-20 10:00:03'
                }
              ]
            };
          }
          return { results: [] };
        }
      })
    }),
    batch: async (stmts) => {
      batchExecuted = true;
      return [];
    }
  };

  const partner = await findPairedTransaction(db, existing, ['user_1']);
  assert.ok(partner);
  assert.equal(partner.id, 'tx_legacy_2');
  assert.equal(batchExecuted, true, '唯一匹配成功後應 batch 更新雙向 pair_tx_id 自癒');
});

test('Paired TX Suite - 若存在多筆候選無法唯一匹配，不應隨意配對且不自癒', async () => {
  const existing = {
    id: 'tx_ambig_1',
    pair_tx_id: null,
    category: '內部轉帳',
    type: 'expense',
    amount: 300,
    date: '2026-10-20',
    created_at: '2026-10-20 12:00:00'
  };

  const db = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => null,
        all: async () => ({
          results: [
            { id: 'tx_ambig_2', category: '內部轉帳', type: 'income', amount: 300 },
            { id: 'tx_ambig_3', category: '內部轉帳', type: 'income', amount: 300 }
          ]
        })
      })
    }),
    batch: async () => {
      assert.fail('多重候選不應觸發 batch 自癒');
    }
  };

  const partner = await findPairedTransaction(db, existing, ['user_1']);
  assert.equal(partner, null, '無法唯一匹配時應維持 null 保護狀態');
});
