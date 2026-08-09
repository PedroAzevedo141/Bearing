/**
 * types/index.ts
 *
 * Tipos e interfaces compartilhados entre a camada de dados (src/db),
 * serviços (src/services), hooks e componentes de UI. Espelham 1:1 o schema
 * SQLite documentado em docs/DATA_MODEL.md.
 *
 * Relacionado: docs/DATA_MODEL.md, docs/API_CONTRACTS.md
 */

/** Sentido de uma transação: entrada ou saída de dinheiro. */
export type TransactionType = 'income' | 'expense';

/** Tipos de resultado de IA cacheados localmente. */
export type AiInsightKind = 'general_tip' | 'goal_plan';

/**
 * Categoria livre criada pelo usuário (ex: "mercado", "lazer").
 */
export interface Tag {
  id: string;
  /** Único no banco — a UI deve tratar conflito de nome. */
  name: string;
  /** Cor hex opcional para a UI (ex: "#E07A5F"). */
  color: string | null;
}

/**
 * Movimentação financeira avulsa (não-parcelada).
 *
 * Valores monetários são sempre em centavos (INTEGER), nunca float —
 * ver docs/DATA_MODEL.md para o porquê.
 */
export interface Transaction {
  id: string;
  tag_id: string | null;
  /** Valor absoluto em centavos; o sinal é dado por `type`. */
  amount_cents: number;
  type: TransactionType;
  description: string | null;
  /** Unix timestamp (segundos) da data real da transação. */
  occurred_at: number;
  /** Unix timestamp (segundos) da criação do registro. */
  created_at: number;
  /**
   * Assinatura que originou esta cobrança, quando houver. É o que permite
   * saber que a assinatura do mês já foi lançada — ver ADR-0008.
   */
  recurring_id?: string | null;
}

/**
 * Compra parcelada — entidade própria, não N linhas em `transactions`,
 * porque a projeção de "quanto falta pagar" exige o total e a posição atual.
 *
 * A parcela atual **não** é um campo: deriva de `first_due_date` + hoje, via
 * `currentInstallmentFor` (src/utils/money.ts). Ver docs/DATA_MODEL.md.
 */
export interface InstallmentPurchase {
  id: string;
  /** Ex: "Notebook Dell". */
  name: string;
  tag_id: string | null;
  /** Valor total da compra em centavos. */
  total_amount_cents: number;
  /** Total de parcelas. */
  installment_count: number;
  /** Unix timestamp (segundos) do vencimento da 1ª parcela. */
  first_due_date: number;
  created_at: number;
}

/**
 * Meta financeira (ex: "Viagem pra Fernando de Noronha").
 */
export interface Goal {
  id: string;
  name: string;
  target_amount_cents: number;
  current_amount_cents: number;
  /** Unix timestamp (segundos), opcional. */
  deadline: number | null;
  created_at: number;
}

/**
 * Conversa de chat com a IA.
 */
export interface ChatConversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

/**
 * Mensagem em uma conversa de chat.
 */
export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
}

/**
 * Limite mensal de gasto de uma tag, vigente a partir de uma competência.
 *
 * Há uma linha por versão do limite: alterar o valor num mês novo cria outra
 * linha em vez de sobrescrever, para que meses passados continuem avaliados
 * contra o limite que valia à época. Ver docs/DATA_MODEL.md.
 */
export interface Budget {
  id: string;
  tag_id: string;
  limit_cents: number;
  created_at: number;
  /** Unix timestamp (segundos) do 1º dia do mês em que este limite passou a valer. */
  effective_from: number;
}

/**
 * Assinatura/transação recorrente.
 */
export interface RecurringTransaction {
  id: string;
  name: string;
  amount_cents: number;
  day_of_month: number;
  tag_id: string | null;
  created_at: number;
}

/**
 * Item processado pelo Worker após envio do extrato OCR.
 *
 * Para itens com `is_installment: true`, `amount_cents` é o valor de **uma**
 * parcela (a cobrança que aparece neste extrato) — o total da compra é
 * `amount_cents * installment_total`. Ver docs/API_CONTRACTS.md.
 */
export interface ParsedStatementItem {
  description: string;
  amount_cents: number;
  type: TransactionType;
  occurred_at: number;
  is_installment: boolean;
  installment_current: number | null;
  installment_total: number | null;
  /**
   * Marcado pelo usuário na Confirmação 2 quando o lançamento é uma assinatura
   * recorrente (ex: Netflix). A IA não define isto; é escolha manual. Gera a
   * transação do mês E cadastra/atualiza a recorrência. Ver ADR-0008.
   */
  is_subscription?: boolean;
}

/** Resposta de `POST /ai/parse-statement`. */
export interface ParseStatementResponse {
  items: ParsedStatementItem[];
}

/** Resposta da extração temporária de texto de um PDF de extrato. */
export interface PdfStatementExtractionResponse {
  extracted_text: string;
}

/**
 * Resultado de chamada de IA cacheado localmente, para evitar rechamar o
 * Worker a cada abertura do app.
 */
export interface AiInsightCache {
  id: string;
  kind: AiInsightKind;
  /** goal_id quando kind = 'goal_plan'; null para dicas gerais. */
  related_id: string | null;
  /** Resposta estruturada da IA, serializada em JSON. */
  payload_json: string;
  generated_at: number;
}

// ---------------------------------------------------------------------------
// Contratos do Cloudflare Worker (ver docs/API_CONTRACTS.md)
// ---------------------------------------------------------------------------

/** Total agregado por tag enviado ao Worker — nunca transações individuais. */
export interface TagBalance {
  tag: string;
  /** Negativo = gasto, positivo = entrada, em centavos. */
  total_cents: number;
}

/** Corpo de `POST /ai/insights`. */
export interface AiInsightRequest {
  period_days: number;
  balance_by_tag: TagBalance[];
  net_flow_cents: number;
}

/** Resposta de `POST /ai/insights`. */
export interface AiInsightResponse {
  insight: string;
  generated_at: number;
}

/** Corpo de `POST /ai/goal-plan`. */
export interface GoalPlanRequest {
  goal: {
    name: string;
    target_cents: number;
    current_cents: number;
    /** Unix timestamp (segundos), opcional. */
    deadline: number | null;
  };
  monthly_capacity_cents: number;
}

/** Um passo do plano de ação sugerido pela IA. */
export interface GoalPlanStep {
  order: number;
  description: string;
}

/** Resposta de `POST /ai/goal-plan` — JSON tipado via structured output. */
export interface GoalPlanResponse {
  steps: GoalPlanStep[];
  suggested_monthly_cents: number;
  estimated_months: number;
}

/**
 * Bloco de conteúdo trocado com a Claude API no chat. Subconjunto dos tipos
 * da Anthropic usado pelo client no loop de tool use (o SDK completo só
 * existe no Worker).
 */
export type ChatContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

/**
 * Mensagem no formato que o Worker `/ai/chat` repassa à Claude API
 * (Anthropic `MessageParam`). `content` é texto simples nas mensagens do
 * usuário digitadas na UI, ou uma lista de blocos durante o loop de tools.
 */
export interface ChatApiMessage {
  role: 'user' | 'assistant';
  content: string | ChatContentBlock[];
}

/** Corpo de `POST /ai/chat`. */
export interface ChatRequest {
  /** System prompt já montado com o contexto financeiro fresco. */
  system_prompt: string;
  /** Histórico da conversa (últimas N mensagens + blocos de tool). */
  messages: ChatApiMessage[];
}

/**
 * Resposta de `POST /ai/chat` — a `Message` bruta da Claude API; o client só
 * lê `content` (pode conter blocos `text` e/ou `tool_use`).
 */
export interface ChatResponse {
  content: ChatContentBlock[];
}
