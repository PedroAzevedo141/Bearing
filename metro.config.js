// metro.config.js
//
// Config padrão do Expo, envolvida pelo NativeWind pra compilar as classes
// Tailwind usadas via `className` nos componentes React Native.
//
// Relacionado: docs/adr/0005-design-system-nativewind-paper.md
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
