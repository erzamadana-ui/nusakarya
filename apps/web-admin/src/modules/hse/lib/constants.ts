/** Konstanta & referensi statis untuk modul K3 / HSE. */
import { chartColors, chartSeries } from '@/lib/theme'

export type Opt = { value: string; label: string; tone?: string }

/* ---------------- Insiden ---------------- */
export const INCIDENT_TYPES: (Opt & { rank: number })[] = [
  { value: 'nearmiss', label: 'Nearmiss (Hampir Celaka)', tone: 'blue', rank: 0 },
  { value: 'ringan', label: 'Cedera Ringan', tone: 'amber', rank: 1 },
  { value: 'sedang', label: 'Cedera Sedang', tone: 'orange', rank: 2 },
  { value: 'berat', label: 'Cedera Berat', tone: 'red', rank: 3 },
  { value: 'fatal', label: 'Fatal', tone: 'red', rank: 4 },
]
export const incidentTypeLabel = (v?: string) => INCIDENT_TYPES.find(t => t.value === v)?.label ?? (v || '-')
export const incidentTypeTone = (v?: string) => INCIDENT_TYPES.find(t => t.value === v)?.tone ?? 'slate'
/** Insiden berat/fatal — pemicu reset papan "Hari Tanpa Insiden" dan basis eskalasi kontrak. */
export const isMajorIncident = (v?: string) => v === 'berat' || v === 'fatal'
/** Dihitung sebagai insiden kecelakaan kerja (bukan nearmiss) untuk rasio per juta jam kerja. */
export const isInjuryIncident = (v?: string) => v === 'ringan' || v === 'sedang' || v === 'berat' || v === 'fatal'

export const INCIDENT_STATUSES: Opt[] = [
  { value: 'dilaporkan', label: 'Dilaporkan', tone: 'slate' },
  { value: 'investigasi', label: 'Investigasi', tone: 'amber' },
  { value: 'selesai', label: 'Selesai', tone: 'emerald' },
]
export const incidentStatusLabel = (v?: string) => INCIDENT_STATUSES.find(s => s.value === v)?.label ?? (v || '-')
export const incidentStatusTone = (v?: string) => INCIDENT_STATUSES.find(s => s.value === v)?.tone ?? 'slate'
export const incidentStatusIndex = (v?: string) => Math.max(0, INCIDENT_STATUSES.findIndex(s => s.value === v))

export const ASPEK_RCA: Opt[] = [
  { value: 'People', label: 'People' },
  { value: 'Process', label: 'Process' },
  { value: 'Tools', label: 'Tools' },
  { value: 'Partnership', label: 'Partnership' },
]
export const ASPECT_COLORS = (): Record<string, string> => {
  const c = chartColors()
  return { People: c.primary, Process: c.accent, Tools: c.primarySoft, Partnership: c.danger }
}

/* ---------------- Inspeksi ---------------- */
export const INSPECTION_TYPES: Opt[] = [
  { value: 'APD', label: 'APD (Alat Pelindung Diri)' },
  { value: 'kendaraan', label: 'Kendaraan' },
  { value: 'alat', label: 'Alat Kerja' },
  { value: 'lokasi_kerja', label: 'Lokasi Kerja' },
  { value: 'ketinggian', label: 'Kerja di Ketinggian' },
]
export const inspectionTypeLabel = (v?: string) => INSPECTION_TYPES.find(t => t.value === v)?.label ?? (v || '-')

/** Template butir checklist per jenis inspeksi — dipakai mengisi kolom jsonb `findings`. */
export const CHECKLIST_TEMPLATES: Record<string, string[]> = {
  APD: ['Helm Pelindung (Safety Helmet)', 'Sabuk Pengaman / Body Harness', 'Sarung Tangan Kerja', 'Sepatu Safety (Safety Shoes)', 'Rompi Reflektif'],
  kendaraan: ['Kondisi Ban & Tekanan Angin', 'Fungsi Rem', 'Lampu Utama & Lampu Sein', 'Surat (STNK) & Pajak Kendaraan Berlaku', 'APAR Tersedia di Kendaraan'],
  alat: ['Kalibrasi Alat Ukur Masih Berlaku', 'Kondisi Kabel & Konektor', 'Fungsi Tombol Pengaman (Safety Switch)', 'Casing/Body Tidak Retak', 'Tersedia Label/Manual Penggunaan'],
  lokasi_kerja: ['Rambu K3 Terpasang', 'Barikade/Pagar Pengaman Area', 'Kebersihan & Kerapian Area Kerja', 'Akses Jalur Evakuasi Bebas Hambatan', 'Penerangan Area Memadai'],
  ketinggian: ['Kondisi Tangga Layak Pakai', 'Titik Jangkar (Anchor Point) Kuat', 'Cuaca Layak untuk Bekerja', 'Ada Pengawas di Bawah', 'Body Harness Terpasang & Terkait'],
}

export const INSPECTION_RESULT_THRESHOLD = { aman: 90, perluPerbaikan: 70 }
export const INSPECTION_RESULT_NOTE = 'Ambang penilaian: skor ≥ 90% = Aman, 70–89% = Perlu Perbaikan, di bawah 70% = Tidak Aman. Skor dihitung otomatis dari proporsi butir checklist yang lulus.'
export const INSPECTION_RESULTS: Opt[] = [
  { value: 'aman', label: 'Aman', tone: 'emerald' },
  { value: 'perlu_perbaikan', label: 'Perlu Perbaikan', tone: 'amber' },
  { value: 'tidak_aman', label: 'Tidak Aman', tone: 'red' },
]
export const inspectionResultLabel = (v?: string) => INSPECTION_RESULTS.find(r => r.value === v)?.label ?? (v || '-')
export const inspectionResultTone = (v?: string) => INSPECTION_RESULTS.find(r => r.value === v)?.tone ?? 'slate'

export type ChecklistItem = { item: string; pass: boolean; note?: string }
export function computeInspectionResult(items: ChecklistItem[]): { score: number; result: 'aman' | 'perlu_perbaikan' | 'tidak_aman' } {
  if (!items.length) return { score: 0, result: 'tidak_aman' }
  const lulus = items.filter(i => i.pass).length
  const score = Math.round((lulus / items.length) * 1000) / 10
  const result = score >= INSPECTION_RESULT_THRESHOLD.aman ? 'aman' : score >= INSPECTION_RESULT_THRESHOLD.perluPerbaikan ? 'perlu_perbaikan' : 'tidak_aman'
  return { score, result }
}

/* ---------------- Izin Kerja (Work Permit) ---------------- */
export const PERMIT_TYPES: Opt[] = [
  { value: 'kerja_ketinggian', label: 'Kerja di Ketinggian' },
  { value: 'galian', label: 'Galian' },
  { value: 'listrik', label: 'Kerja Listrik' },
  { value: 'ruang_terbatas', label: 'Ruang Terbatas (Confined Space)' },
  { value: 'panas', label: 'Kerja Panas (Hot Work)' },
]
export const permitTypeLabel = (v?: string) => PERMIT_TYPES.find(t => t.value === v)?.label ?? (v || '-')

/** Butir checklist keselamatan WAJIB per jenis izin — seluruhnya harus dicentang sebelum izin dapat disetujui. */
export const PERMIT_SAFETY_CHECKLISTS: Record<string, string[]> = {
  kerja_ketinggian: ['Body harness & lanyard diperiksa dan layak pakai', 'Titik jangkar (anchor point) teruji memadai', 'Cuaca layak (tidak hujan / angin kencang)', 'Pengawas ditugaskan berjaga di bawah', 'Area di bawah dipasang barikade & rambu'],
  galian: ['Jalur utilitas bawah tanah (kabel/pipa) dikonfirmasi aman', 'Dinding galian ditopang / kemiringan sudut aman', 'Barikade & rambu galian terpasang', 'Jalur evakuasi tersedia', 'APD standar galian digunakan'],
  listrik: ['Sumber listrik dipastikan padam / LOTO (Lock Out Tag Out) terpasang', 'Alat uji tegangan (tester) tersedia & berfungsi', 'APD isolasi listrik digunakan', 'Area kerja bebas genangan air', 'Petugas kompeten K3 listrik hadir'],
  ruang_terbatas: ['Uji kualitas udara (gas test) telah dilakukan', 'Ventilasi memadai tersedia', 'Petugas standby di luar (attendant) ditugaskan', 'Alat komunikasi tersedia & berfungsi', 'Rencana evakuasi darurat disiapkan'],
  panas: ['Area bebas dari material mudah terbakar', 'APAR tersedia di lokasi kerja', 'Izin kerja panas terpasang di area', 'Pengawas kebakaran (fire watch) ditugaskan', 'Tabir/pelindung percikan api digunakan'],
}

export const PERMIT_STATUSES: Opt[] = [
  { value: 'diajukan', label: 'Diajukan', tone: 'blue' },
  { value: 'disetujui', label: 'Disetujui', tone: 'amber' },
  { value: 'aktif', label: 'Aktif', tone: 'emerald' },
  { value: 'ditutup', label: 'Ditutup', tone: 'zinc' },
  { value: 'ditolak', label: 'Ditolak', tone: 'red' },
]
export const permitStatusLabel = (v?: string) => PERMIT_STATUSES.find(s => s.value === v)?.label ?? (v || '-')
export const permitStatusTone = (v?: string) => PERMIT_STATUSES.find(s => s.value === v)?.tone ?? 'slate'

/* ---------------- Umum ---------------- */
export const CHART_COLORS = () => chartSeries()
export const INCIDENT_TYPE_COLORS = (): Record<string, string> => {
  const c = chartColors()
  return { nearmiss: c.primarySoft, ringan: c.accent, sedang: c.warning, berat: c.danger, fatal: c.danger }
}
export const RESULT_COLORS = (): Record<string, string> => {
  const c = chartColors()
  return { aman: c.success, perlu_perbaikan: c.warning, tidak_aman: c.danger }
}

/** Asumsi jam kerja per karyawan aktif per bulan (40 jam/minggu × ~4,33 minggu) — dipakai untuk memperkirakan rasio insiden per juta jam kerja. WAJIB disesuaikan bila kebijakan jam kerja perusahaan berbeda. */
export const ASSUMED_MONTHLY_WORK_HOURS = 173
