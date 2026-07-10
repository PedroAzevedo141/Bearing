// babel.config.js
//
// Preset do NativeWind (className -> estilos) por cima do preset padrão do
// Expo. O plugin do Reanimated precisa ser o último da lista — nesta versão
// (4.1.x) `react-native-reanimated/plugin` é um re-export de
// `react-native-worklets/plugin`, confirmado lendo o pacote instalado.
//
// Relacionado: docs/adr/0005-design-system-nativewind-paper.md
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
