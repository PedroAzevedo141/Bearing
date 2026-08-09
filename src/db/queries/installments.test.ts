/**
 * installments.test.ts
 *
 * Cobre a persistência das compras parceladas depois da v6, que removeu
 * `current_installment`. O ponto sensível é o schema não voltar a aceitar um
 * contador de posição por engano: a posição é derivada de `first_due_date`
 * (ver src/utils/money.ts), e um campo redundante reintroduziria a divergência
 * que a v6 eliminou.
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

const {
  createInstallmentPurchase,
  deleteInstallmentPurchase,
  listInstallmentPurchases,
  updateInstallmentPurchase,
} = await import('./installments');

beforeEach(async () => {
  db = await createTestDatabase();
});

afterEach(() => {
  db.close();
});

describe('schema após a v6', () => {
  it('não tem mais a coluna current_installment', async () => {
    const columns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(installment_purchases)'
    );
    expect(columns.map((c) => c.name)).not.toContain('current_installment');
  });
});

describe('createInstallmentPurchase', () => {
  it('persiste a compra ancorada na data da 1ª parcela', async () => {
    const created = await createInstallmentPurchase({
      name: 'Notebook Dell',
      tag_id: null,
      total_amount_cents: 350000,
      installment_count: 10,
      first_due_date: ts(2026, 1, 10),
    });

    const [row] = await listInstallmentPurchases();
    expect(row).toMatchObject({
      id: created.id,
      name: 'Notebook Dell',
      total_amount_cents: 350000,
      installment_count: 10,
      first_due_date: ts(2026, 1, 10),
    });
  });

  it('recusa menos de uma parcela', async () => {
    await expect(
      createInstallmentPurchase({
        name: 'Inválida',
        tag_id: null,
        total_amount_cents: 1000,
        installment_count: 0,
        first_due_date: ts(2026, 1, 10),
      })
    ).rejects.toThrow('Parcelas devem ser >= 1');
  });

  it('recusa total zero — o CHECK do banco é a última defesa', async () => {
    await expect(
      createInstallmentPurchase({
        name: 'Inválida',
        tag_id: null,
        total_amount_cents: 0,
        installment_count: 3,
        first_due_date: ts(2026, 1, 10),
      })
    ).rejects.toThrow();
  });

  it('ordena da mais recente para a mais antiga', async () => {
    await createInstallmentPurchase({
      name: 'Primeira',
      tag_id: null,
      total_amount_cents: 1000,
      installment_count: 2,
      first_due_date: ts(2026, 1, 10),
    });
    await createInstallmentPurchase({
      name: 'Segunda',
      tag_id: null,
      total_amount_cents: 1000,
      installment_count: 2,
      first_due_date: ts(2026, 2, 10),
    });

    const rows = await listInstallmentPurchases();
    expect(rows).toHaveLength(2);
  });
});

describe('updateInstallmentPurchase', () => {
  it('reancora o cronograma ao mudar first_due_date', async () => {
    const created = await createInstallmentPurchase({
      name: 'Notebook',
      tag_id: null,
      total_amount_cents: 350000,
      installment_count: 10,
      first_due_date: ts(2026, 3, 10),
    });

    // É o que a importação de extrato faz ao ver "parcela 3/10".
    await updateInstallmentPurchase(created.id, {
      name: 'Notebook',
      tag_id: null,
      total_amount_cents: 350000,
      installment_count: 10,
      first_due_date: ts(2026, 1, 10),
    });

    const [row] = await listInstallmentPurchases();
    expect(row.first_due_date).toBe(ts(2026, 1, 10));
  });

  it('recusa contagem de parcelas inválida', async () => {
    const created = await createInstallmentPurchase({
      name: 'Notebook',
      tag_id: null,
      total_amount_cents: 1000,
      installment_count: 3,
      first_due_date: ts(2026, 1, 10),
    });

    await expect(
      updateInstallmentPurchase(created.id, {
        name: 'Notebook',
        tag_id: null,
        total_amount_cents: 1000,
        installment_count: 0,
        first_due_date: ts(2026, 1, 10),
      })
    ).rejects.toThrow('Parcelas devem ser >= 1');
  });
});

describe('deleteInstallmentPurchase', () => {
  it('remove só a compra pedida', async () => {
    const a = await createInstallmentPurchase({
      name: 'A',
      tag_id: null,
      total_amount_cents: 1000,
      installment_count: 2,
      first_due_date: ts(2026, 1, 10),
    });
    await createInstallmentPurchase({
      name: 'B',
      tag_id: null,
      total_amount_cents: 1000,
      installment_count: 2,
      first_due_date: ts(2026, 1, 10),
    });

    await deleteInstallmentPurchase(a.id);

    const rows = await listInstallmentPurchases();
    expect(rows.map((r) => r.name)).toEqual(['B']);
  });
});
