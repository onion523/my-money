import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';
import app from '../src/index';
import { createJWT } from '../src/middleware/jwt';
import { ensureAccountsSchema } from '../src/handlers/accounts';

/** 固定「現在」時間（台北 2026-06-15 12:00），讓預測與統計結果可重現 */
export const FIXED_NOW = new Date('2026-06-15T04:00:00Z');

export const USER1 = 'u1';
export const USER2 = 'u2';

export interface Harness {
  db: D1Database;
  env: { DB: D1Database; JWT_SECRET?: string };
  tokens: Record<string, string>;
  request: (path: string, opts?: { user?: string; method?: string; body?: unknown; headers?: Record<string, string> }) => Promise<{ status: number; headers: Headers; json: any }>;
  dispose: () => Promise<void>;
}

/** 將 schema.sql 拆成單行語句逐一執行（Miniflare D1 exec 以行為單位）。 */
async function applySchema(db: D1Database) {
  const sql = readFileSync(resolve(__dirname, '../src/db/schema.sql'), 'utf8')
    .split('\n')
    .filter(l => !l.trim().startsWith('--'))
    .join('\n');
  for (const raw of sql.split(';')) {
    const stmt = raw.replace(/\s+/g, ' ').trim();
    if (!stmt) continue;
    try {
      await db.prepare(stmt).run();
    } catch (_) {
      // schema.sql 內 idx_tx_pair_id 引用由 ensureAccountsSchema 才新增之欄位，於遷移時補建
    }
  }
}

// 確定性偽隨機（LCG）
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const CATEGORIES = ['餐飲', '交通', '購物', '娛樂', '日用品', '醫療', '訂閱'];

function pad(n: number) { return String(n).padStart(2, '0'); }

async function batchRun(db: D1Database, stmts: D1PreparedStatement[]) {
  for (let i = 0; i < stmts.length; i += 40) {
    await db.batch(stmts.slice(i, i + 40));
  }
}

export async function seed(db: D1Database, bulk = 0) {
  const p = (sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args);
  const stmts: D1PreparedStatement[] = [];

  stmts.push(p('INSERT INTO users (id,email,name,password_hash,salt,created_at) VALUES (?,?,?,?,?,?)', USER1, 'a@x.com', 'Alice', 'h', 's', '2026-01-01 00:00:00'));
  stmts.push(p('INSERT INTO users (id,email,name,password_hash,salt,created_at) VALUES (?,?,?,?,?,?)', USER2, 'b@x.com', 'Bob', 'h', 's', '2026-01-01 00:00:00'));
  stmts.push(p('INSERT INTO users (id,email,name,password_hash,salt,created_at) VALUES (?,?,?,?,?,?)', 'u3', 'c@x.com', 'Carol', 'h', 's', '2026-01-01 00:00:00'));
  stmts.push(p('INSERT INTO households (id,name,created_by,created_at) VALUES (?,?,?,?)', 'h1', '我們家', USER1, '2026-01-01 00:00:00'));
  stmts.push(p('INSERT INTO household_members (id,household_id,user_id,role,joined_at) VALUES (?,?,?,?,?)', 'hm1', 'h1', USER1, 'admin', '2026-01-01 00:00:00'));
  stmts.push(p('INSERT INTO household_members (id,household_id,user_id,role,joined_at) VALUES (?,?,?,?,?)', 'hm2', 'h1', USER2, 'member', '2026-01-02 00:00:00'));

  type Acc = [string, string, string, string, number, number, number | null, number | null, number, number, string];
  const accounts: Acc[] = [
    // id, user, name, type, balance, unbilled, statement_day, due_day, is_joint, ..., created_at
    ['a_cash1', USER1, '皮夾', 'cash', 5000, 0, null, null, 0, 0, '2026-01-01 00:00:01'],
    ['a_bank1', USER1, '薪轉戶', 'bank', 120000, 0, null, null, 0, 0, '2026-01-01 00:00:02'],
    ['a_bankj', USER1, '家庭共同帳戶', 'bank', 80000, 0, null, null, 1, 0, '2026-01-01 00:00:03'],
    ['a_card1', USER1, 'Alice 信用卡', 'credit_card', 3000, 1500, 5, 25, 0, 0, '2026-01-01 00:00:04'],
    ['a_cardj', USER1, '家庭共同卡', 'credit_card', 0, 900, 20, 8, 1, 0, '2026-01-01 00:00:05'],
    ['a_bank2', USER2, 'Bob 銀行', 'bank', 60000, 0, null, null, 0, 0, '2026-01-01 00:00:06'],
    ['a_card2', USER2, 'Bob 信用卡', 'credit_card', 0, 800, 10, 28, 0, 0, '2026-01-01 00:00:07'],
  ];
  for (const a of accounts) {
    stmts.push(p(
      'INSERT INTO accounts (id,user_id,name,type,balance,unbilled,statement_day,payment_due_day,is_joint,credit_limit,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[3] === 'credit_card' ? 100000 : null, a[10]
    ));
  }

  // 確定性交易資料：2026-01 ~ 2026-06
  const rng = makeRng(42);
  const txAccounts: Array<[string, string]> = [
    ['a_card1', USER1], ['a_cardj', USER1], ['a_card2', USER2], ['a_bank1', USER1], ['a_bank2', USER2], ['a_cash1', USER1],
  ];
  let seq = 0;
  const addTx = (acc: string, user: string, type: string, cat: string, amount: number, date: string, shared: number, billed: number, deferred: number, reimb: string | null) => {
    seq++;
    const created = `${date} ${pad(8 + (seq % 12))}:${pad(seq % 60)}:${pad((seq * 7) % 60)}`;
    stmts.push(p(
      'INSERT INTO transactions (id,user_id,account_id,type,category,amount,note,date,is_shared,unbilled_offset,is_billed,defer_to_next_statement,reimbursement_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      `t${String(seq).padStart(6, '0')}`, user, acc, type, cat, amount, `n${seq}`, date, shared, 0, billed, deferred, reimb, created
    ));
  };
  for (let m = 1; m <= 6; m++) {
    for (const [acc, user] of txAccounts) {
      const count = 6 + Math.floor(rng() * 5);
      for (let i = 0; i < count; i++) {
        const day = 1 + Math.floor(rng() * (m === 6 ? 14 : 27));
        const date = `2026-${pad(m)}-${pad(day)}`;
        const cat = CATEGORIES[Math.floor(rng() * CATEGORIES.length)];
        const amount = Math.round((50 + rng() * 2000) * 100) / 100;
        const shared = rng() < 0.4 ? 1 : 0;
        const isCard = acc.startsWith('a_card');
        const billed = isCard && (m < 6 || day <= 5) ? 1 : 0;
        const deferred = isCard && !billed && rng() < 0.1 ? 1 : 0;
        const reimb = isCard && shared === 0 && rng() < 0.08 ? 'r1' : null;
        addTx(acc, user, 'expense', cat, amount, date, shared, billed, deferred, reimb);
      }
    }
    addTx('a_bank1', USER1, 'income', '薪資', 60000, `2026-${pad(m)}-05`, 0, 0, 0, null);
    addTx('a_bank2', USER2, 'income', '薪資', 52000, `2026-${pad(m)}-05`, 0, 0, 0, null);
  }
  addTx('a_bank1', USER1, 'expense', '信用卡還款', 4500, '2026-05-25', 0, 0, 0, null);
  addTx('a_bank1', USER1, 'expense', '內部轉帳', 1000, '2026-05-20', 0, 0, 0, null);

  const rec = (id: string, user: string, acc: string | null, name: string, type: string, amount: number, cycle: string, day: number, month: number, shared: number, created: string) =>
    stmts.push(p('INSERT INTO recurring_items (id,user_id,account_id,name,type,amount,cycle,day_of_cycle,month_of_cycle,is_shared,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', id, user, acc, name, type, amount, cycle, day, month, shared, created));
  rec('r_salary1', USER1, 'a_bank1', '薪水', 'income', 60000, 'monthly', 5, 1, 0, '2026-01-01 00:00:01');
  rec('r_salary2', USER2, 'a_bank2', '薪水', 'income', 52000, 'monthly', 5, 1, 0, '2026-01-01 00:00:02');
  rec('r_rent', USER1, 'a_bankj', '房租', 'expense', 22000, 'monthly', 1, 1, 1, '2026-01-01 00:00:03');
  rec('r_netflix', USER1, 'a_card1', 'Netflix', 'expense', 390, 'monthly', 12, 1, 0, '2026-01-01 00:00:04');
  rec('r_elec', USER1, 'a_bankj', '電費', 'expense', 1800, 'bimonthly', 15, 2, 1, '2026-01-01 00:00:05');
  rec('r_ins', USER2, 'a_card2', '保險', 'expense', 36000, 'annual', 31, 8, 0, '2026-01-01 00:00:06');
  rec('r_water', USER2, 'a_bankj', '水費', 'expense', 600, 'quarterly', 30, 3, 1, '2026-01-01 00:00:07');
  rec('r_bonus', USER1, 'a_bank1', '年中獎金', 'income', 30000, 'semiannual', 28, 6, 0, '2026-01-01 00:00:08');

  stmts.push(p("INSERT INTO budgets (id,user_id,category,amount,month) VALUES ('b1',?,?,?,?)", USER1, '餐飲', 8000, '2026-05'));
  stmts.push(p("INSERT INTO budgets (id,user_id,category,amount,month) VALUES ('b2',?,?,?,?)", USER1, '購物', 5000, '2026-05'));
  stmts.push(p("INSERT INTO budgets (id,user_id,category,amount,month) VALUES ('b3',?,?,?,?)", USER1, '餐飲', 8000, '2026-06'));
  stmts.push(p("INSERT INTO goals (id,user_id,name,emoji,target_amount,saved_amount,monthly_reserve,deadline,created_at) VALUES ('g1',?,?,?,?,?,?,?,?)", USER1, '旅遊基金', '✈️', 100000, 20000, 5000, '2027-01-01', '2026-01-01 00:00:01'));
  stmts.push(p("INSERT INTO goals (id,user_id,name,emoji,target_amount,saved_amount,monthly_reserve,deadline,created_at) VALUES ('g2',?,?,?,?,?,?,?,?)", USER2, '買車', '🚗', 500000, 50000, 8000, null, '2026-01-01 00:00:02'));

  await batchRun(db, stmts);

  // 已結清事件：本人、家人、非家庭成員各一筆（用於驗證範圍）
  await batchRun(db, [
    p("INSERT INTO forecast_settled_events (event_key,user_id,created_at) VALUES ('card_due:a_card1:2026-06-25',?,'2026-06-01 00:00:00')", USER1),
    p("INSERT INTO forecast_settled_events (event_key,user_id,created_at) VALUES ('card_due:a_card2:2026-06-28',?,'2026-06-01 00:00:00')", USER2),
    p("INSERT INTO forecast_settled_events (event_key,user_id,created_at) VALUES ('card_due:other:2026-06-10','u3','2026-06-01 00:00:00')"),
  ]);

  if (bulk > 0) {
    // 單一語句以遞迴 CTE 產生確定性大量資料（避免數千次往返）
    await db.prepare(`
      WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i + 1 < ?)
      INSERT INTO transactions (id,user_id,account_id,type,category,amount,note,date,is_shared,unbilled_offset,is_billed,defer_to_next_statement,reimbursement_id,created_at)
      SELECT
        'bulk' || printf('%06d', i),
        CASE (i % 4) WHEN 0 THEN 'u1' WHEN 1 THEN 'u1' WHEN 2 THEN 'u2' ELSE 'u1' END,
        CASE (i % 4) WHEN 0 THEN 'a_card1' WHEN 1 THEN 'a_cardj' WHEN 2 THEN 'a_card2' ELSE 'a_bank1' END,
        'expense',
        CASE (i % 7) WHEN 0 THEN '餐飲' WHEN 1 THEN '交通' WHEN 2 THEN '購物' WHEN 3 THEN '娛樂' WHEN 4 THEN '日用品' WHEN 5 THEN '醫療' ELSE '訂閱' END,
        20 + ((i * 37) % 1500),
        '',
        '2026-' || printf('%02d', 1 + (i * 7) % 5) || '-' || printf('%02d', 1 + (i * 13) % 27),
        CASE WHEN (i % 5) < 2 THEN 1 ELSE 0 END,
        0,
        CASE WHEN (i % 4) < 3 THEN 1 ELSE 0 END,
        0,
        NULL,
        '2026-' || printf('%02d', 1 + (i * 7) % 5) || '-' || printf('%02d', 1 + (i * 13) % 27) || ' 10:' || printf('%02d', i % 60) || ':' || printf('%02d', (i * 3) % 60)
      FROM n
    `).bind(bulk).run();
  }
}

export async function createHarness(opts: { bulk?: number } = {}): Promise<Harness> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'test-db' },
  });
  const db = (await mf.getD1Database('DB')) as unknown as D1Database;
  await applySchema(db);
  await ensureAccountsSchema(db);
  await seed(db, opts.bulk ?? 0);

  const env = { DB: db } as Harness['env'];
  const tokens: Record<string, string> = {};
  for (const [id, name] of [[USER1, 'Alice'], [USER2, 'Bob'], ['u3', 'Carol']]) {
    tokens[id] = await createJWT({ sub: id, email: `${id}@x.com`, name }, 'dev-secret-key');
  }

  const request: Harness['request'] = async (path, o = {}) => {
    const headers: Record<string, string> = { Authorization: `Bearer ${tokens[o.user || USER1]}`, ...(o.headers || {}) };
    if (o.body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await app.fetch(
      new Request(`http://localhost${path}`, { method: o.method || 'GET', headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined }),
      env
    );
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) { json = text; }
    return { status: res.status, headers: res.headers, json };
  };

  return { db, env, tokens, request, dispose: () => mf.dispose() };
}
