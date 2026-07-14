/**
 * src/db/queries/chat.ts
 *
 * Consultas para o histórico de conversas do chat.
 */
import * as Crypto from 'expo-crypto';
import { getDb } from '../index';
import type { ChatConversation, ChatMessage } from '../../types';

export async function createConversation(title: string): Promise<ChatConversation> {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  
  await db.runAsync(
    'INSERT INTO chat_conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    id, title, now, now
  );
  
  return { id, title, created_at: now, updated_at: now };
}

export async function listConversations(): Promise<ChatConversation[]> {
  const db = await getDb();
  return db.getAllAsync<ChatConversation>('SELECT * FROM chat_conversations ORDER BY updated_at DESC');
}

export async function getRecentMessages(conversationId: string, limit = 20): Promise<ChatMessage[]> {
  const db = await getDb();
  // Fetch the most recent messages, but return them in chronological order
  const messages = await db.getAllAsync<ChatMessage>(
    'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?',
    conversationId, limit
  );
  return messages.reverse();
}

export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<ChatMessage> {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  
  await db.runAsync(
    'INSERT INTO chat_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    id, conversationId, role, content, now
  );
  
  await db.runAsync(
    'UPDATE chat_conversations SET updated_at = ? WHERE id = ?',
    now, conversationId
  );
  
  return { id, conversation_id: conversationId, role, content, created_at: now };
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM chat_messages WHERE conversation_id = ?', conversationId);
    await db.runAsync('DELETE FROM chat_conversations WHERE id = ?', conversationId);
  });
}
