/** Template tampilan aplikasi. Ditukar saat aplikasi berjalan lewat atribut
 *  data-theme pada elemen <html>; seluruh warna, font, dan radius mengikuti. */
export type ThemeName = 'operations' | 'antarkita'

export const THEMES: { value: ThemeName; label: string; description: string; swatch: string[] }[] = [
  {
    value: 'operations',
    label: 'Operations',
    description: 'Sidebar terang, aksen indigo, sudut lebih membulat, font Plus Jakarta Sans.',
    swatch: ['#4F46E5', '#F5A524', '#FFFFFF', '#F4F4F6'],
  },
  {
    value: 'antarkita',
    label: 'AntarKita',
    description: 'Sidebar gelap teal, aksen amber, sudut rapat, font Inter.',
    swatch: ['#1B8A92', '#F5A524', '#073A42', '#F7F8FA'],
  },
]

const KEY_THEME = 'nk-template'
const KEY_MODE = 'nk-mode'

export function getTheme(): ThemeName {
  try { const v = localStorage.getItem(KEY_THEME); if (v === 'antarkita' || v === 'operations') return v } catch {}
  return 'operations'
}
export function setTheme(t: ThemeName) {
  document.documentElement.dataset.theme = t
  try { localStorage.setItem(KEY_THEME, t) } catch {}
}
export function getMode(): 'light' | 'dark' {
  try { return localStorage.getItem(KEY_MODE) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}
export function setMode(m: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', m === 'dark')
  try { localStorage.setItem(KEY_MODE, m) } catch {}
}
export function initTheme() {
  document.documentElement.dataset.theme = getTheme()
  document.documentElement.classList.toggle('dark', getMode() === 'dark')
}

/** Baca warna token tema sebagai string CSS (untuk pustaka grafik yang butuh nilai literal). */
function tok(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return raw ? `rgb(${raw.replace(/\s+/g, ' ')})` : fallback
}

/** Palet grafik yang mengikuti tema aktif. Panggil di dalam komponen, bukan di level modul. */
export function chartColors() {
  return {
    primary: tok('--c-primary-500', '#4F46E5'),
    primarySoft: tok('--c-primary-300', '#A3A9FB'),
    accent: tok('--c-accent-500', '#F5A524'),
    neutral: tok('--c-ink-400', '#9494A3'),
    grid: tok('--c-ink-200', '#E5E5EC'),
    text: tok('--c-ink-500', '#717180'),
    success: '#16A34A',
    warning: '#F59E0B',
    danger: '#E11D48',
    info: '#2563EB',
  }
}

/** Deret warna untuk seri kategori (pie, bar bertumpuk). */
export function chartSeries(): string[] {
  const c = chartColors()
  return [c.primary, c.accent, c.primarySoft, c.info, c.neutral, c.danger, c.success]
}
