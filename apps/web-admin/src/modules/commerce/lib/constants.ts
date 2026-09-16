/** Konstanta modul Commerce. Tarif pajak di bawah ini adalah ASUMSI STANDAR
 *  dan WAJIB diverifikasi ke peraturan perpajakan yang berlaku sebelum dipakai
 *  menerbitkan dokumen resmi. */
import { chartSeries } from '@/lib/theme'
export const PPN_RATE = 0.11 // PPN 11% efektif
export const PPH23_RATE = 0.02 // PPh 23 atas jasa 2%
export const TAX_NOTE = 'Tarif PPN & PPh 23 di atas adalah asumsi standar per September 2026 dan WAJIB diverifikasi ke peraturan perpajakan terbaru sebelum diterbitkan.'

export const CONTRACT_TYPE_OPTIONS = [
  { value: 'deployment', label: 'Deployment' },
  { value: 'manage_service', label: 'Manage Service' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'borongan', label: 'Borongan' },
  { value: 'unit_price', label: 'Unit Price' },
]
export const CONTRACT_STATUS_OPTIONS = ['draft', 'aktif', 'selesai', 'putus', 'expired']
export const SPK_STATUS_OPTIONS = ['draft', 'aktif', 'selesai', 'batal']
export const CLAIM_STATUS_OPTIONS = ['draft', 'diajukan', 'diverifikasi', 'disetujui', 'ditolak', 'ditagihkan']
export const CLAIM_STATUS_STEPS = ['draft', 'diajukan', 'diverifikasi', 'disetujui', 'ditagihkan']
export const BAST_STATUS_OPTIONS = ['draft', 'diajukan', 'ditandatangani', 'ditolak']
export const AR_STATUS_OPTIONS = ['draft', 'diajukan', 'terkirim', 'dibayar_sebagian', 'lunas', 'overdue', 'batal']
export const CUSTOMER_TYPE_OPTIONS = [
  { value: 'principal', label: 'Principal' },
  { value: 'korporat', label: 'Korporat' },
  { value: 'retail', label: 'Retail' },
]
export const CUSTOMER_STATUS_OPTIONS = ['aktif', 'nonaktif']
export const PENALTY_STATUS_OPTIONS = ['draft', 'diajukan', 'disetujui', 'dibayar', 'batal']
export const PAYMENT_METHOD_OPTIONS = ['Transfer Bank', 'Tunai', 'Giro', 'Lainnya']

export const CHART_COLORS = () => chartSeries()

/** Asal-usul tarif (contract_price_list.unit_price). 'asumsi_sistem' = angka karangan sistem,
 *  belum ada dasar kontrak/negosiasi yang diverifikasi. */
export const PRICE_SOURCE_OPTIONS = [
  { value: 'asumsi_sistem', label: 'Asumsi Sistem' },
  { value: 'kontrak', label: 'Kontrak' },
  { value: 'negosiasi', label: 'Negosiasi' },
  { value: 'survei_pasar', label: 'Survei Pasar' },
  { value: 'lainnya', label: 'Lainnya' },
]
export const PRICE_SOURCE_LABEL: Record<string, string> = Object.fromEntries(PRICE_SOURCE_OPTIONS.map(o => [o.value, o.label]))
export const priceSourceTone = (source?: string | null): 'amber' | 'slate' => (!source || source === 'asumsi_sistem' ? 'amber' : 'slate')
