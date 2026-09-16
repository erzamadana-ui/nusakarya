import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, nextDocNo } from '@/lib/db'
import { num, tgl, todayISO } from '@/lib/format'
import {
 PageHeader, FilterBar, KpiCard, DataTable, Modal,
 Button, Field, Input, Money, Select, Badge, useToast, Plus,
} from '@/components/ui'
import { MOVE_TYPES, moveSides } from '../lib/shared'

export default function Mutasi() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [rows, setRows] = useState<any[]>([])
 const [items, setItems] = useState<any[]>([])
 const [warehouses, setWarehouses] = useState<any[]>([])
 const [employees, setEmployees] = useState<any[]>([])
 const [loading, setLoading] = useState(true)

 const [fType, setFType] = useState(''); const [fFrom, setFFrom] = useState(''); const [fTo, setFTo] = useState('')
 const [modalOpen, setModalOpen] = useState(false)
 const [form, setForm] = useState<any>({ move_type: 'GR', move_date: todayISO(), item_id: '', qty: '', price: '', from_warehouse_id: '', to_warehouse_id: '', to_employee_id: '', adjust_dir: 'tambah', note: '' })
 const [saving, setSaving] = useState(false)

 const load = useCallback(async () => {
 setLoading(true)
 try {
 const [mv, it, w, em] = await Promise.all([
 list('stock_movements', {
 select: 'id,move_no,move_date,move_type,item_id,qty,uom,price,note,from_warehouse_id,to_warehouse_id,to_employee_id,item:item_catalog!item_id(code,name),from_wh:warehouses!from_warehouse_id(name),to_wh:warehouses!to_warehouse_id(name),employee:employees!to_employee_id(full_name)',
 order: { col: 'move_date', asc: false }, limit: 1000,
 }),
 list('item_catalog', { order: { col: 'name', asc: true } }),
 list('warehouses', { order: { col: 'name', asc: true } }),
 list('employees', { eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
 ])
 setRows((mv as any[]).map(r => ({ ...r, item_name: r.item?.name, item_code: r.item?.code, from_name: r.from_wh?.name, to_name: r.to_wh?.name, employee_name: r.employee?.full_name })))
 setItems(it); setWarehouses(w); setEmployees(em)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat mutasi stok', 'error') }
 finally { setLoading(false) }
 }, [toast])
 useEffect(() => { load() }, [load])

 const filtered = useMemo(() => rows.filter(r =>
 (!fType || r.move_type === fType) && (!fFrom || r.move_date >= fFrom) && (!fTo || r.move_date <= fTo)
 ), [rows, fType, fFrom, fTo])

 function openAdd() {
 setForm({ move_type: 'GR', move_date: todayISO(), item_id: '', qty: '', price: '', from_warehouse_id: '', to_warehouse_id: '', to_employee_id: '', adjust_dir: 'tambah', note: '' })
 setModalOpen(true)
 }

 async function save() {
 if (!form.item_id || !form.qty || Number(form.qty) <= 0) { toast.push('Item dan qty wajib diisi (> 0)', 'error'); return }
 const sides = moveSides(form.move_type)
 let from_warehouse_id: string | null = null, to_warehouse_id: string | null = null
 if (form.move_type === 'ADJUST') {
 if (!form.from_warehouse_id) { toast.push('Pilih gudang', 'error'); return }
 if (form.adjust_dir === 'tambah') to_warehouse_id = form.from_warehouse_id
 else from_warehouse_id = form.from_warehouse_id
 } else {
 if (sides.from && !form.from_warehouse_id) { toast.push('Pilih gudang asal', 'error'); return }
 if (sides.to && !form.to_warehouse_id) { toast.push('Pilih gudang tujuan', 'error'); return }
 from_warehouse_id = sides.from ? form.from_warehouse_id : null
 to_warehouse_id = sides.to ? form.to_warehouse_id : null
 }
 setSaving(true)
 try {
 const move_no = await nextDocNo(profile!.company_id, 'MOV')
 const item = items.find(i => i.id === form.item_id)
 await insert('stock_movements', {
 company_id: profile!.company_id, move_no, move_date: form.move_date, move_type: form.move_type,
 item_id: form.item_id, qty: Number(form.qty), uom: item?.uom ?? null,
 from_warehouse_id, to_warehouse_id,
 to_employee_id: form.to_employee_id || null,
 price: form.price === '' ? 0 : Number(form.price),
 note: form.note || null, created_by: profile!.id,
 })
 toast.push(`Mutasi ${move_no} tersimpan, saldo stok diperbarui otomatis`)
 setModalOpen(false); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan mutasi stok', 'error') }
 finally { setSaving(false) }
 }

 const sides = moveSides(form.move_type)
 const columns = [
 { key: 'move_no', header: 'No. Mutasi' },
 { key: 'move_date', header: 'Tanggal', render: (r: any) => tgl(r.move_date) },
 { key: 'move_type', header: 'Jenis', render: (r: any) => <Badge tone="slate">{r.move_type}</Badge> },
 { key: 'item_name', header: 'Item', render: (r: any) => <span>{r.item_code} · {r.item_name}</span> },
 { key: 'qty', header: 'Qty', align: 'right' as const, render: (r: any) => `${num(r.qty)} ${r.uom ?? ''}` },
 { key: 'from_name', header: 'Dari Gudang', render: (r: any) => r.from_name ?? '-' },
 { key: 'to_name', header: 'Ke Gudang', render: (r: any) => r.to_name ?? '-' },
 { key: 'employee_name', header: 'Penerima', render: (r: any) => r.employee_name ?? '-' },
 { key: 'note', header: 'Referensi / Catatan', className: 'max-w-[220px] truncate' },
 ]

 return (
 <div>
 <PageHeader title="Mutasi Stok" subtitle="Riwayat pergerakan stok: penerimaan, pengeluaran, retur, transfer, penyesuaian, dan scrap."
 actions={can('INVENTORY', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Buat Mutasi</Button>} />

 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
 {MOVE_TYPES.slice(0, 4).map(t => (
 <KpiCard key={t.value} label={t.label} value={num(rows.filter(r => r.move_type === t.value).length)} />
 ))}
 </div>

 <FilterBar>
 <Field label="Jenis Mutasi" className="w-56"><Select value={fType} onChange={(e: any) => setFType(e.target.value)} options={MOVE_TYPES} /></Field>
 <Field label="Dari Tanggal" className="w-40"><Input type="date" value={fFrom} onChange={(e: any) => setFFrom(e.target.value)} /></Field>
 <Field label="Sampai Tanggal" className="w-40"><Input type="date" value={fTo} onChange={(e: any) => setFTo(e.target.value)} /></Field>
 </FilterBar>

 <DataTable columns={columns} rows={filtered} loading={loading} searchable searchKeys={['move_no', 'item_code', 'item_name']}
 exportName="mutasi-stok" emptyTitle="Belum ada mutasi stok" />
 <p className="text-caption text-ink-400 mt-2">Catatan: saldo pada Saldo Stok diperbarui otomatis oleh basis data setiap kali mutasi tersimpan.</p>

 <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="lg" title="Buat Mutasi Stok"
 footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
 <Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Jenis Mutasi"><Select value={form.move_type} onChange={(e: any) => setForm({ ...form, move_type: e.target.value, from_warehouse_id: '', to_warehouse_id: '' })} options={MOVE_TYPES} /></Field>
 <Field label="Tanggal"><Input type="date" value={form.move_date} onChange={(e: any) => setForm({ ...form, move_date: e.target.value })} /></Field>
 <Field label="Item" required className="sm:col-span-2"><Select value={form.item_id} onChange={(e: any) => setForm({ ...form, item_id: e.target.value })}
 options={items.map(i => ({ value: i.id, label: `${i.code} · ${i.name}` }))} /></Field>
 <Field label="Qty" required><Input type="number" min="0" value={form.qty} onChange={(e: any) => setForm({ ...form, qty: e.target.value })} /></Field>
 <Field label="Harga per Unit (opsional)"><Money value={form.price} onChange={(v: number) => setForm({ ...form, price: v })} /></Field>

 {form.move_type === 'ADJUST' && (
 <>
 <Field label="Jenis Penyesuaian"><Select value={form.adjust_dir} onChange={(e: any) => setForm({ ...form, adjust_dir: e.target.value })}
 options={[{ value: 'tambah', label: 'Tambah Stok' }, { value: 'kurangi', label: 'Kurangi Stok' }]} /></Field>
 <Field label="Gudang" required><Select value={form.from_warehouse_id} onChange={(e: any) => setForm({ ...form, from_warehouse_id: e.target.value })}
 options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Field>
 </>
 )}
 {sides.from && form.move_type !== 'ADJUST' && (
 <Field label="Gudang Asal" required><Select value={form.from_warehouse_id} onChange={(e: any) => setForm({ ...form, from_warehouse_id: e.target.value })}
 options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Field>
 )}
 {sides.to && form.move_type !== 'ADJUST' && (
 <Field label="Gudang Tujuan" required><Select value={form.to_warehouse_id} onChange={(e: any) => setForm({ ...form, to_warehouse_id: e.target.value })}
 options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Field>
 )}
 {form.move_type === 'ISSUE' && (
 <Field label="Penerima (opsional)"><Select value={form.to_employee_id} onChange={(e: any) => setForm({ ...form, to_employee_id: e.target.value })}
 options={employees.map(e => ({ value: e.id, label: e.full_name }))} /></Field>
 )}
 <Field label="Referensi / Catatan" className="sm:col-span-2"><Input value={form.note} onChange={(e: any) => setForm({ ...form, note: e.target.value })} placeholder="No. WO / No. PR / catatan lain" /></Field>
 </div>
 </Modal>
 </div>
 )
}
