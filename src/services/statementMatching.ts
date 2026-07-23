/**
 * statementMatching.ts
 *
 * Lógica **pura** de casamento entre um item importado do extrato e uma
 * compra parcelada já existente — sem nenhum import de `expo-sqlite` (nem
 * indireto), pra rodar em vitest puro (mesmo motivo de src/db/applyMigrations.ts).
 * A persistência fica em statementService.ts; aqui só cálculo.
 *
 * Relacionado: src/services/statementService.ts, src/services/statementMatching.test.ts
 */
import type { InstallmentPurchase, ParsedStatementItem } from '../types';

/** Tolerância (centavos) na comparação de total, pra absorver arredondamento. */
const AMOUNT_TOLERANCE_CENTS = 100;

/**
 * Diz se dois nomes são "parecidos": compartilham ao menos uma palavra
 * significativa (>2 letras) ou um é substring do outro. Usado pra reconhecer
 * a mesma compra parcelada em extratos de meses diferentes, mesmo com a
 * descrição variando ("PGTO NOTEBOOK" vs "Notebook Dell").
 *
 * @param a - Primeiro nome.
 * @param b - Segundo nome.
 * @returns true se forem considerados o mesmo item.
 *
 * @example
 * isNameSimilar('PGTO NOTEBOOK', 'Notebook Dell'); // true
 * isNameSimilar('Uber', 'iFood'); // false
 */
export function isNameSimilar(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const wordsA = normalize(a);
  const wordsB = normalize(b);
  if (wordsA.length === 0 || wordsB.length === 0) {
    return a.toLowerCase().trim() === b.toLowerCase().trim();
  }
  const hasCommonWord = wordsA.some((w) => wordsB.includes(w));
  return (
    hasCommonWord ||
    a.toLowerCase().includes(b.toLowerCase()) ||
    b.toLowerCase().includes(a.toLowerCase())
  );
}

/**
 * Encontra, entre as compras parceladas existentes, a que corresponde ao item
 * importado — pra atualizar a parcela atual em vez de duplicar a compra a cada
 * extrato mensal. Casa por total aproximado + mesmo número de parcelas + nome
 * parecido.
 *
 * `amount_cents` do item é o valor de uma parcela, então o total esperado é
 * `amount_cents * installment_total` (ver docs/API_CONTRACTS.md).
 *
 * @param item - Item importado (só parcelas casam; avulsos retornam undefined).
 * @param activeInstallments - Compras parceladas já cadastradas.
 * @returns A compra correspondente, ou undefined se for uma compra nova.
 */
export function findMatchingInstallment(
  item: ParsedStatementItem,
  activeInstallments: InstallmentPurchase[]
): InstallmentPurchase | undefined {
  if (!item.is_installment || !item.installment_total) {
    return undefined;
  }
  const expectedTotal = item.amount_cents * item.installment_total;
  return activeInstallments.find((i) => {
    const amountMatch = Math.abs(i.total_amount_cents - expectedTotal) < AMOUNT_TOLERANCE_CENTS;
    const countMatch = i.installment_count === item.installment_total;
    const nameMatch = isNameSimilar(i.name, item.description);
    return amountMatch && countMatch && nameMatch;
  });
}
