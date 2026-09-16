import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update } from '@/lib/db'
import {
 PageHeader, Card, DataTable, Badge, Button, Modal, Drawer, ConfirmDialog, FilterBar,
 Select, Input, Field, Section, Desc, Tabs, TableSkeleton, EmptyState, useToast, Plus,
} from '@/components/ui'
import { tgl, todayISO } from '@/lib/format'
import {
 EMPLOYMENT_TYPE_OPTIONS, EMPLOYEE_STATUS_OPTIONS, GENDER_OPTIONS, PTKP_OPTIONS, TER_CATEGORY_OPTIONS, expiryTone,
} from '../lib/constants'

const emptyForm = {
 id: null, nip: '', full_name: '', gender: 'L', birth_date: '', phone: '', email: '', address: '',
 branch_id: '', position: '', unit: '', employment_type: 'PKWTT', join_date: todayISO(),
 contract_start: '', contract_end: '', status: 'aktif', ptkp_status: 'TK/0', ter_category: 'A',
 npwp: '', nik_ktp: '', bank_name: '', bank_account: '', bank_holder: '', bpjs_tk_no: '', bpjs_kes_no: '',
}

export default function Karyawan() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [branches, setBranches] = useState<any[]>([])

 const [fUnit, setFUnit] = useState(''); const [fBranch, setFBranch] = useState('')
 const [fStatus, setFStatus] = useState(''); const [fType, setFType] = useState('')

 const [modalOpen, setModalOpen] = useState(false)
 const [saving, setSaving] = useState(false)
 const [form, setForm] = useState<any>(emptyForm)

 const [detail, setDetail] = useState<any>(null)
 const [tab, setTab] = useState('ringkasan')
 const [certs, setCerts] = useState<any[] | null>(null)
 const [attend, setAttend] = useState<any[] | null>(null)
 const [sal, setSal] = useState<any[] | null>(null)
 const [confirmOff, setConfirmOff] = useState<any>(null)

 useEffect(() => { load() }, [])

 async function load() {
 setLoading(true)
 try {
 const [emp, br] = await Promise.all([
 list<any>('employees', { select: '*,branches(id,name,code)', order: { col: 'full_name', asc: true } }),
 list<any>('branches', { select: 'id,name,code', order: { col: 'name', asc: true } }),
 ])
 setRows(emp); setBranches(br)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data karyawan', 'error') }
 finally { setLoading(false) }
 }

 const unitOptions = useMemo(() => Array.from(new Set(rows.map(r => r.unit).filter(Boolean))).sort(), [rows])

 const filtered = useMemo(() => rows.filter(r =>
 (!fUnit || r.unit === fUnit) && (!fBranch || r.branch_id === fBranch) &&
 (!fStatus || r.status === fStatus) && (!fType || r.employment_type === fType)
 ), [rows, fUnit, fBranch, fStatus, fType])

 function openAdd() { setForm(emptyForm); setModalOpen(true) }
 function openEdit(r: any) {
 setForm({ ...emptyForm, ...r, birth_date: r.birth_date ?? '', join_date: r.join_date ?? '', contract_start: r.contract_start ?? '', contract_end: r.contract_end ?? '' })
 setModalOpen(true)
 }

 async function save() {
 if (!form.nip || !form.full_name || !form.position) { toast.push('NIK, nama, dan jabatan wajib diisi', 'error'); return }
 setSaving(true)
 try {
 const payload: any = { ...form }
 delete payload.branches
 Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
 if (form.id) {
 await update('employees', form.id, payload)
 toast.push('Data karyawan diperbarui')
 } else {
 await insert('employees', { ...payload, id: undefined, company_id: profile?.company_id, created_by: profile?.id })
 toast.push('Karyawan baru ditambahkan')
 }
 setModalOpen(false); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan data karyawan', 'error') }
 finally { setSaving(false) }
 }

 async function openDetail(r: any) {
 setDetail(r); setTab('ringkasan'); setCerts(null); setAttend(null); setSal(null)
 }

 async function loadTab(t: string) {
 setTab(t)
 if (!detail) return
 try {
 if (t === 'sertifikasi' && certs === null) setCerts(await list('employee_certifications', { eq: { employee_id: detail.id }, order: { col: 'expiry_date', asc: true } }))
 if (t === 'absensi' && attend === null) setAttend(await list('attendances', { eq: { employee_id: detail.id }, order: { col: 'work_date', asc: false }, limit: 30 }))
 if (t === 'gaji' && sal === null) setSal(await list('employee_salaries', { select: '*,salary_components(name,component_type)', eq: { employee_id: detail.id }, order: { col: 'effective_date', asc: false } }))
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data', 'error') }
 }

 async function nonaktifkan() {
 try {
 await update('employees', confirmOff.id, { status: 'nonaktif' })
 toast.push('Karyawan dinonaktifkan')
 load(); setDetail(null)
 } catch (e: any) { toast.push(e.message ?? 'Gagal menonaktifkan karyawan', 'error') }
 }

 return (
 <div>
 <PageHeader title="Data Karyawan" subtitle="Induk data seluruh karyawan perusahaan"
 actions={can('HR', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Karyawan</Button>} />

 <FilterBar>
 <Field label="Unit" className="w-40"><Select value={fUnit} onChange={(e: any) => setFUnit(e.target.value)} options={unitOptions} placeholder="Semua unit" /></Field>
 <Field label="Cabang" className="w-48"><Select value={fBranch} onChange={(e: any) => setFBranch(e.target.value)} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="Semua cabang" /></Field>
 <Field label="Status" className="w-40"><Select value={fStatus} onChange={(e: any) => setFStatus(e.target.value)} options={EMPLOYEE_STATUS_OPTIONS} placeholder="Semua status" /></Field>
 <Field label="Tipe Kerja" className="w-40"><Select value={fType} onChange={(e: any) => setFType(e.target.value)} options={EMPLOYMENT_TYPE_OPTIONS} placeholder="Semua tipe" /></Field>
 {(fUnit || fBranch || fStatus || fType) && <Button variant="ghost" size="sm" onClick={() => { setFUnit(''); setFBranch(''); setFStatus(''); setFType('') }}>Reset</Button>}
 </FilterBar>

 <DataTable
 loading={loading}
 rows={filtered}
 onRowClick={openDetail}
 searchKeys={['nip', 'full_name', 'position', 'unit']}
 exportName="data-karyawan"
 emptyTitle="Belum ada karyawan"
 emptyMessage="Tambahkan karyawan pertama untuk mulai mengelola data HR."
 columns={[
 { key: 'nip', header: 'NIK', width: '110px' },
 { key: 'full_name', header: 'Nama' },
 { key: 'position', header: 'Jabatan' },
 { key: 'unit', header: 'Unit' },
 { key: 'cabang', header: 'Cabang', render: r => r.branches?.name ?? '-' },
 { key: 'employment_type', header: 'Tipe Kerja', render: r => <Badge tone="teal">{r.employment_type}</Badge> },
 { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
 { key: 'join_date', header: 'Tgl Masuk', render: r => tgl(r.join_date) },
 ]}
 />

 <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="lg"
 title={form.id ? 'Ubah Data Karyawan' : 'Tambah Karyawan'}
 footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <Section title="Data Pribadi">
 <div className="grid sm:grid-cols-3 gap-4">
 <Field label="NIK Pegawai" required><Input value={form.nip} onChange={(e: any) => setForm({ ...form, nip: e.target.value })} /></Field>
 <Field label="Nama Lengkap" required className="sm:col-span-2"><Input value={form.full_name} onChange={(e: any) => setForm({ ...form, full_name: e.target.value })} /></Field>
 <Field label="Jenis Kelamin"><Select value={form.gender} onChange={(e: any) => setForm({ ...form, gender: e.target.value })} options={GENDER_OPTIONS} /></Field>
 <Field label="Tanggal Lahir"><Input type="date" value={form.birth_date} onChange={(e: any) => setForm({ ...form, birth_date: e.target.value })} /></Field>
 <Field label="No. KTP"><Input value={form.nik_ktp} onChange={(e: any) => setForm({ ...form, nik_ktp: e.target.value })} /></Field>
 <Field label="Telepon"><Input value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} /></Field>
 <Field label="Email"><Input type="email" value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} /></Field>
 <Field label="Alamat" className="sm:col-span-3"><Input value={form.address} onChange={(e: any) => setForm({ ...form, address: e.target.value })} /></Field>
 </div>
 </Section>
 <Section title="Data Pekerjaan">
 <div className="grid sm:grid-cols-3 gap-4">
 <Field label="Jabatan" required><Input value={form.position} onChange={(e: any) => setForm({ ...form, position: e.target.value })} /></Field>
 <Field label="Unit"><Input value={form.unit} onChange={(e: any) => setForm({ ...form, unit: e.target.value })} placeholder="mis. OPERATIONS" /></Field>
 <Field label="Cabang"><Select value={form.branch_id} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value })} options={branches.map(b => ({ value: b.id, label: b.name }))} /></Field>
 <Field label="Tipe Kerja"><Select value={form.employment_type} onChange={(e: any) => setForm({ ...form, employment_type: e.target.value })} options={EMPLOYMENT_TYPE_OPTIONS} /></Field>
 <Field label="Status"><Select value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })} options={EMPLOYEE_STATUS_OPTIONS} /></Field>
 <Field label="Tanggal Masuk"><Input type="date" value={form.join_date} onChange={(e: any) => setForm({ ...form, join_date: e.target.value })} /></Field>
 {form.employment_type === 'PKWT' && <>
 <Field label="Mulai Kontrak"><Input type="date" value={form.contract_start} onChange={(e: any) => setForm({ ...form, contract_start: e.target.value })} /></Field>
 <Field label="Berakhir Kontrak"><Input type="date" value={form.contract_end} onChange={(e: any) => setForm({ ...form, contract_end: e.target.value })} /></Field>
 </>}
 </div>
 </Section>
 <Section title="Pajak, BPJS & Rekening Bank">
 <div className="grid sm:grid-cols-3 gap-4">
 <Field label="Status PTKP"><Select value={form.ptkp_status} onChange={(e: any) => setForm({ ...form, ptkp_status: e.target.value })} options={PTKP_OPTIONS} /></Field>
 <Field label="Kategori TER"><Select value={form.ter_category} onChange={(e: any) => setForm({ ...form, ter_category: e.target.value })} options={TER_CATEGORY_OPTIONS} /></Field>
 <Field label="NPWP"><Input value={form.npwp} onChange={(e: any) => setForm({ ...form, npwp: e.target.value })} /></Field>
 <Field label="No. BPJS Ketenagakerjaan"><Input value={form.bpjs_tk_no} onChange={(e: any) => setForm({ ...form, bpjs_tk_no: e.target.value })} /></Field>
 <Field label="No. BPJS Kesehatan"><Input value={form.bpjs_kes_no} onChange={(e: any) => setForm({ ...form, bpjs_kes_no: e.target.value })} /></Field>
 <div />
 <Field label="Nama Bank"><Input value={form.bank_name} onChange={(e: any) => setForm({ ...form, bank_name: e.target.value })} /></Field>
 <Field label="No. Rekening"><Input value={form.bank_account} onChange={(e: any) => setForm({ ...form, bank_account: e.target.value })} /></Field>
 <Field label="Nama Pemilik Rekening"><Input value={form.bank_holder} onChange={(e: any) => setForm({ ...form, bank_holder: e.target.value })} /></Field>
 </div>
 </Section>
 </Modal>

 <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.full_name} width="max-w-2xl"
 footer={detail?.status !== 'nonaktif' && can('HR', 'approve') &&
 <Button variant="danger" onClick={() => setConfirmOff(detail)}>Nonaktifkan Karyawan</Button>}>
 {detail && <>
 <Tabs value={tab} onChange={loadTab} className="mb-4" tabs={[
 { value: 'ringkasan', label: 'Ringkasan' }, { value: 'sertifikasi', label: 'Sertifikasi' },
 { value: 'absensi', label: 'Riwayat Absensi' }, { value: 'gaji', label: 'Komponen Gaji' },
 ]} />
 {tab === 'ringkasan' && <>
 <Desc cols={2} items={[
 { label: 'NIK', value: detail.nip }, { label: 'Status', value: <Badge>{detail.status}</Badge> },
 { label: 'Jabatan', value: detail.position }, { label: 'Unit', value: detail.unit },
 { label: 'Cabang', value: detail.branches?.name }, { label: 'Tipe Kerja', value: detail.employment_type },
 { label: 'Tanggal Masuk', value: tgl(detail.join_date) },
 { label: 'Kontrak Berakhir', value: detail.contract_end ? tgl(detail.contract_end) : '-' },
 { label: 'Telepon', value: detail.phone }, { label: 'Email', value: detail.email },
 { label: 'PTKP', value: detail.ptkp_status }, { label: 'Kategori TER', value: detail.ter_category },
 { label: 'NPWP', value: detail.npwp }, { label: 'No. KTP', value: detail.nik_ktp },
 { label: 'BPJS Ketenagakerjaan', value: detail.bpjs_tk_no }, { label: 'BPJS Kesehatan', value: detail.bpjs_kes_no },
 { label: 'Bank', value: detail.bank_name ? `${detail.bank_name} · ${detail.bank_account ?? '-'} a.n ${detail.bank_holder ?? '-'}` : '-' },
 ]} />
 {can('HR', 'write') && <Button className="mt-5" variant="outline" onClick={() => { setDetail(null); openEdit(detail) }}>Ubah Data</Button>}
 </>}
 {tab === 'sertifikasi' && (certs === null ? <TableSkeleton /> : certs.length === 0 ? <EmptyState title="Belum ada sertifikasi" /> : (
 <div className="space-y-2">{certs.map(c => { const t = expiryTone(c.expiry_date); return (
 <Card key={c.id} className="p-3 flex items-center justify-between">
 <div><p className="text-body font-medium text-ink-800">{c.cert_name}</p><p className="text-caption text-ink-400">{c.cert_type} · berakhir {tgl(c.expiry_date)}</p></div>
 <Badge tone={t.tone}>{t.label}</Badge>
 </Card>) })}</div>))}
 {tab === 'absensi' && (attend === null ? <TableSkeleton /> : attend.length === 0 ? <EmptyState title="Belum ada riwayat absensi" /> : (
 <DataTable searchable={false} pageSize={10} columns={[
 { key: 'work_date', header: 'Tanggal', render: r => tgl(r.work_date) },
 { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
 { key: 'late_minutes', header: 'Terlambat', align: 'right', render: r => `${r.late_minutes ?? 0} mnt` },
 ]} rows={attend} />))}
 {tab === 'gaji' && (sal === null ? <TableSkeleton /> : sal.length === 0 ? <EmptyState title="Belum ada komponen gaji ditetapkan" /> : (
 <DataTable searchable={false} pageSize={10} columns={[
 { key: 'nama', header: 'Komponen', render: r => r.salary_components?.name ?? '-' },
 { key: 'tipe', header: 'Tipe', render: r => <Badge tone={r.salary_components?.component_type === 'deduction' ? 'red' : 'emerald'}>{r.salary_components?.component_type}</Badge> },
 { key: 'amount', header: 'Nominal', align: 'right', render: r => (r.amount ?? 0).toLocaleString('id-ID') },
 { key: 'effective_date', header: 'Berlaku Sejak', render: r => tgl(r.effective_date) },
 ]} rows={sal} />))}
 </>}
 </Drawer>

 <ConfirmDialog open={!!confirmOff} onClose={() => setConfirmOff(null)} onConfirm={nonaktifkan} danger
 title="Nonaktifkan Karyawan" confirmLabel="Ya, Nonaktifkan"
 message={`Karyawan "${confirmOff?.full_name}" akan ditandai nonaktif. Lanjutkan?`} />
 </div>
 )
}
