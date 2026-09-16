/** Konstanta & referensi statis untuk modul Operations (perluasan: Alarm, SLA, Eskalasi, Pengetahuan). */
import { chartSeries } from '@/lib/theme'

export type Opt = { value: string; label: string; tone?: string }

/* ---------------- Alarm NMS ---------------- */
export const ALARM_SEVERITIES: Opt[] = [
  { value: 'critical', label: 'Critical', tone: 'red' },
  { value: 'major', label: 'Major', tone: 'orange' },
  { value: 'minor', label: 'Minor', tone: 'amber' },
  { value: 'warning', label: 'Warning', tone: 'slate' },
]
export const alarmSeverityLabel = (v?: string) => ALARM_SEVERITIES.find(s => s.value === v)?.label ?? (v || '-')
export const alarmSeverityTone = (v?: string) => ALARM_SEVERITIES.find(s => s.value === v)?.tone ?? 'slate'

export const ALARM_STATUSES: Opt[] = [
  { value: 'baru', label: 'Baru', tone: 'slate' },
  { value: 'diakui', label: 'Diakui', tone: 'blue' },
  { value: 'tiket_dibuat', label: 'Sudah Jadi Tiket', tone: 'amber' },
  { value: 'clear', label: 'Clear', tone: 'emerald' },
  { value: 'diabaikan', label: 'Diabaikan', tone: 'zinc' },
]
export const alarmStatusLabel = (v?: string) => ALARM_STATUSES.find(s => s.value === v)?.label ?? (v || '-')
export const alarmStatusTone = (v?: string) => ALARM_STATUSES.find(s => s.value === v)?.tone ?? 'slate'

/** Pemetaan keparahan alarm NMS → keparahan tiket gangguan, dipakai saat membuat tiket dari alarm. */
export const ALARM_TO_TICKET_SEVERITY: Record<string, string> = {
  critical: 'kritis', major: 'tinggi', minor: 'sedang', warning: 'rendah',
}

/* ---------------- Tiket (nilai domain aktual sesuai basis data) ---------------- */
export const TICKET_SEVERITIES: Opt[] = [
  { value: 'kritis', label: 'Kritis', tone: 'red' },
  { value: 'tinggi', label: 'Tinggi', tone: 'orange' },
  { value: 'sedang', label: 'Sedang', tone: 'amber' },
  { value: 'rendah', label: 'Rendah', tone: 'slate' },
]
export const ticketSeverityLabel = (v?: string) => TICKET_SEVERITIES.find(s => s.value === v)?.label ?? (v || '-')
export const ticketSeverityTone = (v?: string) => TICKET_SEVERITIES.find(s => s.value === v)?.tone ?? 'slate'

export const TICKET_STATUS_TERBUKA = ['open', 'assigned', 'on_progress', 'pending']
export const TICKET_STATUSES: Opt[] = [
  { value: 'open', label: 'Terbuka', tone: 'slate' },
  { value: 'assigned', label: 'Ditugaskan', tone: 'blue' },
  { value: 'on_progress', label: 'Dikerjakan', tone: 'blue' },
  { value: 'pending', label: 'Pending', tone: 'amber' },
  { value: 'resolved', label: 'Selesai', tone: 'emerald' },
  { value: 'closed', label: 'Ditutup', tone: 'zinc' },
  { value: 'cancelled', label: 'Dibatalkan', tone: 'zinc' },
]
export const ticketStatusLabel = (v?: string) => TICKET_STATUSES.find(s => s.value === v)?.label ?? (v || '-')

/* ---------------- Laporan SLA Pelanggan ---------------- */
export const SLA_REPORT_STATUSES: Opt[] = [
  { value: 'draft', label: 'Draf', tone: 'slate' },
  { value: 'diajukan', label: 'Diajukan', tone: 'blue' },
  { value: 'disetujui', label: 'Disetujui', tone: 'emerald' },
  { value: 'terkirim', label: 'Terkirim ke Principal', tone: 'teal' },
]
export const slaReportStatusLabel = (v?: string) => SLA_REPORT_STATUSES.find(s => s.value === v)?.label ?? (v || '-')
export const slaReportStatusTone = (v?: string) => SLA_REPORT_STATUSES.find(s => s.value === v)?.tone ?? 'slate'

/* ---------------- Matriks Eskalasi ---------------- */
export const ESKALASI_SEVERITY_ORDER = ['kritis', 'tinggi', 'sedang', 'rendah']

/* ---------------- Basis Pengetahuan ---------------- */
export const KA_KATEGORI_DEFAULT: Opt[] = [
  { value: 'jaringan_fo', label: 'Jaringan Fiber Optik' },
  { value: 'perangkat_ont', label: 'Perangkat ONT/CPE' },
  { value: 'catuan_daya', label: 'Catuan Daya' },
  { value: 'konfigurasi', label: 'Konfigurasi & Provisioning' },
  { value: 'lainnya', label: 'Lainnya' },
]

export const CHART_COLORS = () => chartSeries()
