/**
 * queries/settings.ts
 *
 * Preferências de interface, guardadas como chave/valor no próprio SQLite
 * (migration v10). Não guarda nada financeiro nem sensível.
 *
 * Relacionado: docs/DATA_MODEL.md, src/theme/themePreference.ts
 */
import { getDb } from '../index';

/** Chaves de preferência reconhecidas pelo app. */
export type SettingKey = 'theme_preference';

/**
 * Lê uma preferência.
 *
 * @param key - Chave da preferência.
 * @returns O valor gravado, ou null se nunca foi definido.
 */
export async function getSetting(key: SettingKey): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

/**
 * Grava uma preferência, sobrescrevendo a anterior.
 *
 * @param key - Chave da preferência.
 * @param value - Valor a gravar.
 */
export async function setSetting(key: SettingKey, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}
