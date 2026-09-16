import React, { useEffect, useMemo, useState } from 'react'
import { chartColors } from '@/lib/theme'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, insert } from '@/lib/db'
import { PageHeader, Card, CardHeader, KpiCard, DataTable, Badge, TableSkeleton, EmptyState, Button, Modal, Field, Select, Input, Textarea, useToast, Plus } from '@/components/ui'
import { tgl, todayISO } from '@/lib/format'
import { Users, UserCheck, FileWarning, Award, Clock } from 'lucide-react'
import { expiryTone } from '../lib/constants'

const ATTENDANCE_STATUS_OPTIONS = ['hadir', 'terlambat', 'izin', 'sakit', 'cuti', 'alpa', 'libur']
const LEAVE_TYPE_OPTIONS_QUICK = [
 { value: 'cuti_tahunan', label: 'Cuti Tahunan' },
 { value: 'sakit', label: 'Sakit' },
 { value: 'izin', label: 'Izin' },
 { value: 'melahirkan', label: 'Melahirkan' },
 { value: 'tanpa_keterangan', label: 'Tanpa Keterangan' },
]
const emptyAbsensi = { employee_id: '', work_date: todayISO(), check_in_time: '', check_out_time: '', status: 'hadir', note: '' }
const emptyCuti = { employee_id: '', leave_type: 'cuti_tahunan', start_date: todayISO(), end_date: todayISO(), reason: '' }

export default function DashboardHR() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [dash, setDash] = useState<any[]>([])
 const [contractsExp, setContractsExp] = useState<any[]>([])
 const [certsExp, setCertsExp] = useState<any[]>([])
 const [cutiHariIni, setCutiHariIni] = useState(0)
 const [employees, setEmployees] = useState<any[]>([])

 const [absensiOpen, setAbsensiOpen] = useState(false)
 const [absensiForm, setAbsensiForm] = useState<any>(emptyAbsensi)
 const [absensiSaving, setAbsensiSaving] = useState(false)
 const [cutiOpen, setCutiOpen] = useState(false)
 const [cutiForm, setCutiForm] = useState<any>(emptyCuti)
 const [cutiSaving, setCutiSaving] = useState(false)

 useEffect(() => { load() }, [])

 async function load() {
 setLoading(true)
 try {
 const today = todayISO()
 const in60 = new Date(); in60.setDate(in60.getDate() + 60)
 const in90 = new Date(); in90.setDate(in90.getDate() + 90)

 const [dv, employees, certs, cuti] = await Promise.all([
 list('v_dashboard_hr', {}).catch(() => []),
 list<any>('employees', { select: 'id,full_name,position,employment_type,contract_end,status', eq: { status: 'aktif' }, order: { col: 'contract_end', asc: true } }),
 list<any>('employee_certifications', { select: 'id,employee_id,cert_name,cert_type,expiry_date,status,employees(full_name)', order: { col: 'expiry_date', asc: true } }),
 list<any>('leave_requests', { select: 'id', eq: { status: 'disetujui' }, lte: { start_date: today }, gte: { end_date: today } }),
 ])
 setDash(dv as any[])
 setContractsExp((employees ?? []).filter((e: any) => e.employment_type === 'PKWT' && e.contract_end && e.contract_end <= in60.toISOString().slice(0, 10)))
 setCertsExp((certs ?? []).filter((c: any) => c.expiry_date && c.expiry_date <= in90.toISOString().slice(0, 10)))
 setCutiHariIni((cuti ?? []).length)
 setEmployees(employees ?? [])
 } finally { setLoading(false) }
 }

 function openAbsensi() { setAbsensiForm({ ...emptyAbsensi, work_date: todayISO() }); setAbsensiOpen(true) }
 async function saveAbsensi() {
 if (!absensiForm.employee_id || !absensiForm.work_date || !absensiForm.status) { toast.push('Karyawan, tanggal, dan status wajib diisi', 'error'); return }
 if (!absensiForm.note?.trim()) { toast.push('Keterangan wajib diisi untuk absensi input manual', 'error'); return }
 setAbsensiSaving(true)
 try {
 await insert('attendances', {
 company_id: profile?.company_id, employee_id: absensiForm.employee_id, work_date: absensiForm.work_date,
 check_in_at: absensiForm.check_in_time ? `${absensiForm.work_date}T${absensiForm.check_in_time}:00` : null,
 check_out_at: absensiForm.check_out_time ? `${absensiForm.work_date}T${absensiForm.check_out_time}:00` : null,
 status: absensiForm.status, note: absensiForm.note, created_by: profile?.id,
 })
 toast.push('Absensi manual dicatat'); setAbsensiOpen(false); load()
 } catch (e: any) {
 const raw = e?.message ?? ''
 const msg = /row-level security|permission denied/i.test(raw)
 ? 'Gagal menyimpan — hak akses Anda pada modul HR tidak mengizinkan tindakan ini.'
 : /duplicate key|unique constraint/i.test(raw)
 ? 'Absensi karyawan ini pada tanggal tersebut sudah tercatat. Gunakan menu Absensi Lapangan untuk mengoreksinya.'
 : (raw || 'Gagal mencatat absensi manual')
 toast.push(msg, 'error')
 } finally { setAbsensiSaving(false) }
 }

 function openCuti() { setCutiForm({ ...emptyCuti, start_date: todayISO(), end_date: todayISO() }); setCutiOpen(true) }
 async function saveCuti() {
 if (!cutiForm.employee_id || !cutiForm.start_date || !cutiForm.end_date) { toast.push('Karyawan, tanggal mulai, dan tanggal selesai wajib diisi', 'error'); return }
 if (cutiForm.end_date < cutiForm.start_date) { toast.push('Tanggal selesai tidak boleh mendahului tanggal mulai', 'error'); return }
 const days = Math.floor((new Date(cutiForm.end_date).getTime() - new Date(cutiForm.start_date).getTime()) / 86400000) + 1
 setCutiSaving(true)
 try {
 await insert('leave_requests', {
 company_id: profile?.company_id, employee_id: cutiForm.employee_id, leave_type: cutiForm.leave_type,
 start_date: cutiForm.start_date, end_date: cutiForm.end_date, days, reason: cutiForm.reason || null,
 status: 'diajukan', created_by: profile?.id,
 })
 toast.push('Pengajuan cuti dibuat'); setCutiOpen(false); load()
 } catch (e: any) {
 const msg = /row-level security|permission denied/i.test(e?.message ?? '') ? 'Gagal menyimpan — hak akses Anda pada modul HR tidak mengizinkan tindakan ini.' : (e.message ?? 'Gagal membuat pengajuan cuti')
 toast.push(msg, 'error')
 } finally { setCutiSaving(false) }
 }

 const totalAktif = useMemo(() => dash.reduce((s, r) => s + Number(r.headcount_aktif || 0), 0), [dash])
 const hadir = useMemo(() => dash.reduce((s, r) => s + Number(r.hadir_hari_ini || 0), 0), [dash])
 const terlambat = useMemo(() => dash.reduce((s, r) => s + Number(r.terlambat_hari_ini || 0), 0), [dash])
 const alpa = useMemo(() => dash.reduce((s, r) => s + Number(r.alpa_hari_ini || 0), 0), [dash])
 const kontrakHabis = useMemo(() => dash.reduce((s, r) => s + Number(r.contracts_expiring_60d || 0), 0), [dash])
 const sertifKedaluwarsa = useMemo(() => dash.reduce((s, r) => s + Number(r.certifications_expired || 0), 0), [dash])

 const perUnit = useMemo(() => {
 const m = new Map<string, number>()
 dash.forEach(r => m.set(r.unit || 'Lainnya', (m.get(r.unit || 'Lainnya') || 0) + Number(r.headcount_aktif || 0)))
 return Array.from(m, ([unit, jumlah]) => ({ unit, jumlah }))
 }, [dash])
 const perCabang = useMemo(() => {
 const m = new Map<string, number>()
 dash.forEach(r => m.set(r.branch_name || 'Tanpa Cabang', (m.get(r.branch_name || 'Tanpa Cabang') || 0) + Number(r.headcount_aktif || 0)))
 return Array.from(m, ([cabang, jumlah]) => ({ cabang, jumlah }))
 }, [dash])

 return (
 <div>
 <PageHeader title="Dashboard HR" subtitle="Ringkasan sumber daya manusia perusahaan" />

 {can('HR', 'write') && (
 <div className="flex flex-wrap gap-2 mb-6">
 <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={openAbsensi}>Catat Absensi Manual</Button>
 <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={openCuti}>Ajukan Cuti</Button>
 </div>
 )}

 <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
 <KpiCard label="Karyawan Aktif" value={totalAktif} icon={<Users size={16} />} tone="teal" />
 <KpiCard label="Hadir Hari Ini" value={hadir} icon={<UserCheck size={16} />} tone="emerald" />
 <KpiCard label="Terlambat" value={terlambat} icon={<Clock size={16} />} tone="orange" />
 <KpiCard label="Alpa" value={alpa} icon={<FileWarning size={16} />} tone="red" />
 <KpiCard label="Cuti Hari Ini" value={cutiHariIni} icon={<Award size={16} />} tone="amber" />
 </div>

 <div className="grid lg:grid-cols-2 gap-5 mb-6">
 <Card>
 <CardHeader title="Karyawan Aktif per Unit" />
 <div className="p-4 h-64">
 {loading ? <TableSkeleton rows={4} /> : perUnit.length === 0 ? <EmptyState title="Belum ada data" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={perUnit}>
 <CartesianGrid strokeDasharray="3 3" stroke={chartColors().grid} vertical={false} />
 <XAxis dataKey="unit" tick={{ fontSize: 11 }} />
 <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
 <Tooltip />
 <Bar dataKey="jumlah" fill={chartColors().primary} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 <Card>
 <CardHeader title="Karyawan Aktif per Cabang" />
 <div className="p-4 h-64">
 {loading ? <TableSkeleton rows={4} /> : perCabang.length === 0 ? <EmptyState title="Belum ada data" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={perCabang}>
 <CartesianGrid strokeDasharray="3 3" stroke={chartColors().grid} vertical={false} />
 <XAxis dataKey="cabang" tick={{ fontSize: 11 }} />
 <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
 <Tooltip />
 <Bar dataKey="jumlah" fill={chartColors().accent} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 </div>

 <div className="grid lg:grid-cols-2 gap-5">
 <Card className="overflow-hidden">
 <CardHeader title="Kontrak PKWT Akan Habis (<60 hari)" subtitle={`${kontrakHabis} kontrak terdeteksi`} />
 <DataTable
 loading={loading}
 columns={[
 { key: 'full_name', header: 'Nama' },
 { key: 'position', header: 'Jabatan' },
 { key: 'contract_end', header: 'Habis Kontrak', render: r => tgl(r.contract_end) },
 { key: 'sisa', header: 'Sisa', align: 'right', render: r => { const t = expiryTone(r.contract_end); return <Badge tone={t.tone}>{t.label}</Badge> } },
 ]}
 rows={contractsExp}
 searchable={false}
 pageSize={8}
 emptyTitle="Tidak ada kontrak yang akan habis"
 />
 </Card>
 <Card className="overflow-hidden">
 <CardHeader title="Sertifikasi Kedaluwarsa / Akan Habis" subtitle={`${sertifKedaluwarsa} sertifikat kedaluwarsa`} />
 <DataTable
 loading={loading}
 columns={[
 { key: 'nama', header: 'Nama', render: r => r.employees?.full_name ?? '-' },
 { key: 'cert_name', header: 'Sertifikat' },
 { key: 'expiry_date', header: 'Berakhir', render: r => tgl(r.expiry_date) },
 { key: 'sisa', header: 'Status', align: 'right', render: r => { const t = expiryTone(r.expiry_date); return <Badge tone={t.tone}>{t.label}</Badge> } },
 ]}
 rows={certsExp}
 searchable={false}
 pageSize={8}
 emptyTitle="Tidak ada sertifikasi yang akan habis"
 />
 </Card>
 </div>
 <p className="text-caption text-ink-400 mt-4">Sumber data: v_dashboard_hr, employees, employee_certifications, leave_requests — ditarik {tgl(todayISO())}.</p>

 <Modal open={absensiOpen} onClose={() => setAbsensiOpen(false)} title="Catat Absensi Manual"
 footer={<><Button variant="outline" onClick={() => setAbsensiOpen(false)}>Batal</Button><Button loading={absensiSaving} onClick={saveAbsensi}>Simpan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Karyawan" required className="sm:col-span-2">
 <Select value={absensiForm.employee_id} onChange={(e: any) => setAbsensiForm({ ...absensiForm, employee_id: e.target.value })}
 options={employees.map(e => ({ value: e.id, label: `${e.full_name} — ${e.position}` }))} />
 </Field>
 <Field label="Tanggal" required><Input type="date" value={absensiForm.work_date} onChange={(e: any) => setAbsensiForm({ ...absensiForm, work_date: e.target.value })} /></Field>
 <Field label="Status" required><Select value={absensiForm.status} onChange={(e: any) => setAbsensiForm({ ...absensiForm, status: e.target.value })} options={ATTENDANCE_STATUS_OPTIONS} /></Field>
 <Field label="Jam Masuk"><Input type="time" value={absensiForm.check_in_time} onChange={(e: any) => setAbsensiForm({ ...absensiForm, check_in_time: e.target.value })} /></Field>
 <Field label="Jam Keluar"><Input type="time" value={absensiForm.check_out_time} onChange={(e: any) => setAbsensiForm({ ...absensiForm, check_out_time: e.target.value })} /></Field>
 <Field label="Keterangan" required hint="Wajib diisi agar bisa diaudit terpisah dari absensi GPS otomatis" className="sm:col-span-2">
 <Textarea value={absensiForm.note} onChange={(e: any) => setAbsensiForm({ ...absensiForm, note: e.target.value })} placeholder="Alasan input manual, mis. lupa check-in / bekerja offline" />
 </Field>
 </div>
 </Modal>

 <Modal open={cutiOpen} onClose={() => setCutiOpen(false)} title="Ajukan Cuti"
 footer={<><Button variant="outline" onClick={() => setCutiOpen(false)}>Batal</Button><Button loading={cutiSaving} onClick={saveCuti}>Ajukan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Karyawan" required className="sm:col-span-2">
 <Select value={cutiForm.employee_id} onChange={(e: any) => setCutiForm({ ...cutiForm, employee_id: e.target.value })}
 options={employees.map(e => ({ value: e.id, label: `${e.full_name} — ${e.position}` }))} />
 </Field>
 <Field label="Jenis Cuti"><Select value={cutiForm.leave_type} onChange={(e: any) => setCutiForm({ ...cutiForm, leave_type: e.target.value })} options={LEAVE_TYPE_OPTIONS_QUICK} /></Field>
 <Field label="Tanggal Mulai" required><Input type="date" value={cutiForm.start_date} onChange={(e: any) => setCutiForm({ ...cutiForm, start_date: e.target.value })} /></Field>
 <Field label="Tanggal Selesai" required><Input type="date" value={cutiForm.end_date} onChange={(e: any) => setCutiForm({ ...cutiForm, end_date: e.target.value })} /></Field>
 <Field label="Alasan" className="sm:col-span-2"><Textarea value={cutiForm.reason} onChange={(e: any) => setCutiForm({ ...cutiForm, reason: e.target.value })} /></Field>
 </div>
 </Modal>
 </div>
 )
}
