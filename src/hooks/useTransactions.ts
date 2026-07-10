/**
 * useTransactions.ts
 *
 * Hook da aba Rotação: carrega as transações do período, expõe o saldo
 * líquido e a criação de novas transações. É a única ponte entre a UI e
 * src/db/queries/transactions.ts.
 */
import { useCallback, useEffect, useState } from 'react';

import { getOrCreateDefaultAccount } from '../db/queries/accounts';
import { getOrCreateTag } from '../db/queries/tags';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '../db/queries/transactions';
import type { Transaction, TransactionType } from '../types';
import { calculateNetFlow } from '../utils/money';

/** Campos editáveis de uma transação, comuns a criar e editar. */
export interface TransactionInput {
  amountCents: number;
  type: TransactionType;
  description: string | null;
  tagName: string | null;
}

/** Estado e ações expostos pelo hook. */
export interface UseTransactionsResult {
  /** Transações do período, mais recentes primeiro. */
  transactions: Transaction[];
  /** Saldo líquido do período em centavos. */
  netFlowCents: number;
  /** true enquanto a primeira carga não terminou. */
  loading: boolean;
  /** Registra uma transação; a tag é criada se não existir. */
  addTransaction: (input: TransactionInput) => Promise<void>;
  /**
   * Atualiza uma transação existente; a tag é criada se não existir.
   * Preserva `account_id` e `occurred_at` do registro original — o
   * formulário não coleta esses campos.
   */
  editTransaction: (original: Transaction, input: TransactionInput) => Promise<void>;
  /** Remove uma transação e recarrega a lista. */
  removeTransaction: (id: string) => Promise<void>;
  /** Recarrega a lista manualmente (pull-to-refresh). */
  refresh: () => Promise<void>;
}

/**
 * Carrega e mantém as transações de uma janela de dias.
 *
 * @param periodDays - Janela do período (ex: 30 para "último mês").
 * @returns Estado reativo + ações de escrita.
 */
export function useTransactions(periodDays: number): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await listTransactions(periodDays);
    setTransactions(rows);
    setLoading(false);
  }, [periodDays]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addTransaction = useCallback(
    async (input: TransactionInput) => {
      const account = await getOrCreateDefaultAccount();
      const tag = input.tagName ? await getOrCreateTag(input.tagName) : null;
      await createTransaction({
        account_id: account.id,
        tag_id: tag?.id ?? null,
        amount_cents: input.amountCents,
        type: input.type,
        description: input.description,
      });
      await refresh();
    },
    [refresh]
  );

  const editTransaction = useCallback(
    async (original: Transaction, input: TransactionInput) => {
      const tag = input.tagName ? await getOrCreateTag(input.tagName) : null;
      await updateTransaction(original.id, {
        account_id: original.account_id,
        tag_id: tag?.id ?? null,
        amount_cents: input.amountCents,
        type: input.type,
        description: input.description,
        occurred_at: original.occurred_at,
      });
      await refresh();
    },
    [refresh]
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      await deleteTransaction(id);
      await refresh();
    },
    [refresh]
  );

  return {
    transactions,
    netFlowCents: calculateNetFlow(transactions),
    loading,
    addTransaction,
    editTransaction,
    removeTransaction,
    refresh,
  };
}
