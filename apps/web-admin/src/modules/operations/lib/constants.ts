/** Konstanta & referensi statis untuk modul Operations. */
import { chartColors, chartSeries } from '@/lib/theme'
import { optionsOf, labelOf, toneOf } from './status'

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

/**
 * Nilai berikut WAJIB persis sama dengan CHECK constraint tabel `tickets`/`work_orders`
 * (lihat modules/operations/lib/status.ts — sumber kebenaran tunggal, ditarik dari basis data).
 * JANGAN menambah/mengubah value di sini secara langsung; ubah status.ts.
 */
export const TICKET_SOURCES: Opt[] = optionsOf('tickets.source')
export const TICKET_TYPES: Opt[] = optionsOf('tickets.ticket_type')
export const TICKET_STATUSES: Opt[] = optionsOf('tickets.status')
export const ticketStatusLabel = (v?: string) => labelOf('tickets.status', v)
export const ticketStatusTone = (v?: string) => toneOf('tickets.status', v)

export const WO_TYPES: Opt[] = optionsOf('work_orders.wo_type')
export const WO_STATUSES: Opt[] = optionsOf('work_orders.status')
export const woStatusLabel = (v?: string) => labelOf('work_orders.status', v)
export const woStatusTone = (v?: string) => toneOf('work_orders.status', v)

export const ELEMENT_TYPES = ['ODC', 'ODP', 'FAT', 'FDT', 'CLOSURE', 'TIANG', 'KABEL', 'OLT', 'SEGMENT']
export const NETWORK_ELEMENT_STATUSES: Opt[] = optionsOf('network_elements.status')

export const MAINT_TYPES: Opt[] = optionsOf('maintenance_plans.plan_type')
export const MAINT_FREQ: Opt[] = optionsOf('maintenance_plans.frequency')
export const MAINT_TASK_STATUSES: Opt[] = optionsOf('maintenance_tasks.status')
export const maintTaskStatusLabel = (v?: string) => labelOf('maintenance_tasks.status', v)
export const maintTaskStatusTone = (v?: string) => toneOf('maintenance_tasks.status', v)

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
