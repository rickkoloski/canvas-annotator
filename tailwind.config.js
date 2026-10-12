/** @type {import('tailwindcss').Config} */
// ws- tokens carried over from the pm-site-redesign sandbox so AnnotatorPanel renders as authored.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'ws-page-bg': 'rgb(var(--ws-page-bg) / <alpha-value>)', 'ws-surface': 'rgb(var(--ws-surface) / <alpha-value>)', 'ws-surface-elevated': 'rgb(var(--ws-surface-elevated) / <alpha-value>)',
        'ws-text-primary': 'rgb(var(--ws-text-primary) / <alpha-value>)', 'ws-text-secondary': 'rgb(var(--ws-text-secondary) / <alpha-value>)', 'ws-text-tertiary': 'rgb(var(--ws-text-tertiary) / <alpha-value>)',
        'ws-border-subtle': 'rgb(var(--ws-ink) / 0.08)', 'ws-border-strong': 'rgb(var(--ws-ink) / 0.18)',
        'ws-terracotta': '#C06A45', 'ws-terracotta-text': '#E09B58', 'ws-sage': '#7FA3A0', 'ws-cream': '#EAE2D4',
      },
      fontFamily: {
        'ws-body': ['"DM Sans"', 'system-ui', 'sans-serif'],
        'ws-mono': ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
