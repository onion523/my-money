import {
  Env,
  SyncRequest,
  SyncRecord,
  SyncResponse,
  ApiResponse,
  BookContext,
} from '../types';
import { isAdminOrOwner, canModify } from '../middleware/book-context';

/** 允許同步的表格白名單 */
const VALID_TABLES = new Set([
  'accounts',
  'fixed_expenses',
  'savings_goals',
  'transactions',
]);

/** 設定類表格 (member 不能寫) */
const SETTINGS_TABLES = new Set([
  'accounts',
  'fixed_expenses',
  'savings_goals',
]);

/**
 * LWW（Last-Write-Wins）批次同步 — book-based
 *
 * 流程：
 * 1. 客戶端上傳 {table, records: [{id, data, updated_at}]}
 * 2. 對每筆 record:
 *    a. 權限檢查 (settings tables 需 admin/owner；transactions 需 ownership 或 admin)
 *    b. 比對 server updated_at
 *       - 客戶端較新 → upsert (帶 book_id + created_by)
 *       - 伺服器較新 → 收集回傳
 * 3. 回傳 { server_wins, client_wins_applied }
 */
export async function handleSync(
  ctx: BookContext,
  body: SyncRequest,
  env: Env
): Promise<Response> {
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
  const isSettingsTable = SETTINGS_TABLES.has(table);

  // 設定類整批拒絕 (避免一筆一筆檢查)
  if (isSettingsTable && !isAdminOrOwner(ctx)) {
    return Response.json(
      {
        ok: false,
        error: '只有管理者可以同步設定類資料',
      } satisfies ApiResponse,
      { status: 403 }
    );
  }

  const serverWins: SyncRecord[] = [];
  let clientWinsApplied = 0;

  for (const record of body.records) {
    // 取得伺服器端該筆紀錄 (限制在當前 book)
    const serverRow = await env.DB.prepare(
      `SELECT * FROM ${table} WHERE id = ? AND book_id = ?`
    )
      .bind(record.id, ctx.bookId)
      .first<Record<string, unknown>>();

    if (!serverRow) {
      // 伺服器沒有這筆 → 新增 (但要先檢查 transactions 的 ownership 對 member 適用嗎？)
      // 新增 transaction 任何成員都能；新增 account/fixed/goal 已經在上面整批檢查過了
      await upsertRecord(table, ctx, record, env);
      clientWinsApplied++;
      continue;
    }

    // transactions 額外檢查: member 只能寫自己的
    if (table === 'transactions') {
      const createdBy = serverRow.created_by as string;
      if (!canModify(ctx, { created_by: createdBy })) {
        // 跳過這筆，不算 client_wins
        continue;
      }
    }

    const serverUpdatedAt = serverRow.updated_at as string;
    const clientUpdatedAt = record.updated_at;

    if (clientUpdatedAt > serverUpdatedAt) {
      await upsertRecord(table, ctx, record, env);
      clientWinsApplied++;
    } else if (serverUpdatedAt > clientUpdatedAt) {
      serverWins.push({
        id: record.id,
        data: serverRow,
        updated_at: serverUpdatedAt,
      });
    }
  }

  const result: SyncResponse = {
    server_wins: serverWins,
    client_wins_applied: clientWinsApplied,
  };

  return Response.json({ ok: true, data: result } satisfies ApiResponse);
}

/**
 * Upsert 一筆紀錄到指定表格 (book-based)
 *
 * 注入欄位:
 *   - book_id    = ctx.bookId
 *   - created_by = ctx.userId (新建時)；既有的話保留原 created_by
 *   - updated_at = record.updated_at
 */
async function upsertRecord(
  table: string,
  ctx: BookContext,
  record: SyncRecord,
  env: Env
): Promise<void> {
  // 若原本有 row，保留 created_by；否則用當前 user
  const existing = await env.DB.prepare(
    `SELECT created_by FROM ${table} WHERE id = ?`
  )
    .bind(record.id)
    .first<{ created_by: string }>();

  const createdBy = existing?.created_by ?? ctx.userId;

  const data: Record<string, unknown> = {
    ...record.data,
    id: record.id,
    book_id: ctx.bookId,
    created_by: createdBy,
    updated_at: record.updated_at,
  };

  // 移除 client 可能傳上來的 user_id (舊 schema 殘留)
  delete (data as any).user_id;

  const columns = Object.keys(data);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((col) => data[col]);

  const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

  await env.DB.prepare(sql).bind(...values).run();
}
