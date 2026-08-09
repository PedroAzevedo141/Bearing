/**
 * queries/backup.ts
 *
 * Leitura e escrita em massa das tabelas do usuário, para exportar e restaurar
 * backup. É o único lugar do app que trata tabelas genericamente — o resto da
 * camada de dados é tipado por entidade.
 *
 * Restrição importante: a restauração **substitui** todo o conteúdo, dentro de
 * uma transação. Ou o banco fica inteiro com o backup, ou permanece como
 * estava; um estado meio-restaurado seria pior que os dois.
 *
 * Relacionado: src/services/backupFormat.ts, docs/adr/0010-backup-local.md
 */
import { getDb } from '../index';
import { BACKUP_TABLES, type BackupTable, type BackupTables } from '../../services/backupFormat';

/**
 * Versão de schema do banco local (`PRAGMA user_version`).
 *
 * O backup grava isso para que a restauração possa recusar um arquivo vindo de
 * uma versão mais nova do app.
 *
 * @returns Número da última migration aplicada.
 */
export async function getSchemaVersion(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Lê todas as tabelas incluídas no backup.
 *
 * @returns Um array de linhas por tabela, com as colunas como estão no banco.
 */
export async function dumpAllTables(): Promise<BackupTables> {
  const db = await getDb();
  const entries = await Promise.all(
    BACKUP_TABLES.map(async (table) => {
      const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
      return [table, rows] as const;
    })
  );
  return Object.fromEntries(entries) as BackupTables;
}

/**
 * Substitui todo o conteúdo do usuário pelo de um backup.
 *
 * Apaga na ordem inversa das dependências e insere na ordem direta, para não
 * esbarrar nas chaves estrangeiras. `ai_insights_cache` é limpo junto: o cache
 * de IA descreve dados que acabaram de ser trocados, então manter as dicas
 * antigas seria mostrar conclusões sobre um estado que não existe mais.
 *
 * @param tables - Conteúdo validado por `parseBackupFile`.
 * @throws Se qualquer inserção falhar — a transação inteira é revertida e o
 *   banco permanece no estado anterior.
 */
export async function replaceAllTables(tables: BackupTables): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const table of [...BACKUP_TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
    await db.runAsync('DELETE FROM ai_insights_cache');

    for (const table of BACKUP_TABLES) {
      for (const row of tables[table]) {
        await insertRow(db, table, row);
      }
    }
  });
}

/**
 * Insere uma linha montando o SQL a partir das chaves presentes.
 *
 * As colunas vêm do próprio arquivo, e não de uma lista fixa, para que um
 * backup de schema anterior (com menos colunas) ainda entre: as colunas que
 * faltam assumem o default do banco.
 */
async function insertRow(
  db: Awaited<ReturnType<typeof getDb>>,
  table: BackupTable,
  row: Record<string, unknown>
): Promise<void> {
  const columns = Object.keys(row);
  if (columns.length === 0) {
    return;
  }
  const placeholders = columns.map(() => '?').join(', ');
  await db.runAsync(
    `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    ...(columns.map((column) => row[column]) as (string | number | null)[])
  );
}
