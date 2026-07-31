/**
 * queries/transactions.ts
 *
 * Operações sobre a tabela `transactions` e as agregações usadas tanto pela
 * aba Rotação quanto pelo resumo enviado à IA (sempre agregado — transações
 * individuais nunca saem do dispositivo).
 *
 * Relacionado: docs/DATA_MODEL.md, docs/API_CONTRACTS.md
 */
import * as Crypto from 'expo-crypto';

import { getDb } from '../index';
import type { TagBalance, Transaction, TransactionType } from '../../types';

/** Dados necessários para registrar uma transação. */
export interface NewTransaction {
  account_id: string;
  tag_id: string | null;
  /** Valor absoluto em centavos (o sinal vem de `type`). */
  amount_cents: number;
  type: TransactionType;
  description: string | null;
  /** Unix timestamp (segundos). Default: agora. */
  occurred_at?: number;
}

/**
 * Lista as transações de um período, mais recentes primeiro.
 *
 * @param periodDays - Janela em dias contada a partir de agora (ex: 30).
 * @returns Transações com `occurred_at` dentro da janela.
 */
export async function listTransactions(periodDays: number): Promise<Transaction[]> {
  const db = await getDb();
  const since = Math.floor(Date.now() / 1000) - periodDays * 86400;
  return db.getAllAsync<Transaction>(
    'SELECT * FROM transactions WHERE occurred_at >= ? ORDER BY occurred_at DESC',
    since
  );
}

/**
 * Registra uma nova transação.
 *
 * @param data - Campos da transação; `occurred_at` default é o momento atual.
 * @returns A transação persistida.
 */
export async function createTransaction(data: NewTransaction): Promise<Transaction> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const tx: Transaction = {
    id: Crypto.randomUUID(),
    account_id: data.account_id,
    tag_id: data.tag_id,
    amount_cents: data.amount_cents,
    type: data.type,
    description: data.description,
    occurred_at: data.occurred_at ?? now,
    created_at: now,
  };
  await db.runAsync(
    `INSERT INTO transactions (id, account_id, tag_id, amount_cents, type, description, occurred_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    tx.id,
    tx.account_id,
    tx.tag_id,
    tx.amount_cents,
    tx.type,
    tx.description,
    tx.occurred_at,
    tx.created_at
  );
  return tx;
}

/**
 * Atualiza os campos editáveis de uma transação existente.
 *
 * @param id - ID da transação.
 * @param data - Novos valores dos campos (mesmo shape de `createTransaction`).
 */
export async function updateTransaction(id: string, data: NewTransaction): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE transactions
     SET account_id = ?, tag_id = ?, amount_cents = ?, type = ?, description = ?, occurred_at = ?
     WHERE id = ?`,
    data.account_id,
    data.tag_id,
    data.amount_cents,
    data.type,
    data.description,
    data.occurred_at ?? Math.floor(Date.now() / 1000),
    id
  );
}

/**
 * Remove uma transação.
 *
 * @param id - ID da transação.
 */
export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

/**
 * Soma entradas e saídas por tag num período — é o agregado (e somente ele)
 * que o app envia ao Worker de IA.
 *
 * @param periodDays - Janela em dias contada a partir de agora.
 * @returns Um total por tag, com gasto como valor negativo. Transações sem
 *   tag entram agrupadas como "sem categoria".
 */
export async function getBalanceByTag(periodDays: number): Promise<TagBalance[]> {
  const db = await getDb();
  const since = Math.floor(Date.now() / 1000) - periodDays * 86400;
  return db.getAllAsync<TagBalance>(
    `SELECT
       COALESCE(tags.name, 'sem categoria') AS tag,
       SUM(CASE WHEN transactions.type = 'income' THEN transactions.amount_cents
                ELSE -transactions.amount_cents END) AS total_cents
     FROM transactions
     LEFT JOIN tags ON tags.id = transactions.tag_id
     WHERE transactions.occurred_at >= ?
     GROUP BY tag
     ORDER BY total_cents ASC`,
    since
  );
}

/**
 * Soma entradas e saídas por tag num mês/ano específico — usado pela tool
 * `getGastosPorTag` do chat, que pede um mês concreto (não uma janela móvel).
 *
 * @param month - Mês 1-12.
 * @param year - Ano com 4 dígitos (ex: 2026).
 * @returns Um total por tag no intervalo `[início do mês, início do mês seguinte)`,
 *   com gasto como valor negativo. Transações sem tag entram como "sem categoria".
 */
export async function getBalanceByTagForMonth(month: number, year: number): Promise<TagBalance[]> {
  const db = await getDb();
  // Range em segundos: [1º dia do mês 00:00 local, 1º dia do mês seguinte).
  const start = Math.floor(new Date(year, month - 1, 1).getTime() / 1000);
  const end = Math.floor(new Date(year, month, 1).getTime() / 1000);
  return db.getAllAsync<TagBalance>(
    `SELECT
       COALESCE(tags.name, 'sem categoria') AS tag,
       SUM(CASE WHEN transactions.type = 'income' THEN transactions.amount_cents
                ELSE -transactions.amount_cents END) AS total_cents
     FROM transactions
     LEFT JOIN tags ON tags.id = transactions.tag_id
     WHERE transactions.occurred_at >= ? AND transactions.occurred_at < ?
     GROUP BY tag
     ORDER BY total_cents ASC`,
    start,
    end
  );
}
