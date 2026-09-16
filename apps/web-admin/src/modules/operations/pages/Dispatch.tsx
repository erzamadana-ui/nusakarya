import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, update, insert, nextDocNo } from '@/lib/db'
import { PageHeader, Card, CardHeader, Badge, Button, Modal, Field, Select, Input, Textarea, useToast, EmptyState, TableSkeleton, Plus } from '@/components/ui'
import { tglJam } from '@/lib/format'
import { WO_STATUSES, WO_TYPES } from '../lib/constants'
import { WO_STATUS, WO_STATUS_BERBEBAN } from '../lib/status'

/** Papan dispatch — semua kolom kecuali 'Dibatalkan' (jarang dipakai dari papan, tidak perlu bikin ramai). */
const BOARD_STATUSES = WO_STATUSES.filter(s => s.value !== WO_STATUS.CANCELLED)

function newWoForm() {
 return {
 wo_type: '', ticket_id: '', project_id: '', spk_id: '', job_type_id: '', title: '',
 customer_name: '', customer_no: '', address: '', branch_id: '', scheduled_at: '', assigned_to: '', description: '',
 }
}

export default function Dispatch() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const writable = can('OPERATIONS', 'write')

 const [loading, setLoading] = useState(true)
 const [wos, setWos] = useState<any[]>([])
 const [technicians, setTechnicians] = useState<any[]>([])
 const [branches, setBranches] = useState<any[]>([])
 const [openTickets, setOpenTickets] = useState<any[]>([])
 const [projects, setProjects] = useState<any[]>([])
 const [spkList, setSpkList] = useState<any[]>([])
 const [jobTypes, setJobTypes] = useState<any[]>([])

 const [assignOpen, setAssignOpen] = useState<any>(null)
 const [assignTo, setAssignTo] = useState('')
 const [assignAt, setAssignAt] = useState('')
 const [failOpen, setFailOpen] = useState<any>(null)
 const [failReason, setFailReason] = useState('')

 const [newOpen, setNewOpen] = useState(false)
 const [newForm, setNewForm] = useState<any>(newWoForm())
 const [newSaving, setNewSaving] = useState(false)

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

 async function load() {
 setLoading(true)
 try {
 const [w, t, br, tk, pr, sp, jt] = await Promise.all([
 list('work_orders', { eq: { company_id: profile!.company_id }, order: { col: 'scheduled_at', asc: true }, limit: 500 }),
 list('employees', { select: 'id,full_name,position', eq: { company_id: profile!.company_id }, ilike: { col: 'position', value: 'teknisi' }, order: { col: 'full_name', asc: true } }),
 list('branches', { select: 'id,name', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
 list('tickets', { select: 'id,ticket_no,customer_name,branch_id', eq: { company_id: profile!.company_id }, order: { col: 'reported_at', asc: false }, limit: 500 }),
 list('projects', { select: 'id,project_code,project_name,branch_id', eq: { company_id: profile!.company_id }, order: { col: 'project_code', asc: true } }),
 list('spk', { select: 'id,spk_no,title', eq: { company_id: profile!.company_id }, order: { col: 'spk_no', asc: true } }),
 list('job_types', { select: 'id,name', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
 ])
 setWos(w); setTechnicians(t); setBranches(br); setOpenTickets(tk); setProjects(pr); setSpkList(sp); setJobTypes(jt)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat papan dispatch', 'error') }
 finally { setLoading(false) }
 }

 const empName = (id?: string) => technicians.find(t => t.id === id)?.full_name ?? '-'
 const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'
 const workload = useMemo(() => {
 const m: Record<string, number> = {}
 wos.filter(w => WO_STATUS_BERBEBAN.includes(w.status) && w.assigned_to).forEach(w => { m[w.assigned_to] = (m[w.assigned_to] ?? 0) + 1 })
 return m
 }, [wos])

 const byStatus = (s: string) => wos.filter(w => w.status === s)

 /* ---------------- Tugaskan (draft/dispatched → dispatched) ---------------- */
 function openAssign(wo: any) { setAssignOpen(wo); setAssignTo(wo.assigned_to || ''); setAssignAt(wo.scheduled_at ? wo.scheduled_at.slice(0, 16) : '') }
 async function submitAssign() {
 if (!assignTo) { toast.push('Pilih teknisi terlebih dahulu', 'error'); return }
 try {
 await update('work_orders', assignOpen.id, {
 assigned_to: assignTo, status: WO_STATUS.DISPATCHED, assigned_at: new Date().toISOString(),
 scheduled_at: assignAt ? new Date(assignAt).toISOString() : assignOpen.scheduled_at,
 })
 toast.push('Work order berhasil ditugaskan', 'success'); setAssignOpen(null); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menugaskan work order', 'error') }
 }

 /* ---------------- Diterima teknisi (dispatched → accepted) ---------------- */
 async function acceptWork(wo: any) {
 try { await update('work_orders', wo.id, { status: WO_STATUS.ACCEPTED }); toast.push('Work order ditandai diterima teknisi', 'success'); await load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status', 'error') }
 }

 /* ---------------- Mulai (accepted → on_progress) ---------------- */
 async function startWork(wo: any) {
 try { await update('work_orders', wo.id, { status: WO_STATUS.ON_PROGRESS, started_at: new Date().toISOString() }); toast.push('Pengerjaan dimulai', 'success'); await load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status', 'error') }
 }

 /* ---------------- Tunda material (on_progress ⇄ pending_material) ---------------- */
 async function holdMaterial(wo: any) {
 try { await update('work_orders', wo.id, { status: WO_STATUS.PENDING_MATERIAL }); toast.push('Work order ditunda — menunggu material', 'success'); await load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status', 'error') }
 }
 async function resumeFromMaterial(wo: any) {
 try { await update('work_orders', wo.id, { status: WO_STATUS.ON_PROGRESS }); toast.push('Pengerjaan dilanjutkan', 'success'); await load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status', 'error') }
 }

 /* ---------------- Selesai (on_progress → done) — memicu trigger productivity_entries ---------------- */
 async function finishWork(wo: any) {
 try {
 const finished = new Date()
 const dur = wo.started_at ? Math.max(0, Math.round((finished.getTime() - new Date(wo.started_at).getTime()) / 60000)) : null
 await update('work_orders', wo.id, { status: WO_STATUS.DONE, finished_at: finished.toISOString(), duration_minutes: dur })
 toast.push('Work order ditandai selesai', 'success'); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status', 'error') }
 }

 /* ---------------- Gagal (on_progress/pending_material → failed) ---------------- */
 async function submitFail() {
 if (!failReason.trim()) { toast.push('Alasan kegagalan wajib diisi', 'error'); return }
 try {
 await update('work_orders', failOpen.id, { status: WO_STATUS.FAILED, fail_reason: failReason.trim(), finished_at: new Date().toISOString() })
 toast.push('Work order ditandai gagal', 'success'); setFailOpen(null); setFailReason(''); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status', 'error') }
 }

 /* ---------------- Work Order Baru langsung dari papan ---------------- */
 function openNewWo() { setNewForm(newWoForm()); setNewOpen(true) }
 async function submitNewWo() {
 if (!newForm.wo_type || !newForm.title || !newForm.customer_name || !newForm.branch_id || !newForm.job_type_id) {
 toast.push('Lengkapi jenis, judul, pelanggan, cabang dan jenis pekerjaan (job type) terlebih dahulu', 'error'); return
 }
 setNewSaving(true)
 try {
 const woNo = await nextDocNo(profile!.company_id, 'WO')
 const willAssign = !!newForm.assigned_to
 await insert('work_orders', {
 company_id: profile!.company_id, wo_no: woNo, wo_type: newForm.wo_type,
 ticket_id: newForm.ticket_id || null, project_id: newForm.project_id || null,
 spk_id: newForm.spk_id || null, job_type_id: newForm.job_type_id || null,
 title: newForm.title, description: newForm.description || null,
 customer_name: newForm.customer_name, customer_no: newForm.customer_no || null,
 address: newForm.address || null, branch_id: newForm.branch_id,
 scheduled_at: newForm.scheduled_at ? new Date(newForm.scheduled_at).toISOString() : null,
 assigned_to: newForm.assigned_to || null, assigned_at: willAssign ? new Date().toISOString() : null,
 status: willAssign ? WO_STATUS.DISPATCHED : WO_STATUS.DRAFT, qc_status: 'belum', created_by: profile!.id,
 })
 toast.push(`Work order ${woNo} berhasil dibuat`, 'success'); setNewOpen(false); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal membuat work order', 'error') }
 finally { setNewSaving(false) }
 }

 return (
 <div>
 <PageHeader title="Papan Dispatch" subtitle="Penugasan & status pengerjaan work order lapangan"
 actions={writable && <Button icon={<Plus size={16} />} onClick={openNewWo}>Work Order Baru</Button>} />

 <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
 <div className="overflow-x-auto">
 <div className="flex gap-3 min-w-[1540px] pb-2">
 {BOARD_STATUSES.map(col => (
 <div key={col.value} className="flex-1 min-w-[220px]">
 <div className="flex items-center justify-between px-1 mb-2">
 <h4 className="font-display font-semibold text-body text-ink-700">{col.label}</h4>
 <Badge tone={col.tone}>{byStatus(col.value).length}</Badge>
 </div>
 <div className="space-y-2 bg-ink-50 rounded-md p-2 min-h-[200px]">
 {loading ? <TableSkeleton rows={3} /> : byStatus(col.value).length === 0 ? (
 <p className="text-caption text-ink-400 text-center py-6">Tidak ada work order.</p>
 ) : byStatus(col.value).map(wo => (
 <Card key={wo.id} className="p-3">
 <div className="flex items-center justify-between mb-1">
 <span className="font-medium text-body text-ink-900">{wo.wo_no}</span>
 <Badge tone="teal">{WO_TYPES.find(t => t.value === wo.wo_type)?.label ?? wo.wo_type}</Badge>
 </div>
 <p className="text-body text-ink-700">{wo.customer_name || '-'}</p>
 <p className="text-caption text-ink-400 truncate">{wo.address || '-'}</p>
 <p className="text-caption text-ink-500 mt-1">Teknisi: {empName(wo.assigned_to)}</p>
 <p className="text-caption text-ink-400">{wo.scheduled_at ? tglJam(wo.scheduled_at) : 'Belum dijadwalkan'}</p>
 {writable && (
 <div className="flex flex-wrap gap-1.5 mt-2">
 {wo.status === WO_STATUS.DRAFT && <Button size="sm" variant="outline" onClick={() => openAssign(wo)}>Tugaskan</Button>}
 {wo.status === WO_STATUS.DISPATCHED && <>
 <Button size="sm" variant="outline" onClick={() => openAssign(wo)}>Ubah</Button>
 <Button size="sm" onClick={() => acceptWork(wo)}>Tandai Diterima</Button>
 </>}
 {wo.status === WO_STATUS.ACCEPTED && <Button size="sm" onClick={() => startWork(wo)}>Mulai</Button>}
 {wo.status === WO_STATUS.ON_PROGRESS && <>
 <Button size="sm" variant="outline" onClick={() => holdMaterial(wo)}>Tunda (Material)</Button>
 <Button size="sm" variant="success" onClick={() => finishWork(wo)}>Selesai</Button>
 <Button size="sm" variant="danger" onClick={() => setFailOpen(wo)}>Gagal</Button>
 </>}
 {wo.status === WO_STATUS.PENDING_MATERIAL && <>
 <Button size="sm" onClick={() => resumeFromMaterial(wo)}>Lanjutkan</Button>
 <Button size="sm" variant="danger" onClick={() => setFailOpen(wo)}>Gagal</Button>
 </>}
 </div>)}
 </Card>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>

 <Card className="h-fit">
 <CardHeader title="Teknisi Aktif" subtitle="Beban kerja WO berjalan (ditugaskan/diterima/dikerjakan/tunda material)" />
 <div className="p-2">
 {loading ? <TableSkeleton rows={5} /> : technicians.length === 0 ? <EmptyState title="Belum ada teknisi" /> : (
 <ul className="divide-y divide-ink-200">
 {technicians.map(t => (
 <li key={t.id} className="flex items-center justify-between px-2 py-2.5">
 <div>
 <p className="text-body text-ink-800">{t.full_name}</p>
 <p className="text-caption text-ink-400">{t.position}</p>
 </div>
 <Badge tone={(workload[t.id] ?? 0) > 3 ? 'orange' : 'blue'}>{workload[t.id] ?? 0} WO</Badge>
 </li>))}
 </ul>)}
 </div>
 </Card>
 </div>

 <Modal open={!!assignOpen} onClose={() => setAssignOpen(null)} title={`Tugaskan Work Order — ${assignOpen?.wo_no ?? ''}`}
 footer={<><Button variant="outline" onClick={() => setAssignOpen(null)}>Batal</Button><Button onClick={submitAssign}>Tugaskan</Button></>}>
 <div className="space-y-4">
 <Field label="Teknisi" required><Select options={technicians.map(t => ({ value: t.id, label: `${t.full_name} (${workload[t.id] ?? 0} WO berjalan)` }))} value={assignTo} onChange={(e: any) => setAssignTo(e.target.value)} /></Field>
 <Field label="Jadwal Pengerjaan"><Input type="datetime-local" value={assignAt} onChange={(e: any) => setAssignAt(e.target.value)} /></Field>
 </div>
 </Modal>

 <Modal open={!!failOpen} onClose={() => setFailOpen(null)} title={`Tandai Gagal — ${failOpen?.wo_no ?? ''}`}
 footer={<><Button variant="outline" onClick={() => setFailOpen(null)}>Batal</Button><Button variant="danger" onClick={submitFail}>Tandai Gagal</Button></>}>
 <Field label="Alasan Kegagalan" required><Textarea value={failReason} onChange={(e: any) => setFailReason(e.target.value)} /></Field>
 </Modal>

 <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Work Order Baru dari Papan Dispatch" size="lg"
 footer={<><Button variant="outline" onClick={() => setNewOpen(false)}>Batal</Button><Button loading={newSaving} onClick={submitNewWo}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="No WO"><Input value="Otomatis saat disimpan (WO/…)" disabled /></Field>
 <Field label="Jenis" required><Select options={WO_TYPES} value={newForm.wo_type} onChange={(e: any) => setNewForm({ ...newForm, wo_type: e.target.value })} /></Field>
 <Field label="Judul Pekerjaan" required className="sm:col-span-2"><Input value={newForm.title} onChange={(e: any) => setNewForm({ ...newForm, title: e.target.value })} /></Field>
 <Field label="Tiket Terkait" hint="Opsional — tautkan bila WO ini berasal dari tiket gangguan."><Select options={openTickets.map(t => ({ value: t.id, label: `${t.ticket_no} — ${t.customer_name ?? ''}` }))} value={newForm.ticket_id} onChange={(e: any) => setNewForm({ ...newForm, ticket_id: e.target.value })} /></Field>
 <Field label="Proyek Terkait" hint="Opsional — untuk WO deployment/proyek."><Select options={projects.map(p => ({ value: p.id, label: `${p.project_code} — ${p.project_name}` }))} value={newForm.project_id} onChange={(e: any) => setNewForm({ ...newForm, project_id: e.target.value })} /></Field>
 <Field label="SPK Terkait" hint="Opsional."><Select options={spkList.map(s => ({ value: s.id, label: `${s.spk_no} — ${s.title}` }))} value={newForm.spk_id} onChange={(e: any) => setNewForm({ ...newForm, spk_id: e.target.value })} /></Field>
 <Field label="Jenis Pekerjaan (Job Type)" required hint="Wajib diisi — dipakai perhitungan poin/tarif produktivitas teknisi saat WO ditandai Selesai (tanpa ini, penandaan Selesai akan ditolak basis data untuk WO yang sudah ditugaskan)."><Select options={jobTypes.map(j => ({ value: j.id, label: j.name }))} value={newForm.job_type_id} onChange={(e: any) => setNewForm({ ...newForm, job_type_id: e.target.value })} /></Field>
 <Field label="Nama Pelanggan" required><Input value={newForm.customer_name} onChange={(e: any) => setNewForm({ ...newForm, customer_name: e.target.value })} /></Field>
 <Field label="No Pelanggan"><Input value={newForm.customer_no} onChange={(e: any) => setNewForm({ ...newForm, customer_no: e.target.value })} /></Field>
 <Field label="Cabang" required><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={newForm.branch_id} onChange={(e: any) => setNewForm({ ...newForm, branch_id: e.target.value })} /></Field>
 <Field label="Jadwal Pengerjaan"><Input type="datetime-local" value={newForm.scheduled_at} onChange={(e: any) => setNewForm({ ...newForm, scheduled_at: e.target.value })} /></Field>
 <Field label="Alamat" className="sm:col-span-2"><Textarea value={newForm.address} onChange={(e: any) => setNewForm({ ...newForm, address: e.target.value })} /></Field>
 <Field label="Teknisi" hint="Opsional — bila dipilih, WO langsung berstatus Ditugaskan."><Select options={technicians.map(t => ({ value: t.id, label: `${t.full_name} (${workload[t.id] ?? 0} WO berjalan)` }))} value={newForm.assigned_to} onChange={(e: any) => setNewForm({ ...newForm, assigned_to: e.target.value })} /></Field>
 <Field label="Deskripsi" className="sm:col-span-2"><Textarea value={newForm.description} onChange={(e: any) => setNewForm({ ...newForm, description: e.target.value })} /></Field>
 </div>
 </Modal>
 </div>
 )
}
