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
  deleteBudget,
  getBudgetsWithProgress,
  upsertBudget,
} from '../db/queries/budgets';
import { notifyBudgetThreshold } from '../services/notificationService';

/** Estado e ações da aba Orçamento. */
export interface UseBudgetsResult {
  budgets: BudgetWithProgress[];
  loading: boolean;
  load: () => Promise<void>;
  /** Cria ou atualiza o orçamento de uma tag. */
  saveBudget: (tagId: string, limitCents: number) => Promise<void>;
  /** Remove o orçamento de uma tag. */
  removeBudget: (id: string) => Promise<void>;
}

/**
 * Carrega os orçamentos com progresso do mês e dispara o aviso de 90%.
 *
 * O aviso é disparado no máximo uma vez por tag por sessão (controle em
 * memória), pra não repetir o alerta a cada `load()` enquanto a tag segue na
 * faixa de 90–100%.
 *
 * @returns Estado reativo + ações de escrita.
 */
export function useBudgets(): UseBudgetsResult {
  const [budgets, setBudgets] = useState<BudgetWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const alertedTags = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getBudgetsWithProgress();
    setBudgets(result);
    setLoading(false);

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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveBudget = useCallback(
    async (tagId: string, limitCents: number) => {
      await upsertBudget(tagId, limitCents);
      await load();
    },
    [load]
  );

  const removeBudget = useCallback(
    async (id: string) => {
      await deleteBudget(id);
      await load();
    },
    [load]
  );

  return { budgets, loading, load, saveBudget, removeBudget };
}
