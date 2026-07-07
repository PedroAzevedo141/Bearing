/**
 * queries/tags.ts
 *
 * Operações sobre a tabela `tags` (categorias livres do usuário).
 * `name` é UNIQUE no banco — getOrCreateTag absorve o conflito.
 *
 * Relacionado: docs/DATA_MODEL.md
 */
import * as Crypto from 'expo-crypto';

import { getDb } from '../index';
import type { Tag } from '../../types';

/**
 * Lista todas as tags em ordem alfabética.
 *
 * @returns Todas as tags cadastradas.
 */
export async function listTags(): Promise<Tag[]> {
  const db = await getDb();
  return db.getAllAsync<Tag>('SELECT * FROM tags ORDER BY name ASC');
}

/**
 * Busca uma tag pelo nome exato (case-sensitive, como o UNIQUE do SQLite).
 *
 * @param name - Nome da tag.
 * @returns A tag, ou null se não existir.
 */
export async function findTagByName(name: string): Promise<Tag | null> {
  const db = await getDb();
  return db.getFirstAsync<Tag>('SELECT * FROM tags WHERE name = ?', name);
}

/**
 * Retorna a tag com esse nome, criando-a se necessário.
 *
 * É o caminho usado pelos formulários: o usuário digita um nome livre e a
 * tag passa a existir na primeira utilização.
 *
 * @param name - Nome da tag (já aparado de espaços pelo chamador).
 * @param color - Cor hex opcional para a UI.
 * @returns A tag existente ou recém-criada.
 */
export async function getOrCreateTag(name: string, color: string | null = null): Promise<Tag> {
  const existing = await findTagByName(name);
  if (existing) {
    return existing;
  }
  const db = await getDb();
  const tag: Tag = { id: Crypto.randomUUID(), name, color };
  await db.runAsync('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)', tag.id, tag.name, tag.color);
  return tag;
}
