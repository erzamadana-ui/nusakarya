import type { Dataset, KolomDataset, TipeKolom } from './tipe'

/* ============================================================================
 * Pengubahan tipe dan pemeriksaan nilai satu sel.
 * Semua pesan ditulis untuk dibaca orang non-teknis.
 * ========================================================================== */

export type HasilSel = { nilai: unknown; galat?: string }

const BENAR = ['ya', 'y', 'yes', 'true', '1', 'aktif', 'benar', 'ada']
const SALAH = ['tidak', 't', 'no', 'n', 'false', '0', 'nonaktif', 'salah', 'tiada']

/** Membaca angka bergaya Indonesia (1.250.000,50) maupun bergaya Inggris (1250000.50). */
export function bacaAngka(teks: string): number | null {
  let s = teks.trim().replace(/^rp\.?\s*/i, '').replace(/\s/g, '')
  if (!s) return null
  const negatif = /^\((.*)\)$/.test(s)
  if (negatif) s = s.slice(1, -1)
  const adaTitik = s.includes('.')
  const adaKoma = s.includes(',')
  if (adaTitik && adaKoma) {
    // Pemisah desimal = tanda yang muncul paling akhir.
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (adaKoma) {
    // Satu koma dengan 1-2 angka di belakangnya dianggap desimal, selebihnya pemisah ribuan.
    s = /^-?\d+,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '')
  } else if (adaTitik) {
    // Pola kelompok tiga angka (1.250.000) dianggap pemisah ribuan.
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  }
  if (!/^-?\d*\.?\d+$/.test(s)) return null
  const n = Number(s)
  if (!isFinite(n)) return null
  return negatif ? -n : n
}

/** Excel menyimpan tanggal sebagai jumlah hari sejak 30 Desember 1899. */
function dariSerialExcel(n: number): string | null {
  if (n < 1 || n > 80000) return null
  const ms = Math.round((n - 25569) * 86400 * 1000)
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/** Menerima YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, dan nomor seri Excel. */
export function bacaTanggal(teks: string): string | null {
  const s = teks.trim()
  if (!s) return null
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (m) return sahkanTanggal(+m[1], +m[2], +m[3])
  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s)
  if (m) return sahkanTanggal(+m[3], +m[2], +m[1])
  if (/^\d+(\.\d+)?$/.test(s)) return dariSerialExcel(Number(s))
  return null
}

function sahkanTanggal(th: number, bl: number, hr: number): string | null {
  if (bl < 1 || bl > 12 || hr < 1 || hr > 31) return null
  const d = new Date(Date.UTC(th, bl - 1, hr))
  if (d.getUTCFullYear() !== th || d.getUTCMonth() !== bl - 1 || d.getUTCDate() !== hr) return null
  return `${th}-${String(bl).padStart(2, '0')}-${String(hr).padStart(2, '0')}`
}

/** Menerima HH:MM, HH:MM:SS, dan pecahan hari dari Excel (0,5 = 12:00). */
export function bacaJam(teks: string): string | null {
  const s = teks.trim()
  if (!s) return null
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s)
  if (m) {
    const j = +m[1], mnt = +m[2], dtk = m[3] ? +m[3] : 0
    if (j > 23 || mnt > 59 || dtk > 59) return null
    return `${String(j).padStart(2, '0')}:${String(mnt).padStart(2, '0')}:${String(dtk).padStart(2, '0')}`
  }
  const angka = bacaAngka(s)
  if (angka != null && angka >= 0 && angka < 1) {
    const total = Math.round(angka * 86400)
    const j = Math.floor(total / 3600), mnt = Math.floor((total % 3600) / 60), dtk = total % 60
    return `${String(j).padStart(2, '0')}:${String(mnt).padStart(2, '0')}:${String(dtk).padStart(2, '0')}`
  }
  return null
}

/** Memecah nilai majemuk: "A | B", "A; B", atau "A, B". */
export function bacaDaftar(teks: string): string[] {
  return teks.split(/\s*[|;]\s*|\s*,\s*/).map(s => s.trim()).filter(Boolean)
}

const SEBUTAN_TIPE: Record<TipeKolom, string> = {
  teks: 'teks', angka: 'angka', bilangan: 'bilangan bulat', boolean: 'ya/tidak',
  tanggal: 'tanggal', jam: 'jam', waktu: 'tanggal dan jam', daftar: 'daftar nilai',
  json: 'data JSON', lookup: 'rujukan',
}

/**
 * Mengubah satu sel menjadi nilai siap kirim.
 * Kolom bertipe `lookup` TIDAK diterjemahkan di sini — penerjemahan ke id
 * dikerjakan mesin impor yang memegang indeks tabel tujuan.
 */
export function ubahSel(kolom: KolomDataset, teksAwal: string): HasilSel {
  const teks = (teksAwal ?? '').trim()
  if (!teks) {
    if (kolom.wajib) return { nilai: null, galat: `Kolom "${kolom.label}" wajib diisi` }
    return { nilai: null }
  }
  switch (kolom.tipe) {
    case 'angka':
    case 'bilangan': {
      const n = bacaAngka(teks)
      if (n == null) return { nilai: null, galat: `"${teks}" bukan ${SEBUTAN_TIPE[kolom.tipe]} yang sah pada kolom "${kolom.label}"` }
      if (kolom.tipe === 'bilangan' && !Number.isInteger(n)) {
        return { nilai: null, galat: `Kolom "${kolom.label}" harus bilangan bulat, bukan "${teks}"` }
      }
      return { nilai: n }
    }
    case 'boolean': {
      const s = teks.toLowerCase()
      if (BENAR.includes(s)) return { nilai: true }
      if (SALAH.includes(s)) return { nilai: false }
      return { nilai: null, galat: `Kolom "${kolom.label}" hanya menerima "ya" atau "tidak", bukan "${teks}"` }
    }
    case 'tanggal': {
      const t = bacaTanggal(teks)
      if (!t) return { nilai: null, galat: `Tanggal "${teks}" pada kolom "${kolom.label}" tidak dikenali. Gunakan format 2026-01-31 atau 31/01/2026` }
      return { nilai: t }
    }
    case 'jam': {
      const j = bacaJam(teks)
      if (!j) return { nilai: null, galat: `Jam "${teks}" pada kolom "${kolom.label}" tidak dikenali. Gunakan format 08:00` }
      return { nilai: j }
    }
    case 'waktu': {
      const d = new Date(teks)
      if (isNaN(d.getTime())) {
        const t = bacaTanggal(teks)
        if (!t) return { nilai: null, galat: `Waktu "${teks}" pada kolom "${kolom.label}" tidak dikenali` }
        return { nilai: `${t}T00:00:00` }
      }
      return { nilai: d.toISOString() }
    }
    case 'daftar': {
      const d = bacaDaftar(teks)
      return { nilai: d.length ? d : null }
    }
    case 'json': {
      try { return { nilai: JSON.parse(teks) } }
      catch { return { nilai: null, galat: `Kolom "${kolom.label}" harus berisi data JSON yang sah` } }
    }
    default:
      return { nilai: teks }
  }
}

/** Memeriksa nilai terhadap daftar nilai sah dari CHECK constraint. */
export function periksaNilaiSah(kolom: KolomDataset, teks: string): string | null {
  if (!kolom.nilaiSah?.length) return null
  const s = teks.trim()
  if (!s) return null
  const cocok = kolom.nilaiSah.some(v => v.toLowerCase() === s.toLowerCase())
  if (cocok) return null
  return `Nilai "${s}" tidak sah untuk kolom "${kolom.label}". Pilihan yang tersedia: ${kolom.nilaiSah.join(', ')}`
}

/** Mengembalikan nilai sah dengan huruf besar-kecil persis seperti di basis data. */
export function bakukanNilaiSah(kolom: KolomDataset, teks: string): string {
  if (!kolom.nilaiSah?.length) return teks
  return kolom.nilaiSah.find(v => v.toLowerCase() === teks.trim().toLowerCase()) ?? teks
}

/** Kunci alami satu baris, dipakai mendeteksi duplikat. */
export function kunciBaris(ds: Dataset, isi: Record<string, unknown>): string | null {
  if (!ds.kunciAlami?.length) return null
  const bagian = ds.kunciAlami.map(k => String(isi[k] ?? '').trim().toLowerCase())
  if (bagian.some(b => !b)) return null
  return bagian.join('\u0001')
}
