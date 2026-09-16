/** Fungsi bantu bersama untuk halaman-halaman modul commerce-procurement-extended. */

export const daysBetween = (from: string | Date, to: string | Date) => {
  const a = new Date(from), b = new Date(to)
  a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/** Sisa hari sampai tanggal acuan (negatif = sudah lewat). null bila tanggal kosong. */
export const daysUntil = (date?: string | null) => {
  if (!date) return null
  return daysBetween(new Date(), date)
}

export const monthKey = (dateStr?: string | null) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1] ?? ''} ${y ?? ''}`
}
export const isSameMonth = (dateStr?: string | null, ref = new Date()) => {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

/** Tone badge/progress untuk hitung mundur tenggat (hari tersisa). */
export const countdownTone = (days: number | null): 'red' | 'orange' | 'amber' | 'emerald' | 'slate' => {
  if (days == null) return 'slate'
  if (days < 0) return 'red'
  if (days <= 3) return 'red'
  if (days <= 7) return 'amber'
  return 'emerald'
}
export const countdownLabel = (days: number | null) => {
  if (days == null) return 'Tanpa tenggat'
  if (days < 0) return `Terlewat ${Math.abs(days)} hari`
  if (days === 0) return 'Jatuh tempo hari ini'
  return `${days} hari lagi`
}
