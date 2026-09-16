import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, ArrowRight, RefreshCw, FlaskConical, Trash2, Users2,
} from 'lucide-react'
import supabase from '@/lib/supabase'
import { list } from '@/lib/db'
import { useAuth } from '@/lib/auth'
import { tglJam, num } from '@/lib/format'
import {
  PageHeader, Card, CardHeader, Section, Badge, Progress, Button, DataTable, Modal, Field, Input,
  Checkbox, EmptyState, TableSkeleton, Skeleton, useToast, type Column,
} from '@/components/ui'

type ButirKesiapan = {
  company_id: string
  kode: string
  kategori: string
  judul: string
  keterangan: string
  status: 'aman' | 'perhatian' | 'bahaya'
  jumlah_terdampak: number
  tindakan_disarankan: string
}
type BarisHapus = { nama_tabel: string; baris_dihapus: number }
type AkunPeragaan = { id: string; full_name: string; email: string | null; role: string; created_at: string }

/** Peta kode butir -> rute halaman terkait (untuk tombol "Lompat ke halaman"). */
const RUTE_TERKAIT: Record<string, string> = {
  AKUN_BELUM_LOGIN: '/pengaturan/pengguna',
  KARYAWAN_TANPA_NPWP: '/hr/karyawan',
  KARYAWAN_TANPA_REKENING: '/hr/karyawan',
  KARYAWAN_TANPA_BPJS: '/hr/karyawan',
  KONTRAK_TANPA_BERKAS: '/commerce/kontrak',
  KONTRAK_KEDALUWARSA_AKTIF: '/commerce/kontrak',
  GUDANG_TANPA_PIC: '/inventory/gudang',
  JENIS_PEKERJAAN_TANPA_TARIF: '/hr/produktivitas',
  TARIF_ASUMSI: '/hr/produktivitas',
  PAJAK_BELUM_VERIFIKASI: '/finance/referensi-pajak',
  BPJS_BELUM_VERIFIKASI: '/hr/setelan-bpjs',
}

const STATUS_ORDER: Record<string, number> = { bahaya: 0, perhatian: 1, aman: 2 }
const STATUS_TONE: Record<string, string> = { bahaya: 'red', perhatian: 'amber', aman: 'emerald' }
const STATUS_LABEL: Record<string, string> = { bahaya: 'Bahaya', perhatian: 'Perhatian', aman: 'Aman' }
const STATUS_ICON: Record<string, any> = { bahaya: AlertTriangle, perhatian: ShieldAlert, aman: CheckCircle2 }

const KONFIRMASI_TEKS = 'HAPUS DATA CONTOH'

export default function KesiapanProduksi() {
  const { profile, company } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [loading, setLoading] = useState(true)
  const [butir, setButir] = useState<ButirKesiapan[]>([])
  const [tarikPada, setTarikPada] = useState<string>('')

  const [akun, setAkun] = useState<AkunPeragaan[]>([])
  const [akunLoading, setAkunLoading] = useState(true)

  const [simBusy, setSimBusy] = useState(false)
  const [simHasil, setSimHasil] = useState<BarisHapus[] | null>(null)

  const [hapusOpen, setHapusOpen] = useState(false)
  const [hapusTeks, setHapusTeks] = useState('')
  const [hapusSetuju, setHapusSetuju] = useState(false)
  const [hapusBusy, setHapusBusy] = useState(false)
  const [hapusHasil, setHapusHasil] = useState<BarisHapus[] | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const rows = await list<ButirKesiapan>('v_kesiapan_produksi')
      rows.sort((a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || a.kategori.localeCompare(b.kategori, 'id'))
      setButir(rows)
      setTarikPada(new Date().toISOString())
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data kesiapan produksi', 'error') }
    finally { setLoading(false) }
  }
  const loadAkun = async () => {
    setAkunLoading(true)
    try {
      const rows = await list<AkunPeragaan>('profiles', {
        select: 'id, full_name, email, role, created_at',
        order: { col: 'created_at', asc: true },
      })
      setAkun((rows ?? []).filter((r: any) => !r.last_login_at))
    } catch { /* akun peragaan opsional: diamkan bila gagal */ }
    finally { setAkunLoading(false) }
  }

  useEffect(() => { if (profile) { load(); loadAkun() } }, [profile])

  const totalButir = butir.length
  const amanCount = butir.filter(b => b.status === 'aman').length
  const perhatianCount = butir.filter(b => b.status === 'perhatian').length
  const bahayaCount = butir.filter(b => b.status === 'bahaya').length
  const skor = totalButir > 0 ? Math.round((amanCount / totalButir) * 100) : 0

  const layak = totalButir > 0 && bahayaCount === 0 && perhatianCount === 0
  const layakDenganCatatan = totalButir > 0 && bahayaCount === 0 && perhatianCount > 0
  const belumLayak = bahayaCount > 0

  const grouped = useMemo(() => {
    const m = new Map<string, ButirKesiapan[]>()
    butir.forEach(b => { const arr = m.get(b.kategori) ?? []; arr.push(b); m.set(b.kategori, arr) })
    return Array.from(m.entries())
  }, [butir])

  const runSimulasi = async () => {
    if (!profile) return
    setSimBusy(true)
    try {
      const { data, error } = await supabase.rpc('fn_bersihkan_data_contoh', {
        p_company: profile.company_id, p_konfirmasi: 'SIMULASI',
      })
      if (error) throw error
      const rows = ((data ?? []) as BarisHapus[]).slice().sort((a, b) => b.baris_dihapus - a.baris_dihapus)
      setSimHasil(rows)
      toast.push('Simulasi selesai — tidak ada data yang diubah.', 'success')
    } catch (e: any) { toast.push(e.message ?? 'Gagal menjalankan simulasi', 'error') }
    finally { setSimBusy(false) }
  }

  const runHapus = async () => {
    if (!profile) return
    setHapusBusy(true)
    try {
      const { data, error } = await supabase.rpc('fn_bersihkan_data_contoh', {
        p_company: profile.company_id, p_konfirmasi: KONFIRMASI_TEKS,
      })
      if (error) throw error
      const rows = ((data ?? []) as BarisHapus[]).slice().sort((a, b) => b.baris_dihapus - a.baris_dihapus)
      setHapusHasil(rows)
      setHapusOpen(false)
      setHapusTeks(''); setHapusSetuju(false)
      toast.push('Data contoh berhasil dibersihkan.', 'success')
      load(); loadAkun()
    } catch (e: any) { toast.push(e.message ?? 'Gagal membersihkan data contoh', 'error') }
    finally { setHapusBusy(false) }
  }

  const simColumns: Column[] = [
    { key: 'nama_tabel', header: 'Tabel', render: (r: BarisHapus) => <span className="font-mono text-caption">{r.nama_tabel}</span> },
    { key: 'baris_dihapus', header: 'Jumlah Baris', align: 'right', render: (r: BarisHapus) => num(r.baris_dihapus) },
  ]
  const akunColumns: Column[] = [
    { key: 'full_name', header: 'Nama' },
    { key: 'email', header: 'Email', render: (r: AkunPeragaan) => r.email ?? '-' },
    { key: 'role', header: 'Peran' },
    { key: 'created_at', header: 'Dibuat', render: (r: AkunPeragaan) => tglJam(r.created_at) },
  ]

  return (
    <div>
      <PageHeader
        title="Kesiapan Produksi"
        subtitle="Satu tempat untuk melihat apa saja yang masih menghalangi aplikasi dipakai sungguhan, dan alat untuk membereskannya."
        actions={<Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={() => { load(); loadAkun() }}>Muat Ulang</Button>}
      />

      {/* ---------------- Skor Kesiapan ---------------- */}
      <Card className="p-5 mb-6">
        {loading ? <Skeleton className="h-28 w-full" /> : (
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="shrink-0 flex items-center gap-4">
              <div className={cxTone(belumLayak ? 'red' : layakDenganCatatan ? 'amber' : 'emerald')}>
                {belumLayak ? <ShieldAlert size={26} /> : layakDenganCatatan ? <AlertTriangle size={26} /> : <ShieldCheck size={26} />}
              </div>
              <div>
                <div className="font-display text-[32px] leading-9 font-bold text-ink-900 tabular">{skor}%</div>
                <div className="text-caption text-ink-500">{amanCount} dari {totalButir} butir berstatus aman</div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <Progress value={skor} tone={belumLayak ? 'danger' : layakDenganCatatan ? 'warning' : 'success'} height={10} />
              <p className="mt-3 text-body font-medium text-ink-800">
                {belumLayak && <>Aplikasi <span className="text-red-600 font-bold">BELUM layak</span> dipakai untuk produksi — ada {bahayaCount} butir berstatus bahaya yang wajib dibereskan lebih dulu{perhatianCount > 0 ? `, dan ${perhatianCount} butir perhatian` : ''}.</>}
                {layakDenganCatatan && <>Aplikasi <span className="text-amber-600 font-bold">bisa dipakai produksi dengan catatan</span> — ada {perhatianCount} butir berstatus perhatian yang sebaiknya diberesi.</>}
                {layak && <>Aplikasi <span className="text-emerald-600 font-bold">sudah layak</span> dipakai untuk produksi — seluruh {totalButir} butir pemeriksaan berstatus aman.</>}
                {totalButir === 0 && <>Belum ada butir pemeriksaan yang bisa dibaca.</>}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-caption text-ink-500">
                <span className="inline-flex items-center gap-1"><Badge tone="emerald" solid>{amanCount}</Badge> Aman</span>
                <span className="inline-flex items-center gap-1"><Badge tone="amber" solid>{perhatianCount}</Badge> Perhatian</span>
                <span className="inline-flex items-center gap-1"><Badge tone="red" solid>{bahayaCount}</Badge> Bahaya</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ---------------- Daftar Butir ---------------- */}
      {loading ? <Card><TableSkeleton rows={8} /></Card> : totalButir === 0 ? (
        <EmptyState title="Belum ada butir pemeriksaan" message="Coba muat ulang halaman ini." />
      ) : (
        grouped.map(([kategori, items]) => (
          <Section title={kategori} key={kategori}>
            <Card className="divide-y divide-ink-100 overflow-hidden">
              {items.map(b => {
                const Icon = STATUS_ICON[b.status]
                const rute = RUTE_TERKAIT[b.kode]
                return (
                  <div key={b.kode} className="p-4 flex flex-wrap items-start gap-3">
                    <span className={cxTone(STATUS_TONE[b.status]) + ' mt-0.5'}><Icon size={18} /></span>
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-body text-ink-900">{b.judul}</span>
                        <Badge tone={STATUS_TONE[b.status]} solid>{STATUS_LABEL[b.status]}</Badge>
                        {b.jumlah_terdampak > 0 && <span className="text-caption text-ink-500">{num(b.jumlah_terdampak)} terdampak</span>}
                      </div>
                      <p className="text-caption text-ink-500 mt-1">{b.keterangan}</p>
                      {b.status !== 'aman' && <p className="text-caption text-ink-700 mt-1"><span className="font-medium">Tindakan disarankan:</span> {b.tindakan_disarankan}</p>}
                    </div>
                    {rute && b.status !== 'aman' && (
                      <Button size="sm" variant="outline" icon={<ArrowRight size={14} />} onClick={() => navigate(rute)}>Buka Halaman</Button>
                    )}
                  </div>
                )
              })}
            </Card>
          </Section>
        ))
      )}

      {/* ---------------- Bersihkan Data Contoh ---------------- */}
      {isSuperAdmin && (
        <Section title="Bersihkan Data Contoh">
          <Card className="p-5">
            <CardHeader title="Hapus seluruh data contoh perusahaan" subtitle={`Perusahaan: ${company?.name ?? '-'}`} />
            <div className="rounded-sm border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 mb-4">
              <p className="text-body font-bold text-red-700">Peringatan: tindakan ini permanen dan TIDAK BISA DIBATALKAN.</p>
              <p className="text-caption text-red-700 mt-1">Seluruh baris transaksi (karyawan, kontrak, proyek, invoice, payroll, stok, tiket, dsb.) milik perusahaan ini akan dihapus dan tidak dapat dikembalikan. Cadangkan (backup) basis data terlebih dahulu sebelum melanjutkan. Data struktural (profil perusahaan, cabang, akun pengguna, hak akses, referensi pajak/BPJS, komponen gaji, data master, dan tarif jenis pekerjaan) akan dipertahankan.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" icon={<FlaskConical size={15} />} loading={simBusy} onClick={runSimulasi}>
                Simulasi Pembersihan
              </Button>
              {simHasil && (
                <span className="text-caption text-ink-500">
                  Simulasi terakhir: {num(simHasil.reduce((s, r) => s + r.baris_dihapus, 0))} baris pada {simHasil.filter(r => r.baris_dihapus > 0).length} tabel akan terhapus.
                </span>
              )}
            </div>

            {simHasil && (
              <div className="mt-4">
                <DataTable columns={simColumns} rows={simHasil.filter(r => r.baris_dihapus > 0)} pageSize={15} dense
                  searchable searchKeys={['nama_tabel']}
                  emptyTitle="Tidak ada baris untuk dihapus" />
              </div>
            )}

            {simHasil && (
              <div className="mt-4 pt-4 border-t border-ink-200">
                <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setHapusOpen(true)}>
                  Hapus Data Contoh
                </Button>
              </div>
            )}

            {hapusHasil && (
              <div className="mt-4 pt-4 border-t border-ink-200">
                <p className="text-body font-medium text-emerald-700 mb-2">Pembersihan selesai — {num(hapusHasil.reduce((s, r) => s + r.baris_dihapus, 0))} baris dihapus dari {hapusHasil.filter(r => r.baris_dihapus > 0).length} tabel.</p>
                <DataTable columns={simColumns} rows={hapusHasil.filter(r => r.baris_dihapus > 0)} pageSize={15} dense searchable searchKeys={['nama_tabel']} />
              </div>
            )}
          </Card>
        </Section>
      )}

      {/* ---------------- Akun Peragaan ---------------- */}
      <Section title="Akun Peragaan">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-caption text-ink-500 flex items-center gap-1.5"><Users2 size={14} /> Akun yang belum pernah login — kandidat akun peragaan/demo. Nonaktifkan atau hapus akun yang tidak diperlukan di halaman Pengguna.</p>
            <Button size="sm" variant="outline" onClick={() => navigate('/pengaturan/pengguna')}>Buka Halaman Pengguna</Button>
          </div>
          {akunLoading ? <TableSkeleton rows={4} /> : (
            <DataTable columns={akunColumns} rows={akun} pageSize={10} dense searchable searchKeys={['full_name', 'email', 'role']}
              emptyTitle="Tidak ada akun peragaan" emptyMessage="Seluruh akun sudah pernah login." />
          )}
        </Card>
      </Section>

      {/* ---------------- Catatan Kaki ---------------- */}
      <p className="text-caption text-ink-400 mt-2">
        Sumber data: tampilan v_kesiapan_produksi pada basis data NUSAKARYA. {tarikPada && <>Ditarik pada {tglJam(tarikPada)}.</>}
      </p>

      {/* ---------------- Modal Konfirmasi Hapus ---------------- */}
      <Modal open={hapusOpen} onClose={() => { if (!hapusBusy) { setHapusOpen(false); setHapusTeks(''); setHapusSetuju(false) } }}
        title="Hapus Data Contoh" subtitle="Tindakan ini permanen dan tidak bisa dibatalkan"
        footer={<>
          <Button variant="outline" disabled={hapusBusy} onClick={() => { setHapusOpen(false); setHapusTeks(''); setHapusSetuju(false) }}>Batal</Button>
          <Button variant="danger" loading={hapusBusy} disabled={hapusTeks !== KONFIRMASI_TEKS || !hapusSetuju} onClick={runHapus}>
            Hapus Sekarang
          </Button>
        </>}>
        <div className="space-y-4">
          <div className="rounded-sm border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3">
            <p className="text-body font-bold text-red-700">PERINGATAN: tindakan ini PERMANEN dan TIDAK BISA DIBATALKAN.</p>
            <p className="text-caption text-red-700 mt-1">Pastikan Anda sudah mencadangkan (backup) basis data sebelum melanjutkan. Seluruh baris transaksi milik perusahaan "{company?.name ?? '-'}" akan dihapus.</p>
          </div>
          <Field label={`Ketik "${KONFIRMASI_TEKS}" untuk melanjutkan`} required>
            <Input value={hapusTeks} onChange={(e: any) => setHapusTeks(e.target.value)} placeholder={KONFIRMASI_TEKS} autoComplete="off" />
          </Field>
          <Checkbox label="Saya memahami tindakan ini permanen dan tidak bisa dibatalkan." checked={hapusSetuju}
            onChange={(e: any) => setHapusSetuju(e.target.checked)} />
        </div>
      </Modal>
    </div>
  )
}

function cxTone(tone: string) {
  const map: Record<string, string> = {
    red: 'w-9 h-9 rounded-full grid place-items-center shrink-0 bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300',
    amber: 'w-9 h-9 rounded-full grid place-items-center shrink-0 bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300',
    emerald: 'w-9 h-9 rounded-full grid place-items-center shrink-0 bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
  }
  return map[tone] ?? map.emerald
}
