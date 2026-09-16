import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, uploadFile } from '@/lib/db'
import {
 PageHeader, DataTable, Badge, Button, Modal, Field, Select, Input, Textarea, Tabs, useToast, Plus,
} from '@/components/ui'
import { tgl } from '@/lib/format'
import { LEAVE_TYPE_OPTIONS, LEAVE_STATUS_TABS } from '../lib/constants'

const emptyForm = { employee_id: '', leave_type: 'Tahunan', start_date: '', end_date: '', reason: '' }

export default function Cuti() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [employees, setEmployees] = useState<any[]>([])
 const [tab, setTab] = useState('diajukan')

 const [modalOpen, setModalOpen] = useState(false)
 const [saving, setSaving] = useState(false)
 const [form, setForm] = useState<any>(emptyForm)
 const [file, setFile] = useState<File | null>(null)

 const [reject, setReject] = useState<any>(null)
 const [rejectReason, setRejectReason] = useState('')
 const [busyId, setBusyId] = useState<string | null>(null)

 useEffect(() => { load() }, [])

 async function load() {
 setLoading(true)
 try {
 const [lr, e] = await Promise.all([
 list<any>('leave_requests', { select: '*,employees(full_name,position)', order: { col: 'start_date', asc: false } }),
 list<any>('employees', { select: 'id,full_name,position', eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
 ])
 setRows(lr); setEmployees(e)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data cuti', 'error') }
 finally { setLoading(false) }
 }

 const filtered = useMemo(() => {
 if (tab === 'semua') return rows
 if (tab === 'diajukan') return rows.filter(r => r.status === 'diajukan' || r.status === 'draft')
 return rows.filter(r => r.status === tab)
 }, [rows, tab])

 function openAdd() { setForm(emptyForm); setFile(null); setModalOpen(true) }

 const days = useMemo(() => {
 if (!form.start_date || !form.end_date) return 0
 const d = (new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000
 return d >= 0 ? d + 1 : 0
 }, [form.start_date, form.end_date])

 async function save() {
 if (!form.employee_id || !form.start_date || !form.end_date) { toast.push('Karyawan, tanggal mulai, dan tanggal selesai wajib diisi', 'error'); return }
 if (form.end_date < form.start_date) { toast.push('Tanggal selesai tidak boleh mendahului tanggal mulai', 'error'); return }
 setSaving(true)
 try {
 let attachment_url: string | null = null
 if (file) attachment_url = await uploadFile(profile!.company_id, 'cuti', file)
 await insert('leave_requests', {
 company_id: profile?.company_id, employee_id: form.employee_id, leave_type: form.leave_type,
 start_date: form.start_date, end_date: form.end_date, days, reason: form.reason || null,
 attachment_url, status: 'diajukan', created_by: profile?.id,
 })
 toast.push('Pengajuan cuti dibuat'); setModalOpen(false); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal membuat pengajuan cuti', 'error') }
 finally { setSaving(false) }
 }

 async function approve(r: any) {
 setBusyId(r.id)
 try {
 await update('leave_requests', r.id, { status: 'disetujui', approved_by: profile?.id, approved_at: new Date().toISOString() })
 toast.push('Pengajuan cuti disetujui'); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyetujui pengajuan', 'error') }
 finally { setBusyId(null) }
 }
 async function submitReject() {
 if (!rejectReason.trim()) { toast.push('Alasan penolakan wajib diisi', 'error'); return }
 setBusyId(reject.id)
 try {
 await update('leave_requests', reject.id, {
 status: 'ditolak', approved_by: profile?.id, approved_at: new Date().toISOString(),
 reason: `${reject.reason ?? ''}\n\nAlasan penolakan: ${rejectReason}`.trim(),
 })
 toast.push('Pengajuan cuti ditolak'); setReject(null); setRejectReason(''); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menolak pengajuan', 'error') }
 finally { setBusyId(null) }
 }

 return (
 <div>
 <PageHeader title="Cuti & Izin" subtitle="Pengajuan dan persetujuan cuti karyawan"
 actions={can('HR', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Ajukan Cuti</Button>} />

 <Tabs className="mb-4" value={tab} onChange={setTab} tabs={LEAVE_STATUS_TABS.map(t => ({ ...t, count: t.value === 'semua' ? rows.length : rows.filter(r => t.value === 'diajukan' ? (r.status === 'diajukan' || r.status === 'draft') : r.status === t.value).length }))} />

 <DataTable
 loading={loading} rows={filtered} searchKeys={['leave_type']} emptyTitle="Belum ada pengajuan cuti"
 columns={[
 { key: 'nama', header: 'Nama', render: r => r.employees?.full_name ?? '-' },
 { key: 'leave_type', header: 'Jenis Cuti' },
 { key: 'start_date', header: 'Mulai', render: r => tgl(r.start_date) },
 { key: 'end_date', header: 'Selesai', render: r => tgl(r.end_date) },
 { key: 'days', header: 'Jumlah Hari', align: 'right' },
 { key: 'reason', header: 'Alasan', render: r => <span className="line-clamp-2 max-w-xs block whitespace-pre-line">{r.reason ?? '-'}</span> },
 { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
 ...(can('HR', 'approve') ? [{ key: 'aksi', header: 'Aksi', align: 'center' as const, sortable: false, render: (r: any) => (r.status === 'diajukan' || r.status === 'draft') ? (
 <div className="flex items-center gap-1.5 justify-center">
 <Button size="sm" variant="success" loading={busyId === r.id} onClick={() => approve(r)}>Setujui</Button>
 <Button size="sm" variant="danger" onClick={() => { setReject(r); setRejectReason('') }}>Tolak</Button>
 </div>) : <span className="text-ink-300">-</span> }] : []),
 ]}
 />

 <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Ajukan Cuti"
 footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Ajukan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Karyawan" required className="sm:col-span-2">
 <Select value={form.employee_id} onChange={(e: any) => setForm({ ...form, employee_id: e.target.value })} options={employees.map(e => ({ value: e.id, label: `${e.full_name} — ${e.position}` }))} />
 </Field>
 <Field label="Jenis Cuti"><Select value={form.leave_type} onChange={(e: any) => setForm({ ...form, leave_type: e.target.value })} options={LEAVE_TYPE_OPTIONS} /></Field>
 <Field label="Jumlah Hari"><Input value={days} disabled /></Field>
 <Field label="Tanggal Mulai" required><Input type="date" value={form.start_date} onChange={(e: any) => setForm({ ...form, start_date: e.target.value })} /></Field>
 <Field label="Tanggal Selesai" required><Input type="date" value={form.end_date} onChange={(e: any) => setForm({ ...form, end_date: e.target.value })} /></Field>
 <Field label="Alasan" className="sm:col-span-2"><Textarea value={form.reason} onChange={(e: any) => setForm({ ...form, reason: e.target.value })} /></Field>
 <Field label="Lampiran (opsional)" className="sm:col-span-2">
 <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)}
 className="block w-full text-body text-ink-600 file:mr-3 file:py-2 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
 </Field>
 </div>
 </Modal>

 <Modal open={!!reject} onClose={() => setReject(null)} title="Tolak Pengajuan Cuti" size="sm"
 footer={<><Button variant="outline" onClick={() => setReject(null)}>Batal</Button><Button variant="danger" loading={busyId === reject?.id} onClick={submitReject}>Tolak Pengajuan</Button></>}>
 <Field label="Alasan Penolakan" required><Textarea value={rejectReason} onChange={(e: any) => setRejectReason(e.target.value)} placeholder="Wajib diisi" /></Field>
 </Modal>
 </div>
 )
}
