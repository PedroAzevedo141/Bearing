/**
 * theme/paperTheme.ts
 *
 * Temas do React Native Paper, derivados da mesma paleta do NativeWind
 * (src/theme/colors.ts) — Paper não é NativeWind-aware (não recebe
 * `className`), então seus componentes são estilizados via tema + prop `style`,
 * não via classe utilitária.
 *
 * Relacionado: docs/adr/0005-design-system-nativewind-paper.md
 */
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

import { darkColors, lightColors, useIsDarkTheme, type ThemeColors } from './colors';

/** Monta um tema MD3 com a paleta do app no lugar das cores padrão (roxo). */
function buildTheme(base: typeof MD3LightTheme, palette: ThemeColors) {
  return {
    ...base,
    roundness: 4,
    colors: {
      ...base.colors,
      primary: palette.primary,
      secondary: palette.accent,
      tertiary: palette.positive,
      background: palette.background,
      surface: palette.surface,
      surfaceVariant: palette.tint,
      outline: palette.border,
      outlineVariant: palette.border,
      onSurface: palette.ink,
      onSurfaceVariant: palette.muted,
      error: palette.negative,
      // Os tokens *Container dirigem FAB, chips e botões "tonal". Sem
      // sobrescrevê-los, o roxo padrão do MD3 vaza — visível no tema escuro,
      // onde o FAB aparecia roxo em vez de na cor do app.
      primaryContainer: palette.tint,
      onPrimaryContainer: palette.primary,
      secondaryContainer: palette.tint,
      onSecondaryContainer: palette.primary,
      tertiaryContainer: palette.tint,
      onTertiaryContainer: palette.primary,
      errorContainer: palette.tint,
      onErrorContainer: palette.negative,
      onPrimary: palette.onPrimary,
      elevation: {
        ...base.colors.elevation,
        level1: palette.surface,
        level2: palette.surface,
        level3: palette.surface,
      },
    },
  };
}

/** Tema claro do Paper. */
export const paperLightTheme = buildTheme(MD3LightTheme, lightColors);

/** Tema escuro do Paper. */
export const paperDarkTheme = buildTheme(MD3DarkTheme, darkColors);

/**
 * Tema do Paper correspondente ao esquema de cores do sistema.
 *
 * @returns O tema claro ou escuro, já com a paleta do app aplicada.
 */
export function usePaperTheme() {
  return useIsDarkTheme() ? paperDarkTheme : paperLightTheme;
}

/**
 * Tema claro, mantido para código fora de componente.
 *
 * @deprecated Em componente use `usePaperTheme()`, que segue o tema do sistema.
 */
export const paperTheme = paperLightTheme;
