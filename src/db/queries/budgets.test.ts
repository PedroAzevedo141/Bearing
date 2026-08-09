/**
 * budgets.test.ts
 *
 * O que importa cobrir aqui é o versionamento do limite (migration v8): a
 * promessa de que meses passados continuam avaliados pelo limite que valia
 * neles. É uma regra fácil de quebrar num refactor e impossível de perceber
 * olhando a tela — o número simplesmente fica errado sobre o passado.
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

const { deleteBudgetForTag, getBudgetsWithProgress, setBudget } = await import('./budgets');
const { createTransaction } = await import('./transactions');

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(() => {
  db.close();
});

async function insertTag(name: string): Promise<string> {
  const id = `tag-${name}`;
  await db.runAsync('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)', id, name, null);
  return id;
}

describe('setBudget', () => {
  it('cria o limite vigente a partir da competência informada', async () => {
    const tag = await insertTag('mercado');
    await setBudget(tag, 50000, 3, 2026);

    const [budget] = await getBudgetsWithProgress(3, 2026);
    expect(budget).toMatchObject({ tagName: 'mercado', limit_cents: 50000 });
  });

  it('sobrescreve quando o mês já tem versão, em vez de duplicar', async () => {
    const tag = await insertTag('mercado');
    await setBudget(tag, 50000, 3, 2026);
    await setBudget(tag, 70000, 3, 2026);

    const budgets = await getBudgetsWithProgress(3, 2026);
    expect(budgets).toHaveLength(1);
    expect(budgets[0].limit_cents).toBe(70000);
  });

  it('cria versão nova num mês seguinte sem apagar a anterior', async () => {
    const tag = await insertTag('mercado');
    await setBudget(tag, 50000, 3, 2026);
    await setBudget(tag, 80000, 6, 2026);

    expect((await getBudgetsWithProgress(3, 2026))[0].limit_cents).toBe(50000);
    expect((await getBudgetsWithProgress(6, 2026))[0].limit_cents).toBe(80000);
  });
});

describe('getBudgetsWithProgress — limite vigente', () => {
  it('mantém o limite antigo nos meses entre duas versões', async () => {
    const tag = await insertTag('mercado');
    await setBudget(tag, 50000, 1, 2026);
    await setBudget(tag, 80000, 6, 2026);

    // Abril está entre janeiro e junho: vale o limite de janeiro.
    expect((await getBudgetsWithProgress(4, 2026))[0].limit_cents).toBe(50000);
  });

  it('propaga a última versão para os meses seguintes', async () => {
    const tag = await insertTag('mercado');
    await setBudget(tag, 80000, 6, 2026);

    expect((await getBudgetsWithProgress(11, 2026))[0].limit_cents).toBe(80000);
    expect((await getBudgetsWithProgress(2, 2027))[0].limit_cents).toBe(80000);
  });

  it('não mostra orçamento em meses anteriores à sua criação', async () => {
    const tag = await insertTag('mercado');
    await setBudget(tag, 50000, 6, 2026);

    // Não havia limite em março — avaliar março contra 50000 seria inventar
    // uma regra que não existia.
    expect(await getBudgetsWithProgress(3, 2026)).toEqual([]);
  });

  it('atravessa a virada de ano', async () => {
    const tag = await insertTag('mercado');
    await setBudget(tag, 50000, 12, 2025);

    expect((await getBudgetsWithProgress(1, 2026))[0].limit_cents).toBe(50000);
  });
});

describe('getBudgetsWithProgress — gasto da competência', () => {
  it('soma só as despesas da tag no mês consultado', async () => {
    const tag = await insertTag('mercado');
    await setBudget(tag, 50000, 1, 2026);

    await createTransaction({
      tag_id: tag,
      amount_cents: 12000,
      type: 'expense',
      description: null,
      occurred_at: ts(2026, 3, 5),
    });
    await createTransaction({
      tag_id: tag,
      amount_cents: 30000,
      type: 'expense',
      description: null,
      occurred_at: ts(2026, 4, 5),
    });

    expect((await getBudgetsWithProgress(3, 2026))[0].spentCents).toBe(12000);
  });

  it('ignora entradas — orçamento é sobre gasto', async () => {
    const tag = await insertTag('mercado');
    await setBudget(tag, 50000, 1, 2026);
    await createTransaction({
      tag_id: tag,
      amount_cents: 90000,
      type: 'income',
      description: null,
      occurred_at: ts(2026, 3, 5),
    });

    expect((await getBudgetsWithProgress(3, 2026))[0].spentCents).toBe(0);
  });

  it('ignora gasto de outra tag', async () => {
    const mercado = await insertTag('mercado');
    const lazer = await insertTag('lazer');
    await setBudget(mercado, 50000, 1, 2026);
    await createTransaction({
      tag_id: lazer,
      amount_cents: 40000,
      type: 'expense',
      description: null,
      occurred_at: ts(2026, 3, 5),
    });

    expect((await getBudgetsWithProgress(3, 2026))[0].spentCents).toBe(0);
  });

  it('avalia o mesmo gasto contra o limite da época, não contra o atual', async () => {
    const tag = await insertTag('mercado');
    await setBudget(tag, 50000, 1, 2026);
    await createTransaction({
      tag_id: tag,
      amount_cents: 60000,
      type: 'expense',
      description: null,
      occurred_at: ts(2026, 3, 5),
    });
    // Usuário sobe o limite depois. Março estourou e tem que continuar
    // estourado — é a regressão que a v8 veio impedir.
    await setBudget(tag, 90000, 8, 2026);

    const [marco] = await getBudgetsWithProgress(3, 2026);
    expect(marco.limit_cents).toBe(50000);
    expect(marco.spentCents).toBeGreaterThan(marco.limit_cents);
  });
});

describe('deleteBudgetForTag', () => {
  it('apaga todas as versões do limite da tag', async () => {
    const tag = await insertTag('mercado');
    await setBudget(tag, 50000, 1, 2026);
    await setBudget(tag, 80000, 6, 2026);

    await deleteBudgetForTag(tag);

    expect(await getBudgetsWithProgress(3, 2026)).toEqual([]);
    expect(await getBudgetsWithProgress(8, 2026)).toEqual([]);
  });

  it('não afeta o orçamento de outras tags', async () => {
    const mercado = await insertTag('mercado');
    const lazer = await insertTag('lazer');
    await setBudget(mercado, 50000, 1, 2026);
    await setBudget(lazer, 20000, 1, 2026);

    await deleteBudgetForTag(mercado);

    const restantes = await getBudgetsWithProgress(3, 2026);
    expect(restantes.map((b) => b.tagName)).toEqual(['lazer']);
  });
});
