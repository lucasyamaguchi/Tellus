/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-bg)',
        card: 'var(--color-card)',
        'card-border': 'var(--color-card-border)',
        sidebar: 'var(--color-sidebar)',
        'sidebar-border': 'var(--color-sidebar-border)',
        panel: 'var(--color-panel)',
        accent: {
          DEFAULT: '#d97706',
          hover: '#b45309',
          light: '#f59e0b',
          glow: 'rgba(217, 119, 6, 0.15)',
        },
        brand: {
          cyan: '#2dd4bf',
          emerald: '#34d399',
          amber: '#fbbf24',
          rose: '#f87171',
          purple: '#c084fc'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      }
    },
  },
  plugins: [],
}
