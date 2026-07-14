import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { getBudgetsWithProgress, upsertBudget, deleteBudget, BudgetWithProgress } from '../db/queries/budgets';

/**
 * Hook para gerenciar estado dos orçamentos mensais e suas barras de progresso.
 * Dispara notificação se alguma tag atinge >= 90% do limite.
 */
export function useBudgets() {
  const [budgets, setBudgets] = useState<BudgetWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getBudgetsWithProgress();
    setBudgets(result);
    setLoading(false);
    
    // Checagem de 90%
    for (const b of result) {
      if (b.spentCents >= b.limit_cents * 0.9 && b.spentCents < b.limit_cents) {
        // Dispara notificação (pode já ter sido disparada antes, ideal seria um controle fino, 
        // mas pro MVP é um aviso válido).
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Atenção ao orçamento! ⚠️',
            body: `Você já atingiu 90% do seu limite mensal para "${b.tagName}".`,
          },
          trigger: null, // Dispara imediatamente
        });
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveBudget = useCallback(async (tagId: string, limitCents: number) => {
    // Pedir permissão de notificação no primeiro orçamento configurado
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }

    await upsertBudget(tagId, limitCents);
    await load();
  }, [load]);

  const removeBudget = useCallback(async (id: string) => {
    await deleteBudget(id);
    await load();
  }, [load]);

  return { budgets, loading, load, saveBudget, removeBudget };
}
