# Modelo de dados (SQLite)

O código em [src/db/schema.ts](../src/db/schema.ts) documenta **o quê**; este arquivo documenta **o porquê** de cada escolha. Mudanças de schema entram como migrations em [src/db/migrations/](../src/db/migrations/) — nunca editando uma migration já aplicada — e devem atualizar este documento.

## Por que centavos, nunca float

**Valores monetários são sempre `INTEGER` em centavos, nunca `REAL`.** Aritmética de ponto flutuante em dinheiro gera erro de arredondamento acumulado (`0.1 + 0.2 !== 0.3`) — é o tipo de bug que só aparece depois de meses de uso e é doloroso de rastrear. Float só existe no último instante, dentro do `Intl.NumberFormat`, para exibição ([src/utils/money.ts](../src/utils/money.ts)).

## Por que UUIDs gerados no client

Não há servidor para emitir IDs sequenciais, e IDs aleatórios deixam a porta aberta para uma futura sincronização entre dispositivos (ADR-0002) sem colisão de chaves. Gerados com `expo-crypto`.

## Por que timestamps unix (segundos) em `INTEGER`

Comparações e janelas de período (`occurred_at >= ?`) viram aritmética simples de inteiros, sem parsing de string de data e sem ambiguidade de fuso — a conversão para data local acontece só na UI.

## Tabelas

### `accounts`

Carteiras/contas que o usuário mantém (ex: "Carteira", "Conta corrente"). O MVP cria uma conta padrão implicitamente na primeira transação; a tabela já existe separada para que múltiplas contas não exijam migração de dados depois.

### `tags`

Categorias **livres**, criadas pelo usuário (ex: "mercado", "lazer", "namorada") — sem taxonomia imposta. `name` é `UNIQUE`: a tag nasce na primeira digitação e é reutilizada dali em diante (`getOrCreateTag`). `color` é opcional e existe só para a UI.

### `transactions`

Toda movimentação **avulsa** (não-parcelada). `amount_cents` guarda o valor absoluto e `type` (`income`/`expense`) dá o sinal — mais explícito para a UI e para o `CHECK` do banco do que valores negativos implícitos. `occurred_at` (data real) é separado de `created_at` (registro) para permitir lançamentos retroativos. Índice em `occurred_at` porque toda leitura da aba Rotação filtra por período.

### `installment_purchases`

Compras parceladas são **entidade própria, não N linhas em `transactions`**. Motivos:

- A projeção de "quanto falta pagar" exige `total`, `installment_count` e `current_installment` juntos — reconstruir isso a partir de N transações espalhadas é frágil.
- A parcela mensal é derivada (`total / count`) e nunca armazenada, eliminando a possibilidade de os dois valores divergirem.
- Excluir/editar a compra é uma operação atômica em uma linha.

`current_installment` é 1-indexed (parcela em que a compra está, não quantas foram pagas).

### `goals`

Metas financeiras com progresso manual (`current_amount_cents`, atualizado por aportes do usuário). O MVP não infere aportes a partir de transações — a ligação automática seria adivinhação. `deadline` é opcional porque nem toda meta tem prazo.

### `ai_insights_cache`

Resultado das chamadas de IA, cacheado localmente para não rechamar a API (que custa dinheiro) a cada abertura do app. `kind` distingue dica geral (`general_tip`) de plano de meta (`goal_plan`, com `related_id` = id da meta). `payload_json` guarda a resposta estruturada serializada — o cache não impõe schema porque o formato pertence ao contrato do Worker ([API_CONTRACTS.md](API_CONTRACTS.md)). Validade de 24h, aplicada na leitura ([src/db/queries/aiCache.ts](../src/db/queries/aiCache.ts)).

## Migrations

Runner próprio em [src/db/index.ts](../src/db/index.ts) usando `PRAGMA user_version` como marcador — sem dependência extra para uma necessidade simples. Cada migration roda dentro de uma transação: ou aplica inteira, ou o banco fica na versão anterior consistente.

| Versão | Migration | Conteúdo |
| --- | --- | --- |
| 1 | `initial-schema` | Todas as tabelas acima |
