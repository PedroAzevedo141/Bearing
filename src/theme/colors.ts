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
  primary: '#315CF5',
  /** Cor de apoio para progresso, seleção e indicadores. */
  accent: '#16A889',
  /** Azul-marinho usado em superfícies de alto contraste. */
  ink: '#101828',
  /** Sucesso / valores positivos (entradas, metas concluídas). */
  positive: '#11845B',
  /** Erro / valores negativos / ações destrutivas (saídas, excluir). */
  negative: '#D1465B',
  /** Fundo padrão das telas. */
  background: '#F4F7FB',
  /** Fundo de cards e superfícies elevadas. */
  surface: '#FFFFFF',
  /** Bordas e divisores. */
  border: '#E3E9F2',
  /** Texto secundário / desabilitado. */
  muted: '#667085',
  /** Fundo suave para áreas selecionadas e destaques discretos. */
  tint: '#EAF0FF',
} as const;
