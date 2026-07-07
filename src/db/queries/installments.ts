/**
 * queries/installments.ts
 *
 * Operações sobre a tabela `installment_purchases` (compras parceladas).
 * A parcela mensal é derivada (total / quantidade) e nunca armazenada,
 * evitando inconsistência entre os dois valores.
 *
 * Relacionado: docs/DATA_MODEL.md, src/services/notificationService.ts
 */
import * as Crypto from 'expo-crypto';

import { getDb } from '../index';
import type { InstallmentPurchase } from '../../types';

/** Dados necessários para cadastrar uma compra parcelada. */
export interface NewInstallmentPurchase {
  name: string;
  tag_id: string | null;
  total_amount_cents: number;
  installment_count: number;
  /** Parcela em que a compra já está (1 para compra nova). */
  current_installment: number;
  /** Unix timestamp (segundos) do vencimento da 1ª parcela. */
  first_due_date: number;
}

/**
 * Lista todas as compras parceladas, mais recentes primeiro.
 *
 * @returns Todas as compras, inclusive as já quitadas
 *   (current_installment > installment_count fica a cargo da UI filtrar).
 */
export async function listInstallmentPurchases(): Promise<InstallmentPurchase[]> {
  const db = await getDb();
  return db.getAllAsync<InstallmentPurchase>(
    'SELECT * FROM installment_purchases ORDER BY created_at DESC'
  );
}

/**
 * Cadastra uma compra parcelada.
 *
 * @param data - Campos da compra.
 * @returns A compra persistida.
 * @throws Se `installment_count < 1` ou `current_installment < 1` —
 *   validação defensiva porque esses valores dirigem divisões e loops
 *   de agendamento de notificação.
 */
export async function createInstallmentPurchase(
  data: NewInstallmentPurchase
): Promise<InstallmentPurchase> {
  if (data.installment_count < 1 || data.current_installment < 1) {
    throw new Error('Parcelas devem ser >= 1');
  }
  const db = await getDb();
  const purchase: InstallmentPurchase = {
    id: Crypto.randomUUID(),
    name: data.name,
    tag_id: data.tag_id,
    total_amount_cents: data.total_amount_cents,
    installment_count: data.installment_count,
    current_installment: data.current_installment,
    first_due_date: data.first_due_date,
    created_at: Math.floor(Date.now() / 1000),
  };
  await db.runAsync(
    `INSERT INTO installment_purchases
       (id, name, tag_id, total_amount_cents, installment_count, current_installment, first_due_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    purchase.id,
    purchase.name,
    purchase.tag_id,
    purchase.total_amount_cents,
    purchase.installment_count,
    purchase.current_installment,
    purchase.first_due_date,
    purchase.created_at
  );
  return purchase;
}

/**
 * Avança a compra para a próxima parcela (ex: quando a fatura fecha).
 * Não passa de `installment_count` — compra quitada fica estável.
 *
 * @param id - ID da compra.
 */
export async function advanceInstallment(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE installment_purchases
     SET current_installment = MIN(current_installment + 1, installment_count)
     WHERE id = ?`,
    id
  );
}

/**
 * Remove uma compra parcelada.
 *
 * @param id - ID da compra.
 */
export async function deleteInstallmentPurchase(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM installment_purchases WHERE id = ?', id);
}
