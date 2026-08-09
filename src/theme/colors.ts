/**
 * theme/colors.ts
 *
 * Paleta do lado TypeScript — usada onde a cor não passa por `className`:
 * props de ícone (`color=`), `StyleSheet` e o tema do React Native Paper.
 *
 * As classes do NativeWind (`bg-surface`, `text-ink`, …) **não** dependem deste
 * arquivo: elas leem as variáveis CSS de `global.css`, que é onde claro e
 * escuro se separam de fato. Os valores aqui são o espelho daqueles — mudou
 * num, muda no outro.
 *
 * Em componente, use `useThemeColors()`. A constante `colors` continua
 * exportada para código fora de componente, e é sempre a paleta clara: sem
 * hook não há como saber o tema, e devolver silenciosamente a cor errada seria
 * pior que a limitação explícita.
 *
 * Relacionado: docs/adr/0005-design-system-nativewind-paper.md, global.css
 */
import { useColorScheme } from 'nativewind';

/** Conjunto de cores semânticas do app. */
export interface ThemeColors {
  /** Cor de destaque principal (botões primários, links, progresso). */
  primary: string;
  /** Cor de apoio para progresso, seleção e indicadores. */
  accent: string;
  /** Cor do texto principal sobre o fundo padrão. */
  ink: string;
  /** Sucesso / valores positivos (entradas, metas concluídas). */
  positive: string;
  /** Erro / valores negativos / ações destrutivas (saídas, excluir). */
  negative: string;
  /** Fundo padrão das telas. */
  background: string;
  /** Fundo de cards e superfícies elevadas. */
  surface: string;
  /** Bordas e divisores. */
  border: string;
  /** Texto secundário / desabilitado. */
  muted: string;
  /** Fundo suave para áreas selecionadas e destaques discretos. */
  tint: string;
  /** Superfície de alto contraste dos cards de destaque; texto por cima é branco. */
  spotlight: string;
  /** Ícone de destaque sobre `spotlight`. */
  onSpotlight: string;
  /** Trilho de barra de progresso. */
  track: string;
}

/** Paleta do tema claro. */
export const lightColors: ThemeColors = {
  primary: '#315CF5',
  accent: '#16A889',
  ink: '#101828',
  positive: '#11845B',
  negative: '#D1465B',
  background: '#F4F7FB',
  surface: '#FFFFFF',
  border: '#E3E9F2',
  muted: '#667085',
  tint: '#EAF0FF',
  spotlight: '#101828',
  onSpotlight: '#9EB4FF',
  track: '#F1F5F9',
};

/**
 * Paleta do tema escuro.
 *
 * Não é a clara invertida: o azul e o verde são clareados porque as versões do
 * tema claro não alcançam contraste suficiente sobre fundo escuro, e o
 * `background` é mais escuro que o `surface` para os cards continuarem lendo
 * como elevados.
 */
export const darkColors: ThemeColors = {
  primary: '#8AA5FF',
  accent: '#2DC8A5',
  ink: '#ECF0F8',
  positive: '#3CBE87',
  negative: '#F0788A',
  background: '#0D111B',
  surface: '#171D2B',
  border: '#2A3346',
  muted: '#94A0B6',
  tint: '#202B4A',
  spotlight: '#1E273A',
  onSpotlight: '#9EB4FF',
  track: '#2A3346',
};

/**
 * Paleta clara, para uso fora de componente.
 *
 * Em componente prefira `useThemeColors()` — esta constante não segue o tema
 * do sistema.
 */
export const colors = lightColors;

/**
 * Paleta do tema em vigor, seguindo a preferência do sistema.
 *
 * @returns `lightColors` ou `darkColors`.
 *
 * @example
 * const c = useThemeColors();
 * <MaterialCommunityIcons color={c.primary} />
 */
export function useThemeColors(): ThemeColors {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? darkColors : lightColors;
}

/**
 * Diz se o tema escuro está em vigor.
 *
 * Útil para o que não é cor — `StatusBar`, `keyboardAppearance`, escolha de
 * tema do Paper.
 *
 * @returns true quando o sistema está em modo escuro.
 */
export function useIsDarkTheme(): boolean {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark';
}
