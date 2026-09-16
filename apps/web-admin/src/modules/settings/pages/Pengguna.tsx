import React, { useEffect, useMemo, useState } from 'react'
import { Plus, KeyRound, Ban, CheckCircle2, Trash2, Copy, Eye, EyeOff, Wand2, ShieldAlert } from 'lucide-react'
import { list, update } from '@/lib/db'
import supabase from '@/lib/supabase'
import { useAuth, ROLE_LABEL } from '@/lib/auth'
import { tglJam } from '@/lib/format'
import {
 PageHeader, Card, DataTable, Badge, Modal, Field, Input, Select, Checkbox, Button,
 ConfirmDialog, useToast, type Column,
} from '@/components/ui'

type ProfileRow = {
 id: string; full_name: string; email: string | null; role: string; unit: string | null
 branch_id: string | null; employee_id: string | null; is_active: boolean; last_login_at: string | null
}
type Branch = { id: string; name: string }
type Employee = { id: string; full_name: string; user_id: string | null }

const UNITS = ['EXECUTIVE', 'HR', 'COMMERCE', 'PROCUREMENT', 'FINANCE', 'INVENTORY', 'OPERATIONS', 'DEPLOYMENT']

function randomInt(max: number) {
 if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
 const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % max
 }
 return Math.floor(Math.random() * max)
}
function generatePassword(length = 14) {
 const lower = 'abcdefghijkmnopqrstuvwxyz', upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ', digit = '23456789', symbol = '!@#$%^&*-_='
 const all = lower + upper + digit + symbol
 const pick = (s: string) => s[randomInt(s.length)]
 const chars = [pick(lower), pick(upper), pick(digit), pick(symbol)]
 while (chars.length < length) chars.push(pick(all))
 for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1);[chars[i], chars[j]] = [chars[j], chars[i]] }
 return chars.join('')
}
function isStrongPassword(pw: string) {
 return pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw)
}
async function callAdminUsers(action: string, payload: Record<string, any> = {}) {
 const { data, error } = await supabase.functions.invoke('admin-users', { body: { action, ...payload } })
 if (error) {
 let msg = error.message ?? 'Gagal memproses permintaan'
 try {
 const ctx: any = (error as any).context
 if (ctx && typeof ctx.json === 'function') { const j = await ctx.json(); if (j?.error) msg = j.error }
 } catch { /* abaikan */ }
 throw new Error(msg)
 }
 if (data?.error) throw new Error(data.error)
 return data
}

const emptyAddForm = {
 full_name: '', email: '', password: '', confirm: '', showPw: false,
 role: '', unit: '', branch_id: '', phone: '', employee_id: '', employeeQuery: '',
}

export default function Pengguna() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [rows, setRows] = useState<ProfileRow[]>([])
 const [branches, setBranches] = useState<Branch[]>([])
 const [employees, setEmployees] = useState<Employee[]>([])
 const [loading, setLoading] = useState(true)

 const [edit, setEdit] = useState<ProfileRow | null>(null)
 const [saving, setSaving] = useState(false)

 const [showAdd, setShowAdd] = useState(false)
 const [addForm, setAddForm] = useState(emptyAddForm)
 const [creating, setCreating] = useState(false)
 const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null)

 const [resetTarget, setResetTarget] = useState<ProfileRow | null>(null)
 const [resetPw, setResetPw] = useState({ password: '', confirm: '', show: false })
 const [resetting, setResetting] = useState(false)

 const [deleteTarget, setDeleteTarget] = useState<ProfileRow | null>(null)
 const [togglingId, setTogglingId] = useState<string | null>(null)

 const canWrite = can('CORE', 'write')
 const canDelete = can('CORE', 'approve')

 const load = async () => {
 setLoading(true)
 try {
 const [p, b, e] = await Promise.all([
 list<ProfileRow>('profiles', { select: 'id, full_name, email, role, unit, branch_id, employee_id, is_active, last_login_at', order: { col: 'full_name', asc: true } }),
 list<Branch>('branches', { select: 'id, name', order: { col: 'name', asc: true } }),
 list<Employee>('employees', { select: 'id, full_name, user_id', order: { col: 'full_name', asc: true } }),
 ])
 setRows(p); setBranches(b); setEmployees(e)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat pengguna', 'error') } finally { setLoading(false) }
 }
 useEffect(() => { if (profile) load() }, [profile])

 const branchName = useMemo(() => Object.fromEntries(branches.map(b => [b.id, b.name])), [branches])
 const employeeName = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e.full_name])), [employees])
 const availableEmployees = useMemo(() => employees.filter(e => !e.user_id), [employees])
 const filteredEmployees = useMemo(() => {
 const q = addForm.employeeQuery.trim().toLowerCase()
 const base = q ? availableEmployees.filter(e => e.full_name.toLowerCase().includes(q)) : availableEmployees
 return base.slice(0, 50)
 }, [availableEmployees, addForm.employeeQuery])

 /* ---------------- Ubah peran/unit/cabang ---------------- */
 const save = async () => {
 if (!edit) return
 setSaving(true)
 try {
 await update('profiles', edit.id, { role: edit.role, unit: edit.unit || null, branch_id: edit.branch_id || null, is_active: edit.is_active })
 toast.push('Data pengguna disimpan')
 setEdit(null); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan', 'error') } finally { setSaving(false) }
 }

 /* ---------------- Tambah pengguna ---------------- */
 const openAdd = () => { setAddForm(emptyAddForm); setShowAdd(true) }
 const submitAdd = async () => {
 if (!addForm.full_name.trim()) return toast.push('Nama lengkap wajib diisi', 'error')
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email)) return toast.push('Email tidak valid', 'error')
 if (!addForm.role) return toast.push('Jabatan wajib dipilih', 'error')
 if (!isStrongPassword(addForm.password)) return toast.push('Kata sandi minimal 8 karakter serta mengandung huruf dan angka', 'error')
 if (addForm.password !== addForm.confirm) return toast.push('Ulangi kata sandi tidak sama', 'error')
 setCreating(true)
 try {
 await callAdminUsers('create', {
 email: addForm.email.trim().toLowerCase(),
 password: addForm.password,
 full_name: addForm.full_name.trim(),
 role: addForm.role,
 unit: addForm.unit || null,
 branch_id: addForm.branch_id || null,
 phone: addForm.phone.trim() || null,
 employee_id: addForm.employee_id || null,
 })
 setCreatedInfo({ email: addForm.email.trim().toLowerCase(), password: addForm.password })
 setShowAdd(false); setAddForm(emptyAddForm)
 load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal membuat pengguna', 'error') } finally { setCreating(false) }
 }
 const copyText = async (text: string) => {
 try { await navigator.clipboard.writeText(text); toast.push('Disalin ke papan klip') }
 catch { toast.push('Gagal menyalin', 'error') }
 }

 /* ---------------- Setel ulang kata sandi ---------------- */
 const openReset = (row: ProfileRow) => { setResetTarget(row); setResetPw({ password: '', confirm: '', show: false }) }
 const submitReset = async () => {
 if (!resetTarget) return
 if (!isStrongPassword(resetPw.password)) return toast.push('Kata sandi minimal 8 karakter serta mengandung huruf dan angka', 'error')
 if (resetPw.password !== resetPw.confirm) return toast.push('Ulangi kata sandi tidak sama', 'error')
 setResetting(true)
 try {
 await callAdminUsers('reset_password', { user_id: resetTarget.id, new_password: resetPw.password })
 toast.push('Kata sandi berhasil diperbarui')
 setResetTarget(null); setResetPw({ password: '', confirm: '', show: false })
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengatur ulang kata sandi', 'error') } finally { setResetting(false) }
 }

 /* ---------------- Aktif / nonaktif ---------------- */
 const toggleActive = async (row: ProfileRow) => {
 setTogglingId(row.id)
 try {
 await callAdminUsers('set_active', { user_id: row.id, is_active: !row.is_active })
 toast.push(row.is_active ? 'Pengguna dinonaktifkan' : 'Pengguna diaktifkan')
 load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal memperbarui status', 'error') } finally { setTogglingId(null) }
 }

 /* ---------------- Hapus ---------------- */
 const submitDelete = async () => {
 if (!deleteTarget) return
 try {
 await callAdminUsers('delete', { user_id: deleteTarget.id })
 toast.push('Pengguna dihapus')
 load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menghapus pengguna', 'error'); throw e }
 }

 const columns: Column[] = [
 { key: 'full_name', header: 'Nama' },
 { key: 'email', header: 'Email' },
 { key: 'role', header: 'Jabatan', render: r => ROLE_LABEL[r.role] ?? r.role },
 { key: 'unit', header: 'Unit', render: r => r.unit ?? '-' },
 { key: 'branch_id', header: 'Cabang', render: r => branchName[r.branch_id] ?? '-' },
 { key: 'employee_id', header: 'Karyawan Tertaut', render: r => employeeName[r.employee_id] ?? '-' },
 { key: 'is_active', header: 'Status', align: 'center', render: r => <Badge>{r.is_active ? 'Aktif' : 'Nonaktif'}</Badge> },
 { key: 'last_login_at', header: 'Login Terakhir', render: r => tglJam(r.last_login_at) },
 ...(canWrite ? [{
 key: 'actions', header: 'Aksi', align: 'right' as const,
 render: (r: ProfileRow) => (
 <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
 <Button size="sm" variant="outline" icon={<KeyRound size={14} />} onClick={() => openReset(r)}>Reset</Button>
 <Button size="sm" variant={r.is_active ? 'outline' : 'success'} loading={togglingId === r.id}
 icon={r.is_active ? <Ban size={14} /> : <CheckCircle2 size={14} />}
 onClick={() => toggleActive(r)}>{r.is_active ? 'Nonaktifkan' : 'Aktifkan'}</Button>
 {canDelete && (
 <Button size="sm" variant="danger" icon={<Trash2 size={14} />}
 disabled={r.id === profile?.id}
 onClick={() => setDeleteTarget(r)}>Hapus</Button>
 )}
 </div>
 ),
 }] : []),
 ]

 return (
 <div>
 <PageHeader title="Pengguna" subtitle="Kelola akun login, jabatan, unit, cabang & status pengguna panel admin"
 actions={canWrite && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Pengguna</Button>} />

 <DataTable
 columns={columns} rows={rows} loading={loading}
 onRowClick={canWrite ? (r) => setEdit(r) : undefined}
 searchKeys={['full_name', 'email', 'role', 'unit']}
 exportName="pengguna" emptyTitle="Belum ada pengguna"
 />

 {/* ---- Modal: ubah peran/unit/cabang/status ---- */}
 <Modal open={!!edit} onClose={() => setEdit(null)} title="Ubah Data Pengguna" subtitle={edit?.full_name}
 footer={<>
 <Button variant="outline" onClick={() => setEdit(null)}>Batal</Button>
 <Button loading={saving} onClick={save}>Simpan</Button>
 </>}>
 {edit && (
 <div className="space-y-4">
 <Field label="Jabatan">
 <Select value={edit.role} onChange={(e: any) => setEdit({ ...edit, role: e.target.value })}
 options={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))} />
 </Field>
 <Field label="Unit">
 <Select value={edit.unit ?? ''} onChange={(e: any) => setEdit({ ...edit, unit: e.target.value })} options={UNITS} />
 </Field>
 <Field label="Cabang">
 <Select value={edit.branch_id ?? ''} onChange={(e: any) => setEdit({ ...edit, branch_id: e.target.value })}
 options={branches.map(b => ({ value: b.id, label: b.name }))} />
 </Field>
 <Checkbox label="Akun aktif" checked={edit.is_active} onChange={(e: any) => setEdit({ ...edit, is_active: e.target.checked })} />
 </div>
 )}
 </Modal>

 {/* ---- Modal: tambah pengguna ---- */}
 <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Tambah Pengguna" subtitle="Buat akun login baru untuk panel admin"
 footer={<>
 <Button variant="outline" onClick={() => setShowAdd(false)}>Batal</Button>
 <Button loading={creating} onClick={submitAdd}>Buat Pengguna</Button>
 </>}>
 <div className="space-y-4">
 <Field label="Nama Lengkap" required>
 <Input value={addForm.full_name} onChange={(e: any) => setAddForm({ ...addForm, full_name: e.target.value })} placeholder="cth. Budi Santoso" />
 </Field>
 <Field label="Email" required>
 <Input type="email" value={addForm.email} onChange={(e: any) => setAddForm({ ...addForm, email: e.target.value })} placeholder="nama@nusakarya.id" />
 </Field>
 <Field label="Kata Sandi" required hint="Minimal 8 karakter, mengandung huruf dan angka">
 <div className="flex gap-2">
 <div className="relative flex-1">
 <Input type={addForm.showPw ? 'text' : 'password'} value={addForm.password}
 onChange={(e: any) => setAddForm({ ...addForm, password: e.target.value })} className="pr-9" />
 <button type="button" className="absolute right-2.5 top-2.5 text-ink-400 hover:text-ink-600"
 onClick={() => setAddForm({ ...addForm, showPw: !addForm.showPw })}>
 {addForm.showPw ? <EyeOff size={16} /> : <Eye size={16} />}
 </button>
 </div>
 <Button type="button" variant="outline" icon={<Wand2 size={15} />}
 onClick={() => { const pw = generatePassword(); setAddForm({ ...addForm, password: pw, confirm: pw, showPw: true }) }}>
 Buatkan kata sandi
 </Button>
 </div>
 </Field>
 <Field label="Ulangi Kata Sandi" required>
 <Input type={addForm.showPw ? 'text' : 'password'} value={addForm.confirm}
 onChange={(e: any) => setAddForm({ ...addForm, confirm: e.target.value })} />
 </Field>
 <Field label="Jabatan" required>
 <Select value={addForm.role} onChange={(e: any) => setAddForm({ ...addForm, role: e.target.value })}
 options={Object.entries(ROLE_LABEL).filter(([v]) => v !== 'super_admin' || profile?.role === 'super_admin').map(([value, label]) => ({ value, label }))} />
 </Field>
 <Field label="Unit">
 <Select value={addForm.unit} onChange={(e: any) => setAddForm({ ...addForm, unit: e.target.value })} options={UNITS} />
 </Field>
 <Field label="Cabang">
 <Select value={addForm.branch_id} onChange={(e: any) => setAddForm({ ...addForm, branch_id: e.target.value })}
 options={branches.map(b => ({ value: b.id, label: b.name }))} />
 </Field>
 <Field label="Telepon">
 <Input value={addForm.phone} onChange={(e: any) => setAddForm({ ...addForm, phone: e.target.value })} placeholder="08xxxxxxxxxx" />
 </Field>
 <Field label="Tautkan ke Karyawan (opsional)" hint="Cari karyawan yang belum memiliki akun login">
 <div className="space-y-2">
 <Input placeholder="Cari nama karyawan…" value={addForm.employeeQuery}
 onChange={(e: any) => setAddForm({ ...addForm, employeeQuery: e.target.value })} />
 <Select value={addForm.employee_id} onChange={(e: any) => setAddForm({ ...addForm, employee_id: e.target.value })}
 placeholder="— tidak ditautkan —"
 options={filteredEmployees.map(e => ({ value: e.id, label: e.full_name }))} />
 </div>
 </Field>
 </div>
 </Modal>

 {/* ---- Panel tampil sekali: email + kata sandi setelah pengguna dibuat ---- */}
 <Modal open={!!createdInfo} onClose={() => setCreatedInfo(null)} title="Pengguna Berhasil Dibuat" size="sm"
 footer={<Button onClick={() => setCreatedInfo(null)}>Selesai</Button>}>
 {createdInfo && (
 <div className="space-y-4">
 <div className="flex gap-2.5 p-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900">
 <ShieldAlert size={18} className="text-amber-600 mt-0.5 shrink-0" />
 <p className="text-caption text-ink-700">
 Kata sandi ini <b>hanya ditampilkan sekali</b> dan tidak disimpan oleh sistem. Segera sampaikan secara aman kepada
 pengguna dan wajibkan mereka menggantinya setelah masuk pertama kali.
 </p>
 </div>
 <Field label="Email">
 <div className="flex gap-2">
 <Input readOnly value={createdInfo.email} className="flex-1" />
 <Button variant="outline" icon={<Copy size={14} />} onClick={() => copyText(createdInfo.email)}>Salin</Button>
 </div>
 </Field>
 <Field label="Kata Sandi">
 <div className="flex gap-2">
 <Input readOnly value={createdInfo.password} className="flex-1 tabular" />
 <Button variant="outline" icon={<Copy size={14} />} onClick={() => copyText(createdInfo.password)}>Salin</Button>
 </div>
 </Field>
 </div>
 )}
 </Modal>

 {/* ---- Modal: setel ulang kata sandi ---- */}
 <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title="Setel Ulang Kata Sandi" subtitle={resetTarget?.full_name} size="sm"
 footer={<>
 <Button variant="outline" onClick={() => setResetTarget(null)}>Batal</Button>
 <Button loading={resetting} onClick={submitReset}>Simpan Kata Sandi</Button>
 </>}>
 {resetTarget && (
 <div className="space-y-4">
 <Field label="Kata Sandi Baru" required hint="Minimal 8 karakter, mengandung huruf dan angka">
 <div className="flex gap-2">
 <div className="relative flex-1">
 <Input type={resetPw.show ? 'text' : 'password'} value={resetPw.password}
 onChange={(e: any) => setResetPw({ ...resetPw, password: e.target.value })} className="pr-9" />
 <button type="button" className="absolute right-2.5 top-2.5 text-ink-400 hover:text-ink-600"
 onClick={() => setResetPw({ ...resetPw, show: !resetPw.show })}>
 {resetPw.show ? <EyeOff size={16} /> : <Eye size={16} />}
 </button>
 </div>
 <Button type="button" variant="outline" icon={<Wand2 size={15} />}
 onClick={() => { const pw = generatePassword(); setResetPw({ ...resetPw, password: pw, confirm: pw, show: true }) }}>
 Buatkan
 </Button>
 </div>
 </Field>
 <Field label="Ulangi Kata Sandi" required>
 <Input type={resetPw.show ? 'text' : 'password'} value={resetPw.confirm}
 onChange={(e: any) => setResetPw({ ...resetPw, confirm: e.target.value })} />
 </Field>
 <p className="text-caption text-ink-400">Kata sandi baru tidak akan ditampilkan lagi setelah jendela ini ditutup. Segera sampaikan ke pengguna secara aman.</p>
 </div>
 )}
 </Modal>

 <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} danger
 title="Hapus Pengguna" confirmLabel="Ya, hapus"
 message={`Akun login "${deleteTarget?.full_name}" (${deleteTarget?.email}) akan dihapus permanen dan tidak dapat masuk lagi. Tindakan ini tidak dapat dibatalkan.`}
 onConfirm={submitDelete} />
 </div>
 )
}
