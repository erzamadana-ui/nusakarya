import React, { useEffect, useMemo, useState } from 'react'
import { chartColors } from '@/lib/theme'
import { useNavigate } from 'react-router-dom'
import {
 ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell, Tooltip,
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo } from '@/lib/db'
import { rupiah, tgl, pct, num, todayISO } from '@/lib/format'
import {
 PageHeader, Card, CardHeader, KpiCard, Badge, Button, Modal, Drawer, ConfirmDialog,
 Field, Input, Select, Textarea, Money, Timeline, useToast, TableSkeleton, EmptyState, Plus,
} from '@/components/ui'
import {
 PIPELINE_STAGES, PIPELINE_STAGE_LABEL, PIPELINE_FORWARD_ORDER, OPPORTUNITY_TYPE_OPTIONS,
 OPPORTUNITY_SOURCE_OPTIONS, OPPORTUNITY_ACTIVITY_TYPES, CONTRACT_TYPE_OPTIONS, CHART_COLORS,
} from '../lib/constants'
import { daysUntil, countdownTone, countdownLabel, monthKey, monthLabel } from '../lib/helpers'

const TONE_CLASS: Record<string, string> = {
 red: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
 orange: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
 amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
 emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
 slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

function emptyForm() {
 return {
 opp_no: '', title: '', customer_id: '', stage: 'lead', estimated_value: 0, probability_percent: 10,
 submit_deadline: '', decision_date: '', owner_id: '', opportunity_type: 'tender', source: 'Referensi Internal',
 note: '', lost_reason: '', competitor_note: '',
 }
}

export default function Pipeline() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const navigate = useNavigate()
 const writable = can('COMMERCE', 'write')
 const approver = can('COMMERCE', 'approve')

 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [customers, setCustomers] = useState<any[]>([])
 const [owners, setOwners] = useState<any[]>([])

 const [modal, setModal] = useState(false)
 const [editing, setEditing] = useState<any>(null)
 const [form, setForm] = useState<any>(emptyForm())
 const [saving, setSaving] = useState(false)

 const [detail, setDetail] = useState<any>(null)
 const [activities, setActivities] = useState<any[]>([])
 const [actLoading, setActLoading] = useState(false)
 const [actForm, setActForm] = useState({ activity_date: todayISO(), activity_type: OPPORTUNITY_ACTIVITY_TYPES[0], note: '' })
 const [actSaving, setActSaving] = useState(false)
 const [delId, setDelId] = useState<string | null>(null)

 const [ktrModal, setKtrModal] = useState(false)
 const [ktrForm, setKtrForm] = useState<any>(null)
 const [ktrSaving, setKtrSaving] = useState(false)

 const custMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c.name])), [customers])
 const ownerMap = useMemo(() => Object.fromEntries(owners.map(o => [o.id, o.full_name])), [owners])

 const load = async () => {
 setLoading(true)
 try {
 const [o, cu, pr] = await Promise.all([
 list('opportunities', { order: { col: 'created_at', asc: false }, limit: 1000 }),
 list('customers', { select: 'id,name', order: { col: 'name', asc: true }, limit: 1000 }),
 list('profiles', { select: 'id,full_name', eq: { is_active: true }, order: { col: 'full_name', asc: true }, limit: 500 }),
 ])
 setRows(o); setCustomers(cu); setOwners(pr)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data pipeline', 'error') }
 finally { setLoading(false) }
 }
 useEffect(() => { load() }, [])

 /* ---------------- KPI ---------------- */
 const kpi = useMemo(() => {
 const active = rows.filter(r => !['menang', 'kalah', 'batal'].includes(r.stage))
 const weighted = active.reduce((s, r) => s + Number(r.estimated_value || 0) * (Number(r.probability_percent || 0) / 100), 0)
 const menang = rows.filter(r => r.stage === 'menang')
 const kalah = rows.filter(r => r.stage === 'kalah')
 const winRate = (menang.length + kalah.length) > 0 ? (menang.length / (menang.length + kalah.length)) * 100 : 0
 const dueThisWeek = active.filter(r => { const d = daysUntil(r.submit_deadline); return d != null && d >= 0 && d <= 7 }).length
 const now = new Date()
 const wonThisMonth = menang.filter(r => {
 const ref = r.decision_date || r.updated_at
 if (!ref) return false
 const d = new Date(ref)
 return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
 }).reduce((s, r) => s + Number(r.estimated_value || 0), 0)
 return { weighted, winRate, dueThisWeek, wonThisMonth, menangCount: menang.length, kalahCount: kalah.length }
 }, [rows])

 /* ---------------- Grafik ---------------- */
 const funnelData = useMemo(() => {
 const stageOrder = ['lead', 'kualifikasi', 'penawaran', 'negosiasi', 'menang']
 return stageOrder.map((s, i) => ({
 name: PIPELINE_STAGE_LABEL[s], value: rows.filter(r => r.stage === s).reduce((a, r) => a + Number(r.estimated_value || 0), 0),
 fill: CHART_COLORS()[i % CHART_COLORS().length],
 }))
 }, [rows])

 const trendData = useMemo(() => {
 const now = new Date()
 const keys: string[] = []
 for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); keys.push(monthKey(d.toISOString())) }
 const g: Record<string, { menang: number; kalah: number }> = {}
 keys.forEach(k => { g[k] = { menang: 0, kalah: 0 } })
 rows.forEach(r => {
 if (r.stage !== 'menang' && r.stage !== 'kalah') return
 const ref = r.decision_date || r.updated_at
 if (!ref) return
 const k = monthKey(ref)
 if (!g[k]) return
 if (r.stage === 'menang') g[k].menang++; else g[k].kalah++
 })
 return keys.map(k => ({ bulan: monthLabel(k), Menang: g[k].menang, Kalah: g[k].kalah }))
 }, [rows])

 /* ---------------- Papan ---------------- */
 const byStage = useMemo(() => {
 const m: Record<string, any[]> = {}
 PIPELINE_STAGES.forEach(s => { m[s.value] = [] })
 rows.filter(r => r.stage !== 'batal').forEach(r => { if (m[r.stage]) m[r.stage].push(r) })
 return m
 }, [rows])

 /* ---------------- CRUD Peluang ---------------- */
 const openAdd = async () => {
 setEditing(null)
 let no = ''
 try { no = await nextDocNo(profile!.company_id, 'OPP') } catch { /* biarkan kosong bila gagal */ }
 setForm({ ...emptyForm(), opp_no: no })
 setModal(true)
 }
 const openEdit = (row: any) => { setEditing(row); setForm({ ...emptyForm(), ...row }); setModal(true) }

 const save = async () => {
 if (!form.opp_no || !form.title || !form.customer_id) { toast.push('No peluang, judul, dan pelanggan wajib diisi', 'error'); return }
 if (form.stage === 'kalah' && !form.lost_reason) { toast.push('Alasan kalah wajib diisi untuk tahap Kalah', 'error'); return }
 setSaving(true)
 try {
 const payload = {
 opp_no: form.opp_no, title: form.title, customer_id: form.customer_id, stage: form.stage,
 estimated_value: Number(form.estimated_value) || 0, probability_percent: Number(form.probability_percent) || 0,
 submit_deadline: form.submit_deadline || null, decision_date: form.decision_date || null,
 owner_id: form.owner_id || null, opportunity_type: form.opportunity_type || null, source: form.source || null,
 note: form.note || '', lost_reason: form.stage === 'kalah' ? form.lost_reason : null, competitor_note: form.competitor_note || null,
 }
 if (editing) { await update('opportunities', editing.id, payload); toast.push('Peluang diperbarui', 'success') }
 else { await insert('opportunities', { ...payload, company_id: profile!.company_id, created_by: profile!.id }); toast.push('Peluang ditambahkan', 'success') }
 setModal(false)
 if (detail && editing && detail.id === editing.id) setDetail((d: any) => ({ ...d, ...payload }))
 load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan peluang', 'error') }
 finally { setSaving(false) }
 }

 const doDelete = async () => {
 if (!delId) return
 try { await remove('opportunities', delId); toast.push('Peluang dihapus', 'success'); setDetail(null); load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus peluang', 'error') }
 }

 /* Tombol pindah tahap langsung dari kartu. Menuju "kalah" dialihkan ke drawer karena alasan wajib diisi. */
 const quickAdvance = async (row: any) => {
 const idx = PIPELINE_FORWARD_ORDER.indexOf(row.stage)
 if (idx < 0 || idx >= PIPELINE_FORWARD_ORDER.length - 1) return
 const next = PIPELINE_FORWARD_ORDER[idx + 1]
 try {
 await update('opportunities', row.id, { stage: next, decision_date: next === 'menang' ? todayISO() : null })
 toast.push(`Tahap dipindah ke ${PIPELINE_STAGE_LABEL[next]}`, 'success')
 load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal memindah tahap', 'error') }
 }
 const promptLost = (row: any) => { setEditing(row); setForm({ ...emptyForm(), ...row, stage: 'kalah', lost_reason: row.lost_reason || '' }); setModal(true) }

 /* ---------------- Drawer detail & aktivitas ---------------- */
 const openDetail = async (row: any) => {
 setDetail(row); setActLoading(true)
 try { setActivities(await list('opportunity_activities', { eq: { opportunity_id: row.id }, order: { col: 'activity_date', asc: false } })) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memuat riwayat aktivitas', 'error') }
 finally { setActLoading(false) }
 setActForm({ activity_date: todayISO(), activity_type: OPPORTUNITY_ACTIVITY_TYPES[0], note: '' })
 }
 const addActivity = async () => {
 if (!detail) return
 if (!actForm.note) { toast.push('Catatan aktivitas wajib diisi', 'error'); return }
 setActSaving(true)
 try {
 await insert('opportunity_activities', { company_id: profile!.company_id, opportunity_id: detail.id, activity_date: actForm.activity_date, activity_type: actForm.activity_type, note: actForm.note, created_by: profile!.id })
 setActivities(await list('opportunity_activities', { eq: { opportunity_id: detail.id }, order: { col: 'activity_date', asc: false } }))
 setActForm({ activity_date: todayISO(), activity_type: OPPORTUNITY_ACTIVITY_TYPES[0], note: '' })
 toast.push('Aktivitas dicatat', 'success')
 } catch (e: any) { toast.push(e.message ?? 'Gagal mencatat aktivitas', 'error') }
 finally { setActSaving(false) }
 }

 /* ---------------- Jadikan Kontrak ---------------- */
 const openJadikanKontrak = () => {
 if (!detail) return
 setKtrForm({
 contract_name: detail.title, customer_id: detail.customer_id, contract_type: 'deployment',
 start_date: todayISO(), end_date: '', contract_value: detail.estimated_value, retention_percent: 5,
 pic_id: detail.owner_id || '',
 })
 setKtrModal(true)
 }
 const saveKontrak = async () => {
 if (!ktrForm.contract_name || !ktrForm.customer_id) { toast.push('Nama kontrak dan pelanggan wajib diisi', 'error'); return }
 if (ktrForm.start_date && ktrForm.end_date && ktrForm.end_date < ktrForm.start_date) { toast.push('Tanggal berakhir tidak boleh mendahului tanggal mulai', 'error'); return }
 if (Number(ktrForm.contract_value) < 0) { toast.push('Nilai kontrak tidak boleh negatif', 'error'); return }
 setKtrSaving(true)
 try {
 const no = await nextDocNo(profile!.company_id, 'KTR')
 await insert('contracts', {
 company_id: profile!.company_id, contract_no: no, contract_name: ktrForm.contract_name, customer_id: ktrForm.customer_id,
 contract_type: ktrForm.contract_type, start_date: ktrForm.start_date || null, end_date: ktrForm.end_date || null,
 contract_value: Number(ktrForm.contract_value) || 0, retention_percent: Number(ktrForm.retention_percent) || 0,
 status: 'draft', pic_id: ktrForm.pic_id || null, created_by: profile!.id,
 })
 await insert('opportunity_activities', { company_id: profile!.company_id, opportunity_id: detail.id, activity_date: todayISO(), activity_type: 'Lainnya', note: `Kontrak ${no} dibuat dari peluang ini.`, created_by: profile!.id })
 toast.push(`Kontrak ${no} dibuat. Buka menu Kontrak untuk melengkapi.`, 'success')
 setKtrModal(false)
 setActivities(await list('opportunity_activities', { eq: { opportunity_id: detail.id }, order: { col: 'activity_date', asc: false } }))
 } catch (e: any) { toast.push(e.message ?? 'Gagal membuat kontrak', 'error') }
 finally { setKtrSaving(false) }
 }

 return (
 <div>
 <PageHeader title="Pipeline Tender & Peluang" subtitle="Papan kanban peluang bisnis dari lead sampai menang/kalah, lengkap dengan aktivitas dan konversi ke kontrak."
 actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Peluang</Button>} />

 {loading ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="p-4"><TableSkeleton rows={2} /></Card>)}</div> : (
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
 <KpiCard label="Nilai Pipeline Tertimbang" value={rupiah(kpi.weighted, true)} sub="Σ nilai × probabilitas" tone="teal" />
 <KpiCard label="Win Rate" value={pct(kpi.winRate)} sub={`${num(kpi.menangCount)} menang / ${num(kpi.kalahCount)} kalah`} tone="blue" />
 <KpiCard label="Tender Jatuh Tempo Minggu Ini" value={num(kpi.dueThisWeek)} tone="amber" />
 <KpiCard label="Nilai Menang Bulan Ini" value={rupiah(kpi.wonThisMonth, true)} tone="emerald" />
 </div>
 )}
 <p className="text-caption text-ink-400 -mt-3 mb-5">Sumber data: opportunities — ditarik {tgl(todayISO())}. Peluang bertahap "batal" tidak ditampilkan di papan.</p>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
 <Card>
 <CardHeader title="Corong Nilai per Tahap" subtitle="Nilai perkiraan peluang aktif menuju menang" />
 <div className="p-4 h-72">
 {loading ? <TableSkeleton rows={4} /> : funnelData.every(f => f.value === 0) ? <EmptyState title="Belum ada data peluang" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <FunnelChart>
 <Tooltip formatter={(v: any) => rupiah(Number(v))} />
 <Funnel dataKey="value" data={funnelData} isAnimationActive>
 <LabelList position="right" dataKey="name" fill={chartColors().neutral} stroke="none" fontSize={12} />
 {funnelData.map((f, i) => <Cell key={i} fill={f.fill} />)}
 </Funnel>
 </FunnelChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 <Card>
 <CardHeader title="Tren Menang / Kalah 6 Bulan" subtitle="Jumlah keputusan per bulan" />
 <div className="p-4 h-72">
 {loading ? <TableSkeleton rows={4} /> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={trendData} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors().grid} />
 <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
 <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
 <Tooltip />
 <Legend wrapperStyle={{ fontSize: 11 }} />
 <Bar dataKey="Menang" fill={chartColors().success} radius={[4, 4, 0, 0]} />
 <Bar dataKey="Kalah" fill={chartColors().danger} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 </div>

 {loading ? <Card><TableSkeleton rows={8} /></Card> : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
 {PIPELINE_STAGES.map(stage => {
 const list_ = byStage[stage.value] ?? []
 const total = list_.reduce((a, r) => a + Number(r.estimated_value || 0), 0)
 return (
 <div key={stage.value} className="bg-ink-50 rounded-md border border-ink-200 flex flex-col min-h-[200px]">
 <div className="px-3 py-2.5 border-b border-ink-200">
 <div className="flex items-center justify-between">
 <span className="font-display font-semibold text-[13px] text-ink-800">{stage.label}</span>
 <span className="text-caption text-ink-400">{list_.length}</span>
 </div>
 <p className="text-caption text-ink-500 tabular mt-0.5">{rupiah(total, true)}</p>
 </div>
 <div className="p-2 space-y-2 flex-1">
 {list_.length === 0 && <p className="text-caption text-ink-400 text-center py-6">Tidak ada peluang</p>}
 {list_.map(row => {
 const d = daysUntil(row.submit_deadline)
 const tone = countdownTone(!['menang', 'kalah'].includes(row.stage) ? d : null)
 const canAdvance = writable && PIPELINE_FORWARD_ORDER.indexOf(row.stage) >= 0 && PIPELINE_FORWARD_ORDER.indexOf(row.stage) < PIPELINE_FORWARD_ORDER.length - 1
 const canLose = writable && row.stage !== 'menang' && row.stage !== 'kalah'
 return (
 <Card key={row.id} onClick={() => openDetail(row)} className="p-2.5 cursor-pointer hover:shadow-e2 transition-shadow">
 <p className="text-body font-medium text-ink-900 leading-snug line-clamp-2">{row.title}</p>
 <p className="text-caption text-ink-500 mt-0.5">{custMap[row.customer_id] ?? '-'}</p>
 <div className="flex items-center justify-between mt-1.5">
 <span className="text-body font-semibold tabular text-ink-800">{rupiah(row.estimated_value, true)}</span>
 <span className="text-caption text-ink-500">{pct(row.probability_percent, 0)}</span>
 </div>
 {!['menang', 'kalah'].includes(row.stage) && (
 <span className={`inline-flex items-center h-5 px-1.5 rounded-full text-[11px] font-medium mt-1.5 ${TONE_CLASS[tone]}`}>{countdownLabel(d)}</span>
 )}
 <p className="text-caption text-ink-400 mt-1.5 truncate">PIC: {ownerMap[row.owner_id] ?? '-'}</p>
 {(canAdvance || canLose) && (
 <div className="flex items-center gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
 {canAdvance && <Button size="sm" variant="outline" className="flex-1 !h-7 !text-[11px] !px-1.5" onClick={() => quickAdvance(row)}>Maju Tahap →</Button>}
 {canLose && <Button size="sm" variant="ghost" className="!h-7 !text-[11px] !px-1.5 text-red-600" onClick={() => promptLost(row)}>Kalah</Button>}
 </div>)}
 </Card>
 )
 })}
 </div>
 </div>
 )
 })}
 </div>
 )}

 {/* ---------------- Modal tambah/ubah peluang ---------------- */}
 <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Ubah Peluang' : 'Tambah Peluang'} size="lg"
 footer={<><Button variant="outline" onClick={() => setModal(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="No Peluang" required><Input value={form.opp_no} onChange={e => setForm({ ...form, opp_no: e.target.value })} /></Field>
 <Field label="Judul Peluang" required className="sm:col-span-2"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
 <Field label="Pelanggan" required><Select value={form.customer_id} options={customers.map(c => ({ value: c.id, label: c.name }))} onChange={(e: any) => setForm({ ...form, customer_id: e.target.value })} /></Field>
 <Field label="Tahap"><Select value={form.stage} options={PIPELINE_STAGES} onChange={(e: any) => setForm({ ...form, stage: e.target.value })} /></Field>
 <Field label="Nilai Perkiraan"><Money value={form.estimated_value} onChange={(v: number) => setForm({ ...form, estimated_value: v })} /></Field>
 <Field label="Probabilitas (%)"><Input type="number" min={0} max={100} value={form.probability_percent} onChange={e => setForm({ ...form, probability_percent: e.target.value })} /></Field>
 <Field label="Tenggat Penyerahan"><Input type="date" value={form.submit_deadline ?? ''} onChange={e => setForm({ ...form, submit_deadline: e.target.value })} /></Field>
 <Field label="Tanggal Keputusan"><Input type="date" value={form.decision_date ?? ''} onChange={e => setForm({ ...form, decision_date: e.target.value })} /></Field>
 <Field label="Pemilik (PIC)"><Select value={form.owner_id} options={owners.map(o => ({ value: o.id, label: o.full_name }))} onChange={(e: any) => setForm({ ...form, owner_id: e.target.value })} /></Field>
 <Field label="Jenis Peluang"><Select value={form.opportunity_type} options={OPPORTUNITY_TYPE_OPTIONS} onChange={(e: any) => setForm({ ...form, opportunity_type: e.target.value })} /></Field>
 <Field label="Sumber"><Select value={form.source} options={OPPORTUNITY_SOURCE_OPTIONS} onChange={(e: any) => setForm({ ...form, source: e.target.value })} /></Field>
 <Field label="Catatan Pesaing"><Input value={form.competitor_note ?? ''} onChange={e => setForm({ ...form, competitor_note: e.target.value })} /></Field>
 {form.stage === 'kalah' && (
 <Field label="Alasan Kalah" required className="sm:col-span-2"><Textarea value={form.lost_reason ?? ''} onChange={e => setForm({ ...form, lost_reason: e.target.value })} /></Field>
 )}
 <Field label="Catatan" className="sm:col-span-2"><Textarea value={form.note ?? ''} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
 </div>
 </Modal>

 {/* ---------------- Drawer detail peluang ---------------- */}
 <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.title} width="max-w-2xl"
 footer={detail && (
 <div className="flex flex-wrap justify-end gap-2 w-full">
 {detail.stage === 'menang' && writable && <Button variant="success" onClick={openJadikanKontrak}>Jadikan Kontrak</Button>}
 {writable && <Button variant="outline" onClick={() => openEdit(detail)}>Ubah</Button>}
 {approver && <Button variant="danger" onClick={() => setDelId(detail.id)}>Hapus</Button>}
 </div>
 )}>
 {detail && (
 <>
 <div className="grid grid-cols-2 gap-3 mb-4">
 <div><p className="text-caption text-ink-400">No Peluang</p><p className="text-body font-medium">{detail.opp_no}</p></div>
 <div><p className="text-caption text-ink-400">Tahap</p><Badge>{PIPELINE_STAGE_LABEL[detail.stage] ?? detail.stage}</Badge></div>
 <div><p className="text-caption text-ink-400">Pelanggan</p><p className="text-body">{custMap[detail.customer_id] ?? '-'}</p></div>
 <div><p className="text-caption text-ink-400">Pemilik</p><p className="text-body">{ownerMap[detail.owner_id] ?? '-'}</p></div>
 <div><p className="text-caption text-ink-400">Nilai Perkiraan</p><p className="text-body tabular">{rupiah(detail.estimated_value)}</p></div>
 <div><p className="text-caption text-ink-400">Probabilitas</p><p className="text-body">{pct(detail.probability_percent, 0)}</p></div>
 <div><p className="text-caption text-ink-400">Tenggat Penyerahan</p><p className="text-body">{tgl(detail.submit_deadline)}</p></div>
 <div><p className="text-caption text-ink-400">Tanggal Keputusan</p><p className="text-body">{tgl(detail.decision_date)}</p></div>
 <div><p className="text-caption text-ink-400">Jenis Peluang</p><p className="text-body">{OPPORTUNITY_TYPE_OPTIONS.find(o => o.value === detail.opportunity_type)?.label ?? '-'}</p></div>
 <div><p className="text-caption text-ink-400">Sumber</p><p className="text-body">{detail.source ?? '-'}</p></div>
 </div>
 {detail.competitor_note && <div className="mb-3"><p className="text-caption text-ink-400">Catatan Pesaing</p><p className="text-body">{detail.competitor_note}</p></div>}
 {detail.stage === 'kalah' && detail.lost_reason && (
 <Card className="mb-4 p-3 bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-900">
 <p className="text-caption text-red-600 dark:text-red-300 font-medium">Alasan Kalah</p>
 <p className="text-body text-ink-700">{detail.lost_reason}</p>
 </Card>)}
 {detail.note && <div className="mb-4"><p className="text-caption text-ink-400">Catatan</p><p className="text-body">{detail.note}</p></div>}

 <h4 className="font-display font-semibold text-[13px] uppercase tracking-wide text-ink-500 mb-2">Catat Aktivitas</h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
 <Field label="Tanggal"><Input type="date" value={actForm.activity_date} onChange={e => setActForm({ ...actForm, activity_date: e.target.value })} /></Field>
 <Field label="Jenis Aktivitas"><Select value={actForm.activity_type} options={OPPORTUNITY_ACTIVITY_TYPES} onChange={(e: any) => setActForm({ ...actForm, activity_type: e.target.value })} /></Field>
 </div>
 <Field label="Catatan Aktivitas"><Textarea value={actForm.note} onChange={e => setActForm({ ...actForm, note: e.target.value })} placeholder="Ringkasan hasil pertemuan / tindak lanjut…" /></Field>
 <div className="flex justify-end mt-2 mb-5"><Button size="sm" loading={actSaving} onClick={addActivity}>Tambah Aktivitas</Button></div>

 <h4 className="font-display font-semibold text-[13px] uppercase tracking-wide text-ink-500 mb-3">Timeline Aktivitas</h4>
 {actLoading ? <TableSkeleton rows={3} /> : activities.length === 0 ? <EmptyState title="Belum ada aktivitas tercatat" /> : (
 <Timeline items={activities.map(a => ({ title: a.activity_type ?? 'Aktivitas', note: a.note, time: tgl(a.activity_date) }))} />
 )}
 </>
 )}
 </Drawer>

 {/* ---------------- Modal Jadikan Kontrak ---------------- */}
 <Modal open={ktrModal} onClose={() => setKtrModal(false)} title="Jadikan Kontrak" subtitle="Data terisi otomatis dari peluang yang menang." size="md"
 footer={<><Button variant="outline" onClick={() => setKtrModal(false)}>Batal</Button><Button loading={ktrSaving} onClick={saveKontrak}>Buat Kontrak</Button></>}>
 {ktrForm && (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="Nama Kontrak" required className="sm:col-span-2"><Input value={ktrForm.contract_name} onChange={e => setKtrForm({ ...ktrForm, contract_name: e.target.value })} /></Field>
 <Field label="Pelanggan" required><Select value={ktrForm.customer_id} options={customers.map(c => ({ value: c.id, label: c.name }))} onChange={(e: any) => setKtrForm({ ...ktrForm, customer_id: e.target.value })} /></Field>
 <Field label="Jenis Kontrak"><Select value={ktrForm.contract_type} options={CONTRACT_TYPE_OPTIONS} onChange={(e: any) => setKtrForm({ ...ktrForm, contract_type: e.target.value })} /></Field>
 <Field label="Tanggal Mulai"><Input type="date" value={ktrForm.start_date} onChange={e => setKtrForm({ ...ktrForm, start_date: e.target.value })} /></Field>
 <Field label="Tanggal Berakhir"><Input type="date" value={ktrForm.end_date} onChange={e => setKtrForm({ ...ktrForm, end_date: e.target.value })} /></Field>
 <Field label="Nilai Kontrak"><Money value={ktrForm.contract_value} onChange={(v: number) => setKtrForm({ ...ktrForm, contract_value: v })} /></Field>
 <Field label="Retensi (%)"><Input type="number" value={ktrForm.retention_percent} onChange={e => setKtrForm({ ...ktrForm, retention_percent: e.target.value })} /></Field>
 <Field label="PIC Internal" className="sm:col-span-2"><Select value={ktrForm.pic_id} options={owners.map(o => ({ value: o.id, label: o.full_name }))} onChange={(e: any) => setKtrForm({ ...ktrForm, pic_id: e.target.value })} /></Field>
 <p className="text-caption text-ink-400 sm:col-span-2">Kontrak dibuat berstatus draft. Lengkapi price list, SLA, dan berkas kontrak pada menu <button className="text-primary-600 underline" onClick={() => navigate('/commerce/kontrak')}>Kontrak</button>.</p>
 </div>
 )}
 </Modal>

 <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={doDelete} danger
 title="Hapus Peluang" message="Peluang beserta riwayat aktivitasnya akan dihapus permanen. Lanjutkan?" confirmLabel="Ya, Hapus" />
 </div>
 )
}
