/**
 * utils/money.ts
 *
 * Aritmética e formatação de dinheiro. Todo valor circula em centavos
 * (inteiro) — float só aparece no último instante, dentro do Intl, para
 * exibição. Ver docs/DATA_MODEL.md para o porquê dessa regra.
 */
import type { InstallmentPurchase, Transaction } from '../types';

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

/**
 * Diz se uma compra parcelada já foi quitada.
 *
 * Sempre derivado de `current_installment`/`installment_count` — não existe
 * coluna `status` no banco (ver docs/DATA_MODEL.md, seção
 * `installment_purchases`): guardar um status seria duplicar informação que
 * já existe nos dois contadores, com risco de os dois divergirem.
 *
 * @param purchase - Compra parcelada (só os dois campos usados no cálculo).
 * @returns true se a parcela atual passou do total de parcelas.
 *
 * @example
 * isInstallmentCompleted({ current_installment: 11, installment_count: 10 }); // true
 */
export function isInstallmentCompleted(
  purchase: Pick<InstallmentPurchase, 'current_installment' | 'installment_count'>
): boolean {
  return purchase.current_installment > purchase.installment_count;
}
