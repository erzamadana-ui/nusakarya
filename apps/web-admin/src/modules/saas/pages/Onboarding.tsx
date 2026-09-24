import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, LayoutTemplate, Upload, SlidersHorizontal, ShieldCheck, LineChart, Rocket, CheckCircle2, AlertTriangle, Circle, ArrowRight, ArrowLeft } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { PageHeader, Card, SectionCard, Stepper, Button, Field, Input, Badge, KpiCard, useToast } from '@/components/ui'
import { rupiah } from '../lib/konstanta'

const LANGKAH = [
  { k: 'perusahaan', label: 'Profil Perusahaan', ikon: Building2 },
  { k: 'template', label: 'Template Bisnis', ikon: LayoutTemplate },
  { k: 'impor', label: 'Impor Data Awal', ikon: Upload },
  { k: 'mapping', label: 'Field & Istilah', ikon: SlidersHorizontal },
  { k: 'validasi', label: 'Validasi', ikon: ShieldCheck },
  { k: 'pratinjau', label: 'Pratinjau Dashboard', ikon: LineChart },
  { k: 'aktivasi', label: 'Aktivasi', ikon: Rocket },
]
const DATASET_AWAL = [
  ['branches', 'Cabang', 'Wilayah operasi'], ['employees', 'Karyawan & Teknisi', 'Supaya WO bisa ditugaskan'],
  ['customers', 'Pelanggan / Principal', 'Pemberi kerja'], ['contracts', 'Kontrak', 'Dasar BAST & penagihan'],
  ['job_types', 'Jenis Pekerjaan & Tarif', 'Poin & nilai pekerjaan'], ['warehouses', 'Gudang', 'Lokasi stok'],
  ['item_catalog', 'Katalog Material & NTE', 'Barang yang dipakai'], ['stock_balances', 'Saldo Awal Stok', 'Posisi stok hari ini'],
  ['work_orders', 'Work Order Berjalan', 'Agar dashboard langsung hidup'], ['ar_invoices', 'Invoice Pelanggan Terbuka', 'Pantau piutang'],
]

export default function Onboarding() {
  const { profile, company, onboarding, refresh, langganan } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const selesai = new Set(onboarding?.langkah_selesai ?? [])
  const awal = Math.max(0, LANGKAH.findIndex(l => !selesai.has(l.k)))
  const [i, setI] = useState(awal === -1 ? 0 : awal)
  const isSuper = profile?.role === 'super_admin'

  const tandai = async (k: string) => {
    const baru = Array.from(new Set([...(onboarding?.langkah_selesai ?? []), k]))
    await supabase.from('tenant_onboarding').update({ langkah_selesai: baru, updated_at: new Date().toISOString() }).eq('company_id', profile!.company_id)
    await refresh()
  }
  const lanjut = async () => { await tandai(LANGKAH[i].k); setI(Math.min(i + 1, LANGKAH.length - 1)) }

  if (!isSuper) return <SectionCard title="Onboarding workspace"><p className="text-body text-ink-500">Onboarding dijalankan oleh Super Admin perusahaan.</p></SectionCard>
  const L = LANGKAH[i]
  return (
    <div className="space-y-5">
      <PageHeader title="Siapkan Workspace" breadcrumb={['Mulai', 'Onboarding']}
        subtitle={`${company?.name ?? ''} · paket ${langganan?.plan_name ?? '-'} · ikuti 7 langkah; setiap langkah bisa dilewati dan dilanjutkan kapan saja.`} />
      <Card className="p-4"><Stepper steps={LANGKAH.map(l => ({ label: l.label }))} current={i} /></Card>
      <SectionCard title={`${i + 1}. ${L.label}`} action={<Badge tone={selesai.has(L.k) ? 'emerald' : 'slate'}>{selesai.has(L.k) ? 'Selesai' : 'Belum'}</Badge>}>
        {L.k === 'perusahaan' && <LangkahPerusahaan onSelesai={lanjut} />}
        {L.k === 'template' && <LangkahTemplate onSelesai={lanjut} />}
        {L.k === 'impor' && <LangkahImpor />}
        {L.k === 'mapping' && <LangkahMapping />}
        {L.k === 'validasi' && <LangkahValidasi />}
        {L.k === 'pratinjau' && <LangkahPratinjau />}
        {L.k === 'aktivasi' && <LangkahAktivasi onAktif={async () => { await refresh(); toast.push('Workspace aktif. Selamat bekerja!', 'success'); nav('/dashboard') }} />}
      </SectionCard>
      <div className="flex justify-between">
        <Button variant="outline" icon={<ArrowLeft size={15} />} disabled={i === 0} onClick={() => setI(i - 1)}>Sebelumnya</Button>
        {i < LANGKAH.length - 1 && <Button icon={<ArrowRight size={15} />} onClick={lanjut}>Tandai selesai & lanjut</Button>}
      </div>
    </div>
  )
}

function LangkahPerusahaan({ onSelesai }: { onSelesai: () => void }) {
  const { company, profile, refresh } = useAuth()
  const toast = useToast()
  const [f, setF] = useState<any>({ name: company?.name ?? '', npwp: company?.npwp ?? '', address: company?.address ?? '', phone: company?.phone ?? '', email: company?.email ?? '' })
  const [cabang, setCabang] = useState<any[]>([])
  const [baru, setBaru] = useState({ code: '', name: '', city: '' })
  const muat = () => supabase.from('branches').select('id,code,name,city').order('name').then(({ data }) => setCabang(data ?? []))
  useEffect(() => { muat() }, [])
  const simpan = async () => {
    const { error } = await supabase.from('companies').update(f).eq('id', profile!.company_id)
    if (error) { toast.push(error.message, 'error'); return }
    await refresh(); toast.push('Profil perusahaan disimpan', 'success'); onSelesai()
  }
  const tambahCabang = async () => {
    if (!baru.code || !baru.name) return
    const { error } = await supabase.from('branches').insert({ ...baru, company_id: profile!.company_id, code: baru.code.toUpperCase() })
    if (error) toast.push(error.message, 'error'); else { setBaru({ code: '', name: '', city: '' }); muat() }
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        <p className="text-body text-ink-500">Data ini muncul di kop dokumen (BAST, invoice, slip). NPWP dipakai untuk dokumen pajak.</p>
        <Field label="Nama perusahaan" required><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="NPWP"><Input value={f.npwp ?? ''} onChange={e => setF({ ...f, npwp: e.target.value })} placeholder="00.000.000.0-000.000" /></Field>
        <Field label="Alamat"><Input value={f.address ?? ''} onChange={e => setF({ ...f, address: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telepon"><Input value={f.phone ?? ''} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Email"><Input value={f.email ?? ''} onChange={e => setF({ ...f, email: e.target.value })} /></Field></div>
        <Button onClick={simpan}>Simpan & lanjut</Button>
      </div>
      <div>
        <div className="text-caption font-semibold uppercase tracking-wide text-ink-500 mb-2">Cabang / wilayah operasi</div>
        <ul className="space-y-1 mb-3">{cabang.map(c => <li key={c.id} className="text-body flex justify-between border-b border-ink-100 py-1"><span>{c.name}</span><span className="text-ink-400">{c.code} · {c.city ?? '-'}</span></li>)}</ul>
        <div className="grid grid-cols-4 gap-2 items-end">
          <Input placeholder="Kode" value={baru.code} onChange={e => setBaru({ ...baru, code: e.target.value })} />
          <Input placeholder="Nama cabang" value={baru.name} onChange={e => setBaru({ ...baru, name: e.target.value })} />
          <Input placeholder="Kota" value={baru.city} onChange={e => setBaru({ ...baru, city: e.target.value })} />
          <Button variant="outline" onClick={tambahCabang}>Tambah</Button></div>
        <p className="mt-2 text-caption text-ink-400">Punya banyak cabang? Lewati dan impor sekaligus di langkah 3.</p>
      </div>
    </div>
  )
}

function LangkahTemplate({ onSelesai }: { onSelesai: () => void }) {
  const { profile, onboarding, refresh } = useAuth()
  const toast = useToast()
  const [tpl, setTpl] = useState<any[]>([])
  const [sibuk, setSibuk] = useState('')
  useEffect(() => { supabase.from('business_templates').select('code,name,description').eq('is_active', true).order('sort_order').then(({ data }) => setTpl(data ?? [])) }, [])
  const terapkan = async (code: string) => {
    setSibuk(code)
    const { data, error } = await supabase.rpc('fn_terapkan_template', { p_company: profile!.company_id, p_template: code })
    setSibuk('')
    if (error) { toast.push(error.message, 'error'); return }
    const n = Object.values(data ?? {}).reduce((a: number, b: any) => a + Number(b), 0)
    toast.push(`Template diterapkan: ${n} konfigurasi baru ditambahkan (yang sudah ada tidak ditimpa).`, 'success')
    await refresh(); onSelesai()
  }
  return (
    <div className="space-y-3">
      <p className="text-body text-ink-500">Template mengisi konfigurasi awal: 23 jabatan & hak akses, katalog jenis pekerjaan, akar masalah RCA, shift, kompetensi, komponen gaji, bagan akun, field kustom, label status, dan SLA. Aman diterapkan berulang — data yang sudah ada tidak ditimpa.</p>
      <div className="grid gap-3 md:grid-cols-2">{tpl.map(t => (
        <div key={t.code} className={`rounded-md border p-4 ${onboarding?.template_code === t.code ? 'border-primary-400 bg-primary-50/40' : 'border-ink-200'}`}>
          <div className="flex items-center justify-between"><span className="font-semibold">{t.name}</span>{onboarding?.template_code === t.code && <Badge tone="teal">Terpasang</Badge>}</div>
          <p className="mt-1 text-caption text-ink-500">{t.description}</p>
          <Button className="mt-3" size="sm" loading={sibuk === t.code} onClick={() => terapkan(t.code)}>Terapkan</Button>
        </div>))}</div>
      <p className="text-caption text-amber-700">Tarif pada template adalah ASUMSI dan ditandai “asumsi_sistem” — ganti dengan tarif kontrak Anda sebelum dipakai membayar mitra atau menagih.</p>
    </div>
  )
}

function useJumlah(tabel: string[]) {
  const [n, setN] = useState<Record<string, number>>({})
  useEffect(() => {
    Promise.all(tabel.map(t => supabase.from(t).select('id', { count: 'exact', head: true }).then(({ count }) => [t, count ?? 0] as const)))
      .then(r => setN(Object.fromEntries(r)))
  }, [tabel.join()])
  return n
}

function LangkahImpor() {
  const n = useJumlah(DATASET_AWAL.map(d => d[0]))
  return (
    <div className="space-y-3">
      <p className="text-body text-ink-500">Unggah Excel/CSV yang selama ini Anda pakai. Di Pusat Impor Anda mengunduh template, memetakan kolom berkas Anda ke field aplikasi, melihat pratinjau & kesalahan per baris, lalu mengimpor. Impor yang keliru bisa dibatalkan utuh.</p>
      <div className="grid gap-2 md:grid-cols-2">{DATASET_AWAL.map(([k, l, ket], idx) => (
        <Link key={k} to={`/pengaturan/impor?dataset=${k}`} className="flex items-center justify-between rounded-md border border-ink-200 px-3 py-2.5 hover:border-primary-400">
          <span className="flex items-center gap-2">{(n[k] ?? 0) > 0 ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Circle size={16} className="text-ink-300" />}
            <span><span className="text-caption text-ink-400 mr-1">{idx + 1}.</span><b className="font-medium">{l}</b><span className="block text-caption text-ink-400">{ket}</span></span></span>
          <span className="text-caption tabular text-ink-500">{(n[k] ?? 0).toLocaleString('id-ID')} baris <Upload size={12} className="inline ml-1" /></span>
        </Link>))}</div>
    </div>
  )
}

function LangkahMapping() {
  return (
    <div className="space-y-3 text-body text-ink-600">
      <p>Sesuaikan aplikasi dengan cara kerja perusahaan Anda — tanpa developer:</p>
      <ul className="space-y-2">
        <li><Link className="text-primary-600 font-medium" to="/pengaturan/field-kustom">Field Kustom</Link> — tambah kolom seperti No. SC, Nama ODP, Laborcode. Otomatis muncul di form, tabel, dan template impor.</li>
        <li><Link className="text-primary-600 font-medium" to="/pengaturan/alur-kerja">Status, SLA & Alur Kerja</Link> — ganti istilah status & jabatan, atur SLA tiket, jenjang persetujuan.</li>
        <li><Link className="text-primary-600 font-medium" to="/pengaturan/hak-akses">Hak Akses Jabatan</Link> — siapa boleh melihat, mengubah, menyetujui per modul.</li>
        <li><Link className="text-primary-600 font-medium" to="/pengaturan/preferensi">Pengaturan Perusahaan</Link> — jam kerja, radius absensi, minimal foto evidence.</li>
      </ul>
      <p className="text-caption text-ink-400">Pemetaan kolom berkas → field aplikasi dilakukan di setiap impor (langkah “Petakan Kolom” di Pusat Impor), dicocokkan otomatis dari judul kolom.</p>
    </div>
  )
}

function LangkahValidasi() {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { supabase.rpc('fn_validasi_data_awal').then(({ data }) => setRows(data ?? [])) }, [])
  const ikon = (s: string) => s === 'ok' ? <CheckCircle2 size={16} className="text-emerald-600" /> : s === 'peringatan' ? <AlertTriangle size={16} className="text-amber-600" /> : <Circle size={16} className="text-red-500" />
  return (
    <div>
      <p className="text-body text-ink-500 mb-3">Pemeriksaan otomatis kelengkapan data sebelum workspace dipakai. Merah = kosong, kuning = perlu perhatian.</p>
      <ul className="divide-y divide-ink-100">{rows.map(r => (
        <li key={r.kunci} className="flex items-center justify-between py-2.5 gap-3">
          <span className="flex items-start gap-2">{ikon(r.status)}<span><b className="font-medium">{r.label}</b> <span className="tabular text-ink-500">({Number(r.jumlah).toLocaleString('id-ID')})</span>
            <span className="block text-caption text-ink-400">{r.saran}</span></span></span>
          {r.status !== 'ok' && <Link to={r.tautan} className="text-caption text-primary-600 whitespace-nowrap">Perbaiki →</Link>}
        </li>))}</ul>
    </div>
  )
}

function LangkahPratinjau() {
  const [k, setK] = useState<any>(null)
  useEffect(() => {
    (async () => {
      const [wo, done, tiket, emp, ar] = await Promise.all([
        supabase.from('work_orders').select('id', { count: 'exact', head: true }),
        supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('status', 'done'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).not('status', 'in', '(resolved,closed,cancelled)'),
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'aktif'),
        supabase.from('ar_invoices').select('total,paid_amount,status').not('status', 'in', '(lunas,batal,draft)'),
      ])
      const piutang = (ar.data ?? []).reduce((a: number, r: any) => a + Number(r.total ?? 0) - Number(r.paid_amount ?? 0), 0)
      setK({ wo: wo.count ?? 0, done: done.count ?? 0, tiket: tiket.count ?? 0, emp: emp.count ?? 0, piutang })
    })()
  }, [])
  if (!k) return <p className="text-body text-ink-400">Memuat…</p>
  return (
    <div className="space-y-4">
      <p className="text-body text-ink-500">Beginilah dashboard Anda dengan data yang sudah masuk. Angka ini dihitung langsung dari basis data — tidak ada angka contoh kecuali Anda mengaktifkan mode data contoh.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Work order" value={k.wo.toLocaleString('id-ID')} />
        <KpiCard label="WO selesai" value={k.done.toLocaleString('id-ID')} sub={k.wo ? `${Math.round((k.done / k.wo) * 100)}%` : ''} />
        <KpiCard label="Tiket terbuka" value={k.tiket.toLocaleString('id-ID')} />
        <KpiCard label="Karyawan aktif" value={k.emp.toLocaleString('id-ID')} />
        <KpiCard label="Piutang terbuka" value={rupiah(k.piutang)} />
      </div>
      <div className="flex gap-2"><Link to="/dashboard"><Button variant="outline">Buka Dashboard lengkap</Button></Link><Link to="/ops/work-order"><Button variant="outline">Lihat Work Order</Button></Link></div>
    </div>
  )
}

function LangkahAktivasi({ onAktif }: { onAktif: () => void }) {
  const { onboarding } = useAuth()
  const toast = useToast()
  const [sibuk, setSibuk] = useState(false)
  const aktifkan = async () => {
    setSibuk(true)
    const { error } = await supabase.rpc('fn_aktivasi_workspace')
    setSibuk(false)
    if (error) toast.push(error.message, 'error'); else onAktif()
  }
  return onboarding?.activated_at ? (
    <p className="text-body text-emerald-700">Workspace sudah aktif sejak {new Date(onboarding.activated_at).toLocaleDateString('id-ID')}.</p>
  ) : (
    <div className="space-y-3 text-body text-ink-600">
      <p>Aktivasi menandai workspace siap dipakai tim: banner onboarding hilang, dan Anda bisa mulai mengundang supervisor & teknisi.</p>
      <ul className="list-disc pl-5 text-caption text-ink-500 space-y-1">
        <li>Pastikan data contoh sudah dihapus (Paket & Pemakaian → Mode data contoh).</li>
        <li>Pastikan tarif asumsi sudah diganti tarif kontrak sebelum dipakai membayar/menagih.</li>
        <li>Langkah berikutnya: <Link to="/pengaturan/undang" className="text-primary-600">Undang Tim</Link>.</li>
      </ul>
      <Button icon={<Rocket size={15} />} loading={sibuk} onClick={aktifkan}>Aktifkan workspace</Button>
    </div>
  )
}
