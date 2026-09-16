/** Helper murni (non-komponen) untuk modul K3 / HSE. */

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function monthKey(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
export function monthLabel(key: string): string { const [y, m] = key.split('-'); return `${MONTHS_SHORT[Number(m) - 1] ?? m} ${String(y).slice(2)}` }

/** N bulan terakhir (termasuk bulan berjalan), urut dari paling lama ke terbaru. */
export function lastNMonths(n: number): string[] {
  const arr: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(now.getFullYear(), now.getMonth() - i, 1)
    arr.push(monthKey(x))
  }
  return arr
}

/** Batas awal (ISO date) N bulan ke belakang dari hari ini — dipakai untuk filter rentang tren. */
export function monthsAgoISODate(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

/** Selisih hari dari tanggal/waktu tertentu sampai sekarang (atau `to`). */
export function daysBetween(fromISO?: string | null, to: Date = new Date()): number | null {
  if (!fromISO) return null
  const f = new Date(fromISO)
  if (isNaN(f.getTime())) return null
  return Math.floor((to.getTime() - f.getTime()) / 86400000)
}

export function tautanPeta(lat?: number | string | null, lng?: number | string | null): string | null {
  if (lat == null || lng == null || lat === '' || lng === '') return null
  return `https://www.google.com/maps?q=${lat},${lng}`
}

/* ---------------- Hitung mundur masa berlaku izin kerja ---------------- */
export function sisaMenitIzin(validTo?: string | null, now: Date = new Date()): number | null {
  if (!validTo) return null
  const d = new Date(validTo).getTime()
  if (isNaN(d)) return null
  return Math.round((d - now.getTime()) / 60000)
}
export function warnaSisaIzin(sisaMenit: number | null): 'hijau' | 'kuning' | 'merah' {
  if (sisaMenit == null) return 'hijau'
  if (sisaMenit <= 0) return 'merah'
  if (sisaMenit <= 24 * 60) return 'kuning'
  return 'hijau'
}
export const WARNA_KELAS: Record<'hijau' | 'kuning' | 'merah', string> = {
  hijau: 'text-emerald-600 dark:text-emerald-400',
  kuning: 'text-amber-600 dark:text-amber-400',
  merah: 'text-red-600 dark:text-red-400',
}
export function formatSisaIzin(sisaMenit: number | null): string {
  if (sisaMenit == null) return '-'
  const lewat = sisaMenit < 0
  const abs = Math.abs(sisaMenit)
  const h = Math.floor(abs / 1440), sisaJam = abs % 1440, j = Math.floor(sisaJam / 60), m = sisaJam % 60
  const teks = h > 0 ? `${h}h ${j}j` : j > 0 ? `${j}j ${m}m` : `${m}m`
  return lewat ? `Lewat ${teks}` : teks
}
