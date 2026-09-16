import React, { useEffect, useMemo, useState } from 'react'
import { chartColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { list, insert, nextDocNo } from '@/lib/db'
import { rupiah, tgl, todayISO } from '@/lib/format'
import { PageHeader, Card, CardHeader, KpiCard, DataTable, Badge, TableSkeleton, EmptyState, Button, Modal, Field, Select, Input, Textarea, useToast, Plus } from '@/components/ui'
import {
 ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line,
 PieChart, Pie, Cell, Legend,
} from 'recharts'
import { FileWarning, Handshake, ClipboardList, Wallet, AlertTriangle } from 'lucide-react'
import { CHART_COLORS } from '../lib/constants'
import { agingDays, isArActive, monthKey, monthLabel } from '../lib/helpers'

const AGING_ORDER = ['0-30', '31-60', '61-90', '>90']
type ClaimItem = { price_list_id: string | null; description: string; uom: string; unit_price: number; qty: number }
const emptyKontrak = { contract_name: '', customer_id: '', contract_type: 'deployment', start_date: '', end_date: '', contract_value: 0 }

export default function DashboardCommerce() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState<string | null>(null)
 const [contracts, setContracts] = useState<any[]>([])
 const [spkList, setSpkList] = useState<any[]>([])
 const [claims, setClaims] = useState<any[]>([])
 const [invoices, setInvoices] = useState<any[]>([])
 const [customers, setCustomers] = useState<any[]>([])
 const [agingView, setAgingView] = useState<any[]>([])

 const [klaimOpen, setKlaimOpen] = useState(false)
 const [klaimSpkId, setKlaimSpkId] = useState('')
 const [klaimItems, setKlaimItems] = useState<ClaimItem[]>([])
 const [klaimItemsLoading, setKlaimItemsLoading] = useState(false)
 const [klaimSaving, setKlaimSaving] = useState(false)

 const [kontrakOpen, setKontrakOpen] = useState(false)
 const [kontrakForm, setKontrakForm] = useState<any>(emptyKontrak)
 const [kontrakSaving, setKontrakSaving] = useState(false)

 useEffect(() => {
 (async () => {
 setLoading(true)
 try {
 const [c, s, cl, inv, cu, av] = await Promise.all([
 list('contracts', { select: 'id,contract_name,customer_id,contract_value,status,retention_percent', limit: 1000 }),
 list('spk', { select: 'id,spk_no,title,contract_id,spk_value,status', limit: 1000 }),
 list('progress_claims', { select: 'id,claim_no,contract_id,claim_amount,status,created_at', limit: 1000 }),
 list('ar_invoices', { select: 'id,inv_no,customer_id,total,paid_amount,status,due_date,invoice_date', limit: 2000 }),
 list('customers', { select: 'id,name', limit: 1000 }),
 list('v_dashboard_commerce', { eq: { metric: 'ar_aging' } }),
 ])
 setContracts(c); setSpkList(s); setClaims(cl); setInvoices(inv); setCustomers(cu); setAgingView(av)
 } catch (e: any) { setError(e.message ?? 'Gagal memuat data dashboard Commerce') }
 finally { setLoading(false) }
 })()
 }, [])

 async function reloadClaims() { setClaims(await list('progress_claims', { select: 'id,claim_no,contract_id,claim_amount,status,created_at', limit: 1000 })) }
 async function reloadContracts() { setContracts(await list('contracts', { select: 'id,contract_name,customer_id,contract_value,status,retention_percent', limit: 1000 })) }

 function friendlyCommerceError(e: any, fallback: string) {
 const msg = e?.message ?? ''
 if (/row-level security|permission denied/i.test(msg)) return 'Gagal menyimpan — hak akses Anda pada modul Commerce tidak mengizinkan tindakan ini.'
 return msg || fallback
 }

 function openKlaim() { setKlaimSpkId(''); setKlaimItems([]); setKlaimOpen(true) }
 async function pullPriceListQuick(spkId: string) {
 setKlaimSpkId(spkId)
 const spk = spkList.find((s: any) => s.id === spkId)
 if (!spk) { setKlaimItems([]); return }
 setKlaimItemsLoading(true)
 try {
 const pl = await list('contract_price_list', { eq: { contract_id: spk.contract_id, is_active: true }, order: { col: 'item_code', asc: true }, limit: 500 })
 setKlaimItems(pl.map((p: any) => ({ price_list_id: p.id, description: `${p.item_code ? p.item_code + ' — ' : ''}${p.description ?? ''}`, uom: p.uom ?? '', unit_price: Number(p.unit_price) || 0, qty: 0 })))
 } catch (e: any) { toast.push(e.message ?? 'Gagal menarik item price list', 'error') }
 finally { setKlaimItemsLoading(false) }
 }
 const klaimAmount = useMemo(() => klaimItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0), [klaimItems])
 async function saveKlaim() {
 if (!klaimSpkId) { toast.push('Pilih SPK terlebih dahulu', 'error'); return }
 const spk = spkList.find((s: any) => s.id === klaimSpkId)
 const filledItems = klaimItems.filter(it => Number(it.qty) > 0)
 if (filledItems.length === 0) { toast.push('Isi minimal satu qty realisasi', 'error'); return }
 setKlaimSaving(true)
 try {
 const contract = contracts.find((c: any) => c.id === spk.contract_id)
 const retentionAmount = Math.round(klaimAmount * Number(contract?.retention_percent ?? 0) / 100)
 const claimNo = await nextDocNo(profile!.company_id, 'CLM')
 const claim = await insert<any>('progress_claims', {
 company_id: profile!.company_id, claim_no: claimNo, spk_id: klaimSpkId, contract_id: spk.contract_id,
 period_start: todayISO(), period_end: todayISO(), progress_percent: 0,
 claim_amount: klaimAmount, retention_amount: retentionAmount, status: 'draft', created_by: profile!.id,
 })
 for (const it of filledItems) {
 await insert('progress_claim_items', {
 company_id: profile!.company_id, claim_id: claim.id, price_list_id: it.price_list_id,
 description: it.description, uom: it.uom, qty: Number(it.qty), unit_price: Number(it.unit_price),
 amount: Number(it.qty) * Number(it.unit_price),
 })
 }
 toast.push(`Klaim ${claimNo} ditambahkan`); setKlaimOpen(false); reloadClaims()
 } catch (e: any) { toast.push(friendlyCommerceError(e, 'Gagal menyimpan klaim'), 'error') }
 finally { setKlaimSaving(false) }
 }

 function openKontrak() { setKontrakForm(emptyKontrak); setKontrakOpen(true) }
 async function saveKontrak() {
 if (!kontrakForm.contract_name || !kontrakForm.customer_id) { toast.push('Nama kontrak dan pelanggan wajib diisi', 'error'); return }
 setKontrakSaving(true)
 try {
 const contract_no = await nextDocNo(profile!.company_id, 'KTR')
 await insert('contracts', {
 company_id: profile!.company_id, contract_no, contract_name: kontrakForm.contract_name, customer_id: kontrakForm.customer_id,
 contract_type: kontrakForm.contract_type || null, start_date: kontrakForm.start_date || null, end_date: kontrakForm.end_date || null,
 contract_value: Number(kontrakForm.contract_value || 0), status: 'draft', created_by: profile!.id,
 })
 toast.push(`Kontrak ${contract_no} ditambahkan sebagai draft`); setKontrakOpen(false); reloadContracts()
 } catch (e: any) { toast.push(friendlyCommerceError(e, 'Gagal menyimpan kontrak'), 'error') }
 finally { setKontrakSaving(false) }
 }

 const customerMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c.name])), [customers])

 const kpi = useMemo(() => {
 const activeContractValue = contracts.filter(c => c.status === 'aktif').reduce((s, c) => s + Number(c.contract_value || 0), 0)
 const runningSpkValue = spkList.filter(s => s.status === 'aktif').reduce((s, r) => s + Number(r.spk_value || 0), 0)
 const pendingClaims = claims.filter(c => c.status === 'diajukan' || c.status === 'diverifikasi')
 const pendingClaimValue = pendingClaims.reduce((s, c) => s + Number(c.claim_amount || 0), 0)
 const activeInv = invoices.filter(i => isArActive(i.status))
 const arOutstanding = activeInv.reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.paid_amount)), 0)
 const overdueInv = activeInv.filter(i => agingDays(i.due_date) > 0)
 const arOverdue = overdueInv.reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.paid_amount)), 0)
 return { activeContractValue, runningSpkValue, pendingClaims, pendingClaimValue, arOutstanding, arOverdue, overdueCount: overdueInv.length }
 }, [contracts, spkList, claims, invoices])

 const agingChart = useMemo(() => {
 if (agingView.length > 0) {
 const map = Object.fromEntries(agingView.map((r: any) => [r.bucket, Number(r.amount) || 0]))
 return AGING_ORDER.map(b => ({ bucket: b, nilai: map[b] ?? 0 }))
 }
 const g: Record<string, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '>90': 0 }
 invoices.filter(i => isArActive(i.status)).forEach(i => {
 const d = agingDays(i.due_date)
 const b = d <= 30 ? '0-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : '>90'
 g[b] += Math.max(0, Number(i.total) - Number(i.paid_amount))
 })
 return AGING_ORDER.map(b => ({ bucket: b, nilai: g[b] }))
 }, [agingView, invoices])

 const invoiceTrend = useMemo(() => {
 const g: Record<string, number> = {}
 invoices.forEach(i => { if (!i.invoice_date) return; const k = monthKey(i.invoice_date); g[k] = (g[k] || 0) + Number(i.total || 0) })
 return Object.entries(g).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([k, v]) => ({ bulan: monthLabel(k + '-01'), nilai: v }))
 }, [invoices])

 const contractComposition = useMemo(() => {
 const g: Record<string, number> = {}
 contracts.forEach(c => { const name = customerMap[c.customer_id] ?? 'Lainnya'; g[name] = (g[name] || 0) + Number(c.contract_value || 0) })
 return Object.entries(g).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }))
 }, [contracts, customerMap])

 const actionItems = useMemo(() => {
 const fromClaims = claims.filter(c => c.status === 'diajukan' || c.status === 'diverifikasi').map(c => ({
 id: `klaim-${c.id}`, tipe: 'Klaim', no: c.claim_no, nilai: Number(c.claim_amount || 0), status: c.status, tanggal: c.created_at,
 }))
 const fromInvoices = invoices.filter(i => isArActive(i.status) && (agingDays(i.due_date) > 0 || i.status === 'diajukan')).map(i => ({
 id: `inv-${i.id}`, tipe: 'Invoice', no: i.inv_no, nilai: Math.max(0, Number(i.total) - Number(i.paid_amount)),
 status: agingDays(i.due_date) > 0 ? 'overdue' : i.status, tanggal: i.due_date,
 }))
 return [...fromClaims, ...fromInvoices].sort((a, b) => new Date(a.tanggal ?? 0).getTime() - new Date(b.tanggal ?? 0).getTime())
 }, [claims, invoices])

 const actionColumns = [
 { key: 'tipe', header: 'Tipe', width: '90px' },
 { key: 'no', header: 'No Dokumen' },
 { key: 'nilai', header: 'Nilai', align: 'right' as const, render: (r: any) => rupiah(r.nilai) },
 { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
 { key: 'tanggal', header: 'Tanggal Acuan', render: (r: any) => tgl(r.tanggal) },
 ]

 if (error) return (
 <div><PageHeader title="Dashboard Commerce" /><Card><EmptyState title="Gagal memuat dashboard" message={error} icon={<AlertTriangle size={22} />} /></Card></div>
 )

 return (
 <div>
 <PageHeader title="Dashboard Commerce" subtitle="Ringkasan kontrak, SPK, klaim progres, dan piutang pelanggan." />

 {can('COMMERCE', 'write') && (
 <div className="flex flex-wrap gap-2 mb-5">
 <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={openKlaim}>Buat Klaim</Button>
 <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={openKontrak}>Kontrak Baru</Button>
 </div>
 )}

 {loading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-5">{Array.from({ length: 5 }).map((_, i) => <Card key={i} className="p-4"><TableSkeleton rows={2} /></Card>)}</div> : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
 <KpiCard label="Nilai Kontrak Aktif" value={rupiah(kpi.activeContractValue, true)} icon={<Handshake size={16} />} tone="teal" />
 <KpiCard label="Nilai SPK Berjalan" value={rupiah(kpi.runningSpkValue, true)} icon={<ClipboardList size={16} />} tone="blue" />
 <KpiCard label="Klaim Menunggu Persetujuan" value={rupiah(kpi.pendingClaimValue, true)} sub={`${kpi.pendingClaims.length} klaim`} icon={<FileWarning size={16} />} tone="amber" />
 <KpiCard label="AR Belum Tertagih" value={rupiah(kpi.arOutstanding, true)} icon={<Wallet size={16} />} tone="teal" />
 <KpiCard label="AR Overdue" value={rupiah(kpi.arOverdue, true)} sub={`${kpi.overdueCount} invoice`} icon={<AlertTriangle size={16} />} tone="red" />
 </div>
 )}
 <p className="text-caption text-ink-400 -mt-3 mb-5">Sumber data: contracts, spk, progress_claims, ar_invoices — ditarik {tgl(todayISO())}.</p>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
 <Card className="lg:col-span-1">
 <CardHeader title="Umur Piutang (Aging AR)" subtitle="Total tagihan belum lunas per bucket hari" />
 <div className="p-4 h-72">
 {loading ? <TableSkeleton rows={4} /> : agingChart.every(a => a.nilai === 0) ? <EmptyState title="Belum ada piutang aktif" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={agingChart} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors().grid} />
 <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
 <YAxis tickFormatter={(v) => rupiah(v, true)} tick={{ fontSize: 11 }} width={70} />
 <Tooltip formatter={(v: any) => rupiah(Number(v))} />
 <Bar dataKey="nilai" name="Nilai AR" fill={CHART_COLORS()[0]} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 <Card className="lg:col-span-1">
 <CardHeader title="Tren Invoice per Bulan" subtitle="Total nilai invoice diterbitkan" />
 <div className="p-4 h-72">
 {loading ? <TableSkeleton rows={4} /> : invoiceTrend.length === 0 ? <EmptyState title="Belum ada data invoice" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={invoiceTrend} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors().grid} />
 <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
 <YAxis tickFormatter={(v) => rupiah(v, true)} tick={{ fontSize: 11 }} width={70} />
 <Tooltip formatter={(v: any) => rupiah(Number(v))} />
 <Line type="monotone" dataKey="nilai" name="Nilai Invoice" stroke={CHART_COLORS()[1]} strokeWidth={2.5} dot={{ r: 3 }} />
 </LineChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 <Card className="lg:col-span-1">
 <CardHeader title="Komposisi Nilai Kontrak" subtitle="Berdasarkan pelanggan" />
 <div className="p-4 h-72">
 {loading ? <TableSkeleton rows={4} /> : contractComposition.length === 0 ? <EmptyState title="Belum ada kontrak" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie data={contractComposition} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
 {contractComposition.map((_, i) => <Cell key={i} fill={CHART_COLORS()[i % CHART_COLORS().length]} />)}
 </Pie>
 <Tooltip formatter={(v: any) => rupiah(Number(v))} />
 <Legend wrapperStyle={{ fontSize: 11 }} />
 </PieChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 </div>

 <Card>
 <CardHeader title="Klaim & Invoice Perlu Tindakan" subtitle="Klaim menunggu verifikasi/persetujuan dan invoice jatuh tempo/overdue" />
 {loading ? <TableSkeleton /> : (
 <DataTable columns={actionColumns} rows={actionItems} searchable={false} pageSize={10}
 emptyTitle="Tidak ada tindakan tertunda" emptyMessage="Seluruh klaim dan invoice dalam kondisi terkendali." />
 )}
 </Card>

 <Modal open={klaimOpen} onClose={() => setKlaimOpen(false)} size="lg" title="Buat Klaim"
 subtitle="Pilih SPK aktif, isi qty realisasi dari item price list kontrak."
 footer={<><Button variant="outline" onClick={() => setKlaimOpen(false)}>Batal</Button><Button loading={klaimSaving} onClick={saveKlaim}>Simpan Draft</Button></>}>
 <div className="grid gap-4">
 <Field label="SPK" required><Select value={klaimSpkId} onChange={(e: any) => pullPriceListQuick(e.target.value)}
 options={spkList.filter((s: any) => s.status === 'aktif').map((s: any) => ({ value: s.id, label: `${s.spk_no ?? ''} — ${s.title ?? ''}` }))} /></Field>
 {klaimItemsLoading ? <TableSkeleton rows={3} /> : klaimItems.length > 0 && (
 <div className="border border-ink-200 rounded-md divide-y divide-ink-200 max-h-72 overflow-y-auto">
 {klaimItems.map((it, i) => (
 <div key={i} className="flex items-center gap-3 p-2.5">
 <span className="flex-1 text-caption text-ink-700">{it.description || '-'} <span className="text-ink-400">({it.uom})</span></span>
 <span className="w-28 text-caption text-ink-500 text-right">{rupiah(it.unit_price)}</span>
 <Input type="number" min="0" className="w-24" value={it.qty} onChange={(e: any) => setKlaimItems(v => v.map((x, idx) => idx === i ? { ...x, qty: e.target.value } : x))} />
 </div>
 ))}
 </div>
 )}
 <p className="text-caption text-ink-500">Total klaim: <span className="font-semibold text-ink-800">{rupiah(klaimAmount)}</span></p>
 </div>
 </Modal>

 <Modal open={kontrakOpen} onClose={() => setKontrakOpen(false)} title="Kontrak Baru"
 footer={<><Button variant="outline" onClick={() => setKontrakOpen(false)}>Batal</Button><Button loading={kontrakSaving} onClick={saveKontrak}>Simpan Draft</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Nama Kontrak" required className="sm:col-span-2"><Input value={kontrakForm.contract_name} onChange={(e: any) => setKontrakForm({ ...kontrakForm, contract_name: e.target.value })} /></Field>
 <Field label="Pelanggan" required className="sm:col-span-2"><Select value={kontrakForm.customer_id} onChange={(e: any) => setKontrakForm({ ...kontrakForm, customer_id: e.target.value })} options={customers.map(c => ({ value: c.id, label: c.name }))} /></Field>
 <Field label="Tipe Kontrak"><Select value={kontrakForm.contract_type} onChange={(e: any) => setKontrakForm({ ...kontrakForm, contract_type: e.target.value })} options={[{ value: 'deployment', label: 'Deployment' }, { value: 'manage_service', label: 'Manage Service' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'borongan', label: 'Borongan' }, { value: 'unit_price', label: 'Unit Price' }]} /></Field>
 <Field label="Nilai Kontrak"><Input type="number" min="0" value={kontrakForm.contract_value} onChange={(e: any) => setKontrakForm({ ...kontrakForm, contract_value: e.target.value })} /></Field>
 <Field label="Tanggal Mulai"><Input type="date" value={kontrakForm.start_date} onChange={(e: any) => setKontrakForm({ ...kontrakForm, start_date: e.target.value })} /></Field>
 <Field label="Tanggal Selesai"><Input type="date" value={kontrakForm.end_date} onChange={(e: any) => setKontrakForm({ ...kontrakForm, end_date: e.target.value })} /></Field>
 </div>
 </Modal>
 </div>
 )
}
