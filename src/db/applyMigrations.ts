/**
 * applyMigrations.ts
 *
 * Lógica pura de aplicação de migrations, separada de src/db/index.ts de
 * propósito: este arquivo não importa `expo-sqlite` (nem nada que dependa
 * dele), então roda em vitest puro. `expo-sqlite` é módulo nativo — mesmo
 * um `import * as SQLite from 'expo-sqlite'` não usado em runtime já
 * arrasta a árvore de módulos do React Native (sintaxe Flow) pro bundler
 * de teste, que não sabe parsear isso. Testar essa lógica contra um fake em
 * memória de `MigratableDb` exige esse isolamento.
 *
 * Relacionado: src/db/index.ts, src/db/applyMigrations.test.ts
 */
import type { Migration } from './migrations';

/**
 * Subconjunto mínimo da API do `expo-sqlite` que o runner de migrations
 * usa. Um fake em memória que implementa essa interface basta pra testar
 * `applyMigrations` sem o módulo nativo.
 */
export interface MigratableDb {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}

/**
 * Aplica as migrations pendentes, em ordem, usando `PRAGMA user_version`
 * como marcador (0 = banco recém-criado). Cada migration roda dentro de
 * `withTransactionAsync`: ou aplica inteira, ou o banco fica na última
 * versão consistente.
 *
 * @param db - Conexão (real ou fake) que implementa `MigratableDb`.
 * @param migrations - Lista de migrations, em ordem de aplicação.
 * @throws Se alguma migration falhar — a versão não avança pra ela.
 */
export async function applyMigrations(db: MigratableDb, migrations: Migration[]): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.statements);
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
