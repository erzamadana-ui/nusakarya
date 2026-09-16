/** Konstanta & util bersama modul Design & Deployment. */
import { chartSeries } from '@/lib/theme'

export const PROJECT_TYPES = [
  { value: 'deployment', label: 'Deployment' },
  { value: 'relokasi', label: 'Relokasi' },
  { value: 'upgrade', label: 'Upgrade' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'manage_service', label: 'Manage Service' },
]
export const PROJECT_STATUS = [
  { value: 'perencanaan', label: 'Perencanaan' },
  { value: 'survey', label: 'Survey' },
  { value: 'design', label: 'Design' },
  { value: 'approval', label: 'Approval' },
  { value: 'pelaksanaan', label: 'Pelaksanaan' },
  { value: 'testing', label: 'Testing' },
  { value: 'bast', label: 'BAST' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'hold', label: 'Hold' },
  { value: 'batal', label: 'Batal' },
]
export const PROJECT_STATUS_ACTIVE = ['perencanaan', 'survey', 'design', 'approval', 'pelaksanaan', 'testing', 'bast']

export const MILESTONE_STATUS = [
  { value: 'belum_mulai', label: 'Belum Mulai' },
  { value: 'berjalan', label: 'Berjalan' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'terlambat', label: 'Terlambat' },
]

export const FEASIBILITY = [
  { value: 'layak', label: 'Layak' },
  { value: 'layak_bersyarat', label: 'Layak Bersyarat' },
  { value: 'tidak_layak', label: 'Tidak Layak' },
]

export const DRM_STATUS = ['draft', 'selesai']

export const BOQ_TYPES = [
  { value: 'plan', label: 'Rencana' },
  { value: 'revisi', label: 'Revisi' },
  { value: 'actual', label: 'Realisasi' },
]

export const QC_TYPES = [
  { value: 'OTDR', label: 'OTDR (Redaman)' },
  { value: 'OPM', label: 'OPM (Daya Terima)' },
  { value: 'VISUAL', label: 'Visual' },
  { value: 'SPLICING', label: 'Splicing (Redaman Sambungan)' },
  { value: 'INSTALASI', label: 'Instalasi' },
]
export const QC_RESULT = [
  { value: 'lulus', label: 'Lulus' },
  { value: 'tidak_lulus', label: 'Tidak Lulus' },
  { value: 'perbaikan', label: 'Perbaikan' },
]
/** Arah perbandingan nilai terukur vs ambang batas per jenis QC.
 *  'max' = nilai terukur harus <= ambang (redaman/loss, makin kecil makin baik)
 *  'min' = nilai terukur harus >= ambang (daya terima, makin besar makin baik)
 *  null  = tidak ada aturan baku, keputusan manual inspektor */
export const QC_DIRECTION: Record<string, 'max' | 'min' | null> = {
  OTDR: 'max', SPLICING: 'max', OPM: 'min', VISUAL: null, INSTALASI: null,
}
export function qcSuggestedResult(qcType: string, measured?: number | null, threshold?: number | null): string | null {
  if (measured == null || threshold == null || measured === ('' as any) || threshold === ('' as any)) return null
  const dir = QC_DIRECTION[qcType]
  if (!dir) return null
  const m = Number(measured), t = Number(threshold)
  if (isNaN(m) || isNaN(t)) return null
  return dir === 'max' ? (m <= t ? 'lulus' : 'tidak_lulus') : (m >= t ? 'lulus' : 'tidak_lulus')
}

export const DOC_TYPES = [
  { value: 'ABD', label: 'ABD (As Built Drawing)' },
  { value: 'SHOPDRAWING', label: 'Shop Drawing' },
  { value: 'QC', label: 'Laporan QC' },
  { value: 'OTDR', label: 'Hasil OTDR' },
  { value: 'IZIN', label: 'Izin' },
  { value: 'KONTRAK', label: 'Kontrak' },
  { value: 'BAST', label: 'BAST' },
  { value: 'FOTO', label: 'Foto' },
  { value: 'LAINNYA', label: 'Lainnya' },
]
export const DOC_STATUS = [
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'Review' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'obsolete', label: 'Usang' },
]

export const RFS_STATUS = ['draft', 'diajukan', 'disetujui', 'ditolak']
export const RFS_STEPS = ['Draft', 'Diajukan', 'Disetujui']
export function rfsStepIndex(status: string) {
  const m: Record<string, number> = { draft: 0, diajukan: 1, disetujui: 2, ditolak: 1 }
  return m[status] ?? 0
}

export const CHART_COLORS = () => chartSeries()

export function projectLabel(p: any) {
  if (!p) return '-'
  return `${p.project_code ?? ''} — ${p.project_name ?? ''}`
}
export function deviationTone(dev?: number | null) {
  if (dev == null) return ''
  return dev < 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'
}
