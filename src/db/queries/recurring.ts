/**
 * queries/recurring.ts
 *
 * Operações sobre `recurring_transactions` (assinaturas recorrentes). O app
 * nunca lança a transação sozinho — o lembrete mensal leva a uma tela de
 * confirmação (ver ADR-0008 e src/hooks/useRecurring.ts).
 *
 * Relacionado: docs/DATA_MODEL.md
 */
import * as Crypto from 'expo-crypto';

import { getDb } from '../index';
import type { RecurringTransaction } from '../../types';

/** Assinatura + nome da tag (resolvido no JOIN), ou null se sem tag. */
export interface RecurringWithTag extends RecurringTransaction {
  tagName: string | null;
}

/**
 * Lista as assinaturas, ordenadas pelo dia do mês.
 *
 * @returns Assinaturas com o nome da tag resolvido.
 */
export async function listRecurring(): Promise<RecurringWithTag[]> {
  const db = await getDb();
  return db.getAllAsync<RecurringWithTag>(
    `SELECT r.*, t.name AS tagName
     FROM recurring_transactions r
     LEFT JOIN tags t ON r.tag_id = t.id
     ORDER BY r.day_of_month ASC`
  );
}

/**
 * Busca uma assinatura pelo ID.
 *
 * @param id - ID da assinatura.
 * @returns A assinatura (com nome da tag), ou null se não existir.
 */
export async function getRecurringById(id: string): Promise<RecurringWithTag | null> {
  const db = await getDb();
  return db.getFirstAsync<RecurringWithTag>(
    `SELECT r.*, t.name AS tagName
     FROM recurring_transactions r
     LEFT JOIN tags t ON r.tag_id = t.id
     WHERE r.id = ?`,
    id
  );
}

/**
 * Assinaturas de uma competência que ainda não viraram transação.
 *
 * "Pendente" é quem já venceu no mês e não tem transação vinculada. O
 * vencimento é comparado só no mês corrente: em meses passados, todas as
 * assinaturas já venceram, então basta a ausência do lançamento.
 *
 * O dia do vencimento é limitado ao último dia do mês, senão uma assinatura no
 * dia 31 nunca apareceria como vencida em fevereiro.
 *
 * @param month - Mês 1-12.
 * @param year - Ano com 4 dígitos.
 * @param now - Momento de referência; default é agora. Existe para testes.
 * @returns Assinaturas pendentes, ordenadas pelo dia do mês.
 */
export async function listPendingRecurring(
  month: number,
  year: number,
  now: Date = new Date()
): Promise<RecurringWithTag[]> {
  const db = await getDb();
  const start = Math.floor(new Date(year, month - 1, 1).getTime() / 1000);
  const end = Math.floor(new Date(year, month, 1).getTime() / 1000);

  const rows = await db.getAllAsync<RecurringWithTag>(
    `SELECT r.*, t.name AS tagName
     FROM recurring_transactions r
     LEFT JOIN tags t ON r.tag_id = t.id
     WHERE NOT EXISTS (
       SELECT 1 FROM transactions tx
       WHERE tx.recurring_id = r.id
         AND tx.occurred_at >= ? AND tx.occurred_at < ?
     )
     ORDER BY r.day_of_month ASC`,
    start,
    end
  );

  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month - 1;
  if (!isCurrentMonth) {
    return rows;
  }
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  return rows.filter((row) => Math.min(row.day_of_month, lastDayOfMonth) <= now.getDate());
}

/**
 * Cadastra uma assinatura recorrente.
 *
 * @param name - Nome (ex: "Netflix").
 * @param amount_cents - Valor mensal em centavos (> 0).
 * @param day_of_month - Dia do vencimento (1-31).
 * @param tag_id - Tag associada, ou null.
 * @returns A assinatura persistida.
 */
export async function createRecurring(
  name: string,
  amount_cents: number,
  day_of_month: number,
  tag_id: string | null
): Promise<RecurringTransaction> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const id = Crypto.randomUUID();
  await db.runAsync(
    'INSERT INTO recurring_transactions (id, name, amount_cents, day_of_month, tag_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    name,
    amount_cents,
    day_of_month,
    tag_id,
    now
  );
  return { id, name, amount_cents, day_of_month, tag_id, created_at: now };
}

/**
 * Remove uma assinatura.
 *
 * @param id - ID da assinatura.
 */
export async function deleteRecurring(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recurring_transactions WHERE id = ?', id);
}
