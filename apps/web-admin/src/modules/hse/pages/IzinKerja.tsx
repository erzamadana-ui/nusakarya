import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import {
 PageHeader, Card, CardHeader, DataTable, Badge, Button, Modal, Drawer, Tabs, Field, Input, Select,
 Checkbox, KpiCard, Desc, Section, ConfirmDialog, useToast, Plus,
} from '@/components/ui'
import { tglJam, num } from '@/lib/format'
import PermitCountdown from '../components/PermitCountdown'
import {
 PERMIT_TYPES, permitTypeLabel, PERMIT_SAFETY_CHECKLISTS, PERMIT_STATUSES, permitStatusLabel, permitStatusTone,
} from '../lib/constants'
import { tautanPeta, sisaMenitIzin } from '../lib/helpers'

type ChecklistItem = { item: string; checked: boolean }

function newForm(defaultRequestedBy: string) {
 return {
 permit_type: '', work_order_id: '', project_id: '', location: '', lat: '', lng: '',
 valid_from: '', valid_to: '', requested_by: defaultRequestedBy, checklist: [] as ChecklistItem[],
 }
}
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
function endOfToday() { const d = new Date(); d.setHours(23, 59, 59, 999); return d }

export default function IzinKerja() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const writable = can('OPERATIONS', 'write')
 const approver = can('OPERATIONS', 'approve')

 const [loading, setLoading] = useState(true)
 const [tab, setTab] = useState('semua')
 const [permits, setPermits] = useState<any[]>([])
 const [employees, setEmployees] = useState<any[]>([])
 const [workOrders, setWorkOrders] = useState<any[]>([])
 const [projects, setProjects] = useState<any[]>([])

 const [newOpen, setNewOpen] = useState(false)
 const [form, setForm] = useState<any>(newForm(''))
 const [saving, setSaving] = useState(false)
 const [locating, setLocating] = useState(false)

 const [selected, setSelected] = useState<any>(null)
 const [actionBusy, setActionBusy] = useState(false)
 const [rejectConfirm, setRejectConfirm] = useState(false)

 useEffect(() => { if (profile?.company_id) loadAll() }, [profile?.company_id])

 async function loadAll() {
 setLoading(true)
 try {
 const [pm, emp, wo, pr] = await Promise.all([
 list('work_permits', { eq: { company_id: profile!.company_id }, order: { col: 'valid_from', asc: false }, limit: 2000 }),
 list('employees', { select: 'id,full_name,position', eq: { company_id: profile!.company_id, status: 'aktif' }, order: { col: 'full_name', asc: true }, limit: 1000 }),
 list('work_orders', { select: 'id,wo_no,title', eq: { company_id: profile!.company_id }, order: { col: 'created_at', asc: false }, limit: 500 }),
 list('projects', { select: 'id,project_name', eq: { company_id: profile!.company_id }, order: { col: 'created_at', asc: false }, limit: 500 }),
 ])
 setPermits(pm); setEmployees(emp); setWorkOrders(wo); setProjects(pr)
 setForm((f: any) => ({ ...f, requested_by: f.requested_by || (profile as any)?.employee_id || '' }))
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data izin kerja', 'error') }
 finally { setLoading(false) }
 }

 const empName = (id?: string) => employees.find(e => e.id === id)?.full_name ?? '-'
 const woLabel = (id?: string) => { const w = workOrders.find(x => x.id === id); return w ? `${w.wo_no} — ${w.title ?? ''}` : '-' }
 const projLabel = (id?: string) => projects.find(p => p.id === id)?.project_name ?? '-'

 const filtered = useMemo(() => tab === 'semua' ? permits : permits.filter(p => p.status === tab), [permits, tab])
 const tabs = [{ value: 'semua', label: 'Semua', count: permits.length },
 ...PERMIT_STATUSES.map(s => ({ value: s.value, label: s.label, count: permits.filter(p => p.status === s.value).length }))]

 const aktifHariIni = useMemo(() => {
 const awal = startOfToday(), akhir = endOfToday()
 return permits.filter(p => p.status === 'aktif' && p.valid_to && p.valid_from && new Date(p.valid_to) >= awal && new Date(p.valid_from) <= akhir)
 .sort((a, b) => new Date(a.valid_to).getTime() - new Date(b.valid_to).getTime())
 }, [permits])

 const kedaluwarsaBelumTutup = useMemo(() => {
 const now = new Date()
 return permits.filter(p => p.status === 'aktif' && p.valid_to && new Date(p.valid_to) < now)
 }, [permits])

 const menungguPersetujuan = useMemo(() => permits.filter(p => p.status === 'diajukan').length, [permits])

 /* ---------------- Form baru ---------------- */
 function openNew() { setForm(newForm((profile as any)?.employee_id || '')); setNewOpen(true) }
 function onTypeChange(type: string) {
 const checklist: ChecklistItem[] = (PERMIT_SAFETY_CHECKLISTS[type] ?? []).map(item => ({ item, checked: false }))
 setForm((f: any) => ({ ...f, permit_type: type, checklist }))
 }
 function toggleChecklist(i: number) {
 setForm((f: any) => ({ ...f, checklist: f.checklist.map((c: ChecklistItem, idx: number) => idx === i ? { ...c, checked: !c.checked } : c) }))
 }
 function addChecklistItem() {
 setForm((f: any) => ({ ...f, checklist: [...(f.checklist ?? []), { item: '', checked: false }] }))
 }
 function editChecklistItem(i: number, item: string) {
 setForm((f: any) => ({ ...f, checklist: f.checklist.map((c: ChecklistItem, idx: number) => idx === i ? { ...c, item } : c) }))
 }
 function removeChecklistItem(i: number) {
 setForm((f: any) => ({ ...f, checklist: f.checklist.filter((_: ChecklistItem, idx: number) => idx !== i) }))
 }
 function useCurrentLocation() {
 if (!navigator.geolocation) { toast.push('Perangkat tidak mendukung penangkapan lokasi', 'error'); return }
 setLocating(true)
 navigator.geolocation.getCurrentPosition(
 pos => { setForm((f: any) => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })); setLocating(false); toast.push('Koordinat berhasil ditangkap', 'success') },
 () => { setLocating(false); toast.push('Gagal menangkap lokasi — pastikan izin lokasi diaktifkan', 'error') },
 )
 }
 async function submitNew() {
 if (!form.permit_type || !form.location || !form.valid_from || !form.valid_to || !form.requested_by) {
 toast.push('Lengkapi jenis izin, lokasi, masa berlaku, dan pemohon terlebih dahulu', 'error'); return
 }
 if (new Date(form.valid_to) <= new Date(form.valid_from)) { toast.push('Masa berlaku selesai harus setelah masa berlaku mulai', 'error'); return }
 setSaving(true)
 try {
 const permitNo = await nextDocNo(profile!.company_id, 'IZN')
 await insert('work_permits', {
 company_id: profile!.company_id, permit_no: permitNo, permit_type: form.permit_type,
 work_order_id: form.work_order_id || null, project_id: form.project_id || null, location: form.location,
 lat: form.lat || null, lng: form.lng || null, valid_from: new Date(form.valid_from).toISOString(),
 valid_to: new Date(form.valid_to).toISOString(), requested_by: form.requested_by,
 safety_checklist: form.checklist, status: 'diajukan', created_by: profile!.id,
 })
 toast.push(`Izin kerja ${permitNo} berhasil diajukan`, 'success')
 setNewOpen(false); await loadAll()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan izin kerja', 'error') }
 finally { setSaving(false) }
 }

 /* ---------------- Aksi workflow ---------------- */
 async function refreshSelected(id: string) {
 const row = (await list('work_permits', { eq: { id }, limit: 1 }))[0]
 if (row) { setSelected(row); setPermits(ps => ps.map(p => p.id === row.id ? row : p)) }
 }
 const missingChecklist = (p: any): string[] => (p?.safety_checklist ?? []).filter((c: ChecklistItem) => !c.checked).map((c: ChecklistItem) => c.item)

 async function doApprove() {
 const missing = missingChecklist(selected)
 if (missing.length > 0) { toast.push(`Belum dapat disetujui — butir belum dicentang: ${missing.join(', ')}`, 'error'); return }
 setActionBusy(true)
 try {
 await update('work_permits', selected.id, { status: 'disetujui', approved_by: profile!.id, approved_at: new Date().toISOString() })
 toast.push('Izin kerja disetujui', 'success'); await refreshSelected(selected.id)
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyetujui izin kerja', 'error') }
 finally { setActionBusy(false) }
 }
 async function doActivate() {
 setActionBusy(true)
 try { await update('work_permits', selected.id, { status: 'aktif' }); toast.push('Izin kerja diaktifkan', 'success'); await refreshSelected(selected.id) }
 catch (e: any) { toast.push(e.message ?? 'Gagal mengaktifkan izin kerja', 'error') }
 finally { setActionBusy(false) }
 }
 async function doClose() {
 setActionBusy(true)
 try { await update('work_permits', selected.id, { status: 'ditutup' }); toast.push('Izin kerja ditutup', 'success'); await refreshSelected(selected.id) }
 catch (e: any) { toast.push(e.message ?? 'Gagal menutup izin kerja', 'error') }
 finally { setActionBusy(false) }
 }
 async function doReject() {
 try { await update('work_permits', selected.id, { status: 'ditolak' }); toast.push('Izin kerja ditolak', 'success'); setRejectConfirm(false); await refreshSelected(selected.id) }
 catch (e: any) { toast.push(e.message ?? 'Gagal menolak izin kerja', 'error') }
 }

 const peta = selected ? tautanPeta(selected.lat, selected.lng) : null

 return (
 <div>
 <PageHeader title="Izin Kerja (Work Permit)" subtitle="Izin kerja berisiko tinggi — ketinggian, galian, listrik, ruang terbatas & panas"
 actions={writable && <Button icon={<Plus size={16} />} onClick={openNew}>Ajukan Izin</Button>} />

 <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
 <KpiCard label="Izin Aktif Hari Ini" value={loading ? '…' : num(aktifHariIni.length)} tone="emerald" />
 <KpiCard label="Kedaluwarsa Belum Ditutup" value={loading ? '…' : num(kedaluwarsaBelumTutup.length)} tone={kedaluwarsaBelumTutup.length > 0 ? 'red' : 'teal'} />
 <KpiCard label="Menunggu Persetujuan" value={loading ? '…' : num(menungguPersetujuan)} tone={menungguPersetujuan > 0 ? 'amber' : 'teal'} />
 </div>

 {kedaluwarsaBelumTutup.length > 0 && (
 <Card className="mb-4 border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30">
 <div className="p-4 flex items-start gap-3">
 <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
 <div>
 <p className="text-body font-medium text-red-700 dark:text-red-300">{kedaluwarsaBelumTutup.length} izin kerja telah kedaluwarsa namun belum ditutup</p>
 <p className="text-caption text-red-600/80 dark:text-red-400/80 mt-0.5">
 {kedaluwarsaBelumTutup.map(p => p.permit_no).join(', ')} — segera tutup atau perpanjang izin ini.
 </p>
 </div>
 </div>
 </Card>
 )}

 <Card className="mb-4">
 <CardHeader title="Izin Aktif Hari Ini" subtitle="Hitung mundur masa berlaku" />
 <DataTable
 loading={loading} rows={aktifHariIni} searchable={false} onRowClick={setSelected}
 emptyTitle="Tidak ada izin aktif hari ini" emptyMessage="Belum ada izin kerja yang sedang berjalan pada rentang hari ini."
 columns={[
 { key: 'permit_no', header: 'No Izin' },
 { key: 'permit_type', header: 'Jenis', render: r => permitTypeLabel(r.permit_type) },
 { key: 'location', header: 'Lokasi' },
 { key: 'requested_by', header: 'Pemohon', render: r => empName(r.requested_by) },
 { key: 'valid_to', header: 'Sisa Masa Berlaku', render: r => <PermitCountdown validTo={r.valid_to} /> },
 ]}
 />
 </Card>

 <Card className="mb-4">
 <Tabs tabs={tabs} value={tab} onChange={setTab} className="px-4" />
 </Card>

 <DataTable
 loading={loading} rows={filtered} onRowClick={setSelected}
 searchKeys={['permit_no', 'location']} exportName="izin-kerja"
 emptyTitle="Belum ada izin kerja" emptyMessage="Izin kerja yang diajukan akan muncul di sini."
 columns={[
 { key: 'permit_no', header: 'No Izin' },
 { key: 'permit_type', header: 'Jenis', render: r => permitTypeLabel(r.permit_type) },
 { key: 'location', header: 'Lokasi' },
 { key: 'requested_by', header: 'Pemohon', render: r => empName(r.requested_by) },
 { key: 'valid_from', header: 'Mulai Berlaku', render: r => tglJam(r.valid_from) },
 { key: 'valid_to', header: 'Sisa Masa Berlaku', render: r => <PermitCountdown validTo={r.valid_to} closedAt={r.status === 'ditutup' ? r.updated_at : null} /> },
 { key: 'status', header: 'Status', render: r => <Badge tone={permitStatusTone(r.status)}>{permitStatusLabel(r.status)}</Badge> },
 ]}
 />

 {/* Modal ajukan izin baru */}
 <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Ajukan Izin Kerja Baru" size="lg"
 footer={<><Button variant="outline" onClick={() => setNewOpen(false)}>Batal</Button>
 <Button loading={saving} onClick={submitNew}>Ajukan Izin</Button></>}>
 <div className="space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="No Izin"><Input value="Otomatis saat disimpan (IZN/…)" disabled /></Field>
 <Field label="Jenis Izin" required><Select options={PERMIT_TYPES} value={form.permit_type} onChange={(e: any) => onTypeChange(e.target.value)} /></Field>
 <Field label="Tautan Work Order"><Select options={workOrders.map(w => ({ value: w.id, label: `${w.wo_no} — ${w.title ?? ''}` }))} value={form.work_order_id} onChange={(e: any) => setForm({ ...form, work_order_id: e.target.value })} /></Field>
 <Field label="Tautan Proyek"><Select options={projects.map(p => ({ value: p.id, label: p.project_name }))} value={form.project_id} onChange={(e: any) => setForm({ ...form, project_id: e.target.value })} /></Field>
 <Field label="Pemohon" required><Select options={employees.map(e => ({ value: e.id, label: `${e.full_name} — ${e.position ?? ''}` }))} value={form.requested_by} onChange={(e: any) => setForm({ ...form, requested_by: e.target.value })} /></Field>
 <Field label="Lokasi" required><Input value={form.location} onChange={(e: any) => setForm({ ...form, location: e.target.value })} /></Field>
 <Field label="Latitude" hint="Isi manual atau tangkap otomatis">
 <div className="flex gap-2">
 <Input value={form.lat} onChange={(e: any) => setForm({ ...form, lat: e.target.value })} placeholder="-6.200000" />
 <Button type="button" variant="outline" loading={locating} onClick={useCurrentLocation}>Tangkap</Button>
 </div>
 </Field>
 <Field label="Longitude"><Input value={form.lng} onChange={(e: any) => setForm({ ...form, lng: e.target.value })} placeholder="106.816666" /></Field>
 <Field label="Masa Berlaku Mulai" required><Input type="datetime-local" value={form.valid_from} onChange={(e: any) => setForm({ ...form, valid_from: e.target.value })} /></Field>
 <Field label="Masa Berlaku Selesai" required><Input type="datetime-local" value={form.valid_to} onChange={(e: any) => setForm({ ...form, valid_to: e.target.value })} /></Field>
 </div>

 {form.permit_type && (
 <div className="border border-ink-200 rounded-md">
 <div className="px-4 py-2.5 border-b border-ink-200 flex items-center justify-between">
 <div>
 <span className="text-caption font-semibold uppercase tracking-wide text-ink-500">Checklist Keselamatan Wajib — {permitTypeLabel(form.permit_type)}</span>
 <p className="text-caption text-ink-400 mt-0.5">Seluruh butir wajib dicentang sebelum izin dapat disetujui. Tambahkan butir khusus lokasi bila perlu.</p>
 </div>
 <Button type="button" size="sm" variant="outline" icon={<Plus size={14} />} onClick={addChecklistItem}>Tambah Butir</Button>
 </div>
 <div className="divide-y divide-ink-200">
 {form.checklist.map((c: ChecklistItem, i: number) => (
 <div key={i} className="px-4 py-2.5 flex items-center gap-2">
 <div className="flex-1"><Checkbox label="" checked={c.checked} onChange={() => toggleChecklist(i)} /></div>
 <Input value={c.item} onChange={(e: any) => editChecklistItem(i, e.target.value)} placeholder="Uraian butir checklist" className="flex-[6]" />
 <button type="button" onClick={() => removeChecklistItem(i)} className="p-1 text-ink-400 hover:text-red-600"><X size={15} /></button>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </Modal>

 {/* Drawer detail & workflow */}
 <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.permit_no} — ${permitTypeLabel(selected.permit_type)}` : ''}
 footer={selected && writable && (
 <div className="flex flex-wrap gap-2 w-full">
 {selected.status === 'diajukan' && approver && <Button size="sm" loading={actionBusy} onClick={doApprove}>Setujui</Button>}
 {selected.status === 'diajukan' && <Button size="sm" variant="danger" onClick={() => setRejectConfirm(true)}>Tolak</Button>}
 {selected.status === 'disetujui' && <Button size="sm" loading={actionBusy} onClick={doActivate}>Aktifkan</Button>}
 {selected.status === 'aktif' && <Button size="sm" variant="secondary" loading={actionBusy} onClick={doClose}>Tutup</Button>}
 </div>)}>
 {selected && (
 <div>
 <Section>
 <Desc cols={2} items={[
 { label: 'Status', value: <Badge tone={permitStatusTone(selected.status)}>{permitStatusLabel(selected.status)}</Badge> },
 { label: 'Jenis', value: permitTypeLabel(selected.permit_type) },
 { label: 'Pemohon', value: empName(selected.requested_by) },
 { label: 'Disetujui Oleh', value: selected.approved_by ? empName(selected.approved_by) : '-' },
 { label: 'Tautan Work Order', value: woLabel(selected.work_order_id) },
 { label: 'Tautan Proyek', value: projLabel(selected.project_id) },
 { label: 'Mulai Berlaku', value: tglJam(selected.valid_from) },
 { label: 'Selesai Berlaku', value: tglJam(selected.valid_to) },
 { label: 'Sisa Masa Berlaku', value: <PermitCountdown validTo={selected.valid_to} closedAt={selected.status === 'ditutup' ? selected.updated_at : null} /> },
 { label: 'Lokasi', value: <>{selected.location || '-'}{peta && <a href={peta} target="_blank" rel="noreferrer" className="block text-primary-600 mt-0.5">Lihat di Google Maps</a>}</> },
 ]} />
 </Section>
 <Section title="Checklist Keselamatan Wajib">
 <div className="divide-y divide-ink-200 border border-ink-200 rounded-md">
 {(selected.safety_checklist ?? []).map((c: ChecklistItem, i: number) => (
 <div key={i} className="px-3 py-2.5 flex items-center gap-2.5">
 {c.checked ? <CheckCircle2 size={17} className="text-emerald-600 shrink-0" /> : <XCircle size={17} className="text-red-500 shrink-0" />}
 <p className={c.checked ? 'text-body text-ink-700' : 'text-body text-red-700 dark:text-red-300 font-medium'}>{c.item}</p>
 </div>
 ))}
 </div>
 {selected.status === 'diajukan' && missingChecklist(selected).length > 0 && (
 <p className="text-caption text-amber-600 dark:text-amber-400 mt-2">Belum dapat disetujui — {missingChecklist(selected).length} butir belum dicentang.</p>
 )}
 </Section>
 </div>
 )}
 </Drawer>

 <ConfirmDialog open={rejectConfirm} onClose={() => setRejectConfirm(false)} danger title="Tolak Izin Kerja"
 message={`Izin kerja "${selected?.permit_no}" akan ditolak dan tidak dapat diaktifkan.`} onConfirm={doReject} />
 </div>
 )
}
