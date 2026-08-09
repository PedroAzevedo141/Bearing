/**
 * utils/money.ts
 *
 * Aritmética e formatação de dinheiro. Todo valor circula em centavos
 * (inteiro) — float só aparece no último instante, dentro do Intl, para
 * exibição. Ver docs/DATA_MODEL.md para o porquê dessa regra.
 */
import type { InstallmentPurchase, Transaction } from '../types';
import { addMonths, monthsBetween } from './date';

/**
 * Calcula o saldo líquido (entradas - saídas) de um período.
 *
 * @param transactions - Lista de transações já filtradas pelo período desejado
 * @returns Saldo em centavos. Positivo = superávit, negativo = déficit.
 *
 * @example
 * const saldo = calculateNetFlow(transactionsDoMes);
 * // saldo = 15000 significa R$ 150,00 de saldo positivo
 */
export function calculateNetFlow(transactions: Transaction[]): number {
  return transactions.reduce((total, t) => {
    return total + (t.type === 'income' ? t.amount_cents : -t.amount_cents);
  }, 0);
}

/**
 * Formata centavos como moeda brasileira.
 *
 * @param cents - Valor em centavos (pode ser negativo).
 * @returns String formatada, ex: "R$ 1.234,56" ou "-R$ 45,00".
 *
 * @example
 * formatCents(123456); // "R$ 1.234,56"
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

/**
 * Converte centavos no texto editável de um campo de valor ("1234,56"), sem
 * símbolo de moeda — o inverso de `parseCents`, para pré-preencher inputs.
 *
 * @param cents - Valor em centavos.
 * @returns String com vírgula decimal e sempre 2 casas (ex: "1234,56").
 *
 * @example
 * centsToAmountInput(123456); // "1234,56"
 */
export function centsToAmountInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * Converte a digitação do usuário ("1.234,56", "1234.56", "1234") em centavos.
 *
 * Aceita tanto vírgula quanto ponto como separador decimal e ignora
 * separadores de milhar — necessário porque o teclado numérico do iOS/Android
 * varia com a região do aparelho.
 *
 * @param input - Texto digitado pelo usuário.
 * @returns Valor em centavos, ou null se o texto não for um número válido.
 *
 * @example
 * parseCents('1.234,56'); // 123456
 * parseCents('50');       // 5000
 * parseCents('abc');      // null
 */
export function parseCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  // Última vírgula ou ponto é tratado como separador decimal se seguido de 1-2 dígitos.
  const normalized = trimmed.replace(/[^\d.,-]/g, '');
  const match = normalized.match(/^(-?)([\d.,]*?)(?:[.,](\d{1,2}))?$/);
  if (!match) {
    return null;
  }
  const [, sign, wholeRaw, decimals] = match;
  const whole = wholeRaw.replace(/[.,]/g, '');
  if (!whole && !decimals) {
    return null;
  }
  const cents = Number(whole || '0') * 100 + Number((decimals ?? '').padEnd(2, '0') || '0');
  if (!Number.isFinite(cents)) {
    return null;
  }
  return sign === '-' ? -cents : cents;
}

/**
 * Valor de cada parcela de uma compra parcelada, em centavos.
 *
 * Divisão inteira com arredondamento para cima na exibição simples —
 * o MVP não distribui o resto entre parcelas (a fatura real do cartão é a
 * fonte de verdade; este valor é uma projeção).
 *
 * @param totalCents - Valor total da compra em centavos.
 * @param installmentCount - Quantidade de parcelas (>= 1).
 * @returns Valor aproximado de cada parcela em centavos.
 */
export function installmentAmountCents(totalCents: number, installmentCount: number): number {
  return Math.round(totalCents / Math.max(installmentCount, 1));
}

/** Campos de uma compra parcelada que determinam em que parcela ela está. */
type InstallmentSchedule = Pick<InstallmentPurchase, 'first_due_date' | 'installment_count'>;

/**
 * Em que parcela a compra está hoje, derivado do vencimento da primeira.
 *
 * A posição **não** é armazenada: ela é função da data da 1ª parcela e do dia
 * de hoje (ver docs/DATA_MODEL.md, seção `installment_purchases`). Guardar um
 * contador significaria depender de alguém lembrar de incrementá-lo — e um
 * contador que ninguém avança envelhece em silêncio, mentindo sobre quanto
 * ainda falta pagar.
 *
 * @param purchase - Compra parcelada (só os dois campos usados no cálculo).
 * @param now - Momento de referência; default é agora. Existe para testes.
 * @returns Parcela atual, 1-indexed. Vale 1 enquanto a primeira não venceu e
 *   `installment_count + 1` quando a compra já foi quitada.
 *
 * @example
 * // 1ª parcela em 10/01, hoje é 15/03 → 3ª parcela
 * currentInstallmentFor({ first_due_date: ..., installment_count: 10 });
 */
export function currentInstallmentFor(purchase: InstallmentSchedule, now: Date = new Date()): number {
  const elapsed = monthsBetween(new Date(purchase.first_due_date * 1000), now);
  const current = elapsed + 1;
  if (current < 1) {
    return 1;
  }
  return Math.min(current, purchase.installment_count + 1);
}

/**
 * Diz se uma compra parcelada já foi quitada.
 *
 * @param purchase - Compra parcelada (só os dois campos usados no cálculo).
 * @param now - Momento de referência; default é agora. Existe para testes.
 * @returns true quando a última parcela já venceu.
 *
 * @example
 * // 10 parcelas, 1ª em 10/01/2025, hoje em 2026 → true
 * isInstallmentCompleted(purchase);
 */
export function isInstallmentCompleted(
  purchase: InstallmentSchedule,
  now: Date = new Date()
): boolean {
  return currentInstallmentFor(purchase, now) > purchase.installment_count;
}

/**
 * Reconstrói o vencimento da 1ª parcela a partir de uma cobrança conhecida.
 *
 * Serve à importação de extrato: o extrato diz "parcela 3/10 em 05/03", e daí
 * sai a âncora da compra inteira (1ª parcela em 05/01). É o que substitui o
 * antigo "avançar o contador" — em vez de corrigir a posição, corrige-se o
 * calendário, e a posição passa a se manter sozinha.
 *
 * @param chargedAt - Unix timestamp (segundos) da cobrança observada.
 * @param installmentNumber - Número da parcela cobrada, 1-indexed.
 * @returns Unix timestamp (segundos) do vencimento da 1ª parcela.
 *
 * @example
 * // parcela 3 cobrada em 05/03 → 1ª parcela em 05/01
 * firstDueDateFor(marco05, 3);
 */
export function firstDueDateFor(chargedAt: number, installmentNumber: number): number {
  const anchor = addMonths(new Date(chargedAt * 1000), -(Math.max(installmentNumber, 1) - 1));
  return Math.floor(anchor.getTime() / 1000);
}
