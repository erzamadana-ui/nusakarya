/** Helper murni (non-komponen) untuk modul MORNING & BMON. */
import { AMBANG_KEPATUHAN_KUNING, AMBANG_KEPATUHAN_MERAH } from './constants'

/** Batas awal (00:00:00) & akhir (23:59:59.999) dari string tanggal (YYYY-MM-DD).
 * String kosong menghasilkan `null` (tidak membatasi). */
export function dateBounds(fromStr?: string, toStr?: string): { from: Date | null; to: Date | null } {
  const from = fromStr ? new Date(`${fromStr}T00:00:00`) : null
  const to = toStr ? new Date(`${toStr}T23:59:59.999`) : null
  return { from, to }
}

/** Apakah string tanggal ISO berada di dalam rentang [from, to] (batas dapat null = tidak dibatasi). */
export function withinBounds(iso: string | null | undefined, from: Date | null, to: Date | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  if (isNaN(d.getTime())) return false
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

/** Rata-rata angka (mengabaikan null/undefined). Null bila tidak ada data. */
export function avg(nums: (number | null | undefined)[]): number | null {
  const v = nums.filter((n): n is number => n != null && !isNaN(n))
  if (!v.length) return null
  return v.reduce((a, b) => a + b, 0) / v.length
}

/** Deret 30 hari terakhir (termasuk hari ini), masing-masing berisi kunci YYYY-MM-DD & label singkat. */
export function last30Days(): { key: string; label: string }[] {
  const days: { key: string; label: string }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({ key: d.toISOString().slice(0, 10), label: `${d.getDate()}/${d.getMonth() + 1}` })
  }
  return days
}

/** Kelas warna Tailwind untuk badge kepatuhan SLA berdasarkan ambang (bawaan 90% kuning, 80% merah). */
export function warnaKepatuhan(pctVal: number | null): 'hijau' | 'kuning' | 'merah' {
  if (pctVal == null) return 'hijau'
  if (pctVal < AMBANG_KEPATUHAN_MERAH) return 'merah'
  if (pctVal < AMBANG_KEPATUHAN_KUNING) return 'kuning'
  return 'hijau'
}
export const KELAS_WARNA: Record<'hijau' | 'kuning' | 'merah', string> = {
  hijau: 'text-emerald-600 dark:text-emerald-400',
  kuning: 'text-amber-600 dark:text-amber-400',
  merah: 'text-red-600 dark:text-red-400',
}

/** Sisa menit menuju jatuh tempo SLA (negatif = sudah lewat). */
export function sisaMenitSla(slaDueAt?: string | null, now: Date = new Date()): number | null {
  if (!slaDueAt) return null
  const due = new Date(slaDueAt).getTime()
  if (isNaN(due)) return null
  return Math.round((due - now.getTime()) / 60000)
}
export function formatSisaSla(sisaMenit: number | null): string {
  if (sisaMenit == null) return '-'
  const lewat = sisaMenit < 0
  const abs = Math.abs(sisaMenit)
  const j = Math.floor(abs / 60), m = abs % 60
  const teks = j > 0 ? `${j}j ${m}m` : `${m}m`
  return lewat ? `Lewat ${teks}` : teks
}
export function warnaSisaSla(sisaMenit: number | null, slaMenit?: number | null): 'hijau' | 'kuning' | 'merah' {
  if (sisaMenit == null) return 'hijau'
  if (sisaMenit <= 0) return 'merah'
  const ambangKuning = slaMenit ? slaMenit * 0.25 : 120
  if (sisaMenit <= ambangKuning) return 'kuning'
  return 'hijau'
}

/** Umur (menit) sejak suatu waktu ISO hingga sekarang. */
export function umurMenit(iso?: string | null, now: Date = new Date()): number | null {
  if (!iso) return null
  const d = new Date(iso).getTime()
  if (isNaN(d)) return null
  return Math.round((now.getTime() - d) / 60000)
}
export function formatUmur(menit: number | null): string {
  if (menit == null) return '-'
  const j = Math.floor(menit / 60), sisaJam = j % 24, hari = Math.floor(j / 24)
  if (hari > 0) return `${hari}h ${sisaJam}j`
  if (j > 0) return `${j}j ${menit % 60}m`
  return `${menit}m`
}

/** Waktu tarik data (format Indonesia, tanggal + jam). */
export function waktuTarik(d: Date | null): string {
  if (!d) return '-'
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
