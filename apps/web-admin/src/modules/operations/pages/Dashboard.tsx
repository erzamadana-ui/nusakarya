import React, { useEffect, useMemo, useState } from 'react'
import {
 ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
 Tooltip, Legend, ComposedChart, Line,
} from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, insert, nextDocNo } from '@/lib/db'
import { Card, CardHeader, PageHeader, KpiCard, DataTable, useToast, Badge, TableSkeleton,
 Button, Modal, Field, Input, Select, Textarea } from '@/components/ui'
import { durasi, pct, tgl } from '@/lib/format'
import SlaCountdown from '../components/SlaCountdown'
import { CHART_COLORS, SEVERITY_COLORS, ticketStatusLabel, ticketStatusTone, severityLabel, severityTone } from '../lib/constants'
import { WO_STATUS, TICKET_STATUS, optionsOf } from '../lib/status'
import { rentangHariIni, hariKeBelakang } from '../lib/helpers'

export default function Dashboard() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [formTiket, setFormTiket] = useState<any>(null)
 const [simpan, setSimpan] = useState(false)
 const [loading, setLoading] = useState(true)
 const [tickets, setTickets] = useState<any[]>([])
 const [branches, setBranches] = useState<any[]>([])
 const [employees, setEmployees] = useState<any[]>([])
 const [woDoneToday, setWoDoneToday] = useState(0)
 const [pulledAt, setPulledAt] = useState<Date | null>(null)

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

 async function load() {
 setLoading(true)
 try {
 const [awal, akhir] = rentangHariIni()
 const [t, br, emp, wo] = await Promise.all([
 list('tickets', {
 select: 'id,ticket_no,status,severity,branch_id,reported_at,resolved_at,closed_at,ttr_minutes,sla_status,sla_due_at,sla_minutes,customer_name,assigned_to',
 eq: { company_id: profile!.company_id }, order: { col: 'reported_at', asc: false }, limit: 3000,
 }),
 list('branches', { select: 'id,name', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
 list('employees', { select: 'id,full_name', eq: { company_id: profile!.company_id } }),
 list('work_orders', {
 select: 'id,status,finished_at', eq: { company_id: profile!.company_id, status: WO_STATUS.DONE },
 gte: { finished_at: awal }, lte: { finished_at: akhir },
 }),
 ])
 setTickets(t); setBranches(br); setEmployees(emp); setWoDoneToday(wo.length); setPulledAt(new Date())
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat dashboard operations', 'error') }
 finally { setLoading(false) }
 }

 const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'
 const empName = (id?: string) => employees.find(e => e.id === id)?.full_name ?? '-'

 const now = new Date()
 const kpi = useMemo(() => {
 const terbuka = tickets.filter(t => !['resolved', 'closed', 'cancelled'].includes(t.status))
 const melanggar = tickets.filter(t => t.sla_status === 'breach' || (!t.resolved_at && t.sla_due_at && new Date(t.sla_due_at) < now))
 const ttrList = tickets.filter(t => t.ttr_minutes != null).map(t => t.ttr_minutes as number)
 const mttr = ttrList.length ? ttrList.reduce((a, b) => a + b, 0) / ttrList.length : null
 const dinilaiSla = tickets.filter(t => t.sla_status === 'met' || t.sla_status === 'breach')
 const patuh = dinilaiSla.filter(t => t.sla_status === 'met')
 const kepatuhan = dinilaiSla.length ? (patuh.length / dinilaiSla.length) * 100 : null
 return { terbuka: terbuka.length, melanggar: melanggar.length, mttr, kepatuhan }
 }, [tickets])

 const donutStatus = useMemo(() => {
 const g: Record<string, number> = {}
 tickets.forEach(t => { g[t.status] = (g[t.status] ?? 0) + 1 })
 return Object.entries(g).map(([k, v]) => ({ name: ticketStatusLabel(k), value: v, key: k }))
 }, [tickets])

 const barSeverity = useMemo(() => {
 const g: Record<string, number> = {}
 tickets.forEach(t => { const s = t.severity || 'lainnya'; g[s] = (g[s] ?? 0) + 1 })
 return Object.entries(g).map(([k, v]) => ({ name: k, jumlah: v }))
 }, [tickets])

 const tren30 = useMemo(() => {
 const batas = hariKeBelakang(29)
 const days: { key: string; label: string; jumlah: number; ttrSum: number; ttrCnt: number }[] = []
 for (let i = 29; i >= 0; i--) {
 const d = new Date(); d.setDate(d.getDate() - i)
 const key = d.toISOString().slice(0, 10)
 days.push({ key, label: `${d.getDate()}/${d.getMonth() + 1}`, jumlah: 0, ttrSum: 0, ttrCnt: 0 })
 }
 const idx: Record<string, number> = {}
 days.forEach((d, i) => idx[d.key] = i)
 tickets.forEach(t => {
 if (!t.reported_at || t.reported_at < batas) return
 const key = String(t.reported_at).slice(0, 10)
 const i = idx[key]
 if (i == null) return
 days[i].jumlah += 1
 if (t.ttr_minutes != null) { days[i].ttrSum += t.ttr_minutes; days[i].ttrCnt += 1 }
 })
 return days.map(d => ({ label: d.label, jumlah: d.jumlah, ttrJam: d.ttrCnt ? +(d.ttrSum / d.ttrCnt / 60).toFixed(1) : null }))
 }, [tickets])

 const slaPerCabang = useMemo(() => {
 const g: Record<string, { met: number; total: number }> = {}
 tickets.filter(t => t.sla_status === 'met' || t.sla_status === 'breach').forEach(t => {
 const b = t.branch_id || 'tanpa_cabang'
 g[b] = g[b] || { met: 0, total: 0 }
 g[b].total += 1
 if (t.sla_status === 'met') g[b].met += 1
 })
 return Object.entries(g).map(([bid, v]) => ({
 name: bid === 'tanpa_cabang' ? 'Tanpa Cabang' : branchName(bid),
 kepatuhan: v.total ? +((v.met / v.total) * 100).toFixed(1) : 0,
 }))
 }, [tickets, branches])

 const berisiko = useMemo(() => {
 const batasAtas = new Date(now.getTime() + 2 * 60 * 60 * 1000)
 return tickets
 .filter(t => !t.resolved_at && t.sla_due_at && new Date(t.sla_due_at) >= now && new Date(t.sla_due_at) <= batasAtas)
 .sort((a, b) => new Date(a.sla_due_at).getTime() - new Date(b.sla_due_at).getTime())
 .slice(0, 20)
 }, [tickets])

 
 /* Aksi cepat: buat tiket gangguan langsung dari dashboard.
    Nilai status memakai sumber kebenaran di lib/status.ts agar cocok dengan CHECK constraint. */
 const SLA_DEFAULT: Record<string, number> = { kritis: 240, tinggi: 480, sedang: 1440, rendah: 2880 }
 async function simpanTiket() {
 if (!formTiket?.customer_name || !formTiket?.description) {
 toast.push('Nama pelanggan dan uraian gangguan wajib diisi.', 'error'); return
 }
 setSimpan(true)
 try {
 const no = await nextDocNo(profile!.company_id, 'TKT')
 const menit = Number(formTiket.sla_minutes) || SLA_DEFAULT[formTiket.severity] || 1440
 await insert('tickets', {
 company_id: profile!.company_id,
 ticket_no: no,
 source: formTiket.source,
 ticket_type: formTiket.ticket_type,
 customer_name: formTiket.customer_name,
 customer_no: formTiket.customer_no || null,
 customer_phone: formTiket.customer_phone || null,
 address: formTiket.address || null,
 branch_id: formTiket.branch_id || null,
 severity: formTiket.severity,
 description: formTiket.description,
 reported_at: new Date().toISOString(),
 sla_minutes: menit,
 sla_due_at: new Date(Date.now() + menit * 60000).toISOString(),
 sla_status: 'on_track',
 status: TICKET_STATUS.OPEN,
 })
 toast.push(`Tiket ${no} dibuat.`)
 setFormTiket(null); load()
 } catch (e: any) {
 toast.push(e?.message?.includes('row-level security')
 ? 'Gagal menyimpan: jabatan Anda tidak punya hak tulis pada modul Operations.'
 : (e?.message ?? 'Gagal menyimpan tiket.'), 'error')
 } finally { setSimpan(false) }
 }

return (
 <div>
 <PageHeader title="Dashboard Operations" subtitle="Ringkasan tiket gangguan, SLA & work order"
 actions={can('OPERATIONS', 'write') ? (
 <Button icon={<span>+</span>} onClick={() => setFormTiket({
 source: 'pelanggan', ticket_type: 'gangguan', severity: 'sedang',
 customer_name: '', customer_no: '', customer_phone: '', address: '',
 branch_id: '', description: '', sla_minutes: 1440,
 })}>Buat Tiket</Button>) : null}
 />

 <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
 <KpiCard label="Tiket Terbuka" value={loading ? '…' : kpi.terbuka} />
 <KpiCard label="Melanggar SLA" value={loading ? '…' : kpi.melanggar} tone="red" />
 <KpiCard label="MTTR Rata-rata" value={loading ? '…' : durasi(kpi.mttr)} />
 <KpiCard label="Kepatuhan SLA" value={loading ? '…' : pct(kpi.kepatuhan)} tone={kpi.kepatuhan != null && kpi.kepatuhan < 80 ? 'red' : 'emerald'} />
 <KpiCard label="WO Selesai Hari Ini" value={loading ? '…' : woDoneToday} tone="emerald" />
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
 <Card>
 <CardHeader title="Tiket per Status" />
 <div className="p-4 h-72">
 {loading ? <TableSkeleton rows={4} /> : donutStatus.length === 0 ? <div className="grid place-items-center h-full text-ink-400 text-body">Belum ada data tiket.</div> : (
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie data={donutStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
 {donutStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS()[i % CHART_COLORS().length]} />)}
 </Pie>
 <Tooltip /><Legend />
 </PieChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 <Card>
 <CardHeader title="Tiket per Tingkat Keparahan" />
 <div className="p-4 h-72">
 {loading ? <TableSkeleton rows={4} /> : barSeverity.length === 0 ? <div className="grid place-items-center h-full text-ink-400 text-body">Belum ada data tiket.</div> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={barSeverity}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="name" tick={{ fontSize: 12 }} />
 <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
 <Tooltip />
 <Bar dataKey="jumlah" radius={[4, 4, 0, 0]}>
 {barSeverity.map((r, i) => <Cell key={i} fill={SEVERITY_COLORS()[r.name] ?? CHART_COLORS()[i % CHART_COLORS().length]} />)}
 </Bar>
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
 <Card>
 <CardHeader title="Tren Tiket & TTR — 30 Hari Terakhir" />
 <div className="p-4 h-72">
 {loading ? <TableSkeleton rows={4} /> : (
 <ResponsiveContainer width="100%" height="100%">
 <ComposedChart data={tren30}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
 <YAxis yAxisId="left" tick={{ fontSize: 12 }} allowDecimals={false} />
 <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: 'TTR (jam)', angle: 90, position: 'insideRight', fontSize: 11 }} />
 <Tooltip />
 <Legend />
 <Bar yAxisId="left" dataKey="jumlah" name="Jumlah Tiket" fill={CHART_COLORS()[0]} radius={[3, 3, 0, 0]} />
 <Line yAxisId="right" type="monotone" dataKey="ttrJam" name="TTR Rata-rata (jam)" stroke={CHART_COLORS()[1]} strokeWidth={2} dot={false} connectNulls />
 </ComposedChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 <Card>
 <CardHeader title="Kepatuhan SLA per Cabang" />
 <div className="p-4 h-72">
 {loading ? <TableSkeleton rows={4} /> : slaPerCabang.length === 0 ? <div className="grid place-items-center h-full text-ink-400 text-body">Belum ada tiket yang selesai dinilai SLA.</div> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={slaPerCabang}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="name" tick={{ fontSize: 11 }} />
 <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} />
 <Tooltip formatter={(v: any) => `${v}%`} />
 <Bar dataKey="kepatuhan" name="Kepatuhan SLA" fill={CHART_COLORS()[0]} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 </div>

 <Card className="mb-2">
 <CardHeader title="Tiket Berisiko Melanggar SLA (≤ 2 Jam)" subtitle="Diurutkan dari yang paling mendesak" />
 <DataTable
 loading={loading}
 rows={berisiko}
 searchable={false}
 emptyTitle="Tidak ada tiket berisiko"
 emptyMessage="Tidak ada tiket aktif yang jatuh tempo SLA-nya dalam 2 jam ke depan."
 columns={[
 { key: 'ticket_no', header: 'No Tiket' },
 { key: 'customer_name', header: 'Pelanggan' },
 { key: 'branch_id', header: 'Cabang', render: r => branchName(r.branch_id) },
 { key: 'severity', header: 'Keparahan', render: r => <Badge tone={severityTone(r.severity)}>{severityLabel(r.severity)}</Badge> },
 { key: 'assigned_to', header: 'Petugas', render: r => empName(r.assigned_to) },
 { key: 'status', header: 'Status', render: r => <Badge tone={ticketStatusTone(r.status)}>{ticketStatusLabel(r.status)}</Badge> },
 { key: 'sla_due_at', header: 'Sisa Waktu SLA', render: r => <SlaCountdown dueAt={r.sla_due_at} slaMenit={r.sla_minutes} /> },
 ]}
 />
 </Card>
 <p className="text-caption text-ink-400 mt-2">
 Sumber data: tabel <code>tickets</code> &amp; <code>work_orders</code> (hingga 3.000 tiket terbaru). Ditarik pada {pulledAt ? tgl(pulledAt.toISOString()) + ' ' + pulledAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}.
 </p>
 
 <Modal open={!!formTiket} onClose={() => setFormTiket(null)} title="Buat Tiket Gangguan"
 subtitle="Formulir ringkas — rincian lanjutan bisa dilengkapi di halaman Tiket Gangguan."
 footer={<>
 <Button variant="outline" onClick={() => setFormTiket(null)}>Batal</Button>
 <Button loading={simpan} onClick={simpanTiket}>Simpan Tiket</Button>
 </>}>
 {formTiket && (
 <div className="grid sm:grid-cols-2 gap-3">
 <Field label="Nama Pelanggan" required>
 <Input value={formTiket.customer_name} onChange={e => setFormTiket({ ...formTiket, customer_name: e.target.value })} />
 </Field>
 <Field label="Nomor Pelanggan">
 <Input value={formTiket.customer_no} onChange={e => setFormTiket({ ...formTiket, customer_no: e.target.value })} />
 </Field>
 <Field label="Telepon">
 <Input value={formTiket.customer_phone} onChange={e => setFormTiket({ ...formTiket, customer_phone: e.target.value })} />
 </Field>
 <Field label="Cabang">
 <Select value={formTiket.branch_id} options={branches.map((b: any) => ({ value: b.id, label: b.name }))}
 onChange={(e: any) => setFormTiket({ ...formTiket, branch_id: e.target.value })} />
 </Field>
 <Field label="Sumber">
 <Select value={formTiket.source} options={optionsOf('tickets.source')}
 onChange={(e: any) => setFormTiket({ ...formTiket, source: e.target.value })} placeholder="" />
 </Field>
 <Field label="Jenis Tiket">
 <Select value={formTiket.ticket_type} options={optionsOf('tickets.ticket_type')}
 onChange={(e: any) => setFormTiket({ ...formTiket, ticket_type: e.target.value })} placeholder="" />
 </Field>
 <Field label="Tingkat Keparahan">
 <Select value={formTiket.severity} options={optionsOf('tickets.severity')}
 onChange={(e: any) => setFormTiket({ ...formTiket, severity: e.target.value, sla_minutes: SLA_DEFAULT[e.target.value] ?? 1440 })} placeholder="" />
 </Field>
 <Field label="Target SLA (menit)" hint="Nilai bawaan sistem menurut keparahan — sesuaikan dengan SLA kontrak.">
 <Input type="number" value={formTiket.sla_minutes}
 onChange={e => setFormTiket({ ...formTiket, sla_minutes: e.target.value })} />
 </Field>
 <Field label="Alamat" className="sm:col-span-2">
 <Input value={formTiket.address} onChange={e => setFormTiket({ ...formTiket, address: e.target.value })} />
 </Field>
 <Field label="Uraian Gangguan" required className="sm:col-span-2">
 <Textarea value={formTiket.description} onChange={e => setFormTiket({ ...formTiket, description: e.target.value })} />
 </Field>
 </div>)}
 </Modal>
</div>
 )
}
