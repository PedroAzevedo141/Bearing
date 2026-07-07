/**
 * aiService.ts
 *
 * Camada de comunicação com o Cloudflare Worker de IA. Nenhum dado bruto de
 * transação sai daqui — sempre agregações (ver docs/API_CONTRACTS.md).
 *
 * O cache local (ai_insights_cache) é responsabilidade dos hooks/queries;
 * este módulo só fala HTTP com o Worker.
 *
 * Relacionado: docs/API_CONTRACTS.md, docs/AI_PROMPTS.md, worker/src/index.ts
 */
import Constants from 'expo-constants';

import type { AiInsightRequest, AiInsightResponse, GoalPlanRequest, GoalPlanResponse } from '../types';

/**
 * Erro de comunicação com o Worker, com o status HTTP preservado para a UI
 * distinguir rate limit (429) de erro real (500).
 */
export class AiServiceError extends Error {
  /** Status HTTP retornado pelo Worker, ou 0 para falha de rede. */
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AiServiceError';
    this.status = status;
  }
}

/** Lê a configuração do Worker do app.json (expo.extra). */
function getWorkerConfig(): { url: string; secret: string } {
  const extra = Constants.expoConfig?.extra ?? {};
  const url = extra.aiWorkerUrl as string | undefined;
  const secret = extra.aiAppSecret as string | undefined;
  if (!url || !secret) {
    throw new AiServiceError(0, 'Worker de IA não configurado (expo.extra em app.json)');
  }
  return { url, secret };
}

/**
 * POST genérico ao Worker com o header de autenticação.
 *
 * @throws {AiServiceError} 401 (secret inválido), 429 (rate limit),
 *   500 (erro upstream) ou 0 (sem rede).
 */
async function postToWorker<T>(path: string, body: unknown): Promise<T> {
  const { url, secret } = getWorkerConfig();
  let response: Response;
  try {
    response = await fetch(`${url}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Secret': secret,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AiServiceError(0, 'Sem conexão com o serviço de IA');
  }
  if (!response.ok) {
    throw new AiServiceError(response.status, `Serviço de IA respondeu ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * Pede uma dica financeira com base no resumo agregado do período.
 *
 * @param summary - Agregados do período (saldo por tag + fluxo líquido).
 *   Nunca inclui transações individuais.
 * @returns Texto da dica e timestamp de geração.
 * @throws {AiServiceError} Ver códigos em docs/API_CONTRACTS.md.
 *
 * @example
 * const { insight } = await fetchInsight({
 *   period_days: 30,
 *   balance_by_tag: [{ tag: 'mercado', total_cents: -45000 }],
 *   net_flow_cents: -8000,
 * });
 */
export function fetchInsight(summary: AiInsightRequest): Promise<AiInsightResponse> {
  return postToWorker<AiInsightResponse>('/ai/insights', summary);
}

/**
 * Pede um plano de ação estruturado para uma meta financeira.
 *
 * @param request - Meta (nome, alvo, progresso, prazo) e capacidade mensal
 *   de poupança estimada pelo usuário.
 * @returns Plano tipado (passos + sugestão mensal + estimativa de meses) —
 *   o Worker força JSON via structured output, nunca texto solto.
 * @throws {AiServiceError} Ver códigos em docs/API_CONTRACTS.md.
 */
export function fetchGoalPlan(request: GoalPlanRequest): Promise<GoalPlanResponse> {
  return postToWorker<GoalPlanResponse>('/ai/goal-plan', request);
}
