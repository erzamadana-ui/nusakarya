import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update } from '@/lib/db'
import { rupiah, num, pct, tgl } from '@/lib/format'
import {
  PageHeader, FilterBar, KpiCard, DataTable, Modal,
  Button, Field, Input, Select, Badge, useToast, Plus,
} from '@/components/ui'
import { usageVariance, USAGE_TOLERANCE_PERCENT } from '../lib/shared'

export default function Pemakaian() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fProject, setFProject] = useState(''); const [fWo, setFWo] = useState('')

  const [modal, setModal] = useState<{ open: boolean; row?: any }>({ open: false })
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mu, it, wo, pr] = await Promise.all([
        list('material_usages', {
          select: 'id,work_order_id,project_id,item_id,qty_plan,qty_actual,variance,variance_percent,is_over_tolerance,note,reported_at,item:item_catalog!item_id(code,name,uom,last_price)',
          order: { col: 'reported_at', asc: false }, limit: 1000,
        }),
        list('item_catalog', { order: { col: 'name', asc: true } }),
        list('work_orders', { select: 'id,wo_no,title', order: { col: 'created_at', asc: false }, limit: 300 }),
        list('projects', { select: 'id,project_code,project_name', order: { col: 'created_at', asc: false }, limit: 300 }),
      ])
      setRows(mu); setItems(it); setWorkOrders(wo); setProjects(pr)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data pemakaian material', 'error') }
    finally { setLoading(false) }
  }, [toast])
  useEffect(() => { load() }, [load])

  const woLabel = (id?: string | null) => id ? (workOrders.find(w => w.id === id)?.wo_no ?? '-') : '-'
  const prLabel = (id?: string | null) => id ? (projects.find(p => p.id === id)?.project_code ?? '-') : '-'

  const filtered = useMemo(() => rows.filter(r => (!fProject || r.project_id === fProject) && (!fWo || r.work_order_id === fWo)), [rows, fProject, fWo])
  const totalNilaiSelisih = useMemo(() => filtered.reduce((s, r) => s + Number(r.variance || 0) * Number(r.item?.last_price || 0), 0), [filtered])
  const jumlahOver = useMemo(() => filtered.filter(r => r.is_over_tolerance).length, [filtered])

  function openAdd() {
    setForm({ work_order_id: '', project_id: '', item_id: '', qty_plan: '', qty_actual: '', note: '' })
    setModal({ open: true })
  }
  function openEdit(row: any) { setForm({ ...row, qty_plan: row.qty_plan ?? '', qty_actual: row.qty_actual ?? '' }); setModal({ open: true, row }) }

  async function save() {
    if (!form.item_id) { toast.push('Pilih item', 'error'); return }
    if (!form.work_order_id && !form.project_id) { toast.push('Pilih work order atau proyek', 'error'); return }
    setSaving(true)
    try {
      const v = usageVariance(Number(form.qty_plan || 0), Number(form.qty_actual || 0))
      const payload = {
        work_order_id: form.work_order_id || null, project_id: form.project_id || null, item_id: form.item_id,
        qty_plan: Number(form.qty_plan || 0), qty_actual: Number(form.qty_actual || 0),
        variance: v.variance, variance_percent: v.variance_percent, is_over_tolerance: v.is_over_tolerance,
        note: form.note || null,
      }
      if (modal.row) {
        await update('material_usages', modal.row.id, { ...payload, reported_by: profile!.id, reported_at: new Date().toISOString() })
        toast.push('Data pemakaian diperbarui')
      } else {
        await insert('material_usages', { ...payload, company_id: profile!.company_id, reported_by: profile!.id, reported_at: new Date().toISOString(), created_by: profile!.id })
        toast.push('Data pemakaian dicatat')
      }
      setModal({ open: false }); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan data pemakaian', 'error') }
    finally { setSaving(false) }
  }

  const columns = [
    { key: 'item_name', header: 'Item', render: (r: any) => <span>{r.item?.code} · {r.item?.name}</span> },
    { key: 'ref', header: 'Proyek / WO', render: (r: any) => r.project_id ? prLabel(r.project_id) : woLabel(r.work_order_id) },
    { key: 'qty_plan', header: 'Qty Rencana (BoQ)', align: 'right' as const, render: (r: any) => `${num(r.qty_plan)} ${r.item?.uom ?? ''}` },
    { key: 'qty_actual', header: 'Qty Realisasi', align: 'right' as const, render: (r: any) => `${num(r.qty_actual)} ${r.item?.uom ?? ''}` },
    { key: 'variance', header: 'Selisih', align: 'right' as const, render: (r: any) => <span className={r.is_over_tolerance ? 'text-red-600 font-semibold' : ''}>{num(r.variance)}</span> },
    { key: 'variance_percent', header: 'Selisih %', align: 'right' as const, render: (r: any) => <span className={r.is_over_tolerance ? 'text-red-600 font-semibold' : ''}>{pct(r.variance_percent)}</span> },
    { key: 'status', header: 'Status', render: (r: any) => r.is_over_tolerance ? <Badge tone="red">Lewat Toleransi</Badge> : <Badge tone="emerald">Wajar</Badge> },
    { key: 'reported_at', header: 'Tgl Lapor', render: (r: any) => tgl(r.reported_at) },
    {
      key: 'aksi', header: '', sortable: false, render: (r: any) => (
        <div onClick={e => e.stopPropagation()}>{can('INVENTORY', 'write') && <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Koreksi</Button>}</div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Pemakaian vs BoQ" subtitle="Rekonsiliasi pemakaian material aktual terhadap rencana BoQ per proyek/work order."
        actions={can('INVENTORY', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Catat Pemakaian</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <KpiCard label="Baris Pemakaian" value={num(filtered.length)} />
        <KpiCard label="Lewat Toleransi" value={num(jumlahOver)} tone="red" />
        <KpiCard label={`Estimasi Nilai Selisih (> ${USAGE_TOLERANCE_PERCENT}%)`} value={rupiah(totalNilaiSelisih, true)}
          sub="berdasar harga terakhir item" tone={totalNilaiSelisih > 0 ? 'red' : 'emerald'} />
      </div>

      <FilterBar>
        <Field label="Proyek" className="w-56"><Select value={fProject} onChange={(e: any) => setFProject(e.target.value)}
          options={projects.map(p => ({ value: p.id, label: p.project_code }))} /></Field>
        <Field label="Work Order" className="w-56"><Select value={fWo} onChange={(e: any) => setFWo(e.target.value)}
          options={workOrders.map(w => ({ value: w.id, label: w.wo_no }))} /></Field>
      </FilterBar>

      <DataTable columns={columns} rows={filtered} loading={loading} searchable={false} exportName="pemakaian-boq"
        emptyTitle="Belum ada data pemakaian" />
      <p className="text-caption text-ink-400 mt-2">Toleransi selisih sistem: {USAGE_TOLERANCE_PERCENT}%. Estimasi nilai selisih dihitung dari item_catalog.last_price, bukan harga aktual transaksi.</p>

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.row ? 'Koreksi Pemakaian' : 'Catat Pemakaian'}
        footer={<><Button variant="outline" onClick={() => setModal({ open: false })}>Batal</Button>
          <Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Proyek"><Select value={form.project_id ?? ''} onChange={(e: any) => setForm({ ...form, project_id: e.target.value })}
            options={projects.map(p => ({ value: p.id, label: p.project_code }))} /></Field>
          <Field label="Work Order"><Select value={form.work_order_id ?? ''} onChange={(e: any) => setForm({ ...form, work_order_id: e.target.value })}
            options={workOrders.map(w => ({ value: w.id, label: w.wo_no }))} /></Field>
          <Field label="Item" required className="sm:col-span-2"><Select value={form.item_id ?? ''} onChange={(e: any) => setForm({ ...form, item_id: e.target.value })}
            options={items.map(i => ({ value: i.id, label: `${i.code} · ${i.name}` }))} /></Field>
          <Field label="Qty Rencana (BoQ)"><Input type="number" min="0" value={form.qty_plan ?? ''} onChange={(e: any) => setForm({ ...form, qty_plan: e.target.value })} /></Field>
          <Field label="Qty Realisasi"><Input type="number" min="0" value={form.qty_actual ?? ''} onChange={(e: any) => setForm({ ...form, qty_actual: e.target.value })} /></Field>
          <Field label="Catatan" className="sm:col-span-2"><Input value={form.note ?? ''} onChange={(e: any) => setForm({ ...form, note: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}
