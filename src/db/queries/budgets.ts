/**
 * queries/budgets.ts
 *
 * Operações sobre `budgets` (orçamento mensal por tag) e o cálculo de
 * progresso do mês corrente. O orçamento é recorrente, não por mês específico
 * — a query de gasto sempre filtra pelo mês atual (ver docs/DATA_MODEL.md).
 *
 * Relacionado: docs/DATA_MODEL.md
 */
import * as Crypto from 'expo-crypto';

import { getDb } from '../index';
import type { Budget } from '../../types';

/** Orçamento de uma tag + nome/cor da tag e gasto do mês corrente. */
export interface BudgetWithProgress extends Budget {
  tagName: string;
  tagColor: string | null;
  /** Gasto (despesas) da tag no mês corrente, em centavos. */
  spentCents: number;
}

/** Linha crua da query de progresso (antes de tipar). */
interface BudgetProgressRow {
  id: string;
  tag_id: string;
  limit_cents: number;
  created_at: number;
  tagName: string;
  tagColor: string | null;
  spentCents: number;
}

/**
 * Cria ou atualiza o orçamento de uma tag (uma tag tem no máximo um orçamento).
 *
 * @param tagId - ID da tag.
 * @param limitCents - Limite mensal em centavos (> 0).
 */
export async function upsertBudget(tagId: string, limitCents: number): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM budgets WHERE tag_id = ?',
    tagId
  );
  if (existing) {
    await db.runAsync('UPDATE budgets SET limit_cents = ? WHERE id = ?', limitCents, existing.id);
  } else {
    await db.runAsync(
      'INSERT INTO budgets (id, tag_id, limit_cents, created_at) VALUES (?, ?, ?, ?)',
      Crypto.randomUUID(),
      tagId,
      limitCents,
      Math.floor(Date.now() / 1000)
    );
  }
}

/**
 * Remove um orçamento.
 *
 * @param id - ID do orçamento.
 */
export async function deleteBudget(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM budgets WHERE id = ?', id);
}

/**
 * Lista os orçamentos com o gasto do mês corrente de cada tag.
 *
 * @returns Orçamentos com nome/cor da tag e `spentCents` (despesas do mês).
 */
export async function getBudgetsWithProgress(): Promise<BudgetWithProgress[]> {
  const db = await getDb();
  const now = new Date();
  const startOfMonth = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
  const startOfNextMonth = Math.floor(
    new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() / 1000
  );

  const rows = await db.getAllAsync<BudgetProgressRow>(
    `SELECT
       b.id, b.tag_id, b.limit_cents, b.created_at,
       t.name AS tagName, t.color AS tagColor,
       COALESCE((
         SELECT SUM(amount_cents) FROM transactions
         WHERE tag_id = b.tag_id AND type = 'expense'
           AND occurred_at >= ? AND occurred_at < ?
       ), 0) AS spentCents
     FROM budgets b
     JOIN tags t ON b.tag_id = t.id
     ORDER BY t.name ASC`,
    startOfMonth,
    startOfNextMonth
  );
  return rows;
}
