import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import { rupiah, pct, periodCode, todayISO } from '@/lib/format'
import {
 PageHeader, FilterBar, DataTable, Badge, Progress, Modal, Field, Input, Select, Money, Textarea, Button,
 useToast, ConfirmDialog, Plus,
} from '@/components/ui'

const rp = (v: any) => rupiah(Number(v) || 0)
const UNITS = [
 { value: 'HR', label: 'Human Resource' }, { value: 'COMMERCE', label: 'Commerce' },
 { value: 'PROCUREMENT', label: 'Procurement' }, { value: 'FINANCE', label: 'Finance' },
 { value: 'INVENTORY', label: 'Inventory' }, { value: 'OPERATIONS', label: 'Operations' },
 { value: 'DEPLOYMENT', label: 'Design & Deployment' },
]

export default function Anggaran() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [budgets, setBudgets] = useState<any[]>([])
 const [categories, setCategories] = useState<any[]>([])
 const [projects, setProjects] = useState<any[]>([])
 const [jobCosts, setJobCosts] = useState<any[]>([])
 const [filterPeriod, setFilterPeriod] = useState(periodCode())
 const [filterUnit, setFilterUnit] = useState('')

 const [modalOpen, setModalOpen] = useState(false)
 const [editing, setEditing] = useState<any | null>(null)
 const [form, setForm] = useState<any>({ period_code: periodCode(), unit: '', cost_category_id: '', project_id: '', budget_amount: 0, note: '' })
 const [confirmDelete, setConfirmDelete] = useState<any | null>(null)
 const [busy, setBusy] = useState(false)

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

 async function load() {
 setLoading(true)
 try {
 const [b, cc, pj, jc] = await Promise.all([
 list('budgets', {
 select: 'id,period_code,unit,cost_category_id,project_id,budget_amount,note,cost_category:cost_categories(name,cost_type),project:projects(project_code,project_name)',
 eq: { company_id: profile!.company_id }, order: { col: 'period_code', asc: false }, limit: 1000,
 }),
 list('cost_categories', { eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true }, limit: 200 }),
 list('projects', { select: 'id,project_code,project_name', eq: { company_id: profile!.company_id }, order: { col: 'project_name', asc: true }, limit: 500 }),
 list('job_costs', { select: 'project_id,cost_category_id,cost_date,amount', eq: { company_id: profile!.company_id }, limit: 5000 }),
 ])
 setBudgets(b); setCategories(cc); setProjects(pj); setJobCosts(jc)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat anggaran', 'error') } finally { setLoading(false) }
 }

 function realisasi(budget: any) {
 return jobCosts.filter(c =>
 (c.cost_date ?? '').slice(0, 7) === budget.period_code &&
 c.cost_category_id === budget.cost_category_id &&
 (budget.project_id ? c.project_id === budget.project_id : true),
 ).reduce((s, c) => s + Number(c.amount || 0), 0)
 }

 const rows = useMemo(() => budgets
 .filter(b => !filterPeriod || b.period_code === filterPeriod)
 .filter(b => !filterUnit || b.unit === filterUnit)
 .map(b => {
 const real = realisasi(b)
 const budgetAmt = Number(b.budget_amount || 0)
 const progress = budgetAmt > 0 ? (real / budgetAmt) * 100 : 0
 return { ...b, _real: real, _progress: progress, _over: budgetAmt > 0 && real > budgetAmt }
 }), [budgets, jobCosts, filterPeriod, filterUnit])

 function openAdd() {
 setEditing(null)
 setForm({ period_code: filterPeriod || periodCode(), unit: filterUnit || '', cost_category_id: '', project_id: '', budget_amount: 0, note: '' })
 setModalOpen(true)
 }
 function openEdit(row: any) {
 setEditing(row)
 setForm({ period_code: row.period_code, unit: row.unit ?? '', cost_category_id: row.cost_category_id ?? '', project_id: row.project_id ?? '', budget_amount: row.budget_amount, note: row.note ?? '' })
 setModalOpen(true)
 }

 async function simpan() {
 if (!form.period_code) { toast.push('Periode wajib diisi.', 'error'); return }
 if (!form.cost_category_id) { toast.push('Kategori biaya wajib dipilih.', 'error'); return }
 setBusy(true)
 try {
 const payload = {
 company_id: profile!.company_id, period_code: form.period_code, unit: form.unit || null,
 cost_category_id: form.cost_category_id, project_id: form.project_id || null,
 budget_amount: Number(form.budget_amount) || 0, note: form.note || null,
 }
 if (editing) { await update('budgets', editing.id, payload); toast.push('Anggaran diperbarui.', 'success') }
 else { await insert('budgets', payload); toast.push('Anggaran ditambahkan.', 'success') }
 setModalOpen(false); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan anggaran', 'error') } finally { setBusy(false) }
 }

 async function hapus() {
 if (!confirmDelete) return
 try { await remove('budgets', confirmDelete.id); toast.push('Anggaran dihapus.', 'success'); await load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus anggaran', 'error') }
 }

 return (
 <div>
 <PageHeader title="Anggaran" subtitle="Rencana anggaran per periode, unit, kategori, dan proyek."
 actions={can('FINANCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Anggaran</Button>} />

 <FilterBar>
 <Field label="Periode"><Input type="month" value={filterPeriod} onChange={(e: any) => setFilterPeriod(e.target.value)} /></Field>
 <Field label="Unit"><Select value={filterUnit} onChange={(e: any) => setFilterUnit(e.target.value)} options={UNITS} placeholder="Semua unit" /></Field>
 <Button variant="outline" size="sm" onClick={() => { setFilterPeriod(''); setFilterUnit('') }}>Reset</Button>
 </FilterBar>

 <DataTable
 loading={loading}
 rows={rows}
 rowKey="id"
 exportName="anggaran-realisasi"
 emptyTitle="Belum ada anggaran"
 emptyMessage="Tambahkan anggaran untuk periode ini."
 columns={[
 { key: 'period_code', header: 'Periode' },
 { key: 'unit', header: 'Unit', render: (r) => r.unit ? <Badge tone="blue">{r.unit}</Badge> : '-' },
 { key: 'cat', header: 'Kategori', render: (r) => r.cost_category?.name ?? '-' },
 { key: 'proyek', header: 'Proyek', render: (r) => r.project ? `${r.project.project_code} — ${r.project.project_name}` : 'Umum' },
 { key: 'budget_amount', header: 'Anggaran', align: 'right', render: (r) => rp(r.budget_amount) },
 { key: '_real', header: 'Realisasi', align: 'right', render: (r) => rp(r._real) },
 {
 key: '_progress', header: 'Progres', width: '160px', render: (r) => (
 <div className="flex items-center gap-2">
 <Progress value={r._progress} tone={r._over ? 'danger' : r._progress > 85 ? 'warning' : 'success'} />
 <span className="text-caption tabular w-10 text-right">{pct(r._progress, 0)}</span>
 </div>
 ),
 },
 { key: '_over', header: 'Status', render: (r) => r._over ? <Badge tone="red">Over Budget</Badge> : <Badge tone="emerald">Terkendali</Badge> },
 {
 key: 'aksi', header: '', sortable: false, align: 'right', render: (r) => can('FINANCE', 'write') && (
 <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
 <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Ubah</Button>
 {can('FINANCE', 'approve') && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(r)}>Hapus</Button>}
 </div>
 ),
 },
 ]}
 />
 <p className="text-caption text-ink-400 mt-2">Realisasi ditarik dari job_costs (kategori + periode + proyek yang sama dengan anggaran). Ditarik: {todayISO()}.</p>

 <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Ubah Anggaran' : 'Tambah Anggaran'} size="sm"
 footer={<Button loading={busy} onClick={simpan}>Simpan</Button>}>
 <div className="space-y-3">
 <Field label="Periode" required><Input type="month" value={form.period_code} onChange={(e: any) => setForm((f: any) => ({ ...f, period_code: e.target.value }))} /></Field>
 <Field label="Unit"><Select value={form.unit} onChange={(e: any) => setForm((f: any) => ({ ...f, unit: e.target.value }))} options={UNITS} placeholder="Seluruh perusahaan" /></Field>
 <Field label="Kategori Biaya" required>
 <Select value={form.cost_category_id} onChange={(e: any) => setForm((f: any) => ({ ...f, cost_category_id: e.target.value }))}
 options={categories.map(c => ({ value: c.id, label: `${c.name} (${c.cost_type ?? '-'})` }))} />
 </Field>
 <Field label="Proyek"><Select value={form.project_id} onChange={(e: any) => setForm((f: any) => ({ ...f, project_id: e.target.value }))}
 options={projects.map(p => ({ value: p.id, label: `${p.project_code} — ${p.project_name}` }))} placeholder="Umum (tidak terikat proyek)" /></Field>
 <Field label="Jumlah Anggaran" required><Money value={form.budget_amount} onChange={(v: number) => setForm((f: any) => ({ ...f, budget_amount: v }))} /></Field>
 <Field label="Catatan"><Textarea value={form.note} onChange={(e: any) => setForm((f: any) => ({ ...f, note: e.target.value }))} /></Field>
 </div>
 </Modal>

 <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={hapus} danger
 title="Hapus Anggaran" message={`Hapus anggaran periode ${confirmDelete?.period_code}? Tindakan ini tidak dapat dibatalkan.`} />
 </div>
 )
}
