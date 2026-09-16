import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update } from '@/lib/db'
import { rupiah, num } from '@/lib/format'
import { PageHeader, FilterBar, KpiCard, DataTable, Modal, Button, Field, Input, Select, Checkbox, Badge, useToast, Plus } from '@/components/ui'
import { ITEM_CATEGORY } from '../lib/shared'

export default function Katalog() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [rows, setRows] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [fCat, setFCat] = useState('')
 const [modal, setModal] = useState<{ open: boolean; row?: any }>({ open: false })
 const [form, setForm] = useState<any>({})
 const [saving, setSaving] = useState(false)

 const load = useCallback(async () => {
 setLoading(true)
 try { setRows(await list('item_catalog', { order: { col: 'name', asc: true } })) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memuat katalog item', 'error') }
 finally { setLoading(false) }
 }, [toast])
 useEffect(() => { load() }, [load])

 const filtered = rows.filter(r => !fCat || r.category === fCat)

 function openAdd() {
 setForm({ code: '', name: '', category: 'NON_NTE', uom: 'pcs', last_price: 0, is_serial_tracked: false,
 is_consignment: false, principal: '', min_stock: 0, is_active: true })
 setModal({ open: true })
 }
 function openEdit(row: any) { setForm({ ...row }); setModal({ open: true, row }) }

 async function save() {
 if (!form.code || !form.name) { toast.push('Kode dan nama item wajib diisi', 'error'); return }
 setSaving(true)
 try {
 if (modal.row) { await update('item_catalog', modal.row.id, { ...form }); toast.push('Item diperbarui') }
 else { await insert('item_catalog', { ...form, spec: {}, company_id: profile!.company_id, created_by: profile!.id }); toast.push('Item ditambahkan') }
 setModal({ open: false }); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan item', 'error') }
 finally { setSaving(false) }
 }

 const columns = [
 { key: 'code', header: 'Kode', width: '110px' },
 { key: 'name', header: 'Nama Item' },
 { key: 'category', header: 'Kategori', render: (r: any) => <Badge tone="teal">{r.category}</Badge> },
 {
 key: 'flag', header: 'Penanda', sortable: false, render: (r: any) => (
 <div className="flex gap-1">
 {r.is_serial_tracked && <Badge tone="blue">Bernomor Seri</Badge>}
 {r.is_consignment && <Badge tone="amber">Konsinyasi</Badge>}
 {!r.is_active && <Badge tone="zinc">Nonaktif</Badge>}
 </div>
 ),
 },
 { key: 'uom', header: 'Satuan', width: '90px' },
 { key: 'last_price', header: 'Harga Terakhir', align: 'right' as const, render: (r: any) => rupiah(r.last_price) },
 { key: 'min_stock', header: 'Stok Minimum', align: 'right' as const, render: (r: any) => num(r.min_stock) },
 {
 key: 'aksi', header: '', sortable: false, render: (r: any) => can('PROCUREMENT', 'write') && (
 <div className="flex justify-end" onClick={e => e.stopPropagation()}>
 <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Ubah</Button>
 </div>
 ),
 },
 ]

 return (
 <div>
 <PageHeader title="Katalog Item" subtitle="Referensi material, aset, dan jasa yang dapat dipesan lewat PR/PO."
 actions={can('PROCUREMENT', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Item</Button>} />

 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
 <KpiCard label="Total Item" value={num(rows.length)} />
 <KpiCard label="Bernomor Seri" value={num(rows.filter(r => r.is_serial_tracked).length)} tone="teal" />
 <KpiCard label="Konsinyasi" value={num(rows.filter(r => r.is_consignment).length)} tone="amber" />
 <KpiCard label="Di Bawah Stok Minimum" value={num(rows.filter(r => Number(r.min_stock) > 0).length)} sub="perlu cek stok gudang" tone="red" />
 </div>

 <FilterBar>
 <Field label="Kategori" className="w-52"><Select value={fCat} onChange={(e: any) => setFCat(e.target.value)} options={ITEM_CATEGORY} /></Field>
 </FilterBar>

 <DataTable columns={columns} rows={filtered} loading={loading} searchable searchKeys={['code', 'name', 'principal']}
 exportName="katalog-item" emptyTitle="Belum ada item katalog" emptyMessage="Tambahkan item agar dapat dipilih pada PR/PO." />

 <Modal open={modal.open} onClose={() => setModal({ open: false })} size="lg"
 title={modal.row ? 'Ubah Item Katalog' : 'Tambah Item Katalog'}
 footer={<><Button variant="outline" onClick={() => setModal({ open: false })}>Batal</Button>
 <Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Kode Item" required><Input value={form.code ?? ''} onChange={(e: any) => setForm({ ...form, code: e.target.value })} /></Field>
 <Field label="Nama Item" required><Input value={form.name ?? ''} onChange={(e: any) => setForm({ ...form, name: e.target.value })} /></Field>
 <Field label="Kategori" required><Select value={form.category ?? ''} onChange={(e: any) => setForm({ ...form, category: e.target.value })} options={ITEM_CATEGORY} /></Field>
 <Field label="Satuan (UoM)"><Input value={form.uom ?? ''} onChange={(e: any) => setForm({ ...form, uom: e.target.value })} placeholder="pcs / meter / unit" /></Field>
 <Field label="Prinsipal / Merek"><Input value={form.principal ?? ''} onChange={(e: any) => setForm({ ...form, principal: e.target.value })} /></Field>
 <Field label="Harga Terakhir"><Input type="number" value={form.last_price ?? 0} onChange={(e: any) => setForm({ ...form, last_price: Number(e.target.value) })} /></Field>
 <Field label="Stok Minimum"><Input type="number" value={form.min_stock ?? 0} onChange={(e: any) => setForm({ ...form, min_stock: Number(e.target.value) })} /></Field>
 <Field label="Status"><Checkbox label="Item aktif" checked={form.is_active ?? true} onChange={(e: any) => setForm({ ...form, is_active: e.target.checked })} /></Field>
 <Field label="Penanda Khusus" className="sm:col-span-2">
 <div className="flex gap-6">
 <Checkbox label="Item bernomor seri (serial tracked)" checked={!!form.is_serial_tracked} onChange={(e: any) => setForm({ ...form, is_serial_tracked: e.target.checked })} />
 <Checkbox label="Item konsinyasi" checked={!!form.is_consignment} onChange={(e: any) => setForm({ ...form, is_consignment: e.target.checked })} />
 </div>
 </Field>
 </div>
 </Modal>
 </div>
 )
}
