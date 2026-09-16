import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import {
  PageHeader, Tabs, DataTable, Badge, Button, Modal, Field, Input, Textarea, Checkbox,
  ConfirmDialog, useToast, Plus, cx,
} from '@/components/ui'

const REF_GROUPS = [
  { value: 'STO', label: 'STO' },
  { value: 'AREA', label: 'Area' },
  { value: 'KATEGORI_GANGGUAN', label: 'Kategori Gangguan' },
  { value: 'JENIS_MATERIAL', label: 'Jenis Material' },
  { value: 'BANK', label: 'Bank' },
  { value: 'SATUAN', label: 'Satuan' },
  { value: 'LAINNYA', label: 'Lainnya' },
]

type AttrRow = { key: string; value: string }

const emptyForm = { id: null as string | null, code: '', name: '', parent_code: '', sort_order: 0, is_active: true }

function attrsToRows(attrs: any): AttrRow[] {
  if (!attrs || typeof attrs !== 'object') return []
  return Object.entries(attrs).map(([key, value]) => ({ key, value: String(value ?? '') }))
}
function rowsToAttrs(rows: AttrRow[]): Record<string, string> {
  const o: Record<string, string> = {}
  rows.forEach(r => { if (r.key.trim()) o[r.key.trim()] = r.value })
  return o
}

export default function DataMaster() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [group, setGroup] = useState('STO')

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)
  const [attrRows, setAttrRows] = useState<AttrRow[]>([])

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importBusy, setImportBusy] = useState(false)

  const [confirmDeactivate, setConfirmDeactivate] = useState<any>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await list<any>('master_references', { order: { col: 'ref_group', asc: true } })
      setRows(data)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data master', 'error') }
    finally { setLoading(false) }
  }

  const filtered = useMemo(
    () => rows.filter(r => r.ref_group === group).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.code.localeCompare(b.code)),
    [rows, group]
  )

  function openAdd() {
    setForm({ ...emptyForm, sort_order: filtered.length })
    setAttrRows([])
    setModalOpen(true)
  }
  function openEdit(r: any) {
    setForm({ id: r.id, code: r.code, name: r.name, parent_code: r.parent_code ?? '', sort_order: r.sort_order ?? 0, is_active: r.is_active })
    setAttrRows(attrsToRows(r.attributes))
    setModalOpen(true)
  }

  async function save() {
    if (!form.code.trim() || !form.name.trim()) { toast.push('Kode dan nama wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const payload: any = {
        ref_group: group, code: form.code.trim(), name: form.name.trim(),
        parent_code: form.parent_code.trim() || null, sort_order: Number(form.sort_order) || 0,
        attributes: rowsToAttrs(attrRows), is_active: !!form.is_active,
      }
      if (form.id) {
        await update('master_references', form.id, payload)
        toast.push('Data master diperbarui')
      } else {
        await insert('master_references', { ...payload, company_id: profile?.company_id, created_by: profile?.id })
        toast.push('Data master ditambahkan')
      }
      setModalOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan data master', 'error') }
    finally { setSaving(false) }
  }

  async function toggleActive(r: any) {
    try {
      await update('master_references', r.id, { is_active: !r.is_active })
      toast.push(r.is_active ? 'Data dinonaktifkan' : 'Data diaktifkan')
      load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status', 'error') }
  }

  async function doDelete() {
    try {
      await remove('master_references', confirmDeactivate.id)
      toast.push('Data master dihapus')
      setConfirmDeactivate(null); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menghapus data. Coba nonaktifkan saja.', 'error') }
  }

  async function runImport() {
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) { toast.push('Tempel data terlebih dahulu, format kode|nama per baris', 'error'); return }
    setImportBusy(true)
    try {
      let seq = filtered.length
      const items = lines.map(line => {
        const [code, ...rest] = line.split('|')
        return { company_id: profile?.company_id, ref_group: group, code: (code ?? '').trim(), name: rest.join('|').trim() || (code ?? '').trim(), sort_order: seq++, is_active: true, attributes: {}, created_by: profile?.id }
      }).filter(it => it.code)
      if (!items.length) { toast.push('Tidak ada baris valid (format: kode|nama)', 'error'); return }
      for (const it of items) await insert('master_references', it)
      toast.push(`${items.length} data berhasil diimpor ke ${REF_GROUPS.find(g => g.value === group)?.label}`)
      setImportOpen(false); setImportText(''); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal mengimpor data', 'error') }
    finally { setImportBusy(false) }
  }

  return (
    <div>
      <PageHeader title="Data Master Referensi" subtitle="Data referensi yang dipakai lintas modul"
        actions={can('CORE', 'write') && <>
          <Button variant="outline" onClick={() => setImportOpen(true)}>Impor Cepat</Button>
          <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah</Button>
        </>} />

      <Tabs className="mb-4" value={group} onChange={setGroup}
        tabs={REF_GROUPS.map(g => ({ ...g, count: rows.filter(r => r.ref_group === g.value).length }))} />

      <DataTable
        loading={loading} rows={filtered} searchKeys={['code', 'name']}
        emptyTitle="Belum ada data" emptyMessage={`Tambahkan data referensi untuk kelompok ${REF_GROUPS.find(g => g.value === group)?.label}`}
        columns={[
          { key: 'code', header: 'Kode', width: '120px' },
          { key: 'name', header: 'Nama' },
          { key: 'parent_code', header: 'Kode Induk', render: r => r.parent_code ?? '-' },
          { key: 'sort_order', header: 'Urutan', align: 'right' },
          { key: 'attributes', header: 'Atribut', render: r => {
            const n = r.attributes ? Object.keys(r.attributes).length : 0
            return n > 0 ? <span className="text-caption text-ink-500">{n} atribut</span> : <span className="text-ink-300">-</span>
          } },
          { key: 'is_active', header: 'Status', render: r => <Badge tone={r.is_active ? 'emerald' : 'zinc'}>{r.is_active ? 'Aktif' : 'Nonaktif'}</Badge> },
          ...(can('CORE', 'write') ? [{ key: 'aksi', header: 'Aksi', align: 'center' as const, sortable: false, render: (r: any) => (
            <div className="flex items-center gap-1.5 justify-center">
              <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Ubah</Button>
              <Button size="sm" variant={r.is_active ? 'secondary' : 'success'} onClick={() => toggleActive(r)}>{r.is_active ? 'Nonaktifkan' : 'Aktifkan'}</Button>
              {can('CORE', 'approve') && <Button size="sm" variant="danger" onClick={() => setConfirmDeactivate(r)}>Hapus</Button>}
            </div>
          ) }] : []),
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? 'Ubah Data Master' : 'Tambah Data Master'}
        subtitle={REF_GROUPS.find(g => g.value === group)?.label}
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Kode" required><Input value={form.code} onChange={(e: any) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Nama" required><Input value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Kode Induk" hint="Opsional, untuk relasi hierarki"><Input value={form.parent_code} onChange={(e: any) => setForm({ ...form, parent_code: e.target.value })} /></Field>
          <Field label="Urutan"><Input type="number" value={form.sort_order} onChange={(e: any) => setForm({ ...form, sort_order: e.target.value })} /></Field>
          <Field className="sm:col-span-2"><Checkbox label="Aktif" checked={form.is_active} onChange={(e: any) => setForm({ ...form, is_active: e.target.checked })} /></Field>

          <Field label="Atribut" className="sm:col-span-2" hint="Pasangan kunci-nilai bebas, contoh: latitude / -6.20">
            <div className="space-y-2">
              {attrRows.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input placeholder="kunci" value={a.key} onChange={(e: any) => setAttrRows(rs => rs.map((r, j) => j === i ? { ...r, key: e.target.value } : r))} className="max-w-[160px]" />
                  <Input placeholder="nilai" value={a.value} onChange={(e: any) => setAttrRows(rs => rs.map((r, j) => j === i ? { ...r, value: e.target.value } : r))} />
                  <Button size="sm" variant="ghost" onClick={() => setAttrRows(rs => rs.filter((_, j) => j !== i))}>Hapus</Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setAttrRows(rs => [...rs, { key: '', value: '' }])}>+ Tambah Atribut</Button>
            </div>
          </Field>
        </div>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Impor Cepat" size="sm"
        subtitle={`Ke kelompok: ${REF_GROUPS.find(g => g.value === group)?.label}`}
        footer={<><Button variant="outline" onClick={() => setImportOpen(false)}>Batal</Button><Button loading={importBusy} onClick={runImport}>Impor</Button></>}>
        <Field label="Data" hint="Satu baris satu data, format: kode|nama">
          <Textarea rows={8} value={importText} onChange={(e: any) => setImportText(e.target.value)} placeholder={'STO-JKT01|STO Jakarta 01\nSTO-JKT02|STO Jakarta 02'} className={cx('font-mono')} />
        </Field>
      </Modal>

      <ConfirmDialog open={!!confirmDeactivate} onClose={() => setConfirmDeactivate(null)} onConfirm={doDelete}
        title="Hapus Data Master" danger confirmLabel="Ya, Hapus"
        message={`Hapus data "${confirmDeactivate?.name}" secara permanen? Bila data ini masih dirujuk modul lain, nonaktifkan saja daripada menghapus.`} />
    </div>
  )
}
