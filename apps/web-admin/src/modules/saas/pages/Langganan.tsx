import React, { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Sparkles, Trash2, Database, MessageCircle } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { PageHeader, SectionCard, Card, Badge, Button, Progress, DataTable, ConfirmDialog, useToast, type Column } from '@/components/ui'
import { FITUR_LABEL, MODUL_LABEL, STATUS_LANGGANAN, rupiah } from '../lib/konstanta'

type Paket = {
  code: string; name: string; tagline: string; price_monthly: number; price_setup: number; max_users: number | null
  max_technicians: number | null; max_wo_month: number | null; max_storage_gb: number | null; modules: string[]
  features: string[]; support_level: string; onboarding: string; overage_technician: number; overage_wo: number
}

function Meter({ label, pakai, batas, satuan = '' }: { label: string; pakai: number; batas: number | null | undefined; satuan?: string }) {
  const pct = batas ? Math.min(100, (pakai / batas) * 100) : 0
  const tone = !batas ? 'primary' : pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'primary'
  return (
    <div>
      <div className="flex justify-between text-body"><span className="text-ink-600">{label}</span>
        <span className="font-semibold tabular text-ink-900">{pakai.toLocaleString('id-ID')}{satuan} / {batas == null ? '∞' : batas.toLocaleString('id-ID') + satuan}</span></div>
      <div className="mt-1.5"><Progress value={batas ? pct : 3} tone={tone} /></div>
      {batas != null && pct >= 100 && <div className="mt-1 text-caption text-red-600">Melewati batas paket — {label === 'Pengguna panel' ? 'akun baru ditolak sampai paket dinaikkan' : 'kelebihan ditagih sebagai overage'}.</div>}
    </div>
  )
}

export default function Langganan() {
  const { langganan, profile, company, refresh } = useAuth()
  const toast = useToast()
  const [paket, setPaket] = useState<Paket[]>([])
  const [tagihan, setTagihan] = useState<any[]>([])
  const [demo, setDemo] = useState(0)
  const [konfirm, setKonfirm] = useState<'isi' | 'hapus' | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const isSuper = profile?.role === 'super_admin'

  const load = async () => {
    const [{ data: p }, { data: t }, { count }] = await Promise.all([
      supabase.from('saas_plans').select('*').eq('is_public', true).order('sort_order'),
      supabase.from('saas_invoices').select('*').order('period_start', { ascending: false }),
      supabase.from('demo_records').select('row_id', { count: 'exact', head: true }),
    ])
    setPaket((p ?? []) as Paket[]); setTagihan(t ?? []); setDemo(count ?? 0)
  }
  useEffect(() => { load() }, [])

  const st = STATUS_LANGGANAN[langganan?.status ?? 'legacy'] ?? STATUS_LANGGANAN.legacy
  const sisaHari = langganan?.trial_ends_at ? Math.ceil((+new Date(langganan.trial_ends_at) - Date.now()) / 86400000) : null
  const u = langganan?.usage ?? {}
  const l = langganan?.limits ?? {}

  const jalankanDemo = async (aksi: 'isi' | 'hapus') => {
    setSibuk(true)
    try {
      const { data, error } = await supabase.rpc(aksi === 'isi' ? 'fn_isi_data_contoh' : 'fn_hapus_data_contoh', { p_company: profile!.company_id })
      if (error) throw error
      toast.push(aksi === 'isi' ? 'Data contoh ditambahkan. Buka Dashboard untuk melihat hasilnya.' : `Data contoh dihapus (${(data as any)?.dihapus ?? 0} baris).`, 'success')
      await load(); await refresh()
    } catch (e: any) { toast.push(e.message ?? 'Gagal', 'error') } finally { setSibuk(false) }
  }

  const minta = (p: Paket) => {
    const teks = encodeURIComponent(`Halo tim NUSAKARYA, kami ${company?.name ?? ''} ingin pindah ke paket ${p.name}. Mohon dibantu.`)
    window.open(`https://wa.me/?text=${teks}`, '_blank')
  }

  const kolomTagihan: Column[] = [
    { key: 'invoice_no', header: 'No. Tagihan' },
    { key: 'period_start', header: 'Periode', render: r => new Date(r.period_start).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) },
    { key: 'subtotal', header: 'Jumlah (belum PPN)', align: 'right', render: r => rupiah(r.subtotal) },
    { key: 'due_date', header: 'Jatuh Tempo', render: r => r.due_date ? new Date(r.due_date).toLocaleDateString('id-ID') : '-' },
    { key: 'status', header: 'Status', render: r => <Badge tone={r.status === 'lunas' ? 'emerald' : r.status === 'terbit' ? 'amber' : 'slate'}>{r.status}</Badge> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Paket & Pemakaian" subtitle="Paket langganan, batas pemakaian, fitur aktif, tagihan, dan mode data contoh workspace Anda."
        breadcrumb={['Pengaturan', 'Paket & Pemakaian']} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="text-caption uppercase tracking-wide text-ink-500">Paket saat ini</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-display text-2xl font-bold text-ink-900">{langganan?.plan_name ?? '—'}</span>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <div className="mt-1 text-body text-ink-600">{langganan?.price_monthly != null ? `${rupiah(langganan.price_monthly)}/bulan (belum PPN, ASUMSI harga peluncuran)` : 'Tanpa paket — tenant peragaan lama'}</div>
          {langganan?.status === 'trial' && sisaHari != null && (
            <div className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-body text-blue-800">Masa uji coba tersisa <b>{Math.max(0, sisaHari)} hari</b>. Setelah itu workspace menjadi hanya-baca sampai paket diaktifkan.</div>)}
          {['trial_berakhir', 'suspended'].includes(langganan?.status ?? '') && (
            <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-body text-red-800">Workspace <b>hanya-baca</b>. Data tetap aman dan bisa diekspor. Hubungi tim NUSAKARYA untuk mengaktifkan kembali.</div>)}
          <div className="mt-3 text-caption text-ink-500">Dukungan: {langganan?.support ?? '-'}</div>
        </Card>
        <Card className="p-5 lg:col-span-2 space-y-4">
          <div className="text-caption uppercase tracking-wide text-ink-500">Pemakaian bulan ini</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Meter label="Pengguna panel" pakai={u.users ?? 0} batas={l.users} />
            <Meter label="Teknisi aktif (aplikasi lapangan)" pakai={u.teknisi ?? 0} batas={l.teknisi} />
            <Meter label="Work order bulan ini" pakai={u.wo_bulan_ini ?? 0} batas={l.wo_bulan_ini} />
            <Meter label="Penyimpanan" pakai={Math.round(((u.storage_mb ?? 0) / 1024) * 100) / 100} batas={l.storage_gb} satuan=" GB" />
          </div>
          <p className="text-caption text-ink-400">Batas pengguna panel bersifat keras. Teknisi & WO di atas kuota tetap diizinkan dan ditagih sebagai overage (ASUMSI tarif: Rp15.000/teknisi, Rp500/WO).</p>
        </Card>
      </div>

      <SectionCard title="Bandingkan paket" subtitle="Semua harga adalah ASUMSI peluncuran, belum termasuk PPN, dan belum divalidasi finance/legal.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {paket.map(p => {
            const aktif = p.code === langganan?.plan_code
            return (
              <div key={p.code} className={`rounded-md border p-4 flex flex-col ${aktif ? 'border-primary-400 bg-primary-50/50' : 'border-ink-200'}`}>
                <div className="flex items-center justify-between"><span className="font-display text-lg font-bold">{p.name}</span>{aktif && <Badge tone="teal">Paket Anda</Badge>}</div>
                <p className="mt-1 text-caption text-ink-500 min-h-[32px]">{p.tagline}</p>
                <div className="mt-2 font-display text-xl font-bold tabular">{rupiah(p.price_monthly)}<span className="text-caption font-normal text-ink-500">/bln{p.code === 'enterprise' || p.code === 'managed' ? ' (mulai)' : ''}</span></div>
                <div className="text-caption text-ink-500">Setup {rupiah(p.price_setup)}</div>
                <ul className="mt-3 space-y-1 text-caption text-ink-700">
                  <li>{p.max_users ?? 'Sesuai kontrak'} pengguna · {p.max_technicians ?? 'sesuai kontrak'} teknisi</li>
                  <li>{p.max_wo_month?.toLocaleString('id-ID') ?? 'Sesuai kontrak'} WO/bulan · {p.max_storage_gb} GB</li>
                  <li className="pt-1 font-semibold text-ink-600">Modul</li>
                  <li>{p.modules.filter(m => !['CORE', 'DASHBOARD'].includes(m)).map(m => MODUL_LABEL[m] ?? m).join(', ')}</li>
                  <li className="pt-1 font-semibold text-ink-600">Fitur</li>
                  {p.features.map(f => <li key={f} className="flex gap-1"><CheckCircle2 size={12} className="mt-0.5 text-emerald-600 shrink-0" />{FITUR_LABEL[f] ?? f}</li>)}
                  <li className="pt-1 text-ink-500">Support: {p.support_level}</li>
                  <li className="text-ink-500">Onboarding: {p.onboarding}</li>
                </ul>
                <div className="mt-auto pt-3">{!aktif && isSuper && <Button variant="outline" size="sm" className="w-full" icon={<MessageCircle size={14} />} onClick={() => minta(p)}>Ajukan pindah paket</Button>}</div>
              </div>)
          })}
          <div className="rounded-md border border-dashed border-ink-300 p-4 text-caption text-ink-600">
            <div className="font-display text-lg font-bold text-ink-900">Add-on</div>
            <ul className="mt-2 space-y-1">
              <li>Teknisi ekstra Rp15.000/teknisi/bln</li><li>WO ekstra Rp500/WO</li><li>Storage Rp150.000/50 GB</li>
              <li>Training on-site Rp3,5 jt/hari</li><li>Integrasi kustom mulai Rp25 jt</li><li>Support premium Rp3 jt/bln</li>
              <li>Bayar tahunan hemat 10%</li>
            </ul>
            <p className="mt-2 text-ink-400">Semua angka ASUMSI.</p>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Fitur & modul aktif">
          <div className="flex flex-wrap gap-1.5">
            {(langganan?.modules ?? Object.keys(MODUL_LABEL)).map(m => <Badge key={m} tone="teal">{MODUL_LABEL[m] ?? m}</Badge>)}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.keys(FITUR_LABEL).map(f => {
              const on = !langganan?.features || langganan.features.includes(f)
              return <span key={f} className={`inline-flex items-center gap-1 text-caption ${on ? 'text-emerald-700' : 'text-ink-400 line-through'}`}>
                {on ? <CheckCircle2 size={12} /> : <XCircle size={12} />}{FITUR_LABEL[f]}</span>
            })}
          </div>
        </SectionCard>

        <SectionCard title="Mode data contoh" subtitle="Isi workspace dengan data fiktif untuk latihan & demo; hapus tuntas sebelum dipakai sungguhan.">
          <p className="text-body text-ink-600">Baris data contoh saat ini: <b className="tabular">{demo}</b>. Data contoh ditandai dan dilacak — penghapusan tidak menyentuh data asli Anda.</p>
          {isSuper ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" icon={<Sparkles size={14} />} loading={sibuk} onClick={() => setKonfirm('isi')}>Isi data contoh</Button>
              <Button variant="danger" icon={<Trash2 size={14} />} disabled={!demo} loading={sibuk} onClick={() => setKonfirm('hapus')}>Hapus data contoh</Button>
            </div>) : <p className="mt-2 text-caption text-ink-400">Hanya Super Admin yang dapat mengubah data contoh.</p>}
        </SectionCard>
      </div>

      <SectionCard title="Tagihan langganan" subtitle="Tagihan diterbitkan tim NUSAKARYA. Pembayaran online belum tersedia (transfer bank + konfirmasi).">
        <DataTable columns={kolomTagihan} rows={tagihan} exportName="tagihan-nusakarya" dense
          emptyTitle="Belum ada tagihan" emptyMessage="Tagihan pertama terbit setelah masa uji coba berakhir dan paket diaktifkan." emptyAction={<Database size={18} />} />
      </SectionCard>

      <ConfirmDialog open={!!konfirm} onClose={() => setKonfirm(null)} danger={konfirm === 'hapus'}
        title={konfirm === 'isi' ? 'Isi data contoh?' : 'Hapus data contoh?'}
        message={konfirm === 'isi' ? 'Menambahkan 2 cabang, 1 pelanggan & kontrak, 6 teknisi, 30 WO, stok, dan 2 invoice — semuanya fiktif dan bertanda.' : 'Seluruh data contoh yang dilacak akan dihapus. Data yang sudah Anda kaitkan ke transaksi nyata akan tertahan dan dilaporkan.'}
        onConfirm={() => konfirm && jalankanDemo(konfirm)} />
    </div>
  )
}
