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

/**
 * SQL da migration v3: Chat
 */
export const SCHEMA_V3_CHAT = `
CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

/**
 * SQL da migration v4: Orçamentos
 */
export const SCHEMA_V4_BUDGETS = `
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES tags(id),
  limit_cents INTEGER NOT NULL CHECK (limit_cents > 0),
  created_at INTEGER NOT NULL
);
`;

/**
 * SQL da migration v5: Assinaturas Recorrentes
 */
export const SCHEMA_V5_RECURRING = `
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  tag_id TEXT REFERENCES tags(id),
  created_at INTEGER NOT NULL
);
`;

/**
 * SQL da migration v6: remove `current_installment` de `installment_purchases`.
 *
 * A parcela atual passou a ser derivada de `first_due_date` + data de hoje
 * (`currentInstallmentFor` em src/utils/money.ts). A coluna era um contador que
 * nada no app avançava automaticamente: congelava no valor digitado no cadastro
 * e envelhecia em silêncio. Pior, o `CHECK` da v2 (`BETWEEN 1 AND
 * installment_count`) tornava impossível representar "quitada", que a UI define
 * como `current_installment > installment_count` — a seção "Concluídas" da aba
 * Parcelas era inalcançável por construção.
 *
 * Mesmo procedimento de rebuild da v2, pelo mesmo motivo (o `CHECK` composto
 * cita a coluna removida e precisa sair junto). Nenhuma tabela referencia
 * `installment_purchases` por chave estrangeira, então o rebuild é seguro.
 */
export const SCHEMA_V6_DERIVED_INSTALLMENT = `
CREATE TABLE installment_purchases_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tag_id TEXT REFERENCES tags(id),
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents > 0),
  installment_count INTEGER NOT NULL CHECK (installment_count >= 1),
  first_due_date INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
INSERT INTO installment_purchases_new
  SELECT id, name, tag_id, total_amount_cents, installment_count, first_due_date, created_at
  FROM installment_purchases;
DROP TABLE installment_purchases;
ALTER TABLE installment_purchases_new RENAME TO installment_purchases;
`;

/**
 * SQL da migration v7: liga uma transação à assinatura que a originou.
 *
 * Sem esse vínculo não há como saber se a cobrança do mês de uma assinatura já
 * foi lançada, e o app dependia inteiramente de o usuário ter visto a
 * notificação: se ela passasse batida, a despesa nunca era registrada e o saldo
 * e o orçamento ficavam silenciosamente errados.
 *
 * Deduzir por semelhança de descrição foi descartado — quebraria assim que o
 * usuário editasse o texto da transação, e falha silenciosa em dado financeiro
 * é justamente o que se quer evitar aqui.
 *
 * A coluna é opcional: transação avulsa continua sem vínculo. `ALTER TABLE ...
 * ADD COLUMN` basta (não há `CHECK` novo), então não é preciso reconstruir a
 * tabela como nas v2 e v6.
 */
export const SCHEMA_V7_RECURRING_LINK = `
ALTER TABLE transactions ADD COLUMN recurring_id TEXT REFERENCES recurring_transactions(id);
CREATE INDEX IF NOT EXISTS idx_transactions_recurring_id ON transactions(recurring_id);
`;

/**
 * SQL da migration v8: versiona o limite de orçamento no tempo.
 *
 * O limite era um valor único por tag, sem noção de quando passou a valer. Com
 * a aba Rotação navegando por meses passados, isso mentiria sobre o passado:
 * quem subisse o limite de R$ 500 para R$ 800 veria março ser avaliado contra
 * 800, e um mês em que estourou passaria a parecer dentro do orçamento. A
 * pergunta "eu respeitei o orçamento em março?" só tem resposta honesta contra
 * o limite que valia em março.
 *
 * Cada alteração vira uma linha nova com `effective_from` (início do mês em que
 * passa a valer), e a leitura de uma competência pega a linha vigente mais
 * recente até ali. O índice único impede duas versões para o mesmo mês.
 *
 * `DEFAULT 0` (epoch) para as linhas existentes: não há registro de quando
 * foram definidas, e tratá-las como "sempre valeram" é a leitura honesta —
 * qualquer outra data seria invenção.
 */
export const SCHEMA_V8_BUDGET_HISTORY = `
ALTER TABLE budgets ADD COLUMN effective_from INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_tag_effective ON budgets(tag_id, effective_from);
`;

/**
 * SQL da migration v9: remove o conceito de contas/carteiras.
 *
 * `accounts` existia desde a v1, mas nenhuma tela jamais a expôs: o app criava
 * uma "Carteira" implícita no primeiro uso e usava sempre ela. Toda transação
 * carregava um `account_id` que nunca variava — cerimônia sem informação.
 *
 * Tabela viva que ninguém usa é pior que ausência: confunde quem lê o schema
 * depois, e o `NOT NULL` obrigava cada caminho de escrita a resolver uma conta
 * que não significava nada (a tela de confirmação de assinatura chegava a
 * passar a string `'temp'` só para satisfazer o tipo).
 *
 * O Bearing é sobre **fluxo** de dinheiro, não sobre saldo por conta, e o caso
 * de uso mais próximo — cartão de crédito — já é coberto por
 * `installment_purchases`. Se um dia contas voltarem, voltam como feature
 * desenhada, com tela e migration próprias.
 */
export const SCHEMA_V9_DROP_ACCOUNTS = `
CREATE TABLE transactions_new (
  id TEXT PRIMARY KEY,
  tag_id TEXT REFERENCES tags(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT,
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  recurring_id TEXT REFERENCES recurring_transactions(id)
);
INSERT INTO transactions_new
  SELECT id, tag_id, amount_cents, type, description, occurred_at, created_at, recurring_id
  FROM transactions;
DROP TABLE transactions;
ALTER TABLE transactions_new RENAME TO transactions;
CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_transactions_recurring_id ON transactions(recurring_id);
DROP TABLE IF EXISTS accounts;
`;

/**
 * SQL da migration v10: preferências do app.
 *
 * Tabela chave/valor genérica em vez de uma coluna por preferência: são
 * escolhas de interface, sem relação entre si, e cada nova exigiria uma
 * migration própria. Como já existe SQLite aberto e migrado, guardar aqui evita
 * trazer `AsyncStorage` só para isto — uma dependência a mais para um dado que
 * o banco já sabe persistir.
 *
 * Não guarda nada sensível: preferência de tema não é dado financeiro.
 */
export const SCHEMA_V10_SETTINGS = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
