import React, { useEffect, useMemo, useState } from 'react'
import { chartColors } from '@/lib/theme'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import {
 PageHeader, Card, CardHeader, DataTable, Badge, Button, Modal, Field, Input, Select, Textarea,
 FilterBar, ConfirmDialog, useToast, Plus, TableSkeleton,
} from '@/components/ui'
import { pct, num } from '@/lib/format'
import { ASPEK_RCA, ASPECT_COLORS } from '../lib/constants'

function newForm() { return { code: '', name: '', aspect: 'People', description: '' } }

export default function Rca() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const writable = can('OPERATIONS', 'write')
 const approver = can('OPERATIONS', 'approve')

 const [loading, setLoading] = useState(true)
 const [rootCauses, setRootCauses] = useState<any[]>([])
 const [tickets, setTickets] = useState<any[]>([])
 const [branches, setBranches] = useState<any[]>([])

 const [f, setF] = useState({ from: '', to: '', branch_id: '' })

 const [formOpen, setFormOpen] = useState(false)
 const [form, setForm] = useState<any>(newForm())
 const [editing, setEditing] = useState<any>(null)
 const [saving, setSaving] = useState(false)
 const [delConfirm, setDelConfirm] = useState<any>(null)

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

 async function load() {
 setLoading(true)
 try {
 const [rc, tk, br] = await Promise.all([
 list('root_causes', { eq: { company_id: profile!.company_id }, order: { col: 'code', asc: true } }),
 list('tickets', { select: 'id,root_cause_id,branch_id,reported_at,status', eq: { company_id: profile!.company_id }, order: { col: 'reported_at', asc: false }, limit: 3000 }),
 list('branches', { select: 'id,name', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
 ])
 setRootCauses(rc); setTickets(tk); setBranches(br)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data RCA', 'error') }
 finally { setLoading(false) }
 }

 const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'

 /* ---------------- CRUD ---------------- */
 function openNew() { setEditing(null); setForm(newForm()); setFormOpen(true) }
 function openEdit(r: any) { setEditing(r); setForm({ ...r }); setFormOpen(true) }
 async function submit() {
 if (!form.code || !form.name || !form.aspect) { toast.push('Lengkapi kode, nama dan aspek', 'error'); return }
 setSaving(true)
 try {
 if (editing) { await update('root_causes', editing.id, form); toast.push('Root cause diperbarui', 'success') }
 else { await insert('root_causes', { ...form, company_id: profile!.company_id, created_by: profile!.id }); toast.push('Root cause dibuat', 'success') }
 setFormOpen(false); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan root cause', 'error') }
 finally { setSaving(false) }
 }
 async function doDelete() {
 try { await remove('root_causes', delConfirm.id); toast.push('Root cause dihapus', 'success'); setDelConfirm(null); await load() }
 catch (e: any) { toast.push('Tidak dapat menghapus — root cause masih dirujuk oleh tiket yang sudah selesai.', 'error') }
 }

 /* ---------------- Analisis ---------------- */
 const rcById = useMemo(() => Object.fromEntries(rootCauses.map(r => [r.id, r])), [rootCauses])
 const relevantTickets = useMemo(() => tickets.filter(t =>
 t.root_cause_id && (!f.branch_id || t.branch_id === f.branch_id) &&
 (!f.from || t.reported_at >= f.from) && (!f.to || t.reported_at <= f.to + 'T23:59:59')
 ), [tickets, f])

 const perAspek = useMemo(() => {
 const g: Record<string, number> = { People: 0, Process: 0, Tools: 0, Partnership: 0 }
 relevantTickets.forEach(t => { const asp = rcById[t.root_cause_id]?.aspect; if (asp) g[asp] = (g[asp] ?? 0) + 1 })
 return Object.entries(g).map(([name, jumlah]) => ({ name, jumlah }))
 }, [relevantTickets, rcById])

 const pareto = useMemo(() => {
 const g: Record<string, number> = {}
 relevantTickets.forEach(t => { g[t.root_cause_id] = (g[t.root_cause_id] ?? 0) + 1 })
 const rows = Object.entries(g).map(([id, freq]) => ({ id, name: rcById[id]?.name ?? '(tidak dikenal)', aspect: rcById[id]?.aspect ?? '-', freq }))
 .sort((a, b) => b.freq - a.freq)
 const total = rows.reduce((a, b) => a + b.freq, 0)
 let kum = 0
 return rows.map(r => { kum += r.freq; return { ...r, kumulatif: total ? (kum / total) * 100 : 0 } })
 }, [relevantTickets, rcById])

 const narasi = useMemo(() => {
 if (relevantTickets.length === 0) return 'Belum ada tiket dengan root cause tercatat pada rentang filter ini.'
 const aspekDominan = [...perAspek].sort((a, b) => b.jumlah - a.jumlah)[0]
 const penyebabTeratas = pareto[0]
 const totalTiket = relevantTickets.length
 const pangsaTeratas = penyebabTeratas ? pct((penyebabTeratas.freq / totalTiket) * 100) : '-'
 return `Dari ${num(totalTiket)} tiket dengan root cause tercatat, aspek "${aspekDominan?.name}" paling dominan dengan ${num(aspekDominan?.jumlah)} kasus. `
 + `Penyebab tunggal teratas adalah "${penyebabTeratas?.name}" (aspek ${penyebabTeratas?.aspect}), menyumbang ${num(penyebabTeratas?.freq)} kasus atau ${pangsaTeratas} dari total tiket pada periode ini.`
 }, [perAspek, pareto, relevantTickets])

 return (
 <div>
 <PageHeader title="RCA 4 Aspek" subtitle="Root Cause Analysis — People, Process, Tools, Partnership" />

 <Card className="mb-4 bg-primary-50/50 border-primary-200">
 <div className="p-4 text-body text-ink-700">
 <span className="font-semibold text-ink-900">Ringkasan: </span>{loading ? 'Memuat ringkasan…' : narasi}
 </div>
 </Card>

 <FilterBar>
 <Field label="Dari Tanggal"><Input type="date" value={f.from} onChange={(e: any) => setF({ ...f, from: e.target.value })} /></Field>
 <Field label="Sampai Tanggal"><Input type="date" value={f.to} onChange={(e: any) => setF({ ...f, to: e.target.value })} /></Field>
 <Field label="Cabang"><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={f.branch_id} onChange={(e: any) => setF({ ...f, branch_id: e.target.value })} /></Field>
 <Button variant="outline" size="sm" onClick={() => setF({ from: '', to: '', branch_id: '' })}>Reset</Button>
 </FilterBar>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
 <Card>
 <CardHeader title="Tiket per Aspek RCA" />
 <div className="p-4 h-72">
 {loading ? <TableSkeleton rows={4} /> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={perAspek}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="name" tick={{ fontSize: 12 }} />
 <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
 <Tooltip />
 <Bar dataKey="jumlah" radius={[4, 4, 0, 0]}>
 {perAspek.map((r, i) => <Cell key={i} fill={ASPECT_COLORS()[r.name] ?? chartColors().primary} />)}
 </Bar>
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 <Card className="overflow-hidden">
 <CardHeader title="Tabel Pareto Penyebab" subtitle="Diurutkan dari frekuensi tertinggi" />
 <DataTable
 loading={loading} rows={pareto} searchable={false} pageSize={10} emptyTitle="Belum ada data"
 columns={[
 { key: 'name', header: 'Penyebab' },
 { key: 'aspect', header: 'Aspek', render: r => <Badge>{r.aspect}</Badge> },
 { key: 'freq', header: 'Frekuensi', align: 'right' },
 { key: 'kumulatif', header: 'Kumulatif %', align: 'right', render: r => pct(r.kumulatif) },
 ]}
 />
 </Card>
 </div>

 <Card>
 <CardHeader title="Kelola Root Cause" action={writable && <Button size="sm" icon={<Plus size={14} />} onClick={openNew}>Root Cause Baru</Button>} />
 <DataTable
 loading={loading} rows={rootCauses} searchKeys={['code', 'name']} emptyTitle="Belum ada root cause"
 columns={[
 { key: 'code', header: 'Kode' },
 { key: 'name', header: 'Nama Penyebab' },
 { key: 'aspect', header: 'Aspek', render: r => <Badge>{r.aspect}</Badge> },
 { key: 'description', header: 'Deskripsi', render: r => r.description || '-' },
 {
 key: 'aksi', header: '', sortable: false, render: r => writable && (
 <div className="flex gap-1.5 justify-end">
 <Button size="sm" variant="outline" onClick={(e: any) => { e.stopPropagation(); openEdit(r) }}>Ubah</Button>
 {approver && <Button size="sm" variant="danger" onClick={(e: any) => { e.stopPropagation(); setDelConfirm(r) }}>Hapus</Button>}
 </div>)
 },
 ]}
 />
 </Card>

 <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Ubah Root Cause' : 'Root Cause Baru'}
 footer={<><Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button><Button loading={saving} onClick={submit}>Simpan</Button></>}>
 <div className="space-y-4">
 <Field label="Kode" required><Input value={form.code} onChange={(e: any) => setForm({ ...form, code: e.target.value })} /></Field>
 <Field label="Nama Penyebab" required><Input value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} /></Field>
 <Field label="Aspek" required><Select options={ASPEK_RCA} value={form.aspect} onChange={(e: any) => setForm({ ...form, aspect: e.target.value })} /></Field>
 <Field label="Deskripsi"><Textarea value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} /></Field>
 </div>
 </Modal>

 <ConfirmDialog open={!!delConfirm} onClose={() => setDelConfirm(null)} danger title="Hapus Root Cause"
 message={`Root cause "${delConfirm?.name}" akan dihapus permanen.`} onConfirm={doDelete} />
 </div>
 )
}
