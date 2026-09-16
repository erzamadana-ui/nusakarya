import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import {
 PageHeader, Card, Button, Modal, ConfirmDialog, Field, Select, Input, Badge, useToast, EmptyState, TableSkeleton, cx,
} from '@/components/ui'
import { tgl } from '@/lib/format'
import { Settings, ChevronLeft, ChevronRight, X } from 'lucide-react'

const DAY_LABEL = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

function startOfWeek(dateStr: string) {
 const d = new Date(dateStr + 'T00:00:00')
 const day = (d.getDay() + 6) % 7 // 0 = Senin
 d.setDate(d.getDate() - day)
 return d
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
const iso = (d: Date) => d.toISOString().slice(0, 10)

const emptyShift = { id: null, code: '', name: '', start_time: '08:00', end_time: '17:00' }

export default function Roster() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [employees, setEmployees] = useState<any[]>([])
 const [shifts, setShifts] = useState<any[]>([])
 const [rosterMap, setRosterMap] = useState<Record<string, any>>({})
 const [anchor, setAnchor] = useState(new Date().toISOString().slice(0, 10))

 const monday = useMemo(() => startOfWeek(anchor), [anchor])
 const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday])

 const [cell, setCell] = useState<any>(null)
 const [cellShift, setCellShift] = useState('')
 const [saving, setSaving] = useState(false)
 const [shiftModal, setShiftModal] = useState(false)
 const [shiftForm, setShiftForm] = useState<any>(emptyShift)
 const [shiftSaving, setShiftSaving] = useState(false)
 const [delShiftId, setDelShiftId] = useState<string | null>(null)

 useEffect(() => { load() }, [anchor])

 async function load() {
 setLoading(true)
 try {
 const [emp, sh, ro] = await Promise.all([
 list<any>('employees', { select: 'id,full_name,position', eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
 list<any>('shifts', { order: { col: 'start_time', asc: true } }),
 list<any>('rosters', { gte: { work_date: iso(monday) }, lte: { work_date: iso(week[6]) } }),
 ])
 setEmployees(emp); setShifts(sh)
 const m: Record<string, any> = {}
 ro.forEach(r => { m[`${r.employee_id}_${r.work_date}`] = r })
 setRosterMap(m)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat roster', 'error') }
 finally { setLoading(false) }
 }

 function openCell(emp: any, date: Date) {
 if (!can('HR', 'write')) return
 const key = `${emp.id}_${iso(date)}`
 setCell({ emp, date: iso(date), existing: rosterMap[key] })
 setCellShift(rosterMap[key]?.shift_id ?? '')
 }

 async function saveCell() {
 setSaving(true)
 try {
 if (!cellShift) {
 if (cell.existing) await remove('rosters', cell.existing.id)
 } else if (cell.existing) {
 await update('rosters', cell.existing.id, { shift_id: cellShift })
 } else {
 await insert('rosters', { company_id: profile?.company_id, employee_id: cell.emp.id, work_date: cell.date, shift_id: cellShift, created_by: profile?.id })
 }
 toast.push('Jadwal shift disimpan'); setCell(null); load()
 } catch (e: any) {
 const msg = /row-level security|permission denied/i.test(e.message ?? '') ? 'Gagal menyimpan jadwal — hak akses Anda pada modul HR tidak mengizinkan perubahan roster (perlu izin write).' : (e.message ?? 'Gagal menyimpan jadwal')
 toast.push(msg, 'error')
 }
 finally { setSaving(false) }
 }

 function openAddShift() { setShiftForm(emptyShift); setShiftModal(true) }
 function openEditShift(s: any) { setShiftForm(s); setShiftModal(true) }
 async function saveShift() {
 if (!shiftForm.code || !shiftForm.name) { toast.push('Kode dan nama shift wajib diisi', 'error'); return }
 setShiftSaving(true)
 try {
 if (shiftForm.id) await update('shifts', shiftForm.id, { code: shiftForm.code, name: shiftForm.name, start_time: shiftForm.start_time, end_time: shiftForm.end_time })
 else await insert('shifts', { company_id: profile?.company_id, code: shiftForm.code, name: shiftForm.name, start_time: shiftForm.start_time, end_time: shiftForm.end_time, created_by: profile?.id })
 toast.push('Master shift disimpan'); setShiftForm(emptyShift); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan shift', 'error') }
 finally { setShiftSaving(false) }
 }
 async function deleteShift(id: string) {
 try { await remove('shifts', id); toast.push('Shift dihapus'); load() }
 catch (e: any) {
 const msg = /row-level security|permission denied/i.test(e.message ?? '') ? 'Gagal menghapus shift — hak akses Anda pada modul HR tidak mengizinkan penghapusan (perlu izin write).' : (e.message ?? 'Gagal menghapus shift')
 toast.push(msg, 'error')
 }
 finally { setDelShiftId(null) }
 }

 return (
 <div>
 <PageHeader title="Roster & Shift" subtitle="Penjadwalan shift kerja mingguan per karyawan"
 actions={can('HR', 'write') && <Button variant="outline" icon={<Settings size={16} />} onClick={openAddShift}>Kelola Shift</Button>} />

 <Card className="mb-5 p-3 flex items-center justify-between flex-wrap gap-2">
 <div className="flex items-center gap-2">
 <Button size="sm" variant="outline" icon={<ChevronLeft size={14} />} onClick={() => setAnchor(iso(addDays(monday, -7)))}>Minggu Lalu</Button>
 <Button size="sm" variant="outline" onClick={() => setAnchor(new Date().toISOString().slice(0, 10))}>Minggu Ini</Button>
 <Button size="sm" variant="outline" onClick={() => setAnchor(iso(addDays(monday, 7)))}>Minggu Depan<ChevronRight size={14} /></Button>
 </div>
 <span className="text-body font-medium text-ink-700">{tgl(iso(monday))} – {tgl(iso(week[6]))}</span>
 <Input type="date" value={anchor} onChange={(e: any) => setAnchor(e.target.value)} className="w-40" />
 </Card>

 <Card className="overflow-auto">
 {loading ? <TableSkeleton rows={6} /> : employees.length === 0 ? <EmptyState title="Belum ada karyawan aktif" /> : (
 <table className="w-full text-body border-separate border-spacing-0 min-w-[760px]">
 <thead className="bg-ink-50 sticky top-0">
 <tr>
 <th className="px-3 h-11 text-left font-semibold text-caption uppercase text-ink-500 border-b border-ink-200 sticky left-0 bg-ink-50">Karyawan</th>
 {week.map((d, i) => <th key={i} className="px-2 h-11 text-center font-semibold text-caption uppercase text-ink-500 border-b border-ink-200 whitespace-nowrap">{DAY_LABEL[i]}<br /><span className="font-normal normal-case">{d.getDate()}/{d.getMonth() + 1}</span></th>)}
 </tr>
 </thead>
 <tbody>
 {employees.map(emp => (
 <tr key={emp.id} className="border-b border-ink-100">
 <td className="px-3 py-2 sticky left-0 bg-surface text-ink-800 font-medium whitespace-nowrap">{emp.full_name}</td>
 {week.map((d, i) => {
 const key = `${emp.id}_${iso(d)}`; const r = rosterMap[key]; const sh = shifts.find(s => s.id === r?.shift_id)
 const writable = can('HR', 'write')
 return <td key={i} className={cx('px-1 py-1.5 text-center', writable && 'cursor-pointer hover:bg-primary-50/60')} onClick={writable ? () => openCell(emp, d) : undefined}>
 {sh ? <Badge tone="teal">{sh.code}</Badge> : <span className="text-ink-300 text-caption">—</span>}
 </td>
 })}
 </tr>))}
 </tbody>
 </table>)}
 </Card>

 <Modal open={!!cell} onClose={() => setCell(null)} title="Tetapkan Shift" size="sm"
 footer={<><Button variant="outline" onClick={() => setCell(null)}>Batal</Button><Button loading={saving} onClick={saveCell}>Simpan</Button></>}>
 {cell && <div className="space-y-3">
 <p className="text-body text-ink-600">{cell.emp.full_name} · {tgl(cell.date)}</p>
 <Field label="Shift"><Select value={cellShift} onChange={(e: any) => setCellShift(e.target.value)} options={shifts.map(s => ({ value: s.id, label: `${s.code} — ${s.name} (${s.start_time?.slice(0, 5)}–${s.end_time?.slice(0, 5)})` }))} placeholder="Kosongkan / libur" /></Field>
 </div>}
 </Modal>

 <Modal open={shiftModal} onClose={() => setShiftModal(false)} title="Kelola Master Shift" size="md"
 footer={<Button variant="outline" onClick={() => setShiftModal(false)}>Tutup</Button>}>
 <div className="grid sm:grid-cols-4 gap-3 mb-4 items-end">
 <Field label="Kode"><Input value={shiftForm.code} onChange={(e: any) => setShiftForm({ ...shiftForm, code: e.target.value })} /></Field>
 <Field label="Nama"><Input value={shiftForm.name} onChange={(e: any) => setShiftForm({ ...shiftForm, name: e.target.value })} /></Field>
 <Field label="Mulai"><Input type="time" value={shiftForm.start_time} onChange={(e: any) => setShiftForm({ ...shiftForm, start_time: e.target.value })} /></Field>
 <Field label="Selesai"><Input type="time" value={shiftForm.end_time} onChange={(e: any) => setShiftForm({ ...shiftForm, end_time: e.target.value })} /></Field>
 <Button className="sm:col-span-4" loading={shiftSaving} onClick={saveShift}>{shiftForm.id ? 'Perbarui Shift' : 'Tambah Shift'}</Button>
 </div>
 <div className="space-y-1.5">
 {shifts.map(s => (
 <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-sm border border-ink-200">
 <div><span className="font-medium text-ink-800">{s.code}</span> <span className="text-ink-500">— {s.name}</span> <span className="text-caption text-ink-400">({s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)})</span></div>
 <div className="flex items-center gap-1">
 <Button size="sm" variant="ghost" onClick={() => openEditShift(s)}>Ubah</Button>
 <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDelShiftId(s.id)}><X size={14} /></Button>
 </div>
 </div>))}
 {shifts.length === 0 && <p className="text-caption text-ink-400">Belum ada master shift.</p>}
 </div>
 </Modal>

 <ConfirmDialog open={!!delShiftId} onClose={() => setDelShiftId(null)} onConfirm={() => deleteShift(delShiftId!)}
 title="Hapus Shift" message="Shift ini akan dihapus dari master. Jadwal yang sudah menggunakan shift ini tidak akan otomatis terhapus." danger confirmLabel="Ya, hapus" />
 </div>
 )
}
