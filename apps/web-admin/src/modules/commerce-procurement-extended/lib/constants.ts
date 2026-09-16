/** Konstanta modul lanjutan Commerce & Procurement (Pipeline, Komplain, Kontrak Vendor, Retur). */

export const CHART_COLORS = ['#1B8A92', '#F5A524', '#3AA3AA', '#F59E0B', '#64748B', '#E11D48', '#16A34A']

/* ---------------- Pipeline Tender (opportunities) ---------------- */
// Kolom papan pipeline — sesuai CHECK constraint opportunities.stage.
export const PIPELINE_STAGES: { value: string; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'kualifikasi', label: 'Kualifikasi' },
  { value: 'penawaran', label: 'Penawaran' },
  { value: 'negosiasi', label: 'Negosiasi' },
  { value: 'menang', label: 'Menang' },
  { value: 'kalah', label: 'Kalah' },
]
export const PIPELINE_STAGE_LABEL: Record<string, string> = Object.fromEntries(PIPELINE_STAGES.map(s => [s.value, s.label]))
// Urutan maju linier untuk tombol "Maju Tahap" pada kartu (kalah dicapai lewat drawer, wajib isi alasan).
export const PIPELINE_FORWARD_ORDER = ['lead', 'kualifikasi', 'penawaran', 'negosiasi', 'menang']

export const OPPORTUNITY_TYPE_OPTIONS = [
  { value: 'tender', label: 'Tender' },
  { value: 'penunjukan_langsung', label: 'Penunjukan Langsung' },
  { value: 'perpanjangan', label: 'Perpanjangan' },
  { value: 'upsell', label: 'Upsell' },
]
export const OPPORTUNITY_SOURCE_OPTIONS = ['Referensi Internal', 'Tender Terbuka', 'Website', 'Pameran', 'Relasi Pribadi', 'Lainnya']
export const OPPORTUNITY_ACTIVITY_TYPES = ['Meeting Awal', 'Site Visit', 'Presentasi Proposal', 'Follow-up Telepon', 'Kirim Dokumen Penawaran', 'Negosiasi Harga', 'Klarifikasi Teknis', 'Lainnya']

// Opsi jenis kontrak dasar untuk form "Jadikan Kontrak" (duplikat ringkas dari modul Commerce agar modul ini tetap berdiri sendiri).
export const CONTRACT_TYPE_OPTIONS = [
  { value: 'deployment', label: 'Deployment' },
  { value: 'manage_service', label: 'Manage Service' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'borongan', label: 'Borongan' },
  { value: 'unit_price', label: 'Unit Price' },
]

/* ---------------- Komplain & CSAT (customer_complaints) ---------------- */
export const COMPLAINT_STATUS_TABS = [
  { value: 'baru', label: 'Baru' },
  { value: 'proses', label: 'Proses' },
  { value: 'eskalasi', label: 'Eskalasi' },
  { value: 'selesai', label: 'Selesai' },
]
export const COMPLAINT_SEVERITY_OPTIONS = ['rendah', 'sedang', 'tinggi']
export const COMPLAINT_CHANNEL_OPTIONS = ['Telepon', 'Email', 'Aplikasi', 'Datang Langsung', 'WhatsApp', 'Media Sosial']
export const COMPLAINT_CATEGORY_OPTIONS = ['Gangguan Layanan', 'Kualitas Instalasi', 'Billing', 'Sikap Petugas', 'Perangkat Rusak', 'Lainnya']
export const RCA_ASPECTS = ['People', 'Process', 'Tools', 'Partnership']

/* ---------------- Kontrak Rangka Vendor (vendor_contracts) ---------------- */
export const VENDOR_CONTRACT_TYPE_OPTIONS = [
  { value: 'rangka', label: 'Kontrak Rangka' },
  { value: 'blanket_po', label: 'Blanket PO' },
  { value: 'sewa', label: 'Sewa' },
  { value: 'jasa_berkala', label: 'Jasa Berkala' },
]
export const VENDOR_CONTRACT_STATUS_OPTIONS = ['draft', 'aktif', 'berakhir', 'dibatalkan']
export const VC_EXPIRY_WARNING_DAYS = 60
export const VC_CEILING_WARNING_PERCENT = 90

/* ---------------- Retur ke Vendor / RTV (vendor_returns) ---------------- */
export const RTV_STATUS_STEPS = [
  { value: 'draft', label: 'Draft' },
  { value: 'diajukan', label: 'Diajukan' },
  { value: 'disetujui', label: 'Disetujui' },
  { value: 'dikirim', label: 'Dikirim' },
  { value: 'selesai', label: 'Selesai' },
]
export const RTV_STATUS_STEP_VALUES = RTV_STATUS_STEPS.map(s => s.value)
export const RTV_REASON_OPTIONS = ['Cacat produksi / tidak sesuai spesifikasi', 'Barang tidak sesuai spesifikasi teknis', 'Kelebihan kirim', 'Salah kirim item', 'Kerusakan saat pengiriman', 'Lainnya']
