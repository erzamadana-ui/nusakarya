import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo, uploadFile, signedUrl } from '@/lib/db'
import {
 PageHeader, Card, CardHeader, DataTable, Drawer, Modal, ConfirmDialog, Field, Input, Textarea, Select, Money, Progress,
 Button, Badge, Desc, Section, Timeline, useToast, Plus, EmptyState, FilterBar, KpiCard,
} from '@/components/ui'
import { tgl, rupiah, num, pct } from '@/lib/format'
import {
 SUBKON_STATUS, plannedProgressLinear, projectLabel, fetchProjectsAndEmployees,
} from '../lib/shared'
import { ShieldCheck } from 'lucide-react'

export default function Subkon() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const writable = can('DEPLOYMENT', 'write')
 const approver = can('DEPLOYMENT', 'approve')

 const [projects, setProjects] = useState<any[]>([])
 const [vendors, setVendors] = useState<any[]>([])
 const [filterProject, setFilterProject] = useState('')
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])

 const [open, setOpen] = useState(false)
 const [editing, setEditing] = useState<any>(null)
 const [form, setForm] = useState<any>({})
 const [file, setFile] = useState<File | null>(null)
 const [saving, setSaving] = useState(false)

 const [drawerRow, setDrawerRow] = useState<any>(null)
 const [progress, setProgress] = useState<any[]>([])
 const [loadingProgress, setLoadingProgress] = useState(false)
 const [delRow, setDelRow] = useState<any>(null)

 const [reportOpen, setReportOpen] = useState(false)
 const [reportForm, setReportForm] = useState<any>({})
 const [reportFiles, setReportFiles] = useState<File[]>([])
 const [reporting, setReporting] = useState(false)

 const [verifiers, setVerifiers] = useState<Record<string, string>>({})

 const load = async () => {
 if (!profile?.company_id) return
 setLoading(true)
 try {
 const [pkgs, extra] = await Promise.all([
 list('subcontract_packages', { order: { col: 'created_at', asc: false }, limit: 2000 }),
 fetchProjectsAndEmployees(),
 ])
 setRows(pkgs); setProjects(extra.projects); setVendors(extra.vendors.filter((v: any) => v.vendor_type === 'subkon'))
 const profiles = await list('profiles', { select: 'id,full_name', limit: 2000 })
 setVerifiers(Object.fromEntries(profiles.map((p: any) => [p.id, p.full_name])))
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data paket subkontraktor', 'error') }
 finally { setLoading(false) }
 }
 useEffect(() => { load() }, [profile?.company_id])

 const projName = (id?: string) => { const p = projects.find(x => x.id === id); return p ? projectLabel(p) : '-' }
 const vendorName = (id?: string) => vendors.find(v => v.id === id)?.name ?? '-'
 const scoped = useMemo(() => filterProject ? rows.filter(r => r.project_id === filterProject) : rows, [rows, filterProject])

 /** "Terlambat" = progres realisasi berada di bawah rencana linier berdasarkan waktu berjalan pada periode
 * kontrak — perhitungan sistem/asumsi untuk indikator dini, bukan acuan kontraktual formal. */
 const withPlan = useMemo(() => rows.map(r => {
 const planned = plannedProgressLinear(r.start_date, r.end_date)
 const late = r.status === 'aktif' && planned != null && Number(r.progress_percent || 0) < planned
 return { ...r, _planned: planned, _late: late }
 }), [rows])
 const scopedWithPlan = useMemo(() => filterProject ? withPlan.filter(r => r.project_id === filterProject) : withPlan, [withPlan, filterProject])

 const kpi = useMemo(() => {
 const aktif = rows.filter(r => r.status === 'aktif')
 const nilaiBerjalan = aktif.reduce((s, r) => s + Number(r.contract_value || 0), 0)
 const terlambat = withPlan.filter(r => r._late).length
 return { paketAktif: aktif.length, nilaiBerjalan, terlambat }
 }, [rows, withPlan])

 const openAdd = async () => {
 let no = ''
 try { no = await nextDocNo(profile!.company_id, 'SUB') } catch {}
 setEditing(null); setFile(null)
 setForm({ package_no: no, project_id: filterProject || '', contract_value: 0, retention_percent: 5, progress_percent: 0, status: 'draft' })
 setOpen(true)
 }
 const openEdit = (r: any) => { setEditing(r); setFile(null); setForm({ ...r }); setOpen(true) }

 const save = async () => {
 if (!form.project_id) { toast.push('Proyek wajib dipilih', 'error'); return }
 if (!form.vendor_id) { toast.push('Vendor subkontraktor wajib dipilih', 'error'); return }
 setSaving(true)
 try {
 let fileUrlPath = form.file_url ?? null
 if (file) fileUrlPath = await uploadFile(profile!.company_id, 'subkon', file)
 const payload = {
 company_id: profile!.company_id, project_id: form.project_id, vendor_id: form.vendor_id, package_no: form.package_no,
 scope: form.scope || null, contract_value: Number(form.contract_value || 0), retention_percent: Number(form.retention_percent || 0),
 start_date: form.start_date || null, end_date: form.end_date || null, status: form.status || 'draft',
 progress_percent: editing ? Number(form.progress_percent || 0) : 0, file_url: fileUrlPath,
 }
 if (editing) { await update('subcontract_packages', editing.id, payload); toast.push('Paket subkontraktor diperbarui') }
 else { await insert('subcontract_packages', { ...payload, created_by: profile!.id }); toast.push('Paket subkontraktor ditambahkan') }
 setOpen(false); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan paket', 'error') }
 finally { setSaving(false) }
 }
 const doDelete = async () => {
 if (!delRow) return
 try { await remove('subcontract_packages', delRow.id); toast.push('Paket dihapus'); if (drawerRow?.id === delRow.id) setDrawerRow(null); load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus paket', 'error') }
 }

 const openDrawer = async (row: any) => {
 setDrawerRow(row); setLoadingProgress(true)
 try { setProgress(await list('subcontract_progress', { eq: { package_id: row.id }, order: { col: 'report_date', asc: false } })) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memuat riwayat progres', 'error') }
 finally { setLoadingProgress(false) }
 }

 const lastProgress = progress[0]
 const totalDiklaim = Number(lastProgress?.amount_claimed || 0)
 const retensiDitahan = totalDiklaim * Number(drawerRow?.retention_percent || 0) / 100
 const sisa = Number(drawerRow?.contract_value || 0) - totalDiklaim

 const openReport = () => {
 setReportForm({ report_date: new Date().toISOString().slice(0, 10), progress_percent: drawerRow?.progress_percent ?? 0, amount_claimed: lastProgress?.amount_claimed ?? 0, note: '' })
 setReportFiles([]); setReportOpen(true)
 }
 const saveReport = async () => {
 const newPct = Number(reportForm.progress_percent || 0)
 const newClaim = Number(reportForm.amount_claimed || 0)
 const lastPct = Number(drawerRow?.progress_percent || 0)
 const lastClaim = Number(lastProgress?.amount_claimed || 0)
 const contractValue = Number(drawerRow?.contract_value || 0)
 if (newPct < lastPct) { toast.push(`Progres tidak boleh turun dari ${pct(lastPct)}`, 'error'); return }
 if (newPct < 0 || newPct > 100) { toast.push('Progres harus di antara 0–100%', 'error'); return }
 if (newClaim < lastClaim) { toast.push(`Nilai klaim kumulatif tidak boleh turun dari ${rupiah(lastClaim)}`, 'error'); return }
 if (newClaim > contractValue) { toast.push(`Nilai klaim kumulatif tidak boleh melebihi nilai kontrak (${rupiah(contractValue)})`, 'error'); return }
 setReporting(true)
 try {
 let photoUrls: string[] = []
 for (const f of reportFiles) { const path = await uploadFile(profile!.company_id, 'subkon-progress', f); photoUrls.push(path) }
 await insert('subcontract_progress', {
 company_id: profile!.company_id, package_id: drawerRow.id, report_date: reportForm.report_date || null,
 progress_percent: newPct, amount_claimed: newClaim, photo_urls: photoUrls, note: reportForm.note || null, created_by: profile!.id,
 })
 const newStatus = drawerRow.status === 'draft' ? 'aktif' : (newPct >= 100 ? 'selesai' : drawerRow.status)
 const updPkg = await update('subcontract_packages', drawerRow.id, { progress_percent: newPct, status: newStatus })
 toast.push('Laporan progres ditambahkan')
 setDrawerRow(updPkg); setReportOpen(false)
 setProgress(await list('subcontract_progress', { eq: { package_id: drawerRow.id }, order: { col: 'report_date', asc: false } }))
 load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan laporan progres', 'error') }
 finally { setReporting(false) }
 }

 const verifyLast = async () => {
 if (!lastProgress || lastProgress.verified_by) return
 try {
 await update('subcontract_progress', lastProgress.id, { verified_by: profile!.id })
 toast.push('Laporan progres terakhir diverifikasi')
 setProgress(await list('subcontract_progress', { eq: { package_id: drawerRow.id }, order: { col: 'report_date', asc: false } }))
 } catch (e: any) { toast.push(e.message ?? 'Gagal memverifikasi laporan', 'error') }
 }

 return (
 <div>
 <PageHeader title="Paket Subkontraktor" subtitle="Kontrak kerja subkontraktor, progres, dan rekap keuangan retensi"
 actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Paket</Button>} />

 <FilterBar>
 <Field label="Proyek" className="min-w-[260px]">
 <Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} placeholder="Semua Proyek" value={filterProject} onChange={(e: any) => setFilterProject(e.target.value)} />
 </Field>
 </FilterBar>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-1">
 <KpiCard label="Paket Aktif" value={num(kpi.paketAktif)} tone="teal" />
 <KpiCard label="Nilai Subkon Berjalan" value={rupiah(kpi.nilaiBerjalan, true)} tone="teal" />
 <KpiCard label="Paket Terlambat" value={num(kpi.terlambat)} tone={kpi.terlambat > 0 ? 'red' : 'emerald'} />
 </div>
 <p className="text-caption text-ink-400 mb-4">"Paket terlambat" dihitung sistem dari perbandingan progres realisasi terhadap rencana linier berdasarkan waktu berjalan pada periode kontrak (mulai–selesai) — merupakan indikator dini/asumsi, bukan acuan kontraktual. Sumber: subcontract_packages, ditarik saat halaman ini dibuka.</p>

 <Card>
 <CardHeader title="Daftar Paket Subkontraktor" />
 <DataTable
 loading={loading} searchKeys={['package_no', 'scope']} exportName="subkon"
 onRowClick={openDrawer}
 emptyTitle="Belum ada paket subkontraktor"
 emptyAction={writable && <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Tambah Paket</Button>}
 columns={[
 { key: 'package_no', header: 'Nomor', width: '110px' },
 { key: 'project_id', header: 'Proyek', render: (r) => projName(r.project_id) },
 { key: 'vendor_id', header: 'Vendor', render: (r) => vendorName(r.vendor_id) },
 { key: 'contract_value', header: 'Nilai Kontrak', align: 'right', render: (r) => rupiah(r.contract_value) },
 { key: '_periode', header: 'Periode', render: (r) => `${tgl(r.start_date)} – ${tgl(r.end_date)}` },
 { key: 'retention_percent', header: 'Retensi', align: 'right', render: (r) => pct(r.retention_percent, 0) },
 { key: 'progress_percent', header: 'Progres', width: '160px', render: (r: any) => (
 <div className="flex items-center gap-2">
 <div className="w-24"><Progress value={Number(r.progress_percent || 0)} tone={r._late ? 'danger' : Number(r.progress_percent) >= 100 ? 'success' : 'primary'} /></div>
 <span className="text-caption tabular">{pct(r.progress_percent, 0)}</span>
 </div>) },
 { key: '_late', header: 'Terlambat', render: (r: any) => r._late ? <Badge tone="red">terlambat</Badge> : <Badge tone="emerald">sesuai rencana</Badge> },
 { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
 ]}
 rows={scopedWithPlan}
 />
 </Card>

 <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editing ? 'Ubah Paket Subkontraktor' : 'Tambah Paket Subkontraktor'}
 footer={<><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="Nomor Paket"><Input value={form.package_no ?? ''} readOnly disabled /></Field>
 <Field label="Proyek" required><Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} value={form.project_id ?? ''} onChange={(e: any) => setForm({ ...form, project_id: e.target.value })} /></Field>
 <Field label="Vendor Subkontraktor" required><Select options={vendors.map(v => ({ value: v.id, label: `${v.code ? v.code + ' — ' : ''}${v.name}` }))} value={form.vendor_id ?? ''} onChange={(e: any) => setForm({ ...form, vendor_id: e.target.value })} /></Field>
 <Field label="Nilai Kontrak"><Money value={form.contract_value ?? 0} onChange={(v: number) => setForm({ ...form, contract_value: v })} /></Field>
 <Field label="Tanggal Mulai"><Input type="date" value={form.start_date ?? ''} onChange={e => setForm({ ...form, start_date: e.target.value })} /></Field>
 <Field label="Tanggal Selesai"><Input type="date" value={form.end_date ?? ''} onChange={e => setForm({ ...form, end_date: e.target.value })} /></Field>
 <Field label="Retensi (%)"><Input type="number" step="0.01" value={form.retention_percent ?? 0} onChange={e => setForm({ ...form, retention_percent: e.target.value })} /></Field>
 <Field label="Status"><Select options={SUBKON_STATUS} value={form.status ?? 'draft'} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>
 <Field label="Lingkup Pekerjaan" className="sm:col-span-2"><Textarea value={form.scope ?? ''} onChange={e => setForm({ ...form, scope: e.target.value })} /></Field>
 <Field label="Unggah Berkas Kontrak" className="sm:col-span-2">
 <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)}
 className="block w-full text-body text-ink-600 file:mr-3 file:h-9 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
 </Field>
 </div>
 </Modal>

 <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} width="max-w-2xl" title={drawerRow ? `Paket ${drawerRow.package_no} — ${vendorName(drawerRow.vendor_id)}` : ''}
 footer={drawerRow && <>
 {approver && <Button variant="danger" onClick={() => setDelRow(drawerRow)}>Hapus Paket</Button>}
 {writable && <Button variant="outline" onClick={() => openEdit(drawerRow)}>Ubah</Button>}
 {writable && drawerRow.status !== 'selesai' && drawerRow.status !== 'putus' && <Button onClick={openReport}>Tambah Laporan Progres</Button>}
 </>}>
 {drawerRow && (
 <div>
 <Section title="Informasi Paket">
 <Desc items={[
 { label: 'Proyek', value: projName(drawerRow.project_id) },
 { label: 'Vendor', value: vendorName(drawerRow.vendor_id) },
 { label: 'Lingkup', value: drawerRow.scope },
 { label: 'Periode', value: `${tgl(drawerRow.start_date)} – ${tgl(drawerRow.end_date)}` },
 { label: 'Retensi', value: pct(drawerRow.retention_percent, 0) },
 { label: 'Status', value: <Badge>{drawerRow.status}</Badge> },
 ]} />
 </Section>
 <Section title="Progres Fisik">
 <div className="flex items-center gap-3">
 <div className="flex-1"><Progress value={Number(drawerRow.progress_percent || 0)} height={10} /></div>
 <span className="text-body font-semibold tabular">{pct(drawerRow.progress_percent, 0)}</span>
 </div>
 </Section>
 <Section title="Rekap Keuangan Paket">
 <Desc cols={2} items={[
 { label: 'Nilai Kontrak', value: rupiah(drawerRow.contract_value) },
 { label: 'Total Diklaim (kumulatif)', value: rupiah(totalDiklaim) },
 { label: 'Retensi Ditahan', value: rupiah(retensiDitahan) },
 { label: 'Sisa Nilai Kontrak', value: <span className={sisa < 0 ? 'text-red-600 font-semibold' : ''}>{rupiah(sisa)}</span> },
 ]} />
 </Section>
 <Section title="Riwayat Progres" className="mt-2">
 {approver && lastProgress && !lastProgress.verified_by && (
 <Button size="sm" variant="outline" icon={<ShieldCheck size={14} />} onClick={verifyLast} className="mb-3">Verifikasi Laporan Terakhir</Button>
 )}
 {loadingProgress ? <p className="text-caption text-ink-400">Memuat riwayat…</p> : progress.length === 0 ? (
 <EmptyState title="Belum ada laporan progres" message="Klik &quot;Tambah Laporan Progres&quot; untuk mencatat progres pertama." />
 ) : (
 <Timeline items={progress.map((p: any) => ({
 title: `Progres ${pct(p.progress_percent, 0)} — Diklaim ${rupiah(p.amount_claimed)}`,
 note: `${p.verified_by ? `Diverifikasi oleh: ${verifiers[p.verified_by] ?? '-'}` : 'Belum diverifikasi'}${p.note ? ` · ${p.note}` : ''}${(p.photo_urls ?? []).length ? ` · ${p.photo_urls.length} foto` : ''}`,
 time: tgl(p.report_date),
 }))} />
 )}
 </Section>
 </div>
 )}
 </Drawer>

 <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Tambah Laporan Progres"
 footer={<><Button variant="outline" onClick={() => setReportOpen(false)}>Batal</Button><Button loading={reporting} onClick={saveReport}>Simpan Laporan</Button></>}>
 <div className="space-y-4">
 <Field label="Tanggal Laporan"><Input type="date" value={reportForm.report_date ?? ''} onChange={e => setReportForm({ ...reportForm, report_date: e.target.value })} /></Field>
 <Field label="Progres Kumulatif (%)" hint={`Progres tercatat sebelumnya: ${pct(drawerRow?.progress_percent, 0)} — tidak boleh turun`}>
 <Input type="number" step="0.01" min={0} max={100} value={reportForm.progress_percent ?? 0} onChange={e => setReportForm({ ...reportForm, progress_percent: e.target.value })} />
 </Field>
 <Field label="Nilai Klaim Kumulatif" hint={`Nilai kontrak: ${rupiah(drawerRow?.contract_value)} — klaim kumulatif tidak boleh melebihi nilai ini`}>
 <Money value={reportForm.amount_claimed ?? 0} onChange={(v: number) => setReportForm({ ...reportForm, amount_claimed: v })} />
 </Field>
 <Field label="Catatan"><Textarea value={reportForm.note ?? ''} onChange={e => setReportForm({ ...reportForm, note: e.target.value })} /></Field>
 <Field label="Unggah Foto Progres">
 <input type="file" multiple accept="image/*" onChange={e => setReportFiles(Array.from(e.target.files ?? []))}
 className="block w-full text-body text-ink-600 file:mr-3 file:h-9 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
 </Field>
 </div>
 </Modal>

 <ConfirmDialog open={!!delRow} onClose={() => setDelRow(null)} onConfirm={doDelete} danger title="Hapus Paket Subkontraktor" message="Hapus paket subkontraktor ini beserta seluruh riwayat progresnya? Tindakan tidak dapat dibatalkan." />
 </div>
 )
}
