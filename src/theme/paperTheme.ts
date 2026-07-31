/**
 * theme/paperTheme.ts
 *
 * Tema do React Native Paper, derivado da mesma paleta usada pelo
 * NativeWind (src/theme/colors.ts) — Paper não é NativeWind-aware (não
 * recebe `className`), então seus componentes são estilizados via este
 * tema + a prop `style`, não via classe utilitária.
 *
 * Relacionado: docs/adr/0005-design-system-nativewind-paper.md
 */
import { MD3LightTheme } from 'react-native-paper';

import { colors } from './colors';

/** Tema MD3 do Paper com a paleta do app no lugar das cores padrão (roxo). */
export const paperTheme = {
  ...MD3LightTheme,
  roundness: 4,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    secondary: colors.accent,
    tertiary: colors.positive,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.tint,
    outline: colors.border,
    outlineVariant: colors.border,
    onSurface: colors.ink,
    onSurfaceVariant: colors.muted,
    error: colors.negative,
  },
};
