// tailwind.config.js
//
// As cores apontam para as variáveis CSS definidas em global.css, que é onde
// o tema claro e o escuro se separam. Este arquivo não repete valores: quem
// muda a paleta é global.css (e src/theme/colors.ts, para o que passa cor via
// `style` em vez de `className`).
//
// O formato `rgb(var(--x) / <alpha-value>)` é o que permite opacidade sobre
// variável (`bg-surface/60`) — por isso as variáveis guardam canais RGB soltos,
// não `#hex`.
//
// Ver docs/adr/0005-design-system-nativewind-paper.md.
//
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        positive: 'rgb(var(--color-positive) / <alpha-value>)',
        negative: 'rgb(var(--color-negative) / <alpha-value>)',
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        tint: 'rgb(var(--color-tint) / <alpha-value>)',
        spotlight: 'rgb(var(--color-spotlight) / <alpha-value>)',
        'on-spotlight': 'rgb(var(--color-on-spotlight) / <alpha-value>)',
        track: 'rgb(var(--color-track) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
