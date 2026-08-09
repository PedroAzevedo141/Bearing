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
import {
  SCHEMA_V1,
  SCHEMA_V2_CONSTRAINTS,
  SCHEMA_V3_CHAT,
  SCHEMA_V4_BUDGETS,
  SCHEMA_V5_RECURRING,
  SCHEMA_V6_DERIVED_INSTALLMENT,
  SCHEMA_V7_RECURRING_LINK,
  SCHEMA_V8_BUDGET_HISTORY,
  SCHEMA_V9_DROP_ACCOUNTS,
  SCHEMA_V10_SETTINGS,
} from '../schema';

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
  { version: 3, name: 'add-chat', statements: SCHEMA_V3_CHAT },
  { version: 4, name: 'add-budgets', statements: SCHEMA_V4_BUDGETS },
  { version: 5, name: 'add-recurring', statements: SCHEMA_V5_RECURRING },
  { version: 6, name: 'derive-current-installment', statements: SCHEMA_V6_DERIVED_INSTALLMENT },
  { version: 7, name: 'link-transaction-to-recurring', statements: SCHEMA_V7_RECURRING_LINK },
  { version: 8, name: 'budget-effective-from', statements: SCHEMA_V8_BUDGET_HISTORY },
  { version: 9, name: 'drop-accounts', statements: SCHEMA_V9_DROP_ACCOUNTS },
  { version: 10, name: 'add-settings', statements: SCHEMA_V10_SETTINGS },
];
