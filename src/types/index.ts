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
 * Carteira/conta que o usuário mantém (ex: "Carteira", "Conta corrente").
 */
export interface Account {
  /** UUID gerado no client (expo-crypto). */
  id: string;
  name: string;
  /** Unix timestamp em segundos. */
  created_at: number;
}

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
  account_id: string;
  tag_id: string | null;
  /** Valor absoluto em centavos; o sinal é dado por `type`. */
  amount_cents: number;
  type: TransactionType;
  description: string | null;
  /** Unix timestamp (segundos) da data real da transação. */
  occurred_at: number;
  /** Unix timestamp (segundos) da criação do registro. */
  created_at: number;
}

/**
 * Compra parcelada — entidade própria, não N linhas em `transactions`,
 * porque a projeção de "quanto falta pagar" exige o total e a posição atual.
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
  /** Parcela atual, 1-indexed. */
  current_installment: number;
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
