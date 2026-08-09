# Modelo de dados (SQLite)

O código em [src/db/schema.ts](../src/db/schema.ts) documenta **o quê**; este arquivo documenta **o porquê** de cada escolha. Mudanças de schema entram como migrations em [src/db/migrations/](../src/db/migrations/) — nunca editando uma migration já aplicada — e devem atualizar este documento.

## Por que centavos, nunca float

**Valores monetários são sempre `INTEGER` em centavos, nunca `REAL`.** Aritmética de ponto flutuante em dinheiro gera erro de arredondamento acumulado (`0.1 + 0.2 !== 0.3`) — é o tipo de bug que só aparece depois de meses de uso e é doloroso de rastrear. Float só existe no último instante, dentro do `Intl.NumberFormat`, para exibição ([src/utils/money.ts](../src/utils/money.ts)).

## Por que UUIDs gerados no client

Não há servidor para emitir IDs sequenciais, e IDs aleatórios deixam a porta aberta para uma futura sincronização entre dispositivos (ADR-0002) sem colisão de chaves. Gerados com `expo-crypto`.

## Por que timestamps unix (segundos) em `INTEGER`

Comparações e janelas de período (`occurred_at >= ?`) viram aritmética simples de inteiros, sem parsing de string de data e sem ambiguidade de fuso — a conversão para data local acontece só na UI.

## Tabelas

### `accounts` (removida na v9)

Existia desde a v1 para representar carteiras/contas ("Carteira", "Conta corrente"), apostando que múltiplas contas viriam depois. **Nenhuma tela jamais a expôs**: o app criava uma "Carteira" implícita na primeira transação e usava sempre ela, então todo `account_id` gravado era o mesmo valor — cerimônia sem informação.

Tabela viva que ninguém usa é pior que ausência: confunde quem lê o schema depois, e o `NOT NULL` obrigava cada caminho de escrita a resolver uma conta que não significava nada (a tela de confirmação de assinatura chegava a passar a string `'temp'` só para satisfazer o tipo). O Bearing é sobre **fluxo** de dinheiro, não sobre saldo por conta, e o caso de uso mais próximo — cartão de crédito — já é coberto por `installment_purchases`.

A v9 removeu a tabela e a coluna. Se contas voltarem, voltam como feature desenhada, com tela e migration próprias — a aposta de "deixar pronto para depois" custou mais do que economizou.

### `tags`

Categorias **livres**, criadas pelo usuário (ex: "mercado", "lazer", "namorada") — sem taxonomia imposta. `name` é `UNIQUE`: a tag nasce na primeira digitação e é reutilizada dali em diante (`getOrCreateTag`). `color` é opcional e existe só para a UI.

### `transactions`

Toda movimentação **avulsa** (não-parcelada). `amount_cents` guarda o valor absoluto e `type` (`income`/`expense`) dá o sinal — mais explícito para a UI e para o `CHECK` do banco do que valores negativos implícitos. `occurred_at` (data real) é separado de `created_at` (registro) para permitir lançamentos retroativos. Índice em `occurred_at` porque toda leitura da aba Rotação filtra por período.

### `installment_purchases`

Compras parceladas são **entidade própria, não N linhas em `transactions`**. Motivos:

- A projeção de "quanto falta pagar" exige o total, a quantidade de parcelas e a posição atual juntos — reconstruir isso a partir de N transações espalhadas é frágil.
- A parcela mensal é derivada (`total / count`) e nunca armazenada, eliminando a possibilidade de os dois valores divergirem.
- Excluir/editar a compra é uma operação atômica em uma linha.

**A posição no cronograma também é derivada, não armazenada.** `first_due_date` ancora a compra, e a parcela atual é função dela mais a data de hoje (`currentInstallmentFor` em [src/utils/money.ts](../src/utils/money.ts)); "quitada" é o caso em que essa conta passa de `installment_count` (`isInstallmentCompleted`).

Até a v5 existia uma coluna `current_installment`, e ela ensinou por que contador armazenado é ruim aqui: **nada no app o avançava**. O valor congelava no que foi digitado no cadastro e a projeção de "quanto falta pagar" envelhecia em silêncio — o pior tipo de erro, porque a tela continua plausível. Junto disso, o `CHECK` da v2 (`BETWEEN 1 AND installment_count`) tornava impossível gravar o estado que a UI usava para "concluída" (`current_installment > installment_count`), então a seção "Concluídas" da aba Parcelas era inalcançável por construção. A v6 removeu a coluna.

O mesmo raciocínio já valia para não existir coluna `status`/`completed`: informação que outra coluna determina não vira campo, porque dois campos que descrevem a mesma coisa acabam divergindo.

Consequência prática na importação de extrato: quando o extrato diz "parcela 3/10 em 05/03", o app não corrige um contador — ele **reancora `first_due_date`** (`firstDueDateFor`), e a posição volta a se manter sozinha.

### `goals`

Metas financeiras com progresso manual (`current_amount_cents`, atualizado por aportes do usuário). O MVP não infere aportes a partir de transações — a ligação automática seria adivinhação. `deadline` é opcional porque nem toda meta tem prazo.

### `ai_insights_cache`

Resultado das chamadas de IA, cacheado localmente para não rechamar a API (que custa dinheiro) a cada abertura do app. `kind` distingue dica geral (`general_tip`) de plano de meta (`goal_plan`, com `related_id` = id da meta). `payload_json` guarda a resposta estruturada serializada — o cache não impõe schema porque o formato pertence ao contrato do Worker ([API_CONTRACTS.md](API_CONTRACTS.md)). Validade de 24h, aplicada na leitura ([src/db/queries/aiCache.ts](../src/db/queries/aiCache.ts)).

### `chat_conversations` e `chat_messages`

Armazenam o histórico de chat com a IA. O título da conversa (`title`) é gerado localmente cortando a primeira mensagem do usuário, para evitar custos com uma chamada de IA apenas para gerar título. O limite de histórico enviado para a IA é imposto por conversa, reduzindo uso de tokens em conversas longas.

### `budgets`

Limite mensal de gasto de uma tag. É recorrente: vale todo mês, sem precisar ser redefinido.

O limite é **versionado no tempo** (migration v8). Cada linha tem `effective_from` — o 1º dia do mês em que aquele valor passou a valer — e alterar o limite num mês novo cria outra linha em vez de sobrescrever. A leitura de uma competência pega, por tag, a versão vigente mais recente até o início daquele mês.

O motivo apareceu quando a aba Rotação passou a navegar por meses passados: com um único valor por tag, subir o limite de R$ 500 para R$ 800 faria março ser reavaliado contra 800, e um mês em que o usuário estourou passaria a parecer dentro do orçamento. A pergunta "eu respeitei o orçamento em março?" só tem resposta honesta contra o limite que valia em março. Um índice único em `(tag_id, effective_from)` impede duas versões para a mesma competência.

Deixar de orçar uma tag apaga **todas** as versões: "não quero mais orçar isto" é diferente de "quero mudar o valor", e manter o histórico de um orçamento extinto só faria lixo reaparecer em meses passados.

O aviso de 90% só dispara para o mês corrente — alertar sobre um limite estourado em março, ao navegar até março, seria alarme sobre passado, sem nada a fazer a respeito.

### `recurring_transactions`

Assinaturas ou transações recorrentes. Armazena o valor, nome, tag e `day_of_month` (1 a 31). O app usa notificações locais para avisar o usuário no dia do mês correspondente; ao abrir a notificação, o usuário aprova e gera a transação real. Nunca criamos transações automaticamente, garantindo a revisão humana.

A transação gerada guarda `recurring_id` (migration v7), e é esse vínculo que responde "a assinatura deste mês já foi lançada?". Sem ele, o app dependia inteiramente de o usuário ter visto a notificação: se ela passasse batida, a despesa nunca era registrada e o saldo e o orçamento ficavam errados **em silêncio** — o pior tipo de erro num app de dinheiro, porque a tela continua plausível. Deduzir o vínculo por semelhança de descrição foi descartado: quebraria assim que o usuário editasse o texto da transação, reintroduzindo a mesma falha silenciosa. De brinde, o vínculo responde também "quanto já gastei com essa assinatura no ano".

### `settings`

Preferências de interface, em chave/valor (hoje só `theme_preference`). Tabela genérica em vez de uma coluna por preferência: são escolhas sem relação entre si, e cada nova exigiria uma migration própria.

Fica no SQLite, e não em `AsyncStorage`, porque o banco já está aberto e migrado quando o app sobe — trazer outra dependência para persistir um enum seria custo sem contrapartida. Não guarda nada sensível: preferência de tema não é dado financeiro.

## Migrations

Runner próprio em [src/db/index.ts](../src/db/index.ts) usando `PRAGMA user_version` como marcador — sem dependência extra para uma necessidade simples. Cada migration roda dentro de uma transação: ou aplica inteira, ou o banco fica na versão anterior consistente.

| Versão | Migration | Conteúdo |
| --- | --- | --- |
| 1 | `initial-schema` | Todas as tabelas acima |
| 2 | `add-business-constraints` | `CHECK` em `transactions.amount_cents > 0` e em `installment_purchases` (`total_amount_cents > 0`, `current_installment BETWEEN 1 AND installment_count`) |
| 3 | `add-chat` | Tabelas `chat_conversations` e `chat_messages` para a aba Chat com IA |
| 4 | `add-budgets` | Tabela `budgets` para orçamento mensal por tag |
| 5 | `add-recurring` | Tabela `recurring_transactions` para assinaturas mensais |
| 6 | `derive-current-installment` | Remove `current_installment` de `installment_purchases` — a posição passa a ser derivada de `first_due_date` |
| 7 | `link-transaction-to-recurring` | `transactions.recurring_id` (FK opcional) — permite saber se a assinatura do mês já foi lançada |
| 8 | `budget-effective-from` | `budgets.effective_from` + índice único `(tag_id, effective_from)` — limite versionado no tempo |
| 9 | `drop-accounts` | Remove `accounts` e `transactions.account_id` — conceito nunca exposto na UI |
| 10 | `add-settings` | Tabela `settings` (chave/valor) para preferências de interface |

**Por que a v2 trava isso no banco além da UI:** validação de formulário evita erro do usuário, mas não evita um bug de código (ex: um cálculo que gere `amount_cents` negativo por engano) gravando dado inconsistente silenciosamente — defesa em profundidade. SQLite não suporta `ALTER TABLE ... ADD CONSTRAINT` nem adicionar `CHECK` a uma coluna existente; a v2 usa o procedimento padrão do SQLite para isso (criar tabela nova com o `CHECK`, copiar os dados, apagar a antiga, renomear) — é o padrão a seguir em qualquer migration futura que precise adicionar `CHECK` a uma tabela já existente.
