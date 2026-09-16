import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo, uploadFile, signedUrl } from '@/lib/db'
import {
 PageHeader, Card, CardHeader, DataTable, Drawer, Modal, ConfirmDialog, Field, Input, Textarea, Select,
 Button, Badge, Desc, Section, useToast, Plus, EmptyState,
} from '@/components/ui'
import { tgl } from '@/lib/format'
import { projectLabel } from '../lib/shared'
import { Trash2, FileText } from 'lucide-react'

const AI_STATUS = [{ value: 'open', label: 'Terbuka' }, { value: 'selesai', label: 'Selesai' }]

export default function Drm() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const loc = useLocation() as any
 const writable = can('DEPLOYMENT', 'write')

 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [projects, setProjects] = useState<any[]>([])

 const [open, setOpen] = useState(false)
 const [editing, setEditing] = useState<any>(null)
 const [form, setForm] = useState<any>({})
 const [saving, setSaving] = useState(false)
 const [file, setFile] = useState<File | null>(null)

 const [drawerRow, setDrawerRow] = useState<any>(null)
 const [notulenUrl, setNotulenUrl] = useState<string | null>(null)
 const [delRow, setDelRow] = useState<any>(null)

 const load = async () => {
 if (!profile?.company_id) return
 setLoading(true)
 try {
 const [d, p] = await Promise.all([
 list('drm_sessions', { order: { col: 'created_at', asc: false }, limit: 500 }),
 list('projects', { select: 'id,project_code,project_name', order: { col: 'project_code', asc: true } }),
 ])
 setRows(d); setProjects(p)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data', 'error') }
 finally { setLoading(false) }
 }
 useEffect(() => { load() }, [profile?.company_id])

 const projName = (id?: string) => { const p = projects.find(x => x.id === id); return p ? projectLabel(p) : '-' }

 const openAiTasks = useMemo(() => {
 const out: any[] = []
 rows.forEach(r => (Array.isArray(r.action_items) ? r.action_items : []).forEach((ai: any) => {
 if (ai.status !== 'selesai') out.push({ ...ai, drm_no: r.drm_no, project: projName(r.project_id) })
 }))
 return out.sort((a, b) => String(a.tenggat ?? '').localeCompare(String(b.tenggat ?? '')))
 }, [rows, projects])

 const openAdd = async () => {
 let no = ''
 try { no = await nextDocNo(profile!.company_id, 'DRM') } catch {}
 setEditing(null); setFile(null)
 setForm({ drm_no: no, drm_date: new Date().toISOString().slice(0, 10), status: 'draft', project_id: loc?.state?.projectId ?? '', participants: [], action_items: [] })
 setOpen(true)
 }
 const openEdit = (row: any) => {
 setEditing(row); setFile(null)
 setForm({ ...row, participants: Array.isArray(row.participants) ? row.participants : [], action_items: Array.isArray(row.action_items) ? row.action_items : [] })
 setOpen(true)
 }

 const addPeserta = () => setForm((f: any) => ({ ...f, participants: [...(f.participants ?? []), { name: '', instansi: '' }] }))
 const editPeserta = (i: number, k: string, v: string) => setForm((f: any) => ({ ...f, participants: f.participants.map((p: any, idx: number) => idx === i ? { ...p, [k]: v } : p) }))
 const delPeserta = (i: number) => setForm((f: any) => ({ ...f, participants: f.participants.filter((_: any, idx: number) => idx !== i) }))

 const addAi = () => setForm((f: any) => ({ ...f, action_items: [...(f.action_items ?? []), { uraian: '', pic: '', tenggat: '', status: 'open' }] }))
 const editAi = (i: number, k: string, v: string) => setForm((f: any) => ({ ...f, action_items: f.action_items.map((a: any, idx: number) => idx === i ? { ...a, [k]: v } : a) }))
 const delAi = (i: number) => setForm((f: any) => ({ ...f, action_items: f.action_items.filter((_: any, idx: number) => idx !== i) }))

 const save = async () => {
 if (!form.project_id) { toast.push('Proyek wajib dipilih', 'error'); return }
 setSaving(true)
 try {
 let fileUrl = form.file_url ?? null
 if (file) fileUrl = await uploadFile(profile!.company_id, 'drm', file)
 const payload = {
 company_id: profile!.company_id, drm_no: form.drm_no, project_id: form.project_id, drm_date: form.drm_date || null,
 participants: form.participants ?? [], agenda: form.agenda || null, decisions: form.decisions || null,
 action_items: form.action_items ?? [], status: form.status || 'draft', file_url: fileUrl,
 }
 if (editing) {
 const upd = await update('drm_sessions', editing.id, payload)
 setRows(rs => rs.map(r => r.id === upd.id ? upd : r))
 toast.push('DRM diperbarui')
 } else {
 const created = await insert('drm_sessions', { ...payload, created_by: profile!.id })
 setRows(rs => [created, ...rs])
 toast.push('DRM ditambahkan')
 }
 setOpen(false)
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan', 'error') }
 finally { setSaving(false) }
 }
 const doDelete = async () => {
 if (!delRow) return
 try { await remove('drm_sessions', delRow.id); setRows(rs => rs.filter(r => r.id !== delRow.id)); if (drawerRow?.id === delRow.id) setDrawerRow(null); toast.push('DRM dihapus') }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus', 'error') }
 }
 const openDrawer = async (row: any) => { setDrawerRow(row); setNotulenUrl(row.file_url ? await signedUrl(row.file_url) : null) }

 return (
 <div>
 <PageHeader title="Design Review Meeting (DRM)" subtitle="Notulen rapat, keputusan & action item"
 actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah DRM</Button>} />

 <Card className="mb-4">
 <CardHeader title="Action Item Belum Selesai" subtitle={`${openAiTasks.length} item memerlukan tindak lanjut`} />
 {openAiTasks.length === 0 ? <EmptyState title="Tidak ada action item terbuka" /> : (
 <div className="overflow-auto max-h-64">
 <table className="w-full text-body">
 <thead className="bg-ink-50 sticky top-0"><tr>
 <th className="px-3 h-10 text-left text-caption font-semibold text-ink-500">Uraian</th>
 <th className="px-3 h-10 text-left text-caption font-semibold text-ink-500">PIC</th>
 <th className="px-3 h-10 text-left text-caption font-semibold text-ink-500">Tenggat</th>
 <th className="px-3 h-10 text-left text-caption font-semibold text-ink-500">DRM</th>
 <th className="px-3 h-10 text-left text-caption font-semibold text-ink-500">Proyek</th>
 </tr></thead>
 <tbody>{openAiTasks.map((a, i) => (
 <tr key={i} className="border-t border-ink-100">
 <td className="px-3 py-2">{a.uraian}</td><td className="px-3 py-2">{a.pic}</td>
 <td className="px-3 py-2">{tgl(a.tenggat)}</td><td className="px-3 py-2">{a.drm_no}</td><td className="px-3 py-2">{a.project}</td>
 </tr>))}</tbody>
 </table>
 </div>)}
 </Card>

 <DataTable
 loading={loading} searchKeys={['drm_no', 'agenda']} exportName="drm"
 onRowClick={openDrawer}
 emptyTitle="Belum ada sesi DRM"
 emptyAction={writable && <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Tambah DRM</Button>}
 columns={[
 { key: 'drm_no', header: 'Nomor', width: '120px' },
 { key: 'project_id', header: 'Proyek', render: (r) => projName(r.project_id) },
 { key: 'drm_date', header: 'Tanggal', render: (r) => tgl(r.drm_date) },
 { key: 'agenda', header: 'Agenda' },
 { key: 'action_items', header: 'Action Item', align: 'right', render: (r) => `${(r.action_items ?? []).filter((a: any) => a.status !== 'selesai').length}/${(r.action_items ?? []).length}` },
 { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
 ]}
 rows={rows}
 />

 <Modal open={open} onClose={() => setOpen(false)} size="xl" title={editing ? 'Ubah DRM' : 'Tambah DRM'}
 footer={<><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="Nomor DRM"><Input value={form.drm_no ?? ''} readOnly disabled /></Field>
 <Field label="Proyek" required><Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} value={form.project_id ?? ''} onChange={(e: any) => setForm({ ...form, project_id: e.target.value })} /></Field>
 <Field label="Tanggal"><Input type="date" value={form.drm_date ?? ''} onChange={e => setForm({ ...form, drm_date: e.target.value })} /></Field>
 <Field label="Status"><Select options={['draft', 'selesai']} value={form.status ?? ''} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>
 </div>

 <Section title="Peserta" className="mt-5">
 {(form.participants ?? []).map((p: any, i: number) => (
 <div key={i} className="flex items-center gap-2 mb-2">
 <Input placeholder="Nama" value={p.name} onChange={e => editPeserta(i, 'name', e.target.value)} />
 <Input placeholder="Instansi" value={p.instansi} onChange={e => editPeserta(i, 'instansi', e.target.value)} />
 <Button variant="ghost" size="sm" onClick={() => delPeserta(i)}><Trash2 size={15} className="text-red-500" /></Button>
 </div>))}
 <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={addPeserta}>Tambah Peserta</Button>
 </Section>

 <Section title="Agenda & Keputusan" className="mt-5">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="Agenda"><Textarea value={form.agenda ?? ''} onChange={e => setForm({ ...form, agenda: e.target.value })} /></Field>
 <Field label="Keputusan"><Textarea value={form.decisions ?? ''} onChange={e => setForm({ ...form, decisions: e.target.value })} /></Field>
 </div>
 </Section>

 <Section title="Action Item" className="mt-5">
 {(form.action_items ?? []).map((a: any, i: number) => (
 <div key={i} className="grid grid-cols-[1fr_140px_140px_120px_auto] gap-2 mb-2 items-center">
 <Input placeholder="Uraian" value={a.uraian} onChange={e => editAi(i, 'uraian', e.target.value)} />
 <Input placeholder="PIC" value={a.pic} onChange={e => editAi(i, 'pic', e.target.value)} />
 <Input type="date" value={a.tenggat} onChange={e => editAi(i, 'tenggat', e.target.value)} />
 <Select options={AI_STATUS} value={a.status} onChange={(e: any) => editAi(i, 'status', e.target.value)} />
 <Button variant="ghost" size="sm" onClick={() => delAi(i)}><Trash2 size={15} className="text-red-500" /></Button>
 </div>))}
 <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={addAi}>Tambah Action Item</Button>
 </Section>

 <Field label="Unggah Notulen" className="mt-5">
 <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)}
 className="block w-full text-body text-ink-600 file:mr-3 file:h-9 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
 {form.file_url && !file && <p className="text-caption text-ink-400 mt-1">Notulen sudah diunggah sebelumnya.</p>}
 </Field>
 </Modal>

 <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} width="max-w-2xl" title={drawerRow ? `DRM ${drawerRow.drm_no}` : ''}
 footer={drawerRow && <>
 {can('DEPLOYMENT', 'approve') && <Button variant="danger" onClick={() => setDelRow(drawerRow)}>Hapus</Button>}
 {writable && <Button onClick={() => openEdit(drawerRow)}>Ubah</Button>}
 </>}>
 {drawerRow && (
 <div>
 <Section title="Informasi">
 <Desc items={[
 { label: 'Proyek', value: projName(drawerRow.project_id) },
 { label: 'Tanggal', value: tgl(drawerRow.drm_date) },
 { label: 'Status', value: <Badge>{drawerRow.status}</Badge> },
 ]} />
 </Section>
 <Section title="Peserta">
 {(drawerRow.participants ?? []).length === 0 ? <p className="text-caption text-ink-400">Tidak ada data peserta.</p> : (
 <ul className="text-body text-ink-700 space-y-1">{(drawerRow.participants ?? []).map((p: any, i: number) => <li key={i}>{p.name} — {p.instansi}</li>)}</ul>)}
 </Section>
 {drawerRow.agenda && <Section title="Agenda"><p className="text-body whitespace-pre-line text-ink-700">{drawerRow.agenda}</p></Section>}
 {drawerRow.decisions && <Section title="Keputusan"><p className="text-body whitespace-pre-line text-ink-700">{drawerRow.decisions}</p></Section>}
 <Section title="Action Item">
 {(drawerRow.action_items ?? []).length === 0 ? <p className="text-caption text-ink-400">Belum ada action item.</p> : (
 <div className="space-y-2">{(drawerRow.action_items ?? []).map((a: any, i: number) => (
 <div key={i} className="flex items-center justify-between gap-2 p-2.5 rounded-sm border border-ink-200">
 <div><p className="text-body text-ink-800">{a.uraian}</p>
 <p className="text-caption text-ink-400">{a.pic} · tenggat {tgl(a.tenggat)}</p></div>
 <Badge>{a.status === 'selesai' ? 'selesai' : 'terbuka'}</Badge>
 </div>))}</div>)}
 </Section>
 {notulenUrl && <Section title="Notulen"><a href={notulenUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary-600 hover:underline"><FileText size={16} /> Buka berkas notulen</a></Section>}
 </div>
 )}
 </Drawer>

 <ConfirmDialog open={!!delRow} onClose={() => setDelRow(null)} onConfirm={doDelete} danger title="Hapus DRM" message={`Hapus sesi DRM "${delRow?.drm_no}"?`} />
 </div>
 )
}
