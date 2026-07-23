/**
 * queries/chat.ts
 *
 * Operações sobre `chat_conversations` e `chat_messages` (histórico do chat
 * com a IA). Tudo local — o histórico nunca sai do dispositivo além das
 * últimas mensagens enviadas ao Worker a cada turno (ver src/hooks/useChat.ts).
 *
 * Relacionado: docs/DATA_MODEL.md
 */
import * as Crypto from 'expo-crypto';

import { getDb } from '../index';
import type { ChatConversation, ChatMessage } from '../../types';

/**
 * Cria uma conversa nova (título já definido pelo chamador — truncado da 1ª
 * mensagem, sem chamada extra de IA).
 *
 * @param title - Título da conversa.
 * @returns A conversa persistida.
 */
export async function createConversation(title: string): Promise<ChatConversation> {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.runAsync(
    'INSERT INTO chat_conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    id,
    title,
    now,
    now
  );

  return { id, title, created_at: now, updated_at: now };
}

/**
 * Lista as conversas, mais recentemente ativas primeiro (`updated_at DESC`).
 *
 * @returns Todas as conversas.
 */
export async function listConversations(): Promise<ChatConversation[]> {
  const db = await getDb();
  return db.getAllAsync<ChatConversation>(
    'SELECT * FROM chat_conversations ORDER BY updated_at DESC'
  );
}

/**
 * Retorna as últimas `limit` mensagens de uma conversa, em ordem cronológica.
 *
 * O cap é por conversa (não global): cada conversa mantém seu próprio
 * contexto, e mensagens além do limite continuam salvas e visíveis na tela —
 * só não entram no payload enviado à IA.
 *
 * @param conversationId - ID da conversa.
 * @param limit - Máximo de mensagens (default 20).
 * @returns Mensagens em ordem cronológica (mais antiga primeiro).
 */
export async function getRecentMessages(
  conversationId: string,
  limit = 20
): Promise<ChatMessage[]> {
  const db = await getDb();
  // Busca as mais recentes, mas devolve em ordem cronológica.
  const messages = await db.getAllAsync<ChatMessage>(
    'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?',
    conversationId,
    limit
  );
  return messages.reverse();
}

/**
 * Adiciona uma mensagem a uma conversa e marca a conversa como ativa agora
 * (`updated_at`), pra ela subir na lista.
 *
 * @param conversationId - ID da conversa.
 * @param role - Autor da mensagem.
 * @param content - Texto da mensagem.
 * @returns A mensagem persistida.
 */
export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<ChatMessage> {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO chat_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      id,
      conversationId,
      role,
      content,
      now
    );
    await db.runAsync(
      'UPDATE chat_conversations SET updated_at = ? WHERE id = ?',
      now,
      conversationId
    );
  });

  return { id, conversation_id: conversationId, role, content, created_at: now };
}

/**
 * Exclui uma conversa e todas as suas mensagens, de forma atômica.
 *
 * @param conversationId - ID da conversa.
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM chat_messages WHERE conversation_id = ?', conversationId);
    await db.runAsync('DELETE FROM chat_conversations WHERE id = ?', conversationId);
  });
}
