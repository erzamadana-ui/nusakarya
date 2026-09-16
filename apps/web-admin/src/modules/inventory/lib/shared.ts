/** Konstanta & util bersama modul Inventory & Inventory Aset. */

export const ITEM_CATEGORY = [
  { value: 'NTE', label: 'NTE' },
  { value: 'NON_NTE', label: 'Material Non-NTE' },
  { value: 'ASSET', label: 'Aset' },
  { value: 'JASA', label: 'Jasa' },
]

export const WAREHOUSE_TYPES = [
  { value: 'pusat', label: 'Gudang Pusat' },
  { value: 'branch', label: 'Gudang Cabang' },
  { value: 'mobile', label: 'Gudang Mobile' },
  { value: 'teknisi', label: 'Gudang Teknisi' },
  { value: 'konsinyasi', label: 'Konsinyasi Principal' },
]

export const SERIAL_STATUS = [
  { value: 'in_stock', label: 'Di Gudang' },
  { value: 'issued', label: 'Pada Teknisi' },
  { value: 'installed', label: 'Terpasang' },
  { value: 'returned', label: 'Retur' },
  { value: 'damaged', label: 'Rusak' },
  { value: 'lost', label: 'Hilang' },
  { value: 'scrapped', label: 'Scrap' },
]
export const SERIAL_TABS = [{ value: '', label: 'Semua' }, ...SERIAL_STATUS]

export const MOVE_TYPES = [
  { value: 'GR', label: 'Penerimaan Barang (GR)' },
  { value: 'ISSUE', label: 'Pengeluaran (Issue)' },
  { value: 'RETURN', label: 'Retur ke Gudang' },
  { value: 'TRANSFER', label: 'Transfer Antar Gudang' },
  { value: 'ADJUST', label: 'Penyesuaian (Adjust)' },
  { value: 'SCRAP', label: 'Scrap / Pemusnahan' },
]
/** Menentukan sisi gudang mana yang wajib diisi untuk tiap jenis mutasi. */
export function moveSides(moveType: string): { from: boolean; to: boolean } {
  switch (moveType) {
    case 'GR': return { from: false, to: true }
    case 'RETURN': return { from: false, to: true }
    case 'ISSUE': return { from: true, to: false }
    case 'SCRAP': return { from: true, to: false }
    case 'TRANSFER': return { from: true, to: true }
    case 'ADJUST': return { from: true, to: true } // dipilih user: tambah -> to, kurangi -> from
    default: return { from: false, to: false }
  }
}

export const MR_STATUS = ['draft', 'diajukan', 'disetujui', 'dikeluarkan', 'ditolak', 'selesai']
export const MR_STEPS = ['Draft', 'Diajukan', 'Disetujui', 'Dikeluarkan', 'Selesai']
export function mrStepIndex(status: string) {
  const m: Record<string, number> = { draft: 0, diajukan: 1, disetujui: 2, dikeluarkan: 3, selesai: 4, ditolak: 1 }
  return m[status] ?? 0
}

export const OPNAME_STATUS = ['draft', 'berjalan', 'selesai', 'disetujui']
export const OPNAME_STEPS = ['Draft', 'Berjalan', 'Selesai Hitung', 'Disetujui']
export function opnameStepIndex(status: string) {
  const m: Record<string, number> = { draft: 0, berjalan: 1, selesai: 2, disetujui: 3 }
  return m[status] ?? 0
}

export const ASSET_CATEGORY = [
  { value: 'kendaraan', label: 'Kendaraan' },
  { value: 'alat_ukur', label: 'Alat Ukur (OTDR/Splicer)' },
  { value: 'tools', label: 'Perkakas' },
  { value: 'it', label: 'IT / Elektronik' },
  { value: 'furniture', label: 'Furnitur' },
  { value: 'bangunan', label: 'Bangunan' },
  { value: 'lain', label: 'Lainnya' },
]
export const ASSET_CONDITION = [
  { value: 'baik', label: 'Baik' },
  { value: 'rusak_ringan', label: 'Rusak Ringan' },
  { value: 'rusak_berat', label: 'Rusak Berat' },
  { value: 'hilang', label: 'Hilang' },
]
export const ASSET_STATUS = [
  { value: 'tersedia', label: 'Tersedia' },
  { value: 'dipakai', label: 'Dipakai' },
  { value: 'perbaikan', label: 'Perbaikan' },
  { value: 'dilelang', label: 'Dilelang' },
  { value: 'dihapus', label: 'Dihapus' },
]
export const MAINTENANCE_TYPES = [
  { value: 'servis', label: 'Servis' },
  { value: 'kalibrasi', label: 'Kalibrasi' },
  { value: 'perbaikan', label: 'Perbaikan' },
  { value: 'inspeksi', label: 'Inspeksi' },
]

/** Nilai buku garis lurus berjalan. Perhitungan sistem, bukan angka akuntansi resmi. */
export function bookValueNow(purchasePrice?: number | null, usefulLifeMonths?: number | null, purchaseDate?: string | null): number {
  const price = Number(purchasePrice || 0)
  const life = Number(usefulLifeMonths || 0)
  if (!price || !life || !purchaseDate) return price
  const start = new Date(purchaseDate)
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  months = Math.max(0, Math.min(life, months))
  const monthly = price / life
  return Math.max(0, price - monthly * months)
}

/** Toleransi selisih pemakaian material vs BoQ sebelum ditandai over-tolerance. */
export const USAGE_TOLERANCE_PERCENT = 5

export function usageVariance(qtyPlan?: number | null, qtyActual?: number | null) {
  const plan = Number(qtyPlan || 0), actual = Number(qtyActual || 0)
  const variance = actual - plan
  const variance_percent = plan !== 0 ? (variance / plan) * 100 : (actual !== 0 ? 100 : 0)
  const is_over_tolerance = Math.abs(variance_percent) > USAGE_TOLERANCE_PERCENT
  return { variance, variance_percent, is_over_tolerance }
}

/** Status jatuh tempo pemeliharaan aset. */
export function dueTone(nextDueDate?: string | null): { tone: string; label: string } | null {
  if (!nextDueDate) return null
  const due = new Date(nextDueDate); const today = new Date()
  due.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (days < 0) return { tone: 'red', label: `Lewat jatuh tempo ${Math.abs(days)} hari` }
  if (days <= 30) return { tone: 'amber', label: `Jatuh tempo ${days} hari lagi` }
  return { tone: 'emerald', label: `Terjadwal (${days} hari lagi)` }
}

export const CHART_COLORS = ['#1B8A92', '#F5A524', '#3AA3AA', '#F59E0B', '#64748B', '#E11D48', '#16A34A']
