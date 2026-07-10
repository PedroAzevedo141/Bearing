/**
 * schema.ts
 *
 * Definição das tabelas do SQLite local. Este arquivo é a fonte de verdade
 * do schema; cada mudança futura entra como uma nova migration em
 * src/db/migrations (nunca editando uma migration já aplicada).
 *
 * Decisões de modelagem (o *porquê*) estão em docs/DATA_MODEL.md.
 * Regra inegociável: dinheiro sempre em centavos (INTEGER), nunca REAL.
 *
 * Relacionado: docs/DATA_MODEL.md, src/db/migrations/
 */

/**
 * SQL do schema inicial (versão 1). Executado pela migration 0001.
 */
export const SCHEMA_V1 = `
-- accounts: carteiras/contas que o usuário mantém (ex: "Carteira", "Conta corrente")
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,              -- uuid gerado no client
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL       -- unix timestamp
);

-- tags: categorias livres, criadas pelo usuário (ex: "mercado", "lazer")
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT                        -- hex, pra UI
);

-- transactions: toda movimentação avulsa (não-parcelada)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  tag_id TEXT REFERENCES tags(id),
  amount_cents INTEGER NOT NULL,    -- sempre em centavos, nunca float
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT,
  occurred_at INTEGER NOT NULL,     -- unix timestamp da data real da transação
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at);

-- installment_purchases: compras parceladas, entidade própria
-- (não são N linhas em transactions — a projeção de "quanto falta pagar" exige isso)
CREATE TABLE IF NOT EXISTS installment_purchases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,               -- ex: "Notebook Dell"
  tag_id TEXT REFERENCES tags(id),
  total_amount_cents INTEGER NOT NULL,
  installment_count INTEGER NOT NULL,      -- total de parcelas
  current_installment INTEGER NOT NULL,    -- parcela atual (1-indexed)
  first_due_date INTEGER NOT NULL,         -- unix timestamp da 1ª parcela
  created_at INTEGER NOT NULL
);

-- goals: metas financeiras
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,               -- ex: "Viagem pra Fernando de Noronha"
  target_amount_cents INTEGER NOT NULL,
  current_amount_cents INTEGER NOT NULL DEFAULT 0,
  deadline INTEGER,                 -- unix timestamp, opcional
  created_at INTEGER NOT NULL
);

-- ai_insights_cache: resultado das chamadas de IA, cacheado localmente
-- evita rechamar a API a cada abertura do app
CREATE TABLE IF NOT EXISTS ai_insights_cache (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('general_tip', 'goal_plan')),
  related_id TEXT,                  -- goal_id quando kind = 'goal_plan'
  payload_json TEXT NOT NULL,       -- resposta estruturada da IA, serializada
  generated_at INTEGER NOT NULL
);
`;

/**
 * SQL da migration v2: trava invariantes de negócio como `CHECK` no banco
 * (defesa em profundidade — validação de UI não substitui trava no banco,
 * ver docs/DATA_MODEL.md).
 *
 * SQLite não suporta `ALTER TABLE ... ADD CONSTRAINT` nem adicionar `CHECK`
 * a uma coluna existente, então as duas tabelas são reconstruídas pelo
 * procedimento padrão do próprio SQLite: cria a tabela nova já com o
 * `CHECK`, copia os dados, apaga a antiga, renomeia a nova. Nenhuma outra
 * tabela referencia `transactions`/`installment_purchases` via chave
 * estrangeira, então o rebuild é seguro sem mexer em `PRAGMA foreign_keys`
 * (que, de todo modo, não pode ser alterado dentro de uma transação).
 */
export const SCHEMA_V2_CONSTRAINTS = `
CREATE TABLE transactions_new (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  tag_id TEXT REFERENCES tags(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT,
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
INSERT INTO transactions_new SELECT * FROM transactions;
DROP TABLE transactions;
ALTER TABLE transactions_new RENAME TO transactions;
CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at);

CREATE TABLE installment_purchases_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tag_id TEXT REFERENCES tags(id),
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents > 0),
  installment_count INTEGER NOT NULL,
  current_installment INTEGER NOT NULL,
  first_due_date INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (current_installment BETWEEN 1 AND installment_count)
);
INSERT INTO installment_purchases_new SELECT * FROM installment_purchases;
DROP TABLE installment_purchases;
ALTER TABLE installment_purchases_new RENAME TO installment_purchases;
`;
