/** @type {import('tailwindcss').Config} */
// ws- tokens carried over from the pm-site-redesign sandbox so AnnotatorPanel renders as authored.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'ws-page-bg': '#050A12', 'ws-surface': '#0B111B', 'ws-surface-elevated': '#101824',
        'ws-text-primary': '#FAF7F0', 'ws-text-secondary': '#A9A49B', 'ws-text-tertiary': '#6E6962',
        'ws-border-subtle': 'rgba(250, 247, 240, 0.08)', 'ws-border-strong': 'rgba(250, 247, 240, 0.18)',
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
