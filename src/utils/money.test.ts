/**
 * money.test.ts
 *
 * Cobre a aritmética de dinheiro do app — a regra "sempre centavos, nunca
 * float" só vale alguma coisa se houver teste provando que a soma repetida
 * não acumula erro de ponto flutuante (ver docs/DATA_MODEL.md).
 */
import { describe, expect, it } from 'vitest';

import type { Transaction } from '../types';
import {
  calculateNetFlow,
  formatCents,
  installmentAmountCents,
  isInstallmentCompleted,
  parseCents,
} from './money';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    account_id: 'acc-1',
    tag_id: null,
    amount_cents: 0,
    type: 'expense',
    description: null,
    occurred_at: 0,
    created_at: 0,
    ...overrides,
  };
}

describe('parseCents', () => {
  it('aceita vírgula como separador decimal', () => {
    expect(parseCents('45,90')).toBe(4590);
  });

  it('aceita ponto como separador decimal', () => {
    expect(parseCents('45.90')).toBe(4590);
  });

  it('ignora separador de milhar', () => {
    expect(parseCents('1.234,56')).toBe(123456);
  });

  it('aceita inteiro sem separador decimal', () => {
    expect(parseCents('50')).toBe(5000);
  });

  it('aceita valores negativos', () => {
    expect(parseCents('-10,00')).toBe(-1000);
  });

  it('retorna null para texto vazio', () => {
    expect(parseCents('')).toBeNull();
    expect(parseCents('   ')).toBeNull();
  });

  it('retorna null para texto não numérico', () => {
    expect(parseCents('abc')).toBeNull();
  });
});

describe('calculateNetFlow', () => {
  it('soma entradas e subtrai saídas', () => {
    const transactions = [
      tx({ type: 'income', amount_cents: 10000 }),
      tx({ type: 'expense', amount_cents: 2500 }),
    ];
    expect(calculateNetFlow(transactions)).toBe(7500);
  });

  it('retorna 0 para lista vazia', () => {
    expect(calculateNetFlow([])).toBe(0);
  });

  it('não acumula erro de ponto flutuante somando centavos repetidamente', () => {
    // Se isso fosse feito em reais (float), 0.1 + 0.2 + ... acumularia erro
    // de arredondamento. Em centavos (inteiro), a soma é exata.
    const transactions = Array.from({ length: 10 }, () => tx({ type: 'income', amount_cents: 10 }));
    expect(calculateNetFlow(transactions)).toBe(100);
    expect(Number.isInteger(calculateNetFlow(transactions))).toBe(true);
  });
});

describe('formatCents', () => {
  it('formata centavos positivos como moeda BRL', () => {
    expect(formatCents(123456)).toBe('R$ 1.234,56');
  });

  it('formata centavos negativos com sinal', () => {
    expect(formatCents(-4500)).toBe('-R$ 45,00');
  });
});

describe('installmentAmountCents', () => {
  it('divide o total pelo número de parcelas', () => {
    expect(installmentAmountCents(350000, 10)).toBe(35000);
  });

  it('arredonda quando a divisão não é exata', () => {
    expect(installmentAmountCents(100, 3)).toBe(33);
  });

  it('não divide por zero', () => {
    expect(installmentAmountCents(1000, 0)).toBe(1000);
  });
});

describe('isInstallmentCompleted', () => {
  it('é falso enquanto a parcela atual está dentro do total', () => {
    expect(
      isInstallmentCompleted({ current_installment: 5, installment_count: 10 })
    ).toBe(false);
  });

  it('é falso na última parcela ainda em aberto', () => {
    expect(
      isInstallmentCompleted({ current_installment: 10, installment_count: 10 })
    ).toBe(false);
  });

  it('é verdadeiro quando a parcela atual passou do total', () => {
    expect(
      isInstallmentCompleted({ current_installment: 11, installment_count: 10 })
    ).toBe(true);
  });
});
