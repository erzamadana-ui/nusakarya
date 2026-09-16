/** Fungsi bantu bersama untuk halaman-halaman modul Commerce. */

export const daysBetween = (from: string | Date, to: string | Date) => {
  const a = new Date(from), b = new Date(to)
  a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/** Jumlah hari tersisa sampai kontrak berakhir (negatif = sudah lewat). */
export const daysUntilExpiry = (endDate?: string | null) => {
  if (!endDate) return null
  return daysBetween(new Date(), endDate)
}

/** Umur piutang (hari lewat jatuh tempo). Negatif = belum jatuh tempo. */
export const agingDays = (dueDate?: string | null) => {
  if (!dueDate) return 0
  return daysBetween(dueDate, new Date())
}

export const agingTone = (days: number) => {
  if (days <= 0) return 'text-emerald-600 dark:text-emerald-400'
  if (days <= 30) return 'text-amber-600 dark:text-amber-400'
  if (days <= 60) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

export const agingLabel = (days: number) => (days <= 0 ? 'Belum jatuh tempo' : `${days} hari`)

export const agingBucket = (days: number) => (days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '>90')

/** Sisa tagihan yang belum dibayar pada sebuah invoice AR. */
export const arOutstanding = (inv: any) => Math.max(0, Number(inv?.total ?? 0) - Number(inv?.paid_amount ?? 0))

export const isArActive = (status: string) => status !== 'lunas' && status !== 'batal'

export const monthLabel = (dateStr: string) => {
  const d = new Date(dateStr)
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
export const monthKey = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
