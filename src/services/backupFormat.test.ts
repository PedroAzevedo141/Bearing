/**
 * backupFormat.test.ts
 *
 * O backup é a última linha de defesa contra perda de dados num app
 * local-first, então as garantias que importam aqui são: um arquivo válido
 * sobrevive à ida e volta sem perder nada, e um arquivo suspeito é recusado
 * **antes** de tocar no banco.
 */
import { describe, expect, it } from 'vitest';

import {
  BACKUP_FORMAT_VERSION,
  BACKUP_TABLES,
  BackupError,
  backupFileName,
  buildBackupFile,
  parseBackupFile,
  toTransactionsCsv,
  type BackupTables,
} from './backupFormat';

/** Tabelas vazias, para montar cenários sem repetir as nove chaves. */
function emptyTables(overrides: Partial<BackupTables> = {}): BackupTables {
  const base = Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, []])
  ) as unknown as BackupTables;
  return { ...base, ...overrides };
}

describe('buildBackupFile', () => {
  it('carimba formato, versões e data', () => {
    const backup = buildBackupFile(6, emptyTables(), 1_770_000_000);
    expect(backup.format).toBe('bearing-backup');
    expect(backup.format_version).toBe(BACKUP_FORMAT_VERSION);
    expect(backup.schema_version).toBe(6);
    expect(backup.exported_at).toBe(1_770_000_000);
  });
});

describe('parseBackupFile', () => {
  it('faz ida e volta preservando as linhas', () => {
    const tables = emptyTables({
      transactions: [{ id: 't1', amount_cents: 1500, type: 'expense' }],
      tags: [{ id: 'g1', name: 'mercado', color: null }],
    });
    const json = JSON.stringify(buildBackupFile(6, tables, 1_770_000_000));

    const restored = parseBackupFile(json, 6);

    expect(restored.tables.transactions).toEqual([
      { id: 't1', amount_cents: 1500, type: 'expense' },
    ]);
    expect(restored.tables.tags).toEqual([{ id: 'g1', name: 'mercado', color: null }]);
  });

  it('aceita backup de schema anterior', () => {
    const json = JSON.stringify(buildBackupFile(4, emptyTables(), 0));
    expect(parseBackupFile(json, 6).schema_version).toBe(4);
  });

  it('trata tabela ausente como vazia', () => {
    // Um backup gerado antes de a tabela existir não deve ser recusado.
    const json = JSON.stringify({
      format: 'bearing-backup',
      format_version: 1,
      schema_version: 3,
      exported_at: 0,
      tables: { transactions: [{ id: 't1' }] },
    });

    const restored = parseBackupFile(json, 6);

    expect(restored.tables.transactions).toHaveLength(1);
    expect(restored.tables.budgets).toEqual([]);
  });

  it('recusa schema de versão futura', () => {
    const json = JSON.stringify(buildBackupFile(99, emptyTables(), 0));
    expect(() => parseBackupFile(json, 6)).toThrow(BackupError);
    expect(() => parseBackupFile(json, 6)).toThrow(/versão mais nova/);
  });

  it('recusa formato de versão futura', () => {
    const json = JSON.stringify({
      format: 'bearing-backup',
      format_version: BACKUP_FORMAT_VERSION + 1,
      schema_version: 6,
      exported_at: 0,
      tables: emptyTables(),
    });
    expect(() => parseBackupFile(json, 6)).toThrow(/versão mais nova/);
  });

  it('recusa arquivo que não é JSON', () => {
    expect(() => parseBackupFile('não sou json', 6)).toThrow(BackupError);
  });

  it('recusa JSON que não é backup do Bearing', () => {
    expect(() => parseBackupFile('{"foo":1}', 6)).toThrow(/não é um backup/);
  });

  it('recusa tabela que não é lista', () => {
    const json = JSON.stringify({
      format: 'bearing-backup',
      format_version: 1,
      schema_version: 6,
      exported_at: 0,
      tables: { ...emptyTables(), transactions: { id: 't1' } },
    });
    expect(() => parseBackupFile(json, 6)).toThrow(/formato inesperado/);
  });

  it('recusa linha que não é objeto', () => {
    const json = JSON.stringify({
      format: 'bearing-backup',
      format_version: 1,
      schema_version: 6,
      exported_at: 0,
      tables: { ...emptyTables(), transactions: ['isso não é uma linha'] },
    });
    expect(() => parseBackupFile(json, 6)).toThrow(/linhas inválidas/);
  });
});

describe('toTransactionsCsv', () => {
  it('escreve cabeçalho mesmo sem linhas', () => {
    expect(toTransactionsCsv([])).toBe('data,descricao,tag,tipo,valor');
  });

  it('converte centavos em reais com ponto decimal', () => {
    const csv = toTransactionsCsv([
      {
        occurred_at: 0,
        description: 'Café',
        tag: 'lazer',
        type: 'expense',
        amount_cents: 550,
      },
    ]);
    expect(csv.split('\r\n')[1]).toBe('1970-01-01,Café,lazer,saida,5.50');
  });

  it('traduz o tipo para português', () => {
    const csv = toTransactionsCsv([
      { occurred_at: 0, description: null, tag: null, type: 'income', amount_cents: 100 },
    ]);
    expect(csv).toContain(',entrada,');
  });

  it('escapa descrição com vírgula, aspas e quebra de linha', () => {
    const csv = toTransactionsCsv([
      {
        occurred_at: 0,
        description: 'mercado, feira e "outros"\nsegunda linha',
        tag: null,
        type: 'expense',
        amount_cents: 100,
      },
    ]);
    expect(csv).toContain('"mercado, feira e ""outros""\nsegunda linha"');
  });

  it('deixa tag e descrição vazias quando são nulas', () => {
    const csv = toTransactionsCsv([
      { occurred_at: 0, description: null, tag: null, type: 'expense', amount_cents: 100 },
    ]);
    expect(csv.split('\r\n')[1]).toBe('1970-01-01,,,saida,1.00');
  });
});

describe('backupFileName', () => {
  it('usa a data da exportação', () => {
    expect(backupFileName(1_770_000_000, 'json')).toMatch(/^bearing-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('distingue planilha de backup', () => {
    expect(backupFileName(1_770_000_000, 'csv')).toContain('transacoes');
  });
});
