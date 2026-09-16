import React, { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, insert, nextDocNo } from '@/lib/db'
import { rupiah, num, tglJam, todayISO } from '@/lib/format'
import { PageHeader, Card, CardHeader, KpiCard, Skeleton, useToast, Button, Modal, Field, Select, Input, Textarea, Plus } from '@/components/ui'
import { CHART_COLORS } from '../lib/shared'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const emptyPr = { branch_id: '', need_by_date: '', purpose: '', item_id: '', qty: 1, uom: '', estimate_price: 0 }

export default function Dashboard() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [prs, setPrs] = useState<any[]>([])
 const [pos, setPos] = useState<any[]>([])
 const [poItems, setPoItems] = useState<any[]>([])
 const [invoices, setInvoices] = useState<any[]>([])
 const [vendors, setVendors] = useState<any[]>([])
 const [pulledAt] = useState(() => new Date().toISOString())

 const [branches, setBranches] = useState<any[]>([])
 const [items, setItems] = useState<any[]>([])
 const [prOpen, setPrOpen] = useState(false)
 const [prForm, setPrForm] = useState<any>(emptyPr)
 const [prSaving, setPrSaving] = useState(false)

 useEffect(() => {
 ;(async () => {
 setLoading(true)
 try {
 const [pr, po, pi, inv, v, br, it] = await Promise.all([
 list('purchase_requests', { select: 'id,status,total_estimate' }),
 list('purchase_orders', { select: 'id,po_date,total,status,vendor_id' }),
 list('po_items', { select: 'po_id,qty,qty_received' }),
 list('vendor_invoices', { select: 'id,due_date,total,paid_amount,status,match_status' }),
 list('vendors', { select: 'id,name' }),
 list('branches', { select: 'id,name', order: { col: 'name', asc: true } }),
 list('item_catalog', { select: 'id,code,name,uom,last_price', eq: { is_active: true }, order: { col: 'name', asc: true } }),
 ])
 setPrs(pr); setPos(po); setPoItems(pi); setInvoices(inv); setVendors(v); setBranches(br); setItems(it)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat dashboard procurement', 'error') }
 finally { setLoading(false) }
 })()
 }, [toast])

 function openPr() { setPrForm({ ...emptyPr, branch_id: profile?.branch_id ?? '' }); setPrOpen(true) }
 function pickPrItem(itemId: string) {
 const it = items.find((x: any) => x.id === itemId)
 setPrForm((f: any) => ({ ...f, item_id: itemId, uom: it?.uom ?? '', estimate_price: Number(it?.last_price ?? 0) }))
 }
 async function savePr() {
 if (!prForm.branch_id || !prForm.need_by_date || !prForm.purpose) { toast.push('Cabang, tanggal dibutuhkan, dan tujuan wajib diisi', 'error'); return }
 if (!prForm.item_id || Number(prForm.qty) <= 0) { toast.push('Pilih item dan isi qty lebih dari 0', 'error'); return }
 setPrSaving(true)
 try {
 const pr_no = await nextDocNo(profile!.company_id, 'PR')
 const amount = Number(prForm.qty) * Number(prForm.estimate_price)
 const created = await insert<any>('purchase_requests', {
 company_id: profile!.company_id, pr_no, request_date: todayISO(), requester_id: profile!.id,
 branch_id: prForm.branch_id, unit: '', need_by_date: prForm.need_by_date, purpose: prForm.purpose,
 total_estimate: amount, status: 'draft', current_step: 0, created_by: profile!.id,
 })
 await insert('pr_items', {
 company_id: profile!.company_id, pr_id: created.id, item_id: prForm.item_id, description: '',
 qty: Number(prForm.qty), uom: prForm.uom, estimate_price: Number(prForm.estimate_price), amount,
 qty_po: 0, note: '', created_by: profile!.id,
 })
 toast.push(`PR ${pr_no} disimpan sebagai draft`)
 setPrOpen(false)
 setPrs(rs => [...rs, created])
 } catch (e: any) {
 const msg = /row-level security|permission denied/i.test(e?.message ?? '') ? 'Gagal menyimpan — hak akses Anda pada modul Procurement tidak mengizinkan tindakan ini.' : (e.message ?? 'Gagal menyimpan PR')
 toast.push(msg, 'error')
 } finally { setPrSaving(false) }
 }

 const prMenunggu = prs.filter(r => r.status === 'diajukan').length

 const now = new Date()
 const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
 const nilaiPoBulanIni = pos.filter(p => (p.po_date ?? '').slice(0, 7) === thisMonthKey).reduce((a, p) => a + Number(p.total), 0)

 const poProgress = useMemo(() => {
 const map: Record<string, { qty: number; rec: number }> = {}
 poItems.forEach((r: any) => { const m = map[r.po_id] ?? { qty: 0, rec: 0 }; m.qty += Number(r.qty); m.rec += Number(r.qty_received); map[r.po_id] = m })
 return map
 }, [poItems])
 const poBelumDiterimaPenuh = pos.filter(p => !['draft', 'batal', 'ditutup'].includes(p.status) && (poProgress[p.id]?.rec ?? 0) < (poProgress[p.id]?.qty ?? 0)).length

 const today = new Date().toISOString().slice(0, 10)
 const invoiceJatuhTempo = invoices.filter(i => !['lunas', 'ditolak'].includes(i.status) && i.due_date && i.due_date < today)
 const selisihMatch = invoices.filter(i => i.match_status === 'selisih').length

 const monthlyPo = useMemo(() => {
 const buckets: { key: string; label: string; total: number }[] = []
 for (let i = 5; i >= 0; i--) {
 const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
 buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, total: 0 })
 }
 pos.forEach(p => { const k = (p.po_date ?? '').slice(0, 7); const b = buckets.find(x => x.key === k); if (b) b.total += Number(p.total) })
 return buckets
 }, [pos])

 const topVendor = useMemo(() => {
 const map: Record<string, number> = {}
 pos.forEach(p => { map[p.vendor_id] = (map[p.vendor_id] ?? 0) + Number(p.total) })
 return Object.entries(map).map(([vendor_id, total]) => ({ name: vendors.find(v => v.id === vendor_id)?.name ?? '-', total }))
 .sort((a, b) => b.total - a.total).slice(0, 10)
 }, [pos, vendors])

 const prByStatus = useMemo(() => {
 const map: Record<string, number> = {}
 prs.forEach(p => { map[p.status] = (map[p.status] ?? 0) + 1 })
 return Object.entries(map).map(([name, value]) => ({ name, value }))
 }, [prs])

 if (loading) return (<div><PageHeader title="Dashboard Procurement" subtitle="Ringkasan kinerja pengadaan." />
 <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
 <Skeleton className="h-80" /></div>)

 return (
 <div>
 <PageHeader title="Dashboard Procurement" subtitle="Ringkasan kinerja pengadaan: PR, PO, penerimaan, dan tagihan vendor." />

 {can('PROCUREMENT', 'write') && (
 <div className="flex flex-wrap gap-2 mb-5">
 <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={openPr}>Buat PR</Button>
 </div>
 )}

 <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
 <KpiCard label="PR Menunggu Persetujuan" value={num(prMenunggu)} tone="amber" />
 <KpiCard label="Nilai PO Bulan Berjalan" value={rupiah(nilaiPoBulanIni, true)} tone="teal" />
 <KpiCard label="PO Belum Diterima Penuh" value={num(poBelumDiterimaPenuh)} tone="orange" />
 <KpiCard label="Invoice Vendor Jatuh Tempo" value={num(invoiceJatuhTempo.length)} sub={rupiah(invoiceJatuhTempo.reduce((a, r) => a + Number(r.total) - Number(r.paid_amount), 0), true)} tone="red" />
 <KpiCard label="Selisih 3-Way Match" value={num(selisihMatch)} tone="red" />
 </div>

 <div className="grid lg:grid-cols-2 gap-4 mb-4">
 <Card>
 <CardHeader title="Nilai PO per Bulan" subtitle="6 bulan terakhir" />
 <div className="p-4" style={{ height: 280 }}>
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={monthlyPo}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="label" tick={{ fontSize: 12 }} />
 <YAxis tickFormatter={(v) => rupiah(v, true)} tick={{ fontSize: 11 }} width={70} />
 <Tooltip formatter={(v: any) => rupiah(Number(v))} />
 <Bar dataKey="total" name="Nilai PO" fill={CHART_COLORS()[0]} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </Card>

 <Card>
 <CardHeader title="Top 10 Vendor berdasarkan Nilai PO" />
 <div className="p-4" style={{ height: 280 }}>
 {topVendor.length === 0 ? <p className="text-body text-ink-400 text-center py-16">Belum ada data PO.</p> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={topVendor} layout="vertical" margin={{ left: 8 }}>
 <CartesianGrid strokeDasharray="3 3" horizontal={false} />
 <XAxis type="number" tickFormatter={(v) => rupiah(v, true)} tick={{ fontSize: 11 }} />
 <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
 <Tooltip formatter={(v: any) => rupiah(Number(v))} />
 <Bar dataKey="total" name="Nilai PO" fill={CHART_COLORS()[1]} radius={[0, 4, 4, 0]} />
 </BarChart>
 </ResponsiveContainer>
 )}
 </div>
 </Card>
 </div>

 <div className="grid lg:grid-cols-2 gap-4 mb-2">
 <Card>
 <CardHeader title="Sebaran PR per Status" />
 <div className="p-4" style={{ height: 280 }}>
 {prByStatus.length === 0 ? <p className="text-body text-ink-400 text-center py-16">Belum ada data PR.</p> : (
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie data={prByStatus} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
 {prByStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS()[i % CHART_COLORS().length]} />)}
 </Pie>
 <Tooltip formatter={(v: any, n: any) => [`${v} PR`, n]} /><Legend />
 </PieChart>
 </ResponsiveContainer>
 )}
 </div>
 </Card>
 </div>

 <p className="text-caption text-ink-400 mt-2">
 Sumber data: tabel purchase_requests, purchase_orders, po_items, vendor_invoices (ditarik real-time). Terakhir ditarik: {tglJam(pulledAt)}.
 </p>

 <Modal open={prOpen} onClose={() => setPrOpen(false)} title="Buat PR"
 subtitle="Form ringkas — satu item. Untuk item tambahan atau pengajuan, buka halaman Purchase Request."
 footer={<><Button variant="outline" onClick={() => setPrOpen(false)}>Batal</Button><Button loading={prSaving} onClick={savePr}>Simpan Draft</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Cabang" required><Select value={prForm.branch_id} onChange={(e: any) => setPrForm({ ...prForm, branch_id: e.target.value })} options={branches.map(b => ({ value: b.id, label: b.name }))} /></Field>
 <Field label="Tanggal Dibutuhkan" required><Input type="date" value={prForm.need_by_date} onChange={(e: any) => setPrForm({ ...prForm, need_by_date: e.target.value })} /></Field>
 <Field label="Tujuan / Keperluan" required className="sm:col-span-2"><Textarea value={prForm.purpose} onChange={(e: any) => setPrForm({ ...prForm, purpose: e.target.value })} /></Field>
 <Field label="Item" required className="sm:col-span-2"><Select value={prForm.item_id} onChange={(e: any) => pickPrItem(e.target.value)} options={items.map((i: any) => ({ value: i.id, label: `${i.code} · ${i.name}` }))} /></Field>
 <Field label="Qty" required><Input type="number" min="0" value={prForm.qty} onChange={(e: any) => setPrForm({ ...prForm, qty: e.target.value })} /></Field>
 <Field label="Estimasi Harga Satuan"><Input type="number" min="0" value={prForm.estimate_price} onChange={(e: any) => setPrForm({ ...prForm, estimate_price: e.target.value })} /></Field>
 </div>
 </Modal>
 </div>
 )
}
