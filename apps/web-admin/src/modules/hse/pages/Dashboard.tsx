import React, { useEffect, useMemo, useState } from 'react'
import {
 ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, count, insert, nextDocNo } from '@/lib/db'
import { Card, CardHeader, PageHeader, KpiCard, DataTable, Badge, TableSkeleton, Button, Modal, Field, Select, Input, Textarea, useToast, Plus } from '@/components/ui'
import { num, pct, tgl, todayISO } from '@/lib/format'
import {
 INCIDENT_TYPES, incidentTypeLabel, incidentTypeTone, isMajorIncident, isInjuryIncident,
 incidentStatusLabel, incidentStatusTone, inspectionResultLabel, CHART_COLORS, INCIDENT_TYPE_COLORS,
 RESULT_COLORS, ASSUMED_MONTHLY_WORK_HOURS,
} from '../lib/constants'
import { lastNMonths, monthKey, monthLabel, monthsAgoISODate, daysBetween } from '../lib/helpers'

const emptyIncident = { incident_date: todayISO(), incident_type: '', location: '', branch_id: '', description: '' }

export default function Dashboard() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [incidents, setIncidents] = useState<any[]>([])
 const [branches, setBranches] = useState<any[]>([])
 const [hseView, setHseView] = useState<any[]>([])
 const [activeEmployees, setActiveEmployees] = useState<number>(0)
 const [pulledAt, setPulledAt] = useState<Date | null>(null)

 const [incidentOpen, setIncidentOpen] = useState(false)
 const [incidentForm, setIncidentForm] = useState<any>(emptyIncident)
 const [incidentSaving, setIncidentSaving] = useState(false)

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

 async function load() {
 setLoading(true)
 try {
 const [inc, br, view, empCount] = await Promise.all([
 list('hse_incidents', {
 select: 'id,incident_no,incident_date,incident_type,branch_id,status,description,lost_days',
 eq: { company_id: profile!.company_id }, order: { col: 'incident_date', asc: false }, limit: 3000,
 }),
 list('branches', { select: 'id,name', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
 list('v_dashboard_hse', { eq: { company_id: profile!.company_id }, limit: 1000 }),
 count('employees', { company_id: profile!.company_id, status: 'aktif' }),
 ])
 setIncidents(inc); setBranches(br); setHseView(view); setActiveEmployees(empCount); setPulledAt(new Date())
 } catch (e: any) { /* toast tidak wajib di dashboard baca-saja */ console.error(e) }
 finally { setLoading(false) }
 }

 function openIncident() { setIncidentForm({ ...emptyIncident, incident_date: todayISO() }); setIncidentOpen(true) }
 async function saveIncident() {
 if (!incidentForm.incident_date || !incidentForm.incident_type || !incidentForm.location || !incidentForm.branch_id || !incidentForm.description) {
 toast.push('Tanggal, jenis, lokasi, cabang, dan uraian wajib diisi', 'error'); return
 }
 setIncidentSaving(true)
 try {
 const incidentNo = await nextDocNo(profile!.company_id, 'INC')
 await insert('hse_incidents', {
 company_id: profile!.company_id, incident_no: incidentNo, incident_date: incidentForm.incident_date,
 incident_type: incidentForm.incident_type, location: incidentForm.location, branch_id: incidentForm.branch_id,
 description: incidentForm.description, photo_urls: [], status: 'dilaporkan', reported_by: profile!.id, created_by: profile!.id,
 })
 toast.push(`Insiden ${incidentNo} berhasil dilaporkan`); setIncidentOpen(false); load()
 } catch (e: any) {
 const msg = /row-level security|permission denied/i.test(e?.message ?? '') ? 'Gagal menyimpan — hak akses Anda pada modul Operations tidak mengizinkan tindakan ini.' : (e.message ?? 'Gagal menyimpan laporan insiden')
 toast.push(msg, 'error')
 } finally { setIncidentSaving(false) }
 }

 const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'
 const nowMonth = monthKey(new Date())
 const months6 = lastNMonths(6)
 const months12 = lastNMonths(12)
 const twelveMonthsAgo = monthsAgoISODate(12)

 /* ---------------- KPI ---------------- */
 const kpi = useMemo(() => {
 const insidenBulanIni = incidents.filter(i => String(i.incident_date).slice(0, 7) === nowMonth)
 const nearmissBulanIni = insidenBulanIni.filter(i => i.incident_type === 'nearmiss').length

 const rowLostDays = hseView.find(r => r.metric === 'lost_days_month' && r.bucket === nowMonth)
 const hariKerjaHilang = rowLostDays ? Number(rowLostDays.amount ?? rowLostDays.cnt ?? 0) : incidents
 .filter(i => String(i.incident_date).slice(0, 7) === nowMonth)
 .reduce((a, b) => a + (Number(b.lost_days) || 0), 0)

 const rowPermitActive = hseView.find(r => r.metric === 'permit_active')
 const izinAktif = rowPermitActive ? Number(rowPermitActive.cnt ?? 0) : 0

 const rowInspeksiTidakAman = hseView.find(r => r.metric === 'inspection_by_result' && r.bucket === 'tidak_aman')
 const inspeksiTidakAman = rowInspeksiTidakAman ? Number(rowInspeksiTidakAman.cnt ?? 0) : 0

 const insiden12BulanCedera = incidents.filter(i => i.incident_date >= twelveMonthsAgo && isInjuryIncident(i.incident_type)).length
 const totalJamKerja = activeEmployees * ASSUMED_MONTHLY_WORK_HOURS * 12
 const perJutaJamKerja = totalJamKerja > 0 ? (insiden12BulanCedera / totalJamKerja) * 1_000_000 : null

 return { insidenBulanIni: insidenBulanIni.length, nearmissBulanIni, hariKerjaHilang, izinAktif, inspeksiTidakAman, perJutaJamKerja, insiden12BulanCedera, totalJamKerja }
 }, [incidents, hseView, activeEmployees, nowMonth, twelveMonthsAgo])

 /* ---------------- Papan Hari Tanpa Insiden ---------------- */
 const hariTanpaInsiden = useMemo(() => {
 const major = incidents.filter(i => isMajorIncident(i.incident_type)).sort((a, b) => (a.incident_date < b.incident_date ? 1 : -1))
 if (!major.length) return { hari: null as number | null, tanggal: null as string | null }
 return { hari: daysBetween(major[0].incident_date), tanggal: major[0].incident_date }
 }, [incidents])

 /* ---------------- Grafik ---------------- */
 const stackedPerJenis = useMemo(() => {
 return months6.map(mk => {
 const row: any = { label: monthLabel(mk) }
 INCIDENT_TYPES.forEach(t => {
 row[t.value] = incidents.filter(i => String(i.incident_date).slice(0, 7) === mk && i.incident_type === t.value).length
 })
 return row
 })
 }, [incidents, months6])

 const tren12Bulan = useMemo(() => months12.map(mk => ({
 label: monthLabel(mk), jumlah: incidents.filter(i => String(i.incident_date).slice(0, 7) === mk).length,
 })), [incidents, months12])

 const perCabang = useMemo(() => {
 const g: Record<string, number> = {}
 incidents.filter(i => i.incident_date >= twelveMonthsAgo).forEach(i => { const b = i.branch_id || 'tanpa_cabang'; g[b] = (g[b] ?? 0) + 1 })
 return Object.entries(g).map(([bid, jumlah]) => ({ name: bid === 'tanpa_cabang' ? 'Tanpa Cabang' : branchName(bid), jumlah }))
 .sort((a, b) => b.jumlah - a.jumlah)
 }, [incidents, branches, twelveMonthsAgo])

 const hasilInspeksi = useMemo(() => hseView
 .filter(r => r.metric === 'inspection_by_result')
 .map(r => ({ name: inspectionResultLabel(r.bucket), key: r.bucket, value: Number(r.cnt ?? 0) }))
 .filter(r => r.value > 0), [hseView])

 const insidenTerbuka = useMemo(() => incidents
 .filter(i => i.status !== 'selesai')
 .sort((a, b) => (a.incident_date < b.incident_date ? -1 : 1)), [incidents])

 return (
 <div>
 <PageHeader title="Dashboard K3" subtitle="Ringkasan kinerja keselamatan kerja — insiden, inspeksi & izin kerja" />

 {can('OPERATIONS', 'write') && (
 <div className="flex flex-wrap gap-2 mb-5">
 <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={openIncident}>Lapor Insiden</Button>
 </div>
 )}

 {/* Papan Hari Tanpa Insiden */}
 <Card className="mb-5 bg-gradient-to-br from-primary-600 to-primary-700 border-0 text-white overflow-hidden">
 <div className="p-6 sm:p-8 text-center">
 <p className="text-caption font-semibold uppercase tracking-widest text-white/80">Hari Tanpa Insiden Berat / Fatal</p>
 <p className="mt-2 font-display text-[56px] sm:text-[72px] leading-none font-extrabold tabular">
 {loading ? '…' : hariTanpaInsiden.hari != null ? num(hariTanpaInsiden.hari) : '-'}
 </p>
 <p className="mt-2 text-body text-white/85">
 {loading ? 'Memuat…' : hariTanpaInsiden.tanggal
 ? `Sejak insiden terakhir pada ${tgl(hariTanpaInsiden.tanggal)}`
 : 'Belum ada insiden berat/fatal tercatat dalam riwayat sistem'}
 </p>
 </div>
 </Card>

 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-2">
 <KpiCard label="Insiden Bulan Ini" value={loading ? '…' : num(kpi.insidenBulanIni)} />
 <KpiCard label="Hari Kerja Hilang" value={loading ? '…' : num(kpi.hariKerjaHilang)} sub="bulan ini" tone={kpi.hariKerjaHilang > 0 ? 'amber' : 'teal'} />
 <KpiCard label="Insiden / Juta Jam Kerja" value={loading ? '…' : kpi.perJutaJamKerja != null ? num(kpi.perJutaJamKerja, 2) : '-'} sub="perkiraan" tone="amber" />
 <KpiCard label="Nearmiss Dilaporkan" value={loading ? '…' : num(kpi.nearmissBulanIni)} sub="bulan ini" />
 <KpiCard label="Izin Kerja Aktif" value={loading ? '…' : num(kpi.izinAktif)} tone="emerald" />
 <KpiCard label="Inspeksi Tidak Aman" value={loading ? '…' : num(kpi.inspeksiTidakAman)} sub="seluruh riwayat" tone={kpi.inspeksiTidakAman > 0 ? 'red' : 'teal'} />
 </div>
 <p className="text-caption text-ink-400 mb-5">
 Asumsi "Insiden / Juta Jam Kerja": {num(kpi.insiden12BulanCedera)} insiden kecelakaan kerja (nearmiss tidak dihitung) dalam 12 bulan terakhir,
 dibagi perkiraan total jam kerja = {num(activeEmployees)} karyawan aktif × {ASSUMED_MONTHLY_WORK_HOURS} jam/bulan × 12 bulan = {num(kpi.totalJamKerja)} jam. Sesuaikan bila kebijakan jam kerja perusahaan berbeda.
 </p>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
 <Card>
 <CardHeader title="Insiden per Jenis — 6 Bulan Terakhir" subtitle="Bertumpuk per bulan" />
 <div className="p-4 h-72">
 {loading ? <TableSkeleton rows={4} /> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={stackedPerJenis}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="label" tick={{ fontSize: 11 }} />
 <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
 <Tooltip />
 <Legend formatter={(v: any) => incidentTypeLabel(v)} />
 {INCIDENT_TYPES.map(t => (
 <Bar key={t.value} dataKey={t.value} name={t.value} stackId="jenis" fill={INCIDENT_TYPE_COLORS()[t.value]} radius={t.value === 'fatal' ? [3, 3, 0, 0] : undefined} />
 ))}
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 <Card>
 <CardHeader title="Tren Insiden — 12 Bulan Terakhir" />
 <div className="p-4 h-72">
 {loading ? <TableSkeleton rows={4} /> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={tren12Bulan}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={40} />
 <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
 <Tooltip />
 <Bar dataKey="jumlah" name="Jumlah Insiden" fill={CHART_COLORS()[0]} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
 <Card>
 <CardHeader title="Insiden per Cabang" subtitle="12 bulan terakhir" />
 <div className="p-4 h-72">
 {loading ? <TableSkeleton rows={4} /> : perCabang.length === 0 ? <div className="grid place-items-center h-full text-ink-400 text-body">Belum ada data insiden.</div> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={perCabang} layout="vertical" margin={{ left: 12 }}>
 <CartesianGrid strokeDasharray="3 3" horizontal={false} />
 <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
 <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
 <Tooltip />
 <Bar dataKey="jumlah" name="Jumlah Insiden" fill={CHART_COLORS()[3]} radius={[0, 4, 4, 0]} />
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 <Card>
 <CardHeader title="Hasil Inspeksi" subtitle="Seluruh riwayat inspeksi tercatat" />
 <div className="p-4 h-72">
 {loading ? <TableSkeleton rows={4} /> : hasilInspeksi.length === 0 ? <div className="grid place-items-center h-full text-ink-400 text-body">Belum ada data inspeksi.</div> : (
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie data={hasilInspeksi} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
 {hasilInspeksi.map((r, i) => <Cell key={i} fill={RESULT_COLORS()[r.key] ?? CHART_COLORS()[i % CHART_COLORS().length]} />)}
 </Pie>
 <Tooltip /><Legend />
 </PieChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 </div>

 <Card className="mb-2">
 <CardHeader title="Insiden Terbuka — Belum Selesai Investigasi" subtitle="Diurutkan dari tanggal terlama" />
 <DataTable
 loading={loading} rows={insidenTerbuka} searchable={false}
 emptyTitle="Tidak ada insiden terbuka" emptyMessage="Seluruh insiden sudah selesai diinvestigasi dan ditutup."
 columns={[
 { key: 'incident_no', header: 'No Insiden' },
 { key: 'incident_date', header: 'Tanggal', render: r => tgl(r.incident_date) },
 { key: 'incident_type', header: 'Jenis', render: r => <Badge tone={incidentTypeTone(r.incident_type)}>{incidentTypeLabel(r.incident_type)}</Badge> },
 { key: 'branch_id', header: 'Cabang', render: r => branchName(r.branch_id) },
 { key: 'description', header: 'Uraian', render: r => <span className="line-clamp-1 max-w-xs inline-block">{r.description || '-'}</span> },
 { key: 'status', header: 'Status', render: r => <Badge tone={incidentStatusTone(r.status)}>{incidentStatusLabel(r.status)}</Badge> },
 { key: 'usia', header: 'Usia', align: 'right', render: r => `${num(daysBetween(r.incident_date))} hari` },
 ]}
 />
 </Card>
 <p className="text-caption text-ink-400 mt-2">
 Sumber data: tabel <code>hse_incidents</code> (hingga 3.000 terbaru), <code>employees</code>, dan view <code>v_dashboard_hse</code> (izin aktif, hari kerja hilang bulan ini, hasil inspeksi).
 Ditarik pada {pulledAt ? tgl(pulledAt.toISOString()) + ' ' + pulledAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}.
 </p>

 <Modal open={incidentOpen} onClose={() => setIncidentOpen(false)} title="Lapor Insiden"
 footer={<><Button variant="outline" onClick={() => setIncidentOpen(false)}>Batal</Button><Button loading={incidentSaving} onClick={saveIncident}>Simpan Laporan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Tanggal" required><Input type="date" value={incidentForm.incident_date} onChange={(e: any) => setIncidentForm({ ...incidentForm, incident_date: e.target.value })} /></Field>
 <Field label="Jenis Insiden" required><Select value={incidentForm.incident_type} onChange={(e: any) => setIncidentForm({ ...incidentForm, incident_type: e.target.value })} options={INCIDENT_TYPES} /></Field>
 <Field label="Cabang" required><Select value={incidentForm.branch_id} onChange={(e: any) => setIncidentForm({ ...incidentForm, branch_id: e.target.value })} options={branches.map(b => ({ value: b.id, label: b.name }))} /></Field>
 <Field label="Lokasi" required><Input value={incidentForm.location} onChange={(e: any) => setIncidentForm({ ...incidentForm, location: e.target.value })} /></Field>
 <Field label="Uraian Kejadian" required className="sm:col-span-2"><Textarea value={incidentForm.description} onChange={(e: any) => setIncidentForm({ ...incidentForm, description: e.target.value })} /></Field>
 </div>
 </Modal>
 </div>
 )
}
