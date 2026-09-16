/** Helper murni (non-komponen) untuk modul Operations. */

/** Sisa menit menuju jatuh tempo SLA. Negatif berarti sudah lewat. */
export function sisaMenitSla(slaDueAt?: string | null, now: Date = new Date()): number | null {
  if (!slaDueAt) return null
  const due = new Date(slaDueAt).getTime()
  if (isNaN(due)) return null
  return Math.round((due - now.getTime()) / 60000)
}

/** Warna status sisa waktu SLA: hijau (aman) / kuning (mendekati) / merah (lewat). */
export function warnaSisaSla(sisaMenit: number | null, slaMenit?: number | null): 'hijau' | 'kuning' | 'merah' {
  if (sisaMenit == null) return 'hijau'
  if (sisaMenit <= 0) return 'merah'
  const ambangKuning = slaMenit ? slaMenit * 0.25 : 120
  if (sisaMenit <= ambangKuning) return 'kuning'
  return 'hijau'
}

export const WARNA_KELAS: Record<'hijau' | 'kuning' | 'merah', string> = {
  hijau: 'text-emerald-600 dark:text-emerald-400',
  kuning: 'text-amber-600 dark:text-amber-400',
  merah: 'text-red-600 dark:text-red-400',
}

/** Format sisa menit menjadi teks "2j 15m" atau "Lewat 1j 10m". */
export function formatSisaSla(sisaMenit: number | null): string {
  if (sisaMenit == null) return '-'
  const lewat = sisaMenit < 0
  const abs = Math.abs(sisaMenit)
  const j = Math.floor(abs / 60), m = abs % 60
  const teks = j > 0 ? `${j}j ${m}m` : `${m}m`
  return lewat ? `Lewat ${teks}` : teks
}

/** Batas awal & akhir (ISO) untuk hari ini, dipakai untuk filter gte/lte. */
export function rentangHariIni(): [string, string] {
  const d = new Date()
  const awal = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString()
  const akhir = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString()
  return [awal, akhir]
}

/** N hari ke belakang dari sekarang (ISO), dipakai untuk filter tren. */
export function hariKeBelakang(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/** Tautan Google Maps dari koordinat. */
export function tautanPeta(lat?: number | string | null, lng?: number | string | null): string | null {
  if (lat == null || lng == null || lat === '' || lng === '') return null
  return `https://www.google.com/maps?q=${lat},${lng}`
}
