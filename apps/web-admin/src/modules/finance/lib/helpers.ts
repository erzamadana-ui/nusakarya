/** Util murni untuk modul Finance — kalkulasi umur hutang/piutang, bucket, dan proyeksi. */
import { chartColors } from '@/lib/theme'

export type Tone = 'slate' | 'emerald' | 'amber' | 'orange' | 'red' | 'blue' | 'zinc'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** Selisih hari dari `dateStr` sampai `ref` (default hari ini). Positif = `dateStr` di masa lalu. */
export function daysSince(dateStr?: string | null, ref: Date = new Date()): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const b = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export const sisaTagihan = (total?: number | null, paid?: number | null) =>
  Math.max(0, Number(total ?? 0) - Number(paid ?? 0))

/** Bucket umur hutang/piutang — mengikuti definisi bucket pada view v_dashboard_finance (ap_aging),
 *  sehingga bucket "0-30" juga mencakup invoice yang belum jatuh tempo. */
export function agingBucketKey(overdueDays: number): '0-30' | '31-60' | '61-90' | '>90' {
  if (overdueDays <= 30) return '0-30'
  if (overdueDays <= 60) return '31-60'
  if (overdueDays <= 90) return '61-90'
  return '>90'
}
export const AGING_BUCKETS: Array<'0-30' | '31-60' | '61-90' | '>90'> = ['0-30', '31-60', '61-90', '>90']
export const agingTone = (bucket: string): Tone =>
  bucket === '0-30' ? 'amber' : bucket === '31-60' ? 'orange' : bucket === '61-90' ? 'red' : bucket === '>90' ? 'red' : 'slate'

/** Label umur hutang/piutang yang ramah-baca untuk satu baris invoice, dari `due_date`. */
export function umurLabel(dueDate?: string | null): { label: string; tone: Tone; days: number | null } {
  const d = daysSince(dueDate)
  if (d == null) return { label: '-', tone: 'slate', days: null }
  if (d < 0) return { label: `Belum jatuh tempo (${Math.abs(d)} hari lagi)`, tone: 'slate', days: d }
  const bucket = agingBucketKey(d)
  const map = { '0-30': `Terlambat ${d} hari`, '31-60': `Terlambat ${d} hari`, '61-90': `Terlambat ${d} hari`, '>90': `Terlambat ${d} hari` } as const
  return { label: map[bucket], tone: agingTone(bucket), days: d }
}

export const ym = (dateStr?: string | null) => (dateStr ? dateStr.slice(0, 7) : '')
export const currentYm = () => ym(new Date().toISOString())
export function ymLabel(key: string) {
  const [y, m] = key.split('-')
  const mi = Number(m) - 1
  return `${MONTHS_SHORT[mi] ?? m} ${y}`
}
/** N bulan terakhir (termasuk bulan berjalan), format 'YYYY-MM', urut lama → baru. */
export function lastMonths(n: number, ref = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Rekomendasi tindak lanjut penagihan berdasar umur piutang — panduan, bukan data tersimpan. */
export function rekomendasiTindakLanjut(days: number | null): string {
  if (days == null || days < 0) return '-'
  if (days === 0) return 'Kirim invoice & konfirmasi penerimaan'
  if (days <= 7) return 'Kirim pengingat pembayaran'
  if (days <= 30) return 'Follow-up telepon ke PIC pelanggan'
  if (days <= 60) return 'Eskalasi ke atasan / manajemen akun'
  return 'Eskalasi ke penagihan hukum / kolektor'
}

export const CHART_COLORS = (): Record<string, string> => {
  const c = chartColors()
  return { masuk: c.success, keluar: c.danger, primary: c.primary, accent: c.accent, teal: c.primarySoft, amber: c.warning, slate: c.neutral }
}
