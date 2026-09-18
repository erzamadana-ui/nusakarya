import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo } from '@/lib/db'
import { rupiah, tgl, todayISO, num } from '@/lib/format'
import {
 PageHeader, FilterBar, KpiCard, DataTable, Drawer, Modal, Stepper, Progress, Badge,
 Button, Field, Input, Textarea, Select, Money, useToast, Plus,
} from '@/components/ui'
import { PO_STATUS, PO_STEPS, poStepIndex } from '../lib/shared'

type PoItemRow = { id?: string; item_id: string; description: string; qty: number; uom: string; price: number; discount: number; qty_received?: number }

export default function PO() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const navigate = useNavigate()
 const location = useLocation() as any

 const [rows, setRows] = useState<any[]>([])
 const [vendors, setVendors] = useState<any[]>([])
 const [warehouses, setWarehouses] = useState<any[]>([])
 const [prs, setPrs] = useState<any[]>([])
 const [items, setItems] = useState<any[]>([])
 const [progressMap, setProgressMap] = useState<Record<string, { qty: number; rec: number }>>({})
 const [loading, setLoading] = useState(true)
 const [fStatus, setFStatus] = useState('')

 const [drawer, setDrawer] = useState<{ open: boolean; row?: any }>({ open: false })
 const [form, setForm] = useState<any>({})
 const [poItems, setPoItems] = useState<PoItemRow[]>([])
 const [discountHeader, setDiscountHeader] = useState(0)
 const [ppnPercent, setPpnPercent] = useState(11)
 const [saving, setSaving] = useState(false)
 const printRef = useRef<HTMLDivElement>(null)
 const [closeOpen, setCloseOpen] = useState(false)
 const [closeReason, setCloseReason] = useState('')

 const load = useCallback(async () => {
 setLoading(true)
 try {
 const [po, pi] = await Promise.all([
 list('purchase_orders', { order: { col: 'po_date', asc: false } }),
 list('po_items', { select: 'po_id,qty,qty_received' }),
 ])
 setRows(po)
 const map: Record<string, { qty: number; rec: number }> = {}
 pi.forEach((r: any) => { const m = map[r.po_id] ?? { qty: 0, rec: 0 }; m.qty += Number(r.qty); m.rec += Number(r.qty_received); map[r.po_id] = m })
 setProgressMap(map)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data PO', 'error') }
 finally { setLoading(false) }
 }, [toast])

 useEffect(() => {
 load()
 ;(async () => {
 try {
 const [v, w, pr, it] = await Promise.all([
 list('vendors', { eq: { status: 'aktif' }, order: { col: 'name', asc: true } }),
 list('warehouses', { eq: { is_active: true }, order: { col: 'name', asc: true } }),
 // Hanya PR yang sudah sah boleh jadi dasar PO. Sebelumnya SEMUA PR dimuat —
 // termasuk yang masih draft, baru diajukan, bahkan yang sudah ditolak.
 list('purchase_requests', { in: { status: ['disetujui', 'sebagian_po'] }, order: { col: 'pr_no', asc: false } }),
 list('item_catalog', { eq: { is_active: true }, order: { col: 'name', asc: true } }),
 ])
 setVendors(v); setWarehouses(w); setPrs(pr); setItems(it)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data referensi', 'error') }
 })()
 }, [load, toast])

 // Prefill dari PR / RFQ (navigasi lintas halaman)
 useEffect(() => {
 const st = location.state
 if (!st?.fromPrId) return
 ;(async () => {
 try {
 const prList = await list('purchase_requests', { eq: { id: st.fromPrId } })
 const pr = prList[0]
 const pi = await list('pr_items', { eq: { pr_id: st.fromPrId } })
 setForm({ po_date: todayISO(), vendor_id: st.fromVendorId ?? '', pr_id: st.fromPrId, rfq_id: st.fromRfqId ?? '', delivery_date: '', warehouse_id: '', payment_term_days: 30, note: '', status: 'draft' })
 setPoItems(pi.filter((r: any) => Number(r.qty) - Number(r.qty_po) > 0).map((r: any) => ({
 item_id: r.item_id, description: r.description, qty: Number(r.qty) - Number(r.qty_po), uom: r.uom, price: r.estimate_price, discount: 0,
 })))
 setDiscountHeader(0); setPpnPercent(11)
 setDrawer({ open: true })
 toast.push(`Item disalin dari PR ${pr?.pr_no ?? ''}`)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data PR untuk PO', 'error') }
 navigate(location.pathname, { replace: true, state: null })
 })()
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [location.state])

 const filtered = rows.filter(r => !fStatus || r.status === fStatus)
 const vendorName = (id: string) => vendors.find(v => v.id === id)?.name ?? '-'

 function openAdd() {
 setForm({ po_date: todayISO(), vendor_id: '', pr_id: '', rfq_id: '', delivery_date: '', warehouse_id: '', payment_term_days: 30, note: '', status: 'draft' })
 setPoItems([]); setDiscountHeader(0); setPpnPercent(11)
 setDrawer({ open: true })
 }
 async function openDetail(row: any) {
 setForm({ ...row })
 setDiscountHeader(Number(row.discount) || 0)
 const sub = Number(row.subtotal) || 0
 setPpnPercent(sub > 0 ? Math.round((Number(row.ppn) / (sub - (Number(row.discount) || 0))) * 1000) / 10 : 11)
 try { setPoItems((await list('po_items', { eq: { po_id: row.id } })).map((x: any) => ({ ...x }))) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memuat item PO', 'error') }
 setDrawer({ open: true, row })
 }

 const editable = !drawer.row || drawer.row.status === 'draft'
 const subtotal = useMemo(() => poItems.reduce((a, r) => a + (Number(r.qty) * Number(r.price) - Number(r.discount || 0)), 0), [poItems])
 const ppnAmount = useMemo(() => Math.round((subtotal - discountHeader) * (ppnPercent / 100)), [subtotal, discountHeader, ppnPercent])
 const total = subtotal - discountHeader + ppnAmount

 function addItemRow() { setPoItems(v => [...v, { item_id: '', description: '', qty: 1, uom: '', price: 0, discount: 0 }]) }
 function removeItemRow(idx: number) { setPoItems(v => v.filter((_, i) => i !== idx)) }
 function patchItemRow(idx: number, patch: Partial<PoItemRow>) { setPoItems(v => v.map((r, i) => i === idx ? { ...r, ...patch } : r)) }
 function onPickItem(idx: number, itemId: string) {
 const it = items.find(x => x.id === itemId)
 patchItemRow(idx, { item_id: itemId, description: it?.name ?? '', uom: it?.uom ?? '', price: Number(it?.last_price ?? 0) })
 }
 function onPickVendor(vendorId: string) {
 const v = vendors.find(x => x.id === vendorId)
 setForm((f: any) => ({ ...f, vendor_id: vendorId, payment_term_days: v?.payment_term_days ?? f.payment_term_days }))
 }

 async function persist(nextStatus?: string) {
 if (!form.vendor_id || !form.warehouse_id || !form.delivery_date) { toast.push('Vendor, gudang tujuan, dan tanggal kirim wajib diisi', 'error'); return null }
 if (poItems.length === 0 || poItems.some(r => !r.item_id || Number(r.qty) <= 0)) { toast.push('Tambahkan minimal satu item PO dengan qty > 0', 'error'); return null }
 setSaving(true)
 try {
 let poId = drawer.row?.id
 const header: any = {
 vendor_id: form.vendor_id, pr_id: form.pr_id || null, rfq_id: form.rfq_id || null, delivery_date: form.delivery_date,
 warehouse_id: form.warehouse_id, subtotal, discount: discountHeader, ppn: ppnAmount, total,
 payment_term_days: form.payment_term_days || 30, note: form.note ?? '', status: nextStatus ?? 'draft',
 }
 if (!poId) {
 const po_no = await nextDocNo(profile!.company_id, 'PO')
 const created = await insert('purchase_orders', { ...header, po_no, po_date: form.po_date || todayISO(), currency: 'IDR', file_url: '', company_id: profile!.company_id, created_by: profile!.id })
 poId = created.id
 for (const r of poItems) await insert('po_items', {
 company_id: profile!.company_id, po_id: poId, item_id: r.item_id, description: r.description, qty: r.qty, uom: r.uom,
 price: r.price, discount: r.discount || 0, amount: Number(r.qty) * Number(r.price) - Number(r.discount || 0), qty_received: 0, created_by: profile!.id,
 })
 // Tandai qty PR yang sudah dikonversi ke PO ini agar sisa qty PR akurat untuk PO berikutnya.
 if (form.pr_id) {
 const prItemsList = await list('pr_items', { eq: { pr_id: form.pr_id } })
 for (const r of poItems) {
 const match = prItemsList.find((p: any) => p.item_id === r.item_id)
 if (match) await update('pr_items', match.id, { qty_po: Number(match.qty_po) + Number(r.qty) })
 }
 const refreshed = await list('pr_items', { eq: { pr_id: form.pr_id } })
 const fullyConverted = refreshed.every((p: any) => Number(p.qty_po) >= Number(p.qty) - 0.0001)
 await update('purchase_requests', form.pr_id, { status: fullyConverted ? 'selesai' : 'sebagian_po' })
 }
 } else {
 await update('purchase_orders', poId, header)
 const existing = await list('po_items', { eq: { po_id: poId } })
 for (const ex of existing) if (!poItems.some(r => r.id === ex.id)) await remove('po_items', ex.id)
 for (const r of poItems) {
 const amount = Number(r.qty) * Number(r.price) - Number(r.discount || 0)
 if (r.id) await update('po_items', r.id, { item_id: r.item_id, description: r.description, qty: r.qty, uom: r.uom, price: r.price, discount: r.discount || 0, amount })
 else await insert('po_items', { company_id: profile!.company_id, po_id: poId, item_id: r.item_id, description: r.description, qty: r.qty, uom: r.uom, price: r.price, discount: r.discount || 0, amount, qty_received: 0, created_by: profile!.id })
 }
 }
 return poId
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan PO', 'error'); return null }
 finally { setSaving(false) }
 }

 async function onSaveDraft() { if (await persist()) { toast.push('Draft PO tersimpan'); setDrawer({ open: false }); load() } }
 async function onAjukan() { if (await persist('diajukan')) { toast.push('PO diajukan untuk persetujuan'); setDrawer({ open: false }); load() } }
 async function setStatus(status: string, msg: string) {
 setSaving(true)
 try {
 await update('purchase_orders', drawer.row.id, { status })
 if (status === 'disetujui' && drawer.row.pr_id) await update('purchase_requests', drawer.row.pr_id, { status: 'sebagian_po' })
 toast.push(msg); setDrawer({ open: false }); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal memperbarui status PO', 'error') }
 finally { setSaving(false) }
 }
 function buatGR() { navigate('/procurement/gr', { state: { fromPoId: drawer.row.id } }) }
 function cetak() { window.print() }
 function openClose() { setCloseReason(''); setCloseOpen(true) }
 async function doClose() {
 if (!closeReason.trim()) { toast.push('Alasan penutupan wajib diisi', 'error'); return }
 setSaving(true)
 try {
 const note = `${drawer.row.note ?? ''}${drawer.row.note ? '\n' : ''}Alasan penutupan PO: ${closeReason}`.trim()
 await update('purchase_orders', drawer.row.id, { status: 'ditutup', note })
 toast.push('PO ditutup'); setCloseOpen(false); setDrawer({ open: false }); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menutup PO', 'error') }
 finally { setSaving(false) }
 }

 const columns = [
 { key: 'po_no', header: 'No. PO', width: '150px' },
 { key: 'po_date', header: 'Tanggal', render: (r: any) => tgl(r.po_date) },
 { key: 'vendor_id', header: 'Vendor', render: (r: any) => vendorName(r.vendor_id) },
 { key: 'delivery_date', header: 'Target Kirim', render: (r: any) => tgl(r.delivery_date) },
 { key: 'total', header: 'Total', align: 'right' as const, render: (r: any) => rupiah(r.total) },
 {
 key: 'progress', header: 'Progres Terima', width: '140px', sortable: false, render: (r: any) => {
 const m = progressMap[r.id]; const pct = m && m.qty > 0 ? Math.round((m.rec / m.qty) * 100) : 0
 return <div className="flex items-center gap-2"><Progress value={pct} tone={pct >= 100 ? 'success' : 'primary'} height={6} /><span className="text-caption text-ink-500 w-9 text-right">{pct}%</span></div>
 },
 },
 { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
 ]

 return (
 <div>
 <PageHeader title="Purchase Order" subtitle="Pemesanan resmi ke vendor beserta pelacakan penerimaan barang."
 actions={can('PROCUREMENT', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Buat PO</Button>} />

 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
 <KpiCard label="Total PO" value={num(rows.length)} />
 <KpiCard label="Menunggu Persetujuan" value={num(rows.filter(r => r.status === 'diajukan').length)} tone="amber" />
 <KpiCard label="Belum Diterima Penuh" value={num(rows.filter(r => !['draft', 'batal', 'ditutup'].includes(r.status) && (progressMap[r.id]?.rec ?? 0) < (progressMap[r.id]?.qty ?? 0)).length)} tone="orange" />
 <KpiCard label="Nilai Total PO" value={rupiah(rows.reduce((a, r) => a + Number(r.total), 0), true)} tone="teal" />
 </div>

 <FilterBar><Field label="Status" className="w-52"><Select value={fStatus} onChange={(e: any) => setFStatus(e.target.value)} options={PO_STATUS} /></Field></FilterBar>

 <DataTable columns={columns} rows={filtered} loading={loading} onRowClick={openDetail}
 searchable searchKeys={['po_no']} exportName="purchase-order" emptyTitle="Belum ada Purchase Order" emptyMessage="Buat PO dari PR yang telah disetujui atau RFQ." />

 <Drawer open={drawer.open} onClose={() => setDrawer({ open: false })} width="max-w-3xl"
 title={drawer.row ? drawer.row.po_no : 'Buat Purchase Order'}
 footer={<div className="flex flex-wrap justify-end gap-2 w-full">
 {drawer.row && <Button variant="outline" onClick={cetak}>Cetak PO</Button>}
 {editable && can('PROCUREMENT', 'write') && <Button variant="outline" loading={saving} onClick={onSaveDraft}>Simpan Draft</Button>}
 {editable && can('PROCUREMENT', 'write') && <Button loading={saving} onClick={onAjukan}>Ajukan</Button>}
 {drawer.row?.status === 'diajukan' && can('PROCUREMENT', 'approve') && (
 <><Button variant="danger" loading={saving} onClick={() => setStatus('batal', 'PO dibatalkan')}>Tolak</Button>
 <Button variant="success" loading={saving} onClick={() => setStatus('disetujui', 'PO disetujui')}>Setujui</Button></>
 )}
 {drawer.row?.status === 'disetujui' && can('PROCUREMENT', 'write') && <Button loading={saving} onClick={() => setStatus('dikirim', 'PO ditandai terkirim ke vendor')}>Tandai Terkirim</Button>}
 {['dikirim', 'diterima_sebagian'].includes(drawer.row?.status) && can('PROCUREMENT', 'write') && <Button onClick={buatGR}>Buat Good Receive</Button>}
 {drawer.row?.status === 'diterima_sebagian' && can('PROCUREMENT', 'approve') && <Button variant="danger" onClick={openClose}>Tutup PO</Button>}
 </div>}>
 {drawer.row && <div className="mb-4"><Stepper steps={PO_STEPS} current={poStepIndex(drawer.row.status)} /></div>}
 <div className="grid sm:grid-cols-2 gap-4 mb-5">
 <Field label="Tanggal PO"><Input type="date" disabled={!editable} value={form.po_date ?? ''} onChange={(e: any) => setForm({ ...form, po_date: e.target.value })} /></Field>
 <Field label="Vendor" required><Select disabled={!editable} value={form.vendor_id ?? ''} onChange={(e: any) => onPickVendor(e.target.value)} options={vendors.map(v => ({ value: v.id, label: v.name }))} /></Field>
 <Field label="Referensi PR (opsional)"><Select disabled={!editable} value={form.pr_id ?? ''} onChange={(e: any) => setForm({ ...form, pr_id: e.target.value })} options={prs.map(p => ({ value: p.id, label: p.pr_no }))} /></Field>
 <Field label="Gudang Tujuan" required><Select disabled={!editable} value={form.warehouse_id ?? ''} onChange={(e: any) => setForm({ ...form, warehouse_id: e.target.value })} options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Field>
 <Field label="Target Tanggal Kirim" required><Input type="date" disabled={!editable} value={form.delivery_date ?? ''} onChange={(e: any) => setForm({ ...form, delivery_date: e.target.value })} /></Field>
 <Field label="Termin Pembayaran (hari)"><Input type="number" disabled={!editable} value={form.payment_term_days ?? 30} onChange={(e: any) => setForm({ ...form, payment_term_days: Number(e.target.value) })} /></Field>
 <Field label="Catatan" className="sm:col-span-2"><Textarea disabled={!editable} value={form.note ?? ''} onChange={(e: any) => setForm({ ...form, note: e.target.value })} /></Field>
 </div>

 <div className="flex items-center justify-between mb-2">
 <h4 className="font-display font-semibold text-[13px] uppercase tracking-wide text-ink-500">Item Pesanan</h4>
 {editable && <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={addItemRow}>Tambah Baris</Button>}
 </div>
 <div className="border border-ink-200 rounded-md overflow-hidden mb-3 overflow-x-auto">
 <table className="w-full text-body">
 <thead className="bg-ink-50"><tr className="text-caption uppercase text-ink-500">
 <th className="text-left px-2 py-2">Item</th><th className="text-right px-2 py-2">Qty</th><th className="text-right px-2 py-2">Harga</th>
 <th className="text-right px-2 py-2">Diskon</th><th className="text-right px-2 py-2">Subtotal</th>
 {drawer.row && <th className="text-left px-2 py-2 w-32">Progres Terima</th>}{editable && <th className="px-2 py-2 w-10" />}
 </tr></thead>
 <tbody>
 {poItems.map((r, i) => (
 <tr key={i} className="border-t border-ink-100">
 <td className="px-2 py-1.5 min-w-[200px]"><Select disabled={!editable} value={r.item_id} onChange={(e: any) => onPickItem(i, e.target.value)} options={items.map(it => ({ value: it.id, label: `${it.code} — ${it.name}` }))} /></td>
 <td className="px-2 py-1.5 w-20"><Input type="number" disabled={!editable} value={r.qty} onChange={(e: any) => patchItemRow(i, { qty: Number(e.target.value) })} className="text-right" /></td>
 <td className="px-2 py-1.5 w-32"><Money disabled={!editable} value={r.price} onChange={(v: number) => patchItemRow(i, { price: v })} /></td>
 <td className="px-2 py-1.5 w-28"><Money disabled={!editable} value={r.discount} onChange={(v: number) => patchItemRow(i, { discount: v })} /></td>
 <td className="px-2 py-1.5 text-right tabular w-32">{rupiah(Number(r.qty) * Number(r.price) - Number(r.discount || 0))}</td>
 {drawer.row && <td className="px-2 py-1.5"><div className="flex items-center gap-2"><Progress value={r.qty ? (Number(r.qty_received || 0) / Number(r.qty)) * 100 : 0} height={6} /><span className="text-caption text-ink-500">{num(r.qty_received || 0)}/{num(r.qty)}</span></div></td>}
 {editable && <td className="px-2 py-1.5 text-center"><button onClick={() => removeItemRow(i)} className="text-red-500 hover:text-red-700 text-caption">Hapus</button></td>}
 </tr>
 ))}
 {poItems.length === 0 && <tr><td colSpan={7} className="px-2 py-6 text-center text-ink-400">Belum ada item.</td></tr>}
 </tbody>
 </table>
 </div>
 <div className="ml-auto max-w-xs space-y-1.5 text-body">
 <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span className="tabular">{rupiah(subtotal)}</span></div>
 <div className="flex justify-between items-center"><span className="text-ink-500">Diskon</span>{editable ? <Money value={discountHeader} onChange={setDiscountHeader} className="w-40 h-8" /> : <span className="tabular">{rupiah(discountHeader)}</span>}</div>
 <div className="flex justify-between items-center"><span className="text-ink-500">PPN (%)</span>{editable ? <Input type="number" value={ppnPercent} onChange={(e: any) => setPpnPercent(Number(e.target.value))} className="w-40 h-8 text-right" /> : <span className="tabular">{ppnPercent}%</span>}</div>
 <div className="flex justify-between"><span className="text-ink-500">Nilai PPN</span><span className="tabular">{rupiah(ppnAmount)}</span></div>
 <div className="flex justify-between text-body-l font-semibold border-t border-ink-200 pt-1.5"><span>Total PO</span><span className="tabular">{rupiah(total)}</span></div>
 </div>
 </Drawer>

 <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="Tutup PO"
 footer={<><Button variant="outline" onClick={() => setCloseOpen(false)}>Batal</Button>
 <Button variant="danger" loading={saving} onClick={doClose}>Tutup PO</Button></>}>
 <p className="text-body text-ink-600 mb-3">PO akan ditandai ditutup — dipakai bila kekurangan kirim diterima sebagai final dan vendor tidak akan mengirim sisanya. Sisa qty yang belum diterima tidak akan ditagih.</p>
 <Field label="Alasan Penutupan" required><Textarea value={closeReason} onChange={(e: any) => setCloseReason(e.target.value)} placeholder="Contoh: sisa kiriman dibatalkan, vendor tidak sanggup memenuhi kekurangan…" /></Field>
 </Modal>

 {/* Area cetak — tersembunyi di layar, tampil khusus saat window.print() */}
 <style>{`@media print { body * { visibility: hidden; } #po-print-area, #po-print-area * { visibility: visible; } #po-print-area { position: fixed; inset: 0; padding: 32px; background: #fff; color: #000; } }`}</style>
 <div id="po-print-area" className="hidden print:block" ref={printRef}>
 {drawer.row && (<div>
 <h1 className="text-xl font-bold mb-1">Purchase Order — {drawer.row.po_no}</h1>
 <p className="mb-4">Tanggal: {tgl(form.po_date)} · Vendor: {vendorName(form.vendor_id)} · Target Kirim: {tgl(form.delivery_date)}</p>
 <table className="w-full text-sm border-collapse mb-4">
 <thead><tr className="border-b border-black"><th className="text-left py-1">Item</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Harga</th><th className="text-right py-1">Subtotal</th></tr></thead>
 <tbody>{poItems.map((r, i) => (<tr key={i} className="border-b"><td className="py-1">{r.description}</td><td className="text-right py-1">{num(r.qty)} {r.uom}</td><td className="text-right py-1">{rupiah(r.price)}</td><td className="text-right py-1">{rupiah(Number(r.qty) * Number(r.price) - Number(r.discount || 0))}</td></tr>))}</tbody>
 </table>
 <p className="text-right">Subtotal: {rupiah(subtotal)}</p>
 <p className="text-right">Diskon: {rupiah(discountHeader)}</p>
 <p className="text-right">PPN: {rupiah(ppnAmount)}</p>
 <p className="text-right font-bold">Total: {rupiah(total)}</p>
 </div>)}
 </div>
 </div>
 )
}
