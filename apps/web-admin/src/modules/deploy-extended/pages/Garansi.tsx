import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import {
 PageHeader, Card, CardHeader, DataTable, Drawer, Modal, ConfirmDialog, Field, Input, Textarea, Select,
 Button, Badge, Desc, Section, useToast, Plus, EmptyState, FilterBar, KpiCard,
} from '@/components/ui'
import { tgl, rupiah, num } from '@/lib/format'
import {
 WARRANTY_STATUS, addMonths, warrantyDaysLeft, warrantyTone, projectLabel, fetchProjectsAndEmployees,
 ASSUMED_WARRANTY_TICKET_COST,
} from '../lib/shared'
import { AlertTriangle, Ticket } from 'lucide-react'

export default function Garansi() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const writable = can('DEPLOYMENT', 'write')
 const approver = can('DEPLOYMENT', 'approve')

 const [projects, setProjects] = useState<any[]>([])
 const [spkList, setSpkList] = useState<any[]>([])
 const [tickets, setTickets] = useState<any[]>([])
 const [filterProject, setFilterProject] = useState('')
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [alerts, setAlerts] = useState<any[]>([])

 const [open, setOpen] = useState(false)
 const [editing, setEditing] = useState<any>(null)
 const [form, setForm] = useState<any>({})
 const [saving, setSaving] = useState(false)

 const [drawerRow, setDrawerRow] = useState<any>(null)
 const [delRow, setDelRow] = useState<any>(null)

 const load = async () => {
 if (!profile?.company_id) return
 setLoading(true)
 try {
 const [w, extra, spk, alertRows, tkt] = await Promise.all([
 list('warranty_periods', { order: { col: 'end_date', asc: true }, limit: 2000 }),
 fetchProjectsAndEmployees(),
 list('spk', { select: 'id,spk_no,title', order: { col: 'spk_no', asc: false }, limit: 2000 }),
 list('v_warranty_alert', { order: { col: 'days_remaining', asc: true }, limit: 500 }),
 list('tickets', { select: 'id,ticket_no,reported_at,category,severity,status,branch_id,description', order: { col: 'reported_at', asc: false }, limit: 5000 }),
 ])
 setRows(w); setProjects(extra.projects); setSpkList(spk); setAlerts(alertRows); setTickets(tkt)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data garansi', 'error') }
 finally { setLoading(false) }
 }
 useEffect(() => { load() }, [profile?.company_id])

 const projName = (id?: string) => { const p = projects.find(x => x.id === id); return p ? projectLabel(p) : '-' }
 const projOf = (id?: string) => projects.find(x => x.id === id)
 const spkLabel = (id?: string) => { const s = spkList.find(x => x.id === id); return s ? `${s.spk_no} — ${s.title ?? ''}` : '-' }
 const scoped = useMemo(() => filterProject ? rows.filter(r => r.project_id === filterProject) : rows, [rows, filterProject])

 /** Tiket gangguan yang jatuh dalam rentang masa garansi proyek terkait. Karena tiket tidak memiliki
 * tautan proyek langsung pada skema data, pencocokan dilakukan melalui cabang (branch_id) proyek —
 * ini merupakan pendekatan/estimasi, bukan tautan pasti. */
 const ticketsForWarranty = (w: any) => {
 const proj = projOf(w.project_id)
 if (!proj?.branch_id || !w.start_date || !w.end_date) return []
 const start = new Date(w.start_date + 'T00:00:00').getTime()
 const end = new Date(w.end_date + 'T23:59:59').getTime()
 return tickets.filter(t => t.branch_id === proj.branch_id && t.reported_at && (() => {
 const r = new Date(t.reported_at).getTime(); return r >= start && r <= end
 })())
 }

 const kpi = useMemo(() => {
 const now = new Date()
 const dalamGaransi = rows.filter(r => r.status === 'aktif').length
 const berakhirBulanIni = rows.filter(r => r.status === 'aktif' && r.end_date && new Date(r.end_date).getMonth() === now.getMonth() && new Date(r.end_date).getFullYear() === now.getFullYear()).length
 const tiketKlaim = rows.filter(r => r.status === 'aktif').reduce((s, r) => s + ticketsForWarranty(r).length, 0)
 return { dalamGaransi, berakhirBulanIni, tiketKlaim }
 }, [rows, tickets, projects])

 const openAdd = () => {
 setEditing(null)
 setForm({ project_id: filterProject || '', start_date: new Date().toISOString().slice(0, 10), warranty_months: 12, status: 'aktif' })
 setOpen(true)
 }
 const openEdit = (r: any) => { setEditing(r); setForm({ ...r }); setOpen(true) }

 useEffect(() => {
 if (open && form.start_date && form.warranty_months) {
 setForm((f: any) => ({ ...f, end_date: addMonths(f.start_date, f.warranty_months) }))
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [form.start_date, form.warranty_months, open])

 const save = async () => {
 if (!form.project_id) { toast.push('Proyek wajib dipilih', 'error'); return }
 if (!form.start_date || !form.warranty_months) { toast.push('Tanggal mulai dan lama garansi wajib diisi', 'error'); return }
 setSaving(true)
 try {
 const payload = {
 company_id: profile!.company_id, project_id: form.project_id, spk_id: form.spk_id || null,
 start_date: form.start_date, warranty_months: Number(form.warranty_months), end_date: form.end_date || addMonths(form.start_date, form.warranty_months),
 scope: form.scope || null, status: form.status || 'aktif', note: form.note || null,
 }
 if (editing) { await update('warranty_periods', editing.id, payload); toast.push('Masa garansi diperbarui') }
 else { await insert('warranty_periods', { ...payload, created_by: profile!.id }); toast.push('Masa garansi ditambahkan') }
 setOpen(false); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan masa garansi', 'error') }
 finally { setSaving(false) }
 }
 const doDelete = async () => {
 if (!delRow) return
 try { await remove('warranty_periods', delRow.id); toast.push('Masa garansi dihapus'); if (drawerRow?.id === delRow.id) setDrawerRow(null); load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus', 'error') }
 }

 const sisaBadge = (endDate?: string) => {
 const d = warrantyDaysLeft(endDate)
 if (d == null) return '-'
 const tone = warrantyTone(d)
 const label = d < 0 ? `berakhir ${Math.abs(d)} hari lalu` : `${d} hari lagi`
 return <Badge tone={tone}>{label}</Badge>
 }

 return (
 <div>
 <PageHeader title="Masa Garansi" subtitle="Masa garansi proyek/SPK dan tautan tiket gangguan pada periode garansi"
 actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Masa Garansi</Button>} />

 <FilterBar>
 <Field label="Proyek" className="min-w-[260px]">
 <Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} placeholder="Semua Proyek" value={filterProject} onChange={(e: any) => setFilterProject(e.target.value)} />
 </Field>
 </FilterBar>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
 <KpiCard label="Proyek Dalam Garansi" value={num(kpi.dalamGaransi)} tone="teal" />
 <KpiCard label="Garansi Berakhir Bulan Ini" value={num(kpi.berakhirBulanIni)} tone={kpi.berakhirBulanIni > 0 ? 'amber' : 'emerald'} />
 <KpiCard label="Tiket Klaim Garansi" value={num(kpi.tiketKlaim)} tone={kpi.tiketKlaim > 0 ? 'amber' : 'emerald'} />
 </div>
 <p className="text-caption text-ink-400 -mt-2 mb-4">Tiket klaim garansi dihitung dari tiket gangguan pada cabang proyek yang dilaporkan dalam rentang masa garansi (estimasi berbasis cabang, bukan tautan proyek langsung — skema data tiket tidak memiliki kolom proyek). Sumber: tabel tickets &amp; warranty_periods, ditarik saat halaman ini dibuka.</p>

 {alerts.length > 0 && (
 <Card className="mb-4">
 <CardHeader title={<span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-300"><AlertTriangle size={16} /> Peringatan Garansi Berakhir &lt; 60 Hari</span>} subtitle="Sumber: v_warranty_alert" />
 <DataTable searchable={false}
 columns={[
 { key: 'project_code', header: 'Proyek', render: (r: any) => `${r.project_code} — ${r.project_name}` },
 { key: 'scope', header: 'Lingkup' },
 { key: 'end_date', header: 'Berakhir', render: (r: any) => tgl(r.end_date) },
 { key: 'days_remaining', header: 'Sisa Hari', align: 'right', render: (r: any) => sisaBadge(r.end_date) },
 ]}
 rows={alerts}
 onRowClick={(r: any) => setFilterProject(r.project_id)} />
 </Card>
 )}

 <Card>
 <CardHeader title="Daftar Masa Garansi" />
 <DataTable
 loading={loading} searchKeys={['scope']} exportName="garansi"
 onRowClick={setDrawerRow}
 emptyTitle="Belum ada data masa garansi"
 emptyAction={writable && <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Tambah Masa Garansi</Button>}
 columns={[
 { key: 'project_id', header: 'Proyek', render: (r) => projName(r.project_id) },
 { key: 'spk_id', header: 'SPK', render: (r) => spkLabel(r.spk_id) },
 { key: 'start_date', header: 'Mulai', render: (r) => tgl(r.start_date) },
 { key: 'end_date', header: 'Berakhir', render: (r) => tgl(r.end_date) },
 { key: 'warranty_months', header: 'Lama', align: 'right', render: (r) => `${num(r.warranty_months)} bln` },
 { key: 'scope', header: 'Lingkup' },
 { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
 { key: '_sisa', header: 'Sisa Masa Garansi', render: (r) => sisaBadge(r.end_date) },
 ]}
 rows={scoped}
 />
 </Card>

 <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editing ? 'Ubah Masa Garansi' : 'Tambah Masa Garansi'}
 footer={<><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="Proyek" required><Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} value={form.project_id ?? ''} onChange={(e: any) => setForm({ ...form, project_id: e.target.value })} /></Field>
 <Field label="SPK"><Select options={spkList.map(s => ({ value: s.id, label: `${s.spk_no} — ${s.title ?? ''}` }))} value={form.spk_id ?? ''} onChange={(e: any) => setForm({ ...form, spk_id: e.target.value })} /></Field>
 <Field label="Tanggal Mulai" required><Input type="date" value={form.start_date ?? ''} onChange={e => setForm({ ...form, start_date: e.target.value })} /></Field>
 <Field label="Lama Garansi (bulan)" required><Input type="number" value={form.warranty_months ?? ''} onChange={e => setForm({ ...form, warranty_months: e.target.value })} /></Field>
 <Field label="Tanggal Berakhir" hint="Dihitung otomatis dari tanggal mulai + lama garansi"><Input type="date" value={form.end_date ?? ''} onChange={e => setForm({ ...form, end_date: e.target.value })} /></Field>
 <Field label="Status"><Select options={WARRANTY_STATUS} value={form.status ?? 'aktif'} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>
 <Field label="Lingkup" className="sm:col-span-2"><Input value={form.scope ?? ''} onChange={e => setForm({ ...form, scope: e.target.value })} placeholder="mis. instalasi FO & perangkat aktif" /></Field>
 <Field label="Catatan" className="sm:col-span-2"><Textarea value={form.note ?? ''} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
 </div>
 </Modal>

 <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} title={drawerRow ? `Masa Garansi — ${projName(drawerRow.project_id)}` : ''}
 footer={drawerRow && <>
 {approver && <Button variant="danger" onClick={() => setDelRow(drawerRow)}>Hapus</Button>}
 {writable && <Button onClick={() => openEdit(drawerRow)}>Ubah</Button>}
 </>}>
 {drawerRow && (() => {
 const relatedTickets = ticketsForWarranty(drawerRow)
 const estCost = relatedTickets.length * ASSUMED_WARRANTY_TICKET_COST
 return (
 <div>
 <Section title="Informasi Garansi">
 <Desc items={[
 { label: 'Proyek', value: projName(drawerRow.project_id) },
 { label: 'SPK', value: spkLabel(drawerRow.spk_id) },
 { label: 'Mulai', value: tgl(drawerRow.start_date) },
 { label: 'Berakhir', value: tgl(drawerRow.end_date) },
 { label: 'Lama', value: `${num(drawerRow.warranty_months)} bulan` },
 { label: 'Lingkup', value: drawerRow.scope },
 { label: 'Status', value: <Badge>{drawerRow.status}</Badge> },
 { label: 'Sisa Masa Garansi', value: sisaBadge(drawerRow.end_date) },
 ]} />
 </Section>
 {drawerRow.note && <Section title="Catatan"><p className="text-body whitespace-pre-line">{drawerRow.note}</p></Section>}
 <Section title={<span className="inline-flex items-center gap-2"><Ticket size={15} /> Tiket Gangguan Selama Masa Garansi</span> as any}>
 <div className="grid grid-cols-2 gap-3 mb-3">
 <div className="p-3 rounded-md bg-ink-50"><p className="text-caption text-ink-400">Jumlah Tiket</p><p className="text-body font-semibold">{num(relatedTickets.length)}</p></div>
 <div className="p-3 rounded-md bg-ink-50"><p className="text-caption text-ink-400">Estimasi Biaya Ditanggung Perusahaan</p><p className="text-body font-semibold">{rupiah(estCost)}</p></div>
 </div>
 <p className="text-caption text-ink-400 mb-3">Estimasi memakai asumsi biaya penanganan {rupiah(ASSUMED_WARRANTY_TICKET_COST)}/tiket (perhitungan sistem, bukan biaya aktual — skema tiket tidak menyimpan kolom biaya). Tiket dicocokkan berdasarkan cabang proyek &amp; tanggal lapor dalam rentang garansi.</p>
 {relatedTickets.length === 0 ? <EmptyState title="Belum ada tiket pada masa garansi ini" /> : (
 <DataTable searchable={false} pageSize={10}
 columns={[
 { key: 'ticket_no', header: 'Nomor' },
 { key: 'reported_at', header: 'Tgl Lapor', render: (r: any) => tgl(r.reported_at) },
 { key: 'category', header: 'Kategori' },
 { key: 'severity', header: 'Severity', render: (r: any) => <Badge>{r.severity}</Badge> },
 { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
 ]}
 rows={relatedTickets} />)}
 </Section>
 </div>
 )
 })()}
 </Drawer>

 <ConfirmDialog open={!!delRow} onClose={() => setDelRow(null)} onConfirm={doDelete} danger title="Hapus Masa Garansi" message="Hapus data masa garansi ini? Tindakan tidak dapat dibatalkan." />
 </div>
 )
}
