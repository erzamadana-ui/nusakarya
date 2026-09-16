import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import {
 PageHeader, DataTable, Badge, Button, Modal, Field, Select, Input, Textarea, Money, Tabs, KpiCard, useToast, Plus,
} from '@/components/ui'
import { rupiah, tgl, todayISO } from '@/lib/format'
import { ADVANCE_STATUS_TABS, DISBURSEMENT_METHOD_OPTIONS, isPast, isThisMonth } from '../lib/constants'

const emptyForm = { employee_id: '', purpose: '', amount: 0, due_date: '', note: '' }

export default function Kasbon() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [employees, setEmployees] = useState<any[]>([])
 const [tab, setTab] = useState('diajukan')

 const [modalOpen, setModalOpen] = useState(false)
 const [saving, setSaving] = useState(false)
 const [form, setForm] = useState<any>(emptyForm)

 const [reject, setReject] = useState<any>(null)
 const [rejectReason, setRejectReason] = useState('')
 const [settle, setSettle] = useState<any>(null)
 const [settleAmount, setSettleAmount] = useState(0)
 const [busyId, setBusyId] = useState<string | null>(null)

 const [cairkan, setCairkan] = useState<any>(null)
 const [cairkanForm, setCairkanForm] = useState<any>({ tanggal: todayISO(), cara: 'Transfer Bank' })

 useEffect(() => { load() }, [])

 async function load() {
 setLoading(true)
 try {
 const [ad, emp] = await Promise.all([
 list<any>('employee_advances', { select: '*,employees(full_name,position)', order: { col: 'request_date', asc: false } }),
 list<any>('employees', { select: 'id,full_name,position', eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
 ])
 setRows(ad); setEmployees(emp)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data kasbon', 'error') }
 finally { setLoading(false) }
 }

 function overdue(r: any) { return r.status !== 'lunas' && r.status !== 'ditolak' && isPast(r.due_date) && Number(r.amount ?? 0) - Number(r.settled_amount ?? 0) > 0 }

 const filtered = useMemo(() => {
 if (tab === 'semua') return rows
 return rows.filter(r => r.status === tab)
 }, [rows, tab])

 function openAdd() { setForm(emptyForm); setModalOpen(true) }

 async function save() {
 if (!form.employee_id || !form.amount || !form.due_date) { toast.push('Karyawan, jumlah, dan jatuh tempo wajib diisi', 'error'); return }
 setSaving(true)
 try {
 const advance_no = await nextDocNo(profile!.company_id, 'KSB')
 await insert('employee_advances', {
 company_id: profile?.company_id, employee_id: form.employee_id, advance_no, request_date: todayISO(),
 purpose: form.purpose || null, amount: form.amount, settled_amount: 0, due_date: form.due_date, note: form.note || null,
 status: 'diajukan', created_by: profile?.id,
 })
 toast.push('Pengajuan kasbon dibuat'); setModalOpen(false); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal membuat pengajuan kasbon', 'error') }
 finally { setSaving(false) }
 }

 async function approve(r: any) {
 setBusyId(r.id)
 try {
 await update('employee_advances', r.id, { status: 'disetujui', approved_by: profile?.id })
 toast.push('Kasbon disetujui'); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyetujui kasbon', 'error') }
 finally { setBusyId(null) }
 }
 async function submitReject() {
 if (!rejectReason.trim()) { toast.push('Alasan penolakan wajib diisi', 'error'); return }
 setBusyId(reject.id)
 try {
 await update('employee_advances', reject.id, { status: 'ditolak', approved_by: profile?.id, note: `${reject.note ?? ''}\n\nAlasan penolakan: ${rejectReason}`.trim() })
 toast.push('Kasbon ditolak'); setReject(null); setRejectReason(''); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menolak kasbon', 'error') }
 finally { setBusyId(null) }
 }
 function openSettle(r: any) { setSettle(r); setSettleAmount(0) }
 async function submitSettle() {
 const sisa = Number(settle.amount ?? 0) - Number(settle.settled_amount ?? 0)
 if (!settleAmount || settleAmount <= 0) { toast.push('Jumlah pelunasan wajib diisi', 'error'); return }
 if (settleAmount > sisa) { toast.push(`Jumlah melebihi sisa kasbon (${rupiah(sisa)})`, 'error'); return }
 setBusyId(settle.id)
 try {
 const newSettled = Number(settle.settled_amount ?? 0) + settleAmount
 const newStatus = newSettled >= Number(settle.amount ?? 0) ? 'lunas' : 'sebagian_lunas'
 await update('employee_advances', settle.id, { settled_amount: newSettled, status: newStatus })
 toast.push('Pelunasan kasbon dicatat'); setSettle(null); load()
 } catch (e: any) {
 const msg = /row-level security|permission denied/i.test(e.message ?? '') ? 'Gagal mencatat — hak akses Anda pada modul HR tidak mengizinkan penulisan (perlu izin write).' : (e.message ?? 'Gagal mencatat pelunasan')
 toast.push(msg, 'error')
 }
 finally { setBusyId(null) }
 }

 function openCairkan(r: any) { setCairkan(r); setCairkanForm({ tanggal: todayISO(), cara: 'Transfer Bank' }) }
 async function submitCairkan() {
 if (!cairkanForm.tanggal || !cairkanForm.cara) { toast.push('Tanggal dan cara pencairan wajib diisi', 'error'); return }
 setBusyId(cairkan.id)
 try {
 const catatan = `Dicairkan pada ${tgl(cairkanForm.tanggal)} via ${cairkanForm.cara} oleh ${profile?.full_name ?? 'pengguna'}.`
 await update('employee_advances', cairkan.id, { status: 'dicairkan', note: `${cairkan.note ?? ''}\n\n${catatan}`.trim() })
 toast.push('Kasbon ditandai dicairkan'); setCairkan(null); load()
 } catch (e: any) {
 const msg = /row-level security|permission denied/i.test(e.message ?? '') ? 'Gagal mencairkan — hak akses Anda pada modul HR tidak mengizinkan penulisan (perlu izin write).' : (e.message ?? 'Gagal mencairkan kasbon')
 toast.push(msg, 'error')
 }
 finally { setBusyId(null) }
 }

 const outstandingStatuses = ['disetujui', 'dicairkan', 'sebagian_lunas']
 const beredar = rows.filter(r => outstandingStatuses.includes(r.status)).reduce((s, r) => s + (Number(r.amount ?? 0) - Number(r.settled_amount ?? 0)), 0)
 const jatuhTempoBulanIni = rows.filter(r => outstandingStatuses.includes(r.status) && isThisMonth(r.due_date)).length
 const lewatTempo = rows.filter(overdue).length

 return (
 <div>
 <PageHeader title="Kasbon Karyawan" subtitle="Pengajuan dan pelunasan kasbon/pinjaman karyawan"
 actions={can('HR', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Ajukan Kasbon</Button>} />

 <div className="grid sm:grid-cols-3 gap-4 mb-4">
 <KpiCard label="Total Kasbon Beredar" value={rupiah(beredar)} />
 <KpiCard label="Jatuh Tempo Bulan Ini" value={jatuhTempoBulanIni} />
 <KpiCard label="Lewat Jatuh Tempo" value={lewatTempo} tone={lewatTempo > 0 ? 'red' : 'teal'} />
 </div>

 <Tabs className="mb-4" value={tab} onChange={setTab}
 tabs={ADVANCE_STATUS_TABS.map(t => ({ ...t, count: t.value === 'semua' ? rows.length : rows.filter(r => r.status === t.value).length }))} />

 <DataTable
 loading={loading} rows={filtered} searchKeys={['advance_no', 'purpose']} emptyTitle="Belum ada pengajuan kasbon"
 columns={[
 { key: 'advance_no', header: 'No. Kasbon' },
 { key: 'nama', header: 'Karyawan', render: r => r.employees?.full_name ?? '-' },
 { key: 'purpose', header: 'Keperluan' },
 { key: 'amount', header: 'Jumlah', align: 'right', render: r => rupiah(r.amount) },
 { key: 'settled_amount', header: 'Terbayar', align: 'right', render: r => rupiah(r.settled_amount) },
 { key: 'sisa', header: 'Sisa', align: 'right', render: r => rupiah(Number(r.amount ?? 0) - Number(r.settled_amount ?? 0)) },
 { key: 'due_date', header: 'Jatuh Tempo', render: r => <span className="flex items-center gap-1.5">{tgl(r.due_date)}{overdue(r) && <Badge tone="red">Lewat Tempo</Badge>}</span> },
 { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
 { key: 'aksi', header: 'Aksi', align: 'center', sortable: false, render: (r: any) => (
 <div className="flex items-center gap-1.5 justify-center">
 {can('HR', 'approve') && r.status === 'diajukan' && <><Button size="sm" variant="success" loading={busyId === r.id} onClick={() => approve(r)}>Setujui</Button><Button size="sm" variant="danger" onClick={() => { setReject(r); setRejectReason('') }}>Tolak</Button></>}
 {can('HR', 'write') && r.status === 'disetujui' && <Button size="sm" variant="outline" onClick={() => openCairkan(r)}>Cairkan</Button>}
 {can('HR', 'write') && (r.status === 'dicairkan' || r.status === 'sebagian_lunas') && <Button size="sm" variant="outline" onClick={() => openSettle(r)}>Catat Pelunasan</Button>}
 {!['diajukan', 'disetujui', 'dicairkan', 'sebagian_lunas'].includes(r.status) && <span className="text-ink-300">-</span>}
 </div>) },
 ]}
 />

 <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Ajukan Kasbon"
 footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Ajukan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Karyawan" required className="sm:col-span-2">
 <Select value={form.employee_id} onChange={(e: any) => setForm({ ...form, employee_id: e.target.value })} options={employees.map(e => ({ value: e.id, label: `${e.full_name} — ${e.position}` }))} />
 </Field>
 <Field label="Keperluan" className="sm:col-span-2"><Textarea value={form.purpose} onChange={(e: any) => setForm({ ...form, purpose: e.target.value })} /></Field>
 <Field label="Jumlah Kasbon" required><Money value={form.amount} onChange={(v: number) => setForm({ ...form, amount: v })} /></Field>
 <Field label="Jatuh Tempo" required><Input type="date" value={form.due_date} onChange={(e: any) => setForm({ ...form, due_date: e.target.value })} /></Field>
 <Field label="Catatan" className="sm:col-span-2"><Textarea value={form.note} onChange={(e: any) => setForm({ ...form, note: e.target.value })} /></Field>
 </div>
 </Modal>

 <Modal open={!!reject} onClose={() => setReject(null)} title="Tolak Pengajuan Kasbon" size="sm"
 footer={<><Button variant="outline" onClick={() => setReject(null)}>Batal</Button><Button variant="danger" loading={busyId === reject?.id} onClick={submitReject}>Tolak Pengajuan</Button></>}>
 <Field label="Alasan Penolakan" required><Textarea value={rejectReason} onChange={(e: any) => setRejectReason(e.target.value)} placeholder="Wajib diisi" /></Field>
 </Modal>

 <Modal open={!!settle} onClose={() => setSettle(null)} title="Catat Pelunasan Kasbon" size="sm"
 footer={<><Button variant="outline" onClick={() => setSettle(null)}>Batal</Button><Button loading={busyId === settle?.id} onClick={submitSettle}>Simpan Pelunasan</Button></>}>
 {settle && (
 <div className="space-y-3">
 <p className="text-caption text-ink-500">Sisa kasbon saat ini: <span className="font-medium text-ink-800">{rupiah(Number(settle.amount ?? 0) - Number(settle.settled_amount ?? 0))}</span></p>
 <Field label="Jumlah Pelunasan" required hint="Boleh sebagian — sisa dihitung otomatis. Status berubah menjadi Lunas bila pelunasan mencapai jumlah penuh."><Money value={settleAmount} onChange={setSettleAmount} /></Field>
 </div>
 )}
 </Modal>

 <Modal open={!!cairkan} onClose={() => setCairkan(null)} title="Cairkan Kasbon" size="sm"
 footer={<><Button variant="outline" onClick={() => setCairkan(null)}>Batal</Button><Button loading={busyId === cairkan?.id} onClick={submitCairkan}>Konfirmasi Cairkan</Button></>}>
 {cairkan && (
 <div className="space-y-3">
 <p className="text-caption text-ink-500">Kasbon <span className="font-medium text-ink-800">{cairkan.advance_no}</span> — {rupiah(cairkan.amount)} untuk {cairkan.employees?.full_name}.</p>
 <Field label="Tanggal Pencairan" required><Input type="date" value={cairkanForm.tanggal} onChange={(e: any) => setCairkanForm({ ...cairkanForm, tanggal: e.target.value })} /></Field>
 <Field label="Cara Pencairan" required><Select value={cairkanForm.cara} onChange={(e: any) => setCairkanForm({ ...cairkanForm, cara: e.target.value })} options={DISBURSEMENT_METHOD_OPTIONS} /></Field>
 </div>
 )}
 </Modal>
 </div>
 )
}
