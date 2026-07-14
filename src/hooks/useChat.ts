/**
 * src/hooks/useChat.ts
 *
 * Hook para gerenciar as conversas com a IA.
 * Envia histórico de mensagens para a API, resolve as tool calls localmente,
 * e chama a API novamente.
 */
import { useCallback, useState } from 'react';
import Constants from 'expo-constants';
import {
  addMessage,
  createConversation,
  getRecentMessages,
  listConversations,
  deleteConversation,
} from '../db/queries/chat';
import { getBalanceByTag, listTransactions } from '../db/queries/transactions';
import { listGoals } from '../db/queries/goals';
import { listInstallmentPurchases } from '../db/queries/installments';
import type { ChatConversation, ChatMessage } from '../types';

/** URL do Worker (Proxy Claude API). */
const AI_WORKER_URL = Constants.expoConfig?.extra?.aiWorkerUrl ?? '';
/** Secret compartilhado com o Worker. */
const AI_APP_SECRET = Constants.expoConfig?.extra?.aiAppSecret ?? '';

export class ChatError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ChatError';
  }
}

/** Resolve tools localmente */
async function executeTool(name: string, input: any): Promise<any> {
  if (name === 'getGastosPorTag') {
    const { month, year } = input;
    // Opcional: ajustar getBalanceByTag para aceitar mes/ano, mas no momento usa INSIGHT_PERIOD_DAYS
    // Para simplificar, vou chamar getBalanceByTag(30)
    return await getBalanceByTag(30);
  }
  if (name === 'getParcelasAtivas') {
    return await listInstallmentPurchases();
  }
  if (name === 'getMetas') {
    return await listGoals();
  }
  throw new Error(`Unknown tool: ${name}`);
}

export function useChatConversations() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listConversations();
    setConversations(result);
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

export function useChat(conversationId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    const result = await getRecentMessages(conversationId, 20);
    setMessages(result);
  }, [conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!conversationId) return;
      setLoading(true);

      // Adiciona mensagem do usuário localmente
      const userMsg = await addMessage(conversationId, 'user', text);
      setMessages((prev) => [...prev, userMsg]);

      // Monta as ultimas 20 mensagens para a IA
      const recent = await getRecentMessages(conversationId, 20);
      const apiMessages = recent.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        // Obter contexto financeiro para o system prompt
        const transactions = await listTransactions(30);
        const tags = await getBalanceByTag(30);
        const total = transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount_cents : -t.amount_cents), 0);
        const contextStr = `Saldo 30 dias: ${total} centavos. Gastos por tag: ${JSON.stringify(tags)}`;

        let currentMessages = [...apiMessages];

        // Loop para suportar Tool Calls múltiplas vezes, se necessário
        while (true) {
          const res = await fetch(`${AI_WORKER_URL}/ai/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-App-Secret': AI_APP_SECRET,
            },
            body: JSON.stringify({
              system_prompt: `Você é um assistente financeiro inteligente do Bearing. Responda de forma concisa e amigável.
O usuário está no Brasil, valores em centavos de BRL.
Contexto atual: ${contextStr}`,
              messages: currentMessages,
            }),
          });

          if (!res.ok) {
            throw new ChatError(res.status, await res.text());
          }

          const apiResponse = await res.json();
          const contentBlocks = apiResponse.content;

          // Extrai tool_use e texto
          let hasToolUse = false;
          let assistantText = '';

          const toolResults = [];

          for (const block of contentBlocks) {
            if (block.type === 'text') {
              assistantText += block.text;
            } else if (block.type === 'tool_use') {
              hasToolUse = true;
              try {
                const result = await executeTool(block.name, block.input);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify(result),
                });
              } catch (e: any) {
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: `Error: ${e.message}`,
                  is_error: true,
                });
              }
            }
          }

          if (assistantText.trim().length > 0) {
            const aiMsg = await addMessage(conversationId, 'assistant', assistantText.trim());
            setMessages((prev) => [...prev, aiMsg]);
          }

          if (!hasToolUse) {
            break;
          }

          // Se teve tool use, adicionamos a resposta do assistant e os tool_results à currentMessages
          currentMessages.push({
            role: 'assistant',
            content: contentBlocks,
          });

          currentMessages.push({
            role: 'user',
            content: toolResults,
          });
        }
      } catch (e: any) {
        const errorText = e instanceof ChatError
          ? 'O servidor de IA está indisponível no momento. Tente novamente mais tarde.'
          : (e.message || 'Erro desconhecido ao contatar a IA.');
        console.error('[Chat]', e);
        // Show error as an assistant message so the user sees it in the chat
        const errMsg = await addMessage(conversationId, 'assistant', `⚠️ ${errorText}`);
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
    },
    [conversationId]
  );

  return { messages, loading, loadMessages, sendMessage };
}
