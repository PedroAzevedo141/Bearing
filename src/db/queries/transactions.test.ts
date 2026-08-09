/**
 * transactions.test.ts
 *
 * Cobre as queries de transação contra um SQLite real em memória (ver
 * src/db/testSupport.ts e ADR-0011). O foco é o que a lógica pura não alcança:
 * os recortes de período, que decidem o que entra e o que fica de fora do saldo
 * mostrado ao usuário.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestDatabase, ts, type TestDatabase } from '../testSupport';

let db: TestDatabase;

vi.mock('expo-crypto', () => ({
  // UUID real do Node: a geração de id não é o que está sob teste, e delegar
  // para o crypto da plataforma evita colisões entre linhas.
  randomUUID: () => globalThis.crypto.randomUUID(),
}));

vi.mock('../index', () => ({
  getDb: async () => db,
}));

const {
  createTransaction,
  deleteTransaction,
  getBalanceByTag,
  getBalanceByTagForMonth,
  listTransactions,
  listTransactionsForMonth,
  updateTransaction,
} = await import('./transactions');

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(() => {
  db.close();
});

/** Insere uma tag e devolve o id, para os testes de agregação por tag. */
async function insertTag(name: string): Promise<string> {
  const id = `tag-${name}`;
  await db.runAsync('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)', id, name, null);
  return id;
}

describe('createTransaction', () => {
  it('persiste os campos e devolve a linha gravada', async () => {
    const created = await createTransaction({
      tag_id: null,
      amount_cents: 4590,
      type: 'expense',
      description: 'Café',
      occurred_at: ts(2026, 3, 10),
    });

    const rows = await listTransactionsForMonth(3, 2026);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: created.id,
      amount_cents: 4590,
      type: 'expense',
      description: 'Café',
    });
  });

  it('usa o momento atual quando occurred_at não é informado', async () => {
    const before = Math.floor(Date.now() / 1000);
    const created = await createTransaction({
      tag_id: null,
      amount_cents: 100,
      type: 'income',
      description: null,
    });
    expect(created.occurred_at).toBeGreaterThanOrEqual(before);
  });

  it('grava recurring_id como null quando não vem de assinatura', async () => {
    const created = await createTransaction({
      tag_id: null,
      amount_cents: 100,
      type: 'expense',
      description: null,
    });
    expect(created.recurring_id).toBeNull();
  });

  it('recusa valor zero ou negativo — o CHECK do banco é a última defesa', async () => {
    await expect(
      createTransaction({ tag_id: null, amount_cents: 0, type: 'expense', description: null })
    ).rejects.toThrow();
    await expect(
      createTransaction({ tag_id: null, amount_cents: -500, type: 'expense', description: null })
    ).rejects.toThrow();
  });
});

describe('listTransactionsForMonth', () => {
  beforeEach(async () => {
    await createTransaction({
      tag_id: null,
      amount_cents: 100,
      type: 'expense',
      description: 'fevereiro',
      occurred_at: ts(2026, 2, 28),
    });
    await createTransaction({
      tag_id: null,
      amount_cents: 200,
      type: 'expense',
      description: 'primeiro de março',
      occurred_at: ts(2026, 3, 1),
    });
    await createTransaction({
      tag_id: null,
      amount_cents: 300,
      type: 'expense',
      description: 'último de março',
      occurred_at: ts(2026, 3, 31),
    });
    await createTransaction({
      tag_id: null,
      amount_cents: 400,
      type: 'expense',
      description: 'abril',
      occurred_at: ts(2026, 4, 1),
    });
  });

  it('inclui o primeiro e o último dia do mês', async () => {
    const rows = await listTransactionsForMonth(3, 2026);
    expect(rows.map((r) => r.description)).toEqual(['último de março', 'primeiro de março']);
  });

  it('exclui os meses vizinhos', async () => {
    const rows = await listTransactionsForMonth(3, 2026);
    expect(rows.map((r) => r.description)).not.toContain('fevereiro');
    expect(rows.map((r) => r.description)).not.toContain('abril');
  });

  it('ordena da mais recente para a mais antiga', async () => {
    const rows = await listTransactionsForMonth(3, 2026);
    expect(rows[0].occurred_at).toBeGreaterThan(rows[1].occurred_at);
  });

  it('atravessa a virada de ano sem vazar para janeiro', async () => {
    await createTransaction({
      tag_id: null,
      amount_cents: 999,
      type: 'expense',
      description: 'dezembro',
      occurred_at: ts(2025, 12, 31),
    });
    expect(await listTransactionsForMonth(12, 2025)).toHaveLength(1);
    expect(await listTransactionsForMonth(1, 2026)).toHaveLength(0);
  });

  it('devolve lista vazia para mês sem movimento', async () => {
    expect(await listTransactionsForMonth(7, 2026)).toEqual([]);
  });
});

describe('listTransactions (janela em dias)', () => {
  it('corta pela janela contada a partir de agora', async () => {
    const now = Math.floor(Date.now() / 1000);
    await createTransaction({
      tag_id: null,
      amount_cents: 100,
      type: 'expense',
      description: 'dentro',
      occurred_at: now - 5 * 86400,
    });
    await createTransaction({
      tag_id: null,
      amount_cents: 200,
      type: 'expense',
      description: 'fora',
      occurred_at: now - 40 * 86400,
    });

    const rows = await listTransactions(30);
    expect(rows.map((r) => r.description)).toEqual(['dentro']);
  });
});

describe('updateTransaction', () => {
  it('altera os campos editáveis', async () => {
    const created = await createTransaction({
      tag_id: null,
      amount_cents: 100,
      type: 'expense',
      description: 'antes',
      occurred_at: ts(2026, 3, 10),
    });

    await updateTransaction(created.id, {
      tag_id: null,
      amount_cents: 250,
      type: 'income',
      description: 'depois',
      occurred_at: ts(2026, 3, 10),
    });

    const [row] = await listTransactionsForMonth(3, 2026);
    expect(row).toMatchObject({ amount_cents: 250, type: 'income', description: 'depois' });
  });

  it('move a transação de mês ao mudar occurred_at', async () => {
    const created = await createTransaction({
      tag_id: null,
      amount_cents: 100,
      type: 'expense',
      description: 'movida',
      occurred_at: ts(2026, 3, 10),
    });

    await updateTransaction(created.id, {
      tag_id: null,
      amount_cents: 100,
      type: 'expense',
      description: 'movida',
      occurred_at: ts(2026, 4, 10),
    });

    expect(await listTransactionsForMonth(3, 2026)).toHaveLength(0);
    expect(await listTransactionsForMonth(4, 2026)).toHaveLength(1);
  });
});

describe('deleteTransaction', () => {
  it('remove só a transação pedida', async () => {
    const a = await createTransaction({
      tag_id: null,
      amount_cents: 100,
      type: 'expense',
      description: 'a',
      occurred_at: ts(2026, 3, 10),
    });
    await createTransaction({
      tag_id: null,
      amount_cents: 200,
      type: 'expense',
      description: 'b',
      occurred_at: ts(2026, 3, 11),
    });

    await deleteTransaction(a.id);

    const rows = await listTransactionsForMonth(3, 2026);
    expect(rows.map((r) => r.description)).toEqual(['b']);
  });
});

describe('getBalanceByTagForMonth', () => {
  it('soma entradas como positivo e saídas como negativo', async () => {
    const mercado = await insertTag('mercado');
    await createTransaction({
      tag_id: mercado,
      amount_cents: 5000,
      type: 'expense',
      description: null,
      occurred_at: ts(2026, 3, 5),
    });
    await createTransaction({
      tag_id: mercado,
      amount_cents: 2000,
      type: 'income',
      description: null,
      occurred_at: ts(2026, 3, 6),
    });

    const balances = await getBalanceByTagForMonth(3, 2026);
    expect(balances).toEqual([{ tag: 'mercado', total_cents: -3000 }]);
  });

  it('agrupa transações sem tag como "sem categoria"', async () => {
    await createTransaction({
      tag_id: null,
      amount_cents: 1500,
      type: 'expense',
      description: null,
      occurred_at: ts(2026, 3, 5),
    });

    const balances = await getBalanceByTagForMonth(3, 2026);
    expect(balances).toEqual([{ tag: 'sem categoria', total_cents: -1500 }]);
  });

  it('não mistura meses', async () => {
    const lazer = await insertTag('lazer');
    await createTransaction({
      tag_id: lazer,
      amount_cents: 1000,
      type: 'expense',
      description: null,
      occurred_at: ts(2026, 3, 5),
    });
    await createTransaction({
      tag_id: lazer,
      amount_cents: 9999,
      type: 'expense',
      description: null,
      occurred_at: ts(2026, 4, 5),
    });

    expect(await getBalanceByTagForMonth(3, 2026)).toEqual([{ tag: 'lazer', total_cents: -1000 }]);
  });

  it('ordena do maior gasto para o menor', async () => {
    const caro = await insertTag('caro');
    const barato = await insertTag('barato');
    await createTransaction({
      tag_id: barato,
      amount_cents: 100,
      type: 'expense',
      description: null,
      occurred_at: ts(2026, 3, 5),
    });
    await createTransaction({
      tag_id: caro,
      amount_cents: 9000,
      type: 'expense',
      description: null,
      occurred_at: ts(2026, 3, 5),
    });

    const balances = await getBalanceByTagForMonth(3, 2026);
    expect(balances.map((b) => b.tag)).toEqual(['caro', 'barato']);
  });
});

describe('getBalanceByTag (janela em dias)', () => {
  it('respeita a janela e agrega por tag', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mercado = await insertTag('mercado');
    await createTransaction({
      tag_id: mercado,
      amount_cents: 3000,
      type: 'expense',
      description: null,
      occurred_at: now - 2 * 86400,
    });
    await createTransaction({
      tag_id: mercado,
      amount_cents: 8000,
      type: 'expense',
      description: null,
      occurred_at: now - 90 * 86400,
    });

    expect(await getBalanceByTag(30)).toEqual([{ tag: 'mercado', total_cents: -3000 }]);
  });
});
