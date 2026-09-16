import React, { useEffect, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import { tgl, todayISO, num } from '@/lib/format'
import { PageHeader, FilterBar, KpiCard, DataTable, Modal, Button, Field, Input, Textarea, Select, Badge, useToast, Plus } from '@/components/ui'
import { GR_STATUS } from '../lib/shared'

type GrItemRow = { po_item_id: string; item_id: string; description: string; uom: string; sisa: number; qty_received: number; qty_rejected: number; reject_reason: string }

export default function GR() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const location = useLocation() as any
 const navigate = useNavigate()

 const [rows, setRows] = useState<any[]>([])
 const [pos, setPos] = useState<any[]>([])
 const [warehouses, setWarehouses] = useState<any[]>([])
 const [catalog, setCatalog] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [fStatus, setFStatus] = useState('')

 const [modal, setModal] = useState(false)
 const [selectedPoId, setSelectedPoId] = useState('')
 const [grDate, setGrDate] = useState(todayISO())
 const [note, setNote] = useState('')
 const [grItems, setGrItems] = useState<GrItemRow[]>([])
 const [saving, setSaving] = useState(false)

 const [detail, setDetail] = useState<any | null>(null)
 const [detailItems, setDetailItems] = useState<any[]>([])

 const load = useCallback(async () => {
 setLoading(true)
 try { setRows(await list('goods_receipts', { order: { col: 'gr_date', asc: false } })) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memuat data Good Receive', 'error') }
 finally { setLoading(false) }
 }, [toast])

 useEffect(() => {
 load()
 ;(async () => {
 try {
 const [po, w, c] = await Promise.all([
 list('purchase_orders', { in: { status: ['dikirim', 'diterima_sebagian'] }, order: { col: 'po_date', asc: false } }),
 list('warehouses', { order: { col: 'name', asc: true } }),
 list('item_catalog', { order: { col: 'name', asc: true } }),
 ])
 setPos(po); setWarehouses(w); setCatalog(c)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data referensi', 'error') }
 })()
 }, [load, toast])

 const openAdd = useCallback(async (poId?: string) => {
 setSelectedPoId(poId ?? ''); setGrDate(todayISO()); setNote(''); setGrItems([])
 if (poId) await pickPO(poId)
 setModal(true)
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 useEffect(() => { if (location.state?.fromPoId) { openAdd(location.state.fromPoId); navigate(location.pathname, { replace: true, state: null }) } }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

 async function pickPO(poId: string) {
 setSelectedPoId(poId)
 try {
 const items = await list('po_items', { eq: { po_id: poId } })
 setGrItems(items.filter((r: any) => Number(r.qty) - Number(r.qty_received) > 0.0001).map((r: any) => ({
 po_item_id: r.id, item_id: r.item_id, description: r.description, uom: r.uom,
 sisa: Number(r.qty) - Number(r.qty_received), qty_received: Number(r.qty) - Number(r.qty_received), qty_rejected: 0, reject_reason: '',
 })))
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat item PO', 'error') }
 }

 function patchRow(idx: number, patch: Partial<GrItemRow>) { setGrItems(v => v.map((r, i) => i === idx ? { ...r, ...patch } : r)) }

 async function save() {
 if (!selectedPoId) { toast.push('Pilih PO terlebih dahulu', 'error'); return }
 if (grItems.length === 0) { toast.push('Tidak ada item tersisa untuk diterima pada PO ini', 'error'); return }
 if (grItems.some(r => r.qty_rejected > 0 && !r.reject_reason.trim())) { toast.push('Alasan wajib diisi untuk item yang ditolak', 'error'); return }
 if (grItems.some(r => Number(r.qty_received) + Number(r.qty_rejected) > r.sisa + 0.0001)) { toast.push('Qty diterima + ditolak tidak boleh melebihi sisa qty PO', 'error'); return }
 setSaving(true)
 try {
 const po = pos.find(p => p.id === selectedPoId)
 const gr_no = await nextDocNo(profile!.company_id, 'GR')
 const gr = await insert('goods_receipts', {
 gr_no, gr_date: grDate, po_id: selectedPoId, warehouse_id: po?.warehouse_id, received_by: profile!.id,
 status: 'diterima', note, company_id: profile!.company_id, created_by: profile!.id,
 })
 for (const r of grItems) {
 await insert('gr_items', {
 company_id: profile!.company_id, gr_id: gr.id, po_item_id: r.po_item_id, item_id: r.item_id,
 qty_received: r.qty_received, qty_rejected: r.qty_rejected, reject_reason: r.reject_reason, note: '', created_by: profile!.id,
 })
 const poItem = await list('po_items', { eq: { id: r.po_item_id } })
 if (poItem[0]) await update('po_items', r.po_item_id, { qty_received: Number(poItem[0].qty_received) + Number(r.qty_received) })
 }
 const allItems = await list('po_items', { eq: { po_id: selectedPoId } })
 const fully = allItems.every((r: any) => Number(r.qty_received) >= Number(r.qty) - 0.0001)
 await update('purchase_orders', selectedPoId, { status: fully ? 'diterima' : 'diterima_sebagian' })
 toast.push('Good Receive tersimpan. Stok gudang diperbarui otomatis.')
 setModal(false); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan Good Receive', 'error') }
 finally { setSaving(false) }
 }

 const filtered = rows.filter(r => !fStatus || r.status === fStatus)
 const poNo = (id: string) => pos.find(p => p.id === id)?.po_no ?? rows.find(r => r.po_id === id)?.po_id ?? '-'
 const whName = (id: string) => warehouses.find(w => w.id === id)?.name ?? '-'
 const itemName = (id: string) => catalog.find(c => c.id === id)?.name ?? id

 async function openDetail(row: any) {
 setDetail(row)
 try { setDetailItems(await list('gr_items', { eq: { gr_id: row.id } })) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memuat item Good Receive', 'error') }
 }

 const columns = [
 { key: 'gr_no', header: 'No. GR', width: '150px' },
 { key: 'gr_date', header: 'Tanggal', render: (r: any) => tgl(r.gr_date) },
 { key: 'po_id', header: 'No. PO', render: (r: any) => poNo(r.po_id) },
 { key: 'warehouse_id', header: 'Gudang', render: (r: any) => whName(r.warehouse_id) },
 { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
 ]

 return (
 <div>
 <PageHeader title="Good Receive" subtitle="Penerimaan barang di gudang berdasarkan Purchase Order."
 actions={can('PROCUREMENT', 'write') && <Button icon={<Plus size={16} />} onClick={() => openAdd()}>Buat Good Receive</Button>} />

 <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
 <KpiCard label="Total GR" value={num(rows.length)} />
 <KpiCard label="PO Menunggu Diterima" value={num(pos.length)} tone="amber" sub="status dikirim / diterima sebagian" />
 <KpiCard label="GR Bulan Ini" value={num(rows.filter(r => (r.gr_date ?? '').slice(0, 7) === todayISO().slice(0, 7)).length)} tone="teal" />
 </div>

 <FilterBar><Field label="Status" className="w-52"><Select value={fStatus} onChange={(e: any) => setFStatus(e.target.value)} options={GR_STATUS} /></Field></FilterBar>

 <DataTable columns={columns} rows={filtered} loading={loading} onRowClick={openDetail}
 searchable searchKeys={['gr_no']} exportName="good-receive" emptyTitle="Belum ada Good Receive" emptyMessage="Buat GR dari PO yang telah terkirim." />

 <Modal open={modal} onClose={() => setModal(false)} size="xl" title="Buat Good Receive"
 footer={<><Button variant="outline" onClick={() => setModal(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid sm:grid-cols-3 gap-4 mb-4">
 <Field label="Purchase Order" required className="sm:col-span-2">
 <Select value={selectedPoId} onChange={(e: any) => pickPO(e.target.value)} options={pos.map(p => ({ value: p.id, label: `${p.po_no} — ${p.po_date}` }))} />
 </Field>
 <Field label="Tanggal Terima"><Input type="date" value={grDate} onChange={(e: any) => setGrDate(e.target.value)} /></Field>
 </div>
 {selectedPoId && (
 <div className="border border-ink-200 rounded-md overflow-hidden mb-3 overflow-x-auto">
 <table className="w-full text-body">
 <thead className="bg-ink-50"><tr className="text-caption uppercase text-ink-500">
 <th className="text-left px-2 py-2">Item</th><th className="text-right px-2 py-2">Sisa Qty</th>
 <th className="text-right px-2 py-2">Qty Diterima</th><th className="text-right px-2 py-2">Qty Ditolak</th><th className="text-left px-2 py-2">Alasan Penolakan</th>
 </tr></thead>
 <tbody>
 {grItems.map((r, i) => (
 <tr key={i} className="border-t border-ink-100">
 <td className="px-2 py-1.5">{r.description} <span className="text-caption text-ink-400">({r.uom})</span></td>
 <td className="px-2 py-1.5 text-right tabular">{num(r.sisa)}</td>
 <td className="px-2 py-1.5 w-28"><Input type="number" value={r.qty_received} onChange={(e: any) => patchRow(i, { qty_received: Number(e.target.value) })} className="text-right" /></td>
 <td className="px-2 py-1.5 w-28"><Input type="number" value={r.qty_rejected} onChange={(e: any) => patchRow(i, { qty_rejected: Number(e.target.value) })} className="text-right" /></td>
 <td className="px-2 py-1.5 min-w-[180px]"><Input value={r.reject_reason} onChange={(e: any) => patchRow(i, { reject_reason: e.target.value })} disabled={!r.qty_rejected} placeholder={r.qty_rejected ? 'wajib diisi' : '-'} /></td>
 </tr>
 ))}
 {grItems.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-center text-ink-400">Seluruh item PO ini sudah diterima penuh.</td></tr>}
 </tbody>
 </table>
 </div>
 )}
 <Field label="Catatan" className="mb-2"><Textarea value={note} onChange={(e: any) => setNote(e.target.value)} /></Field>
 <p className="text-caption text-ink-400">Catatan: penerimaan yang disimpan otomatis memperbarui saldo stok gudang tujuan pada modul Inventory.</p>
 </Modal>

 <Modal open={!!detail} onClose={() => setDetail(null)} size="lg" title={detail?.gr_no} subtitle={detail ? `PO ${poNo(detail.po_id)} · ${whName(detail?.warehouse_id)}` : ''}>
 {detail && (
 <DataTable searchable={false} rows={detailItems}
 columns={[{ key: 'item_id', header: 'Item', render: (r: any) => itemName(r.item_id) }, { key: 'qty_received', header: 'Diterima', align: 'right', render: (r: any) => num(r.qty_received) },
 { key: 'qty_rejected', header: 'Ditolak', align: 'right', render: (r: any) => num(r.qty_rejected) },
 { key: 'reject_reason', header: 'Alasan Penolakan', render: (r: any) => r.reject_reason || '-' }]}
 emptyTitle="Tidak ada item" />
 )}
 </Modal>
 </div>
 )
}
