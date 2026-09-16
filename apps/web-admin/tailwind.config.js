/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        primary: {
          50: '#EAF6F6', 100: '#D0EBEC', 200: '#A3D7D9', 300: '#6FBFC3',
          400: '#3AA3AA', 500: '#1B8A92', 600: '#146F77', 700: '#0F585F',
          800: '#093C43', 900: '#04262C',
        },
        accent: { 50:'#FFF7E6',100:'#FDECC8',300:'#F8C765',500: '#F5A524', 600: '#D18A12', 700:'#9C6608' },
        ink: {
          0:'#FFFFFF',50:'#F7F8FA',100:'#EFF1F4',200:'#E2E6EB',300:'#CBD2DA',
          400:'#94A1B2',500:'#64748B',600:'#475467',700:'#334155',800:'#1E293B',900:'#131B2C',
        },
        surface: { DEFAULT: '#FFFFFF', muted: '#F7F8FA', dark: '#131B2C', darker: '#0B111C' },
        sidebar: { DEFAULT: '#073A42', hover: '#0B4A53', active: '#146F77' },
      },
      borderRadius: { xs: '4px', sm: '6px', md: '10px', lg: '14px' },
      boxShadow: {
        e1: '0 1px 2px rgba(15,23,42,.06)',
        e2: '0 4px 12px rgba(15,23,42,.10)',
        e3: '0 12px 32px rgba(15,23,42,.14)',
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
