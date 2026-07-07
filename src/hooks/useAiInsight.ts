/**
 * useAiInsight.ts
 *
 * Hooks das features de IA (aba Dicas e plano de meta). Orquestram o fluxo
 * cache-first: lê ai_insights_cache; só chama o Worker se não houver
 * resposta válida (< 24h). O resumo enviado é sempre agregado.
 *
 * Relacionado: src/services/aiService.ts, src/db/queries/aiCache.ts
 */
import { useCallback, useEffect, useState } from 'react';

import { getFreshInsight, saveInsight } from '../db/queries/aiCache';
import { getBalanceByTag, listTransactions } from '../db/queries/transactions';
import { AiServiceError, fetchGoalPlan, fetchInsight } from '../services/aiService';
import type { AiInsightResponse, Goal, GoalPlanResponse } from '../types';
import { calculateNetFlow } from '../utils/money';

/** Janela de análise enviada à IA para a dica geral. */
const INSIGHT_PERIOD_DAYS = 30;

/** Estado comum aos hooks de IA. */
interface AiState<T> {
  data: T | null;
  loading: boolean;
  /** Mensagem amigável de erro, ou null. */
  error: string | null;
}

/** Converte erros do serviço em mensagem exibível. */
function toErrorMessage(err: unknown): string {
  if (err instanceof AiServiceError) {
    if (err.status === 429) {
      return 'Muitas solicitações — tente de novo mais tarde.';
    }
    if (err.status === 0) {
      return 'Sem conexão. A dica volta quando você estiver online.';
    }
    return 'O serviço de IA está indisponível no momento.';
  }
  return 'Algo deu errado ao gerar a dica.';
}

/**
 * Dica financeira geral da aba Dicas, com cache de 24h.
 *
 * @returns Estado da dica + ação para forçar a regeração (`regenerate`).
 */
export function useGeneralTip(): AiState<AiInsightResponse> & { regenerate: () => Promise<void> } {
  const [state, setState] = useState<AiState<AiInsightResponse>>({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async (skipCache: boolean) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      if (!skipCache) {
        const cached = await getFreshInsight('general_tip', null);
        if (cached) {
          setState({ data: JSON.parse(cached.payload_json), loading: false, error: null });
          return;
        }
      }
      const [transactions, balanceByTag] = await Promise.all([
        listTransactions(INSIGHT_PERIOD_DAYS),
        getBalanceByTag(INSIGHT_PERIOD_DAYS),
      ]);
      const response = await fetchInsight({
        period_days: INSIGHT_PERIOD_DAYS,
        balance_by_tag: balanceByTag,
        net_flow_cents: calculateNetFlow(transactions),
      });
      await saveInsight('general_tip', null, response);
      setState({ data: response, loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: toErrorMessage(err) });
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const regenerate = useCallback(() => load(true), [load]);

  return { ...state, regenerate };
}

/**
 * Plano de ação de uma meta, com cache de 24h por meta.
 *
 * O plano só é buscado quando `generate` é chamado (a chamada custa dinheiro;
 * não deve acontecer só por abrir a tela).
 *
 * @param goal - Meta selecionada, ou null enquanto nenhuma está aberta.
 * @returns Estado do plano + ação `generate(monthlyCapacityCents)`.
 */
export function useGoalPlan(goal: Goal | null): AiState<GoalPlanResponse> & {
  generate: (monthlyCapacityCents: number) => Promise<void>;
} {
  const [state, setState] = useState<AiState<GoalPlanResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  // Ao trocar de meta, mostra o plano cacheado dela (se houver), sem rede.
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: false, error: null });
    if (!goal) {
      return;
    }
    getFreshInsight('goal_plan', goal.id).then((cached) => {
      if (cached && !cancelled) {
        setState({ data: JSON.parse(cached.payload_json), loading: false, error: null });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [goal?.id]);

  const generate = useCallback(
    async (monthlyCapacityCents: number) => {
      if (!goal) {
        return;
      }
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const response = await fetchGoalPlan({
          goal: {
            name: goal.name,
            target_cents: goal.target_amount_cents,
            current_cents: goal.current_amount_cents,
            deadline: goal.deadline,
          },
          monthly_capacity_cents: monthlyCapacityCents,
        });
        await saveInsight('goal_plan', goal.id, response);
        setState({ data: response, loading: false, error: null });
      } catch (err) {
        setState((s) => ({ ...s, loading: false, error: toErrorMessage(err) }));
      }
    },
    [goal?.id, goal?.name, goal?.target_amount_cents, goal?.current_amount_cents, goal?.deadline]
  );

  return { ...state, generate };
}
