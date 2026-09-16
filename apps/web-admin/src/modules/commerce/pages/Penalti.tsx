import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import { rupiah, num } from '@/lib/format'
import {
 PageHeader, Card, CardHeader, DataTable, Modal, ConfirmDialog, Field, Input, Select, Textarea,
 Badge, Button, useToast, TableSkeleton, EmptyState, Plus,
} from '@/components/ui'
import { PENALTY_STATUS_OPTIONS } from '../lib/constants'

const emptyForm = { contract_id: '', period_code: '', description: '', breach_count: 0, penalty_amount: 0, status: 'draft', note: '' }

export default function Penalti() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [rows, setRows] = useState<any[]>([])
 const [contracts, setContracts] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [modal, setModal] = useState(false)
 const [editing, setEditing] = useState<any>(null)
 const [form, setForm] = useState<any>(emptyForm)
 const [saving, setSaving] = useState(false)
 const [delId, setDelId] = useState<string | null>(null)

 const contractMap = useMemo(() => Object.fromEntries(contracts.map(c => [c.id, c.contract_name])), [contracts])

 const summary = useMemo(() => {
 const g: Record<string, { contract_id: string; breach_count: number; penalty_amount: number }> = {}
 for (const r of rows) {
 const k = r.contract_id
 if (!g[k]) g[k] = { contract_id: k, breach_count: 0, penalty_amount: 0 }
 g[k].breach_count += Number(r.breach_count) || 0
 g[k].penalty_amount += Number(r.penalty_amount) || 0
 }
 return Object.values(g).sort((a, b) => b.penalty_amount - a.penalty_amount)
 }, [rows])

 const load = async () => {
 setLoading(true)
 try {
 const [p, c] = await Promise.all([
 list('sla_penalties', { order: { col: 'created_at', asc: false }, limit: 1000 }),
 list('contracts', { select: 'id,contract_name', order: { col: 'contract_name', asc: true }, limit: 500 }),
 ])
 setRows(p); setContracts(c)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data penalti', 'error') }
 finally { setLoading(false) }
 }
 useEffect(() => { load() }, [])

 const openAdd = () => { setEditing(null); setForm(emptyForm); setModal(true) }
 const openEdit = (row: any) => { setEditing(row); setForm({ ...emptyForm, ...row }); setModal(true) }

 const save = async () => {
 if (!form.contract_id || !form.period_code) { toast.push('Kontrak dan periode wajib diisi', 'error'); return }
 setSaving(true)
 try {
 const payload = {
 contract_id: form.contract_id, period_code: form.period_code, description: form.description,
 breach_count: Number(form.breach_count) || 0, penalty_amount: Number(form.penalty_amount) || 0,
 status: form.status, note: form.note,
 }
 if (editing) { await update('sla_penalties', editing.id, payload); toast.push('Penalti diperbarui', 'success') }
 else { await insert('sla_penalties', { ...payload, company_id: profile!.company_id }); toast.push('Penalti ditambahkan', 'success') }
 setModal(false); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan penalti', 'error') }
 finally { setSaving(false) }
 }

 const doDelete = async () => {
 if (!delId) return
 try { await remove('sla_penalties', delId); toast.push('Penalti dihapus', 'success'); load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus penalti', 'error') }
 }

 const columns = [
 { key: 'contract_id', header: 'Kontrak', render: (r: any) => contractMap[r.contract_id] ?? '-' },
 { key: 'period_code', header: 'Periode', width: '110px' },
 { key: 'description', header: 'Keterangan', render: (r: any) => r.description || '-' },
 { key: 'breach_count', header: 'Jumlah Pelanggaran', align: 'right' as const, render: (r: any) => num(r.breach_count) },
 { key: 'penalty_amount', header: 'Nilai Penalti', align: 'right' as const, render: (r: any) => rupiah(r.penalty_amount) },
 { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
 {
 key: 'aksi', header: '', width: '90px', sortable: false,
 render: (r: any) => can('COMMERCE', 'write') ? (
 <div className="flex items-center gap-1">
 <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Ubah</Button>
 {can('COMMERCE', 'approve') && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDelId(r.id)}>Hapus</Button>}
 </div>
 ) : null,
 },
 ]

 const summaryColumns = [
 { key: 'contract_id', header: 'Kontrak', render: (r: any) => contractMap[r.contract_id] ?? '-' },
 { key: 'breach_count', header: 'Total Pelanggaran', align: 'right' as const, render: (r: any) => num(r.breach_count) },
 { key: 'penalty_amount', header: 'Total Penalti', align: 'right' as const, render: (r: any) => rupiah(r.penalty_amount) },
 ]

 return (
 <div>
 <PageHeader title="Penalti SLA" subtitle="Pelanggaran SLA dan nilai penalti per kontrak dan periode."
 actions={can('COMMERCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Penalti</Button>} />

 {!loading && summary.length > 0 && (
 <Card className="mb-4">
 <CardHeader title="Ringkasan Penalti per Kontrak" subtitle="Akumulasi seluruh periode yang tercatat." />
 <DataTable columns={summaryColumns} rows={summary} searchable={false} pageSize={10} dense rowKey="contract_id" />
 </Card>
 )}

 {loading ? <Card><TableSkeleton /></Card> : (
 <DataTable columns={columns} rows={rows} searchable searchKeys={['period_code', 'description']} exportName="penalti-sla"
 emptyTitle="Belum ada penalti" emptyMessage="Catat pelanggaran SLA dan nilai penalti per kontrak & periode."
 emptyAction={can('COMMERCE', 'write') && <Button size="sm" icon={<Plus size={16} />} onClick={openAdd}>Tambah Penalti</Button>} />
 )}

 <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Ubah Penalti' : 'Tambah Penalti'} size="lg"
 footer={<><Button variant="outline" onClick={() => setModal(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="Kontrak" required className="sm:col-span-2"><Select value={form.contract_id} options={contracts.map(c => ({ value: c.id, label: c.contract_name }))} onChange={(e: any) => setForm({ ...form, contract_id: e.target.value })} /></Field>
 <Field label="Periode" required hint="Format: YYYY-MM"><Input value={form.period_code} onChange={e => setForm({ ...form, period_code: e.target.value })} placeholder="2026-09" /></Field>
 <Field label="Jumlah Pelanggaran"><Input type="number" value={form.breach_count} onChange={e => setForm({ ...form, breach_count: e.target.value })} /></Field>
 <Field label="Nilai Penalti"><Input type="number" value={form.penalty_amount} onChange={e => setForm({ ...form, penalty_amount: e.target.value })} /></Field>
 <Field label="Status"><Select value={form.status} options={PENALTY_STATUS_OPTIONS} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>
 <Field label="Keterangan" className="sm:col-span-2"><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
 <Field label="Catatan" className="sm:col-span-2"><Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
 </div>
 </Modal>

 <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={doDelete} danger
 title="Hapus Penalti" message="Data penalti SLA akan dihapus permanen. Lanjutkan?" confirmLabel="Ya, Hapus" />
 </div>
 )
}
