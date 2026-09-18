/**
 * Sumber tunggal nilai status untuk aplikasi mobile.
 *
 * WAJIB sama persis dengan CHECK constraint di basis data dan dengan
 * apps/web-admin/src/modules/operations/lib/status.ts. Sebelumnya mobile
 * memakai istilah Indonesia ('ditugaskan', 'berjalan', 'selesai') yang
 * SELALU ditolak Postgres, sehingga tidak satu pun aksi lapangan tersimpan.
 * Jangan menulis literal status langsung di halaman — pakai konstanta ini.
 */

export const WO = {
  DRAFT: 'draft',
  DITUGASKAN: 'dispatched',
  DITERIMA: 'accepted',
  BERJALAN: 'on_progress',
  TUNGGU_MATERIAL: 'pending_material',
  SELESAI: 'done',
  GAGAL: 'failed',
  BATAL: 'cancelled',
} as const

/** Urutan langkah yang ditampilkan di stepper detail WO. */
export const WO_LANGKAH = [WO.DITUGASKAN, WO.DITERIMA, WO.BERJALAN, WO.SELESAI] as const

/** WO yang masih membebani teknisi (tab "Berjalan"). */
export const WO_AKTIF = [WO.DRAFT, WO.DITUGASKAN, WO.DITERIMA, WO.BERJALAN, WO.TUNGGU_MATERIAL] as const

/** WO yang sudah tidak dikerjakan lagi (tab "Selesai"). */
export const WO_TUTUP = [WO.SELESAI, WO.GAGAL] as const

export const TIKET = {
  BARU: 'open',
  DITUGASKAN: 'assigned',
  BERJALAN: 'on_progress',
  TERTUNDA: 'pending',
  SELESAI: 'resolved',
  DITUTUP: 'closed',
  BATAL: 'cancelled',
} as const

export const LABEL_WO: Record<string, string> = {
  draft: 'Draft',
  dispatched: 'Ditugaskan',
  accepted: 'Diterima',
  on_progress: 'Berjalan',
  pending_material: 'Tunggu Material',
  done: 'Selesai',
  failed: 'Gagal',
  cancelled: 'Dibatalkan',
}

export const LABEL_TIKET: Record<string, string> = {
  open: 'Baru',
  assigned: 'Ditugaskan',
  on_progress: 'Dikerjakan',
  pending: 'Tertunda',
  resolved: 'Selesai',
  closed: 'Ditutup',
  cancelled: 'Dibatalkan',
}

export const labelWo = (s?: string | null) => (s ? LABEL_WO[s] ?? s : '-')
export const labelTiket = (s?: string | null) => (s ? LABEL_TIKET[s] ?? s : '-')
