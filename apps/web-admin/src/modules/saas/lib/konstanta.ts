import { ROLE_LABEL } from '@/lib/auth'

/** Status INTI per entitas (dari CHECK constraint basis data). Tenant hanya memberi label/urutan/penyembunyian. */
export const STATUS_INTI: Record<string, { label: string; kode: string[] }> = {
  work_orders: { label: 'Work Order', kode: ['draft', 'dispatched', 'accepted', 'on_progress', 'pending_material', 'done', 'failed', 'cancelled'] },
  tickets: { label: 'Tiket Gangguan', kode: ['open', 'assigned', 'on_progress', 'pending', 'resolved', 'closed', 'cancelled'] },
  projects: { label: 'Proyek', kode: ['perencanaan', 'survey', 'design', 'approval', 'pelaksanaan', 'testing', 'bast', 'selesai', 'hold', 'batal'] },
  ar_invoices: { label: 'Invoice Pelanggan', kode: ['draft', 'diajukan', 'terkirim', 'dibayar_sebagian', 'lunas', 'overdue', 'batal'] },
  contracts: { label: 'Kontrak', kode: ['draft', 'aktif', 'selesai', 'putus', 'expired'] },
  _role: { label: 'Nama Jabatan', kode: Object.keys(ROLE_LABEL) },
}

export const ENTITAS_FIELD: { value: string; label: string; halaman: string }[] = [
  { value: 'work_orders', label: 'Work Order', halaman: '/ops/work-order' },
  { value: 'employees', label: 'Karyawan & Teknisi', halaman: '/hr/karyawan' },
  { value: 'customers', label: 'Pelanggan', halaman: '/commerce/pelanggan' },
  { value: 'vendors', label: 'Vendor', halaman: '/procurement/vendor' },
  { value: 'contracts', label: 'Kontrak', halaman: '/commerce/kontrak' },
  { value: 'tickets', label: 'Tiket Gangguan', halaman: '/ops/tiket' },
  { value: 'projects', label: 'Proyek', halaman: '/deploy/proyek' },
  { value: 'item_catalog', label: 'Katalog Item', halaman: '/procurement/katalog' },
  { value: 'network_elements', label: 'Aset Jaringan', halaman: '/ops/aset-jaringan' },
  { value: 'assets', label: 'Aset', halaman: '/aset/daftar' },
]

export const TIPE_FIELD = [
  { value: 'teks', label: 'Teks singkat' }, { value: 'teks_panjang', label: 'Teks panjang' },
  { value: 'angka', label: 'Angka' }, { value: 'tanggal', label: 'Tanggal' },
  { value: 'pilihan', label: 'Pilihan (dropdown)' }, { value: 'ya_tidak', label: 'Ya / Tidak' },
]

export const WARNA_STATUS = ['slate', 'blue', 'teal', 'green', 'amber', 'orange', 'red', 'purple']

export const FITUR_LABEL: Record<string, string> = {
  impor_data: 'Impor data CSV/Excel mandiri', ekspor_data: 'Ekspor & cadangan data', audit_trail: 'Jejak audit',
  data_contoh: 'Mode data contoh', custom_field: 'Field kustom', status_kustom: 'Label status kustom',
  sla_kustom: 'SLA tiket kustom', aturan_persetujuan: 'Aturan persetujuan berjenjang', tabel_kustom: 'Tabel kustom',
  transisi_status: 'Alur transisi status', api_integrasi: 'API & integrasi (roadmap)', sso: 'SSO (roadmap)',
  multi_entitas: 'Multi-entitas (roadmap)', white_glove: 'Tim NUSAKARYA ikut mengoperasikan',
}

export const MODUL_LABEL: Record<string, string> = {
  CORE: 'Core & Administrasi', DASHBOARD: 'Dashboard', HR: 'Human Resource', PAYROLL: 'Payroll',
  PRODUCTIVITY: 'Produktivitas Teknisi', PROCUREMENT: 'Procurement', COMMERCE: 'Commerce', FINANCE: 'Finance',
  INVENTORY: 'Inventory', ASSET: 'Aset', OPERATIONS: 'Operations', DEPLOYMENT: 'Deployment', EXECUTIVE: 'Eksekutif',
}

export const STATUS_LANGGANAN: Record<string, { label: string; tone: string }> = {
  trial: { label: 'Uji coba', tone: 'blue' }, active: { label: 'Aktif', tone: 'emerald' },
  past_due: { label: 'Menunggak', tone: 'amber' }, suspended: { label: 'Ditangguhkan', tone: 'red' },
  cancelled: { label: 'Berhenti', tone: 'slate' }, trial_berakhir: { label: 'Uji coba berakhir', tone: 'red' },
  legacy: { label: 'Tanpa paket', tone: 'slate' },
}

export const rupiah = (n: number | null | undefined) =>
  n == null ? '-' : 'Rp ' + Number(n).toLocaleString('id-ID', { maximumFractionDigits: 0 })

export const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'f_$1').slice(0, 40) || 'field'

export const APP_URL = 'https://erzamadana-ui.github.io/nusakarya/'
