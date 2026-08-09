import { describe, expect, it } from 'vitest';

import { addMonths, formatDateInput, monthsBetween, parseDateInput, startOfDay } from './date';

describe('addMonths', () => {
  it('preserva o dia quando ele existe no mês de destino', () => {
    expect(addMonths(new Date(2026, 0, 15), 1)).toEqual(new Date(2026, 1, 15));
  });

  it('cai para o último dia do mês quando o dia não existe', () => {
    // 31/01 + 1 mês = 28/02, não 03/03 (que é o que o Date faria sozinho).
    expect(addMonths(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 28));
  });

  it('respeita ano bissexto ao encurtar o dia', () => {
    expect(addMonths(new Date(2024, 0, 31), 1)).toEqual(new Date(2024, 1, 29));
  });

  it('atravessa a virada de ano', () => {
    expect(addMonths(new Date(2026, 10, 10), 3)).toEqual(new Date(2027, 1, 10));
  });

  it('subtrai meses com valor negativo', () => {
    expect(addMonths(new Date(2026, 2, 5), -2)).toEqual(new Date(2026, 0, 5));
  });

  it('não modifica a data recebida', () => {
    const original = new Date(2026, 0, 31);
    addMonths(original, 5);
    expect(original).toEqual(new Date(2026, 0, 31));
  });
});

describe('monthsBetween', () => {
  it('conta zero antes de o dia do mês ser alcançado', () => {
    expect(monthsBetween(new Date(2026, 0, 10), new Date(2026, 1, 9))).toBe(0);
  });

  it('conta um mês exatamente no dia do aniversário', () => {
    expect(monthsBetween(new Date(2026, 0, 10), new Date(2026, 1, 10))).toBe(1);
  });

  it('trata o fim de mês curto como mês completo', () => {
    // 31/01 → 28/02: fevereiro não tem dia 31, então o dia 28 fecha o mês.
    expect(monthsBetween(new Date(2026, 0, 31), new Date(2026, 1, 28))).toBe(1);
  });

  it('ignora a hora do dia', () => {
    expect(monthsBetween(new Date(2026, 0, 10, 23, 59), new Date(2026, 1, 10, 0, 1))).toBe(1);
  });

  it('é negativo quando a data final é anterior', () => {
    expect(monthsBetween(new Date(2026, 5, 10), new Date(2026, 3, 10))).toBe(-2);
  });
});

describe('startOfDay', () => {
  it('zera a hora', () => {
    expect(startOfDay(new Date(2026, 3, 7, 18, 42, 9))).toEqual(new Date(2026, 3, 7));
  });
});

describe('parseDateInput', () => {
  it('lê o formato brasileiro', () => {
    expect(parseDateInput('05/03/2026')).toEqual(new Date(2026, 2, 5));
  });

  it('aceita dia e mês sem zero à esquerda', () => {
    expect(parseDateInput('5/3/2026')).toEqual(new Date(2026, 2, 5));
  });

  it('ignora espaços em volta', () => {
    expect(parseDateInput('  05/03/2026 ')).toEqual(new Date(2026, 2, 5));
  });

  it('rejeita data que não existe no calendário', () => {
    expect(parseDateInput('31/02/2026')).toBeNull();
  });

  it('rejeita mês fora do intervalo', () => {
    expect(parseDateInput('10/13/2026')).toBeNull();
  });

  it('rejeita texto que não é data', () => {
    expect(parseDateInput('amanhã')).toBeNull();
    expect(parseDateInput('')).toBeNull();
    expect(parseDateInput('2026-03-05')).toBeNull();
  });
});

describe('formatDateInput', () => {
  it('preenche com zeros à esquerda', () => {
    expect(formatDateInput(new Date(2026, 2, 5))).toBe('05/03/2026');
  });

  it('faz ida e volta com parseDateInput', () => {
    const text = '17/11/2025';
    expect(formatDateInput(parseDateInput(text)!)).toBe(text);
  });
});
