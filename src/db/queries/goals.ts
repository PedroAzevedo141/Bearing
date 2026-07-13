/**
 * queries/goals.ts
 *
 * Operações sobre a tabela `goals` (metas financeiras). O progresso da meta
 * (`current_amount_cents`) é atualizado por aportes manuais do usuário —
 * o MVP não infere aportes a partir de transações.
 *
 * Relacionado: docs/DATA_MODEL.md, src/services/aiService.ts (goal plan)
 */
import * as Crypto from 'expo-crypto';

import { getDb } from '../index';
import type { Goal } from '../../types';

/** Dados necessários para criar uma meta. */
export interface NewGoal {
  name: string;
  target_amount_cents: number;
  /** Unix timestamp (segundos), opcional. */
  deadline: number | null;
}

/**
 * Lista todas as metas, mais recentes primeiro.
 *
 * @returns Todas as metas cadastradas.
 */
export async function listGoals(): Promise<Goal[]> {
  const db = await getDb();
  return db.getAllAsync<Goal>('SELECT * FROM goals ORDER BY created_at DESC');
}

/**
 * Busca uma meta pelo ID.
 *
 * @param id - ID da meta.
 * @returns A meta, ou null se não existir.
 */
export async function getGoal(id: string): Promise<Goal | null> {
  const db = await getDb();
  return db.getFirstAsync<Goal>('SELECT * FROM goals WHERE id = ?', id);
}

/**
 * Cria uma meta nova com progresso zerado.
 *
 * @param data - Nome, valor-alvo e prazo opcional.
 * @returns A meta persistida.
 */
export async function createGoal(data: NewGoal): Promise<Goal> {
  const db = await getDb();
  const goal: Goal = {
    id: Crypto.randomUUID(),
    name: data.name,
    target_amount_cents: data.target_amount_cents,
    current_amount_cents: 0,
    deadline: data.deadline,
    created_at: Math.floor(Date.now() / 1000),
  };
  await db.runAsync(
    `INSERT INTO goals (id, name, target_amount_cents, current_amount_cents, deadline, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    goal.id,
    goal.name,
    goal.target_amount_cents,
    goal.current_amount_cents,
    goal.deadline,
    goal.created_at
  );
  return goal;
}

/**
 * Atualiza nome e valor-alvo de uma meta existente.
 *
 * Não edita `deadline` — o formulário de criação também não coleta esse
 * campo hoje, então a edição mantém o mesmo escopo (não é regressão).
 *
 * @param id - ID da meta.
 * @param data - Novo nome e valor-alvo.
 */
export async function updateGoal(
  id: string,
  data: { name: string; target_amount_cents: number }
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE goals SET name = ?, target_amount_cents = ? WHERE id = ?',
    data.name,
    data.target_amount_cents,
    id
  );
}

/**
 * Registra um aporte (ou retirada, se negativo) no progresso da meta.
 * O progresso nunca fica abaixo de zero.
 *
 * @param id - ID da meta.
 * @param deltaCents - Valor em centavos a somar ao progresso atual.
 */
export async function addToGoal(id: string, deltaCents: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE goals SET current_amount_cents = MAX(current_amount_cents + ?, 0) WHERE id = ?',
    deltaCents,
    id
  );
}

/**
 * Remove uma meta.
 *
 * @param id - ID da meta.
 */
export async function deleteGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM goals WHERE id = ?', id);
}
