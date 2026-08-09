/**
 * useChat.ts
 *
 * Hooks do chat com a IA. `useChatConversations` gerencia a lista de
 * conversas; `useChat` gerencia uma conversa: envia o histórico ao Worker,
 * executa as tools localmente contra src/db/queries (o Worker nunca acessa o
 * SQLite do usuário) e re-chama a API com o resultado da tool.
 *
 * A rede passa pelo aiService (regra do projeto: hook não faz `fetch`
 * direto). O contexto financeiro do system prompt é sempre montado na hora,
 * a partir de agregados — nunca transações individuais.
 *
 * Relacionado: src/services/aiService.ts, docs/API_CONTRACTS.md
 */
import { useCallback, useState } from 'react';

import { listInstallmentPurchases } from '../db/queries/installments';
import { listGoals } from '../db/queries/goals';
import {
  addMessage,
  createConversation,
  deleteConversation,
  getRecentMessages,
  listConversations,
} from '../db/queries/chat';
import { getBalanceByTag, getBalanceByTagForMonth } from '../db/queries/transactions';
import { AiServiceError, fetchChat } from '../services/aiService';
import {
  currentInstallmentFor,
  formatCents,
  installmentAmountCents,
  isInstallmentCompleted,
} from '../utils/money';
import type { ChatApiMessage, ChatContentBlock, ChatConversation, ChatMessage } from '../types';

/** Quantas mensagens da conversa entram no payload da API (as antigas ficam salvas). */
const HISTORY_LIMIT = 20;

/** Janela usada pra montar o contexto financeiro do system prompt. */
const CONTEXT_PERIOD_DAYS = 30;

/** Teto de iterações do loop de tool use, pra nunca ficar preso num vai-e-vem infinito. */
const MAX_TOOL_ITERATIONS = 5;

/**
 * Executa localmente uma tool pedida pela IA, contra a camada de queries.
 *
 * As tools devolvem valores já **derivados, rotulados e formatados em reais**
 * (não os números crus do banco em centavos). Isso evita o erro clássico de a
 * IA confundir "valor de cada parcela" com "valor total da compra" — ela
 * recebe os dois campos, nomeados sem ambiguidade, e só precisa repetir.
 *
 * @param name - Nome da tool (`getGastosPorTag`, `getParcelasAtivas`, `getMetas`).
 * @param input - Argumentos da tool, no shape declarado no Worker.
 * @returns Resultado serializável que volta pra IA como `tool_result`.
 * @throws Se a tool for desconhecida.
 */
async function executeTool(name: string, input: unknown): Promise<unknown> {
  if (name === 'getGastosPorTag') {
    const { month, year } = (input ?? {}) as { month?: number; year?: number };
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const balances = await getBalanceByTagForMonth(m, y);
    return {
      mes_referencia: `${String(m).padStart(2, '0')}/${y}`,
      // total_cents é negativo para gasto, positivo para entrada líquida na tag.
      por_categoria: balances.map((b) => ({
        categoria: b.tag,
        tipo: b.total_cents < 0 ? 'gasto' : 'entrada',
        valor: formatCents(Math.abs(b.total_cents)),
      })),
    };
  }
  if (name === 'getParcelasAtivas') {
    const active = (await listInstallmentPurchases()).filter((p) => !isInstallmentCompleted(p));
    return active.map((p) => {
      const parcela = installmentAmountCents(p.total_amount_cents, p.installment_count);
      const atual = currentInstallmentFor(p);
      const pagas = Math.min(atual - 1, p.installment_count);
      const restante = (p.installment_count - pagas) * parcela;
      return {
        nome: p.name,
        valor_de_cada_parcela: formatCents(parcela),
        valor_total_da_compra: formatCents(p.total_amount_cents),
        parcela_atual: atual,
        total_de_parcelas: p.installment_count,
        ainda_falta_pagar: formatCents(restante),
      };
    });
  }
  if (name === 'getMetas') {
    const goals = await listGoals();
    return goals.map((g) => ({
      nome: g.name,
      objetivo: formatCents(g.target_amount_cents),
      ja_guardado: formatCents(g.current_amount_cents),
      falta_guardar: formatCents(Math.max(g.target_amount_cents - g.current_amount_cents, 0)),
      progresso_percent:
        g.target_amount_cents > 0
          ? Math.round((g.current_amount_cents / g.target_amount_cents) * 100)
          : 0,
    }));
  }
  throw new Error(`Tool desconhecida: ${name}`);
}

/** Monta o system prompt com o contexto financeiro fresco (só agregados, em reais). */
async function buildSystemPrompt(): Promise<string> {
  const balanceByTag = await getBalanceByTag(CONTEXT_PERIOD_DAYS);
  const netFlow = balanceByTag.reduce((acc, t) => acc + t.total_cents, 0);
  const porCategoria =
    balanceByTag.map((t) => `${t.tag}: ${formatCents(t.total_cents)}`).join('; ') || 'sem gastos';
  return `Você é o assistente financeiro do Bearing — objetivo, prático e didático, em português brasileiro.
Regras:
- As ferramentas já devolvem valores em reais (ex: "R$ 450,00") com rótulos claros. Use-os exatamente como vêm; NUNCA recalcule nem confunda "valor_de_cada_parcela" com "valor_total_da_compra".
- Precisou de um número que não está no contexto abaixo? Chame a ferramenta certa (getGastosPorTag, getParcelasAtivas, getMetas) em vez de estimar.
- Nunca invente valores. Se um dado não existir, diga que não há registro.
- Ao dar conselho, seja específico e acionável, e explique de forma simples.
Contexto rápido dos últimos ${CONTEXT_PERIOD_DAYS} dias — saldo líquido: ${formatCents(netFlow)}; por categoria: ${porCategoria}.`;
}

/** Estado e ações da lista de conversas. */
export interface UseChatConversationsResult {
  conversations: ChatConversation[];
  loading: boolean;
  /** Recarrega a lista do banco. */
  load: () => Promise<void>;
  /** Cria uma conversa nova (título já truncado pelo chamador) e a devolve. */
  create: (title: string) => Promise<ChatConversation>;
  /** Exclui uma conversa e suas mensagens. */
  remove: (id: string) => Promise<void>;
}

/**
 * Lista de conversas do chat, ordenada por atividade mais recente.
 *
 * @returns Estado reativo + ações de criar/excluir/recarregar.
 */
export function useChatConversations(): UseChatConversationsResult {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setConversations(await listConversations());
    setLoading(false);
  }, []);

  const create = useCallback(async (title: string) => {
    const conv = await createConversation(title);
    setConversations((prev) => [conv, ...prev]);
    return conv;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { conversations, loading, load, create, remove };
}

/** Estado e ações de uma conversa aberta. */
export interface UseChatResult {
  messages: ChatMessage[];
  /** true enquanto aguarda a resposta da IA (inclui o loop de tools). */
  loading: boolean;
  /** Mensagem amigável de erro do último envio, ou null. */
  error: string | null;
  /** Carrega as mensagens da conversa do banco. */
  loadMessages: () => Promise<void>;
  /** Envia uma mensagem do usuário e resolve o turno completo da IA. */
  sendMessage: (text: string) => Promise<void>;
}

/**
 * Gerencia uma conversa: envio de mensagem, execução local das tools e
 * re-chamada à API até a IA parar de pedir tools.
 *
 * @param conversationId - ID da conversa aberta, ou null (nada é enviado).
 * @returns Estado reativo + ações.
 */
export function useChat(conversationId: string | null): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      return;
    }
    setMessages(await getRecentMessages(conversationId, HISTORY_LIMIT));
  }, [conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!conversationId) {
        return;
      }
      setLoading(true);
      setError(null);

      const userMsg = await addMessage(conversationId, 'user', text);
      setMessages((prev) => [...prev, userMsg]);

      try {
        const systemPrompt = await buildSystemPrompt();
        const recent = await getRecentMessages(conversationId, HISTORY_LIMIT);
        const apiMessages: ChatApiMessage[] = recent.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
          const response = await fetchChat({ system_prompt: systemPrompt, messages: apiMessages });
          const blocks = response.content;

          const assistantText = blocks
            .filter((b): b is Extract<ChatContentBlock, { type: 'text' }> => b.type === 'text')
            .map((b) => b.text)
            .join('')
            .trim();
          if (assistantText.length > 0) {
            const aiMsg = await addMessage(conversationId, 'assistant', assistantText);
            setMessages((prev) => [...prev, aiMsg]);
          }

          const toolUses = blocks.filter(
            (b): b is Extract<ChatContentBlock, { type: 'tool_use' }> => b.type === 'tool_use'
          );
          if (toolUses.length === 0) {
            break;
          }

          const toolResults: ChatContentBlock[] = [];
          for (const toolUse of toolUses) {
            try {
              const result = await executeTool(toolUse.name, toolUse.input);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: JSON.stringify(result),
              });
            } catch (toolErr) {
              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: toolErr instanceof Error ? toolErr.message : 'Erro na tool',
                is_error: true,
              });
            }
          }

          apiMessages.push({ role: 'assistant', content: blocks });
          apiMessages.push({ role: 'user', content: toolResults });
        }
      } catch (err) {
        setError(
          err instanceof AiServiceError && err.status === 429
            ? 'Muitas solicitações — tente de novo em instantes.'
            : 'Não consegui falar com a IA agora. Verifique a conexão e tente de novo.'
        );
      } finally {
        setLoading(false);
      }
    },
    [conversationId]
  );

  return { messages, loading, error, loadMessages, sendMessage };
}
