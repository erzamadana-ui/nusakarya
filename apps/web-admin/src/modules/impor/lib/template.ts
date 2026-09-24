import type { Dataset } from './tipe'
import { susunCsv, unduhCsv, unduhExcel } from './parser-berkas'

/* ============================================================================
 * Template contoh yang bisa diunduh pengguna.
 * Isi template: 1 baris judul + 2 baris contoh + 1 baris keterangan kolom wajib.
 * ========================================================================== */

const AWALAN_KETERANGAN = 'KETERANGAN:'

/** Keterangan singkat per kolom: wajib/opsional, pilihan nilai, dan cara mengisi rujukan. */
export function keteranganKolom(ds: Dataset): string[] {
  return ds.kolom.map((k, i) => {
    const bagian: string[] = [k.wajib ? 'WAJIB DIISI' : 'boleh dikosongkan']
    if (k.nilaiSah?.length) bagian.push(`pilih salah satu: ${k.nilaiSah.join(' / ')}`)
    else if (k.lookup) bagian.push(`isi nama atau kode ${k.lookup.label.toLowerCase()} yang sudah terdaftar`)
    else if (k.tipe === 'tanggal') bagian.push('format 2026-01-31')
    else if (k.tipe === 'jam') bagian.push('format 08:00')
    else if (k.tipe === 'boolean') bagian.push('isi ya atau tidak')
    else if (k.tipe === 'angka' || k.tipe === 'bilangan') bagian.push('isi angka saja, tanpa Rp dan tanpa titik')
    else if (k.tipe === 'daftar') bagian.push('beberapa nilai dipisahkan tanda |')
    const teks = bagian.join(' — ')
    return i === 0 ? `${AWALAN_KETERANGAN} ${teks}` : teks
  })
}

/** Susunan baris template: judul, dua contoh, lalu baris keterangan. */
export function susunTemplate(ds: Dataset): { judul: string[]; baris: string[][] } {
  const judul = ds.kolom.map(k => k.label)
  const contoh = ds.contoh.map(c => ds.kolom.map(k => c[k.nama] ?? ''))
  return { judul, baris: [...contoh, keteranganKolom(ds)] }
}

const namaBerkas = (ds: Dataset, ext: string) =>
  `template-impor-${ds.kode.replace(/_/g, '-')}.${ext}`

export function unduhTemplateCsv(ds: Dataset) {
  const { judul, baris } = susunTemplate(ds)
  unduhCsv(namaBerkas(ds, 'csv'), susunCsv(judul, baris))
}

export async function unduhTemplateExcel(ds: Dataset) {
  const { judul, baris } = susunTemplate(ds)
  await unduhExcel(namaBerkas(ds, 'xlsx'), ds.label, judul, baris)
}
