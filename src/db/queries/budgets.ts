import { getDb } from '../index';
import * as Crypto from 'expo-crypto';
import type { Budget } from '../../types';

export interface BudgetWithProgress extends Budget {
  tagName: string;
  tagColor?: string | null;
  spentCents: number;
}

export async function upsertBudget(tagId: string, limitCents: number): Promise<void> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  
  // Verifica se já existe orçamento para essa tag
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM budgets WHERE tag_id = ?',
    tagId
  );

  if (existing) {
    await db.runAsync(
      'UPDATE budgets SET limit_cents = ? WHERE id = ?',
      limitCents, existing.id
    );
  } else {
    const id = Crypto.randomUUID();
    await db.runAsync(
      'INSERT INTO budgets (id, tag_id, limit_cents, created_at) VALUES (?, ?, ?, ?)',
      id, tagId, limitCents, now
    );
  }
}

export async function deleteBudget(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM budgets WHERE id = ?', id);
}

export async function getBudgetsWithProgress(): Promise<BudgetWithProgress[]> {
  const db = await getDb();
  
  // Cálculo do mês corrente (do primeiro ao último dia)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000;

  const result = await db.getAllAsync<any>(
    `
    SELECT 
      b.id, b.tag_id, b.limit_cents, b.created_at,
      t.name as tagName, t.color as tagColor,
      COALESCE((
        SELECT SUM(amount_cents) 
        FROM transactions 
        WHERE tag_id = b.tag_id 
          AND type = 'expense' 
          AND occurred_at >= ? 
          AND occurred_at <= ?
      ), 0) as spentCents
    FROM budgets b
    JOIN tags t ON b.tag_id = t.id
    ORDER BY t.name ASC
    `,
    [startOfMonth, endOfMonth]
  );

  return result.map(r => ({
    id: r.id,
    tag_id: r.tag_id,
    limit_cents: r.limit_cents,
    created_at: r.created_at,
    tagName: r.tagName,
    tagColor: r.tagColor,
    spentCents: r.spentCents,
  }));
}
