# Prompts de IA

Registro histórico dos prompts usados pelo Worker e do formato de resposta esperado. **Toda mudança de prompt entra aqui com data e motivo** — prompts vão ser iterados, e sem histórico fica impossível saber por que uma versão anterior existia.

Modelo: `claude-haiku-4-5-20251001` (fixado — ver [ADR-0001](adr/0001-local-first-architecture.md)).
Implementação: [worker/src/index.ts](../worker/src/index.ts).

## `/ai/insights` — dica geral

### v1 — 2026-07-07 (inicial)

```text
Você é um assistente financeiro objetivo. Analise os dados agregados
fornecidos e gere uma dica curta (máximo 3 frases), prática e específica,
nunca genérica. Nunca invente números que não estejam nos dados recebidos.
Os valores estão em centavos de real brasileiro (BRL); na resposta, escreva
valores em reais (ex: R$ 450,00). Responda em português brasileiro.
```

**Motivo:** versão inicial da especificação, acrescida de duas instruções operacionais: (1) os valores chegam em centavos, então o modelo precisa saber converter para reais na resposta; (2) idioma explícito, para não depender do idioma dos dados.

**Formato de resposta:** texto livre (máx. 3 frases). O Worker envolve em `{ "insight": ..., "generated_at": ... }`.

**Mensagem do usuário (template):** resumo do período com saldo líquido e lista `- tag: total_cents` — nunca transações individuais.

## `/ai/goal-plan` — plano de meta

### v1 — 2026-07-07 (inicial)

```text
Você é um planejador financeiro objetivo. Monte um plano de ação
realista para a meta informada, respeitando a capacidade mensal de poupança
do usuário. Passos curtos, práticos e específicos aos dados recebidos.
Valores em centavos de real brasileiro (BRL). Nunca invente números que não
derivem dos dados. Escreva as descrições em português brasileiro.
```

**Motivo:** versão inicial. A resposta **não** depende do prompt para ter o formato certo: o Worker usa *structured output* da Claude API (`output_config.format` com JSON Schema), que garante o JSON abaixo em nível de API — mais confiável que instruir formato via prompt.

**Formato de resposta (imposto por schema):**

```json
{
  "steps": [{ "order": 1, "description": "..." }],
  "suggested_monthly_cents": 25000,
  "estimated_months": 17
}
```

O schema (`GOAL_PLAN_SCHEMA` no Worker) espelha o tipo `GoalPlanResponse` do app — mudar um exige mudar o outro.

## `/ai/extract-statement-pdf` — transcrição de PDF

### v1 — 2026-07-23 (inicial)

```text
Você transcreve extratos bancários e faturas em PDF.
Extraia fielmente datas, descrições, valores e indicadores de parcela.
Preserve um lançamento por linha e mantenha os sinais de entrada/saída encontrados.
Não classifique categorias, não faça cálculos e nunca invente dados.
Ignore apenas elementos repetitivos sem valor financeiro, como cabeçalhos, rodapés e publicidade.
Responda somente com o texto extraído em português brasileiro.
```

**Motivo:** separar transcrição e classificação. O texto do PDF volta primeiro para edição humana; somente o texto revisado segue para `/ai/parse-statement`.

## `/ai/chat` — chat com IA

### v1 — 2026-07-11 (inicial)

O system prompt deste endpoint é **montado no client** (`buildSystemPrompt` em `src/hooks/useChat.ts`) e enviado no campo `system_prompt` do corpo — diferente de `/ai/insights` e `/ai/goal-plan`, cujo prompt vive no Worker. Motivo: o contexto financeiro precisa ser fresco a cada turno e vem do SQLite local; centralizá-lo no Worker exigiria o Worker acessar dados do usuário, o que a arquitetura proíbe. O template atual:

```text
Você é o assistente financeiro do Bearing. Responda de forma concisa, prática e amigável, em português brasileiro. Os valores estão em centavos de real (BRL); ao responder ao usuário escreva em reais (ex: R$ 450,00). Nunca invente números — use as tools para consultar dados reais quando precisar.
Contexto dos últimos 30 dias — saldo líquido: <N> centavos; por tag: <JSON agregado>.
```

**Tools** (`CHAT_TOOLS` no Worker): `getGastosPorTag(month, year)`, `getParcelasAtivas()`, `getMetas()`. O Worker **só declara** as tools e repassa a `tool_use` de volta; a execução é 100% no client, contra `src/db/queries/` — o Worker nunca toca o SQLite do usuário.

**Formato de resposta:** a `Message` bruta da Claude API (pode conter blocos `text` e/ou `tool_use`). O loop de tools fica no client (`useChat`).

## `/ai/parse-statement` — classificação de extrato

### v1 — 2026-07-11 (inicial)

```text
Você extrai lançamentos de um extrato bancário/fatura em texto. Para cada lançamento, devolva um item no schema fornecido.
Regras:
- amount_cents é SEMPRE um inteiro em centavos de real (ex: R$ 45,90 = 4590). Nunca use ponto/vírgula decimal.
- type: "expense" para saídas/compras, "income" para entradas/créditos.
- occurred_at: data do lançamento como Unix timestamp em SEGUNDOS.
- is_installment: true quando o lançamento indica parcelamento (ex: "2/6", "PARC 03/12"). Nesse caso preencha installment_current e installment_total, e amount_cents deve ser o valor de UMA parcela (a cobrança deste extrato), não o total da compra.
- Ignore linhas que não são lançamentos (saldo, cabeçalho, número de conta).
Nunca invente valores que não estejam no texto.
```

**Motivo da v1:** a primeira versão vibe-coded (`"Extraia os itens do extrato..."`) não fixava a unidade (centavos) nem a semântica de parcela — o client assume `amount_cents` = valor de uma parcela (`total = amount_cents * installment_total` em `statementMatching.ts`). Sem isso, o modelo podia devolver reais ou o total da compra, quebrando o matching. A resposta é forçada pelo `PARSE_STATEMENT_SCHEMA` (structured output).

## Como iterar

1. Alterar o prompt em `worker/src/index.ts`.
2. Adicionar uma seção `### vN — data` aqui, com o texto novo e o **motivo** da mudança.
3. Testar com `wrangler dev` antes do deploy.
