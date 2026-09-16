/** Konstanta & referensi statis untuk modul MORNING (Provisioning) & BMON (Assurance). */

export type Opt = { value: string; label: string }

/** Jenis order kerja (work_orders.wo_type) — label tampilan Bahasa Indonesia. */
export const WO_TYPE_LABELS: Record<string, string> = {
  PSB: 'PSB (Pasang Baru)',
  MIGRASI: 'Migrasi',
  GANGGUAN: 'Gangguan',
  MAINTENANCE: 'Maintenance',
  SURVEY: 'Survey',
  DEPLOYMENT: 'Deployment',
  DISMANTLE: 'Dismantle',
}
export const woTypeLabel = (v?: string) => (v ? WO_TYPE_LABELS[v] ?? v : '-')

/** Status order (work_orders.status) yang dianggap SELESAI (PS) / GAGAL (Workfail & Canceled). */
export const WO_DONE_STATUS = 'done'
export const WO_FAIL_STATUSES = ['failed', 'cancelled']
export const isWoDone = (s?: string) => s === WO_DONE_STATUS
export const isWoFail = (s?: string) => !!s && WO_FAIL_STATUSES.includes(s)
export const isWoRunning = (s?: string) => !!s && !isWoDone(s) && !isWoFail(s)

/** Tingkat keparahan tiket (tickets.severity). */
export const SEVERITY_OPTIONS: Opt[] = [
  { value: 'kritis', label: 'Kritis' },
  { value: 'tinggi', label: 'Tinggi' },
  { value: 'sedang', label: 'Sedang' },
  { value: 'rendah', label: 'Rendah' },
]
export const SEVERITY_TONE: Record<string, string> = { kritis: 'red', tinggi: 'orange', sedang: 'amber', rendah: 'slate' }
export const severityLabel = (v?: string) => SEVERITY_OPTIONS.find(s => s.value === v)?.label ?? (v || '-')
export const severityTone = (v?: string) => SEVERITY_TONE[v ?? ''] ?? 'slate'

/** Status tiket (tickets.status). */
export const TICKET_STATUS_OPTIONS: Opt[] = [
  { value: 'open', label: 'Baru / Terbuka' },
  { value: 'assigned', label: 'Ditugaskan' },
  { value: 'on_progress', label: 'Dikerjakan' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Selesai (Teknis)' },
  { value: 'closed', label: 'Ditutup' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

/** Aspek RCA 4-aspek. */
export const ASPEK_RCA = ['People', 'Process', 'Tools', 'Partnership']

/** Ambang kepatuhan SLA papan saldo — DEFAULT SISTEM, silakan sesuaikan dengan ketentuan kontrak. */
export const AMBANG_KEPATUHAN_KUNING = 90
export const AMBANG_KEPATUHAN_MERAH = 80

/** Status alarm NMS yang dianggap "belum ditangani". */
export const ALARM_UNHANDLED_STATUS = 'baru'
