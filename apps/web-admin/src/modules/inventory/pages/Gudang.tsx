import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import { num } from '@/lib/format'
import {
  PageHeader, FilterBar, KpiCard, DataTable, Modal, ConfirmDialog,
  Button, Field, Input, Select, Checkbox, Badge, useToast, Plus,
} from '@/components/ui'
import { WAREHOUSE_TYPES } from '../lib/shared'

export default function Gudang() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [pics, setPics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fType, setFType] = useState('')
  const [modal, setModal] = useState<{ open: boolean; row?: any }>({ open: false })
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [w, b, p] = await Promise.all([
        list('warehouses', { order: { col: 'name', asc: true } }),
        list('branches', { eq: { is_active: true }, order: { col: 'name', asc: true } }),
        list('profiles', { select: 'id,full_name', eq: { is_active: true }, order: { col: 'full_name', asc: true } }),
      ])
      setRows(w); setBranches(b); setPics(p)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat gudang', 'error') }
    finally { setLoading(false) }
  }, [toast])
  useEffect(() => { load() }, [load])

  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? '-'
  const picName = (id: string) => pics.find(p => p.id === id)?.full_name ?? '-'
  const filtered = rows.filter(r => !fType || r.warehouse_type === fType)

  function openAdd() {
    setForm({ code: '', name: '', warehouse_type: 'pusat', branch_id: '', address: '', lat: '', lng: '', pic_id: '', is_active: true })
    setModal({ open: true })
  }
  function openEdit(row: any) { setForm({ ...row }); setModal({ open: true, row }) }

  async function save() {
    if (!form.code || !form.name) { toast.push('Kode dan nama gudang wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        branch_id: form.branch_id || null,
        pic_id: form.pic_id || null,
        lat: form.lat === '' ? null : Number(form.lat),
        lng: form.lng === '' ? null : Number(form.lng),
      }
      if (modal.row) {
        await update('warehouses', modal.row.id, payload)
        toast.push('Gudang diperbarui')
      } else {
        await insert('warehouses', { ...payload, company_id: profile!.company_id, created_by: profile!.id })
        toast.push('Gudang ditambahkan')
      }
      setModal({ open: false }); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan gudang', 'error') }
    finally { setSaving(false) }
  }

  async function doDelete() {
    if (!confirmDel) return
    try { await remove('warehouses', confirmDel.id); toast.push('Gudang dihapus'); load() }
    catch (e: any) { toast.push(e.message ?? 'Gudang tidak dapat dihapus (masih dipakai transaksi)', 'error') }
  }

  const columns = [
    { key: 'code', header: 'Kode', width: '100px' },
    { key: 'name', header: 'Nama Gudang' },
    { key: 'warehouse_type', header: 'Jenis', render: (r: any) => <Badge tone="slate">{WAREHOUSE_TYPES.find(t => t.value === r.warehouse_type)?.label ?? r.warehouse_type}</Badge> },
    { key: 'branch_id', header: 'Cabang', render: (r: any) => branchName(r.branch_id) },
    { key: 'pic_id', header: 'PIC', render: (r: any) => picName(r.pic_id) },
    { key: 'address', header: 'Alamat', className: 'max-w-[240px] truncate' },
    { key: 'is_active', header: 'Status', render: (r: any) => r.is_active ? <Badge tone="emerald">Aktif</Badge> : <Badge tone="slate">Nonaktif</Badge> },
    {
      key: 'aksi', header: '', sortable: false, render: (r: any) => (
        <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
          {can('INVENTORY', 'write') && <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Ubah</Button>}
          {can('INVENTORY', 'approve') && <Button size="sm" variant="danger" onClick={() => setConfirmDel(r)}>Hapus</Button>}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Gudang" subtitle="Induk data gudang pusat, cabang, mobile, teknisi dan konsinyasi principal."
        actions={can('INVENTORY', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Gudang</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total Gudang" value={num(rows.length)} />
        {WAREHOUSE_TYPES.slice(0, 3).map(t => (
          <KpiCard key={t.value} label={t.label} value={num(rows.filter(r => r.warehouse_type === t.value).length)} />
        ))}
      </div>

      <FilterBar>
        <Field label="Jenis Gudang" className="w-56"><Select value={fType} onChange={(e: any) => setFType(e.target.value)} options={WAREHOUSE_TYPES} /></Field>
      </FilterBar>

      <DataTable columns={columns} rows={filtered} loading={loading} onRowClick={openEdit}
        searchable searchKeys={['code', 'name', 'address']} exportName="gudang"
        emptyTitle="Belum ada gudang" emptyMessage="Tambahkan gudang untuk mulai mengelola persediaan." />

      <Modal open={modal.open} onClose={() => setModal({ open: false })} size="lg"
        title={modal.row ? 'Ubah Gudang' : 'Tambah Gudang'}
        footer={<><Button variant="outline" onClick={() => setModal({ open: false })}>Batal</Button>
          <Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Kode Gudang" required><Input value={form.code ?? ''} onChange={(e: any) => setForm({ ...form, code: e.target.value })} placeholder="WH-001" /></Field>
          <Field label="Nama Gudang" required><Input value={form.name ?? ''} onChange={(e: any) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Jenis Gudang"><Select value={form.warehouse_type ?? 'pusat'} onChange={(e: any) => setForm({ ...form, warehouse_type: e.target.value })} options={WAREHOUSE_TYPES} /></Field>
          <Field label="Cabang"><Select value={form.branch_id ?? ''} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value })}
            options={branches.map(b => ({ value: b.id, label: b.name }))} /></Field>
          <Field label="PIC Gudang"><Select value={form.pic_id ?? ''} onChange={(e: any) => setForm({ ...form, pic_id: e.target.value })}
            options={pics.map(p => ({ value: p.id, label: p.full_name }))} /></Field>
          <Field label="Status"><Checkbox label="Gudang aktif" checked={form.is_active !== false} onChange={(e: any) => setForm({ ...form, is_active: e.target.checked })} /></Field>
          <Field label="Alamat" className="sm:col-span-2"><Input value={form.address ?? ''} onChange={(e: any) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Koordinat Lat"><Input type="number" step="any" value={form.lat ?? ''} onChange={(e: any) => setForm({ ...form, lat: e.target.value })} /></Field>
          <Field label="Koordinat Lng"><Input type="number" step="any" value={form.lng ?? ''} onChange={(e: any) => setForm({ ...form, lng: e.target.value })} /></Field>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={doDelete} danger
        title="Hapus Gudang" confirmLabel="Ya, Hapus"
        message={`Gudang "${confirmDel?.name}" akan dihapus permanen. Lanjutkan?`} />
    </div>
  )
}
