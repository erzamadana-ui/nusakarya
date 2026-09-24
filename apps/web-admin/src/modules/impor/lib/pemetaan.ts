import type { Dataset } from './tipe'

/* ============================================================================
 * Pencocokan judul kolom berkas dengan kolom dataset.
 * Perbedaan huruf besar-kecil, spasi, garis bawah, dan tanda baca diabaikan.
 * ========================================================================== */

/** Menormalkan judul supaya "Nama Cabang", "nama_cabang", dan "NAMACABANG" dianggap sama. */
export const normalkan = (s: string) =>
  String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')

/** Peta kolom dataset -> judul kolom pada berkas (null bila belum dipetakan). */
export type Pemetaan = Record<string, string | null>

/**
 * Mencocokkan otomatis: cocok persis pada label, lalu pada nama kolom basis data,
 * lalu cocok sebagian (judul berkas memuat label kolom atau sebaliknya).
 */
export function petakanOtomatis(ds: Dataset, judulBerkas: string[]): Pemetaan {
  const tersedia = judulBerkas.map(j => ({ asli: j, norm: normalkan(j) }))
  const terpakai = new Set<string>()
  const peta: Pemetaan = {}

  const ambil = (uji: (n: string) => boolean): string | null => {
    const k = tersedia.find(t => !terpakai.has(t.asli) && uji(t.norm))
    if (!k) return null
    terpakai.add(k.asli)
    return k.asli
  }

  for (const kol of ds.kolom) {
    const label = normalkan(kol.label)
    const nama = normalkan(kol.nama)
    peta[kol.nama] =
      ambil(n => n === label) ??
      ambil(n => n === nama) ??
      ambil(n => n.length >= 4 && (n === label.replace(/\(.*\)/g, '') || label.startsWith(n) || n.startsWith(label))) ??
      ambil(n => n.length >= 4 && (n.includes(nama) || nama.includes(n))) ??
      null
  }
  return peta
}

/** Kolom wajib yang belum punya pasangan di berkas. */
export function wajibBelumDipetakan(ds: Dataset, peta: Pemetaan): string[] {
  return ds.kolom.filter(k => k.wajib && !peta[k.nama]).map(k => k.label)
}
