import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import { rupiah } from '@/lib/format'
import {
 PageHeader, Card, DataTable, Modal, ConfirmDialog, Field, Input, Select, Textarea,
 Badge, Button, useToast, TableSkeleton, EmptyState, Plus,
} from '@/components/ui'
import { ClipboardPaste } from 'lucide-react'

const emptyForm = { item_code: '', description: '', uom: '', unit_price: 0, job_type_id: '', is_active: true }

export default function PriceList() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [contracts, setContracts] = useState<any[]>([])
 const [contractId, setContractId] = useState('')
 const [jobTypes, setJobTypes] = useState<any[]>([])
 const [rows, setRows] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [modal, setModal] = useState(false)
 const [editing, setEditing] = useState<any>(null)
 const [form, setForm] = useState<any>(emptyForm)
 const [saving, setSaving] = useState(false)
 const [delId, setDelId] = useState<string | null>(null)
 const [importOpen, setImportOpen] = useState(false)
 const [importText, setImportText] = useState('')
 const [importing, setImporting] = useState(false)

 const jobTypeMap = useMemo(() => Object.fromEntries(jobTypes.map(j => [j.id, j.name])), [jobTypes])

 useEffect(() => {
 (async () => {
 try {
 const [c, jt] = await Promise.all([
 list('contracts', { select: 'id,contract_no,contract_name', order: { col: 'contract_name', asc: true }, limit: 500 }),
 list('job_types', { select: 'id,code,name', eq: { is_active: true }, order: { col: 'name', asc: true }, limit: 500 }),
 ])
 setContracts(c); setJobTypes(jt)
 if (c.length) setContractId(c[0].id)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data awal', 'error') }
 })()
 }, [])

 const load = async (cid: string) => {
 if (!cid) { setRows([]); return }
 setLoading(true)
 try { setRows(await list('contract_price_list', { eq: { contract_id: cid }, order: { col: 'item_code', asc: true }, limit: 1000 })) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memuat price list', 'error') }
 finally { setLoading(false) }
 }
 useEffect(() => { load(contractId) }, [contractId])

 const openAdd = () => { setEditing(null); setForm(emptyForm); setModal(true) }
 const openEdit = (row: any) => { setEditing(row); setForm({ ...emptyForm, ...row }); setModal(true) }

 const save = async () => {
 if (!contractId) { toast.push('Pilih kontrak terlebih dahulu', 'error'); return }
 setSaving(true)
 try {
 const payload = {
 contract_id: contractId, item_code: form.item_code, description: form.description, uom: form.uom,
 unit_price: Number(form.unit_price) || 0, job_type_id: form.job_type_id || null, is_active: !!form.is_active,
 }
 if (editing) { await update('contract_price_list', editing.id, payload); toast.push('Item price list diperbarui', 'success') }
 else { await insert('contract_price_list', { ...payload, company_id: profile!.company_id }); toast.push('Item price list ditambahkan', 'success') }
 setModal(false); load(contractId)
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan item', 'error') }
 finally { setSaving(false) }
 }

 const doDelete = async () => {
 if (!delId) return
 try { await remove('contract_price_list', delId); toast.push('Item dihapus', 'success'); load(contractId) }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus item', 'error') }
 }

 const parsedImportRows = useMemo(() => {
 return importText.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
 const [item_code = '', description = '', uom = '', harga = ''] = line.split('|').map(s => s.trim())
 const unit_price = Number(harga.replace(/[^\d.-]/g, '')) || 0
 return { item_code, description, uom, unit_price }
 }).filter(r => r.item_code || r.description)
 }, [importText])

 const doImport = async () => {
 if (!contractId) { toast.push('Pilih kontrak terlebih dahulu', 'error'); return }
 if (!parsedImportRows.length) { toast.push('Tidak ada baris valid untuk diimpor', 'error'); return }
 setImporting(true)
 try {
 const payload = parsedImportRows.map(r => ({ ...r, contract_id: contractId, company_id: profile!.company_id, is_active: true }))
 for (const p of payload) await insert('contract_price_list', p)
 toast.push(`${payload.length} item berhasil diimpor`, 'success')
 setImportOpen(false); setImportText(''); load(contractId)
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengimpor item', 'error') }
 finally { setImporting(false) }
 }

 const columns = [
 { key: 'item_code', header: 'Kode', width: '120px' },
 { key: 'description', header: 'Deskripsi Pekerjaan' },
 { key: 'uom', header: 'Satuan', width: '90px' },
 { key: 'unit_price', header: 'Harga Satuan', align: 'right' as const, render: (r: any) => rupiah(r.unit_price) },
 { key: 'job_type_id', header: 'Job Type', render: (r: any) => jobTypeMap[r.job_type_id] ?? '-' },
 { key: 'is_active', header: 'Status', render: (r: any) => <Badge tone={r.is_active ? 'emerald' : 'slate'}>{r.is_active ? 'aktif' : 'nonaktif'}</Badge> },
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

 return (
 <div>
 <PageHeader title="Price List Kontrak" subtitle="Daftar item pekerjaan dan harga satuan per kontrak."
 actions={can('COMMERCE', 'write') && <>
 <Button variant="outline" icon={<ClipboardPaste size={16} />} onClick={() => setImportOpen(true)}>Impor Cepat</Button>
 <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Item</Button>
 </>} />

 <Card className="p-4 mb-4">
 <Field label="Kontrak" className="max-w-md">
 <Select value={contractId} options={contracts.map(c => ({ value: c.id, label: `${c.contract_no} — ${c.contract_name}` }))} onChange={(e: any) => setContractId(e.target.value)} />
 </Field>
 </Card>

 {!contractId ? <EmptyState title="Pilih kontrak" message="Pilih kontrak terlebih dahulu untuk melihat price list." /> :
 loading ? <Card><TableSkeleton /></Card> : (
 <DataTable columns={columns} rows={rows} searchable searchKeys={['item_code', 'description']} exportName="price-list"
 emptyTitle="Belum ada item price list" emptyMessage="Tambahkan item satu per satu atau gunakan Impor Cepat."
 emptyAction={can('COMMERCE', 'write') && <Button size="sm" icon={<Plus size={16} />} onClick={openAdd}>Tambah Item</Button>} />
 )}

 <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Ubah Item' : 'Tambah Item Price List'}
 footer={<><Button variant="outline" onClick={() => setModal(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="Kode Item"><Input value={form.item_code} onChange={e => setForm({ ...form, item_code: e.target.value })} /></Field>
 <Field label="Satuan"><Input value={form.uom} onChange={e => setForm({ ...form, uom: e.target.value })} placeholder="mis. titik, meter, unit" /></Field>
 <Field label="Deskripsi Pekerjaan" className="sm:col-span-2"><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
 <Field label="Harga Satuan"><Input type="number" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} /></Field>
 <Field label="Tautan Job Type"><Select value={form.job_type_id} options={jobTypes.map(j => ({ value: j.id, label: `${j.code} — ${j.name}` }))} onChange={(e: any) => setForm({ ...form, job_type_id: e.target.value })} /></Field>
 </div>
 </Modal>

 <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Impor Cepat Price List" size="lg"
 footer={<><Button variant="outline" onClick={() => setImportOpen(false)}>Batal</Button><Button loading={importing} onClick={doImport}>Simpan {parsedImportRows.length > 0 ? `(${parsedImportRows.length} item)` : ''}</Button></>}>
 <Field label="Tempel Baris Item" hint="Format per baris: kode|deskripsi|satuan|harga">
 <Textarea rows={8} value={importText} onChange={e => setImportText(e.target.value)}
 placeholder={'PU-01|Penarikan kabel udara|meter|8500\nPU-02|Instalasi ODP|unit|350000'} className="min-h-[180px] font-mono text-caption" />
 </Field>
 {parsedImportRows.length > 0 && (
 <div className="mt-3 max-h-40 overflow-auto border border-ink-200 rounded-sm">
 <table className="w-full text-caption">
 <tbody>{parsedImportRows.map((r, i) => (
 <tr key={i} className="border-b border-ink-100 last:border-0">
 <td className="px-2 py-1">{r.item_code}</td><td className="px-2 py-1">{r.description}</td>
 <td className="px-2 py-1">{r.uom}</td><td className="px-2 py-1 text-right tabular">{rupiah(r.unit_price)}</td>
 </tr>))}</tbody>
 </table>
 </div>)}
 </Modal>

 <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={doDelete} danger
 title="Hapus Item" message="Item price list akan dihapus permanen. Lanjutkan?" confirmLabel="Ya, Hapus" />
 </div>
 )
}
