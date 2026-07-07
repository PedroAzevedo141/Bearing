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

## Como iterar

1. Alterar o prompt em `worker/src/index.ts`.
2. Adicionar uma seção `### vN — data` aqui, com o texto novo e o **motivo** da mudança.
3. Testar com `wrangler dev` antes do deploy.
