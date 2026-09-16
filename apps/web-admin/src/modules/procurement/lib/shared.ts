/** Konstanta & util bersama modul Procurement. */

export const VENDOR_TYPES = [
  { value: 'material', label: 'Material' },
  { value: 'jasa', label: 'Jasa' },
  { value: 'subkon', label: 'Subkontraktor' },
  { value: 'sewa', label: 'Sewa' },
]
export const VENDOR_STATUS = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'blacklist', label: 'Blacklist' },
  { value: 'nonaktif', label: 'Nonaktif' },
]

export const ITEM_CATEGORY = [
  { value: 'NTE', label: 'NTE' },
  { value: 'NON_NTE', label: 'Non-NTE' },
  { value: 'ASSET', label: 'Aset' },
  { value: 'JASA', label: 'Jasa' },
]

export const PR_STATUS = ['draft', 'diajukan', 'disetujui', 'ditolak', 'sebagian_po', 'selesai', 'batal']
export const PR_STEPS = ['Draft', 'Diajukan', 'Disetujui', 'Selesai']
export function prStepIndex(status: string) {
  if (status === 'ditolak' || status === 'batal') return 1
  if (status === 'draft') return 0
  if (status === 'diajukan') return 1
  if (status === 'disetujui') return 2
  if (status === 'sebagian_po' || status === 'selesai') return 3
  return 0
}

export const PO_STATUS = ['draft', 'diajukan', 'disetujui', 'dikirim', 'diterima_sebagian', 'diterima', 'ditutup', 'batal']
export const PO_STEPS = ['Draft', 'Diajukan', 'Disetujui', 'Dikirim', 'Diterima', 'Ditutup']
export function poStepIndex(status: string) {
  const m: Record<string, number> = {
    draft: 0, diajukan: 1, disetujui: 2, dikirim: 3,
    diterima_sebagian: 3, diterima: 4, ditutup: 5, batal: 1,
  }
  return m[status] ?? 0
}

export const GR_STATUS = ['draft', 'diterima', 'ditolak']

export const INV_STATUS = ['draft', 'diajukan', 'diverifikasi', 'disetujui', 'dibayar_sebagian', 'lunas', 'ditolak']
export const INV_TABS = [
  { value: 'semua', label: 'Semua' },
  { value: 'draft', label: 'Draft' },
  { value: 'diajukan', label: 'Diajukan' },
  { value: 'diverifikasi', label: 'Diverifikasi' },
  { value: 'disetujui', label: 'Disetujui' },
  { value: 'dibayar_sebagian', label: 'Dibayar Sebagian' },
  { value: 'lunas', label: 'Lunas' },
  { value: 'ditolak', label: 'Ditolak' },
]

export const RFQ_STATUS = [
  { value: 'draft', label: 'Draft' },
  { value: 'dikirim', label: 'Dikirim ke Vendor' },
  { value: 'ditutup', label: 'Ditutup' },
  { value: 'batal', label: 'Batal' },
]

/** Usia hutang (hari sejak jatuh tempo). Positif = terlambat. */
export function agingDays(dueDate?: string | null) {
  if (!dueDate) return 0
  const d = new Date(dueDate); const t = new Date()
  d.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0)
  return Math.round((t.getTime() - d.getTime()) / 86400000)
}
export function agingTone(days: number) {
  if (days > 30) return 'text-red-600 dark:text-red-400 font-semibold'
  if (days > 0) return 'text-orange-600 dark:text-orange-400 font-semibold'
  if (days > -7) return 'text-amber-600 dark:text-amber-400'
  return 'text-ink-500'
}
export function agingLabel(days: number) {
  if (days > 0) return `Terlambat ${days} hari`
  if (days === 0) return 'Jatuh tempo hari ini'
  return `${Math.abs(days)} hari lagi`
}

export const CHART_COLORS = ['#1B8A92', '#F5A524', '#3AA3AA', '#F59E0B', '#64748B', '#E11D48', '#16A34A']
