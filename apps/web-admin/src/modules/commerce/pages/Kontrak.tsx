import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, uploadFile, signedUrl, nextDocNo } from '@/lib/db'
import { rupiah, tgl, pct, todayISO } from '@/lib/format'
import {
 PageHeader, Card, DataTable, Modal, Drawer, ConfirmDialog, Field, Input, Select, Textarea,
 Badge, Button, Tabs, useToast, TableSkeleton, EmptyState, Section, Desc, Plus,
} from '@/components/ui'
import { Paperclip, Upload } from 'lucide-react'
import { CONTRACT_TYPE_OPTIONS, CONTRACT_STATUS_OPTIONS } from '../lib/constants'
import { daysUntilExpiry } from '../lib/helpers'

const emptyForm = {
 contract_no: '', contract_name: '', customer_id: '', contract_type: 'deployment',
 start_date: todayISO(), end_date: '', contract_value: 0, retention_percent: 5,
 status: 'draft', file_url: '', pic_id: '',
}

const TABS = [
 { value: 'ringkasan', label: 'Ringkasan' },
 { value: 'pricelist', label: 'Price List' },
 { value: 'spk', label: 'SPK' },
 { value: 'klaim', label: 'Klaim' },
 { value: 'invoice', label: 'Invoice' },
 { value: 'lampiran', label: 'Lampiran' },
]

export default function Kontrak() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [rows, setRows] = useState<any[]>([])
 const [customers, setCustomers] = useState<any[]>([])
 const [pics, setPics] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [modal, setModal] = useState(false)
 const [editing, setEditing] = useState<any>(null)
 const [form, setForm] = useState<any>(emptyForm)
 const [saving, setSaving] = useState(false)
 const [uploading, setUploading] = useState(false)
 const [delId, setDelId] = useState<string | null>(null)

 const [detail, setDetail] = useState<any>(null)
 const [tab, setTab] = useState('ringkasan')
 const [detailLoading, setDetailLoading] = useState(false)
 const [priceList, setPriceList] = useState<any[]>([])
 const [spkList, setSpkList] = useState<any[]>([])
 const [claims, setClaims] = useState<any[]>([])
 const [invoices, setInvoices] = useState<any[]>([])
 const [attachments, setAttachments] = useState<any[]>([])
 const [attUploading, setAttUploading] = useState(false)

 const custMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c.name])), [customers])
 const picMap = useMemo(() => Object.fromEntries(pics.map(p => [p.id, p.full_name])), [pics])

 const load = async () => {
 setLoading(true)
 try {
 const [c, cu, pr] = await Promise.all([
 list('contracts', { order: { col: 'created_at', asc: false }, limit: 500 }),
 list('customers', { select: 'id,name', order: { col: 'name', asc: true }, limit: 500 }),
 list('profiles', { select: 'id,full_name', eq: { is_active: true }, order: { col: 'full_name', asc: true }, limit: 500 }),
 ])
 setRows(c); setCustomers(cu); setPics(pr)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data kontrak', 'error') }
 finally { setLoading(false) }
 }
 useEffect(() => { load() }, [])

 const openAdd = async () => {
 setEditing(null)
 let no = ''
 try { no = await nextDocNo(profile!.company_id, 'KTR') } catch { /* biarkan kosong bila gagal */ }
 setForm({ ...emptyForm, contract_no: no })
 setModal(true)
 }
 const openEdit = (row: any) => { setEditing(row); setForm({ ...emptyForm, ...row }); setModal(true) }

 const openDetail = async (row: any) => {
 setDetail(row); setTab('ringkasan'); setDetailLoading(true)
 try {
 const [pl, sp, cl, inv, at] = await Promise.all([
 list('contract_price_list', { eq: { contract_id: row.id }, order: { col: 'item_code', asc: true } }),
 list('spk', { eq: { contract_id: row.id }, order: { col: 'created_at', asc: false } }),
 list('progress_claims', { eq: { contract_id: row.id }, order: { col: 'created_at', asc: false } }),
 list('ar_invoices', { eq: { contract_id: row.id }, order: { col: 'created_at', asc: false } }),
 list('attachments', { eq: { entity_type: 'contracts', entity_id: row.id }, order: { col: 'created_at', asc: false } }),
 ])
 setPriceList(pl); setSpkList(sp); setClaims(cl); setInvoices(inv); setAttachments(at)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat detail kontrak', 'error') }
 finally { setDetailLoading(false) }
 }

 const handleUpload = async (file: File) => {
 if (!file) return
 setUploading(true)
 try { const path = await uploadFile(profile!.company_id, 'kontrak', file); setForm((f: any) => ({ ...f, file_url: path })); toast.push('Berkas terunggah', 'success') }
 catch (e: any) { toast.push(e.message ?? 'Gagal mengunggah berkas', 'error') }
 finally { setUploading(false) }
 }

 const handleAttachmentUpload = async (file: File) => {
 if (!file || !detail) return
 setAttUploading(true)
 try {
 const path = await uploadFile(profile!.company_id, 'kontrak', file)
 await insert('attachments', {
 company_id: profile!.company_id, entity_type: 'contracts', entity_id: detail.id,
 file_name: file.name, file_url: path, mime_type: file.type, size_bytes: file.size,
 })
 const at = await list('attachments', { eq: { entity_type: 'contracts', entity_id: detail.id }, order: { col: 'created_at', asc: false } })
 setAttachments(at); toast.push('Lampiran ditambahkan', 'success')
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengunggah lampiran', 'error') }
 finally { setAttUploading(false) }
 }

 const save = async () => {
 if (!form.contract_no || !form.contract_name || !form.customer_id) { toast.push('No kontrak, nama, dan pelanggan wajib diisi', 'error'); return }
 if (form.start_date && form.end_date && form.end_date < form.start_date) { toast.push('Tanggal berakhir tidak boleh mendahului tanggal mulai', 'error'); return }
 if (Number(form.contract_value) < 0) { toast.push('Nilai kontrak tidak boleh negatif', 'error'); return }
 setSaving(true)
 try {
 const payload = {
 contract_no: form.contract_no, contract_name: form.contract_name, customer_id: form.customer_id,
 contract_type: form.contract_type, start_date: form.start_date || null, end_date: form.end_date || null,
 contract_value: Number(form.contract_value) || 0, retention_percent: Number(form.retention_percent) || 0,
 status: form.status, file_url: form.file_url || null, pic_id: form.pic_id || null,
 }
 if (editing) { await update('contracts', editing.id, payload); toast.push('Kontrak diperbarui', 'success') }
 else { await insert('contracts', { ...payload, company_id: profile!.company_id }); toast.push('Kontrak ditambahkan', 'success') }
 setModal(false); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan kontrak', 'error') }
 finally { setSaving(false) }
 }

 const doDelete = async () => {
 if (!delId) return
 try { await remove('contracts', delId); toast.push('Kontrak dihapus', 'success'); load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus kontrak', 'error') }
 }

 const columns = [
 { key: 'contract_no', header: 'No Kontrak', width: '140px' },
 { key: 'contract_name', header: 'Nama Kontrak' },
 { key: 'customer_id', header: 'Pelanggan', render: (r: any) => custMap[r.customer_id] ?? '-' },
 { key: 'contract_type', header: 'Jenis', render: (r: any) => CONTRACT_TYPE_OPTIONS.find(o => o.value === r.contract_type)?.label ?? r.contract_type },
 { key: 'periode', header: 'Periode', sortable: false, render: (r: any) => `${tgl(r.start_date)} – ${tgl(r.end_date)}` },
 { key: 'contract_value', header: 'Nilai', align: 'right' as const, render: (r: any) => rupiah(r.contract_value) },
 { key: 'retention_percent', header: 'Retensi', align: 'right' as const, render: (r: any) => pct(r.retention_percent, 0) },
 {
 key: 'status', header: 'Status', sortable: false,
 render: (r: any) => {
 const d = daysUntilExpiry(r.end_date)
 return <div className="flex items-center gap-1.5 flex-wrap"><Badge>{r.status}</Badge>
 {r.status === 'aktif' && d != null && d >= 0 && d < 60 && <Badge tone="orange">Habis {d} hari lagi</Badge>}
 {r.status === 'aktif' && d != null && d < 0 && <Badge tone="red">Terlewat {Math.abs(d)} hari</Badge>}
 </div>
 },
 },
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
 <PageHeader title="Kontrak" subtitle="Kontrak kerja sama dengan pelanggan beserta nilai, retensi, dan masa berlaku."
 actions={can('COMMERCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Kontrak</Button>} />

 {loading ? <Card><TableSkeleton /></Card> : (
 <DataTable columns={columns} rows={rows} searchable searchKeys={['contract_no', 'contract_name']}
 exportName="kontrak" onRowClick={openDetail}
 emptyTitle="Belum ada kontrak" emptyMessage="Tambahkan kontrak pertama untuk pelanggan."
 emptyAction={can('COMMERCE', 'write') && <Button size="sm" icon={<Plus size={16} />} onClick={openAdd}>Tambah Kontrak</Button>} />
 )}

 <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Ubah Kontrak' : 'Tambah Kontrak'} size="lg"
 footer={<><Button variant="outline" onClick={() => setModal(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="No Kontrak" required><Input value={form.contract_no} onChange={e => setForm({ ...form, contract_no: e.target.value })} /></Field>
 <Field label="Nama Kontrak" required><Input value={form.contract_name} onChange={e => setForm({ ...form, contract_name: e.target.value })} /></Field>
 <Field label="Pelanggan" required><Select value={form.customer_id} options={customers.map(c => ({ value: c.id, label: c.name }))} onChange={(e: any) => setForm({ ...form, customer_id: e.target.value })} /></Field>
 <Field label="Jenis Kontrak"><Select value={form.contract_type} options={CONTRACT_TYPE_OPTIONS} onChange={(e: any) => setForm({ ...form, contract_type: e.target.value })} /></Field>
 <Field label="Tanggal Mulai"><Input type="date" value={form.start_date ?? ''} onChange={e => setForm({ ...form, start_date: e.target.value })} /></Field>
 <Field label="Tanggal Berakhir"><Input type="date" value={form.end_date ?? ''} onChange={e => setForm({ ...form, end_date: e.target.value })} /></Field>
 <Field label="Nilai Kontrak"><Input type="number" value={form.contract_value} onChange={e => setForm({ ...form, contract_value: e.target.value })} /></Field>
 <Field label="Retensi (%)"><Input type="number" value={form.retention_percent} onChange={e => setForm({ ...form, retention_percent: e.target.value })} /></Field>
 <Field label="PIC Internal"><Select value={form.pic_id} options={pics.map(p => ({ value: p.id, label: p.full_name }))} onChange={(e: any) => setForm({ ...form, pic_id: e.target.value })} /></Field>
 <Field label="Status"><Select value={form.status} options={CONTRACT_STATUS_OPTIONS} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>
 <Field label="Berkas Kontrak" className="sm:col-span-2">
 <div className="flex items-center gap-2">
 <label className="inline-flex items-center gap-2 h-10 px-4 rounded-sm border border-ink-200 text-body cursor-pointer hover:bg-ink-50">
 <Upload size={15} />{uploading ? 'Mengunggah…' : 'Pilih Berkas'}
 <input type="file" className="hidden" disabled={uploading} onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
 </label>
 {form.file_url && <span className="text-caption text-ink-500">Berkas terpasang</span>}
 </div>
 </Field>
 </div>
 </Modal>

 <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.contract_name} width="max-w-3xl">
 {detail && (
 <>
 <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-4" />
 {tab === 'ringkasan' && (
 <Desc items={[
 { label: 'No Kontrak', value: detail.contract_no },
 { label: 'Pelanggan', value: custMap[detail.customer_id] },
 { label: 'Jenis', value: CONTRACT_TYPE_OPTIONS.find(o => o.value === detail.contract_type)?.label },
 { label: 'Periode', value: `${tgl(detail.start_date)} – ${tgl(detail.end_date)}` },
 { label: 'Nilai Kontrak', value: rupiah(detail.contract_value) },
 { label: 'Retensi', value: pct(detail.retention_percent, 0) },
 { label: 'PIC Internal', value: picMap[detail.pic_id] },
 { label: 'Status', value: <Badge>{detail.status}</Badge> },
 ]} />)}
 {tab === 'pricelist' && (detailLoading ? <TableSkeleton rows={3} /> : priceList.length === 0 ? <EmptyState title="Belum ada price list" message="Kelola item pekerjaan pada menu Price List Kontrak." /> : (
 <div className="space-y-2">{priceList.map((p: any) => (
 <Card key={p.id} className="p-3 flex items-center justify-between gap-3">
 <div><p className="text-body font-medium">{p.item_code} — {p.description}</p><p className="text-caption text-ink-500">Satuan: {p.uom || '-'}</p></div>
 <p className="text-body tabular">{rupiah(p.unit_price)}</p>
 </Card>))}</div>))}
 {tab === 'spk' && (detailLoading ? <TableSkeleton rows={3} /> : spkList.length === 0 ? <EmptyState title="Belum ada SPK" /> : (
 <div className="space-y-2">{spkList.map((s: any) => (
 <Card key={s.id} className="p-3 flex items-center justify-between gap-3">
 <div><p className="text-body font-medium">{s.spk_no} — {s.title}</p><p className="text-caption text-ink-500">{tgl(s.start_date)} – {tgl(s.end_date)}</p></div>
 <div className="text-right"><p className="text-body tabular">{rupiah(s.spk_value)}</p><Badge>{s.status}</Badge></div>
 </Card>))}</div>))}
 {tab === 'klaim' && (detailLoading ? <TableSkeleton rows={3} /> : claims.length === 0 ? <EmptyState title="Belum ada klaim progres" /> : (
 <div className="space-y-2">{claims.map((c: any) => (
 <Card key={c.id} className="p-3 flex items-center justify-between gap-3">
 <div><p className="text-body font-medium">{c.claim_no}</p><p className="text-caption text-ink-500">{tgl(c.period_start)} – {tgl(c.period_end)}</p></div>
 <div className="text-right"><p className="text-body tabular">{rupiah(c.claim_amount)}</p><Badge>{c.status}</Badge></div>
 </Card>))}</div>))}
 {tab === 'invoice' && (detailLoading ? <TableSkeleton rows={3} /> : invoices.length === 0 ? <EmptyState title="Belum ada invoice" /> : (
 <div className="space-y-2">{invoices.map((i: any) => (
 <Card key={i.id} className="p-3 flex items-center justify-between gap-3">
 <div><p className="text-body font-medium">{i.inv_no}</p><p className="text-caption text-ink-500">Jatuh tempo {tgl(i.due_date)}</p></div>
 <div className="text-right"><p className="text-body tabular">{rupiah(i.total)}</p><Badge>{i.status}</Badge></div>
 </Card>))}</div>))}
 {tab === 'lampiran' && (
 <div>
 {can('COMMERCE', 'write') && (
 <label className="mb-3 inline-flex items-center gap-2 h-9 px-3 rounded-sm border border-ink-200 text-caption cursor-pointer hover:bg-ink-50">
 <Upload size={14} />{attUploading ? 'Mengunggah…' : 'Unggah Lampiran'}
 <input type="file" className="hidden" disabled={attUploading} onChange={e => e.target.files?.[0] && handleAttachmentUpload(e.target.files[0])} />
 </label>)}
 {detailLoading ? <TableSkeleton rows={3} /> : attachments.length === 0 ? <EmptyState title="Belum ada lampiran" icon={<Paperclip size={20} />} /> : (
 <div className="space-y-2">{attachments.map((a: any) => (
 <Card key={a.id} className="p-3 flex items-center justify-between gap-3">
 <div className="flex items-center gap-2"><Paperclip size={15} className="text-ink-400" /><span className="text-body">{a.file_name}</span></div>
 <Button size="sm" variant="outline" onClick={async () => { const u = await signedUrl(a.file_url); if (u) window.open(u, '_blank') }}>Buka</Button>
 </Card>))}</div>)}
 </div>)}
 </>)}
 </Drawer>

 <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={doDelete} danger
 title="Hapus Kontrak" message="Kontrak beserta relasinya sebaiknya dipastikan tidak lagi dipakai. Lanjutkan hapus?" confirmLabel="Ya, Hapus" />
 </div>
 )
}
