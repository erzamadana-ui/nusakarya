/** Helper murni (non-komponen) untuk modul Operations (perluasan). */

/** Umur (menit) sejak sebuah waktu ISO hingga sekarang (atau hingga waktu selesai bila diberikan). */
export function umurMenit(sejakIso?: string | null, hinggaIso?: string | null, now: Date = new Date()): number | null {
  if (!sejakIso) return null
  const mulai = new Date(sejakIso).getTime()
  if (isNaN(mulai)) return null
  const akhir = hinggaIso ? new Date(hinggaIso).getTime() : now.getTime()
  return Math.max(0, Math.round((akhir - mulai) / 60000))
}

/** Kelas warna teks umur alarm: makin lama makin merah. */
export function warnaUmurAlarm(menit: number | null): string {
  if (menit == null) return 'text-ink-400'
  if (menit >= 240) return 'text-red-600 dark:text-red-400 font-semibold'
  if (menit >= 60) return 'text-amber-600 dark:text-amber-400 font-medium'
  return 'text-emerald-600 dark:text-emerald-400'
}

/** Format menit menjadi teks ringkas "2j 15m" / "45m". */
export function formatMenit(menit?: number | null): string {
  if (menit == null) return '-'
  const j = Math.floor(menit / 60), m = Math.round(menit % 60)
  return j > 0 ? `${j}j ${m}m` : `${m}m`
}

/** Batas awal & akhir (ISO) untuk hari ini. */
export function rentangHariIni(): [string, string] {
  const d = new Date()
  const awal = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString()
  const akhir = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString()
  return [awal, akhir]
}

/** Batas awal & akhir (ISO) untuk N jam ke belakang dari sekarang. */
export function rentangJamKeBelakang(n: number): [string, string] {
  const akhir = new Date()
  const awal = new Date(akhir.getTime() - n * 3600000)
  return [awal.toISOString(), akhir.toISOString()]
}

/** Rentang tanggal (ISO, awal & akhir hari) untuk kode periode "YYYY-MM". */
export function rentangPeriode(periodCode: string): [string, string] {
  const [y, m] = periodCode.split('-').map(Number)
  const awal = new Date(y, (m || 1) - 1, 1, 0, 0, 0)
  const akhir = new Date(y, (m || 1), 0, 23, 59, 59)
  return [awal.toISOString(), akhir.toISOString()]
}

/** Daftar 12 kode periode (YYYY-MM) terakhir hingga bulan berjalan, urut menaik. */
export function periode12BulanTerakhir(): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

/** Label periode "YYYY-MM" → "Sep 2026". */
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export function labelPeriode(periodCode?: string | null): string {
  if (!periodCode) return '-'
  const [y, m] = periodCode.split('-').map(Number)
  if (!y || !m) return periodCode
  return `${BULAN[m - 1]} ${y}`
}
