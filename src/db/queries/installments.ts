/**
 * queries/installments.ts
 *
 * Operações sobre a tabela `installment_purchases` (compras parceladas).
 * Tanto o valor da parcela (total / quantidade) quanto a posição atual
 * (`first_due_date` + hoje) são derivados e nunca armazenados, evitando que
 * dois campos que descrevem a mesma coisa divirjam.
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
  /**
   * Unix timestamp (segundos) do vencimento da 1ª parcela. É esta data que
   * ancora todo o cronograma: a parcela atual é derivada dela, não armazenada.
   */
  first_due_date: number;
}

/**
 * Lista todas as compras parceladas, mais recentes primeiro.
 *
 * @returns Todas as compras, inclusive as já quitadas — filtrar quitadas é
 *   responsabilidade da UI, via `isInstallmentCompleted`.
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
 * @throws Se `installment_count < 1` — validação defensiva porque esse valor
 *   dirige divisões e loops de agendamento de notificação.
 */
export async function createInstallmentPurchase(
  data: NewInstallmentPurchase
): Promise<InstallmentPurchase> {
  if (data.installment_count < 1) {
    throw new Error('Parcelas devem ser >= 1');
  }
  const db = await getDb();
  const purchase: InstallmentPurchase = {
    id: Crypto.randomUUID(),
    name: data.name,
    tag_id: data.tag_id,
    total_amount_cents: data.total_amount_cents,
    installment_count: data.installment_count,
    first_due_date: data.first_due_date,
    created_at: Math.floor(Date.now() / 1000),
  };
  await db.runAsync(
    `INSERT INTO installment_purchases
       (id, name, tag_id, total_amount_cents, installment_count, first_due_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    purchase.id,
    purchase.name,
    purchase.tag_id,
    purchase.total_amount_cents,
    purchase.installment_count,
    purchase.first_due_date,
    purchase.created_at
  );
  return purchase;
}

/**
 * Atualiza os campos editáveis de uma compra parcelada existente.
 *
 * @param id - ID da compra.
 * @param data - Novos valores dos campos (mesmo shape de `createInstallmentPurchase`).
 * @throws Se `installment_count < 1` — mesma validação defensiva de
 *   `createInstallmentPurchase`.
 */
export async function updateInstallmentPurchase(
  id: string,
  data: NewInstallmentPurchase
): Promise<void> {
  if (data.installment_count < 1) {
    throw new Error('Parcelas devem ser >= 1');
  }
  const db = await getDb();
  await db.runAsync(
    `UPDATE installment_purchases
     SET name = ?, tag_id = ?, total_amount_cents = ?, installment_count = ?,
         first_due_date = ?
     WHERE id = ?`,
    data.name,
    data.tag_id,
    data.total_amount_cents,
    data.installment_count,
    data.first_due_date,
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
