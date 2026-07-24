# Contrato do Worker de IA

O Worker (`worker/`) é a única peça do sistema que fala com o mundo externo. Ele **não persiste nada** — recebe dados, repassa pra API da Anthropic e devolve a resposta. Dicas e chat usam agregações. A única exceção de documento bruto é a importação voluntária de PDF, precedida por consentimento explícito e limitada a extração temporária.

Implementação: [worker/src/index.ts](../worker/src/index.ts). Prompts: [AI_PROMPTS.md](AI_PROMPTS.md).

## Autenticação e limites

- Header **`X-App-Secret`** obrigatório em toda requisição, comparado com o secret `APP_SECRET` do Worker. O app lê o valor de `EXPO_PUBLIC_AI_APP_SECRET` em `.env.local`/EAS; ele não é commitado no `app.json`. Como o valor ainda viaja no bundle do app, não é uma fronteira de segurança, apenas uma barreira contra uso casual do endpoint.
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

## `POST /ai/chat`

Chat interativo com suporte a tool calls e histórico. O cliente gerencia o histórico e ferramentas locais.

Requisição:

```json
{
  "system_prompt": "Você é o Bearing, um assistente financeiro...",
  "messages": [
    { "role": "user", "content": "Quais são meus gastos com mercado?" }
  ]
}
```

Resposta `200` (Mesmo formato que a API do Claude):

```json
{
  "id": "msg_01...",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Seus gastos com mercado foram..."
    }
  ],
  "model": "claude-haiku-4-5-20251001",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": { "input_tokens": 100, "output_tokens": 50 }
}
```

Pode retornar `tool_use` no bloco de `content`, exigindo que o app processe e responda com `tool_result`.

## `POST /ai/extract-statement-pdf`

Extrai texto de um PDF de extrato ou fatura. O app aceita somente PDF sem senha de até 20 MB e pede consentimento explícito antes do envio. O Worker não persiste o arquivo.

Requisição:

```json
{
  "pdf_base64": "JVBERi0xLjQK..."
}
```

Resposta `200`:

```json
{
  "extracted_text": "12/07 MERCADO EXTRA -45,00\n13/07 PIX RECEBIDO +120,00"
}
```

O texto retornado volta para a Confirmação 1. O usuário pode apagar dados sensíveis e corrigir a transcrição antes de chamar `/ai/parse-statement`.

## `POST /ai/parse-statement`

Processa o texto revisado, vindo de OCR local, PDF ou conteúdo colado, e retorna itens formatados.

Requisição:

```json
{
  "ocr_text": "MERCADO EXTRA 45,00 12/07/2026\nCOMPRA PARCELADA NOTEBOOK 1/6 150,00"
}
```

Resposta `200`:

```json
{
  "items": [
    {
      "description": "MERCADO EXTRA",
      "amount_cents": 4500,
      "type": "expense",
      "occurred_at": 1783814400,
      "is_installment": false,
      "installment_current": null,
      "installment_total": null
    },
    {
      "description": "COMPRA PARCELADA NOTEBOOK",
      "amount_cents": 15000,
      "type": "expense",
      "occurred_at": 1783814400,
      "is_installment": true,
      "installment_current": 1,
      "installment_total": 6
    }
  ]
}
```

Para itens com `is_installment: true`, `amount_cents` é o valor de **uma** parcela (a cobrança deste extrato); o total da compra é `amount_cents * installment_total`. **Itens com `is_installment: true` são gravados em `installment_purchases`, não em `transactions`, e alimentam a aba Parcelas já existente — nunca criam tela ou tabela paralela.** Antes de inserir, o app casa o item com uma compra parcelada existente (`findMatchingInstallment`) e apenas avança a parcela atual, evitando duplicar a mesma compra a cada extrato mensal.

O texto vai revisado pelo usuário (Confirmação 1) antes de sair do aparelho, e os itens classificados vão revisados de novo (Confirmação 2) antes de gravar.

## Códigos de erro

Toda resposta de erro tem corpo `{ "error": "mensagem" }`.

| Código | Quando | O que o app faz |
| --- | --- | --- |
| `400` | JSON inválido ou corpo fora do shape esperado | Bug — não acontece em uso normal |
| `401` | `X-App-Secret` ausente ou inválido | Verificar `EXPO_PUBLIC_AI_APP_SECRET` em `.env.local` e `APP_SECRET` no Worker |
| `404` | Rota inexistente ou método ≠ POST | Bug de client |
| `429` | Rate limit (Worker/WAF) ou limite de uso da Anthropic | Exibe "tente mais tarde"; o cache local de 24h segue válido |
| `500` | Erro upstream da Anthropic ou resposta inesperada | Exibe erro genérico; retry manual do usuário |

## Segredos do Worker

Configurados via `wrangler secret put`, nunca commitados:

| Secret | Conteúdo |
| --- | --- |
| `ANTHROPIC_API_KEY` | Chave da Claude API (Claude Console) |
| `APP_SECRET` | Token compartilhado com `EXPO_PUBLIC_AI_APP_SECRET` do build do app; mantido no Worker via `wrangler secret put` |
