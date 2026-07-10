/**
 * db/index.ts
 *
 * Ponto único de acesso ao SQLite local. Abre o banco uma vez por sessão e
 * aplica as migrations pendentes antes de liberar qualquer query.
 *
 * Componentes nunca importam este módulo diretamente — sempre via funções
 * de src/db/queries/ (regra do projeto: nada de SQL solto em componente).
 *
 * Relacionado: docs/DATA_MODEL.md, src/db/migrations/, src/db/applyMigrations.ts
 */
import * as SQLite from 'expo-sqlite';

import { applyMigrations } from './applyMigrations';
import { MIGRATIONS } from './migrations';

const DB_NAME = 'bearing.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Retorna a instância única do banco, já migrada.
 *
 * A primeira chamada abre o arquivo e roda as migrations pendentes;
 * chamadas seguintes reutilizam a mesma Promise (safe para chamadas
 * concorrentes de hooks diferentes).
 *
 * @returns Banco SQLite pronto para uso.
 * @throws Se alguma migration falhar — o erro aborta a transação inteira,
 *   deixando o banco na última versão consistente.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

/**
 * Abre o banco e aplica migrations pendentes.
 */
async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await applyMigrations(db, MIGRATIONS);
  return db;
}
