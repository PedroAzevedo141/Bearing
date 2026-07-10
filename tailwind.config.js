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
        primary: '#2E86AB',
        positive: '#1B7F4D',
        negative: '#C0392B',
        background: '#F5F5F2',
        surface: '#FFFFFF',
        border: '#DDDDDD',
        muted: '#888888',
      },
    },
  },
  plugins: [],
};
