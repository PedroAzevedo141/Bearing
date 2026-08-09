# 0005 — Design system: NativeWind + React Native Paper

## Status

Aceito (2026-07-07)

## Contexto

As 4 telas do app usavam `StyleSheet.create` duplicado, cada uma com sua própria cópia dos mesmos hex (`#2E86AB`, `#1B7F4D`, `#C0392B`, `#F5F5F2`, `#888888`...) e seus próprios `Button`/`TextInput` nativos sem estilo consistente de espaçamento, tipografia ou feedback visual. Não havia sistema de design — cada tela reinventava o layout do zero.

## Decisão

**NativeWind** (`className` sobre Tailwind) para layout, espaçamento e tipografia em componentes nativos do React Native (`View`, `Text`, `ScrollView`, `KeyboardAvoidingView`, `FlatList`). **React Native Paper** (tema MD3) para widgets interativos/estruturados: `Button`, `TextInput`, `Card`, `List.Accordion`, `ActivityIndicator`.

Regra de convivência (as duas bibliotecas não se misturam por acaso):
- Paper não é NativeWind-aware — seus componentes não recebem `className`, só `style` (objeto) + o tema compartilhado.
- `FlatList`/`ScrollView` recebem `contentContainerClassName` em vez de `contentContainerStyle` — o NativeWind aumenta essa prop via `react-native-css-interop` (confirmado lendo os `.d.ts` do pacote instalado), não é preciso manter um objeto de estilo solto para isso.

**Paleta única**, consumida por dois caminhos que não compartilham import direto (contextos de módulo diferentes):
- As classes do NativeWind (`bg-surface`, `text-ink`, …) leem **variáveis CSS** declaradas em `global.css`; `tailwind.config.js` só aponta para elas (`rgb(var(--color-x) / <alpha-value>)`), sem repetir valores.
- `src/theme/colors.ts` espelha os mesmos valores em TypeScript, para o que não passa por `className`: props de ícone, `StyleSheet` e o tema do Paper.

**Revisão (tema escuro).** A paleta era um objeto TypeScript único, duplicado literalmente no `tailwind.config.js` — o que tornava impossível ter dois temas sem duplicar tudo de novo. As cores viraram variáveis CSS, e é em `global.css` que claro e escuro se separam: como as telas já usavam tokens semânticos, trocar os valores lá troca o app inteiro sem tocar em JSX.

Do lado TypeScript, `useThemeColors()` devolve a paleta em vigor. A constante `colors` continua exportada, sempre clara, para código fora de componente — sem hook não há como saber o tema, e devolver silenciosamente a cor errada seria pior que a limitação explícita. Componentes com `StyleSheet` de módulo passaram a montar os estilos por fábrica (`createStyles(colors)` + `useMemo`), porque `StyleSheet.create` no topo do arquivo congelaria as cores do tema claro na primeira avaliação.

Dois tokens novos nasceram dessa revisão, para casos que a paleta semântica não cobria: `spotlight` (a superfície de alto contraste dos cards de saldo — quase preta no claro, cinza elevado no escuro, com texto branco nos dois) e `track` (trilho de barra de progresso, antes um cinza fixo que virava mancha clara no escuro).

**Ícones**: `settings.icon` do `PaperProvider` usa `@expo/vector-icons` (já parte do ecossistema Expo) em vez de depender de `react-native-vector-icons`.

**Versões fixadas por compatibilidade, não por "latest" do npm**: `react-native-reanimated ~4.1.1` e `react-native-gesture-handler ~2.28.0` (via `npx expo install`, que lê `bundledNativeModules.json` do SDK 54 — as versões "latest" do npm, 4.5.x e 3.x, exigem RN 0.83+, incompatível com o RN 0.81.5 do projeto). `tailwindcss` fixado em `^3.4.0` — NativeWind 4.2.x integra com o motor JIT clássico do Tailwind v3, não com o motor novo (Oxide/CSS-first) do v4.

## Consequências

**Mais fácil:** visual consistente entre as 4 telas sem copiar/colar `StyleSheet`; trocar uma cor da paleta propaga pro app inteiro (exceto o `tailwind.config.js`, que precisa da mesma edição manual). Componentes de formulário ganham label flutuante, states de erro e feedback de toque de graça (Paper).

**Mais difícil:** duas fontes da paleta a manter em sincronia (`global.css` e `colors.ts`) — risco pequeno mas real de divergência se alguém editar só uma. O tema escuro acrescenta um cuidado permanente: cor fixa em JSX (um `#hex`, um `bg-slate-100`, um `text-neutral-600`) volta a quebrar o tema em silêncio, e só aparece quando alguém abre o app no escuro. Os tokens `*Container` do MD3 também precisam ficar sobrescritos no tema do Paper — sem eles o roxo padrão vaza no FAB e nos botões tonais. `react-native-reanimated`/`react-native-worklets` adicionam complexidade ao `babel.config.js` (plugin precisa ser o último da lista). Versões do Reanimated/Gesture Handler ficam atadas à tabela de compatibilidade do Expo SDK — upgrade de SDK exige rodar `npx expo install --fix` de novo, não só `npm update`.
