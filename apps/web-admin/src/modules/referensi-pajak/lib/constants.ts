/** Konstanta modul Referensi Tarif Pajak. */

export const FOOTNOTE_PAJAK =
  'Aplikasi ini adalah alat bantu internal Finance & Payroll, BUKAN pengganti peraturan resmi. ' +
  'Seluruh tarif WAJIB dicocokkan ke sumber resmi (pajak.go.id, peraturan.bpk.go.id, jdih.kemenkeu.go.id) ' +
  'oleh tim pajak sebelum dipakai sebagai dasar memotong atau memungut pajak.'

/** Pemetaan status PTKP ke kategori TER sesuai Lampiran PMK 168/PMK.03/2023. */
export const TER_CATEGORY_PTKP: Record<string, string[]> = {
  A: ['TK/0', 'TK/1', 'K/0'],
  B: ['TK/2', 'TK/3', 'K/1', 'K/2'],
  C: ['K/3'],
}

export const TER_CATEGORY_TABS = [
  { value: 'A', label: 'Kategori A' },
  { value: 'B', label: 'Kategori B' },
  { value: 'C', label: 'Kategori C' },
]

/** Format tarif fraksi (0.11) menjadi teks persen ("11,00%"). */
export const pctRate = (n?: number | null, d = 2) => {
  if (n == null || isNaN(Number(n))) return '-'
  return `${(Number(n) * 100).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })}%`
}
