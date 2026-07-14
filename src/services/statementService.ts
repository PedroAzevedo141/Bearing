/**
 * src/services/statementService.ts
 *
 * Lida com o processamento do texto de OCR, chamando a IA para parsear
 * os itens e realizando o matching de parcelas existentes.
 */
import Constants from 'expo-constants';
import { ParsedStatementItem, InstallmentPurchase } from '../types';
import { listInstallmentPurchases } from '../db/queries/installments';
import { getDb } from '../db';
import * as Crypto from 'expo-crypto';

const AI_WORKER_URL = Constants.expoConfig?.extra?.aiWorkerUrl ?? '';
const AI_APP_SECRET = Constants.expoConfig?.extra?.aiAppSecret ?? '';

export async function parseStatementText(ocrText: string): Promise<ParsedStatementItem[]> {
  const res = await fetch(`${AI_WORKER_URL}/ai/parse-statement`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Secret': AI_APP_SECRET,
    },
    body: JSON.stringify({ ocr_text: ocrText }),
  });

  if (!res.ok) {
    throw new Error('Falha ao processar extrato');
  }

  const json = await res.json();
  return json.items as ParsedStatementItem[];
}

/**
 * Compara se duas strings são parecidas (compartilham palavras significativas).
 */
export function isNameSimilar(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).filter(w => w.length > 2);
  const wordsA = normalize(a);
  const wordsB = normalize(b);
  if (wordsA.length === 0 || wordsB.length === 0) return a.toLowerCase().trim() === b.toLowerCase().trim();
  
  // Conta quantas palavras de A estão em B
  let matches = 0;
  for (const wA of wordsA) {
    if (wordsB.includes(wA)) matches++;
  }
  // Se pelo menos uma palavra bater e elas tiverem tamanhos similares, ou uma for substring da outra
  return matches >= 1 || a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());
}

/**
 * Encontra a parcela correspondente para um item extraído.
 */
export function findMatchingInstallment(
  item: ParsedStatementItem,
  activeInstallments: InstallmentPurchase[]
): InstallmentPurchase | undefined {
  if (!item.is_installment || !item.installment_total) return undefined;

  const expectedTotal = item.amount_cents * item.installment_total;

  return activeInstallments.find((i) => {
    // Mesma quantidade de parcelas, total igual (ou muito próximo, caso de arredondamento)
    const isAmountMatch = Math.abs(i.total_amount_cents - expectedTotal) < 100; // tolerância de R$1 
    const isCountMatch = i.installment_count === item.installment_total;
    const isNameMatch = isNameSimilar(i.name, item.description);

    return isAmountMatch && isCountMatch && isNameMatch;
  });
}

/**
 * Grava os itens importados após confirmação do usuário.
 * Faz o matching de parcelas para evitar duplicação ou cria novas.
 * Transações normais vão para `transactions`.
 */
export async function saveParsedItems(items: ParsedStatementItem[], accountId: string) {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  
  // Buscar parcelas ativas para matching
  const activeInstallments = await listInstallmentPurchases();

  await db.withTransactionAsync(async () => {
    for (const item of items) {
      if (item.is_installment && item.installment_current && item.installment_total) {
        const match = findMatchingInstallment(item, activeInstallments);

        if (match) {
          // UPDATE na existente
          // Atualiza o current_installment se for maior
          if (item.installment_current > match.current_installment) {
            await db.runAsync(
              'UPDATE installment_purchases SET current_installment = ? WHERE id = ?',
              item.installment_current, match.id
            );
          }
        } else {
          // INSERT nova
          const id = Crypto.randomUUID();
          await db.runAsync(
            'INSERT INTO installment_purchases (id, name, total_amount_cents, installment_count, current_installment, first_due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            id, item.description, item.amount_cents * item.installment_total, item.installment_total, item.installment_current, item.occurred_at, now
          );
        }
      } else {
        // Transação avulsa
        const id = Crypto.randomUUID();
        await db.runAsync(
          'INSERT INTO transactions (id, account_id, amount_cents, type, description, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          id, accountId, item.amount_cents, item.type, item.description, item.occurred_at, now
        );
      }
    }
  });
}
