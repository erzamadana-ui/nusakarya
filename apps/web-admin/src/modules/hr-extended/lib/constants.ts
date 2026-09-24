/** Opsi & konstanta bersama modul HR Lanjutan (Lembur, Perjalanan Dinas, Kasbon, Rekrutmen, Kompetensi, Penilaian, Disiplin). */

export const STATUS_TABS_STD = [
  { value: 'diajukan', label: 'Diajukan' },
  { value: 'disetujui', label: 'Disetujui' },
  { value: 'ditolak', label: 'Ditolak' },
  { value: 'semua', label: 'Semua' },
]

/* --------- Lembur --------- */
export const OVERTIME_STATUS_TABS = STATUS_TABS_STD

/* --------- Perjalanan Dinas --------- */
export const TRANSPORT_TYPE_OPTIONS = ['Pesawat', 'Kereta Api', 'Bus', 'Kendaraan Dinas', 'Kendaraan Pribadi', 'Lainnya']
/** Nilai WAJIB sama dengan CHECK constraint trip_expenses.category. */
export const EXPENSE_CATEGORY_OPTIONS = [
  { value: 'transport', label: 'Transportasi' },
  { value: 'penginapan', label: 'Penginapan/Hotel' },
  { value: 'makan', label: 'Uang Makan' },
  { value: 'bbm', label: 'BBM' },
  { value: 'tol', label: 'Tol & Parkir' },
  { value: 'lain', label: 'Lain-lain' },
]
export const TRIP_STEPS = [
  { key: 'diajukan', label: 'Diajukan' },
  { key: 'diverifikasi', label: 'Diverifikasi' },
  { key: 'disetujui', label: 'Disetujui' },
  { key: 'selesai', label: 'Selesai' },
]

/* --------- Kasbon --------- */
export const ADVANCE_STATUS_TABS = [
  { value: 'diajukan', label: 'Diajukan' },
  { value: 'disetujui', label: 'Disetujui' },
  { value: 'dicairkan', label: 'Dicairkan' },
  { value: 'sebagian_lunas', label: 'Sebagian Lunas' },
  { value: 'lunas', label: 'Lunas' },
  { value: 'ditolak', label: 'Ditolak' },
  { value: 'semua', label: 'Semua' },
]
export const DISBURSEMENT_METHOD_OPTIONS = ['Transfer Bank', 'Tunai', 'Lainnya']

/* --------- Rekrutmen --------- */
/** WAJIB sama dengan CHECK job_vacancies.status. */
export const VACANCY_STATUS_OPTIONS = ['draft', 'dibuka', 'ditutup', 'batal']
/** WAJIB sama dengan CHECK job_vacancies.employment_type — 'HARIAN' TIDAK diterima database. */
export const EMPLOYMENT_TYPE_OPTIONS = ['PKWT', 'PKWTT', 'MITRA', 'OUTSOURCE', 'MAGANG']
export const APPLICANT_STAGES = [
  { value: 'baru', label: 'Baru' },
  { value: 'seleksi_berkas', label: 'Seleksi Berkas' },
  { value: 'tes', label: 'Tes' },
  { value: 'wawancara', label: 'Wawancara' },
  { value: 'tawaran', label: 'Tawaran' },
  { value: 'diterima', label: 'Diterima' },
]
export const APPLICANT_SOURCE_OPTIONS = ['Referensi Internal', 'Job Portal', 'LinkedIn', 'Kampus', 'Walk-in', 'Lainnya']

/* --------- Kompetensi & Pelatihan --------- */
export const COMPETENCY_LEVEL_OPTIONS = [
  { value: 'dasar', label: 'Dasar' },
  { value: 'madya', label: 'Madya' },
  { value: 'utama', label: 'Utama' },
]
export const COMPETENCY_LEVEL_TONE: Record<string, string> = { dasar: 'blue', madya: 'amber', utama: 'emerald' }
export const COMPETENCY_CATEGORY_OPTIONS = ['Teknis', 'Manajerial', 'K3', 'Sertifikasi Vendor', 'Lainnya']
/** Nilai WAJIB sama dengan CHECK constraint trainings.training_type. */
export const TRAINING_TYPE_OPTIONS = [
  { value: 'internal', label: 'Internal' },
  { value: 'eksternal', label: 'Eksternal' },
  { value: 'sertifikasi', label: 'Sertifikasi' },
  { value: 'induksi_K3', label: 'Induksi K3' },
]
export const TRAINING_STATUS_OPTIONS = ['rencana', 'berjalan', 'selesai', 'batal']
export const ATTENDANCE_OPTIONS = [
  { value: 'terdaftar', label: 'Terdaftar' },
  { value: 'hadir', label: 'Hadir' },
  { value: 'tidak_hadir', label: 'Tidak Hadir' },
]

/* --------- Penilaian Kinerja --------- */
/** Nilai WAJIB sama dengan CHECK constraint performance_reviews.review_type. */
export const REVIEW_TYPE_OPTIONS = [
  { value: 'bulanan', label: 'Bulanan' },
  { value: 'triwulan', label: 'Triwulan' },
  { value: 'semester', label: 'Semester' },
  { value: 'tahunan', label: 'Tahunan' },
]
export const REVIEW_STATUS_TABS = [
  { value: 'draft', label: 'Draft' },
  { value: 'diajukan', label: 'Diajukan' },
  { value: 'disetujui', label: 'Disetujui' },
  { value: 'disanggah', label: 'Disanggah' },
  { value: 'semua', label: 'Semua' },
]
export const GRADE_ORDER = ['A', 'B', 'C', 'D', 'E']
export const GRADE_TONE: Record<string, string> = { A: 'emerald', B: 'teal', C: 'amber', D: 'orange', E: 'red' }
export function gradeFromScore(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'E'
}

/* --------- Disiplin --------- */
export const ACTION_TYPE_OPTIONS = ['Teguran Lisan', 'Teguran Tertulis (SP1)', 'Surat Peringatan 2 (SP2)', 'Surat Peringatan 3 (SP3)', 'Skorsing', 'Pemutusan Hubungan Kerja (PHK)']
export const VIOLATION_CATEGORY_OPTIONS = ['Kedisiplinan/Kehadiran', 'Kinerja', 'Etika & Perilaku', 'Keamanan & K3', 'Pelanggaran Berat', 'Lainnya']
export const DISCIPLINE_STATUS_OPTIONS = ['aktif', 'berakhir', 'dicabut']

/* --------- Umum --------- */
export const daysUntil = (dateStr?: string | null) => {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}
export const isPast = (dateStr?: string | null) => {
  const d = daysUntil(dateStr)
  return d != null && d < 0
}
export const isThisMonth = (dateStr?: string | null) => {
  if (!dateStr) return false
  const d = new Date(dateStr), now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}
