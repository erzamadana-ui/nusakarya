/** Konstanta & mesin hitung untuk modul Payout Mitra Freelance. */

export const PAYROLL_SCHEME_OPTIONS = [
  { value: 'fix_salary', label: 'Gaji Tetap (Fix Salary)' },
  { value: 'freelance', label: 'Freelance (per satuan pekerjaan)' },
  { value: 'campuran', label: 'Campuran' },
]

export const TAX_SCHEME_OPTIONS = [
  { value: 'pph21_bukan_pegawai', label: 'PPh 21 Bukan Pegawai (Orang Pribadi)' },
  { value: 'pph23_jasa', label: 'PPh 23 Jasa (Badan/Vendor)' },
  { value: 'final', label: 'PPh Final (manual)' },
  { value: 'tanpa_potongan', label: 'Tanpa Potongan Pajak' },
]

export const PAYOUT_STATUS_TABS = [
  { value: 'draft', label: 'Draft' },
  { value: 'dihitung', label: 'Dihitung' },
  { value: 'diverifikasi', label: 'Diverifikasi' },
  { value: 'disetujui', label: 'Disetujui' },
  { value: 'dibayar', label: 'Dibayar' },
  { value: 'ditolak', label: 'Ditolak' },
]

export const PAYOUT_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'dihitung', label: 'Dihitung' },
  { key: 'diverifikasi', label: 'Diverifikasi' },
  { key: 'disetujui', label: 'Disetujui' },
  { key: 'dibayar', label: 'Dibayar' },
]

export const APPLIES_TO_OPTIONS = [
  { value: 'mitra', label: 'Mitra Tertentu' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'umum', label: 'Umum (semua mitra)' },
]

/** Asal-usul tarif (freelance_rate_cards.rate_amount). 'asumsi_sistem' = angka karangan sistem,
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

/** Rentang tanggal awal & akhir bulan dari period_code 'YYYY-MM'. */
export function periodRange(periodCode: string): [string, string] {
  const [y, m] = periodCode.split('-').map(Number)
  const start = `${periodCode}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${periodCode}-${String(lastDay).padStart(2, '0')}`
  return [start, end]
}

/** Daftar n kode periode (YYYY-MM) berturut-turut mundur dari periode acuan, urut menaik. */
export function lastPeriods(n: number, from = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export type RateCard = {
  id: string; employee_id: string | null; vendor_id: string | null; job_type_id: string
  rate_amount: number; min_qty: number; effective_date: string; end_date: string | null; is_active: boolean
}

/**
 * Pilih rate card yang berlaku untuk satu baris pekerjaan mitra.
 * Prioritas: (1) khusus mitra (employee_id cocok) → (2) vendor → (3) umum (employee_id & vendor_id kosong)
 * → (4) tidak ditemukan (pemanggil memakai job_types.tariff_amount sebagai cadangan).
 * Pada tiap tingkat, dipilih tier qty (min_qty tertinggi yang ≤ qty baris) lalu tanggal efektif terbaru.
 */
export function pickRateCard(cards: RateCard[], jobTypeId: string, employeeId: string, qty: number, workDate: string): RateCard | null {
  const candidates = cards.filter(c =>
    c.job_type_id === jobTypeId && c.is_active &&
    c.effective_date <= workDate && (!c.end_date || c.end_date >= workDate) &&
    Number(c.min_qty || 0) <= qty)
  const bestOf = (rows: RateCard[]) => rows.length
    ? rows.slice().sort((a, b) => (Number(b.min_qty) - Number(a.min_qty)) || (b.effective_date.localeCompare(a.effective_date)))[0]
    : null
  return bestOf(candidates.filter(c => c.employee_id === employeeId))
    ?? bestOf(candidates.filter(c => !!c.vendor_id))
    ?? bestOf(candidates.filter(c => !c.employee_id && !c.vendor_id))
    ?? null
}

export type TaxBracket = { min_income: number; max_income: number | null; rate: number }

/**
 * PPh 21 Bukan Pegawai — tarif progresif Pasal 17 UU 7/2021 (HPP), diterapkan berlapis
 * (bukan tarif tunggal per lapisan) atas DPP (50% × bruto). Surcharge 20% bila tanpa NPWP.
 * Catatan: ini perhitungan PER PERIODE. Status berkesinambungan & akumulasi setahun
 * wajib direkonsiliasi terpisah oleh tim pajak (lihat catatan kaki halaman).
 */
export function calcPph21BukanPegawaiProgresif(bruto: number, hasNpwp: boolean, brackets: TaxBracket[]): { dpp: number; pajak: number } {
  const dpp = Math.round(bruto * 0.5)
  const sorted = brackets.slice().sort((a, b) => a.min_income - b.min_income)
  let sisa = dpp
  let pajak = 0
  for (const b of sorted) {
    if (sisa <= 0) break
    const lebar = (b.max_income ?? Infinity) - b.min_income
    const kena = Math.min(sisa, lebar)
    if (kena > 0) { pajak += kena * Number(b.rate); sisa -= kena }
  }
  if (!hasNpwp) pajak *= 1.2
  return { dpp, pajak: Math.round(pajak) }
}

/** PPh 23 Jasa (badan/vendor): 2% dari bruto; tanpa NPWP tarif ×2 (4%). */
export function calcPph23Jasa(bruto: number, hasNpwp: boolean): { rate: number; pajak: number } {
  const rate = hasNpwp ? 0.02 : 0.04
  return { rate, pajak: Math.round(bruto * rate) }
}
