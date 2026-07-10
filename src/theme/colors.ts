/**
 * theme/colors.ts
 *
 * Paleta única do app — fonte da verdade para o tema do React Native Paper
 * (src/theme/paperTheme.ts) e para as cores customizadas do NativeWind
 * (tailwind.config.js, que duplica estes valores literalmente porque roda
 * em contexto de build separado e não pode importar TS do app).
 *
 * Relacionado: docs/adr/0005-design-system-nativewind-paper.md
 */

/** Paleta de cores do app. Mudou aqui, muda também em tailwind.config.js. */
export const colors = {
  /** Cor de destaque principal (botões primários, links, progresso). */
  primary: '#2E86AB',
  /** Sucesso / valores positivos (entradas, metas concluídas). */
  positive: '#1B7F4D',
  /** Erro / valores negativos / ações destrutivas (saídas, excluir). */
  negative: '#C0392B',
  /** Fundo padrão das telas. */
  background: '#F5F5F2',
  /** Fundo de cards e superfícies elevadas. */
  surface: '#FFFFFF',
  /** Bordas e divisores. */
  border: '#DDDDDD',
  /** Texto secundário / desabilitado. */
  muted: '#888888',
} as const;
