import React, { useEffect, useMemo, useState } from 'react'
import { chartColors } from '@/lib/theme'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, uploadFile, signedUrl } from '@/lib/db'
import {
 PageHeader, Card, CardHeader, DataTable, Drawer, Modal, ConfirmDialog, Field, Input, Textarea, Select,
 Button, Badge, Desc, Section, useToast, Plus, EmptyState, FilterBar,
} from '@/components/ui'
import { pct, tgl, num } from '@/lib/format'
import { deviationTone, projectLabel } from '../lib/shared'
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Image as ImageIcon } from 'lucide-react'

export default function Progres() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const loc = useLocation() as any
 const writable = can('DEPLOYMENT', 'write')

 const [projects, setProjects] = useState<any[]>([])
 const [projectId, setProjectId] = useState<string>(loc?.state?.projectId ?? '')
 const [loading, setLoading] = useState(false)
 const [rows, setRows] = useState<any[]>([])

 const [open, setOpen] = useState(false)
 const [editing, setEditing] = useState<any>(null)
 const [form, setForm] = useState<any>({})
 const [saving, setSaving] = useState(false)
 const [files, setFiles] = useState<File[]>([])

 const [drawerRow, setDrawerRow] = useState<any>(null)
 const [gallery, setGallery] = useState<string[]>([])
 const [delRow, setDelRow] = useState<any>(null)

 useEffect(() => {
 (async () => {
 if (!profile?.company_id) return
 const p = await list('projects', { select: 'id,project_code,project_name', order: { col: 'project_code', asc: true } })
 setProjects(p)
 if (!projectId && p.length) setProjectId(loc?.state?.projectId ?? p[0].id)
 })()
 }, [profile?.company_id])

 const loadRows = async (pid: string) => {
 setLoading(true)
 try { setRows(await list('progress_reports', { eq: { project_id: pid }, order: { col: 'report_date', asc: true } })) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memuat data', 'error') }
 finally { setLoading(false) }
 }
 useEffect(() => { if (projectId) loadRows(projectId) }, [projectId])

 const chartData = useMemo(() => rows.map(r => ({
 minggu: `M${r.week_no ?? '-'} · ${tgl(r.report_date)}`, plan: Number(r.plan_percent ?? 0), actual: Number(r.actual_percent ?? 0), deviasi: Number(r.deviation ?? 0),
 })), [rows])

 const openAdd = () => {
 setEditing(null); setFiles([])
 setForm({ project_id: projectId, report_date: new Date().toISOString().slice(0, 10), plan_percent: 0, actual_percent: 0, week_no: rows.length + 1 })
 setOpen(true)
 }
 const openEdit = (r: any) => { setEditing(r); setFiles([]); setForm({ ...r }); setOpen(true) }

 const deviasiPreview = useMemo(() => Number(form.actual_percent ?? 0) - Number(form.plan_percent ?? 0), [form.plan_percent, form.actual_percent])

 const save = async () => {
 if (!form.project_id) { toast.push('Proyek wajib dipilih', 'error'); return }
 setSaving(true)
 try {
 let photoUrls: string[] = Array.isArray(form.photo_urls) ? [...form.photo_urls] : []
 for (const f of files) { const path = await uploadFile(profile!.company_id, 'progress', f); photoUrls.push(path) }
 const plan = Number(form.plan_percent ?? 0), actual = Number(form.actual_percent ?? 0)
 const payload = {
 company_id: profile!.company_id, project_id: form.project_id, report_date: form.report_date || null,
 week_no: Number(form.week_no ?? 0) || null, plan_percent: plan, actual_percent: actual, deviation: actual - plan,
 activities: form.activities || null, constraints: form.constraints || null, next_plan: form.next_plan || null,
 photo_urls: photoUrls, reported_by: profile!.id,
 }
 if (editing) { await update('progress_reports', editing.id, payload); toast.push('Laporan diperbarui') }
 else { await insert('progress_reports', { ...payload, created_by: profile!.id }); toast.push('Laporan ditambahkan') }
 setOpen(false); loadRows(projectId)
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan', 'error') }
 finally { setSaving(false) }
 }
 const doDelete = async () => {
 if (!delRow) return
 try { await remove('progress_reports', delRow.id); toast.push('Laporan dihapus'); if (drawerRow?.id === delRow.id) setDrawerRow(null); loadRows(projectId) }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus', 'error') }
 }
 const openDrawer = async (row: any) => { setDrawerRow(row); setGallery((await Promise.all((row.photo_urls ?? []).map((p: string) => signedUrl(p)))).filter(Boolean) as string[]) }

 return (
 <div>
 <PageHeader title="Progres & Kurva S" subtitle="Laporan progres mingguan per proyek"
 actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd} disabled={!projectId}>Tambah Laporan</Button>} />

 <FilterBar>
 <Field label="Proyek" className="min-w-[280px]">
 <Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} value={projectId} onChange={(e: any) => setProjectId(e.target.value)} />
 </Field>
 </FilterBar>

 {!projectId ? <EmptyState title="Pilih proyek" /> : (
 <>
 <Card className="mb-4">
 <CardHeader title="Kurva S" subtitle="Rencana vs Realisasi kumulatif, dengan area deviasi" />
 <div className="p-4 h-[320px]">
 {chartData.length === 0 ? <p className="text-caption text-ink-400 text-center pt-28">Belum ada laporan progres.</p> : (
 <ResponsiveContainer width="100%" height="100%">
 <ComposedChart data={chartData}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="minggu" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={55} />
 <YAxis yAxisId="left" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
 <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
 <Tooltip formatter={(v: any) => `${num(v, 1)}%`} />
 <Legend />
 <Area yAxisId="right" type="monotone" dataKey="deviasi" name="Deviasi" fill={chartColors().warning} fillOpacity={0.18} stroke={chartColors().warning} strokeWidth={1} />
 <Line yAxisId="left" type="monotone" dataKey="plan" name="Rencana" stroke={chartColors().neutral} strokeDasharray="4 3" dot={{ r: 2 }} strokeWidth={2} />
 <Line yAxisId="left" type="monotone" dataKey="actual" name="Realisasi" stroke={chartColors().primary} dot={{ r: 2 }} strokeWidth={2.5} />
 </ComposedChart>
 </ResponsiveContainer>)}
 </div>
 </Card>

 <Card>
 <CardHeader title="Riwayat Laporan" />
 <DataTable
 loading={loading} searchable={false} onRowClick={openDrawer}
 emptyTitle="Belum ada laporan progres"
 columns={[
 { key: 'report_date', header: 'Tanggal', render: (r) => tgl(r.report_date) },
 { key: 'week_no', header: 'Minggu ke', align: 'right' },
 { key: 'plan_percent', header: 'Rencana', align: 'right', render: (r) => pct(r.plan_percent, 0) },
 { key: 'actual_percent', header: 'Realisasi', align: 'right', render: (r) => pct(r.actual_percent, 0) },
 { key: 'deviation', header: 'Deviasi', align: 'right', render: (r) => <span className={deviationTone(r.deviation)}>{pct(r.deviation, 1)}</span> },
 { key: 'activities', header: 'Kegiatan' },
 ]}
 rows={[...rows].sort((a, b) => b.report_date.localeCompare(a.report_date))}
 />
 </Card>
 </>
 )}

 <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editing ? 'Ubah Laporan Progres' : 'Tambah Laporan Progres'}
 footer={<><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="Proyek" required><Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} value={form.project_id ?? ''} onChange={(e: any) => setForm({ ...form, project_id: e.target.value })} /></Field>
 <Field label="Tanggal Laporan"><Input type="date" value={form.report_date ?? ''} onChange={e => setForm({ ...form, report_date: e.target.value })} /></Field>
 <Field label="Minggu ke-"><Input type="number" min={1} value={form.week_no ?? 1} onChange={e => setForm({ ...form, week_no: e.target.value })} /></Field>
 <Field label="Deviasi (otomatis)"><Input readOnly disabled value={`${deviasiPreview.toFixed(1)}%`} className={deviationTone(deviasiPreview)} /></Field>
 <Field label="Rencana (%)"><Input type="number" min={0} max={100} value={form.plan_percent ?? 0} onChange={e => setForm({ ...form, plan_percent: e.target.value })} /></Field>
 <Field label="Realisasi (%)"><Input type="number" min={0} max={100} value={form.actual_percent ?? 0} onChange={e => setForm({ ...form, actual_percent: e.target.value })} /></Field>
 <Field label="Kegiatan" className="sm:col-span-2"><Textarea value={form.activities ?? ''} onChange={e => setForm({ ...form, activities: e.target.value })} /></Field>
 <Field label="Kendala" className="sm:col-span-2"><Textarea value={form.constraints ?? ''} onChange={e => setForm({ ...form, constraints: e.target.value })} /></Field>
 <Field label="Rencana Berikutnya" className="sm:col-span-2"><Textarea value={form.next_plan ?? ''} onChange={e => setForm({ ...form, next_plan: e.target.value })} /></Field>
 <Field label="Unggah Foto" className="sm:col-span-2">
 <input type="file" multiple accept="image/*" onChange={e => setFiles(Array.from(e.target.files ?? []))}
 className="block w-full text-body text-ink-600 file:mr-3 file:h-9 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
 </Field>
 </div>
 </Modal>

 <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} title={drawerRow ? `Laporan ${tgl(drawerRow.report_date)}` : ''}
 footer={drawerRow && <>
 {can('DEPLOYMENT', 'approve') && <Button variant="danger" onClick={() => setDelRow(drawerRow)}>Hapus</Button>}
 {writable && <Button onClick={() => openEdit(drawerRow)}>Ubah</Button>}
 </>}>
 {drawerRow && (
 <div>
 <Section title="Ringkasan">
 <Desc items={[
 { label: 'Minggu ke', value: drawerRow.week_no },
 { label: 'Rencana', value: pct(drawerRow.plan_percent, 0) },
 { label: 'Realisasi', value: pct(drawerRow.actual_percent, 0) },
 { label: 'Deviasi', value: <span className={deviationTone(drawerRow.deviation)}>{pct(drawerRow.deviation, 1)}</span> },
 ]} />
 </Section>
 {drawerRow.activities && <Section title="Kegiatan"><p className="text-body whitespace-pre-line">{drawerRow.activities}</p></Section>}
 {drawerRow.constraints && <Section title="Kendala"><p className="text-body whitespace-pre-line">{drawerRow.constraints}</p></Section>}
 {drawerRow.next_plan && <Section title="Rencana Berikutnya"><p className="text-body whitespace-pre-line">{drawerRow.next_plan}</p></Section>}
 <Section title="Foto">
 {gallery.length === 0 ? <EmptyState icon={<ImageIcon size={22} />} title="Belum ada foto" /> : (
 <div className="grid grid-cols-3 gap-2">{gallery.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="block aspect-square rounded-sm overflow-hidden border border-ink-200"><img src={u} className="w-full h-full object-cover" /></a>)}</div>)}
 </Section>
 </div>
 )}
 </Drawer>

 <ConfirmDialog open={!!delRow} onClose={() => setDelRow(null)} onConfirm={doDelete} danger title="Hapus Laporan" message="Hapus laporan progres ini?" />
 </div>
 )
}
