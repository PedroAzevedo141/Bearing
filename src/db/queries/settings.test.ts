/**
 * settings.test.ts
 *
 * A garantia que importa: gravar duas vezes a mesma chave sobrescreve em vez
 * de duplicar. Sem isso a preferência de tema acumularia linhas e a leitura
 * passaria a depender da ordem — o usuário veria a escolha "voltar sozinha".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestDatabase, type TestDatabase } from '../testSupport';

let db: TestDatabase;

vi.mock('../index', () => ({
  getDb: async () => db,
}));

const { getSetting, setSetting } = await import('./settings');

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(() => {
  db.close();
});

describe('getSetting', () => {
  it('devolve null quando a chave nunca foi gravada', async () => {
    expect(await getSetting('theme_preference')).toBeNull();
  });
});

describe('setSetting', () => {
  it('grava e lê de volta', async () => {
    await setSetting('theme_preference', 'dark');
    expect(await getSetting('theme_preference')).toBe('dark');
  });

  it('sobrescreve em vez de duplicar', async () => {
    await setSetting('theme_preference', 'dark');
    await setSetting('theme_preference', 'light');

    expect(await getSetting('theme_preference')).toBe('light');
    const rows = await db.getAllAsync('SELECT * FROM settings');
    expect(rows).toHaveLength(1);
  });
});
