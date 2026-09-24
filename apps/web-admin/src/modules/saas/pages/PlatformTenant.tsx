import React, { useEffect, useMemo, useState } from 'react'
import { Activity, Building2, Users, Wallet, FileText, RefreshCw } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { PageHeader, SectionCard, DataTable, KpiCard, Badge, Button, Drawer, Field, Input, Select, Tabs, Checkbox, useToast, type Column } from '@/components/ui'
import { FITUR_LABEL, MODUL_LABEL, STATUS_LANGGANAN, rupiah } from '../lib/konstanta'

/** Panel pemilik aplikasi: seluruh tenant, kesehatan, paket, override fitur, draft tagihan. */
export default function PlatformTenant() {
  const { isPlatformAdmin } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [paket, setPaket] = useState<any[]>([])
  const [tagihan, setTagihan] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pilih, setPilih] = useState<any>(null)
  const [tab, setTab] = useState('tenant')

  const load = async () => {
    setLoading(true)
    const [{ data, error }, { data: p }, { data: t }] = await Promise.all([
      supabase.rpc('fn_platform_tenant'), supabase.from('saas_plans').select('*').order('sort_order'),
      supabase.from('saas_invoices').select('*, companies(name)').order('period_start', { ascending: false }).limit(500),
    ])
    if (error) toast.push(error.message, 'error')
    setRows(data ?? []); setPaket(p ?? []); setTagihan(t ?? []); setLoading(false)
  }
  useEffect(() => { if (isPlatformAdmin) load() }, [isPlatformAdmin])

  const ringkas = useMemo(() => {
    const bayar = rows.filter(r => (r.status === 'active' || r.status === 'past_due') && !r.is_demo)
    return {
      tenant: rows.length, trial: rows.filter(r => r.status === 'trial').length, bayar: bayar.length,
      mrr: bayar.reduce((a, r) => a + Number(r.harga_bulanan ?? 0), 0),
      risiko: rows.filter(r => r.skor_kesehatan < 50).length,
    }
  }, [rows])

  if (!isPlatformAdmin) return <SectionCard title="Panel Pemilik Aplikasi"><p className="text-body text-ink-500">Halaman ini hanya untuk pemilik aplikasi NUSAKARYA (platform admin).</p></SectionCard>

  const skorTone = (s: number) => s >= 70 ? 'emerald' : s >= 50 ? 'amber' : 'red'
  const cols: Column[] = [
    { key: 'nama', header: 'Tenant', render: r => <div><div className="font-medium">{r.nama}</div><div className="text-caption text-ink-400">{r.kode}{r.is_demo ? ' · data contoh' : ''}</div></div> },
    { key: 'paket', header: 'Paket', render: r => r.paket ?? '-' },
    { key: 'status', header: 'Status', render: r => { const s = STATUS_LANGGANAN[r.status] ?? STATUS_LANGGANAN.legacy; return <Badge tone={s.tone}>{s.label}</Badge> } },
    { key: 'pengguna', header: 'Pengguna', align: 'right', render: r => `${r.pengguna}/${r.batas_pengguna ?? '∞'}` },
    { key: 'teknisi', header: 'Teknisi', align: 'right', render: r => `${r.teknisi}/${r.batas_teknisi ?? '∞'}` },
    { key: 'wo_bulan_ini', header: 'WO bln ini', align: 'right', render: r => `${Number(r.wo_bulan_ini).toLocaleString('id-ID')}/${r.batas_wo?.toLocaleString('id-ID') ?? '∞'}` },
    { key: 'login_terakhir', header: 'Login terakhir', render: r => r.login_terakhir ? new Date(r.login_terakhir).toLocaleDateString('id-ID') : '-' },
    { key: 'onboarding_aktif', header: 'Onboarding', render: r => r.onboarding_aktif ? <Badge tone="emerald">Aktif</Badge> : <Badge tone="amber">Belum</Badge> },
    { key: 'skor_kesehatan', header: 'Kesehatan', align: 'right', render: r => <Badge tone={skorTone(r.skor_kesehatan)}>{r.skor_kesehatan}</Badge> },
  ]
  const kolomTagihan: Column[] = [
    { key: 'invoice_no', header: 'No.' }, { key: 'companies', header: 'Tenant', render: r => r.companies?.name ?? '-' },
    { key: 'period_start', header: 'Periode', render: r => r.period_start },
    { key: 'subtotal', header: 'Subtotal', align: 'right', render: r => rupiah(r.subtotal) },
    { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
    { key: 'aksi', header: '', render: r => <div className="flex gap-1">
      {r.status === 'draft' && <Button size="sm" variant="outline" onClick={() => ubahTagihan(r, { status: 'terbit', issued_at: new Date().toISOString() })}>Terbitkan</Button>}
      {r.status === 'terbit' && <Button size="sm" variant="outline" onClick={() => ubahTagihan(r, { status: 'lunas', paid_at: new Date().toISOString() })}>Tandai lunas</Button>}</div> },
  ]
  const ubahTagihan = async (r: any, v: any) => {
    const { error } = await supabase.from('saas_invoices').update(v).eq('id', r.id)
    if (error) toast.push(error.message, 'error'); else load()
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Panel Pemilik Aplikasi" breadcrumb={['Platform', 'Tenant']}
        subtitle="Kesehatan seluruh tenant, paket & status langganan, override fitur, dan kesiapan penagihan."
        actions={<Button variant="outline" icon={<RefreshCw size={15} />} onClick={load}>Muat ulang</Button>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Tenant" value={ringkas.tenant} icon={<Building2 size={16} />} />
        <KpiCard label="Uji coba" value={ringkas.trial} icon={<Users size={16} />} />
        <KpiCard label="Berbayar" value={ringkas.bayar} icon={<Wallet size={16} />} sub="non-demo" />
        <KpiCard label="MRR (non-demo)" value={rupiah(ringkas.mrr)} icon={<FileText size={16} />} sub="dari harga paket" />
        <KpiCard label="Kesehatan < 50" value={ringkas.risiko} icon={<Activity size={16} />} tone="red" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'tenant', label: 'Tenant' }, { value: 'tagihan', label: 'Tagihan' }, { value: 'paket', label: 'Katalog Paket' }]} />
      {tab === 'tenant' && <>
        <DataTable columns={cols} rows={rows} loading={loading} onRowClick={setPilih} exportName="tenant-nusakarya" searchKeys={['nama', 'kode', 'paket', 'status']} />
        <p className="text-caption text-ink-500">Skor kesehatan (0–100) = login 7 hari (maks 30) + aktivitas WO 7 hari (30) + onboarding aktif (20) + dalam batas paket (20) − impor gagal 7 hari (10). Rumus awal — kalibrasi dengan data churn nyata.</p>
      </>}
      {tab === 'tagihan' && <DataTable columns={kolomTagihan} rows={tagihan} exportName="tagihan-saas" emptyTitle="Belum ada tagihan" emptyMessage="Buat draft dari detail tenant." />}
      {tab === 'paket' && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{paket.map(p => (
        <SectionCard key={p.code} title={p.name} subtitle={p.tagline}>
          <div className="text-body">{rupiah(p.price_monthly)}/bln · setup {rupiah(p.price_setup)}</div>
          <div className="text-caption text-ink-500 mt-1">{p.max_users ?? '∞'} pengguna · {p.max_technicians ?? '∞'} teknisi · {p.max_wo_month ?? '∞'} WO · {p.max_storage_gb} GB</div>
          <div className="text-caption text-ink-500 mt-1">Fitur: {p.features.map((f: string) => FITUR_LABEL[f] ?? f).join(', ')}</div>
        </SectionCard>))}</div>}
      <DetailTenant tenant={pilih} paket={paket} onClose={() => setPilih(null)} onSaved={load} />
    </div>
  )
}

function DetailTenant({ tenant, paket, onClose, onSaved }: any) {
  const toast = useToast()
  const [sub, setSub] = useState<any>(null)
  const [ovr, setOvr] = useState<any[]>([])
  useEffect(() => {
    if (!tenant) return
    supabase.from('tenant_subscriptions').select('*').eq('company_id', tenant.company_id).maybeSingle().then(({ data }) => setSub(data ?? { company_id: tenant.company_id, plan_code: 'professional', status: 'trial' }))
    supabase.from('tenant_feature_overrides').select('*').eq('company_id', tenant.company_id).then(({ data }) => setOvr(data ?? []))
  }, [tenant])
  if (!tenant || !sub) return null
  const simpan = async () => {
    const { id, created_at, updated_at, ...isi } = sub
    const { error } = await supabase.from('tenant_subscriptions').upsert({ ...isi, price_override: isi.price_override === '' ? null : isi.price_override, trial_ends_at: isi.trial_ends_at || null, updated_at: new Date().toISOString() }, { onConflict: 'company_id' })
    if (error) toast.push(error.message, 'error'); else { toast.push('Langganan diperbarui', 'success'); onSaved() }
  }
  const setOverride = async (kode: string, enabled: boolean | null) => {
    if (enabled === null) await supabase.from('tenant_feature_overrides').delete().eq('company_id', tenant.company_id).eq('feature_code', kode)
    else await supabase.from('tenant_feature_overrides').upsert({ company_id: tenant.company_id, feature_code: kode, enabled }, { onConflict: 'company_id,feature_code' })
    const { data } = await supabase.from('tenant_feature_overrides').select('*').eq('company_id', tenant.company_id); setOvr(data ?? [])
  }
  const draft = async () => {
    const { error } = await supabase.rpc('fn_buat_draft_tagihan', { p_company: tenant.company_id })
    if (error) toast.push(error.message, 'error'); else { toast.push('Draft tagihan bulan ini dibuat', 'success'); onSaved() }
  }
  const nilaiOvr = (k: string) => ovr.find(o => o.feature_code === k)?.enabled
  return (
    <Drawer open={!!tenant} onClose={onClose} title={tenant.nama} width="max-w-2xl"
      footer={<><Button variant="outline" onClick={draft}>Buat draft tagihan bulan ini</Button><Button onClick={simpan}>Simpan langganan</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paket"><Select value={sub.plan_code} onChange={(e: any) => setSub({ ...sub, plan_code: e.target.value })} options={paket.map((p: any) => ({ value: p.code, label: p.name }))} placeholder="" /></Field>
          <Field label="Status"><Select value={sub.status} onChange={(e: any) => setSub({ ...sub, status: e.target.value })} placeholder="" options={['trial', 'active', 'past_due', 'suspended', 'cancelled'].map(s => ({ value: s, label: STATUS_LANGGANAN[s].label }))} /></Field>
          <Field label="Uji coba berakhir"><Input type="date" value={sub.trial_ends_at ? String(sub.trial_ends_at).slice(0, 10) : ''} onChange={e => setSub({ ...sub, trial_ends_at: e.target.value })} /></Field>
          <Field label="Harga khusus /bulan" hint="Kosong = harga paket"><Input type="number" value={sub.price_override ?? ''} onChange={e => setSub({ ...sub, price_override: e.target.value })} /></Field>
          <Field label="Siklus tagih"><Select value={sub.billing_cycle} onChange={(e: any) => setSub({ ...sub, billing_cycle: e.target.value })} options={['bulanan', 'tahunan']} placeholder="" /></Field>
          <Field label="Catatan"><Input value={sub.catatan ?? ''} onChange={e => setSub({ ...sub, catatan: e.target.value })} /></Field>
        </div>
        <p className="text-caption text-ink-500">Suspended / trial berakhir = hanya-baca (ditegakkan di basis data). Cancelled = seluruh modul non-inti tertutup.</p>
        <div>
          <div className="text-caption font-semibold uppercase tracking-wide text-ink-500 mb-2">Override modul & fitur (di luar paket)</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {[...Object.keys(MODUL_LABEL).filter(m => !['CORE', 'DASHBOARD'].includes(m)).map(m => [`modul:${m}`, `Modul ${MODUL_LABEL[m]}`]), ...Object.entries(FITUR_LABEL).map(([k, l]) => [`fitur:${k}`, l])].map(([k, l]) => {
              const v = nilaiOvr(k)
              return <div key={k} className="flex items-center justify-between gap-2 text-body border-b border-ink-100 py-1">
                <span>{l}</span>
                <select className="text-caption border border-ink-200 rounded px-1 py-0.5 bg-surface" value={v === undefined ? '' : v ? 'on' : 'off'}
                  onChange={e => setOverride(k, e.target.value === '' ? null : e.target.value === 'on')}>
                  <option value="">ikut paket</option><option value="on">paksa aktif</option><option value="off">paksa mati</option></select>
              </div>
            })}
          </div>
        </div>
      </div>
    </Drawer>
  )
}
