import { getTaipeiDateString } from '../utils/date';
﻿import { Hono } from 'hono';
import { Env, BotBinding, Transaction, Account } from '../types';
import { authMiddleware, generateId } from '../middleware/jwt';
import { getUserHousehold } from './households';

type Vars = { userId: string; userEmail: string; userName: string };
const bot = new Hono<{ Bindings: Env; Variables: Vars }>();

// 自然語言記帳解析器
export function parseNaturalMessage(text: string): {
  type: 'expense' | 'income' | 'balance' | 'bind' | 'help' | 'unknown';
  amount?: number;
  category?: string;
  note?: string;
  accountKeyword?: string;
  pairingCode?: string;
  isShared?: boolean;
} {
  const trimmed = text.trim();

  // 1. 配對指令: "綁定 123456" 或 "/bind 123456" 或 "配對 123456"
  const bindMatch = trimmed.match(/^(?:綁定|配對|\/bind)\s*([A-Za-z0-9]{4,8})$/i);
  if (bindMatch) {
    return { type: 'bind', pairingCode: bindMatch[1].toUpperCase() };
  }

  // 2. 查帳 / 餘額
  if (/^(?:查帳|餘額|查餘額|balance|\/balance)$/i.test(trimmed)) {
    return { type: 'balance' };
  }

  // 3. 幫助 / 說明
  if (/^(?:幫助|說明|help|\/help|\/start|指令)$/i.test(trimmed)) {
    return { type: 'help' };
  }

  // 4. 收支記帳分析
  // 判斷公私帳關鍵字 (公帳、公費、家用、家、公)
  const isShared = /公帳|公費|家用|家/i.test(trimmed);
  // 範例: "午餐 120", "晚餐 180 現金", "薪水 60000 銀行", "加值 500 悠遊卡", "計程車 250"
  // 匹配: [項目/備註] [金額] [可選帳戶] 或 [金額] [項目]
  const amountMatch = trimmed.match(/(\d+(?:\.\d+)?)/);
  if (!amountMatch) {
    return { type: 'unknown' };
  }

  const amount = parseFloat(amountMatch[1]);
  if (isNaN(amount) || amount <= 0) return { type: 'unknown' };

  // 移除金額後的文字
  const withoutAmount = trimmed.replace(amountMatch[1], '').trim();
  const tokens = withoutAmount.split(/\s+/).filter(Boolean);

  let note = tokens[0] || '一般開銷';
  let accountKeyword = tokens[1] || '';

  // 判斷收入或支出
  const isIncome = /薪水|薪資|獎金|投資|股息|分紅|收入|副業|退稅|入帳/.test(trimmed);
  const type = isIncome ? 'income' : 'expense';

  // 分類自動推測
  let category = isIncome ? '薪資' : '其他';
  const lower = trimmed.toLowerCase();

  if (isIncome) {
    if (/獎金/.test(lower)) category = '獎金';
    else if (/投資|股息|股票/.test(lower)) category = '投資';
    else if (/副業|兼職/.test(lower)) category = '兼職';
    else category = '薪資';
  } else {
    if (/飯|麵|餐|吃|喝|早|午|晚|宵夜|咖啡|茶|飲料|麥當勞|肯德基|星巴克|壽司|拉麵|便當|火鍋|餐廳|披薩|全家|7-11/.test(lower)) {
      category = '餐飲';
    } else if (/車|油|捷運|公車|高鐵|計程車|uber|悠遊卡|加油|停車|票|高鐵|火車|機車/.test(lower)) {
      category = '交通';
    } else if (/玩|影|歌|唱|遊戲|switch|steam|netflix|spotify|音樂|展覽|電影|k歌/.test(lower)) {
      category = '娛樂';
    } else if (/買|衣|服|鞋|包|uniqlo|網購|蝦皮|momo|pchome|淘寶/.test(lower)) {
      category = '購物';
    } else if (/房租|水費|電費|瓦斯|全聯|屈臣氏|衛生紙|超市|日常|生活|家樂福|大潤發|ikea/.test(lower)) {
      category = '生活';
    } else if (/醫|藥|診所|看病|牙醫|眼科|健保|醫院|感冒/.test(lower)) {
      category = '醫療';
    } else if (/書|課|學費|補習|講義|文具/.test(lower)) {
      category = '教育';
    }
  }

  return { type, amount, category, note, accountKeyword, isShared };
}

// 產生配對碼 (需要登入)
bot.post('/pairing-code', authMiddleware, async (c) => {
  const userId = c.get('userId');

  // 生成 6 碼英數大寫配對碼
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  // 10 分鐘有效
  const expiresAt = Date.now() + 10 * 60 * 1000;

  // 清除此用戶先前的配對碼
  await c.env.DB.prepare('DELETE FROM bot_pairing_codes WHERE user_id = ?').bind(userId).run();

  await c.env.DB.prepare(`
    INSERT INTO bot_pairing_codes (code, user_id, expires_at)
    VALUES (?, ?, ?)
  `).bind(code, userId, expiresAt).run();

  return c.json({
    success: true,
    data: {
      code,
      expires_in_seconds: 600,
      expires_at: new Date(expiresAt).toISOString(),
    }
  });
});

// 查詢已綁定 Bot
bot.get('/bindings', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(`
    SELECT id, platform, platform_user_id, display_name, created_at
    FROM bot_bindings WHERE user_id = ?
  `).bind(userId).all();
  return c.json({ success: true, data: rows.results });
});

// 解除綁定
bot.delete('/bindings/:id', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM bot_bindings WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return c.json({ success: true, message: '已解除綁定' });
});

// 核心記帳與查帳執行邏輯
async function handleBotAction(
  db: D1Database,
  platform: 'line' | 'telegram',
  platformUserId: string,
  text: string,
  displayName = '',
  directUserId?: string
): Promise<string> {
  const parsed = parseNaturalMessage(text);

  // 1. 處理配對綁定
  if (parsed.type === 'bind' && parsed.pairingCode) {
    const now = Date.now();
    const pairing = await db.prepare(`
      SELECT user_id FROM bot_pairing_codes
      WHERE UPPER(code) = ? AND expires_at > ?
    `).bind(parsed.pairingCode, now).first<{ user_id: string }>();

    if (!pairing) {
      return '❌ 配對碼無效或已過期（有效期限 10 分鐘）。\n請前往網頁版「我的記帳本」重新產生配對碼！';
    }

    const id = generateId();
    // 綁定用戶
    await db.prepare(`
      INSERT OR REPLACE INTO bot_bindings (id, user_id, platform, platform_user_id, display_name)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, pairing.user_id, platform, platformUserId, displayName || platform).run();

    // 刪除已使用的配對碼
    await db.prepare('DELETE FROM bot_pairing_codes WHERE code = ?').bind(parsed.pairingCode).run();

    return '🎉 綁定成功！\n\n您現在可以直接發送文字快速記帳：\n• 輸入「午餐 120」\n• 輸入「計程車 250 信用卡」\n• 輸入「薪水 70000 銀行」\n• 輸入「餘額」查詢即時資金！';
  }

  // 2. 檢查使用者是否已綁定 (或由測試模擬直接傳入 userId)
  let userId = directUserId;
  let userName = displayName || '用戶';

  if (!userId) {
    const binding = await db.prepare(`
      SELECT b.user_id, u.name as user_name
      FROM bot_bindings b
      JOIN users u ON b.user_id = u.id
      WHERE b.platform = ? AND b.platform_user_id = ?
    `).bind(platform, platformUserId).first<{ user_id: string; user_name: string }>();

    if (!binding) {
      return '👋 您好！您尚未綁定「我的記帳本」帳號。\n\n請依以下步驟完成設定：\n1. 開啟記帳網站登入您的帳號\n2. 點擊「機器人串接」並產生 6 位數配對碼\n3. 在此輸入「綁定 <code>」（例如：綁定 8K29M4）\n完成後即可開始智慧記帳！';
    }
    userId = binding.user_id;
    userName = binding.user_name;
  }

  // 3. 處理幫助說明
  if (parsed.type === 'help') {
    return `📒 我的記帳本 — 智慧指令說明：\n\n` +
      `【快速記帳】\n` +
      `• 午餐 120\n` +
      `• 加油 800 信用卡\n` +
      `• 星巴克拿鐵 165\n` +
      `• 9月份薪水 68000 銀行\n\n` +
      `【查帳功能】\n` +
      `• 輸入「餘額」或「查帳」：查看即時可用與可自由花用餘額\n\n` +
      `【目前綁定帳號】\n` +
      `• ${userName}`;
  }

  // 4. 處理查帳 / 餘額
  if (parsed.type === 'balance') {
    const { memberUserIds } = await getUserHousehold(db, userId);
    const placeholders = memberUserIds.map(() => '?').join(',');

    const accRows = await db.prepare(`SELECT * FROM accounts WHERE user_id IN (${placeholders})`).bind(...memberUserIds).all<Account>();
    const accounts = accRows.results;

    const bankTotal = accounts.filter(a => a.type === 'bank').reduce((s, a) => s + a.balance, 0);
    const ccBilled = accounts.filter(a => a.type === 'credit_card').reduce((s, a) => s + a.balance, 0);
    const ccUnbilled = accounts.filter(a => a.type === 'credit_card').reduce((s, a) => s + a.unbilled, 0);
    const available = bankTotal - ccBilled - ccUnbilled;

    // 固定收支月攤提
    const recRows = await db.prepare(`SELECT * FROM recurring_items WHERE user_id IN (${placeholders})`).bind(...memberUserIds).all<any>();
    const CYCLE_DIVISORS: Record<string, number> = { monthly:1, bimonthly:2, quarterly:3, semiannual:6, annual:12 };
    let monthlyFixed = 0;
    for (const r of recRows.results) {
      if (r.type === 'expense') monthlyFixed += r.amount / (CYCLE_DIVISORS[r.cycle] || 1);
    }

    // 儲蓄目標預留
    const goalRows = await db.prepare(`SELECT * FROM goals WHERE user_id IN (${placeholders})`).bind(...memberUserIds).all<any>();
    const monthlyGoals = goalRows.results.reduce((s: number, g: any) => s + (g.monthly_reserve || 0), 0);
    const disposable = available - monthlyFixed - monthlyGoals;

    return `📊 即時財務總覽\n` +
      `━━━━━━━━━━━━━━━\n` +
      `🏦 銀行總餘額：NT$ ${bankTotal.toLocaleString()}\n` +
      `💳 信用卡未出帳：NT$ ${ccUnbilled.toLocaleString()}\n` +
      `✨ 即時可用餘額：NT$ ${available.toLocaleString()}\n` +
      `━━━━━━━━━━━━━━━\n` +
      `🔄 固定月攤提：NT$ ${Math.round(monthlyFixed).toLocaleString()}\n` +
      `🎯 儲蓄月預留：NT$ ${monthlyGoals.toLocaleString()}\n` +
      `💡 可自由花用：NT$ ${Math.round(disposable).toLocaleString()}`;
  }

  // 5. 處理收支記帳
  if (parsed.type === 'expense' || parsed.type === 'income') {
    const { memberUserIds } = await getUserHousehold(db, userId);
    const placeholders = memberUserIds.map(() => '?').join(',');

    const accRows = await db.prepare(`SELECT * FROM accounts WHERE user_id IN (${placeholders})`).bind(...memberUserIds).all<Account>();
    const accounts = accRows.results;

    if (accounts.length === 0) {
      return '⚠️ 目前尚未建立任何帳戶，請先至網頁版建立帳戶後再記帳！';
    }

    // 尋找匹配帳戶
    let targetAccount: Account | undefined;
    if (parsed.accountKeyword) {
      targetAccount = accounts.find(a => a.name.includes(parsed.accountKeyword!));
    }
    if (!targetAccount) {
      // 預設帳戶：若為信用卡開銷則優先選信用卡，否則選第一個活存
      if (/信用卡|刷卡/.test(text)) {
        targetAccount = accounts.find(a => a.type === 'credit_card') || accounts[0];
      } else {
        targetAccount = accounts.find(a => a.type === 'bank') || accounts[0];
      }
    }

    const txId = generateId();
    const today = getTaipeiDateString();
    const amount = parsed.amount!;
    const category = parsed.category!;
    const note = parsed.note || '';

    // 新增交易 (Q7: 支援公帳 vs 私帳)
    const isShared = (parsed as any).isShared ? 1 : 0;
    await db.prepare(`
      INSERT INTO transactions (id, user_id, account_id, type, category, amount, note, date, is_shared)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(txId, userId, targetAccount.id, parsed.type, category, amount, note, today, isShared).run();

    // 更新帳戶餘額
    if (targetAccount.type === 'bank') {
      const delta = parsed.type === 'income' ? amount : -amount;
      await db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').bind(delta, targetAccount.id).run();
    } else {
      // 信用卡支出增加未出帳
      const delta = parsed.type === 'expense' ? amount : -amount;
      await db.prepare('UPDATE accounts SET unbilled = MAX(0, unbilled + ?) WHERE id = ?').bind(delta, targetAccount.id).run();
    }

    // 取得最新可用餘額
    const updatedAccs = await db.prepare(`SELECT * FROM accounts WHERE user_id IN (${placeholders})`).bind(...memberUserIds).all<Account>();
    const bTotal = updatedAccs.results.filter(a => a.type === 'bank').reduce((s, a) => s + a.balance, 0);
    const cBilled = updatedAccs.results.filter(a => a.type === 'credit_card').reduce((s, a) => s + a.balance, 0);
    const cUnbilled = updatedAccs.results.filter(a => a.type === 'credit_card').reduce((s, a) => s + a.unbilled, 0);
    const currentAvailable = bTotal - cBilled - cUnbilled;

    const emojiMap: Record<string, string> = {
      '餐飲':'🍜', '交通':'🚇', '娛樂':'🎬', '購物':'🛍️', '生活':'🏠', '醫療':'💊', '教育':'📚', '其他':'📌',
      '薪資':'💼', '獎金':'🎉', '投資':'📈', '兼職':'💼', '副業':'💼'
    };

    return `📝 記帳成功！\n` +
      `━━━━━━━━━━━━━━━\n` +
      `▫️ 項目：${note}\n` +
      `▫️ 類型：${parsed.type === 'income' ? '收入 📈' : '支出 📉'}\n` +
      `▫️ 歸屬：${(parsed as any).isShared ? '🏠 家庭公帳（代墊）' : '👤 個人私帳'}\n` +
      `▫️ 分類：${emojiMap[category] || '📌'} ${category}\n` +
      `▫️ 金額：NT$ ${amount.toLocaleString()}\n` +
      `▫️ 帳戶：${targetAccount.name}\n` +
      `▫️ 記帳人：${userName}\n` +
      `━━━━━━━━━━━━━━━\n` +
      `💰 目前可用餘額：NT$ ${currentAvailable.toLocaleString()}`;
  }

  return '❓ 無法理解此訊息，您可以直接輸入「午餐 120」記帳，或輸入「餘額」查帳！';
}

// POST /bot/webhook/line
bot.post('/webhook/line', async (c) => {
  try {
    const body = await c.req.json();
    const events = body.events || [];

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const lineUserId = event.source.userId;
        const text = event.message.text;
        const replyToken = event.replyToken;

        const replyText = await handleBotAction(c.env.DB, 'line', lineUserId, text);

        // 如果設定了 LINE_CHANNEL_ACCESS_TOKEN 則呼叫 LINE Reply API
        if (c.env.LINE_CHANNEL_ACCESS_TOKEN && replyToken) {
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${c.env.LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
              replyToken,
              messages: [{ type: 'text', text: replyText }],
            }),
          }).catch(err => console.error('LINE Reply error:', err));
        }
      }
    }

    return c.json({ ok: true });
  } catch (err: any) {
    console.error('Line webhook err:', err);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// POST /bot/webhook/telegram
bot.post('/webhook/telegram', async (c) => {
  try {
    const update = await c.req.json();
    const msg = update.message;
    if (msg && msg.text) {
      const tgUserId = String(msg.from.id);
      const chatId = msg.chat.id;
      const text = msg.text;
      const displayName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || msg.from.username || '';

      const replyText = await handleBotAction(c.env.DB, 'telegram', tgUserId, text, displayName);

      // 如果設定了 TELEGRAM_BOT_TOKEN 則呼叫 Telegram sendMessage
      if (c.env.TELEGRAM_BOT_TOKEN && chatId) {
        await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: replyText }),
        }).catch(err => console.error('Telegram reply error:', err));
      }
    }

    return c.json({ ok: true });
  } catch (err: any) {
    console.error('Telegram webhook err:', err);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// 測試用模擬訊息發送端點（方便使用者在前端或開發測試 Bot 對話）
bot.post('/test-simulate', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(userId).first<{ name: string }>();
  const userName = user?.name || '模擬測試助手';
  const { text, platform = 'line' } = await c.req.json();
  if (!text) return c.json({ success: false, error: '請輸入測試訊息' }, 400);

  // 直接以認證通過之 userId 處理，不向 bot_bindings 寫入任何模擬假綁定資料
  const reply = await handleBotAction(c.env.DB, platform as any, `sim_${userId}`, text, userName, userId);
  return c.json({ success: true, data: { input: text, reply } });
});

export default bot;
