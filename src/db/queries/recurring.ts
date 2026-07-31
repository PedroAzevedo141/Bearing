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
