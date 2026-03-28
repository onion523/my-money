import { Env, SyncRequest, SyncRecord, SyncResponse, ApiResponse } from '../types';

/** 允許同步的表格白名單 */
const VALID_TABLES = new Set([
  'accounts',
  'fixed_expenses',
  'savings_goals',
  'transactions',
]);

/**
 * LWW（Last-Write-Wins）批次同步
 *
 * 流程：
 * 1. 客戶端上傳 {table, records: [{id, data, updated_at}]}
 * 2. 逐筆比較 server 的 updated_at
 *    - 客戶端較新 → 用客戶端資料覆蓋 server（upsert）
 *    - 伺服器較新 → 收集起來回傳給客戶端
 * 3. 回傳 { server_wins, client_wins_applied }
 */
export async function handleSync(
  userId: string,
  body: SyncRequest,
  env: Env
): Promise<Response> {
  // 驗證表格名稱，防止 SQL 注入
  if (!VALID_TABLES.has(body.table)) {
    return Response.json(
      { ok: false, error: `不支援的表格：${body.table}` } satisfies ApiResponse,
      { status: 400 }
    );
  }

  if (!Array.isArray(body.records) || body.records.length === 0) {
    return Response.json(
      { ok: false, error: '缺少 records 陣列' } satisfies ApiResponse,
      { status: 400 }
    );
  }

  const table = body.table;
  const serverWins: SyncRecord[] = [];
  let clientWinsApplied = 0;

  for (const record of body.records) {
    // 取得伺服器端該筆紀錄
    const serverRow = await env.DB.prepare(
      `SELECT * FROM ${table} WHERE id = ? AND user_id = ?`
    )
      .bind(record.id, userId)
      .first<Record<string, unknown>>();

    if (!serverRow) {
      // 伺服器沒有這筆 → 直接新增（客戶端贏）
      await upsertRecord(table, userId, record, env);
      clientWinsApplied++;
      continue;
    }

    const serverUpdatedAt = serverRow.updated_at as string;
    const clientUpdatedAt = record.updated_at;

    if (clientUpdatedAt > serverUpdatedAt) {
      // 客戶端較新 → 覆蓋伺服器
      await upsertRecord(table, userId, record, env);
      clientWinsApplied++;
    } else if (serverUpdatedAt > clientUpdatedAt) {
      // 伺服器較新 → 收集起來回傳給客戶端
      serverWins.push({
        id: record.id,
        data: serverRow,
        updated_at: serverUpdatedAt,
      });
    }
    // 時間相同 → 不做任何事（已同步）
  }

  const result: SyncResponse = {
    server_wins: serverWins,
    client_wins_applied: clientWinsApplied,
  };

  return Response.json({ ok: true, data: result } satisfies ApiResponse);
}

/**
 * Upsert 一筆紀錄到指定表格
 * 使用 INSERT OR REPLACE 實現，data 中包含所有欄位
 */
async function upsertRecord(
  table: string,
  userId: string,
  record: SyncRecord,
  env: Env
): Promise<void> {
  const data: Record<string, unknown> = {
    ...record.data,
    id: record.id,
    user_id: userId,
    updated_at: record.updated_at,
  };

  // 動態產生 INSERT OR REPLACE 語句
  const columns = Object.keys(data);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((col) => data[col]);

  const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

  await env.DB.prepare(sql).bind(...values).run();
}
