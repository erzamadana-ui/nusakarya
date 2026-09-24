import supabase from '@/lib/supabase'
import type {
  BarisBerkas, BarisTervalidasi, Dataset, HasilImpor, KolomDataset, Masalah, RingkasanValidasi,
} from './tipe'
import type { Pemetaan } from './pemetaan'
import { bakukanNilaiSah, kunciBaris, periksaNilaiSah, ubahSel } from './validasi'

/* ============================================================================
 * Mesin impor: menyiapkan indeks rujukan, memvalidasi seluruh baris,
 * lalu menyisipkan data secara bertahap.
 * ========================================================================== */

/** Jumlah baris per sekali kirim ke basis data. */
export const UKURAN_BATCH = 200
/** Batas aman jumlah baris rujukan yang ditarik untuk penerjemahan nama -> id. */
const BATAS_RUJUKAN = 20000
const HALAMAN_RUJUKAN = 1000

/** Penanda bahwa satu nilai rujukan cocok ke lebih dari satu baris. */
export const AMBIGU = '\u0000ambigu'

/** kolom dataset -> (nilai huruf kecil -> id tabel tujuan, atau AMBIGU). */
export type IndeksLookup = Record<string, Map<string, string>>

/** Menarik seluruh baris sebuah tabel rujukan (dibatasi RLS perusahaan pengguna). */
async function tarikSemua(tabel: string, kolom: string[], companyId: string) {
  const hasil: Record<string, unknown>[] = []
  for (let mulai = 0; mulai < BATAS_RUJUKAN; mulai += HALAMAN_RUJUKAN) {
    const { data, error } = await supabase
      .from(tabel)
      .select(kolom.join(','))
      .eq('company_id', companyId)
      .range(mulai, mulai + HALAMAN_RUJUKAN - 1)
    if (error) throw error
    const baris = (data ?? []) as unknown as Record<string, unknown>[]
    hasil.push(...baris)
    if (baris.length < HALAMAN_RUJUKAN) break
  }
  return hasil
}

/** Menyiapkan indeks penerjemah nama/kode -> id untuk setiap kolom rujukan dataset. */
export async function muatIndeksLookup(ds: Dataset, companyId: string): Promise<IndeksLookup> {
  const indeks: IndeksLookup = {}
  const kolomLookup = ds.kolom.filter(k => k.lookup)
  for (const kol of kolomLookup) {
    const lk = kol.lookup!
    const baris = await tarikSemua(lk.tabel, [lk.kolomIsi, ...lk.kolomCari], companyId)
    const peta = new Map<string, string>()
    for (const r of baris) {
      const id = String(r[lk.kolomIsi] ?? '')
      if (!id) continue
      for (const kc of lk.kolomCari) {
        const nilai = String(r[kc] ?? '').trim().toLowerCase()
        if (!nilai) continue
        const ada = peta.get(nilai)
        if (ada === undefined) peta.set(nilai, id)
        else if (ada !== id) peta.set(nilai, AMBIGU)
      }
    }
    indeks[kol.nama] = peta
  }
  return indeks
}

/** Mengumpulkan kunci alami yang sudah ada di basis data, untuk mendeteksi duplikat. */
export async function muatKunciAda(ds: Dataset, companyId: string): Promise<Set<string>> {
  const set = new Set<string>()
  if (!ds.kunciAlami?.length) return set
  const baris = await tarikSemua(ds.tabel, ds.kunciAlami, companyId)
  for (const r of baris) {
    const bagian = ds.kunciAlami.map(k => String(r[k] ?? '').trim().toLowerCase())
    if (bagian.every(Boolean)) set.add(bagian.join('\u0001'))
  }
  return set
}

function terjemahkanRujukan(kol: KolomDataset, teks: string, indeks: IndeksLookup): { nilai: string | null; galat?: string } {
  const lk = kol.lookup!
  const peta = indeks[kol.nama]
  const kunci = teks.trim().toLowerCase()
  const id = peta?.get(kunci)
  if (!id) {
    return { nilai: null, galat: `${lk.label} "${teks}" belum terdaftar. Isi data ${lk.label.toLowerCase()} lebih dulu, atau betulkan penulisannya` }
  }
  if (id === AMBIGU) {
    return { nilai: null, galat: `${lk.label} "${teks}" cocok ke lebih dari satu data. Pakai kodenya supaya jelas` }
  }
  return { nilai: id }
}

/** Memvalidasi seluruh baris berkas terhadap dataset dan data yang sudah ada. */
export function validasiSemua(
  ds: Dataset,
  barisBerkas: BarisBerkas[],
  peta: Pemetaan,
  indeks: IndeksLookup,
  kunciAda: Set<string>,
): RingkasanValidasi {
  const hasil: BarisTervalidasi[] = []
  const kunciBerkas = new Map<string, number>()

  barisBerkas.forEach((mentah, i) => {
    const masalah: Masalah[] = []
    const isi: Record<string, unknown> = {}

    for (const kol of ds.kolom) {
      const judul = peta[kol.nama]
      const teks = judul ? String(mentah[judul] ?? '').trim() : ''

      if (!teks) {
        if (kol.wajib) masalah.push({ kolom: kol.nama, pesan: `Kolom "${kol.label}" wajib diisi`, tingkat: 'galat' })
        continue
      }
      const galatDaftar = periksaNilaiSah(kol, teks)
      if (galatDaftar) { masalah.push({ kolom: kol.nama, pesan: galatDaftar, tingkat: 'galat' }); continue }

      if (kol.tipe === 'lookup') {
        const r = terjemahkanRujukan(kol, teks, indeks)
        if (r.galat) masalah.push({ kolom: kol.nama, pesan: r.galat, tingkat: 'galat' })
        else isi[kol.nama] = r.nilai
        continue
      }
      const sel = ubahSel(kol, kol.nilaiSah?.length ? bakukanNilaiSah(kol, teks) : teks)
      if (sel.galat) masalah.push({ kolom: kol.nama, pesan: sel.galat, tingkat: 'galat' })
      else if (sel.nilai !== null) isi[kol.nama] = sel.nilai
    }

    const kunci = kunciBaris(ds, isi)
    if (kunci) {
      const sebelumnya = kunciBerkas.get(kunci)
      if (sebelumnya != null) {
        masalah.push({
          kolom: null,
          pesan: `Baris ini kembar dengan baris ${sebelumnya} di berkas yang sama (${ds.kunciAlami!.join(' + ')} sama)`,
          tingkat: 'galat',
        })
      } else {
        kunciBerkas.set(kunci, i + 1)
        if (kunciAda.has(kunci)) {
          masalah.push({
            kolom: null,
            pesan: 'Data dengan kunci ini sudah ada — baris ini akan memperbarui data lama, bukan menambah baris baru',
            tingkat: 'peringatan',
          })
        }
      }
    }

    hasil.push({ nomor: i + 1, mentah, isi, masalah, kunci })
  })

  const bermasalah = hasil.filter(b => b.masalah.some(m => m.tingkat === 'galat')).length
  const akanDiperbarui = hasil.filter(b => b.masalah.some(m => m.tingkat === 'peringatan')).length
  return { baris: hasil, siap: hasil.length - bermasalah, bermasalah, akanDiperbarui }
}

/* ------------------------------------------------------- penerjemahan galat DB */

/** Mengubah galat teknis PostgreSQL/PostgREST menjadi kalimat yang bisa dipahami. */
export function pesanGalatImpor(e: unknown, ds?: Dataset): string {
  const err = e as { code?: string; message?: string; details?: string; hint?: string }
  const kode = String(err?.code ?? '')
  const pesan = String(err?.message ?? '')
  const rinci = String(err?.details ?? '')
  const gabungan = `${pesan} ${rinci}`

  if (kode === '42501' || /row-level security|insufficient_privilege|permission denied/i.test(gabungan)) {
    return 'Anda tidak berwenang mengisi data ini'
  }
  if (kode === '23514' || /violates check constraint/i.test(gabungan)) {
    const m = /check constraint "([^"]+)"/i.exec(gabungan)
    const nama = m?.[1] ?? ''
    const kol = ds?.kolom.find(k => nama.includes(k.nama))
    if (kol) {
      const pilihan = kol.nilaiSah?.length ? ` Pilihan yang sah: ${kol.nilaiSah.join(', ')}.` : ''
      return `Nilai pada kolom "${kol.label}" tidak sah menurut aturan basis data.${pilihan}`
    }
    return `Ada nilai yang tidak sah menurut aturan basis data${nama ? ` (aturan "${nama}")` : ''}. Periksa kembali isian baris ini.`
  }
  if (kode === '23505' || /duplicate key value|unique constraint/i.test(gabungan)) {
    const kunci = ds?.kunciAlami?.length
      ? ds.kunciAlami.map(k => ds.kolom.find(c => c.nama === k)?.label ?? k).join(' + ')
      : ''
    return `Data dengan kunci ini sudah ada${kunci ? ` (${kunci})` : ''}`
  }
  if (kode === '23503' || /foreign key constraint/i.test(gabungan)) {
    return 'Ada nilai rujukan yang tidak ditemukan di data induk. Lengkapi data induknya lebih dulu.'
  }
  if (kode === '23502' || /null value in column/i.test(gabungan)) {
    const m = /null value in column "([^"]+)"/i.exec(gabungan)
    const kol = ds?.kolom.find(k => k.nama === m?.[1])
    return `Kolom "${kol?.label ?? m?.[1] ?? 'wajib'}" tidak boleh kosong`
  }
  if (kode === '22P02' || /invalid input syntax/i.test(gabungan)) {
    return 'Ada nilai yang bentuknya tidak sesuai (mis. angka atau tanggal ditulis dengan huruf). Periksa kembali baris ini.'
  }
  if (kode === 'PGRST204' || /could not find the .* column/i.test(gabungan)) {
    return 'Struktur data di server berbeda dengan template. Hubungi administrator untuk memperbarui template impor.'
  }
  if (/failed to fetch|networkerror|load failed/i.test(pesan)) {
    return 'Sambungan ke server terputus. Periksa koneksi internet lalu ulangi impor.'
  }
  return pesan || 'Terjadi kesalahan yang tidak dikenali saat menyimpan data'
}

/* --------------------------------------------------------------- penyisipan */

export type LaporKemajuan = (dikerjakan: number, total: number) => void

/** Kolom virtual "custom.<kunci>" (field kustom) dan "data.<kunci>" (tabel kustom)
 *  digabung menjadi objek jsonb sebelum dikirim. */
export function lipatKolomVirtual(isi: Record<string, unknown>, ds: Dataset): Record<string, unknown> {
  const hasil: Record<string, unknown> = {}
  const custom: Record<string, unknown> = {}
  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(isi)) {
    if (k.startsWith('custom.')) custom[k.slice(7)] = v
    else if (k.startsWith('data.')) data[k.slice(5)] = v
    else hasil[k] = v
  }
  if (Object.keys(custom).length) hasil.custom = custom
  if (ds.tabel === 'custom_records') { hasil.data = data; hasil.table_id = ds.tableId }
  return hasil
}

async function kirimBatch(ds: Dataset, isi: Record<string, unknown>[], batchId?: string) {
  const rows = isi.map(r => lipatKolomVirtual(r, ds))
  let q: any = ds.konflikUpsert
    ? supabase.from(ds.tabel).upsert(rows, { onConflict: ds.konflikUpsert })
    : supabase.from(ds.tabel).insert(rows)
  // Header ini dibaca trigger fn_lacak_impor() -> baris tercatat di batch & bisa di-rollback.
  if (batchId) q = q.setHeader('x-nk-import-batch', batchId)
  const { error } = await q
  if (error) throw error
}

/** Membuka batch impor baru (tercatat, bisa dibatalkan). Null bila tabel batch belum tersedia. */
export async function bukaBatch(ds: Dataset, namaBerkas: string, total: number, mode: 'lewati' | 'semua_atau_batal'): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('import_batches').insert({
    dataset: ds.kode, tabel: ds.tabel, modul: ds.modul, nama_berkas: namaBerkas, total_baris: total, mode,
    created_by: u.user?.id,
  }).select('id').single()
  if (error) {
    if (/relation .* does not exist|PGRST205/i.test(`${error.code} ${error.message}`)) return null
    throw error
  }
  return (data as { id: string }).id
}

export async function tutupBatch(batchId: string, h: HasilImpor) {
  await supabase.rpc('fn_tutup_batch_impor', {
    p_batch: batchId, p_berhasil: h.berhasil, p_dilewati: h.dilewati, p_gagal: h.gagal,
    p_ringkasan: { contoh_gagal: h.barisGagal.slice(0, 20).map(g => ({ baris: g.nomor, alasan: g.alasan })) },
  })
}

export async function rollbackBatch(batchId: string): Promise<{ dihapus: number; dipulihkan: number; gagal: unknown[] }> {
  const { data, error } = await supabase.rpc('fn_rollback_impor', { p_batch: batchId })
  if (error) throw error
  return data as { dihapus: number; dipulihkan: number; gagal: unknown[] }
}

/** Menyisipkan baris terpilih secara bertahap. Batch yang gagal dicoba ulang per baris.
 *  Mode "semua_atau_batal": begitu ada satu baris ditolak server, seluruh batch di-rollback. */
export async function jalankanImpor(
  ds: Dataset,
  baris: BarisTervalidasi[],
  companyId: string,
  lapor: LaporKemajuan,
  opsi: { batchId?: string | null; mode?: 'lewati' | 'semua_atau_batal' } = {},
): Promise<HasilImpor> {
  const hasil: HasilImpor = { berhasil: 0, dilewati: 0, gagal: 0, barisGagal: [], batchId: opsi.batchId ?? null }
  const total = baris.length
  let dikerjakan = 0
  lapor(0, total)
  const batchId = opsi.batchId ?? undefined

  for (let i = 0; i < baris.length; i += UKURAN_BATCH) {
    const potongan = baris.slice(i, i + UKURAN_BATCH)
    const isi = potongan.map(b => ({ ...b.isi, company_id: companyId }))
    try {
      await kirimBatch(ds, isi, batchId)
      hasil.berhasil += potongan.length
    } catch (e) {
      // Satu baris buruk menjatuhkan seluruh batch — ulangi satu per satu supaya
      // hanya baris yang benar-benar bermasalah yang gagal.
      for (const b of potongan) {
        try {
          await kirimBatch(ds, [{ ...b.isi, company_id: companyId }], batchId)
          hasil.berhasil++
        } catch (e2) {
          hasil.gagal++
          hasil.barisGagal.push({ nomor: b.nomor, mentah: b.mentah, alasan: pesanGalatImpor(e2, ds) })
        }
      }
    }
    dikerjakan += potongan.length
    lapor(dikerjakan, total)
    if (opsi.mode === 'semua_atau_batal' && hasil.gagal > 0) break
  }

  if (batchId && opsi.mode === 'semua_atau_batal' && hasil.gagal > 0) {
    await tutupBatch(batchId, hasil)
    const rb = await rollbackBatch(batchId)
    hasil.dibatalkan = true
    hasil.catatanRollback = `${hasil.gagal} baris ditolak server, sehingga seluruh impor dibatalkan otomatis: ${rb.dihapus} baris baru dihapus, ${rb.dipulihkan} baris dikembalikan ke nilai lama.`
    hasil.berhasil = 0
    return hasil
  }
  if (batchId) await tutupBatch(batchId, hasil)
  return hasil
}

/* ------------------------------------------------------- kasus khusus: WFP */

type BarisMuat = { langkah: string; jumlah: number }
type BarisKonflik = { jenis_konflik: string; jumlah: number }
type BarisInbox = { modul: string; jenis: string; dibuat: number; diperbarui: number; ditutup: number }

/**
 * Tabel singgah stg_wfp sedang dalam masa peralihan: versi lama tidak punya
 * kolom company_id (dikunci ke Super Admin), versi baru punya dan terbuka untuk
 * staf HR. Kita periksa sekali di awal supaya panel bekerja pada kedua versi
 * tanpa menunggu migrasi dipasang.
 */
async function stgPunyaCompanyId(): Promise<boolean> {
  const { error } = await supabase.from('stg_wfp').select('company_id').limit(1)
  if (!error) return true
  const kode = String((error as { code?: string }).code ?? '')
  const pesan = String(error.message ?? '')
  if (kode === '42703' || kode === 'PGRST204' || /company_id/i.test(pesan)) return false
  throw error
}

/** Galat "fungsi tidak dikenali" — dipakai untuk mencoba tanda tangan RPC yang lain. */
function fungsiTidakCocok(e: unknown): boolean {
  const err = e as { code?: string; message?: string }
  const kode = String(err?.code ?? '')
  return kode === 'PGRST202' || kode === '42883' ||
    /could not find the function|does not exist|no function matches/i.test(String(err?.message ?? ''))
}

/**
 * Memanggil RPC yang tanda tangannya sedang berubah: coba dulu dengan
 * p_company_id (versi baru), lalu tanpa argumen (versi lama).
 */
async function panggilRpcWfp(nama: string, companyId: string) {
  const pertama = await supabase.rpc(nama, { p_company_id: companyId })
  if (!pertama.error) return pertama
  if (!fungsiTidakCocok(pertama.error)) return pertama
  return await supabase.rpc(nama)
}

/**
 * Dataset "Karyawan & Formasi (WFP)": isi tabel singgah stg_wfp, lalu panggil
 * fn_muat_karyawan_wfp(), fn_inbox_konflik_wfp(), dan fn_bangun_inbox_kerja().
 * Tabel singgah dikosongkan lebih dulu supaya satu berkas = satu angkatan.
 */
export async function jalankanImporWfp(
  ds: Dataset,
  baris: BarisTervalidasi[],
  companyId: string,
  lapor: LaporKemajuan,
): Promise<HasilImpor> {
  const hasil: HasilImpor = { berhasil: 0, dilewati: 0, gagal: 0, barisGagal: [] }
  const total = baris.length
  lapor(0, total)

  let adaCompanyId: boolean
  try { adaCompanyId = await stgPunyaCompanyId() }
  catch (e) { throw new Error(pesanGalatImpor(e, ds)) }

  const susun = (b: BarisTervalidasi, nomor: number) =>
    adaCompanyId ? { ...b.isi, baris: nomor, company_id: companyId } : { ...b.isi, baris: nomor }

  const hapus = supabase.from('stg_wfp').delete()
  const { error: errHapus } = adaCompanyId
    ? await hapus.eq('company_id', companyId)
    : await hapus.gte('baris', 0)
  if (errHapus) throw new Error(pesanGalatImpor(errHapus, ds))

  let dikerjakan = 0
  for (let i = 0; i < baris.length; i += UKURAN_BATCH) {
    const potongan = baris.slice(i, i + UKURAN_BATCH)
    const { error } = await supabase.from('stg_wfp').insert(potongan.map((b, j) => susun(b, i + j + 1)))
    if (error) {
      // Satu baris buruk menjatuhkan seluruh batch — ulangi satu per satu.
      for (const [j, b] of potongan.entries()) {
        const { error: e2 } = await supabase.from('stg_wfp').insert([susun(b, i + j + 1)])
        if (e2) { hasil.gagal++; hasil.barisGagal.push({ nomor: b.nomor, mentah: b.mentah, alasan: pesanGalatImpor(e2, ds) }) }
        else hasil.berhasil++
      }
    } else hasil.berhasil += potongan.length
    dikerjakan += potongan.length
    lapor(dikerjakan, total)
  }

  if (hasil.berhasil === 0) return hasil

  const muat = await panggilRpcWfp('fn_muat_karyawan_wfp', companyId)
  if (muat.error) throw new Error(pesanGalatImpor(muat.error, ds))
  const konflik = await panggilRpcWfp('fn_inbox_konflik_wfp', companyId)
  if (konflik.error) throw new Error(pesanGalatImpor(konflik.error, ds))
  const inbox = await supabase.rpc('fn_bangun_inbox_kerja', { p_company_id: companyId })
  if (inbox.error) throw new Error(pesanGalatImpor(inbox.error, ds))

  hasil.ringkasanWfp = {
    muat: (muat.data ?? []) as BarisMuat[],
    konflik: (konflik.data ?? []) as BarisKonflik[],
    inbox: (inbox.data ?? []) as BarisInbox[],
  }
  return hasil
}
