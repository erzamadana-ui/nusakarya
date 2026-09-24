import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo, signedUrl } from '@/lib/db'
import {
 PageHeader, DataTable, Badge, Button, Modal, Drawer, Field, Input, Select, Textarea,
 FilterBar, Desc, Section, useToast, Plus,
} from '@/components/ui'
import { tglJam, durasi, rupiah, num } from '@/lib/format'
import { WO_TYPES, WO_STATUSES, woStatusLabel, woStatusTone } from '../lib/constants'
import { WO_STATUS } from '../lib/status'
import { tautanPeta } from '../lib/helpers'
import { useFieldKustom, InputFieldKustom, kolomFieldKustom, periksaFieldKustom, useLabelStatus } from '@/lib/konfigurasi'

export default function WorkOrder() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const writable = can('OPERATIONS', 'write')
 const approver = can('OPERATIONS', 'approve')
 const fieldKustom = useFieldKustom('work_orders')
 const labelStatus = useLabelStatus('work_orders')
 const badgeStatus = (st: string) => labelStatus.rows.length ? labelStatus.badge(st) : <Badge tone={woStatusTone(st)}>{woStatusLabel(st)}</Badge>
 const [customEdit, setCustomEdit] = useState<Record<string, unknown> | null>(null)

 const [loading, setLoading] = useState(true)
 const [wos, setWos] = useState<any[]>([])
 const [branches, setBranches] = useState<any[]>([])
 const [technicians, setTechnicians] = useState<any[]>([])
 const [jobTypes, setJobTypes] = useState<any[]>([])

 const [f, setF] = useState({ wo_type: '', status: '', branch_id: '', assigned_to: '', from: '', to: '' })

 const [selected, setSelected] = useState<any>(null)
 const [checklist, setChecklist] = useState<any[]>([])
 const [checklistUrls, setChecklistUrls] = useState<Record<string, string>>({})
 const [drawerLoading, setDrawerLoading] = useState(false)

 const [newOpen, setNewOpen] = useState(false)
 const [form, setForm] = useState<any>(newForm())
 const [saving, setSaving] = useState(false)

 const [qcOpen, setQcOpen] = useState<'lulus' | 'tidak_lulus' | null>(null)
 const [qcNote, setQcNote] = useState('')

 function newForm() {
 return { wo_type: '', job_type_id: '', title: '', customer_name: '', customer_no: '', address: '', lat: '', lng: '', branch_id: '', scheduled_at: '', description: '', custom: {} }
 }

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

 async function load() {
 setLoading(true)
 try {
 const [w, br, emp, jt] = await Promise.all([
 list('work_orders', { eq: { company_id: profile!.company_id }, order: { col: 'scheduled_at', asc: false }, limit: 2000 }),
 list('branches', { select: 'id,name', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
 list('employees', { select: 'id,full_name,position', eq: { company_id: profile!.company_id }, ilike: { col: 'position', value: 'teknisi' }, order: { col: 'full_name', asc: true } }),
 list('job_types', { select: 'id,name', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
 ])
 setWos(w); setBranches(br); setTechnicians(emp); setJobTypes(jt)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat work order', 'error') }
 finally { setLoading(false) }
 }

 const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'
 const empName = (id?: string) => technicians.find(t => t.id === id)?.full_name ?? '-'

 const filtered = useMemo(() => wos.filter(w =>
 (!f.wo_type || w.wo_type === f.wo_type) && (!f.status || w.status === f.status) &&
 (!f.branch_id || w.branch_id === f.branch_id) && (!f.assigned_to || w.assigned_to === f.assigned_to) &&
 (!f.from || (w.scheduled_at && w.scheduled_at >= f.from)) && (!f.to || (w.scheduled_at && w.scheduled_at <= f.to + 'T23:59:59'))
 ), [wos, f])

 async function openDetail(row: any) {
 setSelected(row); setDrawerLoading(true)
 try {
 const cl = await list('wo_checklists', { eq: { company_id: profile!.company_id, work_order_id: row.id }, order: { col: 'seq', asc: true } })
 setChecklist(cl)
 const urls: Record<string, string> = {}
 await Promise.all(cl.filter((c: any) => c.photo_url).map(async (c: any) => { urls[c.id] = (await signedUrl(c.photo_url)) ?? '' }))
 setChecklistUrls(urls)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat detail work order', 'error') }
 finally { setDrawerLoading(false) }
 }
 function closeDrawer() { setSelected(null); setQcOpen(null); setQcNote(''); setCustomEdit(null) }

 async function submitNew() {
 if (!form.wo_type || !form.job_type_id || !form.title || !form.customer_name || !form.branch_id) {
 toast.push('Lengkapi jenis, jenis pekerjaan (job type), judul, pelanggan dan cabang terlebih dahulu', 'error'); return
 }
 const galatKustom = periksaFieldKustom(fieldKustom, form.custom)
 if (galatKustom) { toast.push(galatKustom, 'error'); return }
 setSaving(true)
 try {
 const woNo = await nextDocNo(profile!.company_id, 'WO')
 await insert('work_orders', {
 company_id: profile!.company_id, wo_no: woNo, wo_type: form.wo_type, job_type_id: form.job_type_id, title: form.title,
 description: form.description || null, customer_name: form.customer_name, customer_no: form.customer_no || null,
 address: form.address || null, lat: form.lat || null, lng: form.lng || null, branch_id: form.branch_id,
 scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
 status: WO_STATUS.DRAFT, qc_status: 'belum', created_by: profile!.id, custom: form.custom ?? {},
 })
 toast.push(`Work order ${woNo} berhasil dibuat`, 'success'); setNewOpen(false); setForm(newForm()); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan work order', 'error') }
 finally { setSaving(false) }
 }

 async function submitQc() {
 if (!qcNote.trim()) { toast.push('Catatan QC wajib diisi', 'error'); return }
 try {
 const status = qcOpen === 'lulus' ? 'lulus' : 'tidak_lulus'
 await update('work_orders', selected.id, { qc_status: status, qc_by: profile!.id, qc_note: qcNote.trim() })
 toast.push(`QC ditandai ${status === 'lulus' ? 'Lulus' : 'Tidak Lulus'}`, 'success')
 setSelected((s: any) => ({ ...s, qc_status: status, qc_note: qcNote.trim() }))
 setWos(ws => ws.map(w => w.id === selected.id ? { ...w, qc_status: status, qc_note: qcNote.trim() } : w))
 setQcOpen(null); setQcNote('')
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan hasil QC', 'error') }
 }

 const peta = tautanPeta(selected?.lat, selected?.lng)

 return (
 <div>
 <PageHeader title="Work Order" subtitle="PSB, migrasi, gangguan, maintenance, deployment, survey & dismantle"
 actions={writable && <Button icon={<Plus size={16} />} onClick={() => setNewOpen(true)}>Work Order Baru</Button>} />

 <FilterBar>
 <Field label="Jenis"><Select options={WO_TYPES} value={f.wo_type} onChange={(e: any) => setF({ ...f, wo_type: e.target.value })} /></Field>
 <Field label="Status"><Select options={WO_STATUSES} value={f.status} onChange={(e: any) => setF({ ...f, status: e.target.value })} /></Field>
 <Field label="Cabang"><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={f.branch_id} onChange={(e: any) => setF({ ...f, branch_id: e.target.value })} /></Field>
 <Field label="Teknisi"><Select options={technicians.map(t => ({ value: t.id, label: t.full_name }))} value={f.assigned_to} onChange={(e: any) => setF({ ...f, assigned_to: e.target.value })} /></Field>
 <Field label="Dari Tanggal"><Input type="date" value={f.from} onChange={(e: any) => setF({ ...f, from: e.target.value })} /></Field>
 <Field label="Sampai Tanggal"><Input type="date" value={f.to} onChange={(e: any) => setF({ ...f, to: e.target.value })} /></Field>
 <Button variant="outline" size="sm" onClick={() => setF({ wo_type: '', status: '', branch_id: '', assigned_to: '', from: '', to: '' })}>Reset</Button>
 </FilterBar>

 <DataTable
 loading={loading}
 rows={filtered}
 onRowClick={openDetail}
 searchKeys={['wo_no', 'customer_name', 'title']}
 exportName="work-order"
 emptyTitle="Belum ada work order"
 columns={[
 { key: 'wo_no', header: 'No WO' },
 { key: 'wo_type', header: 'Jenis', render: r => WO_TYPES.find(t => t.value === r.wo_type)?.label ?? r.wo_type },
 { key: 'customer_name', header: 'Pelanggan' },
 { key: 'branch_id', header: 'Cabang', render: r => branchName(r.branch_id) },
 { key: 'assigned_to', header: 'Teknisi', render: r => empName(r.assigned_to) },
 { key: 'scheduled_at', header: 'Jadwal', render: r => r.scheduled_at ? tglJam(r.scheduled_at) : '-' },
 { key: 'started_at', header: 'Mulai', render: r => r.started_at ? tglJam(r.started_at) : '-' },
 { key: 'finished_at', header: 'Selesai', render: r => r.finished_at ? tglJam(r.finished_at) : '-' },
 { key: 'duration_minutes', header: 'Durasi', align: 'right', render: r => durasi(r.duration_minutes) },
 { key: 'evidence_count', header: 'Bukti', align: 'right', render: r => num(r.evidence_count) },
 ...kolomFieldKustom(fieldKustom),
 { key: 'status', header: 'Status', render: r => badgeStatus(r.status) },
 { key: 'fail_reason', header: 'Alasan Gagal', render: r => r.fail_reason || '-' },
 { key: 'qc_status', header: 'QC', render: r => <Badge>{r.qc_status}</Badge> },
 ]}
 />

 <Drawer open={!!selected} onClose={closeDrawer} width="max-w-2xl" title={selected ? `${selected.wo_no} — ${selected.title || ''}` : ''}
 footer={selected && approver && selected.status === WO_STATUS.DONE && selected.qc_status === 'belum' && (
 <div className="flex gap-2 w-full">
 <Button variant="danger" onClick={() => setQcOpen('tidak_lulus')}>QC Tidak Lulus</Button>
 <Button variant="success" onClick={() => setQcOpen('lulus')}>QC Lulus</Button>
 </div>)}>
 {selected && (
 <div>
 <Section title="Data Pelanggan">
 <Desc cols={2} items={[
 { label: 'Nama', value: selected.customer_name },
 { label: 'No Pelanggan', value: selected.customer_no },
 { label: 'Cabang', value: branchName(selected.branch_id) },
 { label: 'Teknisi', value: empName(selected.assigned_to) },
 { label: 'Alamat', value: <>{selected.address || '-'}{peta && <a href={peta} target="_blank" rel="noreferrer" className="block text-primary-600 mt-0.5">Lihat di Google Maps</a>}</> },
 { label: 'Status', value: badgeStatus(selected.status) },
 ]} />
 </Section>
 <Section title="Hasil & Produktivitas">
 <Desc cols={2} items={[
 { label: 'Hasil Pengerjaan', value: selected.result_note || '-' },
 { label: 'Durasi', value: durasi(selected.duration_minutes) },
 { label: 'Poin', value: num(selected.points) },
 { label: 'Nilai', value: rupiah(selected.amount) },
 { label: 'Status QC', value: <Badge>{selected.qc_status}</Badge> },
 { label: 'Catatan QC', value: selected.qc_note || '-' },
 ]} />
 <p className="mt-2 text-caption text-ink-400">Catatan: work order berstatus Selesai secara otomatis membentuk entri produktivitas teknisi pada modul Produktivitas Teknisi (HR).</p>
 </Section>
 {fieldKustom.length > 0 && (
 <Section title="Data Tambahan Perusahaan">
 <InputFieldKustom defs={fieldKustom} value={customEdit ?? selected.custom} judul="Field kustom (diatur di Pengaturan → Field Kustom)"
 onChange={v => writable && setCustomEdit(v)} />
 {writable && customEdit && <div className="mt-2 flex justify-end"><Button size="sm" onClick={async () => {
 const galat = periksaFieldKustom(fieldKustom, customEdit)
 if (galat) { toast.push(galat, 'error'); return }
 try { await update('work_orders', selected.id, { custom: customEdit }); setSelected({ ...selected, custom: customEdit }); setCustomEdit(null); toast.push('Data tambahan disimpan', 'success'); load() }
 catch (e: any) { toast.push(e.message, 'error') }
 }}>Simpan data tambahan</Button></div>}
 </Section>)}
 <Section title="Checklist Pekerjaan">
 {checklist.length === 0 ? <p className="text-caption text-ink-400">Tidak ada checklist untuk work order ini.</p> : (
 <div className="space-y-3">
 {checklist.map(c => (
 <div key={c.id} className="border border-ink-200 rounded-md p-3">
 <div className="flex items-start justify-between gap-2">
 <p className="text-body text-ink-800">{c.seq}. {c.question}{c.is_mandatory && <span className="text-red-500"> *</span>}</p>
 {c.is_passed != null && <Badge tone={c.is_passed ? 'emerald' : 'red'}>{c.is_passed ? 'Sesuai' : 'Tidak Sesuai'}</Badge>}
 </div>
 <p className="text-body text-ink-600 mt-1">{c.answer_value || '-'}</p>
 {c.photo_url && checklistUrls[c.id] && <img src={checklistUrls[c.id]} className="mt-2 h-28 rounded-sm object-cover" />}
 </div>))}
 </div>)}
 </Section>
 </div>
 )}
 </Drawer>

 <Modal open={!!qcOpen} onClose={() => setQcOpen(null)} title={`QC — ${qcOpen === 'lulus' ? 'Lulus' : 'Tidak Lulus'}`}
 footer={<><Button variant="outline" onClick={() => setQcOpen(null)}>Batal</Button><Button variant={qcOpen === 'lulus' ? 'success' : 'danger'} onClick={submitQc}>Simpan</Button></>}>
 <Field label="Catatan QC" required hint="Wajib diisi sebagai dokumentasi hasil pemeriksaan kualitas."><Textarea value={qcNote} onChange={(e: any) => setQcNote(e.target.value)} /></Field>
 </Modal>

 <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Work Order Baru" size="lg"
 footer={<><Button variant="outline" onClick={() => setNewOpen(false)}>Batal</Button><Button loading={saving} onClick={submitNew}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="No WO"><Input value="Otomatis saat disimpan (WO/…)" disabled /></Field>
 <Field label="Jenis" required><Select options={WO_TYPES} value={form.wo_type} onChange={(e: any) => setForm({ ...form, wo_type: e.target.value })} /></Field>
 <Field label="Jenis Pekerjaan (Job Type)" required hint="Wajib diisi — dipakai perhitungan poin/tarif produktivitas teknisi saat WO ditandai Selesai."><Select options={jobTypes.map(j => ({ value: j.id, label: j.name }))} value={form.job_type_id} onChange={(e: any) => setForm({ ...form, job_type_id: e.target.value })} /></Field>
 <Field label="Judul Pekerjaan" required className="sm:col-span-2"><Input value={form.title} onChange={(e: any) => setForm({ ...form, title: e.target.value })} /></Field>
 <Field label="Nama Pelanggan" required><Input value={form.customer_name} onChange={(e: any) => setForm({ ...form, customer_name: e.target.value })} /></Field>
 <Field label="No Pelanggan"><Input value={form.customer_no} onChange={(e: any) => setForm({ ...form, customer_no: e.target.value })} /></Field>
 <Field label="Cabang" required><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={form.branch_id} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value })} /></Field>
 <Field label="Jadwal Pengerjaan"><Input type="datetime-local" value={form.scheduled_at} onChange={(e: any) => setForm({ ...form, scheduled_at: e.target.value })} /></Field>
 <Field label="Alamat" className="sm:col-span-2"><Textarea value={form.address} onChange={(e: any) => setForm({ ...form, address: e.target.value })} /></Field>
 <Field label="Latitude"><Input value={form.lat} onChange={(e: any) => setForm({ ...form, lat: e.target.value })} /></Field>
 <Field label="Longitude"><Input value={form.lng} onChange={(e: any) => setForm({ ...form, lng: e.target.value })} /></Field>
 <Field label="Deskripsi" className="sm:col-span-2"><Textarea value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} /></Field>
 <div className="sm:col-span-2"><InputFieldKustom defs={fieldKustom} value={form.custom} onChange={v => setForm({ ...form, custom: v })} /></div>
 </div>
 </Modal>
 </div>
 )
}
