/**
 * testSupport.ts
 *
 * Banco SQLite **real**, em memória, para os testes da camada de queries.
 *
 * Por que isto existe: `CONTRIBUTING.md` proíbe mockar `expo-sqlite`, e com
 * razão — um fake do módulo nativo testaria o fake, não o SQL. A saída até aqui
 * era extrair lógica pura e deixar as queries sem cobertura, o que deixava
 * justamente a camada onde o dinheiro é calculado sem rede de proteção.
 *
 * A solução usa `node:sqlite` (embutido no Node 22.5+, sem dependência nova):
 * o SQL executado nos testes é o mesmo SQL do app, contra o mesmo motor, com as
 * migrations reais aplicadas. O que se substitui é apenas o **transporte** —
 * a API assíncrona do `expo-sqlite` mapeada sobre a API síncrona do Node.
 * Nenhum comportamento de banco é simulado. Ver ADR-0011.
 *
 * Relacionado: src/db/index.ts, docs/adr/0011-testes-de-query-com-node-sqlite.md
 */
import { DatabaseSync } from 'node:sqlite';

import { applyMigrations } from './applyMigrations';
import { MIGRATIONS } from './migrations';

/** Valores que o `expo-sqlite` aceita como parâmetro de bind. */
type BindValue = string | number | null;

/**
 * Subconjunto da API de `SQLiteDatabase` que a camada de queries usa.
 *
 * Só o que as queries realmente chamam: acrescentar métodos aqui sem que uma
 * query precise deles esconderia divergência entre o que se testa e o que roda.
 */
export interface TestDatabase {
  getAllAsync<T>(sql: string, ...params: BindValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: BindValue[]): Promise<T | null>;
  runAsync(sql: string, ...params: BindValue[]): Promise<void>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
  /** Fecha a conexão. Chamar no `afterEach` para não vazar bancos entre testes. */
  close(): void;
}

/**
 * Converte as linhas do `node:sqlite` (objetos com protótipo nulo) em objetos
 * comuns, para que `toEqual` e o spread funcionem como se espera nos testes.
 */
function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

/**
 * Abre um banco em memória com todas as migrations aplicadas.
 *
 * @returns Conexão pronta para uso, no mesmo formato assíncrono que as queries
 *   esperam de `getDb()`.
 *
 * @example
 * const db = await createTestDatabase();
 * // ... vi.mock('../index', () => ({ getDb: async () => db }))
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');

  const db: TestDatabase = {
    async getAllAsync<T>(sql: string, ...params: BindValue[]): Promise<T[]> {
      return sqlite
        .prepare(sql)
        .all(...params)
        .map((row) => plain<T>(row));
    },
    async getFirstAsync<T>(sql: string, ...params: BindValue[]): Promise<T | null> {
      const row = sqlite.prepare(sql).get(...params);
      return row === undefined ? null : plain<T>(row);
    },
    async runAsync(sql: string, ...params: BindValue[]): Promise<void> {
      sqlite.prepare(sql).run(...params);
    },
    async execAsync(sql: string): Promise<void> {
      sqlite.exec(sql);
    },
    async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
      sqlite.exec('BEGIN');
      try {
        await fn();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    close(): void {
      sqlite.close();
    },
  };

  await applyMigrations(db, MIGRATIONS);
  return db;
}

/** Converte uma data local em unix timestamp (segundos), como o banco guarda. */
export function ts(year: number, month: number, day: number): number {
  return Math.floor(new Date(year, month - 1, day).getTime() / 1000);
}
