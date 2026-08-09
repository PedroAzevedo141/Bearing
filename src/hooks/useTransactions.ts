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
  listTransactionsForMonth,
  updateTransaction,
} from '../db/queries/transactions';
import type { Transaction, TransactionType } from '../types';
import { shiftMonth, type MonthRef } from '../utils/date';
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
  /** Transações da competência, mais recentes primeiro. */
  transactions: Transaction[];
  /** Saldo líquido da competência em centavos. */
  netFlowCents: number;
  /**
   * Saldo líquido do mês anterior em centavos, para comparação. É `null`
   * enquanto carrega — a UI precisa distinguir "ainda não sei" de "foi zero",
   * senão mostraria uma variação inventada no primeiro frame.
   */
  previousNetFlowCents: number | null;
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
 * Carrega e mantém as transações de uma competência mensal.
 *
 * Carrega também o mês anterior, porque um saldo isolado não diz se o mês foi
 * bom — só a comparação diz.
 *
 * @param month - Competência a exibir (mês 1-12 + ano).
 * @returns Estado reativo + ações de escrita.
 */
export function useTransactions(month: MonthRef): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [previousNetFlowCents, setPreviousNetFlowCents] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const { month: monthNumber, year } = month;

  const refresh = useCallback(async () => {
    const previous = shiftMonth({ month: monthNumber, year }, -1);
    const [rows, previousRows] = await Promise.all([
      listTransactionsForMonth(monthNumber, year),
      listTransactionsForMonth(previous.month, previous.year),
    ]);
    setTransactions(rows);
    setPreviousNetFlowCents(calculateNetFlow(previousRows));
    setLoading(false);
  }, [monthNumber, year]);

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
    previousNetFlowCents,
    loading,
    addTransaction,
    editTransaction,
    removeTransaction,
    refresh,
  };
}
