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
import { findMatchingInstallment, isNameSimilar } from './statementMatching';
import {
  createInstallmentPurchase,
  listInstallmentPurchases,
  updateInstallmentPurchase,
} from '../db/queries/installments';
import { createRecurring, listRecurring } from '../db/queries/recurring';
import { createTransaction } from '../db/queries/transactions';
import type { ParsedStatementItem } from '../types';
import { firstDueDateFor } from '../utils/money';

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
    is_subscription: false,
  }));
}

/**
 * Grava os itens importados **após a confirmação do usuário** (Confirmação 2).
 *
 * - Itens avulsos → `transactions`.
 * - Parcelas → casa com uma compra existente (`updateInstallmentPurchase`,
 *   reancorando `first_due_date`) ou cria uma nova (`createInstallmentPurchase`),
 *   evitando duplicar a mesma compra a cada extrato mensal.
 * - Assinaturas → grava a transação **deste mês** (a cobrança aconteceu) E
 *   cadastra a recorrência para lembretes futuros, deduplicando por nome pra
 *   não criar uma assinatura repetida a cada extrato.
 *
 * @param items - Itens já revisados pelo usuário.
 */
export async function saveParsedItems(items: ParsedStatementItem[]): Promise<void> {
  const activeInstallments = await listInstallmentPurchases();
  const existingRecurring = await listRecurring();

  for (const item of items) {
    if (item.is_subscription) {
      // A recorrência vem primeiro para a cobrança já nascer vinculada a ela —
      // sem o vínculo, a Rotação continuaria cobrando esta assinatura como
      // pendente do mês mesmo tendo acabado de importá-la.
      const tracked = existingRecurring.find((r) => isNameSimilar(r.name, item.description));
      let recurringId = tracked?.id ?? null;
      if (!tracked) {
        const dayOfMonth = new Date(item.occurred_at * 1000).getDate();
        const created = await createRecurring(item.description, item.amount_cents, dayOfMonth, null);
        recurringId = created.id;
        // Evita duplicar entre itens do mesmo extrato (dois lançamentos iguais).
        existingRecurring.push({ ...created, tagName: null });
      }
      // A cobrança do mês entra como transação normal (conta no saldo).
      await createTransaction({
        tag_id: null,
        amount_cents: item.amount_cents,
        type: item.type,
        description: item.description,
        occurred_at: item.occurred_at,
        recurring_id: recurringId,
      });
    } else if (item.is_installment && item.installment_current && item.installment_total) {
      // O extrato é a fonte de verdade sobre em que parcela a compra está
      // ("parcela 3/10 em 05/03"). Como a posição é derivada da data da 1ª
      // parcela, corrigir o registro significa reancorar o cronograma — não
      // mexer num contador.
      const anchoredFirstDue = firstDueDateFor(item.occurred_at, item.installment_current);
      const match = findMatchingInstallment(item, activeInstallments);
      if (match) {
        // Só reancora se o extrato apontar um começo anterior ao registrado:
        // uma cobrança atrasada não deve empurrar a compra para o futuro.
        if (anchoredFirstDue < match.first_due_date) {
          await updateInstallmentPurchase(match.id, {
            name: match.name,
            tag_id: match.tag_id,
            total_amount_cents: match.total_amount_cents,
            installment_count: match.installment_count,
            first_due_date: anchoredFirstDue,
          });
        }
      } else {
        await createInstallmentPurchase({
          name: item.description,
          tag_id: null,
          total_amount_cents: item.amount_cents * item.installment_total,
          installment_count: item.installment_total,
          first_due_date: anchoredFirstDue,
        });
      }
    } else {
      await createTransaction({
        tag_id: null,
        amount_cents: item.amount_cents,
        type: item.type,
        description: item.description,
        occurred_at: item.occurred_at,
      });
    }
  }
}
