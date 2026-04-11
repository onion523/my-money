import { Env, FixedExpense } from '../types';

/**
 * 推撥排程 Cron Trigger Handler
 *
 * 每天早上 8 點（UTC+8）由 Cloudflare Workers Cron Trigger 觸發，
 * 檢查所有用戶明天的固定扣款項目，並透過 FCM 發送提醒通知。
 */

/** FCM 推撥訊息結構（預留串接用） */
interface FcmMessage {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * 發送 FCM 推撥通知（預留結構，目前僅 console.log）
 *
 * TODO: 串接 Firebase Cloud Messaging API
 * - 需要在 Env 中加入 FCM_SERVER_KEY
 * - 需要用戶的 FCM device token（從資料庫取得）
 */
async function sendFcmNotification(message: FcmMessage): Promise<void> {
  // 預留 FCM 串接：目前先用 console.log 記錄
  console.log('[FCM 推撥] 目標用戶:', message.userId);
  console.log('[FCM 推撥] 標題:', message.title);
  console.log('[FCM 推撥] 內容:', message.body);

  // TODO: 實作 FCM HTTP v1 API 呼叫
  // const response = await fetch(
  //   'https://fcm.googleapis.com/v1/projects/{project}/messages:send',
  //   {
  //     method: 'POST',
  //     headers: {
  //       'Authorization': `Bearer ${fcmToken}`,
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       message: {
  //         token: deviceToken,
  //         notification: { title: message.title, body: message.body },
  //         data: message.data,
  //       },
  //     }),
  //   }
  // );
}

/**
 * 取得明天的日期（UTC+8 台灣時區）
 */
function getTomorrowDay(): number {
  const now = new Date();
  // 轉換為 UTC+8
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  // 加一天
  const tomorrow = new Date(utc8.getTime() + 24 * 60 * 60 * 1000);
  return tomorrow.getUTCDate();
}

/**
 * Cron Trigger 主處理函式
 *
 * 由 wrangler.toml 的 [triggers] crons 設定觸發：
 * crons = ["0 0 * * *"]  # 每天 UTC 00:00（= 台灣 08:00）
 */
export async function handleScheduledNotifications(
  env: Env
): Promise<void> {
  console.log('[排程通知] 開始檢查明天的扣款項目...');

  const tomorrowDay = getTomorrowDay();
  console.log(`[排程通知] 明天是每月第 ${tomorrowDay} 天`);

  try {
    // 查詢所有啟用中、明天到期的固定支出
    const result = await env.DB.prepare(
      `SELECT fe.*, a.name AS account_name
       FROM fixed_expenses fe
       JOIN accounts a ON fe.account_id = a.id
       WHERE fe.is_active = 1
         AND fe.due_day = ?`
    )
      .bind(tomorrowDay)
      .all<FixedExpense & { account_name: string }>();

    if (!result.results || result.results.length === 0) {
      console.log('[排程通知] 明天沒有到期的扣款項目');
      return;
    }

    console.log(
      `[排程通知] 找到 ${result.results.length} 筆明天到期的扣款`
    );

    // 按帳本分組 (book-centric)
    const byBook = new Map<
      string,
      Array<FixedExpense & { account_name: string }>
    >();
    for (const expense of result.results) {
      const bookId = expense.book_id;
      if (!byBook.has(bookId)) {
        byBook.set(bookId, []);
      }
      byBook.get(bookId)!.push(expense);
    }

    // 為每個帳本的所有成員發送推撥通知
    for (const [bookId, expenses] of byBook) {
      // 取出該帳本所有成員
      const { results: members } = await env.DB.prepare(
        'SELECT user_id FROM book_members WHERE book_id = ?'
      )
        .bind(bookId)
        .all<{ user_id: string }>();

      const memberIds = (members ?? []).map((m) => m.user_id);

      if (expenses.length === 1) {
        const e = expenses[0];
        for (const userId of memberIds) {
          await sendFcmNotification({
            userId,
            title: '明日扣款提醒',
            body: `${e.name} 將於明天從「${e.account_name}」扣款 $${e.amount}`,
            data: { type: 'deduction_reminder', expenseId: e.id, bookId },
          });
        }
      } else {
        const total = expenses.reduce(
          (sum, e) => sum + parseFloat(e.amount || '0'),
          0
        );
        const names = expenses.map((e) => e.name).join('、');
        for (const userId of memberIds) {
          await sendFcmNotification({
            userId,
            title: '明日扣款提醒',
            body: `您有 ${expenses.length} 筆扣款（${names}），合計 $${total}`,
            data: {
              type: 'deduction_reminder',
              count: String(expenses.length),
              bookId,
            },
          });
        }
      }
    }

    console.log('[排程通知] 所有通知已發送完畢');
  } catch (error) {
    console.error('[排程通知] 處理失敗:', error);
    throw error;
  }
}
