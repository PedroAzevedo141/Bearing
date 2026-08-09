/**
 * backup.test.ts
 *
 * Restaurar backup é a operação mais destrutiva do app: substitui tudo, sem
 * desfazer. O que precisa ser provado aqui é que ela é atômica — se a
 * restauração falhar no meio, o usuário fica com os dados que já tinha, e não
 * com metade de cada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestDatabase, ts, type TestDatabase } from '../testSupport';
import { BACKUP_TABLES, type BackupTables } from '../../services/backupFormat';

let db: TestDatabase;

vi.mock('expo-crypto', () => ({
  randomUUID: () => globalThis.crypto.randomUUID(),
}));

vi.mock('../index', () => ({
  getDb: async () => db,
}));

const { dumpAllTables, getSchemaVersion, replaceAllTables } = await import('./backup');
const { createTransaction, listTransactionsForMonth } = await import('./transactions');

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(() => {
  db.close();
});

/** Tabelas vazias, para montar cenários sem repetir todas as chaves. */
function emptyTables(overrides: Partial<BackupTables> = {}): BackupTables {
  const base = Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, []])
  ) as unknown as BackupTables;
  return { ...base, ...overrides };
}

describe('getSchemaVersion', () => {
  it('reflete a última migration aplicada', async () => {
    const { MIGRATIONS } = await import('../migrations');
    const last = MIGRATIONS[MIGRATIONS.length - 1].version;
    expect(await getSchemaVersion()).toBe(last);
  });
});

describe('dumpAllTables', () => {
  it('exporta as linhas existentes', async () => {
    await createTransaction({
      tag_id: null,
      amount_cents: 4590,
      type: 'expense',
      description: 'Café',
      occurred_at: ts(2026, 3, 10),
    });

    const tables = await dumpAllTables();
    expect(tables.transactions).toHaveLength(1);
    expect(tables.transactions[0]).toMatchObject({ amount_cents: 4590, description: 'Café' });
  });

  it('traz todas as tabelas do backup, mesmo vazias', async () => {
    const tables = await dumpAllTables();
    for (const table of BACKUP_TABLES) {
      expect(Array.isArray(tables[table])).toBe(true);
    }
  });
});

describe('replaceAllTables', () => {
  it('substitui o conteúdo atual pelo do backup', async () => {
    await createTransaction({
      tag_id: null,
      amount_cents: 100,
      type: 'expense',
      description: 'antiga',
      occurred_at: ts(2026, 3, 1),
    });

    await replaceAllTables(
      emptyTables({
        transactions: [
          {
            id: 'restaurada',
            tag_id: null,
            amount_cents: 7777,
            type: 'expense',
            description: 'do backup',
            occurred_at: ts(2026, 3, 15),
            created_at: ts(2026, 3, 15),
            recurring_id: null,
          },
        ],
      })
    );

    const rows = await listTransactionsForMonth(3, 2026);
    expect(rows.map((r) => r.description)).toEqual(['do backup']);
  });

  it('restaura o vínculo com a assinatura (FK preservada)', async () => {
    await replaceAllTables(
      emptyTables({
        recurring_transactions: [
          {
            id: 'rec-1',
            name: 'Netflix',
            amount_cents: 5590,
            day_of_month: 5,
            tag_id: null,
            created_at: ts(2026, 1, 1),
          },
        ],
        transactions: [
          {
            id: 'tx-1',
            tag_id: null,
            amount_cents: 5590,
            type: 'expense',
            description: 'Netflix',
            occurred_at: ts(2026, 3, 5),
            created_at: ts(2026, 3, 5),
            recurring_id: 'rec-1',
          },
        ],
      })
    );

    const [row] = await listTransactionsForMonth(3, 2026);
    expect(row.recurring_id).toBe('rec-1');
  });

  it('limpa o cache de IA junto — ele descreve dados que deixaram de existir', async () => {
    await db.runAsync(
      'INSERT INTO ai_insights_cache (id, kind, related_id, payload_json, generated_at) VALUES (?, ?, ?, ?, ?)',
      'cache-1',
      'general_tip',
      null,
      '{}',
      0
    );

    await replaceAllTables(emptyTables());

    const rows = await db.getAllAsync('SELECT * FROM ai_insights_cache');
    expect(rows).toEqual([]);
  });

  it('preserva os dados atuais quando a restauração falha no meio', async () => {
    await createTransaction({
      tag_id: null,
      amount_cents: 100,
      type: 'expense',
      description: 'preservada',
      occurred_at: ts(2026, 3, 1),
    });

    // amount_cents = 0 viola o CHECK: a inserção falha depois de o DELETE já
    // ter rodado. Sem transação, o usuário perderia tudo e não ganharia nada.
    await expect(
      replaceAllTables(
        emptyTables({
          transactions: [
            {
              id: 'invalida',
              tag_id: null,
              amount_cents: 0,
              type: 'expense',
              description: 'quebrada',
              occurred_at: ts(2026, 3, 15),
              created_at: ts(2026, 3, 15),
              recurring_id: null,
            },
          ],
        })
      )
    ).rejects.toThrow();

    const rows = await listTransactionsForMonth(3, 2026);
    expect(rows.map((r) => r.description)).toEqual(['preservada']);
  });

  it('aceita linhas com menos colunas (backup de schema anterior)', async () => {
    await replaceAllTables(
      emptyTables({
        transactions: [
          {
            id: 'antiga',
            tag_id: null,
            amount_cents: 500,
            type: 'expense',
            description: 'sem recurring_id',
            occurred_at: ts(2026, 3, 10),
            created_at: ts(2026, 3, 10),
          },
        ],
      })
    );

    const [row] = await listTransactionsForMonth(3, 2026);
    expect(row.description).toBe('sem recurring_id');
    expect(row.recurring_id).toBeNull();
  });

  it('faz ida e volta preservando o conteúdo', async () => {
    await createTransaction({
      tag_id: null,
      amount_cents: 4590,
      type: 'expense',
      description: 'Café',
      occurred_at: ts(2026, 3, 10),
    });

    const exported = await dumpAllTables();
    await replaceAllTables(emptyTables());
    expect(await listTransactionsForMonth(3, 2026)).toHaveLength(0);

    await replaceAllTables(exported);
    const [row] = await listTransactionsForMonth(3, 2026);
    expect(row).toMatchObject({ amount_cents: 4590, description: 'Café' });
  });
});
