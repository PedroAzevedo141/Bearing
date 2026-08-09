/**
 * utils/date.ts
 *
 * Aritmética de calendário usada pelas projeções do app (parcelas, assinaturas)
 * e o parsing das datas digitadas pelo usuário.
 *
 * A regra que atravessa este módulo: "um mês depois" é dia-a-dia sempre que o
 * dia existe no mês de destino, e o último dia do mês quando não existe — 31/01
 * + 1 mês é 28/02, não 03/03. Sem esse cuidado, uma compra parcelada com
 * vencimento no dia 31 saltaria uma parcela em fevereiro.
 */

/**
 * Soma (ou subtrai) meses a uma data, preservando o dia sempre que possível.
 *
 * Quando o dia de origem não existe no mês de destino, cai para o último dia
 * desse mês em vez de transbordar para o mês seguinte, que é o comportamento
 * padrão do `Date` do JavaScript.
 *
 * @param date - Data de origem. Não é modificada.
 * @param months - Meses a somar; negativo subtrai.
 * @returns Nova data com a hora do original preservada.
 *
 * @example
 * addMonths(new Date(2026, 0, 31), 1); // 28/02/2026, não 03/03/2026
 */
export function addMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const result = new Date(
    date.getFullYear(),
    date.getMonth() + months,
    1,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    0
  );
  // Dia 0 do mês seguinte = último dia do mês corrente.
  const lastDayOfTarget = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDayOfTarget));
  return result;
}

/**
 * Zera a hora de uma data, para comparações no nível do dia.
 *
 * @param date - Data de origem. Não é modificada.
 * @returns Nova data à meia-noite local.
 */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Quantos meses **completos** se passaram entre duas datas.
 *
 * Um mês só conta quando o dia do mês é alcançado: de 10/01 para 09/02 são 0
 * meses; para 10/02, 1 mês. O aniversário usa a mesma regra de `addMonths`, de
 * modo que 31/01 → 28/02 conta como 1 mês completo.
 *
 * @param from - Data inicial.
 * @param to - Data final.
 * @returns Meses completos decorridos. Negativo se `to` for anterior a `from`.
 *
 * @example
 * monthsBetween(new Date(2026, 0, 10), new Date(2026, 2, 9)); // 1
 */
export function monthsBetween(from: Date, to: Date): number {
  const start = startOfDay(from);
  const end = startOfDay(to);
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getTime() < startOfDay(addMonths(start, months)).getTime()) {
    months -= 1;
  }
  return months;
}

/**
 * Uma competência mensal — o recorte por que o usuário raciocina ao olhar
 * finanças ("como foi março?"), diferente de uma janela móvel de N dias.
 */
export interface MonthRef {
  /** Mês 1-12 (não 0-11 como no `Date`, para casar com o que as queries pedem). */
  month: number;
  /** Ano com 4 dígitos. */
  year: number;
}

/**
 * A competência do mês corrente.
 *
 * @param now - Momento de referência; default é agora. Existe para testes.
 * @returns Mês e ano atuais.
 */
export function currentMonthRef(now: Date = new Date()): MonthRef {
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/**
 * Anda meses para frente ou para trás numa competência.
 *
 * @param ref - Competência de origem.
 * @param delta - Meses a somar; negativo volta.
 * @returns Nova competência, com a virada de ano já resolvida.
 *
 * @example
 * shiftMonth({ month: 1, year: 2026 }, -1); // { month: 12, year: 2025 }
 */
export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const date = new Date(ref.year, ref.month - 1 + delta, 1);
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

/**
 * Diz se duas competências são a mesma.
 *
 * @param a - Primeira competência.
 * @param b - Segunda competência.
 * @returns true se mês e ano coincidem.
 */
export function isSameMonth(a: MonthRef, b: MonthRef): boolean {
  return a.month === b.month && a.year === b.year;
}

/**
 * Rótulo da competência para exibição.
 *
 * Omite o ano quando é o ano corrente — "março" é mais leve de ler que
 * "março de 2026" e não perde informação no caso mais comum.
 *
 * @param ref - Competência a rotular.
 * @param now - Momento de referência; default é agora. Existe para testes.
 * @returns Ex: "março" ou "março de 2025".
 */
export function formatMonthLabel(ref: MonthRef, now: Date = new Date()): string {
  const date = new Date(ref.year, ref.month - 1, 1);
  const month = date.toLocaleDateString('pt-BR', { month: 'long' });
  return ref.year === now.getFullYear() ? month : `${month} de ${ref.year}`;
}

/**
 * Converte a digitação do usuário no formato brasileiro em `Date`.
 *
 * Rejeita datas que não existem no calendário (ex: 31/02/2026) — o `Date` do
 * JavaScript aceitaria e transbordaria silenciosamente para 03/03.
 *
 * @param input - Texto no formato `DD/MM/AAAA`.
 * @returns A data à meia-noite local, ou null se o texto não for uma data válida.
 *
 * @example
 * parseDateInput('05/03/2026'); // 05/03/2026 00:00
 * parseDateInput('31/02/2026'); // null
 */
export function parseDateInput(input: string): Date | null {
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }
  const [, dayRaw, monthRaw, yearRaw] = match;
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  const date = new Date(year, month - 1, day);
  // Se algum campo foi normalizado, a data digitada não existe.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Formata uma data no padrão brasileiro, para pré-preencher campos de texto.
 *
 * @param date - Data a formatar.
 * @returns String `DD/MM/AAAA` com zeros à esquerda.
 *
 * @example
 * formatDateInput(new Date(2026, 2, 5)); // "05/03/2026"
 */
export function formatDateInput(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}
