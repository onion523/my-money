import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, generateId } from '../middleware/jwt';

type Vars = { userId: string; userEmail: string; userName: string };
const goals = new Hono<{ Bindings: Env; Variables: Vars }>();
goals.use('*', authMiddleware);

goals.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at ASC').bind(userId).all();
  return c.json({ success: true, data: rows.results });
});

goals.post('/', async (c) => {
  const userId = c.get('userId');
  const { name, emoji = '🎯', target_amount, monthly_reserve = 0, deadline } = await c.req.json();
  if (!name || !target_amount) return c.json({ success: false, error: '請填寫目標名稱和金額' }, 400);
  const id = generateId();
  await c.env.DB.prepare('INSERT INTO goals (id, user_id, name, emoji, target_amount, saved_amount, monthly_reserve, deadline) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
    .bind(id, userId, name, emoji, target_amount, monthly_reserve, deadline ?? null).run();
  const row = await c.env.DB.prepare('SELECT * FROM goals WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: row }, 201);
});

goals.put('/:id', async (c) => {
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { name, emoji, target_amount, monthly_reserve, deadline } = await c.req.json();
  const existing = await c.env.DB.prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?').bind(id, userId).first();
  if (!existing) return c.json({ success: false, error: '目標不存在' }, 404);
  await c.env.DB.prepare('UPDATE goals SET name=?, emoji=?, target_amount=?, monthly_reserve=?, deadline=? WHERE id=? AND user_id=?')
    .bind(name, emoji, target_amount, monthly_reserve, deadline ?? null, id, userId).run();
  const row = await c.env.DB.prepare('SELECT * FROM goals WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: row });
});

// POST /goals/:id/deposit — 存錢到目標
goals.post('/:id/deposit', async (c) => {
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { amount } = await c.req.json();
  if (!amount || amount <= 0) return c.json({ success: false, error: '金額必須大於 0' }, 400);
  const existing = await c.env.DB.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').bind(id, userId).first<{ saved_amount: number; target_amount: number }>();
  if (!existing) return c.json({ success: false, error: '目標不存在' }, 404);
  const newSaved = Math.min(existing.saved_amount + amount, existing.target_amount);
  await c.env.DB.prepare('UPDATE goals SET saved_amount = ? WHERE id = ? AND user_id = ?').bind(newSaved, id, userId).run();
  const row = await c.env.DB.prepare('SELECT * FROM goals WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: row });
});

goals.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const { id } = c.req.param();
  const existing = await c.env.DB.prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?').bind(id, userId).first();
  if (!existing) return c.json({ success: false, error: '目標不存在' }, 404);
  await c.env.DB.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return c.json({ success: true, data: null });
});

export default goals;
