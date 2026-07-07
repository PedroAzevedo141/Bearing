# Contrato do Worker de IA

O Worker (`worker/`) é a única peça do sistema que fala com o mundo externo. Ele **não persiste nada** — recebe o resumo agregado, repassa pra API da Anthropic e devolve a resposta. O app nunca envia transações individuais; só agregações (garantido em [src/services/aiService.ts](../src/services/aiService.ts) e nas queries de agregação).

Implementação: [worker/src/index.ts](../worker/src/index.ts). Prompts: [AI_PROMPTS.md](AI_PROMPTS.md).

## Autenticação e limites

- Header **`X-App-Secret`** obrigatório em toda requisição, comparado com o secret `APP_SECRET` do Worker. Não é infalível (o valor viaja no bundle do app), mas eleva a barreira contra uso casual do endpoint.
- **Rate limiting** em duas camadas: binding nativo do Worker (10 req/60s por IP, `wrangler.toml`) + regra WAF no dashboard Cloudflare (20 req/hora por IP).
- **Spend limit de US$5** em *Settings > Limits* no Claude Console — teto final de custo.

## `POST /ai/insights`

Dica financeira em texto livre a partir dos agregados do período.

Requisição:

```json
{
  "period_days": 30,
  "balance_by_tag": [
    { "tag": "mercado", "total_cents": -45000 },
    { "tag": "lazer", "total_cents": -12000 }
  ],
  "net_flow_cents": -8000
}
```

Resposta `200`:

```json
{
  "insight": "texto livre com a dica",
  "generated_at": 1751932800
}
```

## `POST /ai/goal-plan`

Plano de ação para uma meta. A resposta usa **structured output** da Claude API (JSON Schema) — força JSON tipado, nunca texto solto, pra renderizar como UI de plano.

Requisição:

```json
{
  "goal": {
    "name": "Viagem",
    "target_cents": 500000,
    "current_cents": 80000,
    "deadline": 1767225600
  },
  "monthly_capacity_cents": 30000
}
```

`goal.deadline` é opcional (`null` quando a meta não tem prazo).

Resposta `200`:

```json
{
  "steps": [
    { "order": 1, "description": "Reserve 25 mil centavos por mês" },
    { "order": 2, "description": "Corte 1 gasto de lazer recorrente" }
  ],
  "suggested_monthly_cents": 25000,
  "estimated_months": 17
}
```

## Códigos de erro

Toda resposta de erro tem corpo `{ "error": "mensagem" }`.

| Código | Quando | O que o app faz |
| --- | --- | --- |
| `400` | JSON inválido ou corpo fora do shape esperado | Bug — não acontece em uso normal |
| `401` | `X-App-Secret` ausente ou inválido | Verificar `expo.extra.aiAppSecret` |
| `404` | Rota inexistente ou método ≠ POST | Bug de client |
| `429` | Rate limit (Worker/WAF) ou limite de uso da Anthropic | Exibe "tente mais tarde"; o cache local de 24h segue válido |
| `500` | Erro upstream da Anthropic ou resposta inesperada | Exibe erro genérico; retry manual do usuário |

## Segredos do Worker

Configurados via `wrangler secret put`, nunca commitados:

| Secret | Conteúdo |
| --- | --- |
| `ANTHROPIC_API_KEY` | Chave da Claude API (Claude Console) |
| `APP_SECRET` | Mesmo valor de `expo.extra.aiAppSecret` no `app.json` |
