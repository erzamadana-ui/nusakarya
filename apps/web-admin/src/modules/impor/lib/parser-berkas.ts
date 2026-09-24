import type { BerkasTerbaca, BarisBerkas } from './tipe'

/* ============================================================================
 * Pembacaan berkas CSV dan Excel untuk Pusat Impor Data.
 *
 * CSV diurai dengan parser tulisan sendiri (tanpa dependensi tambahan): sanggup
 * menangani tanda kutip ganda, koma/titik-koma di dalam kutipan, kutip ganda
 * berlipat (""), akhir baris CRLF maupun LF, dan tanda BOM UTF-8 di awal berkas.
 *
 * Excel (.xlsx/.xls) dibaca dengan pustaka `xlsx` (SheetJS) yang dimuat lewat
 * dynamic import, sehingga pustaka itu menjadi berkas terpisah dan tidak ikut
 * membebani bundel utama aplikasi.
 * ========================================================================== */

/** Ambang deteksi: pemisah kolom yang dicoba, berurut sesuai kelaziman berkas Indonesia. */
const KANDIDAT_PEMISAH = [',', ';', '\t', '|'] as const

/** Menebak pemisah kolom dari baris pertama berkas (di luar isi bertanda kutip). */
export function tebakPemisah(teks: string): string {
  const barisPertama = teks.split(/\r?\n/, 1)[0] ?? ''
  let terbaik = ','
  let jumlahTerbanyak = 0
  for (const p of KANDIDAT_PEMISAH) {
    let jumlah = 0
    let dalamKutip = false
    for (let i = 0; i < barisPertama.length; i++) {
      const c = barisPertama[i]
      if (c === '"') dalamKutip = !dalamKutip
      else if (c === p && !dalamKutip) jumlah++
    }
    if (jumlah > jumlahTerbanyak) { jumlahTerbanyak = jumlah; terbaik = p }
  }
  return terbaik
}

/** Mengurai teks CSV menjadi larik baris berisi larik sel. */
export function uraiCsv(teksAwal: string, pemisah?: string): string[][] {
  // Buang BOM UTF-8 supaya judul kolom pertama tidak ikut membawa karakter tak terlihat.
  const teks = teksAwal.charCodeAt(0) === 0xfeff ? teksAwal.slice(1) : teksAwal
  const p = pemisah ?? tebakPemisah(teks)
  const hasil: string[][] = []
  let baris: string[] = []
  let sel = ''
  let dalamKutip = false

  for (let i = 0; i < teks.length; i++) {
    const c = teks[i]
    if (dalamKutip) {
      if (c === '"') {
        if (teks[i + 1] === '"') { sel += '"'; i++ }   // kutip ganda berlipat -> satu kutip
        else dalamKutip = false
      } else sel += c
      continue
    }
    if (c === '"') { dalamKutip = true; continue }
    if (c === p) { baris.push(sel); sel = ''; continue }
    if (c === '\r') { if (teks[i + 1] === '\n') i++; baris.push(sel); sel = ''; hasil.push(baris); baris = []; continue }
    if (c === '\n') { baris.push(sel); sel = ''; hasil.push(baris); baris = []; continue }
    sel += c
  }
  baris.push(sel)
  hasil.push(baris)
  // Buang baris kosong di ujung berkas (akhir baris terakhir).
  while (hasil.length && hasil[hasil.length - 1].every(s => s.trim() === '')) hasil.pop()
  return hasil
}

/** Menyusun teks CSV dari judul + baris, siap diunduh. */
export function susunCsv(judul: string[], baris: (string | number | null | undefined)[][]): string {
  const kutip = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [judul.map(kutip).join(','), ...baris.map(r => r.map(kutip).join(','))].join('\r\n')
}

/** Mengunduh teks sebagai berkas CSV (dengan BOM supaya Excel membaca huruf beraksen dengan benar). */
export function unduhCsv(namaBerkas: string, isi: string) {
  unduhBlob(namaBerkas, new Blob(['﻿' + isi], { type: 'text/csv;charset=utf-8;' }))
}

export function unduhBlob(namaBerkas: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = namaBerkas
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Mengubah larik-sel menjadi judul + baris berkunci judul. Baris kosong dibuang. */
function rapikan(namaBerkas: string, matriks: string[][]): BerkasTerbaca {
  if (!matriks.length) return { namaBerkas, judul: [], baris: [] }
  const judulMentah = (matriks[0] ?? []).map(h => String(h ?? '').trim())
  // Buang kolom tanpa judul di ujung kanan (lazim pada berkas Excel).
  let batas = judulMentah.length
  while (batas > 0 && judulMentah[batas - 1] === '') batas--
  const judul = judulMentah.slice(0, batas)

  const baris: BarisBerkas[] = []
  for (let i = 1; i < matriks.length; i++) {
    const sel = matriks[i] ?? []
    if (sel.every(s => String(s ?? '').trim() === '')) continue
    const isi: BarisBerkas = {}
    judul.forEach((h, j) => { if (h) isi[h] = String(sel[j] ?? '').trim() })
    baris.push(isi)
  }
  return { namaBerkas, judul: judul.filter(Boolean), baris }
}

/** Baris keterangan yang ikut dicetak di template — jangan dianggap data. */
const AWALAN_KETERANGAN = 'KETERANGAN:'

/** Membuang baris petunjuk template bila pengguna lupa menghapusnya. */
function buangBarisKeterangan(b: BerkasTerbaca): BerkasTerbaca {
  const bersih = b.baris.filter(r => {
    const nilai = Object.values(r)
    const pertama = String(nilai[0] ?? '')
    return !pertama.toUpperCase().startsWith(AWALAN_KETERANGAN)
  })
  return { ...b, baris: bersih }
}

/** Membaca satu berkas yang dipilih pengguna. Menolak tipe berkas yang tidak dikenal. */
export async function bacaBerkas(file: File): Promise<BerkasTerbaca> {
  const nama = file.name.toLowerCase()
  if (nama.endsWith('.csv') || nama.endsWith('.txt')) {
    const teks = await file.text()
    return buangBarisKeterangan(rapikan(file.name, uraiCsv(teks)))
  }
  if (nama.endsWith('.xlsx') || nama.endsWith('.xlsm') || nama.endsWith('.xls')) {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: false })
    const namaLembar = wb.SheetNames[0]
    if (!namaLembar) throw new Error('Berkas Excel tidak memiliki lembar kerja apa pun.')
    const lembar = wb.Sheets[namaLembar]
    const matriks = XLSX.utils.sheet_to_json<string[]>(lembar, { header: 1, raw: false, defval: '', blankrows: false })
    return buangBarisKeterangan(rapikan(file.name, matriks.map(r => (r ?? []).map(c => String(c ?? '')))))
  }
  throw new Error('Jenis berkas belum didukung. Gunakan berkas .csv atau .xlsx.')
}

/** Menyusun berkas Excel satu lembar dari judul + baris, lalu mengunduhnya. */
export async function unduhExcel(namaBerkas: string, namaLembar: string, judul: string[], baris: string[][]) {
  const XLSX = await import('xlsx')
  const matriks = [judul, ...baris]
  const lembar = XLSX.utils.aoa_to_sheet(matriks)
  lembar['!cols'] = judul.map(h => ({ wch: Math.min(40, Math.max(14, h.length + 4)) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, lembar, namaLembar.slice(0, 31) || 'Template')
  const keluaran = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  unduhBlob(namaBerkas, new Blob([keluaran], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
}
