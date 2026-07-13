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
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    background: colors.background,
    surface: colors.surface,
    error: colors.negative,
  },
};
