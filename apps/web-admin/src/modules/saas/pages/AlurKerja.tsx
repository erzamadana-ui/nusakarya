import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth, ROLE_LABEL } from '@/lib/auth'
import { hapusCacheKonfigurasi } from '@/lib/konfigurasi'
import { PageHeader, SectionCard, Tabs, Button, Input, Select, Checkbox, Badge, ChoiceChips, useToast } from '@/components/ui'
import { STATUS_INTI, WARNA_STATUS } from '../lib/konstanta'

const TAB = [
  { value: 'label', label: 'Label Status', fitur: 'status_kustom' },
  { value: 'jabatan', label: 'Nama Jabatan', fitur: 'status_kustom' },
  { value: 'sla', label: 'SLA Tiket', fitur: 'sla_kustom' },
  { value: 'persetujuan', label: 'Aturan Persetujuan', fitur: 'aturan_persetujuan' },
  { value: 'transisi', label: 'Alur Transisi Status', fitur: 'transisi_status' },
]
const peran = Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))

export default function AlurKerja() {
  const { profile, fitur, hanyaBaca } = useAuth()
  const [tab, setTab] = useState('label')
  const t = TAB.find(x => x.value === tab)!
  const boleh = profile?.role === 'super_admin' && !hanyaBaca
  return (
    <div className="space-y-5">
      <PageHeader title="Status, SLA & Alur Kerja" breadcrumb={['Pengaturan', 'Alur Kerja']}
        subtitle="Sesuaikan istilah, SLA, jenjang persetujuan, dan alur status dengan SOP perusahaan Anda — tanpa mengubah kode. Semua perubahan tercatat di Log Audit." />
      <Tabs tabs={TAB} value={tab} onChange={setTab} />
      {!fitur(t.fitur) ? (
        <SectionCard title={t.label}><p className="text-body text-ink-500">Fitur ini belum termasuk paket Anda. Lihat <a className="text-primary-600" href="#/pengaturan/langganan">Paket & Pemakaian</a>.</p></SectionCard>
      ) : tab === 'label' ? <LabelStatus boleh={boleh} entitas={['work_orders', 'tickets', 'projects', 'ar_invoices', 'contracts']} />
        : tab === 'jabatan' ? <LabelStatus boleh={boleh} entitas={['_role']} />
        : tab === 'sla' ? <SlaTiket boleh={boleh} />
        : tab === 'persetujuan' ? <Persetujuan boleh={boleh} />
        : <Transisi boleh={boleh} />}
    </div>
  )
}

/* ---------------------------------------------------------------- label */
function LabelStatus({ boleh, entitas }: { boleh: boolean; entitas: string[] }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [entity, setEntity] = useState(entitas[0])
  const [rows, setRows] = useState<Record<string, any>>({})
  const [sibuk, setSibuk] = useState(false)
  useEffect(() => { setEntity(entitas[0]) }, [entitas.join()])
  const load = async () => {
    const { data } = await supabase.from('tenant_status_labels').select('*').eq('entity', entity)
    const m: Record<string, any> = {}
    ;(data ?? []).forEach((r: any) => { m[r.status_code] = r })
    setRows(m)
  }
  useEffect(() => { load() }, [entity])
  const inti = STATUS_INTI[entity]
  const simpan = async () => {
    setSibuk(true)
    try {
      const payload = inti.kode.map((k, i) => ({
        company_id: profile!.company_id, entity, status_code: k,
        label: rows[k]?.label?.trim() || (entity === '_role' ? ROLE_LABEL[k] : k.replace(/_/g, ' ')),
        color: entity === '_role' ? null : rows[k]?.color ?? null, sort_order: Number(rows[k]?.sort_order ?? i + 1), is_hidden: !!rows[k]?.is_hidden,
      }))
      const { error } = await supabase.from('tenant_status_labels').upsert(payload, { onConflict: 'company_id,entity,status_code' })
      if (error) throw error
      hapusCacheKonfigurasi(); toast.push('Label disimpan. Halaman terkait memakai label baru setelah dibuka ulang.', 'success'); load()
    } catch (e: any) { toast.push(e.message, 'error') } finally { setSibuk(false) }
  }
  const set = (k: string, f: string, v: any) => setRows({ ...rows, [k]: { ...(rows[k] ?? {}), [f]: v } })
  return (
    <SectionCard title={entity === '_role' ? 'Nama jabatan versi perusahaan' : `Label status — ${inti.label}`}
      subtitle={entity === '_role' ? 'Mis. "Supervisor Operations" menjadi "Koordinator Lapangan". Hak akses tetap diatur di Hak Akses Jabatan.' : 'Kode status inti tidak berubah (laporan & integrasi tetap konsisten); yang berubah hanya label, warna, urutan, dan visibilitas di dropdown.'}
      action={boleh && <Button icon={<Save size={15} />} loading={sibuk} onClick={simpan}>Simpan</Button>}>
      {entitas.length > 1 && <div className="mb-3 max-w-xs"><Select value={entity} onChange={(e: any) => setEntity(e.target.value)} options={entitas.map(e => ({ value: e, label: STATUS_INTI[e].label }))} placeholder="" /></div>}
      <div className="overflow-x-auto"><table className="w-full text-body">
        <thead><tr className="text-left text-caption text-ink-500 border-b border-ink-200">
          <th className="py-2 pr-3">Kode inti</th><th className="py-2 pr-3">Label perusahaan</th>
          {entity !== '_role' && <><th className="py-2 pr-3">Warna</th><th className="py-2 pr-3">Urutan</th><th className="py-2">Sembunyikan</th></>}</tr></thead>
        <tbody>{inti.kode.map((k, i) => (
          <tr key={k} className="border-b border-ink-100">
            <td className="py-2 pr-3"><code className="text-caption">{k}</code></td>
            <td className="py-2 pr-3"><Input disabled={!boleh} value={rows[k]?.label ?? ''} placeholder={entity === '_role' ? ROLE_LABEL[k] : k.replace(/_/g, ' ')} onChange={e => set(k, 'label', e.target.value)} /></td>
            {entity !== '_role' && <>
              <td className="py-2 pr-3 w-40"><Select disabled={!boleh} value={rows[k]?.color ?? ''} onChange={(e: any) => set(k, 'color', e.target.value || null)} options={WARNA_STATUS} placeholder="otomatis" /></td>
              <td className="py-2 pr-3 w-24"><Input disabled={!boleh} type="number" value={rows[k]?.sort_order ?? i + 1} onChange={e => set(k, 'sort_order', e.target.value)} /></td>
              <td className="py-2"><Checkbox disabled={!boleh} checked={!!rows[k]?.is_hidden} onChange={(e: any) => set(k, 'is_hidden', e.target.checked)} label="" /></td></>}
          </tr>))}</tbody></table></div>
    </SectionCard>
  )
}

/* ------------------------------------------------------------------ SLA */
function SlaTiket({ boleh }: { boleh: boolean }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const load = async () => { const { data } = await supabase.from('tenant_sla_rules').select('*').order('sort_order'); setRows(data ?? []) }
  useEffect(() => { load() }, [])
  const simpan = async (r: any) => {
    const payload = { company_id: profile!.company_id, entity: 'tickets', match_field: r.match_field, match_value: r.match_value,
      response_minutes: r.response_minutes ? Number(r.response_minutes) : null, resolve_minutes: Number(r.resolve_minutes), keterangan: r.keterangan || null,
      sort_order: Number(r.sort_order) || 0, is_active: r.is_active !== false }
    const { error } = r.id ? await supabase.from('tenant_sla_rules').update(payload).eq('id', r.id) : await supabase.from('tenant_sla_rules').insert(payload)
    if (error) toast.push(error.message, 'error'); else { toast.push('Aturan SLA disimpan'); load() }
  }
  const upd = (i: number, f: string, v: any) => setRows(rows.map((r, j) => j === i ? { ...r, [f]: v } : r))
  return (
    <SectionCard title="SLA tiket gangguan" subtitle="Dipakai otomatis saat tiket baru dibuat tanpa SLA: batas waktu selesai = waktu lapor + menit resolusi. Angka bawaan template adalah ASUMSI — samakan dengan SLA kontrak Anda."
      action={boleh && <Button variant="outline" icon={<Plus size={15} />} onClick={() => setRows([...rows, { match_field: 'severity', match_value: '', resolve_minutes: 720, is_active: true, sort_order: rows.length + 1 }])}>Tambah aturan</Button>}>
      <div className="overflow-x-auto"><table className="w-full text-body">
        <thead><tr className="text-left text-caption text-ink-500 border-b border-ink-200"><th className="py-2 pr-2">Berdasarkan</th><th className="py-2 pr-2">Nilai</th><th className="py-2 pr-2">Respons (menit)</th><th className="py-2 pr-2">Selesai (menit)</th><th className="py-2 pr-2">Keterangan</th><th /></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={r.id ?? `b${i}`} className="border-b border-ink-100">
            <td className="py-2 pr-2 w-36"><Select disabled={!boleh} value={r.match_field} onChange={(e: any) => upd(i, 'match_field', e.target.value)} options={[{ value: 'severity', label: 'Severity' }, { value: 'category', label: 'Kategori' }, { value: 'ticket_type', label: 'Jenis tiket' }]} placeholder="" /></td>
            <td className="py-2 pr-2 w-40"><Input disabled={!boleh} value={r.match_value} onChange={e => upd(i, 'match_value', e.target.value)} placeholder="mis. kritis" /></td>
            <td className="py-2 pr-2 w-28"><Input disabled={!boleh} type="number" value={r.response_minutes ?? ''} onChange={e => upd(i, 'response_minutes', e.target.value)} /></td>
            <td className="py-2 pr-2 w-28"><Input disabled={!boleh} type="number" value={r.resolve_minutes ?? ''} onChange={e => upd(i, 'resolve_minutes', e.target.value)} /></td>
            <td className="py-2 pr-2"><Input disabled={!boleh} value={r.keterangan ?? ''} onChange={e => upd(i, 'keterangan', e.target.value)} /></td>
            <td className="py-2 whitespace-nowrap">{boleh && <><Button size="sm" onClick={() => simpan(r)}>Simpan</Button>
              {r.id && <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={async () => { await supabase.from('tenant_sla_rules').delete().eq('id', r.id); load() }} />}</>}</td>
          </tr>))}</tbody></table></div>
    </SectionCard>
  )
}

/* ---------------------------------------------------------- persetujuan */
const DOKUMEN = [
  { value: 'purchase_requests', label: 'Purchase Request' }, { value: 'purchase_orders', label: 'Purchase Order' },
  { value: 'vendor_invoices', label: 'Invoice Vendor' }, { value: 'ap_payments', label: 'Pembayaran Mitra (AP)' },
  { value: 'overtime_requests', label: 'Lembur (SPL)' }, { value: 'cash_advances', label: 'Kasbon' },
  { value: 'reimbursements', label: 'Reimbursement' }, { value: 'payroll_runs', label: 'Payroll' },
]
function Persetujuan({ boleh }: { boleh: boolean }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [baru, setBaru] = useState<any>({ entity_type: 'purchase_orders', min_amount: 0, max_amount: '', step: 1, approver_role: 'manager_procurement' })
  const load = async () => { const { data } = await supabase.from('tenant_approval_rules').select('*').order('entity_type').order('min_amount').order('step'); setRows(data ?? []) }
  useEffect(() => { load() }, [])
  const tambah = async () => {
    const { error } = await supabase.from('tenant_approval_rules').insert({ ...baru, company_id: profile!.company_id, min_amount: Number(baru.min_amount) || 0, max_amount: baru.max_amount === '' ? null : Number(baru.max_amount), step: Number(baru.step) })
    if (error) toast.push(error.message, 'error'); else { toast.push('Aturan ditambahkan'); load() }
  }
  return (
    <SectionCard title="Jenjang persetujuan per nominal" subtitle="Contoh: PO < Rp10 jt cukup Manager Procurement; ≥ Rp10 jt ditambah Direktur di langkah 2. Aturan tersimpan & tersedia lewat fn_penyetuju(); penerapan ke setiap alur dokumen dilakukan bertahap (lihat backlog).">
      {boleh && <div className="grid gap-2 md:grid-cols-6 items-end mb-4">
        <Select value={baru.entity_type} onChange={(e: any) => setBaru({ ...baru, entity_type: e.target.value })} options={DOKUMEN} placeholder="" />
        <Input type="number" placeholder="Nominal mulai" value={baru.min_amount} onChange={e => setBaru({ ...baru, min_amount: e.target.value })} />
        <Input type="number" placeholder="Sampai (kosong = ∞)" value={baru.max_amount} onChange={e => setBaru({ ...baru, max_amount: e.target.value })} />
        <Select value={baru.step} onChange={(e: any) => setBaru({ ...baru, step: e.target.value })} options={[1, 2, 3, 4, 5].map(n => ({ value: n, label: `Langkah ${n}` }))} placeholder="" />
        <Select value={baru.approver_role} onChange={(e: any) => setBaru({ ...baru, approver_role: e.target.value })} options={peran} placeholder="" />
        <Button icon={<Plus size={15} />} onClick={tambah}>Tambah</Button></div>}
      {rows.length === 0 ? <p className="text-body text-ink-500">Belum ada aturan. Tanpa aturan, persetujuan mengikuti hak "approve" di Hak Akses Jabatan.</p> :
        <table className="w-full text-body"><tbody>{rows.map(r => (
          <tr key={r.id} className="border-b border-ink-100"><td className="py-2">{DOKUMEN.find(d => d.value === r.entity_type)?.label ?? r.entity_type}</td>
            <td className="py-2 tabular">Rp {Number(r.min_amount).toLocaleString('id-ID')} – {r.max_amount == null ? '∞' : 'Rp ' + Number(r.max_amount).toLocaleString('id-ID')}</td>
            <td className="py-2"><Badge tone="blue">Langkah {r.step}</Badge></td><td className="py-2">{ROLE_LABEL[r.approver_role] ?? r.approver_role}</td>
            <td className="py-2 text-right">{boleh && <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={async () => { await supabase.from('tenant_approval_rules').delete().eq('id', r.id); load() }} />}</td></tr>))}</tbody></table>}
    </SectionCard>
  )
}

/* -------------------------------------------------------------- transisi */
function Transisi({ boleh }: { boleh: boolean }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [entity, setEntity] = useState('work_orders')
  const [rows, setRows] = useState<any[]>([])
  const [baru, setBaru] = useState<any>({ from_status: '', to_status: '', allowed_roles: [] })
  const load = async () => { const { data } = await supabase.from('tenant_status_transitions').select('*').eq('entity', entity).order('from_status'); setRows(data ?? []) }
  useEffect(() => { load() }, [entity])
  const kode = STATUS_INTI[entity].kode
  const tambah = async () => {
    if (!baru.from_status || !baru.to_status) { toast.push('Pilih status asal dan tujuan', 'error'); return }
    const { error } = await supabase.from('tenant_status_transitions').insert({ company_id: profile!.company_id, entity, ...baru })
    if (error) toast.push(error.message, 'error'); else { load(); setBaru({ from_status: '', to_status: '', allowed_roles: [] }) }
  }
  return (
    <SectionCard title="Alur transisi status" subtitle="Bila ada minimal satu aturan untuk sebuah entitas, HANYA perpindahan yang terdaftar di sini yang diizinkan basis data. Kosongkan untuk perilaku bebas (bawaan).">
      <div className="mb-3 max-w-xs"><Select value={entity} onChange={(e: any) => setEntity(e.target.value)} options={['work_orders', 'tickets'].map(e => ({ value: e, label: STATUS_INTI[e].label }))} placeholder="" /></div>
      {boleh && <div className="grid gap-2 md:grid-cols-4 items-start mb-4">
        <Select value={baru.from_status} onChange={(e: any) => setBaru({ ...baru, from_status: e.target.value })} options={kode} placeholder="dari status" />
        <Select value={baru.to_status} onChange={(e: any) => setBaru({ ...baru, to_status: e.target.value })} options={kode} placeholder="ke status" />
        <div className="md:col-span-1"><ChoiceChips options={peran.filter(p => ['dispatcher', 'spv_operations', 'manager_operations', 'teknisi', 'qc', 'mitra'].includes(p.value))} value={baru.allowed_roles} onChange={(v: string[]) => setBaru({ ...baru, allowed_roles: v })} /></div>
        <Button icon={<Plus size={15} />} onClick={tambah}>Tambah transisi</Button></div>}
      {rows.length === 0 ? <p className="text-body text-ink-500">Belum ada aturan — semua perpindahan status diizinkan sesuai hak akses.</p> :
        <table className="w-full text-body"><tbody>{rows.map(r => (
          <tr key={r.id} className="border-b border-ink-100"><td className="py-2"><code>{r.from_status}</code> → <code>{r.to_status}</code></td>
            <td className="py-2 text-caption text-ink-600">{r.allowed_roles?.length ? r.allowed_roles.map((x: string) => ROLE_LABEL[x] ?? x).join(', ') : 'Semua jabatan yang berhak menulis'}</td>
            <td className="py-2 text-right">{boleh && <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={async () => { await supabase.from('tenant_status_transitions').delete().eq('id', r.id); load() }} />}</td></tr>))}</tbody></table>}
    </SectionCard>
  )
}
