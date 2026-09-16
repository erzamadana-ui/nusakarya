/** Opsi & konstanta bersama modul HR/Payroll/Produktivitas. */

export const EMPLOYMENT_TYPE_OPTIONS = ['PKWT', 'PKWTT', 'MITRA', 'HARIAN']
export const EMPLOYEE_STATUS_OPTIONS = ['aktif', 'nonaktif', 'resign']
export const GENDER_OPTIONS = [
  { value: 'L', label: 'Laki-laki' },
  { value: 'P', label: 'Perempuan' },
]
export const PTKP_OPTIONS = [
  'TK/0', 'TK/1', 'TK/2', 'TK/3',
  'K/0', 'K/1', 'K/2', 'K/3',
  'K/I/0', 'K/I/1', 'K/I/2', 'K/I/3',
]
export const TER_CATEGORY_OPTIONS = ['A', 'B', 'C']
export const CERT_TYPE_OPTIONS = ['K3', 'Kompetensi Teknis', 'BNSP', 'Vendor/Mitra', 'Lainnya']
export const LEAVE_TYPE_OPTIONS = ['Tahunan', 'Sakit', 'Melahirkan', 'Menikah', 'Duka', 'Tanpa Gaji', 'Lainnya']
export const LEAVE_STATUS_TABS = [
  { value: 'diajukan', label: 'Diajukan' },
  { value: 'disetujui', label: 'Disetujui' },
  { value: 'ditolak', label: 'Ditolak' },
  { value: 'semua', label: 'Semua' },
]
export const SALARY_COMPONENT_TYPE_OPTIONS = [
  { value: 'earning', label: 'Penambah (Earning)' },
  { value: 'deduction', label: 'Pengurang (Deduction)' },
]
export const SALARY_CALC_TYPE_OPTIONS = [
  { value: 'fixed', label: 'Tetap' },
  { value: 'formula', label: 'Formula Otomatis' },
  { value: 'manual', label: 'Input Manual' },
]
export const PAYROLL_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'dihitung', label: 'Dihitung' },
  { key: 'diverifikasi', label: 'Diverifikasi' },
  { key: 'disetujui', label: 'Disetujui' },
  { key: 'dibayar', label: 'Dibayar' },
  { key: 'closed', label: 'Closed' },
]
/** Kode komponen gaji sistem yang dihitung otomatis oleh mesin payroll — tidak dijumlah dari employee_salaries. */
export const SYSTEM_EARNING_CODES = ['LEMBUR', 'INSENTIF_PROD']
export const SYSTEM_DEDUCTION_CODES = ['POT_PPH21', 'POT_BPJS_KES', 'POT_BPJS_TK']
export const PRODUCTIVITY_ENTRY_STATUS_TABS = [
  { value: 'draft', label: 'Draft' },
  { value: 'diverifikasi', label: 'Diverifikasi' },
]

export const daysUntil = (dateStr?: string | null) => {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

/** Badge kedaluwarsa: hijau >90 hari, kuning 30-90 hari, merah <30 hari / sudah lewat. */
export function expiryTone(dateStr?: string | null): { tone: 'emerald' | 'amber' | 'red'; label: string; days: number | null } {
  const d = daysUntil(dateStr)
  if (d == null) return { tone: 'amber', label: 'Tidak diketahui', days: null }
  if (d < 0) return { tone: 'red', label: `Kedaluwarsa ${Math.abs(d)} hari lalu`, days: d }
  if (d < 30) return { tone: 'red', label: `${d} hari lagi`, days: d }
  if (d <= 90) return { tone: 'amber', label: `${d} hari lagi`, days: d }
  return { tone: 'emerald', label: `${d} hari lagi`, days: d }
}

export const mapsLink = (lat?: number | null, lng?: number | null) =>
  lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null

/** Rentang tanggal awal & akhir bulan dari period_code 'YYYY-MM'. */
export function periodRange(periodCode: string): [string, string] {
  const [y, m] = periodCode.split('-').map(Number)
  const start = `${periodCode}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${periodCode}-${String(lastDay).padStart(2, '0')}`
  return [start, end]
}
