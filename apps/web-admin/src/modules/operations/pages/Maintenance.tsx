import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, uploadFile } from '@/lib/db'
import {
 PageHeader, Card, CardHeader, DataTable, Badge, Button, Modal, Field, Input, Select, Textarea,
 Checkbox, ConfirmDialog, useToast, Plus,
} from '@/components/ui'
import { tgl, todayISO } from '@/lib/format'
import { MAINT_TYPES, MAINT_FREQ } from '../lib/constants'

function newPlanForm() {
 return { plan_no: '', plan_name: '', plan_type: 'preventive', frequency: 'bulanan', branch_id: '', network_element_id: '', next_due_date: todayISO(), assigned_to: '', is_active: true }
}

function advanceDate(d: Date, freq: string): Date {
 const n = new Date(d)
 if (freq === 'harian') n.setDate(n.getDate() + 1)
 else if (freq === 'mingguan') n.setDate(n.getDate() + 7)
 else if (freq === 'triwulan') n.setMonth(n.getMonth() + 3)
 else if (freq === 'tahunan') n.setFullYear(n.getFullYear() + 1)
 else n.setMonth(n.getMonth() + 1)
 return n
}
function effectiveStatus(t: any): string {
 if (t.status === 'terjadwal' && t.task_date && t.task_date < todayISO()) return 'terlewat'
 return t.status
}

export default function Maintenance() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const writable = can('OPERATIONS', 'write')

 const [loading, setLoading] = useState(true)
 const [plans, setPlans] = useState<any[]>([])
 const [tasks, setTasks] = useState<any[]>([])
 const [branches, setBranches] = useState<any[]>([])
 const [elements, setElements] = useState<any[]>([])
 const [technicians, setTechnicians] = useState<any[]>([])
 const [generating, setGenerating] = useState(false)

 const [planOpen, setPlanOpen] = useState(false)
 const [planForm, setPlanForm] = useState<any>(newPlanForm())
 const [editingPlan, setEditingPlan] = useState<any>(null)
 const [toggleConfirm, setToggleConfirm] = useState<any>(null)
 const [saving, setSaving] = useState(false)

 const [taskOpen, setTaskOpen] = useState<any>(null)
 const [taskForm, setTaskForm] = useState({ findings: '', files: [] as File[] })

 const [newTaskOpen, setNewTaskOpen] = useState(false)
 const [newTaskForm, setNewTaskForm] = useState({ plan_id: '', task_date: todayISO(), assigned_to: '', note: '' })
 const [newTaskSaving, setNewTaskSaving] = useState(false)

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

 async function load() {
 setLoading(true)
 try {
 const [pl, tk, br, el, emp] = await Promise.all([
 list('maintenance_plans', { eq: { company_id: profile!.company_id }, order: { col: 'next_due_date', asc: true } }),
 list('maintenance_tasks', { eq: { company_id: profile!.company_id }, order: { col: 'task_date', asc: true }, limit: 1000 }),
 list('branches', { select: 'id,name', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
 list('network_elements', { select: 'id,code,name,element_type,branch_id', eq: { company_id: profile!.company_id }, order: { col: 'code', asc: true } }),
 list('employees', { select: 'id,full_name,position', eq: { company_id: profile!.company_id }, ilike: { col: 'position', value: 'teknisi' }, order: { col: 'full_name', asc: true } }),
 ])
 setPlans(pl); setTasks(tk); setBranches(br); setElements(el); setTechnicians(emp)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data maintenance', 'error') }
 finally { setLoading(false) }
 }

 const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'
 const elName = (id?: string) => { const e = elements.find(x => x.id === id); return e ? `${e.element_type} · ${e.code}` : '-' }
 const empName = (id?: string) => technicians.find(t => t.id === id)?.full_name ?? '-'
 const planName = (id?: string) => plans.find(p => p.id === id)?.plan_name ?? '-'

 const tasksThisMonth = useMemo(() => {
 const now = new Date()
 const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
 return tasks.filter(t => t.task_date && String(t.task_date).startsWith(ym))
 }, [tasks])

 /* ---------------- Rencana ---------------- */
 function openNewPlan() { setEditingPlan(null); setPlanForm(newPlanForm()); setPlanOpen(true) }
 function openEditPlan(p: any) { setEditingPlan(p); setPlanForm({ ...p }); setPlanOpen(true) }
 async function submitPlan() {
 if (!planForm.plan_no || !planForm.plan_name || !planForm.branch_id) { toast.push('Lengkapi no rencana, nama, dan cabang', 'error'); return }
 setSaving(true)
 try {
 if (editingPlan) {
 await update('maintenance_plans', editingPlan.id, {
 plan_no: planForm.plan_no, plan_name: planForm.plan_name, plan_type: planForm.plan_type, frequency: planForm.frequency,
 branch_id: planForm.branch_id, network_element_id: planForm.network_element_id || null, next_due_date: planForm.next_due_date || null,
 assigned_to: planForm.assigned_to || null, is_active: planForm.is_active,
 })
 toast.push('Rencana maintenance diperbarui', 'success')
 } else {
 await insert('maintenance_plans', {
 company_id: profile!.company_id, plan_no: planForm.plan_no, plan_name: planForm.plan_name, plan_type: planForm.plan_type,
 frequency: planForm.frequency, branch_id: planForm.branch_id, network_element_id: planForm.network_element_id || null,
 next_due_date: planForm.next_due_date || null, assigned_to: planForm.assigned_to || null, is_active: true, created_by: profile!.id,
 })
 toast.push('Rencana maintenance dibuat', 'success')
 }
 setPlanOpen(false); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan rencana', 'error') }
 finally { setSaving(false) }
 }
 async function doToggle() {
 try { await update('maintenance_plans', toggleConfirm.id, { is_active: !toggleConfirm.is_active }); toast.push(toggleConfirm.is_active ? 'Rencana dinonaktifkan' : 'Rencana diaktifkan', 'success'); await load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status rencana', 'error') }
 }

 /* ---------------- Bangkitkan tugas ---------------- */
 async function generateTasks() {
 setGenerating(true)
 try {
 const now = new Date()
 const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
 const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
 const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
 let created = 0
 for (const p of plans.filter(p => p.is_active)) {
 if (!p.next_due_date) continue
 const due = new Date(p.next_due_date)
 if (due > monthEnd) continue
 const exists = tasks.some(t => t.plan_id === p.id && String(t.task_date).startsWith(ym))
 if (exists) continue
 const taskDate = due < monthStart ? monthStart : due
 await insert('maintenance_tasks', {
 company_id: profile!.company_id, plan_id: p.id, task_date: taskDate.toISOString().slice(0, 10),
 assigned_to: p.assigned_to || null, status: 'terjadwal', created_by: profile!.id,
 })
 const next = advanceDate(due, p.frequency)
 await update('maintenance_plans', p.id, { next_due_date: next.toISOString().slice(0, 10) })
 created++
 }
 toast.push(created ? `${created} tugas berhasil dibangkitkan untuk periode ini` : 'Tidak ada rencana aktif yang jatuh tempo pada periode ini', created ? 'success' : 'info')
 await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal membangkitkan tugas', 'error') }
 finally { setGenerating(false) }
 }

 /* ---------------- Tugas manual (di luar rencana terjadwal otomatis) ---------------- */
 function openNewTask() { setNewTaskForm({ plan_id: '', task_date: todayISO(), assigned_to: '', note: '' }); setNewTaskOpen(true) }
 async function submitNewTask() {
 if (!newTaskForm.plan_id || !newTaskForm.task_date) { toast.push('Pilih rencana dan tanggal tugas terlebih dahulu', 'error'); return }
 setNewTaskSaving(true)
 try {
 await insert('maintenance_tasks', {
 company_id: profile!.company_id, plan_id: newTaskForm.plan_id, task_date: newTaskForm.task_date,
 assigned_to: newTaskForm.assigned_to || null, note: newTaskForm.note || null, status: 'terjadwal', created_by: profile!.id,
 })
 toast.push('Tugas maintenance manual berhasil dibuat', 'success'); setNewTaskOpen(false); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal membuat tugas maintenance', 'error') }
 finally { setNewTaskSaving(false) }
 }

 /* ---------------- Tugas ---------------- */
 async function startTask(t: any) {
 try { await update('maintenance_tasks', t.id, { status: 'berjalan', started_at: new Date().toISOString() }); toast.push('Tugas dimulai', 'success'); await load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status tugas', 'error') }
 }
 function openComplete(t: any) { setTaskOpen(t); setTaskForm({ findings: '', files: [] }) }
 async function submitComplete() {
 if (!taskForm.findings.trim()) { toast.push('Temuan wajib diisi', 'error'); return }
 setSaving(true)
 try {
 const paths: string[] = []
 for (const f of taskForm.files) paths.push(await uploadFile(profile!.company_id, 'maintenance', f))
 const existing = Array.isArray(taskOpen.photo_urls) ? taskOpen.photo_urls : []
 await update('maintenance_tasks', taskOpen.id, {
 status: 'selesai', finished_at: new Date().toISOString(), findings: taskForm.findings.trim(), photo_urls: [...existing, ...paths],
 })
 toast.push('Tugas maintenance ditandai selesai', 'success'); setTaskOpen(null); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyelesaikan tugas', 'error') }
 finally { setSaving(false) }
 }

 return (
 <div>
 <PageHeader title="Maintenance & Patroli" subtitle="Rencana preventive, patroli, pengukuran & perapihan jaringan" />

 <Card className="mb-5">
 <CardHeader title="Rencana Maintenance" action={writable && <Button size="sm" icon={<Plus size={14} />} onClick={openNewPlan}>Rencana Baru</Button>} />
 <DataTable
 loading={loading} rows={plans} searchKeys={['plan_no', 'plan_name']} emptyTitle="Belum ada rencana maintenance"
 columns={[
 { key: 'plan_no', header: 'No Rencana' },
 { key: 'plan_name', header: 'Nama Rencana' },
 { key: 'plan_type', header: 'Tipe', render: r => MAINT_TYPES.find(t => t.value === r.plan_type)?.label ?? r.plan_type },
 { key: 'frequency', header: 'Frekuensi', render: r => MAINT_FREQ.find(t => t.value === r.frequency)?.label ?? r.frequency },
 { key: 'branch_id', header: 'Cabang', render: r => branchName(r.branch_id) },
 { key: 'network_element_id', header: 'Elemen Sasaran', render: r => elName(r.network_element_id) },
 { key: 'next_due_date', header: 'Jatuh Tempo Berikutnya', render: r => tgl(r.next_due_date) },
 { key: 'is_active', header: 'Status', render: r => <Badge tone={r.is_active ? 'emerald' : 'zinc'}>{r.is_active ? 'Aktif' : 'Nonaktif'}</Badge> },
 {
 key: 'aksi', header: '', sortable: false, render: r => writable && (
 <div className="flex gap-1.5 justify-end">
 <Button size="sm" variant="outline" onClick={(e: any) => { e.stopPropagation(); openEditPlan(r) }}>Ubah</Button>
 <Button size="sm" variant={r.is_active ? 'danger' : 'success'} onClick={(e: any) => { e.stopPropagation(); setToggleConfirm(r) }}>{r.is_active ? 'Nonaktifkan' : 'Aktifkan'}</Button>
 </div>)
 },
 ]}
 />
 </Card>

 <Card>
 <CardHeader title="Tugas Terjadwal — Bulan Berjalan" action={writable && (
 <div className="flex gap-2">
 <Button size="sm" icon={<Plus size={14} />} onClick={openNewTask}>Tugas Manual</Button>
 <Button size="sm" variant="outline" loading={generating} onClick={generateTasks}>Bangkitkan Tugas Periode Ini</Button>
 </div>
 )} />
 <DataTable
 loading={loading} rows={tasksThisMonth} searchable={false} emptyTitle="Belum ada tugas bulan ini"
 emptyMessage='Gunakan tombol "Bangkitkan Tugas Periode Ini" untuk membuat tugas dari rencana aktif.'
 columns={[
 { key: 'task_date', header: 'Tanggal', render: r => tgl(r.task_date) },
 { key: 'plan_id', header: 'Rencana', render: r => planName(r.plan_id) },
 { key: 'assigned_to', header: 'Petugas', render: r => empName(r.assigned_to) },
 { key: 'status', header: 'Status', render: r => <Badge>{effectiveStatus(r)}</Badge> },
 { key: 'findings', header: 'Temuan', render: r => r.findings || '-' },
 {
 key: 'aksi', header: '', sortable: false, render: r => writable && effectiveStatus(r) !== 'selesai' && (
 <div className="flex gap-1.5 justify-end">
 {r.status === 'terjadwal' && <Button size="sm" variant="outline" onClick={() => startTask(r)}>Mulai</Button>}
 <Button size="sm" onClick={() => openComplete(r)}>Selesaikan</Button>
 </div>)
 },
 ]}
 />
 </Card>

 <Modal open={planOpen} onClose={() => setPlanOpen(false)} title={editingPlan ? 'Ubah Rencana Maintenance' : 'Rencana Maintenance Baru'} size="lg"
 footer={<><Button variant="outline" onClick={() => setPlanOpen(false)}>Batal</Button><Button loading={saving} onClick={submitPlan}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="No Rencana" required><Input value={planForm.plan_no} onChange={(e: any) => setPlanForm({ ...planForm, plan_no: e.target.value })} /></Field>
 <Field label="Nama Rencana" required><Input value={planForm.plan_name} onChange={(e: any) => setPlanForm({ ...planForm, plan_name: e.target.value })} /></Field>
 <Field label="Tipe" required><Select options={MAINT_TYPES} value={planForm.plan_type} onChange={(e: any) => setPlanForm({ ...planForm, plan_type: e.target.value })} /></Field>
 <Field label="Frekuensi" required><Select options={MAINT_FREQ} value={planForm.frequency} onChange={(e: any) => setPlanForm({ ...planForm, frequency: e.target.value })} /></Field>
 <Field label="Cabang" required><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={planForm.branch_id} onChange={(e: any) => setPlanForm({ ...planForm, branch_id: e.target.value, network_element_id: '' })} /></Field>
 <Field label="Elemen Jaringan Sasaran">
 <Select options={elements.filter(e => !planForm.branch_id || e.branch_id === planForm.branch_id).map(e => ({ value: e.id, label: `${e.element_type} · ${e.code} — ${e.name}` }))}
 value={planForm.network_element_id} onChange={(e: any) => setPlanForm({ ...planForm, network_element_id: e.target.value })} />
 </Field>
 <Field label="Petugas Penanggung Jawab"><Select options={technicians.map(t => ({ value: t.id, label: t.full_name }))} value={planForm.assigned_to} onChange={(e: any) => setPlanForm({ ...planForm, assigned_to: e.target.value })} /></Field>
 <Field label="Jatuh Tempo Berikutnya" required><Input type="date" value={planForm.next_due_date} onChange={(e: any) => setPlanForm({ ...planForm, next_due_date: e.target.value })} /></Field>
 {editingPlan && <Field label="Status"><Checkbox label="Rencana aktif" checked={planForm.is_active} onChange={(e: any) => setPlanForm({ ...planForm, is_active: e.target.checked })} /></Field>}
 </div>
 </Modal>

 <ConfirmDialog open={!!toggleConfirm} onClose={() => setToggleConfirm(null)} danger={toggleConfirm?.is_active}
 title={toggleConfirm?.is_active ? 'Nonaktifkan Rencana' : 'Aktifkan Rencana'}
 message={`Rencana "${toggleConfirm?.plan_name}" akan ${toggleConfirm?.is_active ? 'dinonaktifkan dan tidak lagi membangkitkan tugas baru' : 'diaktifkan kembali'}. Lanjutkan?`}
 onConfirm={doToggle} />

 <Modal open={!!taskOpen} onClose={() => setTaskOpen(null)} title={`Selesaikan Tugas — ${taskOpen ? tgl(taskOpen.task_date) : ''}`}
 footer={<><Button variant="outline" onClick={() => setTaskOpen(null)}>Batal</Button><Button loading={saving} variant="success" onClick={submitComplete}>Tandai Selesai</Button></>}>
 <div className="space-y-4">
 <Field label="Temuan" required><Textarea value={taskForm.findings} onChange={(e: any) => setTaskForm({ ...taskForm, findings: e.target.value })} /></Field>
 <Field label="Foto Dokumentasi">
 <input type="file" accept="image/*" multiple onChange={e => setTaskForm({ ...taskForm, files: Array.from(e.target.files ?? []) })} />
 </Field>
 </div>
 </Modal>

 <Modal open={newTaskOpen} onClose={() => setNewTaskOpen(false)} title="Tugas Maintenance Manual"
 footer={<><Button variant="outline" onClick={() => setNewTaskOpen(false)}>Batal</Button><Button loading={newTaskSaving} onClick={submitNewTask}>Simpan</Button></>}>
 <div className="space-y-4">
 <Field label="Rencana Maintenance" required hint="Tugas manual tetap harus tertaut ke rencana (kolom plan_id wajib diisi).">
 <Select options={plans.map(p => ({ value: p.id, label: `${p.plan_no} — ${p.plan_name}` }))} value={newTaskForm.plan_id} onChange={(e: any) => setNewTaskForm({ ...newTaskForm, plan_id: e.target.value })} />
 </Field>
 <Field label="Tanggal Tugas" required><Input type="date" value={newTaskForm.task_date} onChange={(e: any) => setNewTaskForm({ ...newTaskForm, task_date: e.target.value })} /></Field>
 <Field label="Petugas"><Select options={technicians.map(t => ({ value: t.id, label: t.full_name }))} value={newTaskForm.assigned_to} onChange={(e: any) => setNewTaskForm({ ...newTaskForm, assigned_to: e.target.value })} /></Field>
 <Field label="Catatan"><Textarea value={newTaskForm.note} onChange={(e: any) => setNewTaskForm({ ...newTaskForm, note: e.target.value })} /></Field>
 </div>
 </Modal>
 </div>
 )
}
