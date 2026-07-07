/**
 * queries/accounts.ts
 *
 * Operações sobre a tabela `accounts`. Toda transação exige uma conta;
 * o app garante uma conta padrão ("Carteira") no primeiro uso.
 *
 * Relacionado: docs/DATA_MODEL.md
 */
import * as Crypto from 'expo-crypto';

import { getDb } from '../index';
import type { Account } from '../../types';

/**
 * Lista todas as contas, mais antigas primeiro.
 *
 * @returns Todas as contas cadastradas.
 */
export async function listAccounts(): Promise<Account[]> {
  const db = await getDb();
  return db.getAllAsync<Account>('SELECT * FROM accounts ORDER BY created_at ASC');
}

/**
 * Cria uma conta nova.
 *
 * @param name - Nome visível na UI (ex: "Conta corrente").
 * @returns A conta recém-criada.
 */
export async function createAccount(name: string): Promise<Account> {
  const db = await getDb();
  const account: Account = {
    id: Crypto.randomUUID(),
    name,
    created_at: Math.floor(Date.now() / 1000),
  };
  await db.runAsync(
    'INSERT INTO accounts (id, name, created_at) VALUES (?, ?, ?)',
    account.id,
    account.name,
    account.created_at
  );
  return account;
}

/**
 * Garante que exista ao menos uma conta e a retorna.
 *
 * Usada no fluxo de adicionar transação: o MVP não tem tela de gestão de
 * contas, então a primeira transação cria a conta padrão implicitamente.
 *
 * @returns A primeira conta existente, ou uma "Carteira" recém-criada.
 */
export async function getOrCreateDefaultAccount(): Promise<Account> {
  const existing = await listAccounts();
  if (existing.length > 0) {
    return existing[0];
  }
  return createAccount('Carteira');
}
