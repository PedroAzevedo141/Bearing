/**
 * applyMigrations.test.ts
 *
 * Testa `applyMigrations` contra um fake em memória de `MigratableDb` — o
 * `expo-sqlite` real é módulo nativo e não roda em vitest puro, então o
 * fake exercita exatamente a lógica que o app depende (aplica pendentes em
 * ordem, não reaplica migration já rodada, rollback se uma falhar no meio).
 */
import { describe, expect, it } from 'vitest';

import { applyMigrations, type MigratableDb } from './applyMigrations';
import type { Migration } from './migrations';

/**
 * Fake em memória de `MigratableDb`. `execAsync` lança se o SQL for
 * literalmente `'FAIL'` — usado pra simular uma migration que quebra no
 * meio. `withTransactionAsync` tira um snapshot antes de rodar `fn` e
 * restaura esse snapshot se `fn` lançar, simulando o rollback real do
 * SQLite dentro de uma transação.
 */
function createFakeDb(initialVersion = 0) {
  let userVersion = initialVersion;
  const executed: string[] = [];

  const db: MigratableDb = {
    async getFirstAsync<T>(sql: string): Promise<T | null> {
      if (sql.includes('user_version')) {
        return { user_version: userVersion } as T;
      }
      return null;
    },
    async execAsync(sql: string): Promise<void> {
      const versionMatch = sql.match(/PRAGMA user_version = (\d+)/);
      if (versionMatch) {
        userVersion = Number(versionMatch[1]);
        return;
      }
      if (sql === 'FAIL') {
        throw new Error('simulated migration failure');
      }
      executed.push(sql);
    },
    async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
      const versionSnapshot = userVersion;
      const executedSnapshot = executed.length;
      try {
        await fn();
      } catch (err) {
        userVersion = versionSnapshot;
        executed.length = executedSnapshot;
        throw err;
      }
    },
  };

  return { db, executed, getVersion: () => userVersion };
}

describe('applyMigrations', () => {
  it('aplica as migrations pendentes em ordem', async () => {
    const { db, executed, getVersion } = createFakeDb(0);
    const migrations: Migration[] = [
      { version: 1, name: 'a', statements: 'STMT_A' },
      { version: 2, name: 'b', statements: 'STMT_B' },
    ];

    await applyMigrations(db, migrations);

    expect(executed).toEqual(['STMT_A', 'STMT_B']);
    expect(getVersion()).toBe(2);
  });

  it('não reaplica uma migration já rodada', async () => {
    const { db, executed, getVersion } = createFakeDb(1);
    const migrations: Migration[] = [
      { version: 1, name: 'a', statements: 'STMT_A' },
      { version: 2, name: 'b', statements: 'STMT_B' },
    ];

    await applyMigrations(db, migrations);

    expect(executed).toEqual(['STMT_B']);
    expect(getVersion()).toBe(2);
  });

  it('faz rollback se uma migration falhar no meio, sem tentar as seguintes', async () => {
    const { db, executed, getVersion } = createFakeDb(0);
    const migrations: Migration[] = [
      { version: 1, name: 'a', statements: 'STMT_A' },
      { version: 2, name: 'b-falha', statements: 'FAIL' },
      { version: 3, name: 'c', statements: 'STMT_C' },
    ];

    await expect(applyMigrations(db, migrations)).rejects.toThrow('simulated migration failure');

    // Migration 1 aplicou inteira; a 2 não deixou rastro (rollback); a 3
    // nunca foi tentada — o banco fica na última versão consistente.
    expect(executed).toEqual(['STMT_A']);
    expect(getVersion()).toBe(1);
  });
});
