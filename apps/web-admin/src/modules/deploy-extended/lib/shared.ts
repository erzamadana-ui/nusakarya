/** Konstanta & util bersama modul Design & Deployment (Extended): Perizinan, Punch List, Garansi, Subkon. */
import { list } from '@/lib/db'

export function projectLabel(p: any) {
  if (!p) return '-'
  return `${p.project_code ?? ''} — ${p.project_name ?? ''}`
}

export const CHART_COLORS = ['#1B8A92', '#F5A524', '#3AA3AA', '#F59E0B', '#64748B', '#E11D48', '#16A34A']

/* ---------------- Perizinan ---------------- */
export const PERMIT_TYPES = [
  { value: 'row', label: 'RoW (Right of Way)' },
  { value: 'galian', label: 'Galian' },
  { value: 'pemda', label: 'Pemda' },
  { value: 'kawasan', label: 'Kawasan' },
  { value: 'ketinggian', label: 'Ketinggian' },
  { value: 'lingkungan', label: 'Lingkungan' },
]
export const PERMIT_STATUS = [
  { value: 'disiapkan', label: 'Disiapkan' },
  { value: 'diajukan', label: 'Diajukan' },
  { value: 'proses', label: 'Proses' },
  { value: 'terbit', label: 'Terbit' },
  { value: 'ditolak', label: 'Ditolak' },
  { value: 'kedaluwarsa', label: 'Kedaluwarsa' },
]
export const PERMIT_STEPS = ['Disiapkan', 'Diajukan', 'Proses', 'Terbit']
export function permitStepIndex(status: string) {
  const m: Record<string, number> = { disiapkan: 0, diajukan: 1, proses: 2, terbit: 3, ditolak: 1, kedaluwarsa: 3 }
  return m[status] ?? 0
}
export function permitTypeLabel(v?: string) { return PERMIT_TYPES.find(t => t.value === v)?.label ?? (v || '-') }
/** Sisa hari sampai kedaluwarsa. Negatif = sudah kedaluwarsa. Null jika tanpa tanggal kedaluwarsa. */
export function daysToExpiry(expiryDate?: string | null): number | null {
  if (!expiryDate) return null
  const ms = new Date(expiryDate + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()
  return Math.round(ms / 86400000)
}

/* ---------------- Punch List ---------------- */
export const PUNCH_STATUS = [
  { value: 'terbuka', label: 'Terbuka' },
  { value: 'diperbaiki', label: 'Diperbaiki' },
  { value: 'diverifikasi', label: 'Diverifikasi' },
  { value: 'ditolak', label: 'Ditolak' },
  { value: 'ditutup', label: 'Ditutup' },
]
export const PUNCH_STATUS_TABS = ['terbuka', 'diperbaiki', 'diverifikasi', 'ditutup']
export const PUNCH_SEVERITY = [
  { value: 'minor', label: 'Minor' },
  { value: 'mayor', label: 'Mayor' },
  { value: 'kritis', label: 'Kritis' },
]
export const PUNCH_CATEGORY = [
  { value: 'sipil', label: 'Sipil / Galian' },
  { value: 'instalasi', label: 'Instalasi Kabel' },
  { value: 'splicing', label: 'Splicing / Sambungan' },
  { value: 'perangkat', label: 'Perangkat Aktif' },
  { value: 'kerapian', label: 'Kerapian / Housekeeping' },
  { value: 'dokumentasi', label: 'Dokumentasi' },
  { value: 'lainnya', label: 'Lainnya' },
]
/** Temuan yang masih menggantung (belum ditutup/tidak dibatalkan) — menahan proyek dinyatakan selesai. */
export const PUNCH_OPEN_STATUSES = ['terbuka', 'diperbaiki', 'diverifikasi']
export function severityTone(sev?: string) {
  return sev === 'kritis' ? 'red' : sev === 'mayor' ? 'orange' : 'amber'
}
/** photo_urls disimpan sebagai array objek {url, kind, at} agar bisa memisahkan foto temuan & foto perbaikan
 *  dalam satu kolom jsonb yang tersedia pada skema (punch_lists.photo_urls). */
export type PunchPhoto = { url: string; kind: 'temuan' | 'perbaikan'; at?: string }

/* ---------------- Garansi ---------------- */
export const WARRANTY_STATUS = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'berakhir', label: 'Berakhir' },
  { value: 'klaim', label: 'Klaim' },
]
export function addMonths(dateStr: string, months: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + Number(months || 0))
  return d.toISOString().slice(0, 10)
}
/** Sisa hari masa garansi. Negatif = sudah berakhir. */
export function warrantyDaysLeft(endDate?: string | null): number | null {
  if (!endDate) return null
  const ms = new Date(endDate + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()
  return Math.round(ms / 86400000)
}
export function warrantyTone(daysLeft: number | null): 'emerald' | 'amber' | 'red' {
  if (daysLeft == null) return 'amber'
  if (daysLeft < 30) return 'red'
  if (daysLeft <= 90) return 'amber'
  return 'emerald'
}
/** Asumsi biaya rata-rata penanganan satu tiket gangguan yang terjadi dalam masa garansi (ditanggung perusahaan).
 *  Perhitungan sistem/asumsi — bukan biaya aktual, karena tiket tidak memiliki kolom biaya pada skema data. */
export const ASSUMED_WARRANTY_TICKET_COST = 500000

/* ---------------- Subkon ---------------- */
export const SUBKON_STATUS = [
  { value: 'draft', label: 'Draft' },
  { value: 'aktif', label: 'Aktif' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'putus', label: 'Putus Kontrak' },
]
/** Rencana progres linier berdasarkan waktu berjalan terhadap periode kontrak — perhitungan sistem/asumsi,
 *  dipakai hanya untuk indikator "paket terlambat", bukan acuan kontraktual. */
export function plannedProgressLinear(startDate?: string | null, endDate?: string | null): number | null {
  if (!startDate || !endDate) return null
  const start = new Date(startDate + 'T00:00:00').getTime()
  const end = new Date(endDate + 'T00:00:00').getTime()
  const now = new Date(new Date().toDateString()).getTime()
  if (end <= start) return null
  if (now <= start) return 0
  if (now >= end) return 100
  return ((now - start) / (end - start)) * 100
}

export async function fetchProjectsAndEmployees() {
  const [projects, employees, vendors] = await Promise.all([
    list('projects', { select: 'id,project_code,project_name,status,branch_id', order: { col: 'project_code', asc: true }, limit: 2000 }),
    list('employees', { select: 'id,full_name', order: { col: 'full_name', asc: true }, limit: 2000 }),
    list('vendors', { select: 'id,name,code,vendor_type', order: { col: 'name', asc: true }, limit: 2000 }),
  ])
  return { projects, employees, vendors }
}
