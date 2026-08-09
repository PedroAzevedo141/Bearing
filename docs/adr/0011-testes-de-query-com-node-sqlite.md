# 0011 — Testar a camada de queries com o SQLite embutido do Node

## Status

Aceito

## Contexto

O [CONTRIBUTING.md](../../CONTRIBUTING.md) proíbe mockar `expo-sqlite`, e a
razão é boa: um fake do módulo nativo testaria o fake, não o SQL. A regra dizia
para isolar a lógica pura num arquivo sem nenhum import do módulo nativo — foi o
que se fez com `applyMigrations.ts`.

O problema é o que essa regra deixava de fora. Toda a camada `src/db/queries/`
ficava sem cobertura, e é exatamente ali que mora a lógica de dinheiro mais
difícil de conferir a olho:

- os recortes de período (`listTransactionsForMonth`, `getBalanceByTagForMonth`),
  que decidem o que entra e o que fica de fora do saldo;
- a escolha do limite vigente numa competência (`getBudgetsWithProgress`), que
  determina se um mês passado aparece estourado ou não;
- as pendências de assinatura (`listPendingRecurring`), onde um falso negativo
  esconde uma cobrança e um falso positivo cobra o usuário duas vezes;
- a restauração de backup (`replaceAllTables`), destrutiva e sem desfazer.

Nada disso é extraível como função pura sem virar uma reimplementação do SQL em
TypeScript — o que só moveria o risco de lugar, testando a cópia em vez do
original.

## Decisão

Rodar as queries **reais** contra um SQLite **real** em memória, usando
`node:sqlite` — o módulo embutido no Node 22.5+, portanto **sem dependência
nova** no projeto.

`src/db/testSupport.ts` abre `:memory:`, aplica as `MIGRATIONS` de verdade e
expõe a mesma superfície assíncrona que as queries esperam de `getDb()`. Cada
teste substitui apenas o módulo `src/db/index.ts` (código nosso) por essa
conexão.

A distinção que torna isto compatível com a regra do CONTRIBUTING: **nenhum
comportamento de banco é simulado**. O SQL executado no teste é o mesmo do app,
no mesmo motor, com o mesmo schema. O que se troca é o *transporte* — a API
assíncrona do `expo-sqlite` mapeada sobre a API síncrona do Node. Um `CHECK`
violado falha de verdade; uma transação revertida reverte de verdade; uma chave
estrangeira quebrada acusa de verdade.

`expo-crypto` continua mockado, mas só em `randomUUID`, delegando ao
`crypto.randomUUID` do Node. Geração de id não é o que está sob teste, e o
resultado é um UUID real.

A regra do CONTRIBUTING passa a ler assim: **não mocke comportamento de banco;
substitua só o transporte.**

## Consequências

**Fica mais fácil:** cobrir a camada onde o dinheiro é calculado. Os testes de
`budgets` provam a promessa central da v8 — que março continua avaliado pelo
limite de março mesmo depois de o usuário subir o valor — e os de `backup`
provam que uma restauração que falha no meio preserva os dados atuais. Nenhuma
das duas garantias é verificável olhando a tela; ambas são invisíveis até o dia
em que quebram.

**Fica mais difícil:** o schema agora tem dois consumidores (o app e os testes),
então uma migration mal escrita quebra a suíte inteira em vez de só uma tela.
Isso é o efeito desejado, mas significa que rodar as migrations ficou parte do
custo de cada teste de query.

**Limite conhecido:** `node:sqlite` e o SQLite embarcado do Android/iOS podem
divergir em versão e em flags de compilação. Para o que o app usa — SQL padrão,
`PRAGMA user_version`, `CHECK`, chaves estrangeiras — a diferença não aparece.
Se algum dia o projeto passar a depender de uma extensão específica (FTS, JSON1),
esta equivalência precisa ser reavaliada.

**Ainda descoberto:** hooks e componentes. Testá-los exigiria runtime React
Native (`jest-expo` ou `@testing-library/react-native`), que é outra decisão, de
custo bem maior, e não foi tomada aqui.
