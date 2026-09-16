import React, { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { useAuth } from '@/lib/auth'
import { list } from '@/lib/db'
import { rupiah, num, tglJam } from '@/lib/format'
import { PageHeader, Card, CardHeader, KpiCard, Skeleton, useToast } from '@/components/ui'
import { CHART_COLORS } from '../lib/shared'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export default function Dashboard() {
 const { profile } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [prs, setPrs] = useState<any[]>([])
 const [pos, setPos] = useState<any[]>([])
 const [poItems, setPoItems] = useState<any[]>([])
 const [invoices, setInvoices] = useState<any[]>([])
 const [vendors, setVendors] = useState<any[]>([])
 const [pulledAt] = useState(() => new Date().toISOString())

 useEffect(() => {
 ;(async () => {
 setLoading(true)
 try {
 const [pr, po, pi, inv, v] = await Promise.all([
 list('purchase_requests', { select: 'id,status,total_estimate' }),
 list('purchase_orders', { select: 'id,po_date,total,status,vendor_id' }),
 list('po_items', { select: 'po_id,qty,qty_received' }),
 list('vendor_invoices', { select: 'id,due_date,total,paid_amount,status,match_status' }),
 list('vendors', { select: 'id,name' }),
 ])
 setPrs(pr); setPos(po); setPoItems(pi); setInvoices(inv); setVendors(v)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat dashboard procurement', 'error') }
 finally { setLoading(false) }
 })()
 }, [toast])

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
 </div>
 )
}
