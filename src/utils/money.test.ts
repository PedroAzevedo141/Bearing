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
  currentInstallmentFor,
  firstDueDateFor,
  formatCents,
  installmentAmountCents,
  isInstallmentCompleted,
  parseCents,
} from './money';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
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

/** Converte uma data local em unix timestamp (segundos), como o banco guarda. */
function ts(year: number, month: number, day: number): number {
  return Math.floor(new Date(year, month - 1, day).getTime() / 1000);
}

describe('currentInstallmentFor', () => {
  it('é a 1ª parcela no próprio dia do vencimento', () => {
    const purchase = { first_due_date: ts(2026, 1, 10), installment_count: 10 };
    expect(currentInstallmentFor(purchase, new Date(2026, 0, 10))).toBe(1);
  });

  it('continua na 1ª parcela antes de a compra começar', () => {
    const purchase = { first_due_date: ts(2026, 5, 10), installment_count: 10 };
    expect(currentInstallmentFor(purchase, new Date(2026, 0, 15))).toBe(1);
  });

  it('avança sozinha conforme os meses passam', () => {
    const purchase = { first_due_date: ts(2026, 1, 10), installment_count: 10 };
    expect(currentInstallmentFor(purchase, new Date(2026, 2, 15))).toBe(3);
  });

  it('só vira a parcela no dia do vencimento, não na virada do mês', () => {
    const purchase = { first_due_date: ts(2026, 1, 20), installment_count: 10 };
    expect(currentInstallmentFor(purchase, new Date(2026, 1, 19))).toBe(1);
    expect(currentInstallmentFor(purchase, new Date(2026, 1, 20))).toBe(2);
  });

  it('não trava em fevereiro quando o vencimento é dia 31', () => {
    const purchase = { first_due_date: ts(2026, 1, 31), installment_count: 10 };
    expect(currentInstallmentFor(purchase, new Date(2026, 1, 28))).toBe(2);
  });

  it('para em installment_count + 1 depois de quitada', () => {
    const purchase = { first_due_date: ts(2020, 1, 10), installment_count: 10 };
    expect(currentInstallmentFor(purchase, new Date(2026, 0, 10))).toBe(11);
  });
});

describe('isInstallmentCompleted', () => {
  it('é falso no meio do cronograma', () => {
    const purchase = { first_due_date: ts(2026, 1, 10), installment_count: 10 };
    expect(isInstallmentCompleted(purchase, new Date(2026, 4, 10))).toBe(false);
  });

  it('é falso na última parcela ainda em aberto', () => {
    // 10 parcelas a partir de 10/01/2026: a 10ª vence em 10/10/2026.
    const purchase = { first_due_date: ts(2026, 1, 10), installment_count: 10 };
    expect(isInstallmentCompleted(purchase, new Date(2026, 9, 10))).toBe(false);
  });

  it('é verdadeiro depois que a última parcela venceu', () => {
    const purchase = { first_due_date: ts(2026, 1, 10), installment_count: 10 };
    expect(isInstallmentCompleted(purchase, new Date(2026, 10, 10))).toBe(true);
  });
});

describe('firstDueDateFor', () => {
  it('devolve a própria data quando a cobrança é a 1ª parcela', () => {
    expect(firstDueDateFor(ts(2026, 3, 5), 1)).toBe(ts(2026, 3, 5));
  });

  it('recua um mês por parcela já cobrada', () => {
    expect(firstDueDateFor(ts(2026, 3, 5), 3)).toBe(ts(2026, 1, 5));
  });

  it('atravessa a virada de ano', () => {
    expect(firstDueDateFor(ts(2026, 2, 20), 4)).toBe(ts(2025, 11, 20));
  });

  it('trata número de parcela inválido como a primeira', () => {
    expect(firstDueDateFor(ts(2026, 3, 5), 0)).toBe(ts(2026, 3, 5));
  });
});
