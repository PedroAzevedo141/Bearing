/**
 * backupFormat.ts
 *
 * Serialização, validação e conversão para CSV do arquivo de backup. Módulo
 * deliberadamente **puro**: não importa `expo-sqlite`, `expo-file-system` nem
 * nada nativo, para poder ser testado no vitest (ver CONTRIBUTING.md — mockar
 * módulo nativo não vale).
 *
 * O I/O fica em src/services/backupService.ts e o acesso ao banco em
 * src/db/queries/backup.ts.
 *
 * Relacionado: docs/adr/0010-backup-local.md, docs/DATA_MODEL.md
 */

/**
 * Versão do formato do arquivo, independente da versão do schema do banco.
 *
 * Sobe quando a *estrutura do envelope* muda (novos campos de metadados, outra
 * forma de agrupar tabelas). Mudança de schema do banco não mexe aqui — quem
 * cuida disso é `schema_version`.
 */
export const BACKUP_FORMAT_VERSION = 1;

/** Marcador que identifica o arquivo como backup do Bearing. */
export const BACKUP_FORMAT_TAG = 'bearing-backup';

/**
 * Tabelas incluídas no backup, em ordem de dependência (pais antes de filhos),
 * que é também a ordem segura de inserção na restauração.
 *
 * `ai_insights_cache` fica de fora de propósito: é cache derivado, regenerável
 * a qualquer momento, e só faria o arquivo crescer.
 */
export const BACKUP_TABLES = [
  'tags',
  // Antes de `transactions`: a v7 criou a FK transactions.recurring_id, e a
  // restauração roda com `PRAGMA foreign_keys = ON`.
  'recurring_transactions',
  'transactions',
  'installment_purchases',
  'goals',
  'budgets',
  'chat_conversations',
  'chat_messages',
] as const;

/** Nome de uma tabela incluída no backup. */
export type BackupTable = (typeof BACKUP_TABLES)[number];

/** Conteúdo de todas as tabelas exportadas, uma lista de linhas por tabela. */
export type BackupTables = Record<BackupTable, Record<string, unknown>[]>;

/** Envelope gravado no arquivo `.json` de backup. */
export interface BackupFile {
  format: typeof BACKUP_FORMAT_TAG;
  format_version: number;
  /** `PRAGMA user_version` do banco de origem. */
  schema_version: number;
  /** Unix timestamp (segundos) da exportação. */
  exported_at: number;
  tables: BackupTables;
}

/**
 * Erro de backup com mensagem já pronta para a UI.
 *
 * Existe para a tela distinguir "arquivo inválido" (que o usuário resolve
 * escolhendo outro arquivo) de uma falha inesperada.
 */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

/**
 * Monta o envelope de backup a partir do conteúdo das tabelas.
 *
 * @param schemaVersion - `PRAGMA user_version` do banco de origem.
 * @param tables - Linhas de cada tabela, como vieram do banco.
 * @param exportedAt - Unix timestamp (segundos); default é agora.
 * @returns Envelope pronto para virar JSON.
 */
export function buildBackupFile(
  schemaVersion: number,
  tables: BackupTables,
  exportedAt: number = Math.floor(Date.now() / 1000)
): BackupFile {
  return {
    format: BACKUP_FORMAT_TAG,
    format_version: BACKUP_FORMAT_VERSION,
    schema_version: schemaVersion,
    exported_at: exportedAt,
    tables,
  };
}

/**
 * Valida e desserializa o conteúdo de um arquivo de backup.
 *
 * Recusa arquivo gerado por uma versão futura do app (de formato ou de schema):
 * restaurar dados com colunas que este banco não conhece perderia informação em
 * silêncio, que é pior do que falhar na cara do usuário.
 *
 * @param text - Conteúdo bruto do arquivo.
 * @param currentSchemaVersion - `PRAGMA user_version` deste app.
 * @returns Envelope validado.
 * @throws {BackupError} Se o texto não for JSON, não for um backup do Bearing,
 *   vier de uma versão futura, ou tiver alguma tabela em formato inesperado.
 *
 * @example
 * const backup = parseBackupFile(await file.text(), 6);
 */
export function parseBackupFile(text: string, currentSchemaVersion: number): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError('Esse arquivo não é um backup do Bearing — não consegui ler o conteúdo.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new BackupError('Esse arquivo não é um backup do Bearing.');
  }
  const candidate = parsed as Partial<BackupFile>;

  if (candidate.format !== BACKUP_FORMAT_TAG) {
    throw new BackupError('Esse arquivo não é um backup do Bearing.');
  }
  if (typeof candidate.format_version !== 'number' || candidate.format_version > BACKUP_FORMAT_VERSION) {
    throw new BackupError(
      'Backup criado por uma versão mais nova do Bearing. Atualize o app antes de restaurar.'
    );
  }
  if (typeof candidate.schema_version !== 'number' || candidate.schema_version > currentSchemaVersion) {
    throw new BackupError(
      'Backup criado por uma versão mais nova do Bearing. Atualize o app antes de restaurar.'
    );
  }
  if (typeof candidate.tables !== 'object' || candidate.tables === null) {
    throw new BackupError('Backup incompleto: não encontrei os dados das tabelas.');
  }

  const tables = candidate.tables as Record<string, unknown>;
  for (const table of BACKUP_TABLES) {
    const rows = tables[table];
    // Tabela ausente é aceita como vazia: um backup de versão anterior não
    // conhecia tabelas criadas depois, e recusá-lo por isso seria hostil.
    if (rows === undefined) {
      continue;
    }
    if (!Array.isArray(rows)) {
      throw new BackupError(`Backup corrompido: a tabela "${table}" está em formato inesperado.`);
    }
    if (rows.some((row) => typeof row !== 'object' || row === null || Array.isArray(row))) {
      throw new BackupError(`Backup corrompido: a tabela "${table}" tem linhas inválidas.`);
    }
  }

  const normalized = Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, (tables[table] as Record<string, unknown>[]) ?? []])
  ) as BackupTables;

  return {
    format: BACKUP_FORMAT_TAG,
    format_version: candidate.format_version,
    schema_version: candidate.schema_version,
    exported_at: typeof candidate.exported_at === 'number' ? candidate.exported_at : 0,
    tables: normalized,
  };
}

/** Uma transação achatada para exportação em CSV. */
export interface CsvTransactionRow {
  occurred_at: number;
  description: string | null;
  tag: string | null;
  type: 'income' | 'expense';
  amount_cents: number;
}

/**
 * Escapa um campo para CSV segundo a RFC 4180.
 *
 * Sem isso, uma descrição com vírgula ("mercado, feira") quebraria as colunas
 * do arquivo inteiro.
 */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Converte transações em CSV para abrir em planilha.
 *
 * O valor sai em reais com ponto decimal (`1234.56`), não em centavos: o
 * destino é uma planilha, onde centavos como inteiro confundiriam mais do que
 * ajudariam. É a única exceção à regra "sempre centavos", e ela vale porque o
 * arquivo é de saída — nada é lido de volta a partir dele.
 *
 * @param rows - Transações já resolvidas (tag como nome, não id).
 * @returns Conteúdo do CSV, com cabeçalho e quebras de linha `\r\n`.
 *
 * @example
 * toTransactionsCsv([{ occurred_at: 0, description: 'Café', tag: 'lazer', type: 'expense', amount_cents: 550 }]);
 * // "data,descricao,tag,tipo,valor\r\n1970-01-01,Café,lazer,saida,5.50"
 */
export function toTransactionsCsv(rows: CsvTransactionRow[]): string {
  const header = ['data', 'descricao', 'tag', 'tipo', 'valor'].join(',');
  const lines = rows.map((row) => {
    const date = new Date(row.occurred_at * 1000).toISOString().slice(0, 10);
    return [
      date,
      csvField(row.description ?? ''),
      csvField(row.tag ?? ''),
      row.type === 'income' ? 'entrada' : 'saida',
      (row.amount_cents / 100).toFixed(2),
    ].join(',');
  });
  return [header, ...lines].join('\r\n');
}

/**
 * Nome de arquivo do backup, com a data para o usuário se achar entre vários.
 *
 * @param exportedAt - Unix timestamp (segundos) da exportação.
 * @param extension - Extensão sem ponto (`json` ou `csv`).
 * @returns Ex: `bearing-backup-2026-08-09.json`.
 */
export function backupFileName(exportedAt: number, extension: 'json' | 'csv'): string {
  const date = new Date(exportedAt * 1000).toISOString().slice(0, 10);
  return `bearing-${extension === 'csv' ? 'transacoes' : 'backup'}-${date}.${extension}`;
}
