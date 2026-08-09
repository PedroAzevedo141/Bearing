/**
 * theme/themePreference.ts
 *
 * Escolha de tema do usuário: claro, escuro ou seguir o sistema.
 *
 * O NativeWind guarda o esquema em vigor apenas em memória, então a
 * preferência é persistida em `settings` (SQLite) e reaplicada na abertura —
 * sem isso o app voltaria ao tema do sistema a cada início, ignorando a
 * escolha feita.
 *
 * `'system'` é o padrão e não é a mesma coisa que gravar o tema atual: quem
 * escolhe "automático" quer acompanhar o aparelho para sempre, inclusive
 * quando ele mudar sozinho ao anoitecer.
 *
 * Relacionado: src/db/queries/settings.ts, docs/adr/0005-design-system-nativewind-paper.md
 */
import { useColorScheme } from 'nativewind';
import { useCallback, useEffect, useState } from 'react';

import { getSetting, setSetting } from '../db/queries/settings';

/** Opções de tema oferecidas ao usuário. */
export type ThemePreference = 'light' | 'dark' | 'system';

const VALID: ThemePreference[] = ['light', 'dark', 'system'];

/** Converte o valor cru do banco numa preferência válida. */
function parsePreference(value: string | null): ThemePreference {
  return VALID.includes(value as ThemePreference) ? (value as ThemePreference) : 'system';
}

/** Estado e ação do seletor de tema. */
export interface UseThemePreferenceResult {
  /** Preferência gravada. `'system'` enquanto a leitura não terminou. */
  preference: ThemePreference;
  /** true até a preferência ser lida do banco. */
  loading: boolean;
  /** Grava a escolha e aplica na hora. */
  setPreference: (preference: ThemePreference) => Promise<void>;
}

/**
 * Lê, aplica e grava a preferência de tema.
 *
 * Aplicar é responsabilidade de quem monta a árvore (o layout raiz chama este
 * hook uma vez); a tela de ajustes usa o mesmo hook para exibir e trocar.
 *
 * @returns Preferência atual + ação de troca.
 */
export function useThemePreference(): UseThemePreferenceResult {
  const { setColorScheme } = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSetting('theme_preference')
      .then((value) => {
        if (!active) {
          return;
        }
        const stored = parsePreference(value);
        setPreferenceState(stored);
        setColorScheme(stored);
      })
      // Falha de leitura não deve travar a abertura do app: sem preferência
      // gravada, seguir o sistema é o comportamento certo.
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [setColorScheme]);

  const setPreference = useCallback(
    async (next: ThemePreference) => {
      // Aplica antes de gravar: a troca precisa ser instantânea na tela, e a
      // escrita no banco não deve estar no caminho do feedback visual.
      setPreferenceState(next);
      setColorScheme(next);
      await setSetting('theme_preference', next);
    },
    [setColorScheme]
  );

  return { preference, loading, setPreference };
}
