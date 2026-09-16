import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update } from '@/lib/db'
import { rupiah, num, tgl, todayISO } from '@/lib/format'
import {
  PageHeader, FilterBar, KpiCard, DataTable, Modal,
  Button, Field, Input, Select, Money, Textarea, Badge, useToast, Plus,
} from '@/components/ui'
import { MAINTENANCE_TYPES, dueTone } from '../../lib/shared'

export default function PemeliharaanAset() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fAsset, setFAsset] = useState('')

  const [modal, setModal] = useState<{ open: boolean; row?: any }>({ open: false })
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [m, a, v] = await Promise.all([
        list('asset_maintenances', { select: 'id,asset_id,maintenance_date,maintenance_type,vendor_id,cost,description,next_due_date,asset:assets!asset_id(asset_no,asset_name,asset_category),vendor:vendors!vendor_id(name)', order: { col: 'maintenance_date', asc: false }, limit: 500 }),
        list('assets', { order: { col: 'asset_name', asc: true } }),
        list('vendors', { eq: { status: 'aktif' }, order: { col: 'name', asc: true } }),
      ])
      setRows((m as any[]).map(r => ({ ...r, asset_no: r.asset?.asset_no, asset_name: r.asset?.asset_name, vendor_name: r.vendor?.name })))
      setAssets(a); setVendors(v)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data pemeliharaan aset', 'error') }
    finally { setLoading(false) }
  }, [toast])
  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => !fAsset || r.asset_id === fAsset)
  const overdue = rows.filter(r => r.next_due_date && dueTone(r.next_due_date)?.tone === 'red')
  const dekat = rows.filter(r => r.next_due_date && dueTone(r.next_due_date)?.tone === 'amber')

  function openAdd() {
    setForm({ asset_id: '', maintenance_date: todayISO(), maintenance_type: 'servis', vendor_id: '', cost: 0, description: '', next_due_date: '' })
    setModal({ open: true })
  }
  function openEdit(row: any) { setForm({ ...row }); setModal({ open: true, row }) }

  async function save() {
    if (!form.asset_id) { toast.push('Pilih aset', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        asset_id: form.asset_id, maintenance_date: form.maintenance_date || todayISO(), maintenance_type: form.maintenance_type || null,
        vendor_id: form.vendor_id || null, cost: Number(form.cost || 0), description: form.description || null,
        next_due_date: form.next_due_date || null,
      }
      if (modal.row) { await update('asset_maintenances', modal.row.id, payload); toast.push('Data pemeliharaan diperbarui') }
      else { await insert('asset_maintenances', { ...payload, company_id: profile!.company_id, created_by: profile!.id }); toast.push('Pemeliharaan tercatat') }
      setModal({ open: false }); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan data pemeliharaan', 'error') }
    finally { setSaving(false) }
  }

  const columns = [
    { key: 'asset_no', header: 'No. Aset', width: '110px' },
    { key: 'asset_name', header: 'Nama Aset' },
    { key: 'maintenance_date', header: 'Tanggal', render: (r: any) => tgl(r.maintenance_date) },
    { key: 'maintenance_type', header: 'Jenis', render: (r: any) => <Badge tone="slate">{MAINTENANCE_TYPES.find(t => t.value === r.maintenance_type)?.label ?? r.maintenance_type ?? '-'}</Badge> },
    { key: 'vendor_name', header: 'Vendor', render: (r: any) => r.vendor_name ?? '-' },
    { key: 'cost', header: 'Biaya', align: 'right' as const, render: (r: any) => rupiah(r.cost) },
    {
      key: 'next_due_date', header: 'Jatuh Tempo Berikutnya', render: (r: any) => {
        const t = dueTone(r.next_due_date)
        if (!t) return '-'
        return <div><span className="block">{tgl(r.next_due_date)}</span><Badge tone={t.tone}>{t.label}</Badge></div>
      },
    },
    {
      key: 'aksi', header: '', sortable: false, render: (r: any) => (
        <div onClick={e => e.stopPropagation()}>{can('ASSET', 'write') && <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Ubah</Button>}</div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Pemeliharaan Aset" subtitle="Jadwal dan riwayat servis/kalibrasi aset, termasuk OTDR dan splicer."
        actions={can('ASSET', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Catat Pemeliharaan</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total Riwayat" value={num(rows.length)} />
        <KpiCard label="Lewat Jatuh Tempo" value={num(overdue.length)} tone="red" />
        <KpiCard label="Jatuh Tempo ≤ 30 Hari" value={num(dekat.length)} tone="amber" />
        <KpiCard label="Total Biaya (Terfilter)" value={rupiah(filtered.reduce((s, r) => s + Number(r.cost || 0), 0), true)} tone="teal" />
      </div>

      <FilterBar>
        <Field label="Aset" className="w-64"><Select value={fAsset} onChange={(e: any) => setFAsset(e.target.value)}
          options={assets.map((a: any) => ({ value: a.id, label: `${a.asset_no} · ${a.asset_name}` }))} /></Field>
      </FilterBar>

      <DataTable columns={columns} rows={filtered} loading={loading} searchable searchKeys={['asset_no', 'asset_name', 'vendor_name']}
        exportName="pemeliharaan-aset" emptyTitle="Belum ada riwayat pemeliharaan aset" />

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.row ? 'Ubah Pemeliharaan' : 'Catat Pemeliharaan'}
        footer={<><Button variant="outline" onClick={() => setModal({ open: false })}>Batal</Button>
          <Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Aset" required className="sm:col-span-2"><Select value={form.asset_id ?? ''} onChange={(e: any) => setForm({ ...form, asset_id: e.target.value })}
            options={assets.map((a: any) => ({ value: a.id, label: `${a.asset_no} · ${a.asset_name}` }))} /></Field>
          <Field label="Tanggal Pemeliharaan"><Input type="date" value={form.maintenance_date ?? ''} onChange={(e: any) => setForm({ ...form, maintenance_date: e.target.value })} /></Field>
          <Field label="Jenis"><Select value={form.maintenance_type ?? 'servis'} onChange={(e: any) => setForm({ ...form, maintenance_type: e.target.value })} options={MAINTENANCE_TYPES} /></Field>
          <Field label="Vendor"><Select value={form.vendor_id ?? ''} onChange={(e: any) => setForm({ ...form, vendor_id: e.target.value })}
            options={vendors.map((v: any) => ({ value: v.id, label: v.name }))} /></Field>
          <Field label="Biaya"><Money value={form.cost} onChange={(v: number) => setForm({ ...form, cost: v })} /></Field>
          <Field label="Jatuh Tempo Berikutnya"><Input type="date" value={form.next_due_date ?? ''} onChange={(e: any) => setForm({ ...form, next_due_date: e.target.value })} /></Field>
          <Field label="Deskripsi" className="sm:col-span-2"><Textarea value={form.description ?? ''} onChange={(e: any) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}
