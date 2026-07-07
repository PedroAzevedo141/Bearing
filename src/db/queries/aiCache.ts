/**
 * queries/aiCache.ts
 *
 * Operações sobre a tabela `ai_insights_cache`. O cache existe para que o
 * app não rechame o Worker (e a API da Anthropic, que custa dinheiro) a cada
 * abertura — uma resposta vale por `CACHE_TTL_SECONDS`.
 *
 * Relacionado: docs/DATA_MODEL.md, src/services/aiService.ts
 */
import * as Crypto from 'expo-crypto';

import { getDb } from '../index';
import type { AiInsightCache, AiInsightKind } from '../../types';

/** Validade de uma resposta de IA: 24h. Depois disso o app rebusca. */
export const CACHE_TTL_SECONDS = 24 * 60 * 60;

/**
 * Busca a resposta de IA mais recente e ainda válida para um tipo/entidade.
 *
 * @param kind - Tipo de insight ('general_tip' ou 'goal_plan').
 * @param relatedId - ID da meta quando kind = 'goal_plan'; null para dica geral.
 * @returns A entrada de cache válida, ou null se ausente/expirada.
 */
export async function getFreshInsight(
  kind: AiInsightKind,
  relatedId: string | null
): Promise<AiInsightCache | null> {
  const db = await getDb();
  const minGeneratedAt = Math.floor(Date.now() / 1000) - CACHE_TTL_SECONDS;
  return db.getFirstAsync<AiInsightCache>(
    `SELECT * FROM ai_insights_cache
     WHERE kind = ? AND (related_id IS ? OR related_id = ?) AND generated_at >= ?
     ORDER BY generated_at DESC
     LIMIT 1`,
    kind,
    relatedId,
    relatedId,
    minGeneratedAt
  );
}

/**
 * Grava uma resposta de IA no cache, substituindo entradas anteriores do
 * mesmo tipo/entidade (o cache guarda só a mais recente).
 *
 * @param kind - Tipo de insight.
 * @param relatedId - ID da meta quando kind = 'goal_plan'; null caso contrário.
 * @param payload - Objeto de resposta da IA; será serializado em JSON.
 * @returns A entrada de cache persistida.
 */
export async function saveInsight(
  kind: AiInsightKind,
  relatedId: string | null,
  payload: unknown
): Promise<AiInsightCache> {
  const db = await getDb();
  const entry: AiInsightCache = {
    id: Crypto.randomUUID(),
    kind,
    related_id: relatedId,
    payload_json: JSON.stringify(payload),
    generated_at: Math.floor(Date.now() / 1000),
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM ai_insights_cache WHERE kind = ? AND (related_id IS ? OR related_id = ?)',
      kind,
      relatedId,
      relatedId
    );
    await db.runAsync(
      `INSERT INTO ai_insights_cache (id, kind, related_id, payload_json, generated_at)
       VALUES (?, ?, ?, ?, ?)`,
      entry.id,
      entry.kind,
      entry.related_id,
      entry.payload_json,
      entry.generated_at
    );
  });
  return entry;
}
