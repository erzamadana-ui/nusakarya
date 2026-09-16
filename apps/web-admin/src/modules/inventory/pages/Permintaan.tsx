import React, { useCallback, useEffect, useState } from 'react'
import supabase from '@/lib/supabase'
import { X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import { num, tgl, todayISO } from '@/lib/format'
import {
  PageHeader, FilterBar, KpiCard, DataTable, Modal, Drawer, Stepper, ConfirmDialog,
  Button, Field, Input, Textarea, Select, Badge, useToast, Plus,
} from '@/components/ui'
import { MR_STATUS, MR_STEPS, mrStepIndex } from '../lib/shared'

export default function Permintaan() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fStatus, setFStatus] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<any>({ warehouse_id: '', work_order_id: '', project_id: '', purpose: '' })
  const [lines, setLines] = useState<{ item_id: string; qty_request: string }[]>([{ item_id: '', qty_request: '' }])
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState<any | null>(null)
  const [detailItems, setDetailItems] = useState<any[]>([])
  const [rejectConfirm, setRejectConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mr, it, w, wo, pr, pf] = await Promise.all([
        list('material_requests', { order: { col: 'request_date', asc: false }, limit: 500 }),
        list('item_catalog', { order: { col: 'name', asc: true } }),
        list('warehouses', { order: { col: 'name', asc: true } }),
        list('work_orders', { select: 'id,wo_no,title', order: { col: 'created_at', asc: false }, limit: 300 }),
        list('projects', { select: 'id,project_code,project_name', order: { col: 'created_at', asc: false }, limit: 300 }),
        list('profiles', { select: 'id,full_name' }),
      ])
      setRows(mr); setItems(it); setWarehouses(w); setWorkOrders(wo); setProjects(pr); setProfiles(pf)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat permintaan material', 'error') }
    finally { setLoading(false) }
  }, [toast])
  useEffect(() => { load() }, [load])

  const wname = (id: string) => warehouses.find(w => w.id === id)?.name ?? '-'
  const woLabel = (id?: string | null) => id ? (workOrders.find(w => w.id === id)?.wo_no ?? '-') : null
  const prLabel = (id?: string | null) => id ? (projects.find(p => p.id === id)?.project_code ?? '-') : null
  const requesterName = (id?: string | null) => profiles.find(p => p.id === id)?.full_name ?? '-'
  const itemLabel = (id: string) => { const i = items.find(x => x.id === id); return i ? `${i.code} · ${i.name}` : '-' }

  const filtered = rows.filter(r => !fStatus || r.status === fStatus)

  function openAdd() {
    setForm({ warehouse_id: '', work_order_id: '', project_id: '', purpose: '' })
    setLines([{ item_id: '', qty_request: '' }])
    setModalOpen(true)
  }
  function addLine() { setLines([...lines, { item_id: '', qty_request: '' }]) }
  function removeLine(i: number) { setLines(lines.filter((_, idx) => idx !== i)) }
  function setLine(i: number, patch: any) { setLines(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l)) }

  async function save() {
    if (!form.warehouse_id) { toast.push('Pilih gudang tujuan permintaan', 'error'); return }
    const valid = lines.filter(l => l.item_id && Number(l.qty_request) > 0)
    if (valid.length === 0) { toast.push('Tambahkan minimal satu item dengan qty > 0', 'error'); return }
    setSaving(true)
    try {
      const mr_no = await nextDocNo(profile!.company_id, 'MR')
      const mr = await insert<any>('material_requests', {
        company_id: profile!.company_id, mr_no, request_date: todayISO(), requester_id: profile!.id,
        warehouse_id: form.warehouse_id, work_order_id: form.work_order_id || null, project_id: form.project_id || null,
        purpose: form.purpose || null, status: 'diajukan', created_by: profile!.id,
      })
      const itemRows = valid.map(l => {
        const item = items.find(i => i.id === l.item_id)
        return { company_id: profile!.company_id, mr_id: mr.id, item_id: l.item_id, qty_request: Number(l.qty_request), uom: item?.uom ?? null, created_by: profile!.id }
      })
      const { error } = await supabase.from('material_request_items').insert(itemRows)
      if (error) throw error
      toast.push(`Permintaan ${mr_no} diajukan`)
      setModalOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan permintaan material', 'error') }
    finally { setSaving(false) }
  }

  async function openDetail(row: any) {
    setDetail(row)
    try {
      const it = await list('material_request_items', { eq: { mr_id: row.id }, select: 'id,item_id,qty_request,qty_approved,qty_issued,uom,item:item_catalog!item_id(code,name)' })
      setDetailItems((it as any[]).map(r => ({ ...r, item_code: r.item?.code, item_name: r.item?.name })))
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat item permintaan', 'error') }
  }

  async function approve() {
    if (!detail) return
    setBusy(true)
    try {
      await Promise.all(detailItems.map(it => update('material_request_items', it.id, { qty_approved: it.qty_approved ?? it.qty_request })))
      await update('material_requests', detail.id, { status: 'disetujui' })
      toast.push('Permintaan disetujui')
      setDetail({ ...detail, status: 'disetujui' }); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyetujui permintaan', 'error') }
    finally { setBusy(false) }
  }

  async function reject() {
    if (!detail) return
    setBusy(true)
    try {
      await update('material_requests', detail.id, { status: 'ditolak' })
      toast.push('Permintaan ditolak')
      setDetail({ ...detail, status: 'ditolak' }); setRejectConfirm(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menolak permintaan', 'error') }
    finally { setBusy(false) }
  }

  async function issue() {
    if (!detail) return
    setBusy(true)
    try {
      for (const it of detailItems) {
        const qty = Number(it.qty_approved ?? it.qty_request)
        if (qty <= 0) continue
        await supabase.from('stock_movements').insert({
          company_id: profile!.company_id, move_no: await nextDocNo(profile!.company_id, 'MOV'), move_date: todayISO(),
          move_type: 'ISSUE', item_id: it.item_id, qty, uom: it.uom,
          from_warehouse_id: detail.warehouse_id, to_employee_id: detail.requester_id,
          work_order_id: detail.work_order_id, note: `Pengeluaran atas Permintaan Material ${detail.mr_no}`, created_by: profile!.id,
        })
        await update('material_request_items', it.id, { qty_issued: qty })
      }
      await update('material_requests', detail.id, { status: 'dikeluarkan' })
      toast.push('Material dikeluarkan, saldo stok diperbarui otomatis')
      setDetail({ ...detail, status: 'dikeluarkan' }); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal mengeluarkan material', 'error') }
    finally { setBusy(false) }
  }

  const columns = [
    { key: 'mr_no', header: 'No. Permintaan' },
    { key: 'request_date', header: 'Tanggal', render: (r: any) => tgl(r.request_date) },
    { key: 'warehouse_id', header: 'Gudang', render: (r: any) => wname(r.warehouse_id) },
    { key: 'ref', header: 'Referensi', render: (r: any) => woLabel(r.work_order_id) ?? prLabel(r.project_id) ?? '-' },
    { key: 'requester_id', header: 'Pemohon', render: (r: any) => requesterName(r.requester_id) },
    { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
  ]

  return (
    <div>
      <PageHeader title="Permintaan Material" subtitle="Permintaan material teknisi/proyek dari gudang, lengkap alur persetujuan dan pengeluaran."
        actions={can('INVENTORY', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Buat Permintaan</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {MR_STATUS.map(s => <KpiCard key={s} label={s.replace('_', ' ')} value={num(rows.filter(r => r.status === s).length)} />)}
      </div>

      <FilterBar>
        <Field label="Status" className="w-56"><Select value={fStatus} onChange={(e: any) => setFStatus(e.target.value)} options={MR_STATUS.map(s => ({ value: s, label: s }))} /></Field>
      </FilterBar>

      <DataTable columns={columns} rows={filtered} loading={loading} onRowClick={openDetail}
        searchable searchKeys={['mr_no']} exportName="permintaan-material" emptyTitle="Belum ada permintaan material" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="xl" title="Buat Permintaan Material"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
          <Button loading={saving} onClick={save}>Ajukan Permintaan</Button></>}>
        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <Field label="Gudang" required><Select value={form.warehouse_id} onChange={(e: any) => setForm({ ...form, warehouse_id: e.target.value })}
            options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Field>
          <Field label="Work Order (opsional)"><Select value={form.work_order_id} onChange={(e: any) => setForm({ ...form, work_order_id: e.target.value })}
            options={workOrders.map(w => ({ value: w.id, label: w.wo_no }))} /></Field>
          <Field label="Proyek (opsional)"><Select value={form.project_id} onChange={(e: any) => setForm({ ...form, project_id: e.target.value })}
            options={projects.map(p => ({ value: p.id, label: p.project_code }))} /></Field>
          <Field label="Tujuan Penggunaan" className="sm:col-span-3"><Textarea value={form.purpose} onChange={(e: any) => setForm({ ...form, purpose: e.target.value })} /></Field>
        </div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-caption font-medium text-ink-500 uppercase tracking-wide">Item Diminta</span>
          <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={addLine}>Tambah Baris</Button>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1"><Select value={l.item_id} onChange={(e: any) => setLine(i, { item_id: e.target.value })}
                options={items.map(it => ({ value: it.id, label: `${it.code} · ${it.name}` }))} /></div>
              <div className="w-32"><Input type="number" min="0" placeholder="Qty" value={l.qty_request} onChange={(e: any) => setLine(i, { qty_request: e.target.value })} /></div>
              <button onClick={() => removeLine(i)} className="p-2 text-ink-400 hover:text-red-600"><X size={16} /></button>
            </div>
          ))}
        </div>
      </Modal>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.mr_no} width="max-w-2xl">
        {detail && (<>
          <div className="mb-4"><Stepper steps={MR_STEPS} current={mrStepIndex(detail.status)} /></div>
          <div className="grid sm:grid-cols-2 gap-3 text-body mb-4">
            <div><span className="text-caption text-ink-400 block">Gudang</span>{wname(detail.warehouse_id)}</div>
            <div><span className="text-caption text-ink-400 block">Pemohon</span>{requesterName(detail.requester_id)}</div>
            <div><span className="text-caption text-ink-400 block">Referensi</span>{woLabel(detail.work_order_id) ?? prLabel(detail.project_id) ?? '-'}</div>
            <div><span className="text-caption text-ink-400 block">Tujuan</span>{detail.purpose ?? '-'}</div>
          </div>
          <DataTable searchable={false} rows={detailItems}
            columns={[
              { key: 'item_name', header: 'Item', render: (r: any) => <span>{r.item_code} · {r.item_name}</span> },
              { key: 'qty_request', header: 'Diminta', align: 'right', render: (r: any) => num(r.qty_request) },
              { key: 'qty_approved', header: 'Disetujui', align: 'right', render: (r: any) => num(r.qty_approved ?? r.qty_request) },
              { key: 'qty_issued', header: 'Dikeluarkan', align: 'right', render: (r: any) => num(r.qty_issued ?? 0) },
            ]} emptyTitle="Belum ada item" />
          {can('INVENTORY', 'approve') && (
            <div className="flex justify-end gap-2 mt-4">
              {detail.status === 'diajukan' && <>
                <Button variant="danger" loading={busy} onClick={() => setRejectConfirm(true)}>Tolak</Button>
                <Button loading={busy} onClick={approve}>Setujui</Button>
              </>}
              {detail.status === 'disetujui' && <Button loading={busy} onClick={issue}>Keluarkan Material</Button>}
            </div>
          )}
        </>)}
      </Drawer>

      <ConfirmDialog open={rejectConfirm} onClose={() => setRejectConfirm(false)} onConfirm={reject} danger
        title="Tolak Permintaan" confirmLabel="Ya, Tolak" message={`Permintaan "${detail?.mr_no}" akan ditolak. Lanjutkan?`} />
    </div>
  )
}
