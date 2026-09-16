import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { list, insert, update, uploadFile, signedUrl } from '@/lib/db'
import {
 PageHeader, Card, DataTable, Drawer, Modal, Field, Input, Select,
 Button, Badge, Desc, Section, Timeline, useToast, Plus, FilterBar,
} from '@/components/ui'
import { tgl, tglJam } from '@/lib/format'
import { DOC_TYPES, DOC_STATUS, projectLabel } from '../lib/shared'
import { FileUp, FileText } from 'lucide-react'

export default function Dokumen() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const loc = useLocation() as any
 const writable = can('DEPLOYMENT', 'write')
 const approver = can('DEPLOYMENT', 'approve')

 const [projects, setProjects] = useState<any[]>([])
 const [filterProject, setFilterProject] = useState<string>(loc?.state?.projectId ?? '')
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])

 const [open, setOpen] = useState(false)
 const [form, setForm] = useState<any>({})
 const [file, setFile] = useState<File | null>(null)
 const [saving, setSaving] = useState(false)

 const [versionOf, setVersionOf] = useState<any>(null)
 const [versionForm, setVersionForm] = useState<any>({})
 const [versionFile, setVersionFile] = useState<File | null>(null)
 const [versioning, setVersioning] = useState(false)

 const [drawerRow, setDrawerRow] = useState<any>(null)
 const [fileUrl, setFileUrl] = useState<string | null>(null)

 const load = async () => {
 if (!profile?.company_id) return
 setLoading(true)
 try {
 const [d, p] = await Promise.all([
 list('documents', { order: { col: 'created_at', asc: false }, limit: 2000 }),
 list('projects', { select: 'id,project_code,project_name', order: { col: 'project_code', asc: true } }),
 ])
 setRows(d); setProjects(p)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data', 'error') }
 finally { setLoading(false) }
 }
 useEffect(() => { load() }, [profile?.company_id])

 const projName = (id?: string) => { const p = projects.find(x => x.id === id); return p ? projectLabel(p) : '-' }
 const scoped = useMemo(() => filterProject ? rows.filter(r => r.project_id === filterProject) : rows, [rows, filterProject])

 const lineage = (doc: any) => {
 let root = doc
 while (root.parent_document_id) { const parent = rows.find(r => r.id === root.parent_document_id); if (!parent) break; root = parent }
 const chain: any[] = []
 const walk = (node: any) => { chain.push(node); rows.filter(r => r.parent_document_id === node.id).forEach(walk) }
 walk(root)
 return chain.sort((a, b) => a.version - b.version)
 }

 const openAdd = () => {
 setForm({ project_id: filterProject || '', doc_type: 'ABD', title: '', status: 'draft', version: 1 })
 setFile(null); setOpen(true)
 }
 const save = async () => {
 if (!form.project_id || !form.title) { toast.push('Proyek dan judul wajib diisi', 'error'); return }
 setSaving(true)
 try {
 let fileUrlPath = null
 if (file) fileUrlPath = await uploadFile(profile!.company_id, 'documents', file)
 const payload = {
 company_id: profile!.company_id, project_id: form.project_id, doc_type: form.doc_type, doc_no: form.doc_no || null,
 title: form.title, version: 1, parent_document_id: null, file_url: fileUrlPath, file_size: file?.size ?? null,
 status: 'draft', note: form.note || null,
 }
 await insert('documents', { ...payload, created_by: profile!.id })
 toast.push('Dokumen ditambahkan'); setOpen(false); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan', 'error') }
 finally { setSaving(false) }
 }

 const openVersion = (doc: any) => { setVersionOf(doc); setVersionForm({ title: doc.title, note: '' }); setVersionFile(null) }
 const saveVersion = async () => {
 if (!versionFile) { toast.push('Pilih berkas versi baru terlebih dahulu', 'error'); return }
 setVersioning(true)
 try {
 const path = await uploadFile(profile!.company_id, 'documents', versionFile)
 const payload = {
 company_id: profile!.company_id, project_id: versionOf.project_id, doc_type: versionOf.doc_type, doc_no: versionOf.doc_no || null,
 title: versionForm.title || versionOf.title, version: Number(versionOf.version ?? 1) + 1, parent_document_id: versionOf.id,
 file_url: path, file_size: versionFile.size, status: 'draft', note: versionForm.note || null,
 }
 await insert('documents', { ...payload, created_by: profile!.id })
 await update('documents', versionOf.id, { status: 'obsolete' })
 toast.push('Versi baru diunggah, versi sebelumnya ditandai usang')
 setVersionOf(null); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengunggah versi baru', 'error') }
 finally { setVersioning(false) }
 }

 const setuju = async (doc: any, approve: boolean) => {
 try {
 await update('documents', doc.id, { status: approve ? 'approved' : 'rejected', approved_by: profile!.id, approved_at: new Date().toISOString() })
 toast.push(approve ? 'Dokumen disetujui' : 'Dokumen ditolak')
 setDrawerRow((d: any) => d ? { ...d, status: approve ? 'approved' : 'rejected' } : d)
 load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal memperbarui status', 'error') }
 }

 const openDrawer = async (row: any) => { setDrawerRow(row); setFileUrl(row.file_url ? await signedUrl(row.file_url) : null) }

 return (
 <div>
 <PageHeader title="Dokumen & ABD" subtitle="Kontrol dokumen proyek dengan riwayat versi"
 actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Dokumen</Button>} />

 <FilterBar>
 <Field label="Proyek" className="min-w-[260px]">
 <Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} placeholder="Semua Proyek" value={filterProject} onChange={(e: any) => setFilterProject(e.target.value)} />
 </Field>
 </FilterBar>

 <Card>
 <DataTable
 loading={loading} searchKeys={['title', 'doc_no']} exportName="dokumen"
 onRowClick={openDrawer}
 emptyTitle="Belum ada dokumen"
 emptyAction={writable && <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Tambah Dokumen</Button>}
 columns={[
 { key: 'doc_type', header: 'Jenis', render: (r) => DOC_TYPES.find(t => t.value === r.doc_type)?.label ?? r.doc_type },
 { key: 'doc_no', header: 'Nomor' },
 { key: 'title', header: 'Judul' },
 { key: 'project_id', header: 'Proyek', render: (r) => projName(r.project_id) },
 { key: 'version', header: 'Versi', align: 'right', render: (r) => `v${r.version}` },
 { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
 ...(writable ? [{ key: '_v', header: '', width: '150px', render: (r: any) => r.status !== 'obsolete' ? (
 <button onClick={(e) => { e.stopPropagation(); openVersion(r) }} className="text-caption text-primary-600 hover:underline inline-flex items-center gap-1"><FileUp size={13} /> Unggah versi baru</button>) : null }] : []),
 ]}
 rows={scoped}
 />
 </Card>

 <Modal open={open} onClose={() => setOpen(false)} title="Tambah Dokumen"
 footer={<><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="Proyek" required><Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} value={form.project_id ?? ''} onChange={(e: any) => setForm({ ...form, project_id: e.target.value })} /></Field>
 <Field label="Jenis Dokumen"><Select options={DOC_TYPES} value={form.doc_type ?? ''} onChange={(e: any) => setForm({ ...form, doc_type: e.target.value })} /></Field>
 <Field label="Nomor Dokumen"><Input value={form.doc_no ?? ''} onChange={e => setForm({ ...form, doc_no: e.target.value })} /></Field>
 <Field label="Judul" required><Input value={form.title ?? ''} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
 <Field label="Catatan" className="sm:col-span-2"><Input value={form.note ?? ''} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
 <Field label="Berkas" className="sm:col-span-2">
 <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)}
 className="block w-full text-body text-ink-600 file:mr-3 file:h-9 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
 </Field>
 </div>
 </Modal>

 <Modal open={!!versionOf} onClose={() => setVersionOf(null)} title={versionOf ? `Unggah Versi Baru — ${versionOf.title} (v${versionOf.version} → v${Number(versionOf.version ?? 1) + 1})` : ''}
 footer={<><Button variant="outline" onClick={() => setVersionOf(null)}>Batal</Button><Button loading={versioning} onClick={saveVersion}>Unggah</Button></>}>
 <div className="space-y-4">
 <Field label="Judul"><Input value={versionForm.title ?? ''} onChange={e => setVersionForm({ ...versionForm, title: e.target.value })} /></Field>
 <Field label="Catatan Revisi"><Input value={versionForm.note ?? ''} onChange={e => setVersionForm({ ...versionForm, note: e.target.value })} /></Field>
 <Field label="Berkas Versi Baru" required>
 <input type="file" onChange={e => setVersionFile(e.target.files?.[0] ?? null)}
 className="block w-full text-body text-ink-600 file:mr-3 file:h-9 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
 <p className="text-caption text-ink-400 mt-1">Versi sebelumnya (v{versionOf?.version}) akan otomatis ditandai "usang".</p>
 </Field>
 </div>
 </Modal>

 <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} title={drawerRow?.title ?? ''}
 footer={drawerRow && approver && (drawerRow.status === 'draft' || drawerRow.status === 'review') && (
 <><Button variant="danger" onClick={() => setuju(drawerRow, false)}>Tolak</Button>
 <Button variant="success" onClick={() => setuju(drawerRow, true)}>Setujui</Button></>)}>
 {drawerRow && (
 <div>
 <Section title="Informasi Dokumen">
 <Desc items={[
 { label: 'Jenis', value: DOC_TYPES.find(t => t.value === drawerRow.doc_type)?.label ?? drawerRow.doc_type },
 { label: 'Nomor', value: drawerRow.doc_no },
 { label: 'Proyek', value: projName(drawerRow.project_id) },
 { label: 'Versi', value: `v${drawerRow.version}` },
 { label: 'Status', value: <Badge>{drawerRow.status}</Badge> },
 { label: 'Disetujui Pada', value: drawerRow.approved_at ? tglJam(drawerRow.approved_at) : '-' },
 ]} />
 </Section>
 {drawerRow.note && <Section title="Catatan"><p className="text-body whitespace-pre-line">{drawerRow.note}</p></Section>}
 {fileUrl && <Section title="Berkas"><a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary-600 hover:underline"><FileText size={16} /> Buka berkas</a></Section>}
 <Section title="Riwayat Versi">
 <Timeline items={lineage(drawerRow).map((v: any) => ({
 title: `v${v.version} — ${v.status === 'obsolete' ? 'Usang' : v.status === 'approved' ? 'Disetujui' : v.status === 'rejected' ? 'Ditolak' : v.status === 'review' ? 'Review' : 'Draft'}`,
 note: v.id === drawerRow.id ? '(sedang dilihat)' : undefined,
 time: tgl(v.created_at),
 }))} />
 </Section>
 </div>
 )}
 </Drawer>
 </div>
 )
}
