import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Upload, FileSpreadsheet, FileDown, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight,
  RotateCcw, Database, Info, X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  PageHeader, Card, SectionCard, Button, Field, Select, Badge, EmptyState, Stepper, Progress,
  useToast, cx,
} from '@/components/ui'
import { DATASET } from '../lib/skema-dataset'
import { muatDefField, muatTabelKustom, susunDataset } from '../lib/dataset-dinamis'
import RiwayatImpor from './RiwayatImpor'
import type { BarisTervalidasi, BerkasTerbaca, Dataset, HasilImpor, RingkasanValidasi } from '../lib/tipe'
import { bacaBerkas, susunCsv, unduhCsv } from '../lib/parser-berkas'
import { unduhTemplateCsv, unduhTemplateExcel } from '../lib/template'
import { petakanOtomatis, wajibBelumDipetakan, type Pemetaan } from '../lib/pemetaan'
import {
  jalankanImpor, jalankanImporWfp, muatIndeksLookup, muatKunciAda, pesanGalatImpor, validasiSemua,
  bukaBatch, rollbackBatch, type IndeksLookup,
} from '../lib/mesin-impor'

const LANGKAH: string[] = [
  'Pilih Data', 'Unduh Template', 'Unggah Berkas', 'Petakan Kolom',
  'Pratinjau & Periksa', 'Impor', 'Hasil',
]

const MODUL_LABEL: Record<string, string> = {
  CORE: 'Core & Administrasi', HR: 'Human Resource', PAYROLL: 'Payroll',
  COMMERCE: 'Commerce', PROCUREMENT: 'Procurement', FINANCE: 'Finance',
  INVENTORY: 'Inventory', ASSET: 'Aset', OPERATIONS: 'Operations', DEPLOYMENT: 'Deployment',
}

const BARIS_PRATINJAU = 50

type ModeGalat = 'lewati' | 'batal'

export default function PusatImpor() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [langkah, setLangkah] = useState(0)
  const [kodeDataset, setKodeDataset] = useState('')
  const [berkas, setBerkas] = useState<BerkasTerbaca | null>(null)
  const [peta, setPeta] = useState<Pemetaan>({})
  const [indeks, setIndeks] = useState<IndeksLookup>({})
  const [kunciAda, setKunciAda] = useState<Set<string>>(new Set())
  const [ringkasan, setRingkasan] = useState<RingkasanValidasi | null>(null)
  const [modeGalat, setModeGalat] = useState<ModeGalat>('lewati')
  const [sibuk, setSibuk] = useState(false)
  const [pesanSibuk, setPesanSibuk] = useState('')
  const [kemajuan, setKemajuan] = useState({ dikerjakan: 0, total: 0 })
  const [hasil, setHasil] = useState<HasilImpor | null>(null)
  const [seret, setSeret] = useState(false)
  const inputBerkas = useRef<HTMLInputElement>(null)

  /** Dataset statis + kolom field kustom + tabel kustom milik tenant (dibaca saat berjalan). */
  const [semuaDataset, setSemuaDataset] = useState<Dataset[]>(DATASET)
  const [muatUlangRiwayat, setMuatUlangRiwayat] = useState(0)
  useEffect(() => {
    let batal = false
    Promise.all([muatDefField(), muatTabelKustom()]).then(([defs, tabel]) => {
      if (!batal) setSemuaDataset(susunDataset(DATASET, defs, tabel))
    })
    return () => { batal = true }
  }, [profile?.company_id])

  /** Dataset yang boleh diisi pengguna ini. */
  const datasetBoleh = useMemo(() => semuaDataset.filter(d => can(d.modul, 'write')), [semuaDataset, profile, can])
  const ds: Dataset | undefined = useMemo(() => semuaDataset.find(d => d.kode === kodeDataset), [kodeDataset, semuaDataset])

  /** Dataset bisa ditentukan dari alamat, mis. dari tombol di halaman Karyawan. */
  useEffect(() => {
    const dari = params.get('dataset')
    if (dari && dari !== kodeDataset && datasetBoleh.some(d => d.kode === dari)) {
      setKodeDataset(dari)
      setLangkah(1)
    }
  }, [params, datasetBoleh]) // eslint-disable-line react-hooks/exhaustive-deps

  const ulangDariAwal = useCallback(() => {
    setLangkah(0); setKodeDataset(''); setBerkas(null); setPeta({}); setIndeks({})
    setKunciAda(new Set()); setRingkasan(null); setHasil(null); setKemajuan({ dikerjakan: 0, total: 0 })
    if (params.get('dataset')) { params.delete('dataset'); setParams(params, { replace: true }) }
  }, [params, setParams])

  const pilihDataset = (kode: string) => {
    setKodeDataset(kode); setBerkas(null); setPeta({}); setRingkasan(null); setHasil(null)
    setLangkah(1)
  }

  /* ------------------------------------------------------------ unggah berkas */
  const terimaBerkas = async (f: File | null | undefined) => {
    if (!f || !ds) return
    setSibuk(true); setPesanSibuk('Membaca berkas…')
    try {
      const hasilBaca = await bacaBerkas(f)
      if (!hasilBaca.judul.length) throw new Error('Berkas tidak memiliki baris judul kolom.')
      if (!hasilBaca.baris.length) throw new Error('Berkas tidak memiliki baris data. Isi minimal satu baris di bawah judul kolom.')
      setBerkas(hasilBaca)
      setPeta(petakanOtomatis(ds, hasilBaca.judul))
      setRingkasan(null)
      setLangkah(3)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Berkas gagal dibaca', 'error')
    } finally { setSibuk(false); setPesanSibuk('') }
  }

  /* ------------------------------------------------------ pratinjau & validasi */
  const periksaBerkas = async () => {
    if (!ds || !berkas || !profile?.company_id) return
    const kurang = wajibBelumDipetakan(ds, peta)
    if (kurang.length) {
      toast.push(`Kolom wajib belum dipasangkan: ${kurang.join(', ')}`, 'error')
      return
    }
    setSibuk(true); setPesanSibuk('Mencocokkan data rujukan…')
    try {
      const idx = await muatIndeksLookup(ds, profile.company_id)
      const kunci = await muatKunciAda(ds, profile.company_id)
      setIndeks(idx); setKunciAda(kunci)
      setRingkasan(validasiSemua(ds, berkas.baris, peta, idx, kunci))
      setLangkah(4)
    } catch (e) {
      toast.push(pesanGalatImpor(e, ds), 'error')
    } finally { setSibuk(false); setPesanSibuk('') }
  }

  const barisSiap = useMemo(
    () => (ringkasan?.baris ?? []).filter(b => !b.masalah.some(m => m.tingkat === 'galat')),
    [ringkasan])

  /* --------------------------------------------------------------- jalankan */
  const mulaiImpor = async () => {
    if (!ds || !ringkasan || !profile?.company_id) return
    if (modeGalat === 'batal' && ringkasan.bermasalah > 0) {
      toast.push('Impor dibatalkan karena masih ada baris bermasalah.', 'error')
      return
    }
    if (!barisSiap.length) { toast.push('Tidak ada baris yang siap diimpor.', 'error'); return }

    setSibuk(true); setPesanSibuk('Menyimpan data…'); setLangkah(5)
    setKemajuan({ dikerjakan: 0, total: barisSiap.length })
    try {
      const lapor = (dikerjakan: number, total: number) => setKemajuan({ dikerjakan, total })
      const mode = modeGalat === 'batal' ? 'semua_atau_batal' as const : 'lewati' as const
      const batchId = ds.khusus === 'wfp' ? null : await bukaBatch(ds, berkas?.namaBerkas ?? '', barisSiap.length, mode)
      const r = ds.khusus === 'wfp'
        ? await jalankanImporWfp(ds, barisSiap, profile.company_id, lapor)
        : await jalankanImpor(ds, barisSiap, profile.company_id, lapor, { batchId, mode })
      setMuatUlangRiwayat(x => x + 1)
      r.dilewati = ringkasan.bermasalah
      setHasil(r)
      setLangkah(6)
      if (r.dibatalkan) toast.push('Impor dibatalkan otomatis karena ada baris yang ditolak server.', 'error')
      else if (r.gagal === 0) toast.push(`${r.berhasil} baris berhasil diimpor.`, 'success')
      else toast.push(`${r.berhasil} baris masuk, ${r.gagal} baris gagal.`, 'info')
    } catch (e) {
      toast.push(e instanceof Error ? e.message : pesanGalatImpor(e, ds), 'error')
      setLangkah(4)
    } finally { setSibuk(false); setPesanSibuk('') }
  }

  /* ----------------------------------------------------- unduh baris bermasalah */
  const unduhBarisGagal = (sumber: { nomor: number; alasan: string; mentah: Record<string, string> }[]) => {
    if (!berkas || !sumber.length) return
    const judul = [...berkas.judul, 'Baris ke-', 'Alasan Gagal']
    const baris = sumber.map(g => [...berkas.judul.map(h => g.mentah[h] ?? ''), String(g.nomor), g.alasan])
    unduhCsv(`baris-gagal-${ds?.kode ?? 'impor'}.csv`, susunCsv(judul, baris))
  }

  const unduhBarisBermasalah = () => {
    if (!ringkasan) return
    const sumber = ringkasan.baris
      .filter(b => b.masalah.some(m => m.tingkat === 'galat'))
      .map(b => ({ nomor: b.nomor, mentah: b.mentah, alasan: b.masalah.filter(m => m.tingkat === 'galat').map(m => m.pesan).join('; ') }))
    unduhBarisGagal(sumber)
  }

  /* ------------------------------------------------------------------ tampilan */
  return (
    <div className="space-y-5">
      <PageHeader
        title="Pusat Impor Data"
        subtitle="Isi seluruh data master dari berkas Excel atau CSV — tanpa perlu membuka basis data."
        breadcrumb={['Pengaturan', 'Impor Data']}
        actions={langkah > 0 ? <Button variant="outline" icon={<RotateCcw size={15} />} onClick={ulangDariAwal}>Mulai Ulang</Button> : null}
      />

      <Card className="p-4">
        <Stepper steps={LANGKAH} current={langkah} />
      </Card>

      {sibuk && pesanSibuk && (
        <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-4 py-2.5 text-body text-primary-700">
          <Info size={15} /> {pesanSibuk}
        </div>
      )}

      {/* --- a. pilih dataset --- */}
      {langkah === 0 && (
        <SectionCard title="1. Pilih data yang mau diisi" subtitle="Hanya data yang boleh Anda isi yang ditampilkan.">
          {datasetBoleh.length === 0 ? (
            <EmptyState
              title="Belum ada data yang boleh Anda isi"
              message="Hak akses akun Anda belum mengizinkan pengisian data master mana pun. Hubungi administrator."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {datasetBoleh.map(d => (
                <button key={d.kode} onClick={() => pilihDataset(d.kode)}
                  className="text-left rounded-md border border-ink-200 bg-surface p-4 hover:border-primary-400 hover:shadow-e1 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-ink-900">{d.label}</span>
                    <Badge tone="teal">{MODUL_LABEL[d.modul] ?? d.modul}</Badge>
                  </div>
                  <p className="mt-1.5 text-caption text-ink-500 leading-snug">{d.keterangan}</p>
                  <p className="mt-2 text-caption text-ink-400">
                    {d.kolom.length} kolom · {d.kolom.filter(k => k.wajib).length} wajib
                    {d.kunciAlami ? ' · impor ulang memperbarui data lama' : ''}
                  </p>
                  {d.kolom.some(k => k.nama.startsWith('custom.')) && (
                    <p className="mt-1 text-caption text-primary-600">+ {d.kolom.filter(k => k.nama.startsWith('custom.')).length} field kustom perusahaan Anda</p>)}
                </button>
              ))}
            </div>
          )}
          <p className="mt-4 text-caption text-ink-500">
            Urutan yang disarankan untuk workspace baru: <b>Cabang → Karyawan & Teknisi → Pelanggan → Kontrak → Jenis Pekerjaan → Gudang & Katalog Item → Saldo Stok → Work Order → Invoice</b>.
            Data rujukan (mis. nama cabang) harus sudah ada sebelum data yang merujuknya diimpor.
          </p>
        </SectionCard>
      )}
      {langkah === 0 && <RiwayatImpor muatUlang={muatUlangRiwayat} />}

      {/* --- b. unduh template --- */}
      {langkah === 1 && ds && (
        <SectionCard title={`2. Unduh template — ${ds.label}`}
          subtitle="Template berisi baris judul, dua baris contoh, dan satu baris keterangan kolom wajib.">
          <p className="text-body text-ink-600">{ds.keterangan}</p>
          {ds.catatan && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-caption text-amber-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span>{ds.catatan}</span>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon={<FileDown size={16} />} onClick={() => unduhTemplateCsv(ds)}>Unduh Template CSV</Button>
            <Button variant="outline" icon={<FileSpreadsheet size={16} />}
              onClick={async () => {
                try { await unduhTemplateExcel(ds) }
                catch { toast.push('Template Excel gagal dibuat. Coba template CSV.', 'error') }
              }}>Unduh Template Excel</Button>
          </div>

          <div className="mt-5 overflow-auto rounded-md border border-ink-200">
            <table className="w-full text-caption">
              <thead className="bg-ink-50">
                <tr>
                  <th className="px-3 h-9 text-left font-semibold text-ink-500">Kolom</th>
                  <th className="px-3 h-9 text-left font-semibold text-ink-500">Wajib</th>
                  <th className="px-3 h-9 text-left font-semibold text-ink-500">Cara mengisi</th>
                </tr>
              </thead>
              <tbody>
                {ds.kolom.map(k => (
                  <tr key={k.nama} className="border-t border-ink-100">
                    <td className="px-3 py-2 text-ink-800 font-medium">{k.label}</td>
                    <td className="px-3 py-2">{k.wajib ? <Badge tone="red">Wajib</Badge> : <span className="text-ink-400">Opsional</span>}</td>
                    <td className="px-3 py-2 text-ink-500">
                      {k.nilaiSah?.length ? `Pilih salah satu: ${k.nilaiSah.join(' / ')}`
                        : k.lookup ? `Isi nama atau kode ${k.lookup.label.toLowerCase()} yang sudah terdaftar`
                        : k.tipe === 'tanggal' ? 'Format 2026-01-31 atau 31/01/2026'
                        : k.tipe === 'jam' ? 'Format 08:00'
                        : k.tipe === 'boolean' ? 'Isi ya atau tidak'
                        : k.tipe === 'daftar' ? 'Beberapa nilai dipisahkan tanda |'
                        : k.tipe === 'angka' || k.tipe === 'bilangan' ? 'Angka saja, tanpa Rp'
                        : 'Teks bebas'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-between">
            <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => setLangkah(0)}>Ganti data</Button>
            <Button icon={<ArrowRight size={15} />} onClick={() => setLangkah(2)}>Lanjut ke unggah</Button>
          </div>
        </SectionCard>
      )}

      {/* --- c. unggah berkas --- */}
      {langkah === 2 && ds && (
        <SectionCard title={`3. Unggah berkas — ${ds.label}`} subtitle="Seret berkas ke kotak di bawah, atau pilih dari komputer Anda.">
          <div
            onDragOver={e => { e.preventDefault(); setSeret(true) }}
            onDragLeave={() => setSeret(false)}
            onDrop={e => { e.preventDefault(); setSeret(false); void terimaBerkas(e.dataTransfer.files?.[0]) }}
            className={cx('rounded-md border-2 border-dashed p-10 text-center transition-colors',
              seret ? 'border-primary-500 bg-primary-50' : 'border-ink-200 bg-ink-50')}>
            <Upload size={28} className="mx-auto text-ink-400" />
            <p className="mt-3 text-body font-medium text-ink-700">Seret berkas .xlsx atau .csv ke sini</p>
            <p className="mt-1 text-caption text-ink-400">Berkas dibaca di peramban Anda; tidak ada data yang dikirim sebelum Anda menekan tombol Impor.</p>
            <p className="mt-1 text-caption text-ink-400">Hapus dua baris contoh pada template sebelum mengunggah. Baris keterangan di bawahnya akan diabaikan otomatis.</p>
            <div className="mt-4">
              <Button variant="outline" loading={sibuk} onClick={() => inputBerkas.current?.click()}>Pilih Berkas</Button>
              <input ref={inputBerkas} type="file" accept=".csv,.xlsx,.xls,.xlsm,.txt" className="hidden"
                onChange={e => { void terimaBerkas(e.target.files?.[0]); e.target.value = '' }} />
            </div>
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => setLangkah(1)}>Kembali ke template</Button>
          </div>
        </SectionCard>
      )}

      {/* --- d. pemetaan kolom --- */}
      {langkah === 3 && ds && berkas && (
        <SectionCard title="4. Pasangkan kolom berkas"
          subtitle={`Berkas "${berkas.namaBerkas}" terbaca ${berkas.baris.length} baris dan ${berkas.judul.length} kolom.`}>
          <p className="text-caption text-ink-500">
            Kolom berkas sudah dicocokkan otomatis. Betulkan pasangan yang salah lewat daftar pilihan di kanan.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ds.kolom.map(k => {
              const kosongWajib = k.wajib && !peta[k.nama]
              return (
                <Field key={k.nama} label={k.label} required={k.wajib}
                  error={kosongWajib ? 'Kolom wajib ini belum dipasangkan' : undefined}>
                  <Select
                    value={peta[k.nama] ?? ''}
                    placeholder="— tidak diisi —"
                    options={berkas.judul.map(j => ({ value: j, label: j }))}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setPeta(p => ({ ...p, [k.nama]: e.target.value || null }))}
                  />
                </Field>
              )
            })}
          </div>
          <div className="mt-5 flex justify-between">
            <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => setLangkah(2)}>Ganti berkas</Button>
            <Button icon={<ArrowRight size={15} />} loading={sibuk} onClick={() => void periksaBerkas()}>Periksa Data</Button>
          </div>
        </SectionCard>
      )}

      {/* --- e + f. pratinjau, validasi, konfirmasi --- */}
      {langkah === 4 && ds && ringkasan && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <div className="text-caption text-ink-400">Siap diimpor</div>
              <div className="mt-1 text-2xl font-bold text-emerald-600 tabular">{ringkasan.siap}</div>
            </Card>
            <Card className="p-4">
              <div className="text-caption text-ink-400">Bermasalah</div>
              <div className={cx('mt-1 text-2xl font-bold tabular', ringkasan.bermasalah ? 'text-red-600' : 'text-ink-400')}>{ringkasan.bermasalah}</div>
            </Card>
            <Card className="p-4">
              <div className="text-caption text-ink-400">Memperbarui data lama</div>
              <div className="mt-1 text-2xl font-bold text-amber-600 tabular">{ringkasan.akanDiperbarui}</div>
            </Card>
          </div>

          <SectionCard title="5. Pratinjau & pemeriksaan"
            subtitle={`Menampilkan ${Math.min(BARIS_PRATINJAU, ringkasan.baris.length)} baris pertama dari ${ringkasan.baris.length} baris.`}
            action={ringkasan.bermasalah > 0
              ? <Button size="sm" variant="outline" icon={<FileDown size={14} />} onClick={unduhBarisBermasalah}>Unduh baris bermasalah</Button>
              : null}>
            <div className="overflow-auto max-h-[52vh] rounded-md border border-ink-200">
              <table className="w-full text-caption border-separate border-spacing-0">
                <thead className="bg-ink-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 h-9 text-left font-semibold text-ink-500 border-b border-ink-200">#</th>
                    <th className="px-2 h-9 text-left font-semibold text-ink-500 border-b border-ink-200 min-w-[220px]">Keterangan</th>
                    {ds.kolom.map(k => (
                      <th key={k.nama} className="px-2 h-9 text-left font-semibold text-ink-500 whitespace-nowrap border-b border-ink-200">{k.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ringkasan.baris.slice(0, BARIS_PRATINJAU).map(b => <BarisPratinjau key={b.nomor} baris={b} ds={ds} peta={peta} />)}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="6. Konfirmasi impor">
            <div className="space-y-2">
              {([
                { v: 'lewati' as ModeGalat, judul: 'Lewati baris bermasalah', ket: `Impor ${ringkasan.siap} baris yang sudah benar, abaikan ${ringkasan.bermasalah} baris bermasalah.` },
                { v: 'batal' as ModeGalat, judul: 'Batalkan semua bila ada yang bermasalah', ket: 'Tidak ada data yang masuk selama masih ada baris bermasalah.' },
              ]).map(o => (
                <label key={o.v} className={cx('flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                  modeGalat === o.v ? 'border-primary-400 bg-primary-50' : 'border-ink-200 hover:border-ink-300')}>
                  <input type="radio" name="mode-galat" className="mt-1" checked={modeGalat === o.v} onChange={() => setModeGalat(o.v)} />
                  <span>
                    <span className="block text-body font-semibold text-ink-800">{o.judul}</span>
                    <span className="block text-caption text-ink-500">{o.ket}</span>
                  </span>
                </label>
              ))}
            </div>
            {ds.kunciAlami && (
              <p className="mt-3 text-caption text-ink-500">
                Data dicocokkan dengan kunci <strong>{ds.kunciAlami.join(' + ')}</strong>. Mengunggah berkas yang sama dua kali
                memperbarui data lama, bukan menggandakannya.
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-between gap-2">
              <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => setLangkah(3)}>Betulkan pemetaan</Button>
              <Button icon={<Database size={16} />} loading={sibuk}
                disabled={modeGalat === 'batal' && ringkasan.bermasalah > 0}
                onClick={() => void mulaiImpor()}>
                Impor {modeGalat === 'batal' ? ringkasan.baris.length : ringkasan.siap} Baris
              </Button>
            </div>
            {modeGalat === 'batal' && ringkasan.bermasalah > 0 && (
              <p className="mt-2 text-caption text-red-600">
                Masih ada {ringkasan.bermasalah} baris bermasalah. Betulkan berkasnya lalu unggah ulang, atau pilih "Lewati baris bermasalah".
              </p>
            )}
          </SectionCard>
        </div>
      )}

      {/* --- proses --- */}
      {langkah === 5 && (
        <SectionCard title="Sedang mengimpor" subtitle="Jangan tutup halaman ini sampai selesai.">
          <Progress value={kemajuan.total ? (kemajuan.dikerjakan / kemajuan.total) * 100 : 0} height={10} />
          <p className="mt-2 text-caption text-ink-500 tabular">{kemajuan.dikerjakan} dari {kemajuan.total} baris</p>
        </SectionCard>
      )}

      {/* --- g. hasil --- */}
      {langkah === 6 && hasil && ds && (
        <div className="space-y-4">
          <SectionCard title="7. Hasil impor"
            action={hasil.batchId && !hasil.dibatalkan && hasil.berhasil > 0 ? (
              <Button variant="outline" icon={<RotateCcw size={15} />} onClick={async () => {
                if (!window.confirm('Batalkan seluruh impor ini? Baris baru akan dihapus dan baris yang diperbarui dikembalikan ke nilai lama.')) return
                try {
                  const rb = await rollbackBatch(hasil.batchId!)
                  toast.push(`Impor dibatalkan: ${rb.dihapus} baris dihapus, ${rb.dipulihkan} dipulihkan.`, 'success')
                  setHasil({ ...hasil, dibatalkan: true, catatanRollback: `Dibatalkan manual: ${rb.dihapus} baris baru dihapus, ${rb.dipulihkan} baris dikembalikan ke nilai lama.` })
                  setMuatUlangRiwayat(x => x + 1)
                } catch (e) { toast.push(pesanGalatImpor(e, ds), 'error') }
              }}>Batalkan Impor Ini</Button>) : null}>
            {hasil.dibatalkan && hasil.catatanRollback && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-body text-amber-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {hasil.catatanRollback}
              </div>)}
            {!hasil.dibatalkan && hasil.berhasil > 0 && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-body text-emerald-800">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                Data sudah langsung dipakai halaman & dashboard terkait — tidak perlu memuat ulang aplikasi. Bila keliru, pakai tombol “Batalkan Impor Ini” atau menu Riwayat Impor.
              </div>)}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-caption text-emerald-700">Berhasil masuk</div>
                <div className="mt-1 text-2xl font-bold text-emerald-700 tabular">{hasil.berhasil}</div>
              </div>
              <div className="rounded-md border border-ink-200 bg-ink-50 p-4">
                <div className="text-caption text-ink-500">Dilewati (bermasalah)</div>
                <div className="mt-1 text-2xl font-bold text-ink-600 tabular">{hasil.dilewati}</div>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-4">
                <div className="text-caption text-red-700">Ditolak server</div>
                <div className="mt-1 text-2xl font-bold text-red-700 tabular">{hasil.gagal}</div>
              </div>
            </div>

            {(hasil.gagal > 0 || hasil.dilewati > 0) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {hasil.gagal > 0 && (
                  <Button variant="outline" icon={<FileDown size={15} />} onClick={() => unduhBarisGagal(hasil.barisGagal)}>
                    Unduh {hasil.gagal} baris yang ditolak server
                  </Button>
                )}
                {hasil.dilewati > 0 && (
                  <Button variant="outline" icon={<FileDown size={15} />} onClick={unduhBarisBermasalah}>
                    Unduh {hasil.dilewati} baris bermasalah
                  </Button>
                )}
              </div>
            )}

            {hasil.barisGagal.length > 0 && (
              <div className="mt-4 overflow-auto max-h-64 rounded-md border border-ink-200">
                <table className="w-full text-caption">
                  <thead className="bg-ink-50"><tr>
                    <th className="px-3 h-9 text-left font-semibold text-ink-500">Baris</th>
                    <th className="px-3 h-9 text-left font-semibold text-ink-500">Alasan</th>
                  </tr></thead>
                  <tbody>
                    {hasil.barisGagal.slice(0, 100).map(g => (
                      <tr key={g.nomor} className="border-t border-ink-100">
                        <td className="px-3 py-2 tabular text-ink-700">{g.nomor}</td>
                        <td className="px-3 py-2 text-red-600">{g.alasan}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button icon={<CheckCircle2 size={16} />} onClick={ulangDariAwal}>Impor Data Lain</Button>
              <Button variant="outline" onClick={() => { setHasil(null); setLangkah(2) }}>Unggah Berkas Perbaikan</Button>
            </div>
          </SectionCard>

          {hasil.ringkasanWfp && <RingkasanWfp data={hasil.ringkasanWfp} />}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ baris pratinjau */
function BarisPratinjau({ baris, ds, peta }: { baris: BarisTervalidasi; ds: Dataset; peta: Pemetaan }) {
  const galat = baris.masalah.filter(m => m.tingkat === 'galat')
  const peringatan = baris.masalah.filter(m => m.tingkat === 'peringatan')
  const kolomBermasalah = new Set(galat.map(m => m.kolom).filter(Boolean) as string[])
  return (
    <tr className={cx('border-b border-ink-100',
      galat.length ? 'bg-red-50/70 dark:bg-red-950/30' : peringatan.length ? 'bg-amber-50/70 dark:bg-amber-950/30' : '')}>
      <td className="px-2 py-2 tabular text-ink-500 align-top">{baris.nomor}</td>
      <td className="px-2 py-2 align-top">
        {galat.length === 0 && peringatan.length === 0 && (
          <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={13} /> Siap</span>
        )}
        {galat.map((m, i) => (
          <span key={`g${i}`} className="flex items-start gap-1 text-red-700"><X size={13} className="mt-0.5 shrink-0" />{m.pesan}</span>
        ))}
        {peringatan.map((m, i) => (
          <span key={`p${i}`} className="flex items-start gap-1 text-amber-700"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{m.pesan}</span>
        ))}
      </td>
      {ds.kolom.map(k => {
        const judul = peta[k.nama]
        const teks = judul ? String(baris.mentah[judul] ?? '') : ''
        return (
          <td key={k.nama} className={cx('px-2 py-2 align-top whitespace-nowrap max-w-[220px] truncate',
            kolomBermasalah.has(k.nama) ? 'text-red-700 font-medium' : 'text-ink-700')} title={teks}>
            {teks || <span className="text-ink-300">—</span>}
          </td>
        )
      })}
    </tr>
  )
}

/* -------------------------------------------------------------- ringkasan WFP */
function RingkasanWfp({ data }: { data: NonNullable<HasilImpor['ringkasanWfp']> }) {
  const totalInbox = data.inbox.reduce((a, r) => a + Number(r.dibuat ?? 0), 0)
  return (
    <SectionCard title="Pengolahan lanjutan data karyawan"
      subtitle="Hasil fn_muat_karyawan_wfp, fn_inbox_konflik_wfp, dan fn_bangun_inbox_kerja.">
      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <h5 className="text-caption font-semibold uppercase tracking-wide text-ink-500">Pemuatan data</h5>
          <ul className="mt-2 space-y-1">
            {data.muat.length === 0 && <li className="text-caption text-ink-400">Tidak ada langkah dilaporkan.</li>}
            {data.muat.map((r, i) => (
              <li key={i} className="flex justify-between gap-3 text-body text-ink-700">
                <span>{r.langkah}</span><span className="tabular font-semibold">{r.jumlah}</span>
              </li>))}
          </ul>
        </div>
        <div>
          <h5 className="text-caption font-semibold uppercase tracking-wide text-ink-500">Konflik yang ditemukan</h5>
          <ul className="mt-2 space-y-1">
            {data.konflik.length === 0 && <li className="text-caption text-emerald-600">Tidak ada konflik.</li>}
            {data.konflik.map((r, i) => (
              <li key={i} className="flex justify-between gap-3 text-body text-ink-700">
                <span>{r.jenis_konflik}</span><span className="tabular font-semibold text-amber-700">{r.jumlah}</span>
              </li>))}
          </ul>
        </div>
        <div>
          <h5 className="text-caption font-semibold uppercase tracking-wide text-ink-500">Tugas Inbox Kerja</h5>
          <p className="mt-2 text-body text-ink-700">{totalInbox} tugas baru dibuat.</p>
          <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
            {data.inbox.map((r, i) => (
              <li key={i} className="flex justify-between gap-3 text-caption text-ink-600">
                <span>{r.modul} · {r.jenis}</span>
                <span className="tabular">+{r.dibuat} / ~{r.diperbarui} / ✓{r.ditutup}</span>
              </li>))}
          </ul>
        </div>
      </div>
    </SectionCard>
  )
}
