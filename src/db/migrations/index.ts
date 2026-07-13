/**
 * migrations/index.ts
 *
 * Registro ordenado de migrations do banco local. O runner em src/db/index.ts
 * usa `PRAGMA user_version` para saber quais já foram aplicadas.
 *
 * Regras:
 * - Uma migration por mudança de schema, sempre com `version` sequencial.
 * - Nunca editar uma migration já publicada — criar uma nova.
 * - Toda migration nova ganha entrada no CHANGELOG.md e, se mudar o modelo,
 *   atualização em docs/DATA_MODEL.md.
 */
import { SCHEMA_V1, SCHEMA_V2_CONSTRAINTS } from '../schema';

/** Uma mudança de schema aplicável de forma idempotente e ordenada. */
export interface Migration {
  /** Versão sequencial (1, 2, 3...). Gravada em PRAGMA user_version. */
  version: number;
  /** Nome curto para logs e debugging. */
  name: string;
  /** SQL a executar. Pode conter múltiplos statements. */
  statements: string;
}

/** Todas as migrations, em ordem de aplicação. */
export const MIGRATIONS: Migration[] = [
  { version: 1, name: 'initial-schema', statements: SCHEMA_V1 },
  { version: 2, name: 'add-business-constraints', statements: SCHEMA_V2_CONSTRAINTS },
];
