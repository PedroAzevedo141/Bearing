/**
 * recurring.test.ts
 *
 * Foco em `listPendingRecurring`: é a query que evita o pior erro do app —
 * uma assinatura cobrada no mundo real e nunca lançada, deixando saldo e
 * orçamento errados em silêncio. Um falso negativo aqui esconde a pendência;
 * um falso positivo cobra o usuário duas vezes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestDatabase, ts, type TestDatabase } from '../testSupport';

let db: TestDatabase;

vi.mock('expo-crypto', () => ({
  randomUUID: () => globalThis.crypto.randomUUID(),
}));

vi.mock('../index', () => ({
  getDb: async () => db,
}));

const { createRecurring, deleteRecurring, getRecurringById, listPendingRecurring, listRecurring } =
  await import('./recurring');
const { createTransaction } = await import('./transactions');

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(() => {
  db.close();
});

describe('createRecurring e listRecurring', () => {
  it('persiste e ordena pelo dia do mês', async () => {
    await createRecurring('Academia', 12000, 20, null);
    await createRecurring('Netflix', 5590, 5, null);

    const rows = await listRecurring();
    expect(rows.map((r) => r.name)).toEqual(['Netflix', 'Academia']);
  });

  it('resolve o nome da tag no JOIN', async () => {
    await db.runAsync('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)', 't1', 'lazer', null);
    await createRecurring('Netflix', 5590, 5, 't1');

    expect((await listRecurring())[0].tagName).toBe('lazer');
  });

  it('devolve tagName null quando não há tag', async () => {
    await createRecurring('Netflix', 5590, 5, null);
    expect((await listRecurring())[0].tagName).toBeNull();
  });
});

describe('getRecurringById', () => {
  it('devolve null para id inexistente', async () => {
    expect(await getRecurringById('não-existe')).toBeNull();
  });
});

describe('listPendingRecurring', () => {
  it('lista a assinatura que já venceu e não foi lançada', async () => {
    await createRecurring('Netflix', 5590, 5, null);

    const pending = await listPendingRecurring(3, 2026, new Date(2026, 2, 10));
    expect(pending.map((p) => p.name)).toEqual(['Netflix']);
  });

  it('esconde a assinatura cujo vencimento ainda não chegou no mês corrente', async () => {
    await createRecurring('Netflix', 5590, 20, null);

    const pending = await listPendingRecurring(3, 2026, new Date(2026, 2, 10));
    expect(pending).toEqual([]);
  });

  it('mostra no próprio dia do vencimento', async () => {
    await createRecurring('Netflix', 5590, 10, null);

    const pending = await listPendingRecurring(3, 2026, new Date(2026, 2, 10));
    expect(pending).toHaveLength(1);
  });

  it('considera todas vencidas em meses passados', async () => {
    await createRecurring('Netflix', 5590, 28, null);

    // Consultando janeiro em março: o dia 28 de janeiro já passou.
    const pending = await listPendingRecurring(1, 2026, new Date(2026, 2, 10));
    expect(pending).toHaveLength(1);
  });

  it('some depois que a cobrança do mês é lançada', async () => {
    const recurring = await createRecurring('Netflix', 5590, 5, null);
    await createTransaction({
      tag_id: null,
      amount_cents: 5590,
      type: 'expense',
      description: 'Netflix',
      occurred_at: ts(2026, 3, 5),
      recurring_id: recurring.id,
    });

    const pending = await listPendingRecurring(3, 2026, new Date(2026, 2, 10));
    expect(pending).toEqual([]);
  });

  it('continua pendente no mês seguinte — a cobrança é mensal', async () => {
    const recurring = await createRecurring('Netflix', 5590, 5, null);
    await createTransaction({
      tag_id: null,
      amount_cents: 5590,
      type: 'expense',
      description: 'Netflix',
      occurred_at: ts(2026, 3, 5),
      recurring_id: recurring.id,
    });

    const pending = await listPendingRecurring(4, 2026, new Date(2026, 3, 10));
    expect(pending.map((p) => p.name)).toEqual(['Netflix']);
  });

  it('não conta uma transação avulsa de mesmo nome como pagamento', async () => {
    await createRecurring('Netflix', 5590, 5, null);
    // Sem recurring_id: é uma transação solta que por acaso se chama igual.
    await createTransaction({
      tag_id: null,
      amount_cents: 5590,
      type: 'expense',
      description: 'Netflix',
      occurred_at: ts(2026, 3, 5),
    });

    const pending = await listPendingRecurring(3, 2026, new Date(2026, 2, 10));
    expect(pending).toHaveLength(1);
  });

  it('trata vencimento no dia 31 como vencido no fim de fevereiro', async () => {
    await createRecurring('Aluguel', 150000, 31, null);

    // Fevereiro não tem dia 31; sem o clamp, esta assinatura nunca apareceria.
    const pending = await listPendingRecurring(2, 2026, new Date(2026, 1, 28));
    expect(pending).toHaveLength(1);
  });

  it('lista várias pendências ordenadas pelo dia', async () => {
    await createRecurring('Academia', 12000, 8, null);
    await createRecurring('Netflix', 5590, 3, null);

    const pending = await listPendingRecurring(3, 2026, new Date(2026, 2, 10));
    expect(pending.map((p) => p.name)).toEqual(['Netflix', 'Academia']);
  });
});

describe('deleteRecurring', () => {
  it('remove a assinatura da lista de pendências', async () => {
    const recurring = await createRecurring('Netflix', 5590, 5, null);
    await deleteRecurring(recurring.id);

    expect(await listPendingRecurring(3, 2026, new Date(2026, 2, 10))).toEqual([]);
  });
});
