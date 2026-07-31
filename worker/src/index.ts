/**
 * index.ts — Cloudflare Worker de IA do Bearing
 *
 * Proxy stateless entre o app e a Claude API: valida o segredo compartilhado,
 * aplica rate limiting, repassa o resumo agregado pra Anthropic e devolve a
 * resposta. Nada é persistido aqui — a API key fica em secret do Worker,
 * fora do bundle do app.
 *
 * Contrato completo (rotas, corpos, códigos de erro): docs/API_CONTRACTS.md
 * Prompts e formato de resposta: docs/AI_PROMPTS.md
 */
import Anthropic from '@anthropic-ai/sdk';

/** Modelo fixado no projeto: o mais barato adequado à tarefa (ver ADR-0001). */
const MODEL = 'claude-haiku-4-5-20251001';

/**
 * System prompt das dicas gerais. Toda mudança aqui deve ser registrada em
 * docs/AI_PROMPTS.md com data e motivo.
 */
const INSIGHT_SYSTEM_PROMPT = `Você é um assistente financeiro objetivo. Analise os dados agregados
fornecidos e gere uma dica curta (máximo 3 frases), prática e específica,
nunca genérica. Nunca invente números que não estejam nos dados recebidos.
Os valores estão em centavos de real brasileiro (BRL); na resposta, escreva
valores em reais (ex: R$ 450,00). Responda em português brasileiro.`;

/**
 * System prompt do plano de meta. A resposta é forçada ao JSON do schema
 * GOAL_PLAN_SCHEMA via structured output — nunca texto solto.
 */
const GOAL_PLAN_SYSTEM_PROMPT = `Você é um planejador financeiro objetivo. Monte um plano de ação
realista para a meta informada, respeitando a capacidade mensal de poupança
do usuário. Passos curtos, práticos e específicos aos dados recebidos.
Valores em centavos de real brasileiro (BRL). Nunca invente números que não
derivem dos dados. Escreva as descrições em português brasileiro.`;

/**
 * JSON Schema da resposta de /ai/goal-plan (structured output).
 * Espelha o tipo GoalPlanResponse do app — mudar um exige mudar o outro.
 */
const GOAL_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      description: 'Passos do plano, em ordem de execução.',
      items: {
        type: 'object',
        properties: {
          order: { type: 'integer', description: 'Posição do passo, começando em 1.' },
          description: { type: 'string', description: 'Ação curta e prática.' },
        },
        required: ['order', 'description'],
        additionalProperties: false,
      },
    },
    suggested_monthly_cents: {
      type: 'integer',
      description: 'Aporte mensal sugerido, em centavos, <= capacidade informada.',
    },
    estimated_months: {
      type: 'integer',
      description: 'Meses estimados até atingir a meta com o aporte sugerido.',
    },
  },
  required: ['steps', 'suggested_monthly_cents', 'estimated_months'],
  additionalProperties: false,
} as const;

/**
 * System prompt do /ai/parse-statement. Toda mudança aqui deve ser registrada
 * em docs/AI_PROMPTS.md com data e motivo.
 */
const PARSE_STATEMENT_SYSTEM_PROMPT = `Você extrai lançamentos de um extrato bancário/fatura em texto. Para cada lançamento, devolva um item no schema fornecido.
Regras:
- amount_cents é SEMPRE um inteiro em centavos de real (ex: R$ 45,90 = 4590). Nunca use ponto/vírgula decimal.
- type: "expense" para saídas/compras, "income" para entradas/créditos.
- occurred_at: data do lançamento como Unix timestamp em SEGUNDOS.
- is_installment: true quando o lançamento indica parcelamento (ex: "2/6", "PARC 03/12"). Nesse caso preencha installment_current e installment_total, e amount_cents deve ser o valor de UMA parcela (a cobrança deste extrato), não o total da compra.
- Ignore linhas que não são lançamentos (saldo, cabeçalho, número de conta).
Nunca invente valores que não estejam no texto.`;

/** Prompt de transcrição do PDF antes da primeira revisão humana. */
const PDF_STATEMENT_SYSTEM_PROMPT = `Você transcreve extratos bancários e faturas em PDF.
Extraia fielmente datas, descrições, valores e indicadores de parcela.
Preserve um lançamento por linha e mantenha os sinais de entrada/saída encontrados.
Não classifique categorias, não faça cálculos e nunca invente dados.
Ignore apenas elementos repetitivos sem valor financeiro, como cabeçalhos, rodapés e publicidade.
Responda somente com o texto extraído em português brasileiro.`;

/** JSON Schema para a resposta estruturada do extrato (OCR). */
const PARSE_STATEMENT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Descrição do lançamento.' },
          amount_cents: {
            type: 'integer',
            description: 'Valor em centavos (inteiro). Para parcelas, o valor de UMA parcela.',
          },
          type: { type: 'string', enum: ['income', 'expense'] },
          occurred_at: { type: 'integer', description: 'Unix timestamp em segundos.' },
          is_installment: { type: 'boolean', description: 'true se for parcelamento.' },
          installment_current: { type: 'integer', description: 'Parcela atual (1-indexed), se parcela.' },
          installment_total: { type: 'integer', description: 'Total de parcelas, se parcela.' }
        },
        required: ['description', 'amount_cents', 'type', 'occurred_at', 'is_installment'],
        additionalProperties: false
      }
    }
  },
  required: ['items'],
  additionalProperties: false
} as const;

/** Definição das tools disponíveis para o Chat. */
const CHAT_TOOLS = [
  {
    name: 'getGastosPorTag',
    description: 'Retorna os gastos totais em centavos por tag em um dado mês e ano.',
    input_schema: {
      type: 'object',
      properties: { month: { type: 'integer' }, year: { type: 'integer' } },
      required: ['month', 'year']
    }
  },
  {
    name: 'getParcelasAtivas',
    description: 'Retorna as compras parceladas ainda em aberto.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'getMetas',
    description: 'Retorna o progresso atual de todas as metas financeiras.',
    input_schema: { type: 'object', properties: {} }
  }
];

/** Bindings e secrets disponíveis no Worker (ver wrangler.toml). */
export interface Env {
  /** Chave da Claude API — `wrangler secret put ANTHROPIC_API_KEY`. */
  ANTHROPIC_API_KEY: string;
  /** Segredo compartilhado com o app — `wrangler secret put APP_SECRET`. */
  APP_SECRET: string;
  /** Binding opcional de rate limit (wrangler.toml). */
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

/** Corpo esperado em POST /ai/insights (validação mínima em ensureInsightBody). */
interface InsightBody {
  period_days: number;
  balance_by_tag: Array<{ tag: string; total_cents: number }>;
  net_flow_cents: number;
}

/** Corpo esperado em POST /ai/goal-plan (validação mínima em ensureGoalPlanBody). */
interface GoalPlanBody {
  goal: {
    name: string;
    target_cents: number;
    current_cents: number;
    deadline: number | null;
  };
  monthly_capacity_cents: number;
}

/** Corpo esperado em POST /ai/chat. */
interface ChatBody {
  system_prompt: string;
  messages: Anthropic.MessageParam[];
}

/** Corpo esperado em POST /ai/parse-statement. */
interface ParseStatementBody {
  ocr_text: string;
}

/** Corpo esperado em POST /ai/extract-statement-pdf. */
interface PdfStatementBody {
  pdf_base64: string;
}

/** Resposta JSON com os headers padrão. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Resposta de erro no formato documentado em docs/API_CONTRACTS.md. */
function error(status: number, message: string): Response {
  return json({ error: message }, status);
}

/**
 * Valida o shape de /ai/insights.
 * @returns O corpo tipado, ou null se inválido.
 */
function ensureInsightBody(body: unknown): InsightBody | null {
  const b = body as InsightBody;
  if (
    !b ||
    typeof b.period_days !== 'number' ||
    typeof b.net_flow_cents !== 'number' ||
    !Array.isArray(b.balance_by_tag) ||
    b.balance_by_tag.some((t) => typeof t?.tag !== 'string' || typeof t?.total_cents !== 'number')
  ) {
    return null;
  }
  return b;
}

/**
 * Valida o shape de /ai/goal-plan.
 * @returns O corpo tipado, ou null se inválido.
 */
function ensureGoalPlanBody(body: unknown): GoalPlanBody | null {
  const b = body as GoalPlanBody;
  if (
    !b ||
    typeof b.monthly_capacity_cents !== 'number' ||
    !b.goal ||
    typeof b.goal.name !== 'string' ||
    typeof b.goal.target_cents !== 'number' ||
    typeof b.goal.current_cents !== 'number'
  ) {
    return null;
  }
  return b;
}

function ensureChatBody(body: unknown): ChatBody | null {
  const b = body as ChatBody;
  if (!b || typeof b.system_prompt !== 'string' || !Array.isArray(b.messages)) {
    return null;
  }
  return b;
}

function ensureParseStatementBody(body: unknown): ParseStatementBody | null {
  const b = body as ParseStatementBody;
  if (!b || typeof b.ocr_text !== 'string') {
    return null;
  }
  return b;
}

function ensurePdfStatementBody(body: unknown): PdfStatementBody | null {
  const b = body as PdfStatementBody;
  if (
    !b ||
    typeof b.pdf_base64 !== 'string' ||
    b.pdf_base64.length === 0 ||
    b.pdf_base64.length > 28_000_000
  ) {
    return null;
  }
  return b;
}

/**
 * Extrai o texto da resposta da API (primeiro bloco de texto).
 * @throws Se a resposta não tiver bloco de texto (ex: refusal).
 */
function firstText(content: Anthropic.ContentBlock[]): string {
  const block = content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('Resposta da IA sem conteúdo de texto');
  }
  return block.text;
}

/**
 * POST /ai/insights — dica financeira em texto livre a partir dos agregados.
 */
async function handleInsights(client: Anthropic, body: InsightBody): Promise<Response> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: INSIGHT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Resumo dos últimos ${body.period_days} dias (valores em centavos de BRL):
Saldo líquido do período: ${body.net_flow_cents}
Totais por categoria (negativo = gasto):
${body.balance_by_tag.map((t) => `- ${t.tag}: ${t.total_cents}`).join('\n')}`,
      },
    ],
  });

  return json({
    insight: firstText(message.content).trim(),
    generated_at: Math.floor(Date.now() / 1000),
  });
}

/**
 * POST /ai/goal-plan — plano de ação em JSON tipado (structured output força
 * o schema; o app renderiza como UI de plano sem parsing frágil).
 */
async function handleGoalPlan(client: Anthropic, body: GoalPlanBody): Promise<Response> {
  const deadlineLine = body.goal.deadline
    ? `Prazo desejado (unix timestamp): ${body.goal.deadline}`
    : 'Sem prazo definido.';

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: GOAL_PLAN_SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: GOAL_PLAN_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `Meta: ${body.goal.name}
Valor-alvo (centavos): ${body.goal.target_cents}
Já guardado (centavos): ${body.goal.current_cents}
${deadlineLine}
Capacidade mensal de poupança (centavos): ${body.monthly_capacity_cents}`,
      },
    ],
  });

  // Com output_config.format o primeiro bloco de texto é JSON válido no schema.
  return json(JSON.parse(firstText(message.content)));
}

/**
 * POST /ai/chat — Chat interativo com suporte a tool calls.
 * O app envia o histórico (mensagens e tool results) e o worker repassa.
 */
async function handleChat(client: Anthropic, body: ChatBody): Promise<Response> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: body.system_prompt,
    tools: CHAT_TOOLS as any,
    messages: body.messages,
  });

  return json(message); // Repassa a resposta completa da API, que pode incluir tool_use ou message
}

/**
 * POST /ai/parse-statement — Classifica texto de extrato usando structured output.
 */
async function handleParseStatement(client: Anthropic, body: ParseStatementBody): Promise<Response> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: PARSE_STATEMENT_SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: PARSE_STATEMENT_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: body.ocr_text,
      },
    ],
  });

  return json(JSON.parse(firstText(message.content)));
}

/**
 * POST /ai/extract-statement-pdf — extrai texto de um PDF sem persistir o arquivo.
 * A classificação só acontece depois que o usuário revisar o texto retornado.
 */
async function handleExtractStatementPdf(
  client: Anthropic,
  body: PdfStatementBody
): Promise<Response> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: PDF_STATEMENT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: body.pdf_base64,
            },
          },
          {
            type: 'text',
            text: 'Transcreva os lançamentos deste documento seguindo as instruções.',
          },
        ],
      },
    ],
  });

  return json({ extracted_text: firstText(message.content).trim() });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return error(404, 'Rota não encontrada');
    }

    if (request.headers.get('X-App-Secret') !== env.APP_SECRET) {
      return error(401, 'Não autorizado');
    }

    if (env.RATE_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return error(429, 'Muitas solicitações');
      }
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error(400, 'JSON inválido');
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const path = new URL(request.url).pathname;

    try {
      if (path === '/ai/insights') {
        const parsed = ensureInsightBody(body);
        return parsed ? await handleInsights(client, parsed) : error(400, 'Corpo inválido');
      }
      if (path === '/ai/goal-plan') {
        const parsed = ensureGoalPlanBody(body);
        return parsed ? await handleGoalPlan(client, parsed) : error(400, 'Corpo inválido');
      }
      if (path === '/ai/chat') {
        const parsed = ensureChatBody(body);
        return parsed ? await handleChat(client, parsed) : error(400, 'Corpo inválido');
      }
      if (path === '/ai/parse-statement') {
        const parsed = ensureParseStatementBody(body);
        return parsed ? await handleParseStatement(client, parsed) : error(400, 'Corpo inválido');
      }
      if (path === '/ai/extract-statement-pdf') {
        const parsed = ensurePdfStatementBody(body);
        return parsed
          ? await handleExtractStatementPdf(client, parsed)
          : error(400, 'PDF inválido ou maior que o limite');
      }
      return error(404, 'Rota não encontrada');
    } catch (err) {
      // 429 da Anthropic (spend limit / rate limit) repassa como 429; o resto vira 500.
      if (err instanceof Anthropic.RateLimitError) {
        return error(429, 'Limite de uso da IA atingido');
      }
      console.error('Erro upstream:', err);
      return error(500, 'Erro ao gerar resposta de IA');
    }
  },
} satisfies ExportedHandler<Env>;
