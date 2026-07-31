// tailwind.config.js
//
// Paleta duplicada literalmente de src/theme/colors.ts — este arquivo roda
// em contexto Node/CommonJS no build (Metro), não pode importar o módulo TS
// do app. src/theme/colors.ts é a fonte da verdade; mudou lá, muda aqui
// também (ver docs/adr/0005-design-system-nativewind-paper.md).
//
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
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
      },
    },
  },
  plugins: [],
};
