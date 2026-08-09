/**
 * backupService.ts
 *
 * Exporta e restaura os dados locais. É a única saída de dados do app: como o
 * Bearing é local-first (ADR-0001), sem isto perder o aparelho significa perder
 * o histórico inteiro, sem recuperação possível.
 *
 * O arquivo sai pelo share sheet do sistema — o app não envia nada para lugar
 * nenhum por conta própria; quem escolhe o destino (Drive, e-mail, outro
 * aparelho) é o usuário, num gesto explícito. Ver ADR-0010.
 *
 * Os módulos nativos são carregados de forma protegida pelo mesmo motivo de
 * app/transactions/import.tsx: um development build anterior a esta feature não
 * os contém, e uma dependência ausente não deve derrubar a rota inteira.
 *
 * Relacionado: src/services/backupFormat.ts, src/db/queries/backup.ts
 */
import {
  BackupError,
  backupFileName,
  buildBackupFile,
  parseBackupFile,
  toTransactionsCsv,
  type CsvTransactionRow,
} from './backupFormat';
import { dumpAllTables, getSchemaVersion, replaceAllTables } from '../db/queries/backup';
import { listTags } from '../db/queries/tags';
import type { Transaction } from '../types';

let ExpoFileSystem: typeof import('expo-file-system') | null = null;
let Sharing: typeof import('expo-sharing') | null = null;
let DocumentPicker: typeof import('expo-document-picker') | null = null;
try {
  ExpoFileSystem = require('expo-file-system');
  Sharing = require('expo-sharing');
  DocumentPicker = require('expo-document-picker');
} catch {
  // `backupAvailable` fica false e a tela orienta a reconstruir o app.
}

/**
 * Se os módulos nativos de arquivo/compartilhamento estão presentes.
 *
 * A tela usa isto para explicar que é preciso reconstruir o development build,
 * em vez de mostrar um botão que falharia ao ser tocado.
 */
export const backupAvailable = Boolean(ExpoFileSystem && Sharing && DocumentPicker);

/** Erro lançado quando os módulos nativos não estão no build instalado. */
function requireNativeModules(): void {
  if (!backupAvailable) {
    throw new BackupError(
      'Este app de desenvolvimento é anterior à feature de backup. Rode `npx expo run:android` para reconstruí-lo.'
    );
  }
}

/**
 * Escreve um arquivo no diretório de cache e abre o share sheet.
 *
 * Fica no cache, e não no diretório de documentos, porque o arquivo é
 * descartável depois de compartilhado — quem guarda a cópia é o destino
 * escolhido pelo usuário.
 *
 * @param fileName - Nome do arquivo com extensão.
 * @param contents - Conteúdo textual.
 * @param mimeType - Tipo MIME informado ao share sheet.
 */
async function writeAndShare(fileName: string, contents: string, mimeType: string): Promise<void> {
  const file = new ExpoFileSystem!.File(ExpoFileSystem!.Paths.cache, fileName);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(contents);

  if (!(await Sharing!.isAvailableAsync())) {
    throw new BackupError('Compartilhamento não está disponível neste aparelho.');
  }
  await Sharing!.shareAsync(file.uri, { mimeType, UTI: 'public.json' });
}

/**
 * Exporta todos os dados num arquivo JSON e abre o share sheet.
 *
 * @returns Nome do arquivo gerado, para a tela confirmar o que foi exportado.
 * @throws {BackupError} Se os módulos nativos faltarem ou o compartilhamento
 *   não estiver disponível.
 *
 * @example
 * const nome = await exportBackup(); // "bearing-backup-2026-08-09.json"
 */
export async function exportBackup(): Promise<string> {
  requireNativeModules();
  const [schemaVersion, tables] = await Promise.all([getSchemaVersion(), dumpAllTables()]);
  const exportedAt = Math.floor(Date.now() / 1000);
  const backup = buildBackupFile(schemaVersion, tables, exportedAt);
  const fileName = backupFileName(exportedAt, 'json');
  await writeAndShare(fileName, JSON.stringify(backup), 'application/json');
  return fileName;
}

/**
 * Exporta as transações em CSV e abre o share sheet.
 *
 * Caminho separado do backup porque serve a outro propósito: CSV é para o
 * usuário abrir numa planilha, não para restaurar no app (não leva metas,
 * parcelas nem orçamento).
 *
 * @returns Nome do arquivo gerado.
 * @throws {BackupError} Nas mesmas condições de `exportBackup`.
 */
export async function exportTransactionsCsv(): Promise<string> {
  requireNativeModules();
  const [tables, tags] = await Promise.all([dumpAllTables(), listTags()]);
  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]));
  const rows: CsvTransactionRow[] = (tables.transactions as unknown as Transaction[])
    .slice()
    .sort((a, b) => a.occurred_at - b.occurred_at)
    .map((transaction) => ({
      occurred_at: transaction.occurred_at,
      description: transaction.description,
      tag: transaction.tag_id ? (tagNameById.get(transaction.tag_id) ?? null) : null,
      type: transaction.type,
      amount_cents: transaction.amount_cents,
    }));

  const exportedAt = Math.floor(Date.now() / 1000);
  const fileName = backupFileName(exportedAt, 'csv');
  await writeAndShare(fileName, toTransactionsCsv(rows), 'text/csv');
  return fileName;
}

/** O que a restauração encontrou, para a tela confirmar antes de aplicar. */
export interface RestorePreview {
  fileName: string;
  exportedAt: number;
  transactionCount: number;
  apply: () => Promise<void>;
}

/**
 * Abre o seletor de arquivos, valida o backup e devolve um resumo do conteúdo
 * junto da ação que aplica a restauração.
 *
 * A validação acontece **antes** de qualquer escrita, e a aplicação fica numa
 * função separada de propósito: substituir os dados é destrutivo e irreversível,
 * então a confirmação do usuário tem que acontecer entre uma coisa e outra.
 *
 * @returns Resumo do backup escolhido, ou null se o usuário cancelou.
 * @throws {BackupError} Se o arquivo não for um backup válido ou vier de uma
 *   versão mais nova do app.
 */
export async function pickBackupToRestore(): Promise<RestorePreview | null> {
  requireNativeModules();
  const result = await DocumentPicker!.getDocumentAsync({
    type: ['application/json'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const asset = result.assets[0];
  const file = new ExpoFileSystem!.File(asset.uri);
  const backup = parseBackupFile(file.textSync(), await getSchemaVersion());

  return {
    fileName: asset.name,
    exportedAt: backup.exported_at,
    transactionCount: backup.tables.transactions.length,
    apply: () => replaceAllTables(backup.tables),
  };
}

export { BackupError } from './backupFormat';
