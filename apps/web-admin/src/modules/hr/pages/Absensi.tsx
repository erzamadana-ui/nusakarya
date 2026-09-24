import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, signedUrl } from '@/lib/db'
import {
 PageHeader, DataTable, Badge, Button, Modal, Field, Select, Input, FilterBar,
 KpiCard, useToast, Plus,
} from '@/components/ui'
import { tgl, tglJam, todayISO, durasi } from '@/lib/format'
import { mapsLink } from '../lib/constants'
import { MapPin, Image as ImageIcon, Users } from 'lucide-react'

const ATTENDANCE_STATUS_OPTIONS = ['hadir', 'terlambat', 'izin', 'sakit', 'cuti', 'alpa', 'libur']
const BULK_STATUS_OPTIONS = ['hadir', 'izin', 'sakit', 'cuti', 'alpa']

const emptyManual = { employee_id: '', work_date: todayISO(), check_in_time: '', check_out_time: '', shift_id: '', status: 'hadir', note: '' }

function PhotoThumb({ path, onZoom }: { path?: string | null; onZoom: (url: string) => void }) {
 const [url, setUrl] = useState<string | null>(null)
 useEffect(() => { let alive = true; if (path) signedUrl(path).then(u => { if (alive) setUrl(u) }); return () => { alive = false } }, [path])
 if (!path) return <span className="text-ink-300">-</span>
 if (!url) return <div className="w-9 h-9 rounded-sm bg-ink-100 grid place-items-center"><ImageIcon size={14} className="text-ink-400" /></div>
 return <img src={url} onClick={() => onZoom(url)} className="w-9 h-9 rounded-sm object-cover cursor-zoom-in border border-ink-200" />
}

export default function Absensi() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [branches, setBranches] = useState<any[]>([])
 const [employees, setEmployees] = useState<any[]>([])
 const [shifts, setShifts] = useState<any[]>([])
 const [start, setStart] = useState(() => todayISO().slice(0, 8) + '01')
 const [end, setEnd] = useState(todayISO())
 const [branch, setBranch] = useState('')
 const [zoom, setZoom] = useState<string | null>(null)
 const [koreksi, setKoreksi] = useState<any>(null)
 const [saving, setSaving] = useState(false)

 // Tambah manual (satu karyawan)
 const [manualOpen, setManualOpen] = useState(false)
 const [manualForm, setManualForm] = useState<any>(emptyManual)
 const [manualSaving, setManualSaving] = useState(false)

 // Input massal (satu tanggal, pilih cabang)
 const [bulkOpen, setBulkOpen] = useState(false)
 const [bulkDate, setBulkDate] = useState(todayISO())
 const [bulkBranch, setBulkBranch] = useState('')
 const [bulkEmployees, setBulkEmployees] = useState<any[]>([])
 const [bulkLoading, setBulkLoading] = useState(false)
 const [bulkStatuses, setBulkStatuses] = useState<Record<string, string>>({})
 const [bulkSaving, setBulkSaving] = useState(false)

 useEffect(() => { load() }, [start, end])
 useEffect(() => {
 Promise.all([
 list<any>('employees', { select: 'id,full_name,branch_id', eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
 list<any>('shifts', { order: { col: 'name', asc: true } }),
 ]).then(([emp, sh]) => { setEmployees(emp); setShifts(sh) }).catch(() => {})
 }, [])

 async function load() {
 setLoading(true)
 try {
 const [att, br] = await Promise.all([
 list<any>('attendances', { select: '*,employees(full_name,branch_id,branches(name))', gte: { work_date: start }, lte: { work_date: end }, order: { col: 'work_date', asc: false } }),
 list<any>('branches', { select: 'id,name', order: { col: 'name', asc: true } }),
 ])
 setRows(att); setBranches(br)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data absensi', 'error') }
 finally { setLoading(false) }
 }

 const filtered = useMemo(() => rows.filter(r => !branch || r.employees?.branch_id === branch), [rows, branch])
 const kpi = useMemo(() => ({
 hadir: filtered.filter(r => r.status === 'hadir').length,
 terlambat: filtered.filter(r => r.status === 'terlambat' || (r.late_minutes ?? 0) > 0).length,
 alpa: filtered.filter(r => r.status === 'alpa').length,
 cuti: filtered.filter(r => r.status === 'cuti' || r.status === 'izin').length,
 }), [filtered])

 function friendlyError(e: any, fallback: string) {
 const msg = e?.message ?? ''
 if (/row-level security|permission denied/i.test(msg)) return 'Gagal menyimpan — hak akses Anda pada modul HR tidak mengizinkan tindakan ini (perlu izin write/approve).'
 if (/duplicate key|unique constraint/i.test(msg)) return 'Absensi karyawan ini pada tanggal tersebut sudah tercatat. Gunakan "Koreksi" untuk mengubahnya.'
 return msg || fallback
 }

 // ---------- Tambah manual (satu karyawan) ----------
 function openManual() { setManualForm(emptyManual); setManualOpen(true) }
 async function saveManual() {
 if (!manualForm.employee_id || !manualForm.work_date || !manualForm.status) { toast.push('Karyawan, tanggal, dan status wajib diisi', 'error'); return }
 if (!manualForm.note?.trim()) { toast.push('Keterangan wajib diisi untuk absensi input manual, agar bisa diaudit terpisah dari absensi GPS otomatis', 'error'); return }
 setManualSaving(true)
 try {
 await insert('attendances', {
 company_id: profile?.company_id, employee_id: manualForm.employee_id, work_date: manualForm.work_date,
 check_in_at: manualForm.check_in_time ? `${manualForm.work_date}T${manualForm.check_in_time}:00` : null,
 check_out_at: manualForm.check_out_time ? `${manualForm.work_date}T${manualForm.check_out_time}:00` : null,
 shift_id: manualForm.shift_id || null, status: manualForm.status, note: manualForm.note,
 created_by: profile?.id,
 })
 toast.push('Absensi manual dicatat'); setManualOpen(false); load()
 } catch (e: any) { toast.push(friendlyError(e, 'Gagal mencatat absensi manual'), 'error') }
 finally { setManualSaving(false) }
 }

 // ---------- Koreksi baris yang sudah ada ----------
 function openKoreksi(r: any) {
 setKoreksi({ ...r, check_in_time: r.check_in_at ? r.check_in_at.slice(11, 16) : '', check_out_time: r.check_out_at ? r.check_out_at.slice(11, 16) : '', koreksi_alasan: '' })
 }
 async function simpanKoreksi() {
 if (!koreksi.koreksi_alasan?.trim()) { toast.push('Alasan koreksi wajib diisi', 'error'); return }
 setSaving(true)
 try {
 const payload: any = {
 status: koreksi.status, late_minutes: Number(koreksi.late_minutes) || 0,
 note: `${koreksi.note ? koreksi.note + '\n\n' : ''}Koreksi oleh ${profile?.full_name ?? 'pengguna'} pada ${tgl(todayISO())}: ${koreksi.koreksi_alasan}`.trim(),
 check_in_at: koreksi.check_in_time ? `${koreksi.work_date}T${koreksi.check_in_time}:00` : null,
 check_out_at: koreksi.check_out_time ? `${koreksi.work_date}T${koreksi.check_out_time}:00` : null,
 }
 await update('attendances', koreksi.id, payload)
 toast.push('Koreksi absensi disimpan'); setKoreksi(null); load()
 } catch (e: any) { toast.push(friendlyError(e, 'Gagal menyimpan koreksi'), 'error') }
 finally { setSaving(false) }
 }

 // ---------- Input massal ----------
 function openBulk() { setBulkDate(todayISO()); setBulkBranch(''); setBulkEmployees([]); setBulkStatuses({}); setBulkOpen(true) }
 async function loadBulkEmployees() {
 if (!bulkBranch) { toast.push('Pilih cabang terlebih dahulu', 'error'); return }
 setBulkLoading(true)
 try {
 const [emp, existing] = await Promise.all([
 list<any>('employees', { select: 'id,full_name,position', eq: { status: 'aktif', branch_id: bulkBranch }, order: { col: 'full_name', asc: true } }),
 list<any>('attendances', { select: 'employee_id,status', eq: { work_date: bulkDate } }),
 ])
 setBulkEmployees(emp)
 const existingMap: Record<string, string> = {}
 existing.forEach((a: any) => { existingMap[a.employee_id] = a.status })
 const init: Record<string, string> = {}
 emp.forEach((e: any) => { init[e.id] = existingMap[e.id] ?? '' })
 setBulkStatuses(init)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat daftar teknisi cabang', 'error') }
 finally { setBulkLoading(false) }
 }
 function setAllBulkStatus(s: string) {
 const next: Record<string, string> = {}
 bulkEmployees.forEach(e => { next[e.id] = s })
 setBulkStatuses(next)
 }
 async function saveBulk() {
 const toSave = bulkEmployees.filter(e => bulkStatuses[e.id])
 if (!toSave.length) { toast.push('Tandai status minimal satu karyawan', 'error'); return }
 setBulkSaving(true)
 try {
 const existing = await list<any>('attendances', { select: 'id,employee_id', eq: { work_date: bulkDate } })
 const existingByEmp: Record<string, string> = {}
 existing.forEach((a: any) => { existingByEmp[a.employee_id] = a.id })
 for (const e of toSave) {
 const status = bulkStatuses[e.id]
 if (existingByEmp[e.id]) {
 await update('attendances', existingByEmp[e.id], { status, note: `Diperbarui via input massal oleh ${profile?.full_name ?? 'pengguna'} pada ${tgl(todayISO())}` })
 } else {
 await insert('attendances', {
 company_id: profile?.company_id, employee_id: e.id, work_date: bulkDate, status,
 note: `Dicatat via input massal oleh ${profile?.full_name ?? 'pengguna'}`, created_by: profile?.id,
 })
 }
 }
 toast.push(`${toSave.length} absensi tersimpan untuk ${tgl(bulkDate)}`); setBulkOpen(false); load()
 } catch (e: any) { toast.push(friendlyError(e, 'Gagal menyimpan input massal'), 'error') }
 finally { setBulkSaving(false) }
 }

 return (
 <div>
 <PageHeader title="Absensi Lapangan" subtitle="Rekap kehadiran karyawan per tanggal dan cabang"
 actions={can('HR', 'write') && <div className="flex gap-2">
 <Button variant="outline" icon={<Users size={16} />} onClick={openBulk}>Input Massal</Button>
 <Button icon={<Plus size={16} />} onClick={openManual}>Catat Absensi</Button>
 </div>} />

 <FilterBar>
 <Field label="Dari Tanggal"><Input type="date" value={start} onChange={(e: any) => setStart(e.target.value)} /></Field>
 <Field label="Sampai Tanggal"><Input type="date" value={end} onChange={(e: any) => setEnd(e.target.value)} /></Field>
 <Field label="Cabang" className="w-48"><Select value={branch} onChange={(e: any) => setBranch(e.target.value)} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="Semua cabang" /></Field>
 </FilterBar>

 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
 <KpiCard label="Hadir" value={kpi.hadir} tone="emerald" />
 <KpiCard label="Terlambat" value={kpi.terlambat} tone="orange" />
 <KpiCard label="Alpa" value={kpi.alpa} tone="red" />
 <KpiCard label="Cuti/Izin" value={kpi.cuti} tone="amber" />
 </div>

 <DataTable
 loading={loading} rows={filtered} searchKeys={['status']} exportName="rekap-absensi"
 emptyTitle="Belum ada data absensi pada rentang ini"
 columns={[
 { key: 'nama', header: 'Nama', render: r => r.employees?.full_name ?? '-' },
 { key: 'cabang', header: 'Cabang', render: r => r.employees?.branches?.name ?? '-' },
 { key: 'work_date', header: 'Tanggal', render: r => tgl(r.work_date) },
 { key: 'check_in_at', header: 'Jam Masuk', render: r => r.check_in_at ? r.check_in_at.slice(11, 16) : '-' },
 { key: 'check_out_at', header: 'Jam Keluar', render: r => r.check_out_at ? r.check_out_at.slice(11, 16) : '-' },
 { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
 { key: 'late_minutes', header: 'Terlambat', align: 'right', render: r => `${r.late_minutes ?? 0} mnt` },
 { key: 'work_minutes', header: 'Jam Kerja', align: 'right', render: r => durasi(r.work_minutes) },
 { key: 'overtime_minutes', header: 'Lembur', align: 'right', render: r => durasi(r.overtime_minutes) },
 { key: 'lokasi', header: 'Lokasi', render: r => { const link = mapsLink(r.check_in_lat, r.check_in_lng); return link
 ? <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-600 hover:underline"><MapPin size={13} />Peta</a>
 : <span className="text-ink-300">-</span> } },
 { key: 'foto', header: 'Selfie', align: 'center', render: r => <PhotoThumb path={r.check_in_photo_url} onZoom={setZoom} /> },
 ...(can('HR', 'approve') ? [{ key: 'aksi', header: 'Aksi', align: 'center' as const, sortable: false, render: (r: any) => <Button size="sm" variant="outline" onClick={(e: any) => { e.stopPropagation(); openKoreksi(r) }}>Koreksi</Button> }] : []),
 ]}
 />

 <Modal open={!!zoom} onClose={() => setZoom(null)} title="Foto Selfie Absensi" size="sm">
 {zoom && <img src={zoom} className="w-full rounded-md" />}
 </Modal>

 <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Catat Absensi Manual"
 footer={<><Button variant="outline" onClick={() => setManualOpen(false)}>Batal</Button><Button loading={manualSaving} onClick={saveManual}>Simpan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Karyawan" required className="sm:col-span-2">
 <Select value={manualForm.employee_id} onChange={(e: any) => setManualForm({ ...manualForm, employee_id: e.target.value })} options={employees.map(e => ({ value: e.id, label: e.full_name }))} />
 </Field>
 <Field label="Tanggal" required><Input type="date" value={manualForm.work_date} onChange={(e: any) => setManualForm({ ...manualForm, work_date: e.target.value })} /></Field>
 <Field label="Shift"><Select value={manualForm.shift_id} onChange={(e: any) => setManualForm({ ...manualForm, shift_id: e.target.value })} options={shifts.map(s => ({ value: s.id, label: `${s.name} (${s.start_time?.slice(0, 5)}-${s.end_time?.slice(0, 5)})` }))} placeholder="Tanpa shift" /></Field>
 <Field label="Jam Masuk"><Input type="time" value={manualForm.check_in_time} onChange={(e: any) => setManualForm({ ...manualForm, check_in_time: e.target.value })} /></Field>
 <Field label="Jam Keluar"><Input type="time" value={manualForm.check_out_time} onChange={(e: any) => setManualForm({ ...manualForm, check_out_time: e.target.value })} /></Field>
 <Field label="Status" required><Select value={manualForm.status} onChange={(e: any) => setManualForm({ ...manualForm, status: e.target.value })} options={ATTENDANCE_STATUS_OPTIONS} /></Field>
 <Field label="Keterangan" required hint="Wajib diisi — mis. alasan lupa check-in, bekerja offline, dll." className="sm:col-span-2">
 <Input value={manualForm.note} onChange={(e: any) => setManualForm({ ...manualForm, note: e.target.value })} />
 </Field>
 </div>
 </Modal>

 <Modal open={!!koreksi} onClose={() => setKoreksi(null)} title="Koreksi Absensi Manual"
 footer={<><Button variant="outline" onClick={() => setKoreksi(null)}>Batal</Button><Button loading={saving} onClick={simpanKoreksi}>Simpan</Button></>}>
 {koreksi && <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Karyawan" className="sm:col-span-2"><Input value={koreksi.employees?.full_name ?? '-'} disabled /></Field>
 <Field label="Jam Masuk"><Input type="time" value={koreksi.check_in_time} onChange={(e: any) => setKoreksi({ ...koreksi, check_in_time: e.target.value })} /></Field>
 <Field label="Jam Keluar"><Input type="time" value={koreksi.check_out_time} onChange={(e: any) => setKoreksi({ ...koreksi, check_out_time: e.target.value })} /></Field>
 <Field label="Status"><Select value={koreksi.status ?? ''} onChange={(e: any) => setKoreksi({ ...koreksi, status: e.target.value })} options={ATTENDANCE_STATUS_OPTIONS} /></Field>
 <Field label="Terlambat (menit)"><Input type="number" value={koreksi.late_minutes ?? 0} onChange={(e: any) => setKoreksi({ ...koreksi, late_minutes: e.target.value })} /></Field>
 <Field label="Alasan Koreksi" required hint="Wajib diisi — dicatat terpisah pada riwayat catatan absensi." className="sm:col-span-2">
 <Input value={koreksi.koreksi_alasan ?? ''} onChange={(e: any) => setKoreksi({ ...koreksi, koreksi_alasan: e.target.value })} />
 </Field>
 </div>}
 </Modal>

 <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Input Absensi Massal" size="lg"
 footer={<><Button variant="outline" onClick={() => setBulkOpen(false)}>Batal</Button><Button loading={bulkSaving} onClick={saveBulk} disabled={!bulkEmployees.length}>Simpan {bulkEmployees.filter(e => bulkStatuses[e.id]).length} Absensi</Button></>}>
 <div className="space-y-4">
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Tanggal" required><Input type="date" value={bulkDate} onChange={(e: any) => setBulkDate(e.target.value)} /></Field>
 <Field label="Cabang" required><Select value={bulkBranch} onChange={(e: any) => setBulkBranch(e.target.value)} options={branches.map(b => ({ value: b.id, label: b.name }))} /></Field>
 </div>
 <Button size="sm" variant="outline" loading={bulkLoading} onClick={loadBulkEmployees}>Muat Daftar Teknisi Cabang</Button>
 {bulkEmployees.length > 0 && <>
 <div className="flex flex-wrap items-center gap-2 text-caption text-ink-500">
 <span>Tandai semua:</span>
 {BULK_STATUS_OPTIONS.map(s => <Button key={s} size="sm" variant="outline" onClick={() => setAllBulkStatus(s)}>{s}</Button>)}
 <Button size="sm" variant="outline" onClick={() => setAllBulkStatus('')}>Kosongkan</Button>
 </div>
 <div className="max-h-80 overflow-y-auto border border-ink-200 rounded-md divide-y divide-ink-100">
 {bulkEmployees.map(e => (
 <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2">
 <div>
 <p className="text-body text-ink-800">{e.full_name}</p>
 <p className="text-caption text-ink-400">{e.position ?? '-'}</p>
 </div>
 <div className="w-40"><Select value={bulkStatuses[e.id] ?? ''} onChange={(ev: any) => setBulkStatuses({ ...bulkStatuses, [e.id]: ev.target.value })} options={BULK_STATUS_OPTIONS} placeholder="- belum ditandai -" /></div>
 </div>
 ))}
 </div>
 </>}
 </div>
 </Modal>
 </div>
 )
}
