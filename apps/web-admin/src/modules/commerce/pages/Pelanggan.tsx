import React, { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import { rupiah, tgl } from '@/lib/format'
import {
 PageHeader, Card, DataTable, Modal, Drawer, ConfirmDialog, Field, Input, Select, Textarea,
 Badge, Button, useToast, TableSkeleton, EmptyState, Section, Desc, Plus,
} from '@/components/ui'
import { CUSTOMER_TYPE_OPTIONS, CUSTOMER_STATUS_OPTIONS } from '../lib/constants'

const emptyForm = {
 code: '', name: '', customer_type: 'korporat', npwp: '', address: '', city: '',
 phone: '', email: '', pic_name: '', payment_term_days: 30, status: 'aktif',
}

export default function Pelanggan() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [rows, setRows] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [modal, setModal] = useState(false)
 const [editing, setEditing] = useState<any>(null)
 const [form, setForm] = useState<any>(emptyForm)
 const [saving, setSaving] = useState(false)
 const [detail, setDetail] = useState<any>(null)
 const [delId, setDelId] = useState<string | null>(null)
 const [detailContracts, setDetailContracts] = useState<any[]>([])
 const [detailInvoices, setDetailInvoices] = useState<any[]>([])
 const [detailLoading, setDetailLoading] = useState(false)

 const load = async () => {
 setLoading(true)
 try {
 const data = await list('customers', { order: { col: 'name', asc: true }, limit: 500 })
 setRows(data)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data pelanggan', 'error') }
 finally { setLoading(false) }
 }
 useEffect(() => { load() }, [])

 const openAdd = () => { setEditing(null); setForm(emptyForm); setModal(true) }
 const openEdit = (row: any) => { setEditing(row); setForm({ ...emptyForm, ...row }); setModal(true) }

 const openDetail = async (row: any) => {
 setDetail(row); setDetailLoading(true)
 try {
 const [c, i] = await Promise.all([
 list('contracts', { eq: { customer_id: row.id }, order: { col: 'created_at', asc: false } }),
 list('ar_invoices', { eq: { customer_id: row.id }, order: { col: 'created_at', asc: false } }),
 ])
 setDetailContracts(c); setDetailInvoices(i)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat detail pelanggan', 'error') }
 finally { setDetailLoading(false) }
 }

 const save = async () => {
 if (!form.code || !form.name) { toast.push('Kode dan nama pelanggan wajib diisi', 'error'); return }
 setSaving(true)
 try {
 if (editing) {
 await update('customers', editing.id, {
 code: form.code, name: form.name, customer_type: form.customer_type, npwp: form.npwp,
 address: form.address, city: form.city, phone: form.phone, email: form.email,
 pic_name: form.pic_name, payment_term_days: Number(form.payment_term_days) || 0, status: form.status,
 })
 toast.push('Pelanggan diperbarui', 'success')
 } else {
 await insert('customers', {
 company_id: profile!.company_id, code: form.code, name: form.name, customer_type: form.customer_type,
 npwp: form.npwp, address: form.address, city: form.city, phone: form.phone, email: form.email,
 pic_name: form.pic_name, payment_term_days: Number(form.payment_term_days) || 0, status: form.status,
 })
 toast.push('Pelanggan ditambahkan', 'success')
 }
 setModal(false); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan pelanggan', 'error') }
 finally { setSaving(false) }
 }

 const doDelete = async () => {
 if (!delId) return
 try { await remove('customers', delId); toast.push('Pelanggan dihapus', 'success'); load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus pelanggan', 'error') }
 }

 const columns = [
 { key: 'code', header: 'Kode', width: '110px' },
 { key: 'name', header: 'Nama Pelanggan' },
 { key: 'customer_type', header: 'Jenis', render: (r: any) => <Badge tone="teal">{CUSTOMER_TYPE_OPTIONS.find(o => o.value === r.customer_type)?.label ?? r.customer_type ?? '-'}</Badge> },
 { key: 'pic_name', header: 'PIC', render: (r: any) => r.pic_name || '-' },
 { key: 'npwp', header: 'NPWP', render: (r: any) => r.npwp || '-' },
 { key: 'payment_term_days', header: 'Termin', align: 'right' as const, render: (r: any) => r.payment_term_days ? `${r.payment_term_days} hari` : '-' },
 { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
 {
 key: 'aksi', header: '', width: '90px', sortable: false,
 render: (r: any) => can('COMMERCE', 'write') ? (
 <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
 <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Ubah</Button>
 {can('COMMERCE', 'approve') && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDelId(r.id)}>Hapus</Button>}
 </div>
 ) : null,
 },
 ]

 return (
 <div>
 <PageHeader title="Pelanggan & Principal" subtitle="Data pelanggan, principal, dan retail beserta termin pembayaran."
 actions={can('COMMERCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Pelanggan</Button>} />

 {loading ? <Card><TableSkeleton /></Card> : (
 <DataTable columns={columns} rows={rows} searchable searchKeys={['code', 'name', 'pic_name', 'npwp']}
 exportName="pelanggan" onRowClick={openDetail}
 emptyTitle="Belum ada pelanggan" emptyMessage="Tambahkan pelanggan pertama untuk mulai mengelola kontrak."
 emptyAction={can('COMMERCE', 'write') && <Button size="sm" icon={<Plus size={16} />} onClick={openAdd}>Tambah Pelanggan</Button>} />
 )}

 <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Ubah Pelanggan' : 'Tambah Pelanggan'} size="lg"
 footer={<><Button variant="outline" onClick={() => setModal(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="Kode Pelanggan" required><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="mis. CUST-001" /></Field>
 <Field label="Nama Pelanggan" required><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
 <Field label="Jenis Pelanggan"><Select value={form.customer_type} options={CUSTOMER_TYPE_OPTIONS} onChange={(e: any) => setForm({ ...form, customer_type: e.target.value })} /></Field>
 <Field label="NPWP"><Input value={form.npwp} onChange={e => setForm({ ...form, npwp: e.target.value })} /></Field>
 <Field label="PIC (Penanggung Jawab)"><Input value={form.pic_name} onChange={e => setForm({ ...form, pic_name: e.target.value })} /></Field>
 <Field label="Termin Pembayaran (hari)"><Input type="number" value={form.payment_term_days} onChange={e => setForm({ ...form, payment_term_days: e.target.value })} /></Field>
 <Field label="Telepon"><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
 <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
 <Field label="Kota"><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></Field>
 <Field label="Status"><Select value={form.status} options={CUSTOMER_STATUS_OPTIONS} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>
 <Field label="Alamat" className="sm:col-span-2"><Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
 </div>
 </Modal>

 <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.name} width="max-w-2xl">
 {detail && (
 <>
 <Section title="Ringkasan">
 <Desc items={[
 { label: 'Kode', value: detail.code },
 { label: 'Jenis', value: CUSTOMER_TYPE_OPTIONS.find(o => o.value === detail.customer_type)?.label ?? detail.customer_type },
 { label: 'PIC', value: detail.pic_name },
 { label: 'NPWP', value: detail.npwp },
 { label: 'Telepon', value: detail.phone },
 { label: 'Email', value: detail.email },
 { label: 'Termin Pembayaran', value: detail.payment_term_days ? `${detail.payment_term_days} hari` : '-' },
 { label: 'Status', value: <Badge>{detail.status}</Badge> },
 { label: 'Alamat', value: [detail.address, detail.city].filter(Boolean).join(', ') || '-' },
 ]} />
 </Section>
 <Section title="Kontrak">
 {detailLoading ? <TableSkeleton rows={3} /> : detailContracts.length === 0 ? <EmptyState title="Belum ada kontrak" /> : (
 <div className="space-y-2">
 {detailContracts.map((c: any) => (
 <Card key={c.id} className="p-3 flex items-center justify-between gap-3">
 <div><p className="text-body font-medium">{c.contract_name}</p><p className="text-caption text-ink-500">{c.contract_no} · {tgl(c.start_date)} – {tgl(c.end_date)}</p></div>
 <div className="text-right"><p className="text-body tabular">{rupiah(c.contract_value)}</p><Badge>{c.status}</Badge></div>
 </Card>))}
 </div>)}
 </Section>
 <Section title="Invoice">
 {detailLoading ? <TableSkeleton rows={3} /> : detailInvoices.length === 0 ? <EmptyState title="Belum ada invoice" /> : (
 <div className="space-y-2">
 {detailInvoices.map((i: any) => (
 <Card key={i.id} className="p-3 flex items-center justify-between gap-3">
 <div><p className="text-body font-medium">{i.inv_no}</p><p className="text-caption text-ink-500">Jatuh tempo {tgl(i.due_date)}</p></div>
 <div className="text-right"><p className="text-body tabular">{rupiah(i.total)}</p><Badge>{i.status}</Badge></div>
 </Card>))}
 </div>)}
 </Section>
 </>)}
 </Drawer>

 <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={doDelete} danger
 title="Hapus Pelanggan" message="Data pelanggan akan dihapus permanen. Lanjutkan?" confirmLabel="Ya, Hapus" />
 </div>
 )
}
