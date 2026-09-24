/** Opsi & konstanta bersama modul HR/Payroll/Produktivitas. */

/** WAJIB sama dengan CHECK employees.employment_type. */
export const EMPLOYMENT_TYPE_OPTIONS = ['PKWT', 'PKWTT', 'MITRA', 'OUTSOURCE', 'MAGANG']
/** WAJIB sama dengan CHECK employees.status. */
export const EMPLOYEE_STATUS_OPTIONS = ['aktif', 'cuti', 'nonaktif', 'resign']
export const GENDER_OPTIONS = [
  { value: 'L', label: 'Laki-laki' },
  { value: 'P', label: 'Perempuan' },
]
/** WAJIB sama dengan CHECK employees.ptkp_status — K/I/* TIDAK diterima database. */
export const PTKP_OPTIONS = [
  'TK/0', 'TK/1', 'TK/2', 'TK/3',
  'K/0', 'K/1', 'K/2', 'K/3',
]
export const TER_CATEGORY_OPTIONS = ['A', 'B', 'C']

/* ---- Skema karyawan WFP (migrasi 0045) — nilai sesuai CHECK constraint ---- */
/** CHECK employees.kemitraan */
export const KEMITRAAN_OPTIONS = ['TELKOM AKSES', 'MITRA', 'RIFO FIX', 'RIFO VARIABLE']
/** CHECK employees.group_wfp */
export const GROUP_WFP_OPTIONS = ['RKAP', 'MITRA', 'RIFO', 'NFO']
/** CHECK employees.status_teknisi */
export const STATUS_TEKNISI_OPTIONS = ['PERFORMANCE BASED', 'RESOURCE BASED']
/** CHECK employees.status_salary */
export const STATUS_SALARY_OPTIONS = ['FIXED', 'VARIABLE']
/** CHECK employees.payroll_scheme */
export const PAYROLL_SCHEME_OPTIONS = [
  { value: 'fix_salary', label: 'Gaji Tetap' },
  { value: 'freelance', label: 'Freelance / Borongan' },
  { value: 'campuran', label: 'Campuran' },
]
/** employees.level_jabatan tidak punya CHECK — daftar ini hanya SARAN (datalist), bukan pembatas. */
export const LEVEL_JABATAN_SARAN = [
  'GM/VP/PM/PMO', 'Manager', 'Officer 1', 'Officer 2', 'Officer 3',
  'Staff', 'Korlap', 'Teknisi', 'Helpdesk', 'Drafter', 'Surveyor', 'HSA',
]
/** employees.skill (text[]) tidak punya CHECK — daftar ini hanya SARAN. */
export const SKILL_SARAN = [
  'PT1', 'PT2', 'ASSURANCE', 'DESIGN', 'MTC', 'KONFIGURASI',
  'PROVISIONING', 'QE', 'EDITOR', 'ADMINISTRASI', 'AI',
]
/** CHECK employee_positions.status_penugasan */
export const STATUS_PENUGASAN_OPTIONS = ['DEFINITIF', 'PGS', 'POH']
/** CHECK employee_positions.object_id: 17 digit angka, atau MTR-#### */
export const OBJECT_ID_HINT = '17 digit angka (mis. 00000000000123456) atau MTR-1234'
export const objectIdValid = (v?: string | null) =>
  !v || /^[0-9]{17}$/.test(v) || /^MTR-[0-9]{4}$/.test(v)
export const CERT_TYPE_OPTIONS = ['K3', 'Kompetensi Teknis', 'BNSP', 'Vendor/Mitra', 'Lainnya']
/** Nilai WAJIB sama dengan CHECK constraint leave_requests.leave_type. */
export const LEAVE_TYPE_OPTIONS = [
  { value: 'cuti_tahunan', label: 'Cuti Tahunan' },
  { value: 'sakit', label: 'Sakit' },
  { value: 'izin', label: 'Izin' },
  { value: 'melahirkan', label: 'Melahirkan' },
  { value: 'tanpa_keterangan', label: 'Tanpa Keterangan' },
]
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

/** Asal-usul tarif (job_types.tariff_amount, dll). 'asumsi_sistem' = angka karangan sistem,
 *  belum ada dasar kontrak/negosiasi yang diverifikasi. */
export const PRICE_SOURCE_OPTIONS = [
  { value: 'asumsi_sistem', label: 'Asumsi Sistem' },
  { value: 'kontrak', label: 'Kontrak' },
  { value: 'negosiasi', label: 'Negosiasi' },
  { value: 'survei_pasar', label: 'Survei Pasar' },
  { value: 'lainnya', label: 'Lainnya' },
]
export const PRICE_SOURCE_LABEL: Record<string, string> = Object.fromEntries(PRICE_SOURCE_OPTIONS.map(o => [o.value, o.label]))
export const priceSourceTone = (source?: string | null): 'amber' | 'slate' => (!source || source === 'asumsi_sistem' ? 'amber' : 'slate')

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
