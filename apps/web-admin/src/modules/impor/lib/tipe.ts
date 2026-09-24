/** Tipe bersama Pusat Impor Data. Dipakai oleh skema-dataset.ts (dibangkitkan otomatis),
 *  parser berkas, validator, dan mesin impor. */

/** Tipe nilai sebuah kolom template, diturunkan dari tipe kolom basis data. */
export type TipeKolom =
  | 'teks'      // text / varchar / uuid apa adanya
  | 'angka'     // numeric — boleh desimal
  | 'bilangan'  // integer — harus bulat
  | 'boolean'   // ya/tidak, true/false, 1/0
  | 'tanggal'   // YYYY-MM-DD atau DD/MM/YYYY
  | 'jam'       // HH:MM atau HH:MM:SS
  | 'waktu'     // tanggal + jam
  | 'daftar'    // text[] — beberapa nilai dipisah tanda |
  | 'json'      // jsonb
  | 'lookup'    // kolom penunjuk (FK): pengguna mengisi nama/kode, sistem mencarikan id-nya

/** Cara menerjemahkan teks yang diketik pengguna menjadi id baris tabel lain. */
export type Lookup = {
  /** Tabel tujuan penunjuk (FK). */
  tabel: string
  /** Kolom-kolom yang boleh dipakai mencari, mis. ['name','code','city']. */
  kolomCari: string[]
  /** Kolom yang nilainya disalin ke kolom penunjuk — praktis selalu 'id'. */
  kolomIsi: string
  /** Sebutan Bahasa Indonesia untuk pesan galat, mis. 'Cabang'. */
  label: string
}

export type KolomDataset = {
  /** Nama kolom di tabel tujuan. */
  nama: string
  /** Judul kolom pada template — inilah yang dibaca pengguna. */
  label: string
  wajib: boolean
  tipe: TipeKolom
  /** Daftar nilai sah dari CHECK constraint, bila kolom ini dibatasi. */
  nilaiSah?: string[]
  lookup?: Lookup
}

export type Dataset = {
  kode: string
  label: string
  keterangan: string
  /** Tabel tujuan penyisipan. Untuk dataset WFP ini tabel singgah `stg_wfp`. */
  tabel: string
  /** Kode modul hak akses (role_module_access.module_code). */
  modul: string
  /** Penanganan khusus: 'wfp' menjalankan rangkaian RPC sesudah unggah. */
  khusus?: 'wfp'
  /** Catatan tambahan yang ditampilkan di layar pemilihan dataset. */
  catatan?: string
  /** Kunci alami (tanpa company_id) — dipakai mendeteksi duplikat. */
  kunciAlami?: string[] | null
  /** Target ON CONFLICT untuk upsert, mis. 'company_id,code'. Null = sisip biasa. */
  konflikUpsert?: string | null
  kolom: KolomDataset[]
  /** Untuk dataset tabel kustom: id baris custom_tables. */
  tableId?: string
  /** Dataset dibangkitkan saat berjalan (field/tabel kustom tenant). */
  dinamis?: boolean
  /** Dua baris contoh, dikunci dengan nama kolom basis data. */
  contoh: Record<string, string>[]
}

/** Satu baris mentah hasil pembacaan berkas: judul kolom berkas -> nilai teks. */
export type BarisBerkas = Record<string, string>

/** Hasil pembacaan satu berkas CSV/XLSX. */
export type BerkasTerbaca = {
  namaBerkas: string
  judul: string[]
  baris: BarisBerkas[]
}

export type TingkatMasalah = 'galat' | 'peringatan'

export type Masalah = {
  kolom: string | null
  pesan: string
  tingkat: TingkatMasalah
}

/** Satu baris sesudah dipetakan, diubah tipenya, dan divalidasi. */
export type BarisTervalidasi = {
  /** Nomor baris pada berkas asli (1 = baris data pertama, di luar baris judul). */
  nomor: number
  /** Nilai apa adanya dari berkas, untuk ditampilkan dan diekspor ulang. */
  mentah: BarisBerkas
  /** Nilai siap kirim ke basis data (lookup sudah jadi id). */
  isi: Record<string, unknown>
  masalah: Masalah[]
  /** Kunci alami baris ini, untuk deteksi duplikat. Null bila dataset tak punya kunci. */
  kunci: string | null
}

export type RingkasanValidasi = {
  baris: BarisTervalidasi[]
  siap: number
  bermasalah: number
  akanDiperbarui: number
}

export type HasilImpor = {
  berhasil: number
  dilewati: number
  gagal: number
  barisGagal: { nomor: number; mentah: BarisBerkas; alasan: string }[]
  /** Id batch impor (bisa di-rollback dari Riwayat Impor). */
  batchId?: string | null
  /** True bila impor dibatalkan otomatis (mode semua-atau-batal). */
  dibatalkan?: boolean
  catatanRollback?: string
  /** Ringkasan RPC untuk dataset WFP. */
  ringkasanWfp?: {
    muat: { langkah: string; jumlah: number }[]
    konflik: { jenis_konflik: string; jumlah: number }[]
    inbox: { modul: string; jenis: string; dibuat: number; diperbarui: number; ditutup: number }[]
  }
}
