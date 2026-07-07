/**
 * useGoals.ts
 *
 * Hook da aba Metas: lista metas, cria novas e registra aportes.
 */
import { useCallback, useEffect, useState } from 'react';

import { addToGoal, createGoal, deleteGoal, listGoals } from '../db/queries/goals';
import type { Goal } from '../types';

/** Estado e ações expostos pelo hook. */
export interface UseGoalsResult {
  goals: Goal[];
  loading: boolean;
  addGoal: (input: { name: string; targetCents: number; deadline: Date | null }) => Promise<void>;
  /** Soma um aporte (centavos) ao progresso da meta. */
  contribute: (goalId: string, deltaCents: number) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Carrega e mantém as metas financeiras.
 *
 * @returns Estado reativo + ações de escrita.
 */
export function useGoals(): UseGoalsResult {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setGoals(await listGoals());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addGoal = useCallback(
    async (input: { name: string; targetCents: number; deadline: Date | null }) => {
      await createGoal({
        name: input.name,
        target_amount_cents: input.targetCents,
        deadline: input.deadline ? Math.floor(input.deadline.getTime() / 1000) : null,
      });
      await refresh();
    },
    [refresh]
  );

  const contribute = useCallback(
    async (goalId: string, deltaCents: number) => {
      await addToGoal(goalId, deltaCents);
      await refresh();
    },
    [refresh]
  );

  const removeGoal = useCallback(
    async (id: string) => {
      await deleteGoal(id);
      await refresh();
    },
    [refresh]
  );

  return { goals, loading, addGoal, contribute, removeGoal, refresh };
}
