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
 * @param name - Nome da tool (`getGastosPorTag`, `getParcelasAtivas`, `getMetas`).
 * @param input - Argumentos da tool, no shape declarado no Worker.
 * @returns Resultado serializável que volta pra IA como `tool_result`.
 * @throws Se a tool for desconhecida.
 */
async function executeTool(name: string, input: unknown): Promise<unknown> {
  if (name === 'getGastosPorTag') {
    const { month, year } = (input ?? {}) as { month?: number; year?: number };
    const now = new Date();
    return getBalanceByTagForMonth(month ?? now.getMonth() + 1, year ?? now.getFullYear());
  }
  if (name === 'getParcelasAtivas') {
    return listInstallmentPurchases();
  }
  if (name === 'getMetas') {
    return listGoals();
  }
  throw new Error(`Tool desconhecida: ${name}`);
}

/** Monta o system prompt com o contexto financeiro fresco (só agregados). */
async function buildSystemPrompt(): Promise<string> {
  const balanceByTag = await getBalanceByTag(CONTEXT_PERIOD_DAYS);
  const netFlow = balanceByTag.reduce((acc, t) => acc + t.total_cents, 0);
  return `Você é o assistente financeiro do Bearing. Responda de forma concisa, prática e amigável, em português brasileiro. Os valores estão em centavos de real (BRL); ao responder ao usuário escreva em reais (ex: R$ 450,00). Nunca invente números — use as tools para consultar dados reais quando precisar.
Contexto dos últimos ${CONTEXT_PERIOD_DAYS} dias — saldo líquido: ${netFlow} centavos; por tag: ${JSON.stringify(balanceByTag)}.`;
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
