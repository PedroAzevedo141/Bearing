import { getDb } from '../index';
import * as Crypto from 'expo-crypto';
import type { RecurringTransaction } from '../../types';

export interface RecurringWithTag extends RecurringTransaction {
  tagName: string | null;
}

export async function listRecurring(): Promise<RecurringWithTag[]> {
  const db = await getDb();
  const result = await db.getAllAsync<any>(
    `
    SELECT r.*, t.name as tagName 
    FROM recurring_transactions r
    LEFT JOIN tags t ON r.tag_id = t.id
    ORDER BY r.day_of_month ASC
    `
  );

  return result.map(r => ({
    ...r
  }));
}

export async function getRecurringById(id: string): Promise<RecurringWithTag | null> {
  const db = await getDb();
  return db.getFirstAsync<any>(
    `
    SELECT r.*, t.name as tagName 
    FROM recurring_transactions r
    LEFT JOIN tags t ON r.tag_id = t.id
    WHERE r.id = ?
    `,
    id
  );
}

export async function createRecurring(
  name: string,
  amount_cents: number,
  day_of_month: number,
  tag_id: string | null
): Promise<RecurringTransaction> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const id = Crypto.randomUUID();
  
  await db.runAsync(
    'INSERT INTO recurring_transactions (id, name, amount_cents, day_of_month, tag_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id, name, amount_cents, day_of_month, tag_id, now
  );

  return {
    id, name, amount_cents, day_of_month, tag_id, created_at: now
  };
}

export async function deleteRecurring(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recurring_transactions WHERE id = ?', id);
}
