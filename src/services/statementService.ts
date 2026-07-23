/**
 * statementService.ts
 *
 * Orquestra a importação de extrato: chama o Worker pra classificar o texto
 * (via aiService — nada de `fetch` aqui) e grava os itens já confirmados pelo
 * usuário, usando a camada de queries (nada de SQL solto). O casamento de
 * parcelas é lógica pura em statementMatching.ts (testável sem o banco).
 *
 * Relacionado: docs/API_CONTRACTS.md, src/services/statementMatching.ts
 */
import { fetchParseStatement } from './aiService';
import { findMatchingInstallment } from './statementMatching';
import {
  createInstallmentPurchase,
  listInstallmentPurchases,
  updateInstallmentPurchase,
} from '../db/queries/installments';
import { createTransaction } from '../db/queries/transactions';
import type { ParsedStatementItem } from '../types';

export { findMatchingInstallment, isNameSimilar } from './statementMatching';

/**
 * Classifica o texto de extrato (já revisado na Confirmação 1) em itens.
 *
 * @param ocrText - Texto revisado pelo usuário.
 * @returns Itens classificados, com os campos de parcela normalizados.
 * @throws {AiServiceError} Ver códigos em docs/API_CONTRACTS.md.
 */
export async function parseStatementText(ocrText: string): Promise<ParsedStatementItem[]> {
  const { items } = await fetchParseStatement(ocrText);
  // Garante que os campos de parcela existam (o schema os torna opcionais).
  return items.map((item) => ({
    ...item,
    installment_current: item.installment_current ?? null,
    installment_total: item.installment_total ?? null,
  }));
}

/**
 * Grava os itens importados **após a confirmação do usuário** (Confirmação 2).
 *
 * - Itens avulsos → `transactions`.
 * - Parcelas → casa com uma compra existente (`updateInstallmentPurchase`,
 *   avançando a parcela atual) ou cria uma nova (`createInstallmentPurchase`),
 *   evitando duplicar a mesma compra a cada extrato mensal.
 *
 * @param items - Itens já revisados pelo usuário.
 * @param accountId - Conta destino das transações avulsas.
 */
export async function saveParsedItems(
  items: ParsedStatementItem[],
  accountId: string
): Promise<void> {
  const activeInstallments = await listInstallmentPurchases();

  for (const item of items) {
    if (item.is_installment && item.installment_current && item.installment_total) {
      const match = findMatchingInstallment(item, activeInstallments);
      if (match) {
        // Só avança a parcela atual se o extrato estiver à frente do registrado.
        if (item.installment_current > match.current_installment) {
          await updateInstallmentPurchase(match.id, {
            name: match.name,
            tag_id: match.tag_id,
            total_amount_cents: match.total_amount_cents,
            installment_count: match.installment_count,
            current_installment: item.installment_current,
            first_due_date: match.first_due_date,
          });
        }
      } else {
        await createInstallmentPurchase({
          name: item.description,
          tag_id: null,
          total_amount_cents: item.amount_cents * item.installment_total,
          installment_count: item.installment_total,
          current_installment: item.installment_current,
          first_due_date: item.occurred_at,
        });
      }
    } else {
      await createTransaction({
        account_id: accountId,
        tag_id: null,
        amount_cents: item.amount_cents,
        type: item.type,
        description: item.description,
        occurred_at: item.occurred_at,
      });
    }
  }
}
