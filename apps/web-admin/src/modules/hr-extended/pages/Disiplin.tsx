import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, uploadFile, signedUrl, nextDocNo } from '@/lib/db'
import {
 PageHeader, Card, DataTable, Badge, Button, Modal, Field, Select, Input, Textarea, KpiCard, useToast, Plus,
} from '@/components/ui'
import { tgl, todayISO } from '@/lib/format'
import { ACTION_TYPE_OPTIONS, VIOLATION_CATEGORY_OPTIONS, DISCIPLINE_STATUS_OPTIONS, isPast } from '../lib/constants'

const emptyForm = {
 id: null, employee_id: '', action_type: ACTION_TYPE_OPTIONS[0], violation_category: VIOLATION_CATEGORY_OPTIONS[0],
 violation_date: todayISO(), issued_date: todayISO(), description: '', valid_until: '', status: 'aktif',
}

export default function Disiplin() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [employees, setEmployees] = useState<any[]>([])

 const [modalOpen, setModalOpen] = useState(false)
 const [saving, setSaving] = useState(false)
 const [form, setForm] = useState<any>(emptyForm)
 const [file, setFile] = useState<File | null>(null)

 useEffect(() => { load() }, [])

 async function load() {
 setLoading(true)
 try {
 const [da, emp] = await Promise.all([
 list<any>('disciplinary_actions', { select: '*,employees(full_name,position,branch_id,branches(name))', order: { col: 'issued_date', asc: false } }),
 list<any>('employees', { select: 'id,full_name,position', eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
 ])
 setRows(da); setEmployees(emp)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data tindakan disiplin', 'error') }
 finally { setLoading(false) }
 }

 function isActiveSp(r: any) { return r.status === 'aktif' && (!r.valid_until || !isPast(r.valid_until)) }

 function openAdd() { setForm(emptyForm); setFile(null); setModalOpen(true) }
 function openEdit(r: any) {
 setForm({ ...emptyForm, ...r, valid_until: r.valid_until ?? '' }); setFile(null); setModalOpen(true)
 }

 async function save() {
 if (!form.employee_id || !form.action_type || !form.violation_date) { toast.push('Karyawan, jenis tindakan, dan tanggal pelanggaran wajib diisi', 'error'); return }
 setSaving(true)
 try {
 let document_url: string | null = form.document_url ?? null
 if (file) document_url = await uploadFile(profile!.company_id, 'disiplin', file)
 const payload: any = {
 employee_id: form.employee_id, action_type: form.action_type, violation_category: form.violation_category,
 violation_date: form.violation_date, issued_date: form.issued_date, description: form.description || null,
 valid_until: form.valid_until || null, status: form.status, document_url,
 }
 if (form.id) { await update('disciplinary_actions', form.id, payload); toast.push('Tindakan disiplin diperbarui') }
 else {
 const action_no = await nextDocNo(profile!.company_id, 'SP')
 await insert('disciplinary_actions', { ...payload, action_no, company_id: profile?.company_id, created_by: profile?.id, issued_by: profile?.id })
 toast.push('Tindakan disiplin dicatat')
 }
 setModalOpen(false); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan tindakan disiplin', 'error') }
 finally { setSaving(false) }
 }

 const activeSp = rows.filter(isActiveSp)
 const perCabang = useMemo(() => {
 const map: Record<string, number> = {}
 activeSp.forEach(r => { const name = r.employees?.branches?.name ?? 'Tanpa Cabang'; map[name] = (map[name] ?? 0) + 1 })
 return Object.entries(map).sort((a, b) => b[1] - a[1])
 }, [activeSp])

 return (
 <div>
 <PageHeader title="Tindakan Disiplin" subtitle="Pencatatan teguran, surat peringatan, hingga pemutusan hubungan kerja"
 actions={can('HR', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Catat Tindakan</Button>} />

 <div className="grid sm:grid-cols-3 gap-4 mb-4">
 <KpiCard label="Total Tindakan" value={rows.length} />
 <KpiCard label="SP Masih Berlaku" value={activeSp.length} tone={activeSp.length > 0 ? 'red' : 'teal'} />
 <KpiCard label="Cabang Terdampak" value={perCabang.length} />
 </div>

 {perCabang.length > 0 && (
 <Card className="mb-4 p-4">
 <p className="text-caption font-semibold text-ink-500 uppercase tracking-wide mb-2">Ringkasan SP Berlaku per Cabang</p>
 <div className="flex flex-wrap gap-2">
 {perCabang.map(([name, count]) => (
 <span key={name} className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-caption font-medium">{name} · {count}</span>
 ))}
 </div>
 </Card>
 )}

 <DataTable
 loading={loading} rows={rows} searchKeys={['action_no', 'action_type']} emptyTitle="Belum ada catatan tindakan disiplin"
 onRowClick={can('HR', 'write') ? openEdit : undefined}
 columns={[
 { key: 'action_no', header: 'No. Dokumen' },
 { key: 'nama', header: 'Karyawan', render: r => r.employees?.full_name ?? '-' },
 { key: 'branch', header: 'Cabang', render: r => r.employees?.branches?.name ?? '-' },
 { key: 'action_type', header: 'Jenis Tindakan' },
 { key: 'violation_category', header: 'Kategori' },
 { key: 'violation_date', header: 'Tgl. Pelanggaran', render: r => tgl(r.violation_date) },
 { key: 'valid_until', header: 'Berlaku Hingga', render: r => tgl(r.valid_until) },
 { key: 'status', header: 'Status', render: r => isActiveSp(r) ? <Badge tone="red">SP Berlaku</Badge> : <Badge>{r.status}</Badge> },
 { key: 'document_url', header: 'Dokumen', align: 'center', render: r => r.document_url ? <Button size="sm" variant="ghost" onClick={async (e: any) => { e.stopPropagation(); const url = await signedUrl(r.document_url); if (url) window.open(url, '_blank') }}>Lihat</Button> : '-' },
 ]}
 />

 <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? 'Ubah Tindakan Disiplin' : 'Catat Tindakan Disiplin'} size="lg"
 footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Karyawan" required className="sm:col-span-2"><Select value={form.employee_id} onChange={(e: any) => setForm({ ...form, employee_id: e.target.value })} options={employees.map(e => ({ value: e.id, label: `${e.full_name} — ${e.position}` }))} /></Field>
 <Field label="Jenis Tindakan" required><Select value={form.action_type} onChange={(e: any) => setForm({ ...form, action_type: e.target.value })} options={ACTION_TYPE_OPTIONS} /></Field>
 <Field label="Kategori Pelanggaran"><Select value={form.violation_category} onChange={(e: any) => setForm({ ...form, violation_category: e.target.value })} options={VIOLATION_CATEGORY_OPTIONS} /></Field>
 <Field label="Tanggal Pelanggaran" required><Input type="date" value={form.violation_date} onChange={(e: any) => setForm({ ...form, violation_date: e.target.value })} /></Field>
 <Field label="Tanggal Diterbitkan"><Input type="date" value={form.issued_date} onChange={(e: any) => setForm({ ...form, issued_date: e.target.value })} /></Field>
 <Field label="Berlaku Hingga (masa SP)"><Input type="date" value={form.valid_until} onChange={(e: any) => setForm({ ...form, valid_until: e.target.value })} /></Field>
 <Field label="Status"><Select value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })} options={DISCIPLINE_STATUS_OPTIONS} /></Field>
 <Field label="Uraian Pelanggaran" className="sm:col-span-2"><Textarea value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} /></Field>
 <Field label="Unggah Dokumen" className="sm:col-span-2"><input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)}
 className="block w-full text-body text-ink-600 file:mr-3 file:py-2 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" /></Field>
 </div>
 </Modal>
 </div>
 )
}
