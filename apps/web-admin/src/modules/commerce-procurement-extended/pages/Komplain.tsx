import React, { useEffect, useMemo, useState } from 'react'
import { chartColors } from '@/lib/theme'
import { Star, AlertTriangle } from 'lucide-react'
import {
 ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line,
} from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import { rupiah, tgl, num, todayISO } from '@/lib/format'
import {
 PageHeader, Card, CardHeader, KpiCard, DataTable, Badge, Button, Drawer, Tabs,
 Field, Input, Select, Textarea, useToast, TableSkeleton, EmptyState, Plus,
} from '@/components/ui'
import {
 COMPLAINT_STATUS_TABS, COMPLAINT_SEVERITY_OPTIONS, COMPLAINT_CHANNEL_OPTIONS, COMPLAINT_CATEGORY_OPTIONS, CHART_COLORS,
} from '../lib/constants'
import { daysBetween, monthKey, monthLabel } from '../lib/helpers'

function Stars({ value, onChange, size = 15 }: { value?: number | null; onChange?: (v: number) => void; size?: number }) {
 return (
 <div className="flex items-center gap-0.5">
 {[1, 2, 3, 4, 5].map(i => (
 <button key={i} type="button" disabled={!onChange}
 onClick={() => onChange?.(i)}
 className={onChange ? 'cursor-pointer' : 'cursor-default'}>
 <Star size={size} className={i <= (value ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-ink-300'} />
 </button>
 ))}
 </div>
 )
}

function emptyForm() {
 return {
 complaint_no: '', complaint_date: todayISO(), customer_id: '', contract_id: '', channel: COMPLAINT_CHANNEL_OPTIONS[0],
 category: COMPLAINT_CATEGORY_OPTIONS[0], severity: 'sedang', status: 'baru', pic_id: '', description: '',
 root_cause_id: '', corrective_action: '', resolved_at: '', csat_score: null as number | null,
 }
}

export default function Komplain() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const writable = can('COMMERCE', 'write')

 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [customers, setCustomers] = useState<any[]>([])
 const [contracts, setContracts] = useState<any[]>([])
 const [pics, setPics] = useState<any[]>([])
 const [rootCauses, setRootCauses] = useState<any[]>([])

 const [tab, setTab] = useState('baru')
 const [drawer, setDrawer] = useState<{ open: boolean; row?: any }>({ open: false })
 const [form, setForm] = useState<any>(emptyForm())
 const [saving, setSaving] = useState(false)

 const custMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c.name])), [customers])
 const contractMap = useMemo(() => Object.fromEntries(contracts.map(c => [c.id, c.contract_no])), [contracts])
 const picMap = useMemo(() => Object.fromEntries(pics.map(p => [p.id, p.full_name])), [pics])
 const rcMap = useMemo(() => Object.fromEntries(rootCauses.map(r => [r.id, r])), [rootCauses])

 const load = async () => {
 setLoading(true)
 try {
 const [c, cu, ct, pr, rc] = await Promise.all([
 list('customer_complaints', { order: { col: 'complaint_date', asc: false }, limit: 1000 }),
 list('customers', { select: 'id,name', order: { col: 'name', asc: true }, limit: 1000 }),
 list('contracts', { select: 'id,contract_no,customer_id', limit: 1000 }),
 list('profiles', { select: 'id,full_name', eq: { is_active: true }, order: { col: 'full_name', asc: true }, limit: 500 }),
 list('root_causes', { order: { col: 'aspect', asc: true }, limit: 500 }),
 ])
 setRows(c); setCustomers(cu); setContracts(ct); setPics(pr); setRootCauses(rc)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data komplain', 'error') }
 finally { setLoading(false) }
 }
 useEffect(() => { load() }, [])

 /* ---------------- KPI ---------------- */
 const kpi = useMemo(() => {
 const open = rows.filter(r => r.status !== 'selesai')
 const withCsat = rows.filter(r => r.csat_score != null)
 const avgCsat = withCsat.length ? withCsat.reduce((a, r) => a + Number(r.csat_score), 0) / withCsat.length : null
 const resolved = rows.filter(r => r.resolved_at)
 const avgResolutionDays = resolved.length ? resolved.reduce((a, r) => a + Math.max(0, daysBetween(r.complaint_date, r.resolved_at)), 0) / resolved.length : null
 const byCustomer: Record<string, number> = {}
 rows.forEach(r => { byCustomer[r.customer_id] = (byCustomer[r.customer_id] ?? 0) + 1 })
 const repeatCustomers = Object.values(byCustomer).filter(n => n > 1).length
 return { openCount: open.length, avgCsat, avgResolutionDays, repeatCustomers, byCustomer }
 }, [rows])

 const topCustomers = useMemo(() => Object.entries(kpi.byCustomer)
 .map(([id, count]) => ({ id, name: custMap[id] ?? '-', count }))
 .sort((a, b) => b.count - a.count).slice(0, 5), [kpi.byCustomer, custMap])

 /* ---------------- Grafik ---------------- */
 const perCategory = useMemo(() => {
 const g: Record<string, number> = {}
 rows.forEach(r => { const k = r.category || 'Lainnya'; g[k] = (g[k] ?? 0) + 1 })
 return Object.entries(g).map(([name, jumlah]) => ({ name, jumlah })).sort((a, b) => b.jumlah - a.jumlah)
 }, [rows])

 const csatTrend = useMemo(() => {
 const g: Record<string, { total: number; n: number }> = {}
 rows.filter(r => r.csat_score != null).forEach(r => { const k = monthKey(r.complaint_date); if (!g[k]) g[k] = { total: 0, n: 0 }; g[k].total += Number(r.csat_score); g[k].n++ })
 return Object.entries(g).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([k, v]) => ({ bulan: monthLabel(k), csat: v.n ? v.total / v.n : 0 }))
 }, [rows])

 /* ---------------- CRUD ---------------- */
 const filtered = rows.filter(r => r.status === tab)
 const tabsWithCount = COMPLAINT_STATUS_TABS.map(t => ({ ...t, count: rows.filter(r => r.status === t.value).length }))

 const openAdd = async () => {
 let no = ''
 try { no = await nextDocNo(profile!.company_id, 'CMP') } catch { /* biarkan kosong bila gagal */ }
 setForm({ ...emptyForm(), complaint_no: no, status: tab })
 setDrawer({ open: true })
 }
 const openEdit = (row: any) => {
 setForm({ ...emptyForm(), ...row, resolved_at: row.resolved_at ? String(row.resolved_at).slice(0, 10) : '', root_cause_id: row.root_cause_id ?? '', contract_id: row.contract_id ?? '' })
 setDrawer({ open: true, row })
 }

 const save = async () => {
 if (!form.complaint_no || !form.customer_id || !form.description) { toast.push('No komplain, pelanggan, dan uraian wajib diisi', 'error'); return }
 if (form.status === 'selesai' && !form.corrective_action) { toast.push('Tindakan korektif wajib diisi sebelum komplain ditutup', 'error'); return }
 setSaving(true)
 try {
 const payload = {
 complaint_no: form.complaint_no, complaint_date: form.complaint_date || todayISO(), customer_id: form.customer_id,
 contract_id: form.contract_id || null, channel: form.channel, category: form.category, severity: form.severity,
 status: form.status, pic_id: form.pic_id || null, description: form.description, root_cause_id: form.root_cause_id || null,
 corrective_action: form.corrective_action || null, resolved_at: form.status === 'selesai' ? (form.resolved_at || todayISO()) : (form.resolved_at || null),
 csat_score: form.csat_score ?? null,
 }
 if (drawer.row) { await update('customer_complaints', drawer.row.id, payload); toast.push('Komplain diperbarui', 'success') }
 else { await insert('customer_complaints', { ...payload, company_id: profile!.company_id, created_by: profile!.id }); toast.push('Komplain dicatat', 'success') }
 setDrawer({ open: false }); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan komplain', 'error') }
 finally { setSaving(false) }
 }

 const columns = [
 { key: 'complaint_no', header: 'Nomor', width: '150px' },
 { key: 'customer_id', header: 'Pelanggan', render: (r: any) => custMap[r.customer_id] ?? '-' },
 { key: 'contract_id', header: 'Kontrak', render: (r: any) => contractMap[r.contract_id] ?? '-' },
 { key: 'complaint_date', header: 'Tanggal', render: (r: any) => tgl(r.complaint_date) },
 { key: 'channel', header: 'Kanal' },
 { key: 'category', header: 'Kategori' },
 { key: 'severity', header: 'Tingkat', render: (r: any) => <Badge tone={r.severity === 'tinggi' ? 'red' : r.severity === 'sedang' ? 'amber' : 'slate'}>{r.severity}</Badge> },
 { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
 { key: 'pic_id', header: 'PIC', render: (r: any) => picMap[r.pic_id] ?? '-' },
 { key: 'csat_score', header: 'CSAT', sortable: false, render: (r: any) => <Stars value={r.csat_score} /> },
 ]

 return (
 <div>
 <PageHeader title="Komplain & CSAT" subtitle="Penanganan komplain pelanggan, akar masalah 4 aspek, dan skor kepuasan."
 actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd}>Catat Komplain</Button>} />

 {loading ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="p-4"><TableSkeleton rows={2} /></Card>)}</div> : (
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
 <KpiCard label="Komplain Terbuka" value={num(kpi.openCount)} tone="amber" />
 <KpiCard label="Rata-rata CSAT" value={kpi.avgCsat != null ? kpi.avgCsat.toFixed(1) : '-'} sub="dari 5" tone="teal" />
 <KpiCard label="Waktu Penyelesaian Rata-rata" value={kpi.avgResolutionDays != null ? `${kpi.avgResolutionDays.toFixed(1)} hari` : '-'} tone="blue" />
 <KpiCard label="Pelanggan Komplain Berulang" value={num(kpi.repeatCustomers)} sub=">1 komplain" tone="red" />
 </div>
 )}
 <p className="text-caption text-ink-400 -mt-3 mb-5">Sumber data: customer_complaints — ditarik {tgl(todayISO())}.</p>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
 <Card className="lg:col-span-1">
 <CardHeader title="Komplain per Kategori" />
 <div className="p-4 h-64">
 {loading ? <TableSkeleton rows={4} /> : perCategory.length === 0 ? <EmptyState title="Belum ada data" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={perCategory} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
 <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartColors().grid} />
 <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
 <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
 <Tooltip />
 <Bar dataKey="jumlah" fill={CHART_COLORS()[0]} radius={[0, 4, 4, 0]} />
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 <Card className="lg:col-span-1">
 <CardHeader title="Tren CSAT Bulanan" subtitle="Rata-rata skor 1–5" />
 <div className="p-4 h-64">
 {loading ? <TableSkeleton rows={4} /> : csatTrend.length === 0 ? <EmptyState title="Belum ada skor CSAT" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={csatTrend} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors().grid} />
 <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
 <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} width={24} />
 <Tooltip formatter={(v: any) => Number(v).toFixed(1)} />
 <Line type="monotone" dataKey="csat" stroke={CHART_COLORS()[1]} strokeWidth={2.5} dot={{ r: 3 }} />
 </LineChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 <Card className="lg:col-span-1">
 <CardHeader title="Pelanggan Komplain Terbanyak" subtitle="Sinyal risiko kontrak" />
 <div className="p-4 space-y-2.5">
 {loading ? <TableSkeleton rows={4} /> : topCustomers.length === 0 ? <EmptyState title="Belum ada komplain" /> : topCustomers.map(c => (
 <div key={c.id} className="flex items-center justify-between gap-2">
 <span className="text-body text-ink-700 truncate">{c.name}</span>
 <div className="flex items-center gap-1.5 shrink-0">
 <span className="text-caption tabular text-ink-500">{c.count} komplain</span>
 {c.count >= 3 && <Badge tone="red"><AlertTriangle size={11} className="inline -mt-0.5 mr-0.5" />Risiko Kontrak</Badge>}
 </div>
 </div>
 ))}
 </div>
 </Card>
 </div>

 <Tabs tabs={tabsWithCount} value={tab} onChange={setTab} className="mb-3" />
 {loading ? <Card><TableSkeleton /></Card> : (
 <DataTable columns={columns} rows={filtered} searchable searchKeys={['complaint_no', 'description']}
 exportName="komplain" onRowClick={openEdit}
 emptyTitle="Belum ada komplain" emptyMessage={`Tidak ada komplain dengan status "${tab}".`} />
 )}

 <Drawer open={drawer.open} onClose={() => setDrawer({ open: false })} title={drawer.row ? drawer.row.complaint_no : 'Catat Komplain'} width="max-w-2xl"
 footer={<><Button variant="outline" onClick={() => setDrawer({ open: false })}>Batal</Button>{writable && <Button loading={saving} onClick={save}>Simpan</Button>}</>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="No Komplain" required><Input disabled={!writable} value={form.complaint_no} onChange={e => setForm({ ...form, complaint_no: e.target.value })} /></Field>
 <Field label="Tanggal"><Input disabled={!writable} type="date" value={form.complaint_date} onChange={e => setForm({ ...form, complaint_date: e.target.value })} /></Field>
 <Field label="Pelanggan" required><Select disabled={!writable} value={form.customer_id} options={customers.map(c => ({ value: c.id, label: c.name }))} onChange={(e: any) => setForm({ ...form, customer_id: e.target.value })} /></Field>
 <Field label="Kontrak Terkait"><Select disabled={!writable} value={form.contract_id} options={contracts.filter(c => !form.customer_id || c.customer_id === form.customer_id).map(c => ({ value: c.id, label: c.contract_no }))} onChange={(e: any) => setForm({ ...form, contract_id: e.target.value })} /></Field>
 <Field label="Kanal"><Select disabled={!writable} value={form.channel} options={COMPLAINT_CHANNEL_OPTIONS} onChange={(e: any) => setForm({ ...form, channel: e.target.value })} /></Field>
 <Field label="Kategori"><Select disabled={!writable} value={form.category} options={COMPLAINT_CATEGORY_OPTIONS} onChange={(e: any) => setForm({ ...form, category: e.target.value })} /></Field>
 <Field label="Tingkat Keparahan"><Select disabled={!writable} value={form.severity} options={COMPLAINT_SEVERITY_OPTIONS} onChange={(e: any) => setForm({ ...form, severity: e.target.value })} /></Field>
 <Field label="Status"><Select disabled={!writable} value={form.status} options={COMPLAINT_STATUS_TABS} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>
 <Field label="PIC"><Select disabled={!writable} value={form.pic_id} options={pics.map(p => ({ value: p.id, label: p.full_name }))} onChange={(e: any) => setForm({ ...form, pic_id: e.target.value })} /></Field>
 <Field label="Skor CSAT (1–5)"><Stars value={form.csat_score} onChange={writable ? (v => setForm({ ...form, csat_score: v })) : undefined} size={20} /></Field>
 <Field label="Uraian Komplain" required className="sm:col-span-2"><Textarea disabled={!writable} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
 <Field label="Akar Masalah (RCA 4 Aspek)" className="sm:col-span-2">
 <Select disabled={!writable} value={form.root_cause_id} placeholder="— pilih root cause —"
 options={rootCauses.map(r => ({ value: r.id, label: `${r.name} — ${r.aspect}` }))}
 onChange={(e: any) => setForm({ ...form, root_cause_id: e.target.value })} />
 {form.root_cause_id && rcMap[form.root_cause_id] && <Badge className="mt-1.5">{rcMap[form.root_cause_id].aspect}</Badge>}
 </Field>
 <Field label="Tindakan Korektif" className="sm:col-span-2" required={form.status === 'selesai'}><Textarea disabled={!writable} value={form.corrective_action ?? ''} onChange={e => setForm({ ...form, corrective_action: e.target.value })} /></Field>
 <Field label="Tanggal Selesai"><Input disabled={!writable} type="date" value={form.resolved_at ?? ''} onChange={e => setForm({ ...form, resolved_at: e.target.value })} /></Field>
 </div>
 </Drawer>
 </div>
 )
}
