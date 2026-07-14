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
 * Orçamento mensal por tag.
 */
export interface Budget {
  id: string;
  tag_id: string;
  limit_cents: number;
  created_at: number;
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
 */
export interface ParsedStatementItem {
  description: string;
  amount_cents: number;
  type: TransactionType;
  occurred_at: number;
  is_installment: boolean;
  installment_current: number | null;
  installment_total: number | null;
}
