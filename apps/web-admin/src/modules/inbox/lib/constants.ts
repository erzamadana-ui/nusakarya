/** Label & tone untuk Inbox Kerja (tabel inbox_tugas / view v_inbox_kerja, migrasi 0046). */

/** Modul yang diisi oleh generator fn_bangun_inbox_kerja(). Dipakai untuk:
 *  (a) daftar pilihan filter modul, (b) penilaian siapa yang boleh menekan
 *  tombol "Segarkan Daftar Tugas" (cukup punya hak tulis di salah satunya). */
export const MODUL_INBOX = [
  'HR', 'PRODUCTIVITY', 'OPERATIONS', 'DEPLOYMENT', 'PROCUREMENT', 'FINANCE', 'INVENTORY',
] as const

export const MODUL_LABEL: Record<string, string> = {
  CORE: 'Core & Administrasi',
  HR: 'Human Resource',
  PAYROLL: 'Payroll',
  PRODUCTIVITY: 'Produktivitas',
  PROCUREMENT: 'Procurement',
  COMMERCE: 'Commerce',
  FINANCE: 'Finance',
  INVENTORY: 'Inventory',
  ASSET: 'Aset',
  OPERATIONS: 'Operations',
  DEPLOYMENT: 'Deployment',
  DASHBOARD: 'Dashboard',
  EXECUTIVE: 'Eksekutif',
}
export const modulLabel = (k?: string | null) => (k ? MODUL_LABEL[k] ?? k : '-')

/** 14 nilai `jenis` yang diizinkan constraint inbox_tugas_jenis_chk. */
export const JENIS_LABEL: Record<string, string> = {
  data_karyawan_belum_lengkap: 'Data karyawan belum lengkap',
  wo_tanpa_jenis_pekerjaan: 'Work Order tanpa jenis pekerjaan',
  tiket_lewat_sla: 'Tiket lewat SLA',
  insiden_tanpa_rca: 'Insiden tanpa RCA',
  proyek_tanpa_kontrak: 'Proyek tanpa kontrak',
  bast_tanpa_proyek: 'BAST tanpa proyek',
  pr_menunggu_po: 'PR menunggu PO',
  invoice_selisih_3way: 'Invoice selisih 3-way',
  ar_jatuh_tempo_belum_lunas: 'Piutang jatuh tempo belum lunas',
  pembayaran_tanpa_arus_kas: 'Pembayaran tanpa catatan arus kas',
  stok_negatif: 'Saldo stok negatif',
  opname_belum_dikoreksi: 'Stock opname belum dikoreksi',
  tarif_belum_terverifikasi: 'Tarif pajak belum diverifikasi',
  tugas_manual: 'Tugas manual',
}
export const jenisLabel = (k?: string | null) => (k ? JENIS_LABEL[k] ?? k.replace(/_/g, ' ') : '-')

export const PRIORITAS_LABEL: Record<string, string> = { tinggi: 'Tinggi', sedang: 'Sedang', rendah: 'Rendah' }
export const prioritasLabel = (k?: string | null) => (k ? PRIORITAS_LABEL[k] ?? k : '-')
/** tone mengikuti peta TONE pada components/ui. */
export const prioritasTone = (k?: string | null) =>
  k === 'tinggi' ? 'red' : k === 'sedang' ? 'amber' : 'slate'

export const STATUS_LABEL: Record<string, string> = {
  terbuka: 'Terbuka', dikerjakan: 'Dikerjakan', selesai: 'Selesai', batal: 'Batal',
}
export const statusLabel = (k?: string | null) => (k ? STATUS_LABEL[k] ?? k : '-')
export const statusTone = (k?: string | null) =>
  k === 'selesai' ? 'emerald' : k === 'dikerjakan' ? 'blue' : k === 'batal' ? 'zinc' : 'slate'

/** Status yang masih menuntut pekerjaan. */
export const STATUS_AKTIF = ['terbuka', 'dikerjakan']

export const KETERLAMBATAN_TONE: Record<string, string> = {
  aman: 'emerald', segera: 'amber', terlambat: 'red',
}
/** Teks badge keterlambatan. `hari` = kolom hari_terlambat (positif = sudah lewat tenggat). */
export function keterlambatanLabel(keterlambatan?: string | null, hari?: number | null): string {
  if (keterlambatan === 'terlambat') return `Terlambat ${Math.max(1, Number(hari ?? 0))} hari`
  if (keterlambatan === 'segera') {
    const sisa = hari == null ? null : -Number(hari)
    if (sisa == null) return 'Segera'
    return sisa <= 0 ? 'Jatuh tempo hari ini' : `Segera — ${sisa} hari lagi`
  }
  return 'Aman'
}

/** Pesan tolak berbahasa Indonesia untuk errcode 42501 dari RPC/RLS. */
export const PESAN_TOLAK: Record<string, string> = {
  selesai: 'Anda tidak berwenang menyelesaikan tugas ini',
  dikerjakan: 'Anda tidak berwenang mengubah status tugas ini',
  segarkan: 'Anda tidak berwenang menjalankan pemindaian ulang inbox kerja',
}

/**
 * Menerjemahkan galat Postgres/PostgREST menjadi kalimat Bahasa Indonesia.
 * Kode 42501 (insufficient_privilege) dan pelanggaran RLS tidak pernah
 * ditampilkan mentah ke pengguna.
 */
export function pesanGalat(e: any, konteks: keyof typeof PESAN_TOLAK, fallback: string): string {
  const code = String(e?.code ?? '')
  const msg = String(e?.message ?? '')
  if (code === '42501' || /\b42501\b/.test(msg) || /insufficient_privilege|row-level security|permission denied/i.test(msg)) {
    return PESAN_TOLAK[konteks] ?? 'Anda tidak berwenang melakukan tindakan ini'
  }
  if (code === 'P0002' || /tidak ditemukan/i.test(msg)) {
    return 'Tugas tidak ditemukan — kemungkinan sudah dihapus. Muat ulang daftar.'
  }
  // UPDATE yang tersaring habis oleh RLS tidak melempar 42501; PostgREST hanya
  // melaporkan "tidak ada baris yang dikembalikan" (PGRST116).
  if (code === 'PGRST116') {
    return `${PESAN_TOLAK[konteks] ?? 'Tindakan ditolak'} — tugas tidak berubah.`
  }
  return fallback
}
