import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo, uploadFile, signedUrl } from '@/lib/db'
import {
 PageHeader, Card, CardHeader, DataTable, Drawer, Modal, ConfirmDialog, Field, Input, Textarea, Select,
 Button, Badge, Desc, Section, Tabs, useToast, Plus, EmptyState, FilterBar,
} from '@/components/ui'
import { tgl, num } from '@/lib/format'
import {
 PUNCH_STATUS, PUNCH_STATUS_TABS, PUNCH_SEVERITY, PUNCH_CATEGORY, PUNCH_OPEN_STATUSES, severityTone,
 projectLabel, fetchProjectsAndEmployees, CHART_COLORS, PunchPhoto,
} from '../lib/shared'
import { AlertTriangle, ShieldAlert, Image as ImageIcon, CheckCircle2 } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

export default function Punchlist() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const writable = can('DEPLOYMENT', 'write')
 const approver = can('DEPLOYMENT', 'approve')

 const [projects, setProjects] = useState<any[]>([])
 const [employees, setEmployees] = useState<any[]>([])
 const [filterProject, setFilterProject] = useState('')
 const [tab, setTab] = useState('semua')
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])

 const [open, setOpen] = useState(false)
 const [editing, setEditing] = useState<any>(null)
 const [form, setForm] = useState<any>({})
 const [files, setFiles] = useState<File[]>([])
 const [saving, setSaving] = useState(false)

 const [fixOf, setFixOf] = useState<any>(null)
 const [fixForm, setFixForm] = useState<any>({})
 const [fixFiles, setFixFiles] = useState<File[]>([])
 const [fixing, setFixing] = useState(false)

 const [drawerRow, setDrawerRow] = useState<any>(null)
 const [galleryTemuan, setGalleryTemuan] = useState<string[]>([])
 const [galleryPerbaikan, setGalleryPerbaikan] = useState<string[]>([])
 const [delRow, setDelRow] = useState<any>(null)

 const load = async () => {
 if (!profile?.company_id) return
 setLoading(true)
 try {
 const [p, extra] = await Promise.all([
 list('punch_lists', { order: { col: 'found_date', asc: false }, limit: 3000 }),
 fetchProjectsAndEmployees(),
 ])
 setRows(p); setProjects(extra.projects); setEmployees(extra.employees)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data punch list', 'error') }
 finally { setLoading(false) }
 }
 useEffect(() => { load() }, [profile?.company_id])

 const projName = (id?: string) => { const p = projects.find(x => x.id === id); return p ? projectLabel(p) : '-' }
 const empName = (id?: string) => employees.find(e => e.id === id)?.full_name ?? '-'
 const catLabel = (v?: string) => PUNCH_CATEGORY.find(c => c.value === v)?.label ?? (v || '-')

 const byProject = useMemo(() => filterProject ? rows.filter(r => r.project_id === filterProject) : rows, [rows, filterProject])
 const scoped = useMemo(() => tab === 'semua' ? byProject : byProject.filter(r => r.status === tab), [byProject, tab])
 const tabCounts = useMemo(() => {
 const m: Record<string, number> = { semua: byProject.length }
 for (const s of PUNCH_STATUS_TABS) m[s] = byProject.filter(r => r.status === s).length
 return m
 }, [byProject])

 /** Kesiapan serah terima per proyek: hitung temuan yang masih menggantung (belum ditutup) per tingkat.
 * Proyek tidak boleh dinyatakan selesai bila masih ada temuan kritis/mayor yang terbuka. */
 const readiness = useMemo(() => {
 const map: Record<string, { minor: number; mayor: number; kritis: number }> = {}
 for (const r of rows) {
 if (!PUNCH_OPEN_STATUSES.includes(r.status)) continue
 if (!map[r.project_id]) map[r.project_id] = { minor: 0, mayor: 0, kritis: 0 }
 if (r.severity && map[r.project_id][r.severity as 'minor' | 'mayor' | 'kritis'] != null) map[r.project_id][r.severity as 'minor' | 'mayor' | 'kritis']++
 }
 return Object.entries(map).map(([pid, v]) => ({ project_id: pid, ...v, blocking: v.mayor > 0 || v.kritis > 0 }))
 .sort((a, b) => (b.kritis - a.kritis) || (b.mayor - a.mayor))
 }, [rows])

 const perKategori = useMemo(() => {
 const m: Record<string, number> = {}
 for (const r of rows) { const k = catLabel(r.category); m[k] = (m[k] ?? 0) + 1 }
 return Object.entries(m).map(([kategori, jumlah]) => ({ kategori, jumlah })).sort((a, b) => b.jumlah - a.jumlah)
 }, [rows])
 const perProyek = useMemo(() => {
 const m: Record<string, number> = {}
 for (const r of rows) { const k = projName(r.project_id); m[k] = (m[k] ?? 0) + 1 }
 return Object.entries(m).map(([proyek, jumlah]) => ({ proyek, jumlah })).sort((a, b) => b.jumlah - a.jumlah).slice(0, 12)
 }, [rows, projects])

 const openAdd = async () => {
 let no = ''
 try { no = await nextDocNo(profile!.company_id, 'PNC') } catch {}
 setEditing(null); setFiles([])
 setForm({ punch_no: no, project_id: filterProject || '', found_date: new Date().toISOString().slice(0, 10), severity: 'minor', category: 'instalasi', status: 'terbuka' })
 setOpen(true)
 }
 const openEdit = (r: any) => { setEditing(r); setFiles([]); setForm({ ...r }); setOpen(true) }

 const save = async () => {
 if (!form.project_id) { toast.push('Proyek wajib dipilih', 'error'); return }
 if (!form.description) { toast.push('Uraian temuan wajib diisi', 'error'); return }
 setSaving(true)
 try {
 let photos: PunchPhoto[] = Array.isArray(form.photo_urls) ? [...form.photo_urls] : []
 for (const f of files) { const path = await uploadFile(profile!.company_id, 'punchlist', f); photos.push({ url: path, kind: 'temuan', at: new Date().toISOString() }) }
 const payload = {
 company_id: profile!.company_id, project_id: form.project_id, found_date: form.found_date || null,
 location: form.location || null, lat: form.lat === '' ? null : Number(form.lat), lng: form.lng === '' ? null : Number(form.lng),
 category: form.category || null, description: form.description, severity: form.severity || null,
 assigned_to: form.assigned_to || null, due_date: form.due_date || null, status: form.status || 'terbuka',
 photo_urls: photos, punch_no: form.punch_no,
 }
 if (editing) { await update('punch_lists', editing.id, payload); toast.push('Temuan diperbarui') }
 else { await insert('punch_lists', { ...payload, created_by: profile!.id }); toast.push('Temuan ditambahkan') }
 setOpen(false); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan temuan', 'error') }
 finally { setSaving(false) }
 }
 const doDelete = async () => {
 if (!delRow) return
 try { await remove('punch_lists', delRow.id); toast.push('Temuan dihapus'); if (drawerRow?.id === delRow.id) setDrawerRow(null); load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus temuan', 'error') }
 }

 const openFix = (r: any) => { setFixOf(r); setFixForm({ fixed_date: new Date().toISOString().slice(0, 10), note: '' }); setFixFiles([]) }
 const saveFix = async () => {
 setFixing(true)
 try {
 let photos: PunchPhoto[] = Array.isArray(fixOf.photo_urls) ? [...fixOf.photo_urls] : []
 for (const f of fixFiles) { const path = await uploadFile(profile!.company_id, 'punchlist', f); photos.push({ url: path, kind: 'perbaikan', at: new Date().toISOString() }) }
 const upd = await update('punch_lists', fixOf.id, { status: 'diperbaiki', fixed_date: fixForm.fixed_date || null, photo_urls: photos })
 toast.push('Temuan ditandai sudah diperbaiki, menunggu verifikasi'); setFixOf(null)
 setDrawerRow((d: any) => d?.id === upd.id ? upd : d); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan perbaikan', 'error') }
 finally { setFixing(false) }
 }

 const verifikasi = async (row: any, ok: boolean) => {
 try {
 const upd = await update('punch_lists', row.id, ok ? { status: 'diverifikasi', verified_by: profile!.id } : { status: 'terbuka' })
 toast.push(ok ? 'Perbaikan diverifikasi' : 'Perbaikan ditolak, temuan dibuka kembali')
 setDrawerRow(upd); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal memperbarui status', 'error') }
 }
 const tutup = async (row: any) => {
 try { const upd = await update('punch_lists', row.id, { status: 'ditutup' }); toast.push('Temuan ditutup'); setDrawerRow(upd); load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menutup temuan', 'error') }
 }

 const openDrawer = async (row: any) => {
 setDrawerRow(row)
 const photos: PunchPhoto[] = Array.isArray(row.photo_urls) ? row.photo_urls : []
 const temuan = photos.filter(p => p.kind === 'temuan')
 const perbaikan = photos.filter(p => p.kind === 'perbaikan')
 setGalleryTemuan((await Promise.all(temuan.map(p => signedUrl(p.url)))).filter(Boolean) as string[])
 setGalleryPerbaikan((await Promise.all(perbaikan.map(p => signedUrl(p.url)))).filter(Boolean) as string[])
 }

 return (
 <div>
 <PageHeader title="Punch List & Defect" subtitle="Temuan hasil inspeksi serah terima dan tindak lanjut perbaikan"
 actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Temuan</Button>} />

 <FilterBar>
 <Field label="Proyek" className="min-w-[260px]">
 <Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} placeholder="Semua Proyek" value={filterProject} onChange={(e: any) => setFilterProject(e.target.value)} />
 </Field>
 </FilterBar>

 <Card className="mb-4 border border-amber-200 dark:border-amber-900">
 <CardHeader title={<span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-300"><ShieldAlert size={16} /> Kesiapan Serah Terima per Proyek</span>}
 subtitle="Proyek tidak boleh dinyatakan selesai selama masih ada temuan kritis/mayor yang belum ditutup" />
 {readiness.length === 0 ? <EmptyState title="Tidak ada temuan menggantung" message="Seluruh temuan pada seluruh proyek sudah ditutup." /> : (
 <DataTable searchable={false}
 columns={[
 { key: 'project_id', header: 'Proyek', render: (r: any) => projName(r.project_id) },
 { key: 'minor', header: 'Minor Terbuka', align: 'right' },
 { key: 'mayor', header: 'Mayor Terbuka', align: 'right', render: (r: any) => <span className={r.mayor > 0 ? 'text-orange-600 font-semibold' : ''}>{num(r.mayor)}</span> },
 { key: 'kritis', header: 'Kritis Terbuka', align: 'right', render: (r: any) => <span className={r.kritis > 0 ? 'text-red-600 font-semibold' : ''}>{num(r.kritis)}</span> },
 { key: 'blocking', header: 'Status Serah Terima', render: (r: any) => r.blocking
 ? <Badge tone="red">Belum boleh serah terima</Badge>
 : <Badge tone="emerald">Aman untuk serah terima</Badge> },
 ]}
 rows={readiness}
 onRowClick={(r: any) => setFilterProject(r.project_id)} />)}
 </Card>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
 <Card>
 <CardHeader title="Temuan per Kategori" />
 <div className="p-4 h-[260px]">
 {perKategori.length === 0 ? <p className="text-caption text-ink-400 text-center pt-20">Belum ada data temuan.</p> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={perKategori}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="kategori" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={55} />
 <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
 <Tooltip />
 <Bar dataKey="jumlah" radius={[3, 3, 0, 0]} fill={CHART_COLORS()[0]} />
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 <Card>
 <CardHeader title="Temuan per Proyek" subtitle="12 proyek dengan temuan terbanyak" />
 <div className="p-4 h-[260px]">
 {perProyek.length === 0 ? <p className="text-caption text-ink-400 text-center pt-20">Belum ada data temuan.</p> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={perProyek}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="proyek" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={60} />
 <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
 <Tooltip />
 <Bar dataKey="jumlah" radius={[3, 3, 0, 0]} fill={CHART_COLORS()[1]} />
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 </div>

 <Card>
 <Tabs className="px-4" tabs={[{ value: 'semua', label: 'Semua', count: tabCounts.semua },
 ...PUNCH_STATUS_TABS.map(s => ({ value: s, label: PUNCH_STATUS.find(x => x.value === s)?.label ?? s, count: tabCounts[s] }))]}
 value={tab} onChange={setTab} />
 <DataTable
 loading={loading} searchKeys={['punch_no', 'description', 'location']} exportName="punchlist"
 onRowClick={openDrawer}
 emptyTitle="Belum ada temuan"
 emptyAction={writable && <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Tambah Temuan</Button>}
 columns={[
 { key: 'punch_no', header: 'Nomor', width: '110px' },
 { key: 'project_id', header: 'Proyek', render: (r) => projName(r.project_id) },
 { key: 'found_date', header: 'Tgl Temuan', render: (r) => tgl(r.found_date) },
 { key: 'location', header: 'Lokasi', render: (r) => <span>{r.location ?? '-'}{r.lat != null && r.lng != null ? <span className="text-caption text-ink-400 block">{r.lat}, {r.lng}</span> : null}</span> },
 { key: 'category', header: 'Kategori', render: (r) => catLabel(r.category) },
 { key: 'description', header: 'Uraian' },
 { key: 'severity', header: 'Tingkat', render: (r) => <Badge tone={severityTone(r.severity)}>{r.severity}</Badge> },
 { key: 'assigned_to', header: 'PIC', render: (r) => empName(r.assigned_to) },
 { key: 'due_date', header: 'Tenggat', render: (r) => tgl(r.due_date) },
 { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
 ]}
 rows={scoped}
 />
 </Card>

 <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editing ? 'Ubah Temuan' : 'Tambah Temuan'}
 footer={<><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="Nomor Temuan"><Input value={form.punch_no ?? ''} readOnly disabled /></Field>
 <Field label="Proyek" required><Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} value={form.project_id ?? ''} onChange={(e: any) => setForm({ ...form, project_id: e.target.value })} /></Field>
 <Field label="Tanggal Temuan"><Input type="date" value={form.found_date ?? ''} onChange={e => setForm({ ...form, found_date: e.target.value })} /></Field>
 <Field label="Tenggat Perbaikan"><Input type="date" value={form.due_date ?? ''} onChange={e => setForm({ ...form, due_date: e.target.value })} /></Field>
 <Field label="Lokasi"><Input value={form.location ?? ''} onChange={e => setForm({ ...form, location: e.target.value })} /></Field>
 <Field label="Penanggung Jawab"><Select options={employees.map(e => ({ value: e.id, label: e.full_name }))} value={form.assigned_to ?? ''} onChange={(e: any) => setForm({ ...form, assigned_to: e.target.value })} /></Field>
 <Field label="Koordinat Lat"><Input type="number" step="0.000001" value={form.lat ?? ''} onChange={e => setForm({ ...form, lat: e.target.value })} /></Field>
 <Field label="Koordinat Lng"><Input type="number" step="0.000001" value={form.lng ?? ''} onChange={e => setForm({ ...form, lng: e.target.value })} /></Field>
 <Field label="Kategori"><Select options={PUNCH_CATEGORY} value={form.category ?? ''} onChange={(e: any) => setForm({ ...form, category: e.target.value })} /></Field>
 <Field label="Tingkat" required><Select options={PUNCH_SEVERITY} value={form.severity ?? ''} onChange={(e: any) => setForm({ ...form, severity: e.target.value })} /></Field>
 <Field label="Uraian Temuan" required className="sm:col-span-2"><Textarea value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
 {editing && <Field label="Status"><Select options={PUNCH_STATUS} value={form.status ?? 'terbuka'} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>}
 <Field label="Unggah Foto Temuan" className="sm:col-span-2">
 <input type="file" multiple accept="image/*" onChange={e => setFiles(Array.from(e.target.files ?? []))}
 className="block w-full text-body text-ink-600 file:mr-3 file:h-9 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
 </Field>
 </div>
 </Modal>

 <Modal open={!!fixOf} onClose={() => setFixOf(null)} title={fixOf ? `Tandai Diperbaiki — ${fixOf.punch_no}` : ''}
 footer={<><Button variant="outline" onClick={() => setFixOf(null)}>Batal</Button><Button loading={fixing} onClick={saveFix}>Simpan Perbaikan</Button></>}>
 <div className="space-y-4">
 <Field label="Tanggal Perbaikan"><Input type="date" value={fixForm.fixed_date ?? ''} onChange={e => setFixForm({ ...fixForm, fixed_date: e.target.value })} /></Field>
 <Field label="Unggah Foto Perbaikan" required>
 <input type="file" multiple accept="image/*" onChange={e => setFixFiles(Array.from(e.target.files ?? []))}
 className="block w-full text-body text-ink-600 file:mr-3 file:h-9 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
 </Field>
 <p className="text-caption text-ink-400">Setelah disimpan, temuan berpindah ke status "Diperbaiki" dan menunggu verifikasi.</p>
 </div>
 </Modal>

 <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} title={drawerRow ? `Temuan ${drawerRow.punch_no}` : ''}
 footer={drawerRow && <>
 {approver && <Button variant="danger" onClick={() => setDelRow(drawerRow)}>Hapus</Button>}
 {writable && drawerRow.status === 'terbuka' && <Button variant="outline" onClick={() => openFix(drawerRow)}>Tandai Diperbaiki</Button>}
 {approver && drawerRow.status === 'diperbaiki' && <><Button variant="danger" onClick={() => verifikasi(drawerRow, false)}>Tolak</Button><Button variant="success" onClick={() => verifikasi(drawerRow, true)}>Verifikasi</Button></>}
 {approver && drawerRow.status === 'diverifikasi' && <Button onClick={() => tutup(drawerRow)}>Tutup Temuan</Button>}
 {writable && <Button variant="outline" onClick={() => openEdit(drawerRow)}>Ubah</Button>}
 </>}>
 {drawerRow && (
 <div>
 {(drawerRow.severity === 'kritis' || drawerRow.severity === 'mayor') && PUNCH_OPEN_STATUSES.includes(drawerRow.status) && (
 <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-body text-red-700 dark:text-red-300 flex items-center gap-2">
 <AlertTriangle size={16} /> Temuan tingkat {drawerRow.severity} masih terbuka — proyek tidak boleh dinyatakan selesai.
 </div>)}
 <Section title="Informasi Temuan">
 <Desc items={[
 { label: 'Proyek', value: projName(drawerRow.project_id) },
 { label: 'Tanggal Temuan', value: tgl(drawerRow.found_date) },
 { label: 'Lokasi', value: drawerRow.location },
 { label: 'Koordinat', value: drawerRow.lat != null && drawerRow.lng != null ? `${drawerRow.lat}, ${drawerRow.lng}` : '-' },
 { label: 'Kategori', value: catLabel(drawerRow.category) },
 { label: 'Tingkat', value: <Badge tone={severityTone(drawerRow.severity)}>{drawerRow.severity}</Badge> },
 { label: 'Penanggung Jawab', value: empName(drawerRow.assigned_to) },
 { label: 'Tenggat', value: tgl(drawerRow.due_date) },
 { label: 'Tanggal Perbaikan', value: tgl(drawerRow.fixed_date) },
 { label: 'Status', value: <Badge>{drawerRow.status}</Badge> },
 ]} />
 </Section>
 <Section title="Uraian"><p className="text-body whitespace-pre-line">{drawerRow.description}</p></Section>
 <Section title="Foto Temuan">
 {galleryTemuan.length === 0 ? <EmptyState icon={<ImageIcon size={22} />} title="Belum ada foto temuan" /> : (
 <div className="grid grid-cols-3 gap-2">{galleryTemuan.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="block aspect-square rounded-sm overflow-hidden border border-ink-200"><img src={u} className="w-full h-full object-cover" /></a>)}</div>)}
 </Section>
 <Section title="Foto Perbaikan">
 {galleryPerbaikan.length === 0 ? <EmptyState icon={<CheckCircle2 size={22} />} title="Belum ada foto perbaikan" /> : (
 <div className="grid grid-cols-3 gap-2">{galleryPerbaikan.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="block aspect-square rounded-sm overflow-hidden border border-ink-200"><img src={u} className="w-full h-full object-cover" /></a>)}</div>)}
 </Section>
 </div>
 )}
 </Drawer>

 <ConfirmDialog open={!!delRow} onClose={() => setDelRow(null)} onConfirm={doDelete} danger title="Hapus Temuan" message="Hapus data temuan ini? Tindakan tidak dapat dibatalkan." />
 </div>
 )
}
