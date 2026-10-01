import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/jwt';

type Vars = { userId: string; userEmail: string; userName: string };
const exportRouter = new Hono<{ Bindings: Env; Variables: Vars }>();
exportRouter.use('*', authMiddleware);

// GET /export/csv?from=YYYY-MM-DD&to=YYYY-MM-DD
exportRouter.get('/csv', async (c) => {
  const userId = c.get('userId');
  const { from, to } = c.req.query();
  let sql = 'SELECT t.date, t.type, t.category, t.amount, t.note, a.name as account FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id WHERE t.user_id = ?';
  const params: (string | number)[] = [userId];
  if (from) { sql += ' AND t.date >= ?'; params.push(from); }
  if (to) { sql += ' AND t.date <= ?'; params.push(to); }
  sql += ' ORDER BY t.date DESC';
  const rows = await c.env.DB.prepare(sql).bind(...params).all();
  const items = rows.results as Array<{ date: string; type: string; category: string; amount: number; note: string; account: string }>;
  
  const BOM = '\uFEFF';
  const header = '日期,類型,分類,金額,備註,帳戶\n';
  const body = items.map(r =>
    `${r.date},${r.type === 'income' ? '收入' : '支出'},"${(r.category || '').replace(/"/g, '""')}",${r.amount},"${(r.note || '').replace(/"/g, '""')}","${(r.account || '').replace(/"/g, '""')}"`
  ).join('\n');
  const csv = BOM + header + body;
  
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="my-money-${new Date().toISOString().slice(0,10)}.csv"`,
    }
  });
});

function formatSchedule(cycle: string, day: number, month = 1): string {
  if (cycle === 'monthly') return `每月 ${day} 號`;
  if (cycle === 'bimonthly') return `${month === 1 ? '單數月' : '雙數月'} ${day} 號`;
  if (cycle === 'quarterly') {
    const qMap: Record<number, string> = { 1: '1/4/7/10月', 2: '2/5/8/11月', 3: '3/6/9/12月' };
    return `每季 (${qMap[month] || '1/4/7/10月'}) ${day} 號`;
  }
  if (cycle === 'semiannual') {
    const sMap: Record<number, string> = { 1: '1/7月', 2: '2/8月', 3: '3/9月', 4: '4/10月', 5: '5/11月', 6: '6/12月' };
    return `每半年 (${sMap[month] || '1/7月'}) ${day} 號`;
  }
  if (cycle === 'annual') return `每年 ${month} 月 ${day} 號`;
  return `每月 ${day} 號`;
}

// GET /export/recurring
exportRouter.get('/recurring', async (c) => {
  const userId = c.get('userId');
  const sql = 'SELECT r.name, r.type, r.amount, r.cycle, r.day_of_cycle, r.month_of_cycle, a.name as account FROM recurring_items r LEFT JOIN accounts a ON r.account_id = a.id WHERE r.user_id = ? ORDER BY r.day_of_cycle ASC';
  const rows = await c.env.DB.prepare(sql).bind(userId).all();
  const items = rows.results as Array<{ name: string; type: string; amount: number; cycle: string; day_of_cycle: number; month_of_cycle?: number; account: string }>;
  
  const cycleMap: Record<string, string> = {
    monthly: '每月', bimonthly: '每雙月', quarterly: '每季', semiannual: '每半年', annual: '每年'
  };

  const BOM = '\uFEFF';
  const header = '名稱,類型,金額,週期,扣款/入帳日,帳戶\n';
  const body = items.map(r =>
    `"${r.name.replace(/"/g, '""')}",${r.type === 'income' ? '收入' : '支出'},${r.amount},${cycleMap[r.cycle] || r.cycle},${formatSchedule(r.cycle, r.day_of_cycle, r.month_of_cycle || 1)},${r.account || ''}`
  ).join('\n');
  const csv = BOM + header + body;
  
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="recurring-${new Date().toISOString().slice(0,10)}.csv"`,
    }
  });
});

export default exportRouter;
