/** Warna diambil dari CSS custom property agar tema bisa ditukar saat aplikasi berjalan.
 *  Definisi nilainya ada di src/styles.css (blok [data-theme="operations"] dan [data-theme="antarkita"]). */
const v = (name) => `rgb(var(${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        primary: {
          50: v('--c-primary-50'), 100: v('--c-primary-100'), 200: v('--c-primary-200'),
          300: v('--c-primary-300'), 400: v('--c-primary-400'), 500: v('--c-primary-500'),
          600: v('--c-primary-600'), 700: v('--c-primary-700'), 800: v('--c-primary-800'),
          900: v('--c-primary-900'),
        },
        accent: {
          50: v('--c-accent-50'), 100: v('--c-accent-100'), 300: v('--c-accent-300'),
          500: v('--c-accent-500'), 600: v('--c-accent-600'), 700: v('--c-accent-700'),
        },
        ink: {
          0: v('--c-ink-0'), 50: v('--c-ink-50'), 100: v('--c-ink-100'), 200: v('--c-ink-200'),
          300: v('--c-ink-300'), 400: v('--c-ink-400'), 500: v('--c-ink-500'), 600: v('--c-ink-600'),
          700: v('--c-ink-700'), 800: v('--c-ink-800'), 900: v('--c-ink-900'),
        },
        surface: {
          DEFAULT: v('--c-surface'), muted: v('--c-surface-muted'),
          dark: v('--c-surface-dark'), darker: v('--c-surface-darker'),
        },
        sidebar: {
          DEFAULT: v('--c-sidebar'), hover: v('--c-sidebar-hover'), active: v('--c-sidebar-active'),
          fg: v('--c-sidebar-fg'), muted: v('--c-sidebar-muted'), border: v('--c-sidebar-border'),
          onactive: v('--c-sidebar-onactive'),
        },
      },
      borderRadius: {
        xs: 'var(--r-xs)', sm: 'var(--r-sm)', DEFAULT: 'var(--r-sm)',
        md: 'var(--r-md)', lg: 'var(--r-lg)', xl: 'var(--r-xl)',
      },
      boxShadow: {
        e1: 'var(--sh-1)', e2: 'var(--sh-2)', e3: 'var(--sh-3)',
      },
      fontSize: {
        overline: ['11px', { lineHeight: '16px', letterSpacing: '.06em' }],
        caption: ['12px', { lineHeight: '16px' }],
        body: ['14px', { lineHeight: '20px' }],
        'body-l': ['15px', { lineHeight: '22px' }],
        kpi: ['32px', { lineHeight: '40px' }],
      },
    },
  },
  plugins: [],
}
