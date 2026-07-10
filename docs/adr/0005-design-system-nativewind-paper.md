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

**Paleta única** em [src/theme/colors.ts](../../src/theme/colors.ts), consumida por dois lugares que não podem compartilhar import direto (contextos de módulo diferentes):
- `tailwind.config.js` (roda em Node/CommonJS no build do Metro) duplica os valores literalmente, com comentário apontando `colors.ts` como fonte da verdade.
- `src/theme/paperTheme.ts` estende `MD3LightTheme` com a mesma paleta.

**Ícones**: `settings.icon` do `PaperProvider` usa `@expo/vector-icons` (já parte do ecossistema Expo) em vez de depender de `react-native-vector-icons`.

**Versões fixadas por compatibilidade, não por "latest" do npm**: `react-native-reanimated ~4.1.1` e `react-native-gesture-handler ~2.28.0` (via `npx expo install`, que lê `bundledNativeModules.json` do SDK 54 — as versões "latest" do npm, 4.5.x e 3.x, exigem RN 0.83+, incompatível com o RN 0.81.5 do projeto). `tailwindcss` fixado em `^3.4.0` — NativeWind 4.2.x integra com o motor JIT clássico do Tailwind v3, não com o motor novo (Oxide/CSS-first) do v4.

## Consequências

**Mais fácil:** visual consistente entre as 4 telas sem copiar/colar `StyleSheet`; trocar uma cor da paleta propaga pro app inteiro (exceto o `tailwind.config.js`, que precisa da mesma edição manual). Componentes de formulário ganham label flutuante, states de erro e feedback de toque de graça (Paper).

**Mais difícil:** duas fontes da paleta a manter em sincronia (`colors.ts` e `tailwind.config.js`) — risco pequeno mas real de divergência se alguém editar só um dos dois. `react-native-reanimated`/`react-native-worklets` adicionam complexidade ao `babel.config.js` (plugin precisa ser o último da lista). Versões do Reanimated/Gesture Handler ficam atadas à tabela de compatibilidade do Expo SDK — upgrade de SDK exige rodar `npx expo install --fix` de novo, não só `npm update`.
