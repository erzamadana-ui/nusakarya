import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo } from '@/lib/db'
import { rupiah, tgl, todayISO, num } from '@/lib/format'
import {
  PageHeader, FilterBar, KpiCard, DataTable, Drawer, ConfirmDialog, Stepper, Badge,
  Button, Field, Input, Textarea, Select, Money, useToast, Plus,
} from '@/components/ui'
import { PR_STATUS, PR_STEPS, prStepIndex } from '../lib/shared'

type PrItemRow = { id?: string; item_id: string; description: string; qty: number; uom: string; estimate_price: number; amount: number; qty_po?: number }

export default function PR() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fStatus, setFStatus] = useState('')

  const [branches, setBranches] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [requesters, setRequesters] = useState<any[]>([])

  const [drawer, setDrawer] = useState<{ open: boolean; row?: any }>({ open: false })
  const [form, setForm] = useState<any>({})
  const [prItems, setPrItems] = useState<PrItemRow[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await list('purchase_requests', { order: { col: 'request_date', asc: false } })) }
    catch (e: any) { toast.push(e.message ?? 'Gagal memuat data PR', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => {
    load()
    ;(async () => {
      try {
        const [b, p, it, rq] = await Promise.all([
          list('branches', { order: { col: 'name', asc: true } }),
          list('projects', { order: { col: 'project_name', asc: true } }),
          list('item_catalog', { eq: { is_active: true }, order: { col: 'name', asc: true } }),
          list('profiles', { order: { col: 'full_name', asc: true } }),
        ])
        setBranches(b); setProjects(p); setItems(it); setRequesters(rq)
      } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data referensi', 'error') }
    })()
  }, [load, toast])

  const filtered = rows.filter(r => !fStatus || r.status === fStatus)
  const menungguCount = rows.filter(r => r.status === 'diajukan').length

  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? '-'
  const requesterName = (id: string) => requesters.find(r => r.id === id)?.full_name ?? '-'

  function openAdd() {
    setForm({ request_date: todayISO(), requester_id: profile!.id, branch_id: profile?.branch_id ?? '', unit: '', need_by_date: '', purpose: '', project_id: '', note: '', status: 'draft', current_step: 0 })
    setPrItems([])
    setDrawer({ open: true })
  }
  async function openDetail(row: any) {
    setForm({ ...row })
    try {
      const pi = await list('pr_items', { eq: { pr_id: row.id } })
      setPrItems(pi.map((x: any) => ({ ...x })))
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat item PR', 'error') }
    setDrawer({ open: true, row })
  }

  const editable = !drawer.row || drawer.row.status === 'draft'
  const totalEstimate = useMemo(() => prItems.reduce((a, r) => a + (Number(r.qty) * Number(r.estimate_price) || 0), 0), [prItems])

  function addItemRow() { setPrItems(v => [...v, { item_id: '', description: '', qty: 1, uom: '', estimate_price: 0, amount: 0 }]) }
  function removeItemRow(idx: number) { setPrItems(v => v.filter((_, i) => i !== idx)) }
  function patchItemRow(idx: number, patch: Partial<PrItemRow>) {
    setPrItems(v => v.map((r, i) => {
      if (i !== idx) return r
      const next = { ...r, ...patch }
      next.amount = Number(next.qty || 0) * Number(next.estimate_price || 0)
      return next
    }))
  }
  function onPickItem(idx: number, itemId: string) {
    const it = items.find(x => x.id === itemId)
    patchItemRow(idx, { item_id: itemId, description: it?.name ?? '', uom: it?.uom ?? '', estimate_price: Number(it?.last_price ?? 0) })
  }

  async function persist(nextStatus?: string, extra?: any) {
    if (!form.branch_id || !form.need_by_date || !form.purpose) { toast.push('Cabang, tanggal dibutuhkan, dan tujuan wajib diisi', 'error'); return null }
    if (prItems.length === 0) { toast.push('Tambahkan minimal satu item PR', 'error'); return null }
    if (prItems.some(r => !r.item_id || Number(r.qty) <= 0)) { toast.push('Setiap baris item wajib memilih item dan qty > 0', 'error'); return null }
    setSaving(true)
    try {
      let prId = drawer.row?.id
      const header: any = {
        branch_id: form.branch_id, requester_id: form.requester_id || profile!.id, unit: form.unit ?? '',
        need_by_date: form.need_by_date, purpose: form.purpose, project_id: form.project_id || null,
        note: form.note ?? '', total_estimate: totalEstimate, ...extra,
      }
      if (!prId) {
        const pr_no = await nextDocNo(profile!.company_id, 'PR')
        const created = await insert('purchase_requests', {
          ...header, pr_no, request_date: form.request_date || todayISO(), status: nextStatus ?? 'draft',
          current_step: nextStatus === 'diajukan' ? 1 : 0, company_id: profile!.company_id, created_by: profile!.id,
        })
        prId = created.id
        for (const r of prItems) {
          await insert('pr_items', {
            company_id: profile!.company_id, pr_id: prId, item_id: r.item_id, description: r.description,
            qty: r.qty, uom: r.uom, estimate_price: r.estimate_price, amount: Number(r.qty) * Number(r.estimate_price),
            qty_po: 0, note: '', created_by: profile!.id,
          })
        }
      } else {
        await update('purchase_requests', prId, { ...header, status: nextStatus ?? drawer.row.status, current_step: nextStatus === 'diajukan' ? 1 : drawer.row.current_step })
        const existing = await list('pr_items', { eq: { pr_id: prId } })
        for (const ex of existing) if (!prItems.some(r => r.id === ex.id)) await remove('pr_items', ex.id)
        for (const r of prItems) {
          if (r.id) await update('pr_items', r.id, { item_id: r.item_id, description: r.description, qty: r.qty, uom: r.uom, estimate_price: r.estimate_price, amount: Number(r.qty) * Number(r.estimate_price) })
          else await insert('pr_items', { company_id: profile!.company_id, pr_id: prId, item_id: r.item_id, description: r.description, qty: r.qty, uom: r.uom, estimate_price: r.estimate_price, amount: Number(r.qty) * Number(r.estimate_price), qty_po: 0, note: '', created_by: profile!.id })
        }
      }
      return prId
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan PR', 'error'); return null }
    finally { setSaving(false) }
  }

  async function onSaveDraft() { if (await persist()) { toast.push('Draft PR tersimpan'); setDrawer({ open: false }); load() } }
  async function onAjukan() { if (await persist('diajukan')) { toast.push('PR diajukan untuk persetujuan'); setDrawer({ open: false }); load() } }
  async function onSetujui() {
    setSaving(true)
    try { await update('purchase_requests', drawer.row.id, { status: 'disetujui', current_step: 2 }); toast.push('PR disetujui'); setDrawer({ open: false }); load() }
    catch (e: any) { toast.push(e.message ?? 'Gagal menyetujui PR', 'error') } finally { setSaving(false) }
  }
  async function onTolak() {
    if (!rejectReason.trim()) { toast.push('Alasan penolakan wajib diisi', 'error'); return }
    setSaving(true)
    try {
      await update('purchase_requests', drawer.row.id, { status: 'ditolak', note: `${form.note ?? ''}\nAlasan penolakan: ${rejectReason}`.trim() })
      toast.push('PR ditolak'); setConfirmReject(false); setRejectReason(''); setDrawer({ open: false }); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menolak PR', 'error') } finally { setSaving(false) }
  }
  function buatPO() { navigate('/procurement/po', { state: { fromPrId: drawer.row.id } }) }

  const columns = [
    { key: 'pr_no', header: 'No. PR', width: '150px' },
    { key: 'request_date', header: 'Tanggal', render: (r: any) => tgl(r.request_date) },
    { key: 'requester_id', header: 'Pemohon', render: (r: any) => requesterName(r.requester_id) },
    { key: 'branch_id', header: 'Cabang', render: (r: any) => branchName(r.branch_id) },
    { key: 'need_by_date', header: 'Dibutuhkan', render: (r: any) => tgl(r.need_by_date) },
    { key: 'total_estimate', header: 'Estimasi Nilai', align: 'right' as const, render: (r: any) => rupiah(r.total_estimate) },
    { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
  ]

  return (
    <div>
      <PageHeader title="Purchase Request" subtitle="Pengajuan kebutuhan pembelian material, jasa, dan aset."
        actions={can('PROCUREMENT', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Buat PR</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total PR" value={num(rows.length)} />
        <KpiCard label="Menunggu Persetujuan" value={num(menungguCount)} tone="amber" />
        <KpiCard label="Disetujui" value={num(rows.filter(r => r.status === 'disetujui' || r.status === 'sebagian_po' || r.status === 'selesai').length)} tone="teal" />
        <KpiCard label="Ditolak" value={num(rows.filter(r => r.status === 'ditolak').length)} tone="red" />
      </div>

      <FilterBar>
        <Field label="Status" className="w-52"><Select value={fStatus} onChange={(e: any) => setFStatus(e.target.value)} options={PR_STATUS} /></Field>
      </FilterBar>

      <DataTable columns={columns} rows={filtered} loading={loading} onRowClick={openDetail}
        searchable searchKeys={['pr_no', 'unit', 'purpose']} exportName="purchase-request"
        emptyTitle="Belum ada Purchase Request" emptyMessage="Buat PR untuk memulai proses pengadaan." />

      <Drawer open={drawer.open} onClose={() => setDrawer({ open: false })} width="max-w-3xl"
        title={drawer.row ? drawer.row.pr_no : 'Buat Purchase Request'}
        footer={<div className="flex flex-wrap justify-end gap-2 w-full">
          {editable && can('PROCUREMENT', 'write') && <Button variant="outline" loading={saving} onClick={onSaveDraft}>Simpan Draft</Button>}
          {editable && can('PROCUREMENT', 'write') && <Button loading={saving} onClick={onAjukan}>Ajukan</Button>}
          {drawer.row?.status === 'diajukan' && can('PROCUREMENT', 'approve') && (
            <><Button variant="danger" onClick={() => setConfirmReject(true)}>Tolak</Button>
              <Button variant="success" loading={saving} onClick={onSetujui}>Setujui</Button></>
          )}
          {(drawer.row?.status === 'disetujui' || drawer.row?.status === 'sebagian_po') && can('PROCUREMENT', 'write') && (
            <Button onClick={buatPO}>Buat PO dari PR ini</Button>
          )}
        </div>}>
        {drawer.row && <div className="mb-4"><Stepper steps={PR_STEPS} current={prStepIndex(drawer.row.status)} /></div>}
        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          <Field label="Tanggal Pengajuan"><Input type="date" disabled={!editable} value={form.request_date ?? ''} onChange={(e: any) => setForm({ ...form, request_date: e.target.value })} /></Field>
          <Field label="Pemohon"><Select disabled={!editable} value={form.requester_id ?? ''} onChange={(e: any) => setForm({ ...form, requester_id: e.target.value })}
            options={requesters.map(r => ({ value: r.id, label: r.full_name }))} /></Field>
          <Field label="Cabang" required><Select disabled={!editable} value={form.branch_id ?? ''} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value })}
            options={branches.map(b => ({ value: b.id, label: b.name }))} /></Field>
          <Field label="Unit / Departemen"><Input disabled={!editable} value={form.unit ?? ''} onChange={(e: any) => setForm({ ...form, unit: e.target.value })} /></Field>
          <Field label="Tanggal Dibutuhkan" required><Input type="date" disabled={!editable} value={form.need_by_date ?? ''} onChange={(e: any) => setForm({ ...form, need_by_date: e.target.value })} /></Field>
          <Field label="Tautan Proyek (opsional)"><Select disabled={!editable} value={form.project_id ?? ''} onChange={(e: any) => setForm({ ...form, project_id: e.target.value })}
            options={projects.map(p => ({ value: p.id, label: p.project_name }))} /></Field>
          <Field label="Tujuan Pengadaan" required className="sm:col-span-2"><Textarea disabled={!editable} value={form.purpose ?? ''} onChange={(e: any) => setForm({ ...form, purpose: e.target.value })} /></Field>
          <Field label="Catatan" className="sm:col-span-2"><Textarea disabled={!editable} value={form.note ?? ''} onChange={(e: any) => setForm({ ...form, note: e.target.value })} /></Field>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h4 className="font-display font-semibold text-[13px] uppercase tracking-wide text-ink-500">Item Kebutuhan</h4>
          {editable && <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={addItemRow}>Tambah Baris</Button>}
        </div>
        <div className="border border-ink-200 dark:border-ink-800 rounded-md overflow-hidden mb-2">
          <table className="w-full text-body">
            <thead className="bg-ink-50 dark:bg-surface-darker">
              <tr className="text-caption uppercase text-ink-500">
                <th className="text-left px-2 py-2">Item</th><th className="text-left px-2 py-2">Satuan</th>
                <th className="text-right px-2 py-2">Qty</th><th className="text-right px-2 py-2">Estimasi Harga</th>
                <th className="text-right px-2 py-2">Subtotal</th>{editable && <th className="px-2 py-2 w-10" />}
              </tr>
            </thead>
            <tbody>
              {prItems.map((r, i) => (
                <tr key={i} className="border-t border-ink-100 dark:border-ink-800">
                  <td className="px-2 py-1.5 min-w-[220px]">
                    <Select disabled={!editable} value={r.item_id} onChange={(e: any) => onPickItem(i, e.target.value)} options={items.map(it => ({ value: it.id, label: `${it.code} — ${it.name}` }))} />
                  </td>
                  <td className="px-2 py-1.5 w-24"><Input disabled={!editable} value={r.uom} onChange={(e: any) => patchItemRow(i, { uom: e.target.value })} /></td>
                  <td className="px-2 py-1.5 w-24"><Input type="number" disabled={!editable} value={r.qty} onChange={(e: any) => patchItemRow(i, { qty: Number(e.target.value) })} className="text-right" /></td>
                  <td className="px-2 py-1.5 w-36"><Money disabled={!editable} value={r.estimate_price} onChange={(v: number) => patchItemRow(i, { estimate_price: v })} /></td>
                  <td className="px-2 py-1.5 text-right tabular w-36">{rupiah(Number(r.qty) * Number(r.estimate_price))}</td>
                  {editable && <td className="px-2 py-1.5 text-center"><button onClick={() => removeItemRow(i)} className="text-red-500 hover:text-red-700 text-caption">Hapus</button></td>}
                </tr>
              ))}
              {prItems.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-ink-400">Belum ada item. Klik "Tambah Baris".</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end text-body-l font-semibold">Total Estimasi: {rupiah(totalEstimate)}</div>
      </Drawer>

      <ConfirmDialog open={confirmReject} onClose={() => setConfirmReject(false)} onConfirm={onTolak} danger
        confirmLabel="Tolak PR" title="Tolak Purchase Request"
        message={<div className="space-y-2"><p>Berikan alasan penolakan (wajib diisi):</p>
          <Textarea value={rejectReason} onChange={(e: any) => setRejectReason(e.target.value)} /></div> as any} />
    </div>
  )
}
