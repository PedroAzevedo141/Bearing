# Plano de melhorias

Backlog priorizado levantado a partir de uma leitura do schema, das queries e
das telas. Cada item abaixo é **uma unidade de entrega**: fecha com código +
JSDoc + entrada no `CHANGELOG.md` + docs afetados + `npm run typecheck` e
`npm run test` limpos, e vira **um commit** em Conventional Commits.

A ordem não é arbitrária — os primeiros itens removem risco (perda de dados,
estado incorreto) e os últimos são refinamento. Itens que exigem decisão de
produto estão marcados com ⚠️.

Versão de schema atual: **v5**. As versões novas abaixo (v6, v7, v8) assumem
que os itens são feitos nesta ordem; se você reordenar, renumere.

---

## 1. `fix:` compra parcelada nunca é marcada como concluída

**Bug real, não melhoria.** A seção "Concluídas" da aba Parcelas é inalcançável
por construção:

- [`parcelas.tsx:31`](../app/%28tabs%29/parcelas.tsx#L31) filtra por
  `isInstallmentCompleted`, que exige `current_installment > installment_count`
  ([`money.ts:123`](../src/utils/money.ts#L123));
- [`installments.ts:123`](../src/db/queries/installments.ts#L123) avança com
  `MIN(current_installment + 1, installment_count)` — trava **no** total,
  nunca acima;
- a migration v2 tem `CHECK (current_installment BETWEEN 1 AND installment_count)`,
  ou seja, o banco **proíbe** o estado que a UI espera.

Há um segundo problema, mais silencioso: `current_installment` só muda se
alguém chamar `advanceInstallment`. Nada no app chama isso automaticamente, então
o contador congela no valor digitado no cadastro e a projeção de "quanto falta
pagar" envelhece sozinha.

### Abordagem

Parar de guardar o contador e **derivar a parcela atual da data**: a parcela
número _n_ é função de `first_due_date` e da data de hoje. É a mesma regra que o
`DATA_MODEL.md` já aplica ao não ter coluna `status` — não duplicar informação
que outra coluna já determina.

- `currentInstallmentFor(purchase, now)` em `src/utils/money.ts`, com teste
  unitário (obrigatório por convenção para `utils/`), cobrindo virada de mês,
  compra futura e compra já quitada.
- `isInstallmentCompleted` passa a derivar da mesma função.
- Migration **v6**: remove `current_installment` de `installment_purchases`
  (rebuild da tabela, mesmo procedimento da v2) e solta o `CHECK` que dependia
  dela.
- `advanceInstallment` deixa de existir.
- `InstallmentForm` para de perguntar "parcela atual" e passa a pedir só a data
  da primeira parcela — menos campo, menos chance de erro.
- Atualizar `docs/DATA_MODEL.md` (seção `installment_purchases`) com o porquê da
  derivação.

### Risco

Migration destrutiva: quem já cadastrou parcelas com `current_installment`
divergente da data vai ver o número mudar. Na prática o valor derivado é o
correto — mas vale a entrada no CHANGELOG dizendo isso.

**Commit:** `fix: compra parcelada nunca era marcada como concluída`

---

## 2. `feat:` backup e exportação local

**O buraco mais sério do projeto.** Não existe nenhuma saída de dados (busca por
`backup`/`export`/`csv`/`Sharing` em `app/` e `src/`: zero ocorrências). Num app
100% local-first, perder ou formatar o celular apaga todo o histórico, sem
recuperação. O ADR-0002 propõe sincronização entre dispositivos, mas isso traz
servidor de volta e é ordens de grandeza maior; export/import resolve a maior
parte do risco sem violar o ADR-0001.

### Abordagem

- `src/services/backupService.ts`: serializa todas as tabelas num JSON
  versionado (com `schema_version`, para o import saber recusar arquivo de
  versão futura) e restaura a partir dele.
- Export via `expo-file-system` + share sheet (`expo-sharing`) — nova
  dependência, portanto **ADR-0010**.
- Import com confirmação destrutiva explícita (substitui os dados atuais) e
  validação do arquivo antes de tocar no banco.
- Export em CSV das transações como caminho secundário (abrir no Excel é um
  caso de uso legítimo e barato de atender).
- Testes: serialização/desserialização são lógica pura, então testáveis sem o
  módulo nativo.

**Commit:** `feat: adiciona backup e exportação dos dados locais`
(+ `docs/adr/0010-backup-local.md`)

---

## 3. `feat:` navegação por mês na Rotação

Hoje tudo é uma janela móvel fixa de 30 dias
([`rotacao.tsx:33`](../app/%28tabs%29/rotacao.tsx#L33)). Não há como responder
"como foi março?" — que é a pergunta central de um app de finanças.

O trabalho é menor do que parece: a query por competência **já existe**
(`getBalanceByTagForMonth`), só que hoje é usada apenas pela tool do chat, não
pela UI.

### Abordagem

- `listTransactionsForMonth(month, year)` em `queries/transactions.ts`, espelhando
  o range `[1º do mês, 1º do mês seguinte)` que a query de tags já usa.
- Seletor de mês no `ScreenHeader` da Rotação (‹ mês ›), com o mês corrente como
  padrão.
- Comparativo com o mês anterior no card de saldo (variação em % ou em reais).
- `useTransactions` passa a aceitar competência além de janela em dias.

**Commit:** `feat: adiciona navegação por mês na aba Rotação`

---

## 4. `feat:` assinaturas — pendências do mês

Hoje a recorrência só agenda notificação
([`useRecurring.ts:57`](../src/hooks/useRecurring.ts#L57)). Se o usuário não
tocar naquela notificação, a despesa **nunca é registrada** — e o saldo e o
orçamento ficam silenciosamente errados, que é o pior tipo de erro num app de
dinheiro.

### Abordagem

Fechar o loop sem quebrar a confirmação humana obrigatória do ADR-0008: o app
nunca lança sozinho, mas para de depender de a notificação ter sido vista.

- Migration **v7**: coluna `recurring_id` em `transactions` (FK opcional para
  `recurring_transactions`). Isso é o que permite saber se a assinatura do mês já
  foi lançada — derivar por semelhança de descrição seria frágil, quebrando
  assim que o usuário editasse o texto. De brinde, dá para responder "quanto já
  gastei com essa assinatura no ano".
- `listPendingRecurring(month, year)`: assinaturas sem transação vinculada na
  competência e cujo dia de vencimento já passou.
- Card "Pendências do mês" na Rotação, com registro em 1 toque (reaproveita o
  pré-preenchimento que a tela de confirmação já faz).
- Atualizar `docs/DATA_MODEL.md` e o ADR-0008 com o novo vínculo.

**Commit:** `feat: mostra assinaturas pendentes do mês na aba Rotação`

---

## 5. `feat:` orçamento por competência

`budgets` não tem noção de mês, então não existe histórico de "estourei em quais
meses" — só o estado de agora.

### ⚠️ Decisão a tomar

Duas leituras possíveis, com custos diferentes:

- **(a) limite é uma regra vigente**, e o histórico é derivado das transações
  daquele mês contra o limite atual. Barato, mas mente sobre o passado se o
  limite mudou.
- **(b) limite é versionado** (`effective_from`), e cada mês é avaliado contra o
  limite que valia à época. Correto, um pouco mais de schema.

Recomendo **(b)** — a pergunta "eu respeitei o orçamento em março?" só tem
resposta honesta com o limite de março. Migration **v8** adiciona
`effective_from` e a leitura passa a pegar o limite vigente na competência.

**Commit:** `feat: avalia orçamento por competência mensal`

---

## 6. `feat:` contas e carteiras

`accounts` existe no schema desde a v1, mas só a conta default é usada
([`import-review.tsx:42`](../app/transactions/import-review.tsx#L42)); nenhuma
tela expõe o conceito.

### ⚠️ Decisão a tomar

É uma bifurcação de produto, não técnica:

- **Expor**: separar cartão de crédito, conta corrente e dinheiro. Muda a
  leitura de "saldo do período" (saldo por conta ≠ fluxo agregado) e conversa
  bem com as parcelas, que na prática são fatura de cartão.
- **Remover**: tirar `accounts` do schema e simplificar. Menos código, menos
  conceito na cabeça do usuário.

Não recomendo manter como está: tabela viva que ninguém usa é peso morto que
confunde quem lê o schema depois. **Preciso da sua decisão antes de implementar
este item.**

**Commit:** `feat: adiciona contas e carteiras` _ou_ `refactor: remove conceito de contas do schema`

---

## 7. `feat:` tema escuro

`src/theme/colors.ts` é uma paleta única, sem `useColorScheme` em lugar nenhum.
Como as telas já usam tokens semânticos do NativeWind (`bg-surface`, `text-ink`,
`border-border`), o trabalho é sobretudo definir a paleta escura e ligar o
`colorScheme` — não é uma reescrita de UI.

Atenção aos pontos que hoje escapam do token: o card escuro da Rotação usa
`bg-ink` com texto branco fixo, e algumas barras de progresso usam
`bg-slate-100` cru.

**Commit:** `feat: adiciona tema escuro`

---

## 8. `test:` cobertura de queries e hooks

Só existem três arquivos de teste (`money`, `applyMigrations`,
`statementMatching`) e nenhum cobre `src/db/queries` ou os hooks — justamente
onde o dinheiro é calculado.

### Restrição conhecida

`CONTRIBUTING.md` é explícito: `expo-sqlite` é módulo nativo, não roda em vitest
puro, e mockar o módulo não vale. Então há duas saídas:

- extrair a montagem de SQL/agregações puras para funções sem import de
  `expo-sqlite` (o padrão que `applyMigrations.ts` já estabeleceu); **ou**
- adicionar `better-sqlite3` como devDependency e rodar as queries reais contra
  um banco em memória, o que dá cobertura muito maior por um custo pequeno.

A segunda opção é nova dependência de desenvolvimento e mudança de padrão de
teste — logo, **ADR**.

**Commit:** `test: cobre queries de transações, parcelas e orçamento`

---

## Resumo da sequência

| # | Commit | Migration | ADR | Decisão sua? |
| --- | --- | --- | --- | --- |
| 1 | `fix: compra parcelada nunca era marcada como concluída` | v6 | — | não |
| 2 | `feat: adiciona backup e exportação dos dados locais` | — | 0010 | não |
| 3 | `feat: adiciona navegação por mês na aba Rotação` | — | — | não |
| 4 | `feat: mostra assinaturas pendentes do mês na aba Rotação` | v7 | atualiza 0008 | não |
| 5 | `feat: avalia orçamento por competência mensal` | v8 | — | ⚠️ sim |
| 6 | `feat: adiciona contas e carteiras` | talvez | provável | ⚠️ sim |
| 7 | `feat: adiciona tema escuro` | — | — | não |
| 8 | `test: cobre queries de transações, parcelas e orçamento` | — | se usar `better-sqlite3` | ⚠️ sim |
