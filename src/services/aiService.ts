/**
 * aiService.ts
 *
 * Camada de comunicação com o Cloudflare Worker de IA. Dicas e chat usam
 * agregações. PDF bruto só é enviado no fluxo opt-in de importação, depois
 * de consentimento explícito (ver docs/API_CONTRACTS.md).
 *
 * O cache local (ai_insights_cache) é responsabilidade dos hooks/queries;
 * este módulo só fala HTTP com o Worker.
 *
 * Relacionado: docs/API_CONTRACTS.md, docs/AI_PROMPTS.md, worker/src/index.ts
 */
import Constants from 'expo-constants';

import type {
  AiInsightRequest,
  AiInsightResponse,
  ChatRequest,
  ChatResponse,
  GoalPlanRequest,
  GoalPlanResponse,
  PdfStatementExtractionResponse,
  ParseStatementResponse,
} from '../types';

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

/**
 * Lê a configuração do Worker.
 *
 * O secret fica em `.env.local` (ou em uma variável de ambiente do EAS),
 * nunca no `app.json` versionado. Como ainda é uma configuração do cliente,
 * ele continua visível no bundle final; portanto é apenas uma barreira contra
 * uso casual e deve ser rotacionado quando exposto.
 */
function getWorkerConfig(): { url: string; secret: string } {
  const extra = Constants.expoConfig?.extra ?? {};
  const url = process.env.EXPO_PUBLIC_AI_WORKER_URL ?? (extra.aiWorkerUrl as string | undefined);
  const secret = process.env.EXPO_PUBLIC_AI_APP_SECRET;
  if (!url || !secret) {
    throw new AiServiceError(
      0,
      'Worker de IA não configurado (defina EXPO_PUBLIC_AI_APP_SECRET em .env.local)'
    );
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

/**
 * Envia um turno do chat ao Worker e devolve a resposta bruta da Claude API.
 *
 * O contexto financeiro entra no `system_prompt` (montado pelo chamador com
 * dados agregados — nunca transações individuais). A resposta pode conter
 * blocos `tool_use`; a execução das tools e a re-chamada são responsabilidade
 * do hook `useChat`, não deste serviço.
 *
 * @param request - System prompt + histórico (últimas mensagens/blocos).
 * @returns A `Message` da Claude API (só o campo `content` é usado).
 * @throws {AiServiceError} Ver códigos em docs/API_CONTRACTS.md.
 */
export function fetchChat(request: ChatRequest): Promise<ChatResponse> {
  return postToWorker<ChatResponse>('/ai/chat', request);
}

/**
 * Envia o texto de extrato (já revisado pelo usuário na Confirmação 1) ao
 * Worker e recebe os itens classificados via structured output.
 *
 * Este endpoint recebe somente texto. PDFs usam a rota separada de extração;
 * aqui chega o conteúdo já revisado pelo usuário.
 *
 * @param ocrText - Texto do extrato revisado pelo usuário.
 * @returns Itens classificados (transação avulsa ou parcela).
 * @throws {AiServiceError} Ver códigos em docs/API_CONTRACTS.md.
 */
export function fetchParseStatement(ocrText: string): Promise<ParseStatementResponse> {
  return postToWorker<ParseStatementResponse>('/ai/parse-statement', { ocr_text: ocrText });
}

/**
 * Envia um PDF escolhido e autorizado pelo usuário para extração temporária.
 * O Worker não persiste o arquivo; devolve somente texto para a primeira revisão.
 */
export function fetchExtractStatementPdf(
  pdfBase64: string
): Promise<PdfStatementExtractionResponse> {
  return postToWorker<PdfStatementExtractionResponse>('/ai/extract-statement-pdf', {
    pdf_base64: pdfBase64,
  });
}
