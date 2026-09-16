import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, remove } from '@/lib/db'
import { rupiah, pct, tgl, todayISO } from '@/lib/format'
import {
 PageHeader, DataTable, Badge, Drawer, Modal, Field, Input, Select, Money, Textarea, Button,
 useToast, EmptyState, Section, Desc, ConfirmDialog,
} from '@/components/ui'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { Plus, AlertTriangle } from 'lucide-react'
import { chartSeries } from '@/lib/theme'

const rp = (v: any) => rupiah(Number(v) || 0)

export default function JobCosting() {
 const PIE_COLORS = chartSeries()
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [projects, setProjects] = useState<any[]>([])
 const [categories, setCategories] = useState<any[]>([])
 const [detail, setDetail] = useState<any | null>(null)
 const [detailLoading, setDetailLoading] = useState(false)
 const [costs, setCosts] = useState<any[]>([])
 const [addOpen, setAddOpen] = useState(false)
 const [form, setForm] = useState<any>({ cost_date: todayISO(), cost_category_id: '', description: '', amount: 0 })
 const [newCatName, setNewCatName] = useState('')
 const [newCatType, setNewCatType] = useState('material')
 const [showNewCat, setShowNewCat] = useState(false)
 const [busy, setBusy] = useState(false)
 const [confirmDelete, setConfirmDelete] = useState<any | null>(null)
 const [tarifAsumsiCount, setTarifAsumsiCount] = useState(0)

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])
 useEffect(() => {
 list<any>('v_tarif_belum_terverifikasi', { select: 'id' }).then(r => setTarifAsumsiCount(r.length)).catch(() => {})
 }, [])

 async function load() {
 setLoading(true)
 try {
 const [pm, cc] = await Promise.all([
 list('v_project_margin', { eq: { company_id: profile!.company_id }, order: { col: 'project_name', asc: true }, limit: 500 }),
 list('cost_categories', { eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true }, limit: 200 }),
 ])
 setProjects(pm); setCategories(cc)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data job costing', 'error') } finally { setLoading(false) }
 }

 async function openDetail(row: any) {
 setDetail(row); setDetailLoading(true)
 try {
 const jc = await list('job_costs', {
 select: 'id,cost_date,description,amount,source_type,cost_category_id,cost_category:cost_categories(name,cost_type)',
 eq: { company_id: profile!.company_id, project_id: row.project_id }, order: { col: 'cost_date', asc: false }, limit: 1000,
 })
 setCosts(jc)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat rincian biaya', 'error') } finally { setDetailLoading(false) }
 }

 const pieData = useMemo(() => {
 const byCat: Record<string, number> = {}
 costs.forEach(c => { const name = c.cost_category?.name ?? 'Lainnya'; byCat[name] = (byCat[name] ?? 0) + Number(c.amount || 0) })
 return Object.entries(byCat).map(([name, value]) => ({ name, value }))
 }, [costs])

 async function tambahKategori() {
 if (!newCatName.trim()) return
 try {
 const code = newCatName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 20)
 const cat = await insert('cost_categories', { company_id: profile!.company_id, code, name: newCatName.trim(), cost_type: newCatType })
 setCategories(c => [...c, cat].sort((a, b) => a.name.localeCompare(b.name, 'id')))
 setForm((f: any) => ({ ...f, cost_category_id: cat.id }))
 setNewCatName(''); setShowNewCat(false)
 toast.push('Kategori biaya ditambahkan.', 'success')
 } catch (e: any) { toast.push(e.message ?? 'Gagal menambah kategori', 'error') }
 }

 async function simpanBiaya() {
 if (!detail) return
 if (!form.cost_category_id) { toast.push('Pilih kategori biaya.', 'error'); return }
 if (!form.amount || Number(form.amount) <= 0) { toast.push('Nominal biaya harus lebih dari 0.', 'error'); return }
 setBusy(true)
 try {
 await insert('job_costs', {
 company_id: profile!.company_id, project_id: detail.project_id, cost_category_id: form.cost_category_id,
 cost_date: form.cost_date, description: form.description || null, amount: Number(form.amount), source_type: 'manual',
 })
 toast.push('Biaya proyek ditambahkan.', 'success')
 setAddOpen(false); setForm({ cost_date: todayISO(), cost_category_id: '', description: '', amount: 0 })
 await openDetail(detail); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan biaya', 'error') } finally { setBusy(false) }
 }

 function pesanGagalHapus(e: any) {
 const msg = String(e?.message ?? '')
 if (/row-level security|permission denied|RLS/i.test(msg)) {
 return 'Gagal menghapus: Anda tidak memiliki hak Setujui pada modul Finance. Hubungi admin untuk memberi hak akses.'
 }
 return msg || 'Gagal menghapus biaya'
 }

 async function hapusBiaya() {
 if (!confirmDelete || !detail) return
 try {
 await remove('job_costs', confirmDelete.id)
 toast.push('Biaya proyek dihapus.', 'success')
 await openDetail(detail); await load()
 } catch (e: any) { toast.push(pesanGagalHapus(e), 'error') }
 }

 return (
 <div>
 <PageHeader title="Job Costing & Margin" subtitle="Biaya aktual per proyek/SPK dibanding nilai kontrak." />

 {tarifAsumsiCount > 0 && (
 <div className="mb-4 px-3 py-2 rounded-sm bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-caption font-medium flex items-start gap-2">
 <AlertTriangle size={15} className="mt-0.5 shrink-0" />
 <span>{tarifAsumsiCount} tarif dasar (jenis pekerjaan, harga satuan price list, atau rate card mitra) yang membentuk biaya & tagihan proyek masih berstatus <b>asumsi sistem</b>, belum diverifikasi ke kontrak sebenarnya — total biaya dan margin di bawah bisa berubah setelah tarif diverifikasi.</span>
 </div>
 )}

 <DataTable
 loading={loading}
 rows={projects}
 rowKey="project_id"
 onRowClick={openDetail}
 searchKeys={['project_code', 'project_name']}
 exportName="job-costing-proyek"
 emptyTitle="Belum ada proyek"
 emptyMessage="Belum ada data proyek dengan biaya tercatat."
 columns={[
 { key: 'project_code', header: 'Kode Proyek' },
 { key: 'project_name', header: 'Proyek' },
 { key: 'contract_value', header: 'Nilai Kontrak', align: 'right', render: (r) => rp(r.contract_value) },
 { key: 'total_cost', header: 'Total Biaya', align: 'right', render: (r) => rp(r.total_cost) },
 { key: 'margin', header: 'Margin (Rp)', align: 'right', render: (r) => <span className={Number(r.margin_percent) < 10 ? 'text-red-600 font-medium' : 'font-medium'}>{rp(r.margin)}</span> },
 {
 key: 'margin_percent', header: 'Margin (%)', align: 'right', render: (r) => (
 <Badge tone={r.margin_percent == null ? 'slate' : Number(r.margin_percent) < 10 ? 'red' : 'emerald'}>
 {r.margin_percent == null ? '-' : pct(r.margin_percent)}
 </Badge>
 ),
 },
 ]}
 />
 <p className="text-caption text-ink-400 mt-2">Sumber: v_project_margin (nilai kontrak dikurangi total job_costs). Badge merah = margin di bawah 10%. Ditarik: {tgl(todayISO())}.</p>

 <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.project_name} width="max-w-3xl"
 footer={can('FINANCE', 'write') && <Button icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>Tambah Biaya</Button>}>
 {detail && (
 <>
 <Section title="Ringkasan Margin">
 <Desc cols={2} items={[
 { label: 'Kode Proyek', value: detail.project_code },
 { label: 'Nilai Kontrak', value: rp(detail.contract_value) },
 { label: 'Total Biaya', value: rp(detail.total_cost) },
 { label: 'Margin', value: rp(detail.margin) },
 { label: 'Margin %', value: detail.margin_percent == null ? '-' : <Badge tone={Number(detail.margin_percent) < 10 ? 'red' : 'emerald'}>{pct(detail.margin_percent)}</Badge> },
 ]} />
 </Section>
 <Section title="Rincian Biaya per Kategori">
 {pieData.length === 0 ? <EmptyState title="Belum ada biaya" message="Belum ada transaksi job cost untuk proyek ini." /> : (
 <ResponsiveContainer width="100%" height={240}>
 <PieChart>
 <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
 {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
 </Pie>
 <Tooltip formatter={(v: any) => rp(v)} />
 <Legend />
 </PieChart>
 </ResponsiveContainer>
 )}
 </Section>
 <Section title="Daftar Transaksi Biaya">
 <DataTable
 loading={detailLoading}
 rows={costs}
 rowKey="id"
 searchable={false}
 emptyTitle="Belum ada transaksi"
 columns={[
 { key: 'cost_date', header: 'Tanggal', render: (r) => tgl(r.cost_date) },
 { key: 'cat', header: 'Kategori', render: (r) => r.cost_category?.name ?? '-' },
 { key: 'description', header: 'Keterangan', render: (r) => r.description || '-' },
 { key: 'amount', header: 'Nominal', align: 'right', render: (r) => rp(r.amount) },
 {
 key: 'aksi', header: '', sortable: false, align: 'right', render: (r) => can('FINANCE', 'approve') && r.source_type === 'manual' && (
 <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(r)}>Hapus</Button>
 ),
 },
 ]}
 />
 </Section>
 </>
 )}
 </Drawer>

 <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Tambah Biaya Proyek" size="sm"
 footer={<Button loading={busy} onClick={simpanBiaya}>Simpan</Button>}>
 <div className="space-y-3">
 <Field label="Tanggal" required><Input type="date" value={form.cost_date} onChange={(e: any) => setForm((f: any) => ({ ...f, cost_date: e.target.value }))} /></Field>
 <Field label="Kategori Biaya" required>
 <Select value={form.cost_category_id} onChange={(e: any) => setForm((f: any) => ({ ...f, cost_category_id: e.target.value }))}
 options={categories.map(c => ({ value: c.id, label: `${c.name} (${c.cost_type ?? '-'})` }))} />
 {!showNewCat ? (
 <button type="button" className="mt-1 text-caption text-primary-600 hover:underline" onClick={() => setShowNewCat(true)}>+ Tambah kategori baru</button>
 ) : (
 <div className="mt-2 flex gap-2">
 <Input placeholder="Nama kategori" value={newCatName} onChange={(e: any) => setNewCatName(e.target.value)} className="flex-1" />
 <Select value={newCatType} onChange={(e: any) => setNewCatType(e.target.value)}
 options={[{ value: 'material', label: 'Material' }, { value: 'upah', label: 'Upah' }, { value: 'subkon', label: 'Subkon' }, { value: 'transport', label: 'Transport' }, { value: 'overhead', label: 'Overhead' }, { value: 'lain', label: 'Lain-lain' }]} />
 <Button size="sm" onClick={tambahKategori}>Tambah</Button>
 </div>
 )}
 </Field>
 <Field label="Keterangan"><Textarea value={form.description} onChange={(e: any) => setForm((f: any) => ({ ...f, description: e.target.value }))} /></Field>
 <Field label="Nominal" required><Money value={form.amount} onChange={(v: number) => setForm((f: any) => ({ ...f, amount: v }))} /></Field>
 </div>
 </Modal>

 <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={hapusBiaya} danger
 title="Hapus Biaya Proyek" confirmLabel="Ya, Hapus"
 message={`Hapus transaksi biaya "${confirmDelete?.description || rp(confirmDelete?.amount)}" tanggal ${confirmDelete ? tgl(confirmDelete.cost_date) : ''}? Tindakan ini tidak dapat dibatalkan.`} />
 </div>
 )
}
