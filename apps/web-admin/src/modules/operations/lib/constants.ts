/** Konstanta & referensi statis untuk modul Operations. */
import { chartColors, chartSeries } from '@/lib/theme'

export type Opt = { value: string; label: string; tone?: string }

/** Tingkat keparahan tiket + SLA default sistem (menit). WAJIB disesuaikan dengan SLA kontrak pelanggan. */
export const SEVERITAS: (Opt & { slaMenit: number })[] = [
  { value: 'kritis', label: 'Kritis', tone: 'red', slaMenit: 240 },
  { value: 'tinggi', label: 'Tinggi', tone: 'orange', slaMenit: 480 },
  { value: 'sedang', label: 'Sedang', tone: 'amber', slaMenit: 1440 },
  { value: 'rendah', label: 'Rendah', tone: 'slate', slaMenit: 2880 },
]
export const slaDefaultMenit = (severity?: string) => SEVERITAS.find(s => s.value === severity)?.slaMenit ?? 1440
export const severityLabel = (v?: string) => SEVERITAS.find(s => s.value === v)?.label ?? (v || '-')
export const severityTone = (v?: string) => SEVERITAS.find(s => s.value === v)?.tone ?? 'slate'
export const SLA_DEFAULT_NOTE =
  'Nilai di atas adalah default sistem berdasarkan tingkat keparahan — WAJIB disesuaikan dengan ketentuan SLA pada kontrak pelanggan sebelum tiket disimpan.'

export const TICKET_SOURCES: Opt[] = [
  { value: 'call_center', label: 'Call Center' },
  { value: 'aplikasi', label: 'Aplikasi Pelanggan' },
  { value: 'noc', label: 'NOC / Monitoring' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'lapangan', label: 'Laporan Lapangan' },
]
export const TICKET_TYPES: Opt[] = [
  { value: 'internet_terputus', label: 'Internet Terputus' },
  { value: 'internet_lambat', label: 'Internet Lambat' },
  { value: 'redaman_tinggi', label: 'Redaman Tinggi' },
  { value: 'perangkat_rusak', label: 'Perangkat Rusak' },
  { value: 'ont_offline', label: 'ONT Offline' },
  { value: 'lainnya', label: 'Lainnya' },
]
export const TICKET_STATUSES: Opt[] = [
  { value: 'baru', label: 'Baru', tone: 'slate' },
  { value: 'ditugaskan', label: 'Ditugaskan', tone: 'blue' },
  { value: 'dikerjakan', label: 'Dikerjakan', tone: 'blue' },
  { value: 'pause', label: 'Pause SLA', tone: 'amber' },
  { value: 'selesai', label: 'Selesai', tone: 'emerald' },
  { value: 'ditutup', label: 'Ditutup', tone: 'zinc' },
]
export const ticketStatusLabel = (v?: string) => TICKET_STATUSES.find(s => s.value === v)?.label ?? (v || '-')
export const ticketStatusTone = (v?: string) => TICKET_STATUSES.find(s => s.value === v)?.tone ?? 'slate'

export const WO_TYPES: Opt[] = [
  { value: 'PSB', label: 'PSB (Pasang Baru)' },
  { value: 'MIGRASI', label: 'Migrasi' },
  { value: 'GANGGUAN', label: 'Gangguan' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'DEPLOYMENT', label: 'Deployment' },
  { value: 'SURVEY', label: 'Survey' },
  { value: 'DISMANTLE', label: 'Dismantle' },
]
export const WO_STATUSES: Opt[] = [
  { value: 'belum_ditugaskan', label: 'Belum Ditugaskan', tone: 'slate' },
  { value: 'ditugaskan', label: 'Ditugaskan', tone: 'blue' },
  { value: 'dikerjakan', label: 'Dikerjakan', tone: 'blue' },
  { value: 'selesai', label: 'Selesai', tone: 'emerald' },
  { value: 'gagal', label: 'Gagal', tone: 'red' },
]
export const woStatusLabel = (v?: string) => WO_STATUSES.find(s => s.value === v)?.label ?? (v || '-')
export const woStatusTone = (v?: string) => WO_STATUSES.find(s => s.value === v)?.tone ?? 'slate'

export const ELEMENT_TYPES = ['ODC', 'ODP', 'FAT', 'FDT', 'CLOSURE', 'TIANG', 'KABEL', 'OLT', 'SEGMENT']

export const MAINT_TYPES: Opt[] = [
  { value: 'preventive', label: 'Preventive' },
  { value: 'patroli', label: 'Patroli' },
  { value: 'pengukuran', label: 'Pengukuran' },
  { value: 'perapihan', label: 'Perapihan' },
]
export const MAINT_FREQ: Opt[] = [
  { value: 'harian', label: 'Harian' },
  { value: 'mingguan', label: 'Mingguan' },
  { value: 'bulanan', label: 'Bulanan' },
  { value: 'triwulan', label: 'Triwulan' },
  { value: 'tahunan', label: 'Tahunan' },
]
export const MAINT_TASK_STATUSES = ['terjadwal', 'berjalan', 'selesai', 'terlewat']

export const ASPEK_RCA: Opt[] = [
  { value: 'People', label: 'People' },
  { value: 'Process', label: 'Process' },
  { value: 'Tools', label: 'Tools' },
  { value: 'Partnership', label: 'Partnership' },
]

export const CHART_COLORS = () => chartSeries()
export const SEVERITY_COLORS = (): Record<string, string> => {
  const c = chartColors()
  return { kritis: c.danger, tinggi: c.warning, sedang: c.accent, rendah: c.neutral }
}
export const ASPECT_COLORS = (): Record<string, string> => {
  const c = chartColors()
  return { People: c.primary, Process: c.accent, Tools: c.primarySoft, Partnership: c.danger }
}
