/** Konstanta & util modul Setelan BPJS. */

/** Ubah desimal (0.0054) menjadi persen mudah-baca (0.54), dibulatkan 4 desimal agar tidak ada sisa floating point. */
export const toPct = (d?: number | string | null) => (d == null || d === '' ? 0 : Math.round(Number(d) * 100 * 10000) / 10000)
/** Ubah persen (0.54) kembali menjadi desimal (0.0054) untuk disimpan ke basis data. */
export const toDec = (p?: number | string | null) => (p == null || p === '' ? 0 : Math.round((Number(p) / 100) * 1000000) / 1000000)

export const JKK_RISK_CLASS_LABEL: Record<string, string> = {
  I: 'I — Sangat Rendah', II: 'II — Rendah', III: 'III — Sedang', IV: 'IV — Tinggi', V: 'V — Sangat Tinggi',
}
