/**
 * SUMBER KEBENARAN TUNGGAL — nilai status/kategori Operations vs CHECK constraint basis data.
 *
 * LATAR BELAKANG BUG: modul Operations sebelumnya menulis nilai status berbahasa Indonesia
 * ('baru', 'ditugaskan', 'dikerjakan', 'selesai', 'ditutup', 'belum_ditugaskan', 'gagal', 'pause', ...)
 * ke kolom yang CHECK constraint-nya berbahasa Inggris. Setiap INSERT/UPDATE dengan nilai tsb DITOLAK basis data.
 *
 * KEPUTUSAN ARSITEKTUR (jangan diubah tanpa migrasi basis data):
 * Nilai yang DISIMPAN ke basis data TETAP mengikuti CHECK constraint asli (sudah dipakai 350 tiket +
 * 800 work order). Yang menyesuaikan adalah ANTARMUKA: kode menulis/membaca nilai asli constraint,
 * sedangkan yang dilihat pengguna adalah label Bahasa Indonesia dari peta di bawah ini.
 *
 * Nilai-nilai berikut ditarik LANGSUNG dari `pg_get_constraintdef` project idlhsxamdkipnmyvewbp
 * pada 2026-09-16 — JANGAN menebak / menambah nilai baru tanpa mengecek ulang lewat
 * mcp__Supabase__execute_sql. Jangan gunakan tool ini untuk mengubah CHECK constraint.
 */

export type Opt = { value: string; label: string; tone: string }
type ColumnDef = { values: Opt[]; next: Record<string, string[]> }

/** ------------------------------------------------------------------------------------------
 * tickets.status  — CHECK tickets_status_check
 * ('open','assigned','on_progress','pending','resolved','closed','cancelled')
 * Default kolom: 'open'.
 * ---------------------------------------------------------------------------------------- */
const TICKETS_STATUS: ColumnDef = {
  values: [
    { value: 'open', label: 'Terbuka', tone: 'slate' },
    { value: 'assigned', label: 'Ditugaskan', tone: 'blue' },
    { value: 'on_progress', label: 'Dikerjakan', tone: 'blue' },
    { value: 'pending', label: 'Pending (SLA Dijeda)', tone: 'amber' },
    { value: 'resolved', label: 'Selesai', tone: 'emerald' },
    { value: 'closed', label: 'Ditutup', tone: 'zinc' },
    { value: 'cancelled', label: 'Dibatalkan', tone: 'rose' },
  ],
  next: {
    open: ['assigned', 'cancelled'],
    assigned: ['on_progress', 'pending', 'cancelled'],
    on_progress: ['pending', 'resolved', 'cancelled'],
    pending: ['on_progress', 'cancelled'],
    resolved: ['closed'],
    closed: [],
    cancelled: [],
  },
}

/** tickets.severity — CHECK tickets_severity_check ('kritis','tinggi','sedang','rendah') */
const TICKETS_SEVERITY: ColumnDef = {
  values: [
    { value: 'kritis', label: 'Kritis', tone: 'red' },
    { value: 'tinggi', label: 'Tinggi', tone: 'orange' },
    { value: 'sedang', label: 'Sedang', tone: 'amber' },
    { value: 'rendah', label: 'Rendah', tone: 'slate' },
  ],
  next: {},
}

/**
 * tickets.source — CHECK tickets_source_check ('pelanggan','nms','preventive','internal','principal')
 * BUG TAMBAHAN yang ditemukan saat audit ini: nilai lama di UI ('call_center','aplikasi','noc',
 * 'whatsapp','lapangan') SAMA SEKALI tidak ada di constraint ini — insert tiket akan tetap ditolak
 * database walau status sudah diperbaiki. Diperbaiki bersamaan.
 */
const TICKETS_SOURCE: ColumnDef = {
  values: [
    { value: 'pelanggan', label: 'Pelanggan', tone: 'blue' },
    { value: 'nms', label: 'NMS / Monitoring', tone: 'teal' },
    { value: 'preventive', label: 'Preventive (Internal)', tone: 'slate' },
    { value: 'internal', label: 'Internal', tone: 'slate' },
    { value: 'principal', label: 'Principal', tone: 'lavender' },
  ],
  next: {},
}

/**
 * tickets.ticket_type — CHECK tickets_ticket_type_check ('gangguan','keluhan','request','massal')
 * BUG TAMBAHAN sama seperti source — nilai lama tidak ada di constraint. Diperbaiki bersamaan.
 */
const TICKETS_TICKET_TYPE: ColumnDef = {
  values: [
    { value: 'gangguan', label: 'Gangguan', tone: 'red' },
    { value: 'keluhan', label: 'Keluhan', tone: 'amber' },
    { value: 'request', label: 'Permintaan (Request)', tone: 'blue' },
    { value: 'massal', label: 'Gangguan Massal', tone: 'orange' },
  ],
  next: {},
}

/** tickets.sla_status — CHECK tickets_sla_status_check ('on_track','warning','breach','met') */
const TICKETS_SLA_STATUS: ColumnDef = {
  values: [
    { value: 'on_track', label: 'Sesuai Target', tone: 'emerald' },
    { value: 'warning', label: 'Mendekati Tenggat', tone: 'amber' },
    { value: 'breach', label: 'Lewat SLA', tone: 'red' },
    { value: 'met', label: 'Terpenuhi', tone: 'emerald' },
  ],
  next: {},
}

/** ticket_sla_events.event_type — CHECK ticket_sla_events_event_type_check ('start','pause','resume','stop') */
const TICKET_SLA_EVENTS_EVENT_TYPE: ColumnDef = {
  values: [
    { value: 'start', label: 'Mulai', tone: 'blue' },
    { value: 'pause', label: 'Dijeda', tone: 'amber' },
    { value: 'resume', label: 'Dilanjutkan', tone: 'blue' },
    { value: 'stop', label: 'Berhenti', tone: 'zinc' },
  ],
  next: {},
}

/** ------------------------------------------------------------------------------------------
 * work_orders.status — CHECK work_orders_status_check
 * ('draft','dispatched','accepted','on_progress','pending_material','done','failed','cancelled')
 * Default kolom: 'draft'. Trigger 0008_views_functions.sql membentuk productivity_entries saat 'done'.
 * ---------------------------------------------------------------------------------------- */
const WORK_ORDERS_STATUS: ColumnDef = {
  values: [
    { value: 'draft', label: 'Draf', tone: 'slate' },
    { value: 'dispatched', label: 'Ditugaskan', tone: 'blue' },
    { value: 'accepted', label: 'Diterima Teknisi', tone: 'blue' },
    { value: 'on_progress', label: 'Dikerjakan', tone: 'blue' },
    { value: 'pending_material', label: 'Menunggu Material', tone: 'amber' },
    { value: 'done', label: 'Selesai', tone: 'emerald' },
    { value: 'failed', label: 'Gagal', tone: 'red' },
    { value: 'cancelled', label: 'Dibatalkan', tone: 'rose' },
  ],
  next: {
    draft: ['dispatched', 'cancelled'],
    dispatched: ['accepted', 'cancelled'],
    accepted: ['on_progress', 'pending_material', 'cancelled'],
    on_progress: ['pending_material', 'done', 'failed'],
    pending_material: ['on_progress', 'failed', 'cancelled'],
    done: [],
    failed: [],
    cancelled: [],
  },
}

/** work_orders.qc_status — CHECK work_orders_qc_status_check ('belum','lulus','tidak_lulus') */
const WORK_ORDERS_QC_STATUS: ColumnDef = {
  values: [
    { value: 'belum', label: 'Belum QC', tone: 'slate' },
    { value: 'lulus', label: 'Lulus', tone: 'emerald' },
    { value: 'tidak_lulus', label: 'Tidak Lulus', tone: 'red' },
  ],
  next: { belum: ['lulus', 'tidak_lulus'], lulus: [], tidak_lulus: [] },
}

/** work_orders.wo_type — CHECK work_orders_wo_type_check */
const WORK_ORDERS_WO_TYPE: ColumnDef = {
  values: [
    { value: 'PSB', label: 'PSB (Pasang Baru)', tone: 'blue' },
    { value: 'MIGRASI', label: 'Migrasi', tone: 'blue' },
    { value: 'GANGGUAN', label: 'Gangguan', tone: 'red' },
    { value: 'MAINTENANCE', label: 'Maintenance', tone: 'amber' },
    { value: 'DEPLOYMENT', label: 'Deployment', tone: 'teal' },
    { value: 'SURVEY', label: 'Survey', tone: 'slate' },
    { value: 'DISMANTLE', label: 'Dismantle', tone: 'zinc' },
  ],
  next: {},
}

/** ------------------------------------------------------------------------------------------
 * nms_alarms.status — CHECK nms_alarms_status_check ('baru','diakui','tiket_dibuat','clear','diabaikan')
 * Default kolom: 'baru'. (Nilai ini SUDAH konsisten dengan constraint di kode lama — dipertahankan.)
 * ---------------------------------------------------------------------------------------- */
const NMS_ALARMS_STATUS: ColumnDef = {
  values: [
    { value: 'baru', label: 'Baru', tone: 'slate' },
    { value: 'diakui', label: 'Diakui', tone: 'blue' },
    { value: 'tiket_dibuat', label: 'Sudah Jadi Tiket', tone: 'amber' },
    { value: 'clear', label: 'Clear', tone: 'emerald' },
    { value: 'diabaikan', label: 'Diabaikan', tone: 'zinc' },
  ],
  next: {
    baru: ['diakui', 'diabaikan', 'clear'],
    diakui: ['tiket_dibuat', 'diabaikan', 'clear'],
    tiket_dibuat: ['clear'],
    clear: [],
    diabaikan: [],
  },
}

/** nms_alarms.severity — CHECK nms_alarms_severity_check ('critical','major','minor','warning') */
const NMS_ALARMS_SEVERITY: ColumnDef = {
  values: [
    { value: 'critical', label: 'Critical', tone: 'red' },
    { value: 'major', label: 'Major', tone: 'orange' },
    { value: 'minor', label: 'Minor', tone: 'amber' },
    { value: 'warning', label: 'Warning', tone: 'slate' },
  ],
  next: {},
}

/** ------------------------------------------------------------------------------------------
 * maintenance_tasks.status — CHECK maintenance_tasks_status_check ('terjadwal','berjalan','selesai','terlewat')
 * Default kolom: 'terjadwal'. (Sudah konsisten di kode lama — dipertahankan.)
 * ---------------------------------------------------------------------------------------- */
const MAINTENANCE_TASKS_STATUS: ColumnDef = {
  values: [
    { value: 'terjadwal', label: 'Terjadwal', tone: 'amber' },
    { value: 'berjalan', label: 'Berjalan', tone: 'blue' },
    { value: 'selesai', label: 'Selesai', tone: 'emerald' },
    { value: 'terlewat', label: 'Terlewat', tone: 'orange' },
  ],
  next: { terjadwal: ['berjalan', 'terlewat'], berjalan: ['selesai'], selesai: [], terlewat: ['berjalan'] },
}

/** maintenance_plans.frequency — CHECK maintenance_plans_frequency_check */
const MAINTENANCE_PLANS_FREQUENCY: ColumnDef = {
  values: [
    { value: 'harian', label: 'Harian', tone: 'slate' },
    { value: 'mingguan', label: 'Mingguan', tone: 'slate' },
    { value: 'bulanan', label: 'Bulanan', tone: 'slate' },
    { value: 'triwulan', label: 'Triwulan', tone: 'slate' },
    { value: 'semester', label: 'Semester (6 Bulan)', tone: 'slate' },
    { value: 'tahunan', label: 'Tahunan', tone: 'slate' },
  ],
  next: {},
}

/** maintenance_plans.plan_type — CHECK maintenance_plans_plan_type_check */
const MAINTENANCE_PLANS_PLAN_TYPE: ColumnDef = {
  values: [
    { value: 'preventive', label: 'Preventive', tone: 'blue' },
    { value: 'patroli', label: 'Patroli', tone: 'slate' },
    { value: 'pengukuran', label: 'Pengukuran', tone: 'slate' },
    { value: 'perapihan', label: 'Perapihan', tone: 'slate' },
  ],
  next: {},
}

/**
 * network_elements.status — CHECK network_elements_status_check ('aktif','penuh','rusak','nonaktif')
 * BUG TAMBAHAN ditemukan saat audit ini: UI lama pakai 'pemeliharaan' (tidak ada di constraint) dan
 * tidak pernah menawarkan 'penuh'. Diperbaiki bersamaan.
 */
const NETWORK_ELEMENTS_STATUS: ColumnDef = {
  values: [
    { value: 'aktif', label: 'Aktif', tone: 'emerald' },
    { value: 'penuh', label: 'Penuh', tone: 'orange' },
    { value: 'rusak', label: 'Rusak', tone: 'red' },
    { value: 'nonaktif', label: 'Nonaktif', tone: 'slate' },
  ],
  next: {},
}

/** sla_reports.status — CHECK sla_reports_status_check ('draft','diajukan','disetujui','terkirim') */
const SLA_REPORTS_STATUS: ColumnDef = {
  values: [
    { value: 'draft', label: 'Draf', tone: 'slate' },
    { value: 'diajukan', label: 'Diajukan', tone: 'blue' },
    { value: 'disetujui', label: 'Disetujui', tone: 'emerald' },
    { value: 'terkirim', label: 'Terkirim ke Principal', tone: 'teal' },
  ],
  next: { draft: ['diajukan'], diajukan: ['disetujui'], disetujui: ['terkirim'], terkirim: [] },
}

/** root_causes.aspect — CHECK root_causes_aspect_check ('People','Process','Tools','Partnership') */
const ROOT_CAUSES_ASPECT: ColumnDef = {
  values: [
    { value: 'People', label: 'People', tone: 'blue' },
    { value: 'Process', label: 'Process', tone: 'amber' },
    { value: 'Tools', label: 'Tools', tone: 'teal' },
    { value: 'Partnership', label: 'Partnership', tone: 'red' },
  ],
  next: {},
}

const COLUMNS = {
  'tickets.status': TICKETS_STATUS,
  'tickets.severity': TICKETS_SEVERITY,
  'tickets.source': TICKETS_SOURCE,
  'tickets.ticket_type': TICKETS_TICKET_TYPE,
  'tickets.sla_status': TICKETS_SLA_STATUS,
  'ticket_sla_events.event_type': TICKET_SLA_EVENTS_EVENT_TYPE,
  'work_orders.status': WORK_ORDERS_STATUS,
  'work_orders.qc_status': WORK_ORDERS_QC_STATUS,
  'work_orders.wo_type': WORK_ORDERS_WO_TYPE,
  'nms_alarms.status': NMS_ALARMS_STATUS,
  'nms_alarms.severity': NMS_ALARMS_SEVERITY,
  'maintenance_tasks.status': MAINTENANCE_TASKS_STATUS,
  'maintenance_plans.frequency': MAINTENANCE_PLANS_FREQUENCY,
  'maintenance_plans.plan_type': MAINTENANCE_PLANS_PLAN_TYPE,
  'network_elements.status': NETWORK_ELEMENTS_STATUS,
  'sla_reports.status': SLA_REPORTS_STATUS,
  'root_causes.aspect': ROOT_CAUSES_ASPECT,
} as const

export type StatusColumn = keyof typeof COLUMNS

/** Daftar {value,label,tone} untuk sebuah kolom — dipakai mengisi <Select>/Tabs. */
export function optionsOf(kolom: StatusColumn): Opt[] {
  return COLUMNS[kolom]?.values ?? []
}

/** Label Bahasa Indonesia untuk sebuah nilai. Jatuh ke nilai mentah bila tidak dikenal. */
export function labelOf(kolom: StatusColumn, nilai?: string | null): string {
  if (!nilai) return '-'
  return COLUMNS[kolom]?.values.find(v => v.value === nilai)?.label ?? nilai
}

/** Warna (tone) Badge untuk sebuah nilai. */
export function toneOf(kolom: StatusColumn, nilai?: string | null): string {
  if (!nilai) return 'slate'
  return COLUMNS[kolom]?.values.find(v => v.value === nilai)?.tone ?? 'slate'
}

/**
 * Daftar transisi berikutnya yang diizinkan (alur kerja) dari sebuah nilai status.
 * Hanya berarti untuk kolom bertipe alur kerja (status); untuk kolom kategori bebas-pilih
 * (severity, source, ticket_type, wo_type, aspect, dst.) selalu mengembalikan [].
 */
export function transisiDari(kolom: StatusColumn, nilai?: string | null): Opt[] {
  const col = COLUMNS[kolom]
  if (!col || !nilai) return []
  const allowed = col.next[nilai] ?? []
  return allowed.map(v => col.values.find(x => x.value === v)).filter(Boolean) as Opt[]
}

/** Apakah nilai tersebut valid untuk kolom ini (dicocokkan ke CHECK constraint asli). */
export function isValid(kolom: StatusColumn, nilai?: string | null): boolean {
  if (!nilai) return false
  return !!COLUMNS[kolom]?.values.some(v => v.value === nilai)
}

/* ---------------- Alias nilai konstan (hindari salah ketik di halaman) ---------------- */
export const TICKET_STATUS = {
  OPEN: 'open', ASSIGNED: 'assigned', ON_PROGRESS: 'on_progress', PENDING: 'pending',
  RESOLVED: 'resolved', CLOSED: 'closed', CANCELLED: 'cancelled',
} as const
export const WO_STATUS = {
  DRAFT: 'draft', DISPATCHED: 'dispatched', ACCEPTED: 'accepted', ON_PROGRESS: 'on_progress',
  PENDING_MATERIAL: 'pending_material', DONE: 'done', FAILED: 'failed', CANCELLED: 'cancelled',
} as const
export const ALARM_STATUS = {
  BARU: 'baru', DIAKUI: 'diakui', TIKET_DIBUAT: 'tiket_dibuat', CLEAR: 'clear', DIABAIKAN: 'diabaikan',
} as const
export const MAINT_TASK_STATUS = {
  TERJADWAL: 'terjadwal', BERJALAN: 'berjalan', SELESAI: 'selesai', TERLEWAT: 'terlewat',
} as const

/** Status tiket yang masih dianggap "terbuka" (dipakai filter eskalasi, KPI, dsb). */
export const TICKET_STATUS_TERBUKA = ['open', 'assigned', 'on_progress', 'pending']
/** Status WO yang menandakan teknisi masih punya beban kerja berjalan. */
export const WO_STATUS_BERBEBAN = ['dispatched', 'accepted', 'on_progress', 'pending_material']
