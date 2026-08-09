/**
 * useBudgets.ts
 *
 * Hook da aba Orçamento: lista os orçamentos por tag com o gasto do mês
 * corrente, e avisa (notificação local) quando uma tag cruza 90% do limite.
 * Notificação sempre via notificationService (nunca `expo-notifications`
 * direto — isso derruba o app no Expo Go).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BudgetWithProgress,
  deleteBudgetForTag,
  getBudgetsWithProgress,
  setBudget,
} from '../db/queries/budgets';
import { notifyBudgetThreshold } from '../services/notificationService';
import { currentMonthRef, isSameMonth, type MonthRef } from '../utils/date';

/** Estado e ações da aba Orçamento. */
export interface UseBudgetsResult {
  budgets: BudgetWithProgress[];
  loading: boolean;
  load: () => Promise<void>;
  /** Define o limite de uma tag a partir da competência exibida. */
  saveBudget: (tagId: string, limitCents: number) => Promise<void>;
  /** Deixa de orçar uma tag (apaga todas as versões do limite). */
  removeBudget: (tagId: string) => Promise<void>;
}

/**
 * Carrega os orçamentos vigentes numa competência, com o gasto do mês, e
 * dispara o aviso de 90%.
 *
 * O aviso é disparado no máximo uma vez por tag por sessão (controle em
 * memória), pra não repetir o alerta a cada `load()` enquanto a tag segue na
 * faixa de 90–100%. Só vale para o mês corrente: avisar sobre um limite
 * estourado em março, ao navegar até março, seria alarme sobre passado — nada
 * a fazer a respeito.
 *
 * @param month - Competência a exibir. Default: mês corrente.
 * @returns Estado reativo + ações de escrita.
 */
export function useBudgets(month: MonthRef = currentMonthRef()): UseBudgetsResult {
  const [budgets, setBudgets] = useState<BudgetWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const alertedTags = useRef<Set<string>>(new Set());
  const { month: monthNumber, year } = month;

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getBudgetsWithProgress(monthNumber, year);
    setBudgets(result);
    setLoading(false);

    if (!isSameMonth({ month: monthNumber, year }, currentMonthRef())) {
      return;
    }
    for (const b of result) {
      const crossed90 = b.spentCents >= b.limit_cents * 0.9 && b.spentCents < b.limit_cents;
      if (crossed90 && !alertedTags.current.has(b.tag_id)) {
        alertedTags.current.add(b.tag_id);
        void notifyBudgetThreshold(b.tagName, b.spentCents, b.limit_cents);
      }
      if (b.spentCents < b.limit_cents * 0.9) {
        // Voltou pra baixo de 90% (novo mês / gasto removido): rearma o aviso.
        alertedTags.current.delete(b.tag_id);
      }
    }
  }, [monthNumber, year]);

  useEffect(() => {
    load();
  }, [load]);

  const saveBudget = useCallback(
    async (tagId: string, limitCents: number) => {
      await setBudget(tagId, limitCents, monthNumber, year);
      await load();
    },
    [load, monthNumber, year]
  );

  const removeBudget = useCallback(
    async (tagId: string) => {
      await deleteBudgetForTag(tagId);
      await load();
    },
    [load]
  );

  return { budgets, loading, load, saveBudget, removeBudget };
}
