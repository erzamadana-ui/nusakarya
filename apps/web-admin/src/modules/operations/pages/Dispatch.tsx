import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, update } from '@/lib/db'
import { PageHeader, Card, CardHeader, Badge, Button, Modal, Field, Select, Input, Textarea, useToast, EmptyState, TableSkeleton } from '@/components/ui'
import { tglJam } from '@/lib/format'
import { WO_STATUSES, WO_TYPES } from '../lib/constants'

export default function Dispatch() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const writable = can('OPERATIONS', 'write')

 const [loading, setLoading] = useState(true)
 const [wos, setWos] = useState<any[]>([])
 const [technicians, setTechnicians] = useState<any[]>([])

 const [assignOpen, setAssignOpen] = useState<any>(null)
 const [assignTo, setAssignTo] = useState('')
 const [assignAt, setAssignAt] = useState('')
 const [failOpen, setFailOpen] = useState<any>(null)
 const [failReason, setFailReason] = useState('')

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

 async function load() {
 setLoading(true)
 try {
 const [w, t] = await Promise.all([
 list('work_orders', { eq: { company_id: profile!.company_id }, order: { col: 'scheduled_at', asc: true }, limit: 500 }),
 list('employees', { select: 'id,full_name,position', eq: { company_id: profile!.company_id }, ilike: { col: 'position', value: 'teknisi' }, order: { col: 'full_name', asc: true } }),
 ])
 setWos(w); setTechnicians(t)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat papan dispatch', 'error') }
 finally { setLoading(false) }
 }

 const empName = (id?: string) => technicians.find(t => t.id === id)?.full_name ?? '-'
 const workload = useMemo(() => {
 const m: Record<string, number> = {}
 wos.filter(w => ['ditugaskan', 'dikerjakan'].includes(w.status) && w.assigned_to).forEach(w => { m[w.assigned_to] = (m[w.assigned_to] ?? 0) + 1 })
 return m
 }, [wos])

 const byStatus = (s: string) => wos.filter(w => w.status === s)

 function openAssign(wo: any) { setAssignOpen(wo); setAssignTo(wo.assigned_to || ''); setAssignAt(wo.scheduled_at ? wo.scheduled_at.slice(0, 16) : '') }
 async function submitAssign() {
 if (!assignTo) { toast.push('Pilih teknisi terlebih dahulu', 'error'); return }
 try {
 await update('work_orders', assignOpen.id, {
 assigned_to: assignTo, status: 'ditugaskan', assigned_at: new Date().toISOString(),
 scheduled_at: assignAt ? new Date(assignAt).toISOString() : assignOpen.scheduled_at,
 })
 toast.push('Work order berhasil ditugaskan', 'success'); setAssignOpen(null); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menugaskan work order', 'error') }
 }

 async function startWork(wo: any) {
 try { await update('work_orders', wo.id, { status: 'dikerjakan', started_at: new Date().toISOString() }); toast.push('Pengerjaan dimulai', 'success'); await load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status', 'error') }
 }
 async function finishWork(wo: any) {
 try {
 const finished = new Date()
 const dur = wo.started_at ? Math.max(0, Math.round((finished.getTime() - new Date(wo.started_at).getTime()) / 60000)) : null
 await update('work_orders', wo.id, { status: 'selesai', finished_at: finished.toISOString(), duration_minutes: dur })
 toast.push('Work order ditandai selesai', 'success'); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status', 'error') }
 }
 async function submitFail() {
 if (!failReason.trim()) { toast.push('Alasan kegagalan wajib diisi', 'error'); return }
 try {
 await update('work_orders', failOpen.id, { status: 'gagal', fail_reason: failReason.trim(), finished_at: new Date().toISOString() })
 toast.push('Work order ditandai gagal', 'success'); setFailOpen(null); setFailReason(''); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status', 'error') }
 }

 return (
 <div>
 <PageHeader title="Papan Dispatch" subtitle="Penugasan & status pengerjaan work order lapangan" />

 <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
 <div className="overflow-x-auto">
 <div className="flex gap-3 min-w-[1100px] pb-2">
 {WO_STATUSES.map(col => (
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
 {wo.status === 'belum_ditugaskan' && <Button size="sm" variant="outline" onClick={() => openAssign(wo)}>Tugaskan</Button>}
 {wo.status === 'ditugaskan' && <>
 <Button size="sm" variant="outline" onClick={() => openAssign(wo)}>Ubah</Button>
 <Button size="sm" onClick={() => startWork(wo)}>Mulai</Button>
 </>}
 {wo.status === 'dikerjakan' && <>
 <Button size="sm" variant="success" onClick={() => finishWork(wo)}>Selesai</Button>
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
 <CardHeader title="Teknisi Aktif" subtitle="Beban kerja WO berjalan hari ini" />
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
 </div>
 )
}
