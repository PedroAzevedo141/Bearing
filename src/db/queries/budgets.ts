/**
 * queries/budgets.ts
 *
 * Operações sobre `budgets` (limite mensal por tag) e o cálculo de progresso de
 * uma competência.
 *
 * O limite é **versionado no tempo** (migration v8): cada alteração cria uma
 * linha nova com `effective_from`, e a leitura de um mês usa a versão vigente
 * naquele mês. Sem isso, mudar o limite reescreveria o julgamento sobre meses
 * já passados — ver docs/DATA_MODEL.md.
 *
 * Relacionado: docs/DATA_MODEL.md
 */
import * as Crypto from 'expo-crypto';

import { getDb } from '../index';
import type { Budget } from '../../types';

/** Orçamento vigente numa competência + dados da tag e gasto do mês. */
export interface BudgetWithProgress extends Budget {
  tagName: string;
  tagColor: string | null;
  /** Gasto (despesas) da tag na competência consultada, em centavos. */
  spentCents: number;
}

/** Início do mês (unix, segundos) — é o valor gravado em `effective_from`. */
function startOfMonth(month: number, year: number): number {
  return Math.floor(new Date(year, month - 1, 1).getTime() / 1000);
}

/**
 * Define o limite de uma tag a partir de uma competência.
 *
 * Alterar o limite de um mês que já tem versão sobrescreve aquela versão;
 * alterar num mês novo cria outra, preservando o que valia antes. É isso que
 * mantém o passado avaliável contra o limite da época.
 *
 * @param tagId - ID da tag.
 * @param limitCents - Limite mensal em centavos (> 0).
 * @param month - Mês 1-12 a partir do qual o limite vale. Default: mês corrente.
 * @param year - Ano de quatro dígitos. Default: ano corrente.
 */
export async function setBudget(
  tagId: string,
  limitCents: number,
  month?: number,
  year?: number
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const effectiveFrom = startOfMonth(month ?? now.getMonth() + 1, year ?? now.getFullYear());

  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM budgets WHERE tag_id = ? AND effective_from = ?',
    tagId,
    effectiveFrom
  );
  if (existing) {
    await db.runAsync('UPDATE budgets SET limit_cents = ? WHERE id = ?', limitCents, existing.id);
    return;
  }
  await db.runAsync(
    'INSERT INTO budgets (id, tag_id, limit_cents, created_at, effective_from) VALUES (?, ?, ?, ?, ?)',
    Crypto.randomUUID(),
    tagId,
    limitCents,
    Math.floor(Date.now() / 1000),
    effectiveFrom
  );
}

/**
 * Deixa de orçar uma tag, apagando todas as versões do limite.
 *
 * Remove o histórico junto de propósito: "não quero mais orçar isto" é
 * diferente de "quero mudar o valor", e guardar versões de um orçamento que não
 * existe mais só deixaria lixo aparecendo em meses passados.
 *
 * @param tagId - ID da tag.
 */
export async function deleteBudgetForTag(tagId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM budgets WHERE tag_id = ?', tagId);
}

/**
 * Lista os orçamentos vigentes numa competência, com o gasto do mês.
 *
 * Para cada tag, escolhe a versão de limite mais recente que já valia no
 * primeiro dia do mês consultado. Tags cujo orçamento só passou a existir
 * depois ficam de fora — não havia limite naquele mês.
 *
 * @param month - Mês 1-12.
 * @param year - Ano com 4 dígitos.
 * @returns Orçamentos com nome/cor da tag e `spentCents` da competência.
 */
export async function getBudgetsWithProgress(
  month: number,
  year: number
): Promise<BudgetWithProgress[]> {
  const db = await getDb();
  const start = startOfMonth(month, year);
  const end = startOfMonth(month === 12 ? 1 : month + 1, month === 12 ? year + 1 : year);

  return db.getAllAsync<BudgetWithProgress>(
    `SELECT
       b.id, b.tag_id, b.limit_cents, b.created_at, b.effective_from,
       t.name AS tagName, t.color AS tagColor,
       COALESCE((
         SELECT SUM(amount_cents) FROM transactions
         WHERE tag_id = b.tag_id AND type = 'expense'
           AND occurred_at >= ? AND occurred_at < ?
       ), 0) AS spentCents
     FROM budgets b
     JOIN tags t ON b.tag_id = t.id
     WHERE b.effective_from = (
       SELECT MAX(b2.effective_from) FROM budgets b2
       WHERE b2.tag_id = b.tag_id AND b2.effective_from <= ?
     )
     ORDER BY t.name ASC`,
    start,
    end,
    start
  );
}
