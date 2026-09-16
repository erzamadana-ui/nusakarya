import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
 ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
 PieChart, Pie, Cell, BarChart, LabelList,
} from 'recharts'
import { Wallet, Receipt, Percent, Ticket, ShieldCheck, Users, CalendarClock, Boxes, ArrowRight, ClipboardList } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { list, insert, nextDocNo } from '@/lib/db'
import { rupiah, num, pct, tgl, tglJam, todayISO } from '@/lib/format'
import { Card, CardHeader, PageHeader, KpiCard, Skeleton, EmptyState, Button, Modal, Field, Select, Input, Textarea, useToast, Plus } from '@/components/ui'
import { fetchMonthlyFinance, fetchTicketRows, fetchPendingApprovals, type MonthlyFinance, type PendingItem, type TicketRow } from '../lib/data'
import { chartColors, chartSeries } from '@/lib/theme'

type Kpi = { key: string; label: string; value: string; sub?: string; icon: React.ReactNode; module: string }

const emptyCuti = { employee_id: '', leave_type: 'cuti_tahunan', start_date: todayISO(), end_date: todayISO(), reason: '' }
const emptyKas = { flow_date: todayISO(), direction: 'in', category: '', description: '', amount: 0 }
const emptyPr = { branch_id: '', need_by_date: '', purpose: '', item_id: '', qty: 1, uom: '', estimate_price: 0 }
const LEAVE_TYPE_OPTIONS_QUICK = [
 { value: 'cuti_tahunan', label: 'Cuti Tahunan' }, { value: 'sakit', label: 'Sakit' }, { value: 'izin', label: 'Izin' },
 { value: 'melahirkan', label: 'Melahirkan' }, { value: 'tanpa_keterangan', label: 'Tanpa Keterangan' },
]
const KAS_KATEGORI = [
 'Penerimaan Piutang (AR)', 'Pembayaran Vendor (AP)', 'Gaji & Upah', 'Operasional Kantor', 'Sewa & Utilitas',
 'Pajak', 'Modal / Investasi', 'Pinjaman', 'Lain-lain',
]

export default function Dashboard() {
 const COLORS = chartSeries()
 const cc = chartColors()
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)

 const [employees, setEmployees] = useState<any[]>([])
 const [branches, setBranches] = useState<any[]>([])
 const [items, setItems] = useState<any[]>([])

 const [cutiOpen, setCutiOpen] = useState(false)
 const [cutiForm, setCutiForm] = useState<any>(emptyCuti)
 const [cutiSaving, setCutiSaving] = useState(false)

 const [kasOpen, setKasOpen] = useState(false)
 const [kasForm, setKasForm] = useState<any>(emptyKas)
 const [kasSaving, setKasSaving] = useState(false)

 const [prOpen, setPrOpen] = useState(false)
 const [prForm, setPrForm] = useState<any>(emptyPr)
 const [prSaving, setPrSaving] = useState(false)
 const [finance, setFinance] = useState<MonthlyFinance[]>([])
 const [tickets, setTickets] = useState<TicketRow[]>([])
 const [projects, setProjects] = useState<any[]>([])
 const [productivity, setProductivity] = useState<any[]>([])
 const [pending, setPending] = useState<PendingItem[]>([])
 const [kpiRaw, setKpiRaw] = useState<Record<string, number>>({})
 const [drawn, setDrawn] = useState<string>('')

 useEffect(() => {
 if (!profile) return
 let alive = true
 setLoading(true)
 const today = todayISO()
 const in7 = new Date(); in7.setDate(in7.getDate() + 7)
 const monthStart = new Date(); monthStart.setDate(1)
 const monthStartISO = monthStart.toISOString().slice(0, 10)

 Promise.all([
 can('FINANCE') ? fetchMonthlyFinance() : Promise.resolve([]),
 can('OPERATIONS') ? fetchTicketRows() : Promise.resolve([]),
 can('DEPLOYMENT') ? supabase.from('projects').select('id, project_name, progress_percent, status')
 .not('status', 'in', '("selesai","batal")').order('progress_percent', { ascending: false }).limit(10)
 .then(r => r.data ?? []) : Promise.resolve([]),
 can('PRODUCTIVITY') ? supabase.from('v_dashboard_productivity').select('employee_name, total_points')
 .order('total_points', { ascending: false }).limit(10).then(r => r.data ?? []) : Promise.resolve([]),
 fetchPendingApprovals(can),
 can('FINANCE') ? supabase.from('ar_invoices').select('dpp').gte('invoice_date', monthStartISO).then(r => (r.data ?? []).reduce((s: number, x: any) => s + Number(x.dpp ?? 0), 0)) : Promise.resolve(0),
 can('FINANCE') ? supabase.from('job_costs').select('amount').gte('cost_date', monthStartISO).then(r => (r.data ?? []).reduce((s: number, x: any) => s + Number(x.amount ?? 0), 0)) : Promise.resolve(0),
 can('FINANCE') ? supabase.from('vendor_invoices').select('total, paid_amount').neq('status', 'lunas').gte('due_date', today).lte('due_date', in7.toISOString().slice(0, 10))
 .then(r => (r.data ?? []).reduce((s: number, x: any) => s + (Number(x.total ?? 0) - Number(x.paid_amount ?? 0)), 0)) : Promise.resolve(0),
 can('HR') ? supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'aktif').then(r => r.count ?? 0) : Promise.resolve(0),
 can('INVENTORY') ? supabase.from('stock_balances').select('qty, avg_price').then(r => (r.data ?? []).reduce((s: number, x: any) => s + Number(x.qty ?? 0) * Number(x.avg_price ?? 0), 0)) : Promise.resolve(0),
 ]).then(([fin, tix, proj, prod, pend, revBln, costBln, apDue, karyawan, nilaiStok]) => {
 if (!alive) return
 setFinance(fin as MonthlyFinance[])
 setTickets(tix as TicketRow[])
 setProjects(proj as any[])
 setProductivity(prod as any[])
 setPending(pend as PendingItem[])
 setKpiRaw({ revBln: revBln as number, costBln: costBln as number, apDue: apDue as number, karyawan: karyawan as number, nilaiStok: nilaiStok as number })
 setDrawn(tglJam(new Date().toISOString()))
 }).catch(() => {}).finally(() => alive && setLoading(false))
 return () => { alive = false }
 }, [profile])

 useEffect(() => {
 if (!profile?.company_id) return
 if (can('HR', 'write')) list('employees', { select: 'id,full_name,position', eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }).then(setEmployees).catch(() => {})
 if (can('PROCUREMENT', 'write')) {
 list('branches', { select: 'id,name', order: { col: 'name', asc: true } }).then(setBranches).catch(() => {})
 list('item_catalog', { select: 'id,code,name,uom,last_price', eq: { is_active: true }, order: { col: 'name', asc: true } }).then(setItems).catch(() => {})
 }
 }, [profile?.company_id])

 function friendlyQuickError(e: any, modul: string, fallback: string) {
 const msg = e?.message ?? ''
 if (/row-level security|permission denied/i.test(msg)) return `Gagal menyimpan — hak akses Anda pada modul ${modul} tidak mengizinkan tindakan ini.`
 return msg || fallback
 }

 function openCuti() { setCutiForm({ ...emptyCuti, start_date: todayISO(), end_date: todayISO() }); setCutiOpen(true) }
 async function saveCuti() {
 if (!cutiForm.employee_id || !cutiForm.start_date || !cutiForm.end_date) { toast.push('Karyawan, tanggal mulai, dan tanggal selesai wajib diisi', 'error'); return }
 if (cutiForm.end_date < cutiForm.start_date) { toast.push('Tanggal selesai tidak boleh mendahului tanggal mulai', 'error'); return }
 const days = Math.floor((new Date(cutiForm.end_date).getTime() - new Date(cutiForm.start_date).getTime()) / 86400000) + 1
 setCutiSaving(true)
 try {
 await insert('leave_requests', {
 company_id: profile!.company_id, employee_id: cutiForm.employee_id, leave_type: cutiForm.leave_type,
 start_date: cutiForm.start_date, end_date: cutiForm.end_date, days, reason: cutiForm.reason || null,
 status: 'diajukan', created_by: profile!.id,
 })
 toast.push('Pengajuan cuti dibuat'); setCutiOpen(false)
 } catch (e: any) { toast.push(friendlyQuickError(e, 'HR', 'Gagal membuat pengajuan cuti'), 'error') }
 finally { setCutiSaving(false) }
 }

 function openKas() { setKasForm({ ...emptyKas, flow_date: todayISO() }); setKasOpen(true) }
 async function saveKas() {
 if (!kasForm.amount || Number(kasForm.amount) <= 0) { toast.push('Nominal harus lebih dari 0', 'error'); return }
 setKasSaving(true)
 try {
 await insert('cash_flows', {
 company_id: profile!.company_id, flow_date: kasForm.flow_date, direction: kasForm.direction,
 category: kasForm.category || null, description: kasForm.description || null, amount: Number(kasForm.amount),
 })
 toast.push('Transaksi kas dicatat'); setKasOpen(false)
 } catch (e: any) { toast.push(friendlyQuickError(e, 'Finance', 'Gagal mencatat transaksi kas'), 'error') }
 finally { setKasSaving(false) }
 }

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
 toast.push(`PR ${pr_no} disimpan sebagai draft`); setPrOpen(false)
 } catch (e: any) { toast.push(friendlyQuickError(e, 'Procurement', 'Gagal menyimpan PR'), 'error') }
 finally { setPrSaving(false) }
 }

 const ticketByStatus = useMemo(() => {
 const m: Record<string, number> = {}
 tickets.forEach(t => { const k = t.status ?? 'lainnya'; m[k] = (m[k] ?? 0) + 1 })
 return Object.entries(m).map(([status, jumlah]) => ({ status, jumlah }))
 }, [tickets])

 const ticketOpen = useMemo(() => tickets.filter(t => !['resolved', 'closed'].includes(t.status ?? '')).length, [tickets])
 const slaCompliance = useMemo(() => {
 const withSla = tickets.filter(t => t.sla_status)
 if (!withSla.length) return null
 return (withSla.filter(t => t.sla_status === 'met').length / withSla.length) * 100
 }, [tickets])

 const margin = kpiRaw.revBln ? ((kpiRaw.revBln - (kpiRaw.costBln ?? 0)) / kpiRaw.revBln) * 100 : 0

 const kpis: Kpi[] = [
 { key: 'rev', label: 'Pendapatan Bulan Berjalan', value: rupiah(kpiRaw.revBln, true), icon: <Wallet size={16} />, module: 'FINANCE' },
 { key: 'cost', label: 'Biaya Proyek', value: rupiah(kpiRaw.costBln, true), icon: <Receipt size={16} />, module: 'FINANCE' },
 { key: 'margin', label: 'Margin %', value: kpiRaw.revBln ? pct(margin) : '-', icon: <Percent size={16} />, module: 'FINANCE' },
 { key: 'tiket', label: 'Tiket Terbuka', value: num(ticketOpen), icon: <Ticket size={16} />, module: 'OPERATIONS' },
 { key: 'sla', label: 'Kepatuhan SLA %', value: slaCompliance == null ? '-' : pct(slaCompliance), icon: <ShieldCheck size={16} />, module: 'OPERATIONS' },
 { key: 'karyawan', label: 'Karyawan Aktif', value: num(kpiRaw.karyawan), icon: <Users size={16} />, module: 'HR' },
 { key: 'ap', label: 'AP Jatuh Tempo 7 Hari', value: rupiah(kpiRaw.apDue, true), icon: <CalendarClock size={16} />, module: 'FINANCE' },
 { key: 'stok', label: 'Nilai Stok', value: rupiah(kpiRaw.nilaiStok, true), icon: <Boxes size={16} />, module: 'INVENTORY' },
 ]

 return (
 <div>
 <PageHeader title="Ringkasan Perusahaan" subtitle="Sekilas kondisi operasional & keuangan seluruh unit hari ini" />

 {(can('HR', 'write') || can('FINANCE', 'write') || can('PROCUREMENT', 'write')) && (
 <div className="flex flex-wrap gap-2 mb-6">
 {can('HR', 'write') && <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={openCuti}>Ajukan Cuti</Button>}
 {can('FINANCE', 'write') && <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={openKas}>Catat Kas Masuk/Keluar</Button>}
 {can('PROCUREMENT', 'write') && <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={openPr}>Buat PR</Button>}
 </div>
 )}

 {loading ? (
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-md" />)}</div>
 ) : (
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
 {kpis.filter(k => can(k.module)).map(k => <KpiCard key={k.key} label={k.label} value={k.value} icon={k.icon} />)}
 </div>
 )}

 <div className="grid lg:grid-cols-2 gap-4 mb-6">
 {can('FINANCE') && (
 <Card>
 <CardHeader title="Pendapatan vs Biaya — 12 Bulan" subtitle="Rupiah, dari ar_invoices & job_costs" />
 <div className="p-4 h-72">
 {loading ? <Skeleton className="h-full w-full" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <ComposedChart data={finance} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-ink-100" />
 <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
 <YAxis tickFormatter={(v) => rupiah(v, true)} tick={{ fontSize: 11 }} width={64} />
 <Tooltip formatter={(v: any) => rupiah(Number(v))} />
 <Legend wrapperStyle={{ fontSize: 12 }} />
 <Bar dataKey="biaya" name="Biaya" fill={cc.accent} radius={[3, 3, 0, 0]} />
 <Line type="monotone" dataKey="pendapatan" name="Pendapatan" stroke={cc.primary} strokeWidth={2.5} dot={false} />
 </ComposedChart>
 </ResponsiveContainer>
 )}
 </div>
 </Card>
 )}

 {can('OPERATIONS') && (
 <Card>
 <CardHeader title="Sebaran Tiket per Status" subtitle="Dari tabel tickets" />
 <div className="p-4 h-72">
 {loading ? <Skeleton className="h-full w-full" /> : ticketByStatus.length === 0 ? <EmptyState title="Belum ada tiket" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie data={ticketByStatus} dataKey="jumlah" nameKey="status" innerRadius={56} outerRadius={92} paddingAngle={2}>
 {ticketByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
 </Pie>
 <Tooltip formatter={(v: any, n: any) => [num(v as number), String(n).replace(/_/g, ' ')]} />
 <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v: any) => String(v).replace(/_/g, ' ')} />
 </PieChart>
 </ResponsiveContainer>
 )}
 </div>
 </Card>
 )}

 {can('DEPLOYMENT') && (
 <Card>
 <CardHeader title="Progres Proyek Aktif" subtitle="Persen penyelesaian, dari tabel projects" />
 <div className="p-4 h-72">
 {loading ? <Skeleton className="h-full w-full" /> : projects.length === 0 ? <EmptyState title="Tidak ada proyek aktif" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={projects} layout="vertical" margin={{ left: 8, right: 24 }}>
 <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-ink-100" />
 <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
 <YAxis type="category" dataKey="project_name" width={140} tick={{ fontSize: 11 }} />
 <Tooltip formatter={(v: any) => pct(Number(v))} />
 <Bar dataKey="progress_percent" name="Progres" fill={cc.primary} radius={[0, 3, 3, 0]}>
 <LabelList dataKey="progress_percent" position="right" formatter={(v: any) => `${num(v)}%`} style={{ fontSize: 11 }} />
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 )}
 </div>
 </Card>
 )}

 {can('PRODUCTIVITY') && (
 <Card>
 <CardHeader title="Produktivitas Teknisi — 10 Besar" subtitle="Total poin periode berjalan, dari v_dashboard_productivity" />
 <div className="p-4 h-72">
 {loading ? <Skeleton className="h-full w-full" /> : productivity.length === 0 ? <EmptyState title="Belum ada data produktivitas" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={productivity} layout="vertical" margin={{ left: 8, right: 24 }}>
 <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-ink-100" />
 <XAxis type="number" tick={{ fontSize: 11 }} />
 <YAxis type="category" dataKey="employee_name" width={130} tick={{ fontSize: 11 }} />
 <Tooltip formatter={(v: any) => num(Number(v))} />
 <Bar dataKey="total_points" name="Poin" fill={cc.primarySoft} radius={[0, 3, 3, 0]} />
 </BarChart>
 </ResponsiveContainer>
 )}
 </div>
 </Card>
 )}
 </div>

 <Card className="mb-6">
 <CardHeader title="Butuh Tindakan Anda" subtitle="Dokumen menunggu persetujuan Anda" />
 {loading ? <div className="p-4"><Skeleton className="h-10 w-full mb-2" /><Skeleton className="h-10 w-full" /></div> : pending.length === 0 ? (
 <EmptyState icon={<ClipboardList size={22} />} title="Tidak ada dokumen menunggu" message="Semua persetujuan Anda sudah selesai diproses." />
 ) : (
 <ul className="divide-y divide-ink-200">
 {pending.map(item => (
 <li key={`${item.type}-${item.id}`}>
 <Link to={item.path} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-primary-50/50 transition-colors">
 <div className="min-w-0">
 <p className="text-caption text-ink-400">{item.type}</p>
 <p className="text-body text-ink-800 truncate">{item.title}</p>
 </div>
 <div className="flex items-center gap-2 shrink-0 text-caption text-ink-400">
 {tgl(item.date)} <ArrowRight size={14} />
 </div>
 </Link>
 </li>
 ))}
 </ul>
 )}
 </Card>

 <p className="text-caption text-ink-400">
 Sumber data: tabel operasional NUSAKARYA (ar_invoices, job_costs, tickets, projects, v_dashboard_productivity, stock_balances, vendor_invoices, employees). Ditarik saat halaman dibuka{drawn ? `, ${drawn}` : ''}.
 </p>

 <Modal open={cutiOpen} onClose={() => setCutiOpen(false)} title="Ajukan Cuti"
 footer={<><Button variant="outline" onClick={() => setCutiOpen(false)}>Batal</Button><Button loading={cutiSaving} onClick={saveCuti}>Ajukan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Karyawan" required className="sm:col-span-2"><Select value={cutiForm.employee_id} onChange={(e: any) => setCutiForm({ ...cutiForm, employee_id: e.target.value })} options={employees.map(e => ({ value: e.id, label: `${e.full_name} — ${e.position}` }))} /></Field>
 <Field label="Jenis Cuti"><Select value={cutiForm.leave_type} onChange={(e: any) => setCutiForm({ ...cutiForm, leave_type: e.target.value })} options={LEAVE_TYPE_OPTIONS_QUICK} /></Field>
 <Field label="Tanggal Mulai" required><Input type="date" value={cutiForm.start_date} onChange={(e: any) => setCutiForm({ ...cutiForm, start_date: e.target.value })} /></Field>
 <Field label="Tanggal Selesai" required><Input type="date" value={cutiForm.end_date} onChange={(e: any) => setCutiForm({ ...cutiForm, end_date: e.target.value })} /></Field>
 <Field label="Alasan" className="sm:col-span-2"><Textarea value={cutiForm.reason} onChange={(e: any) => setCutiForm({ ...cutiForm, reason: e.target.value })} /></Field>
 </div>
 </Modal>

 <Modal open={kasOpen} onClose={() => setKasOpen(false)} title="Catat Kas Masuk/Keluar"
 footer={<><Button variant="outline" onClick={() => setKasOpen(false)}>Batal</Button><Button loading={kasSaving} onClick={saveKas}>Simpan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Tanggal"><Input type="date" value={kasForm.flow_date} onChange={(e: any) => setKasForm({ ...kasForm, flow_date: e.target.value })} /></Field>
 <Field label="Arah"><Select value={kasForm.direction} onChange={(e: any) => setKasForm({ ...kasForm, direction: e.target.value })} options={[{ value: 'in', label: 'Kas Masuk' }, { value: 'out', label: 'Kas Keluar' }]} /></Field>
 <Field label="Kategori" className="sm:col-span-2"><Select value={kasForm.category} onChange={(e: any) => setKasForm({ ...kasForm, category: e.target.value })} options={KAS_KATEGORI} /></Field>
 <Field label="Nominal" required><Input type="number" min="0" value={kasForm.amount} onChange={(e: any) => setKasForm({ ...kasForm, amount: e.target.value })} /></Field>
 <Field label="Keterangan"><Input value={kasForm.description} onChange={(e: any) => setKasForm({ ...kasForm, description: e.target.value })} /></Field>
 </div>
 </Modal>

 <Modal open={prOpen} onClose={() => setPrOpen(false)} title="Buat PR"
 subtitle="Form ringkas — satu item. Untuk item tambahan, buka halaman Purchase Request."
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
