import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, nextDocNo } from '@/lib/db'
import { rupiah, num, todayISO } from '@/lib/format'
import { PageHeader, FilterBar, KpiCard, DataTable, Badge, Field, Select, Input, Textarea, Button, Modal, useToast, Plus } from '@/components/ui'
import { ITEM_CATEGORY } from '../lib/shared'

const emptyAdjust = { warehouse_id: '', item_id: '', qty_fisik: '', note: '' }

export default function Stok() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [rows, setRows] = useState<any[]>([])
 const [warehouses, setWarehouses] = useState<any[]>([])
 const [items, setItems] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [fWarehouse, setFWarehouse] = useState('')
 const [fCategory, setFCategory] = useState('')

 const [adjustOpen, setAdjustOpen] = useState(false)
 const [adjustForm, setAdjustForm] = useState<any>(emptyAdjust)
 const [adjustSaving, setAdjustSaving] = useState(false)

 const load = useCallback(async () => {
 setLoading(true)
 try {
 const [sb, w, it] = await Promise.all([
 list('stock_balances', {
 select: 'id,qty,qty_reserved,avg_price,warehouse_id,item_id,warehouse:warehouses!warehouse_id(id,name),item:item_catalog!item_id(id,code,name,category,uom,min_stock)',
 order: { col: 'updated_at', asc: false },
 }),
 list('warehouses', { order: { col: 'name', asc: true } }),
 list('item_catalog', { select: 'id,code,name,uom', eq: { is_active: true }, order: { col: 'name', asc: true } }),
 ])
 setRows((sb as any[]).map(r => ({ ...r, item_code: r.item?.code, item_name: r.item?.name, warehouse_name: r.warehouse?.name })))
 setWarehouses(w)
 setItems(it)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat saldo stok', 'error') }
 finally { setLoading(false) }
 }, [toast])
 useEffect(() => { load() }, [load])

 function openAdjust(row?: any) {
 setAdjustForm(row ? { warehouse_id: row.warehouse_id, item_id: row.item_id, qty_fisik: '', note: '' } : emptyAdjust)
 setAdjustOpen(true)
 }
 const qtySistemAdjust = useMemo(() => {
 const b = rows.find(r => r.warehouse_id === adjustForm.warehouse_id && r.item_id === adjustForm.item_id)
 return b ? Number(b.qty || 0) : 0
 }, [rows, adjustForm.warehouse_id, adjustForm.item_id])
 const selisihAdjust = useMemo(() => (adjustForm.qty_fisik === '' ? 0 : Number(adjustForm.qty_fisik) - qtySistemAdjust), [adjustForm.qty_fisik, qtySistemAdjust])
 async function saveAdjust() {
 if (!adjustForm.warehouse_id || !adjustForm.item_id) { toast.push('Pilih gudang dan item', 'error'); return }
 if (adjustForm.qty_fisik === '' || Number(adjustForm.qty_fisik) < 0) { toast.push('Isi qty fisik hasil hitung', 'error'); return }
 if (!adjustForm.note?.trim()) { toast.push('Alasan penyesuaian wajib diisi', 'error'); return }
 const selisih = Number(adjustForm.qty_fisik) - qtySistemAdjust
 if (selisih === 0) { toast.push('Qty fisik sama dengan qty sistem — tidak ada yang perlu disesuaikan', 'error'); return }
 setAdjustSaving(true)
 try {
 const item = items.find(i => i.id === adjustForm.item_id) ?? rows.find(r => r.item_id === adjustForm.item_id)?.item
 const move_no = await nextDocNo(profile!.company_id, 'MOV')
 await insert('stock_movements', {
 company_id: profile!.company_id, move_no, move_date: todayISO(), move_type: 'ADJUST',
 item_id: adjustForm.item_id, qty: Math.abs(selisih), uom: item?.uom ?? null,
 from_warehouse_id: selisih < 0 ? adjustForm.warehouse_id : null,
 to_warehouse_id: selisih > 0 ? adjustForm.warehouse_id : null,
 note: adjustForm.note, created_by: profile!.id,
 })
 toast.push('Penyesuaian stok tersimpan, saldo diperbarui otomatis oleh basis data')
 setAdjustOpen(false); load()
 } catch (e: any) {
 const msg = /row-level security|permission denied/i.test(e?.message ?? '') ? 'Gagal menyimpan — hak akses Anda pada modul Inventory tidak mengizinkan tindakan ini.' : (e.message ?? 'Gagal menyimpan penyesuaian stok')
 toast.push(msg, 'error')
 } finally { setAdjustSaving(false) }
 }

 const filtered = useMemo(() => rows.filter(r =>
 (!fWarehouse || r.warehouse_id === fWarehouse) && (!fCategory || r.item?.category === fCategory)
 ), [rows, fWarehouse, fCategory])

 const totalNilai = useMemo(() => filtered.reduce((s, r) => s + Number(r.qty || 0) * Number(r.avg_price || 0), 0), [filtered])
 const jumlahKritis = useMemo(() => filtered.filter(r => Number(r.qty || 0) < Number(r.item?.min_stock || 0)).length, [filtered])

 const exportRows = useMemo(() => filtered.map(r => ({
 kode_item: r.item?.code, nama_item: r.item?.name, kategori: r.item?.category, gudang: r.warehouse?.name,
 qty: r.qty, qty_dipesan: r.qty_reserved, tersedia: Number(r.qty || 0) - Number(r.qty_reserved || 0),
 harga_rata_rata: r.avg_price, nilai: Number(r.qty || 0) * Number(r.avg_price || 0),
 })), [filtered])

 const columns = [
 { key: 'code', header: 'Kode', width: '100px', render: (r: any) => r.item?.code },
 { key: 'name', header: 'Nama Item', render: (r: any) => r.item?.name },
 { key: 'category', header: 'Kategori', render: (r: any) => <Badge tone="slate">{r.item?.category}</Badge> },
 { key: 'warehouse', header: 'Gudang', render: (r: any) => r.warehouse?.name },
 { key: 'qty', header: 'Qty', align: 'right' as const, render: (r: any) => `${num(r.qty)} ${r.item?.uom ?? ''}` },
 { key: 'qty_reserved', header: 'Qty Dipesan', align: 'right' as const, render: (r: any) => num(r.qty_reserved) },
 { key: 'tersedia', header: 'Tersedia', align: 'right' as const, render: (r: any) => num(Number(r.qty || 0) - Number(r.qty_reserved || 0)) },
 { key: 'avg_price', header: 'Harga Rata-rata', align: 'right' as const, render: (r: any) => rupiah(r.avg_price) },
 { key: 'nilai', header: 'Nilai', align: 'right' as const, render: (r: any) => rupiah(Number(r.qty || 0) * Number(r.avg_price || 0)) },
 {
 key: 'status', header: 'Status', render: (r: any) => Number(r.qty || 0) < Number(r.item?.min_stock || 0)
 ? <Badge tone="red">Di bawah minimum</Badge> : <Badge tone="emerald">Aman</Badge>,
 },
 ...(can('INVENTORY', 'write') ? [{ key: 'aksi', header: 'Aksi', align: 'center' as const, sortable: false, render: (r: any) => (
 <Button size="sm" variant="outline" onClick={(e: any) => { e.stopPropagation(); openAdjust(r) }}>Penyesuaian Stok</Button>
 ) }] : []),
 ]

 return (
 <div>
 <PageHeader title="Saldo Stok" subtitle="Saldo stok berjalan per item dan gudang."
 actions={can('INVENTORY', 'write') && <Button icon={<Plus size={16} />} onClick={() => openAdjust()}>Penyesuaian Stok</Button>} />

 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
 <KpiCard label="Nilai Stok (Terfilter)" value={rupiah(totalNilai, true)} tone="teal" />
 <KpiCard label="Baris Stok" value={num(filtered.length)} />
 <KpiCard label="Item Di Bawah Minimum" value={num(jumlahKritis)} tone="red" />
 </div>

 <FilterBar>
 <Field label="Gudang" className="w-56"><Select value={fWarehouse} onChange={(e: any) => setFWarehouse(e.target.value)}
 options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Field>
 <Field label="Kategori" className="w-56"><Select value={fCategory} onChange={(e: any) => setFCategory(e.target.value)} options={ITEM_CATEGORY} /></Field>
 </FilterBar>

 <DataTable columns={columns} rows={filtered} loading={loading}
 searchable searchKeys={['item_code', 'item_name', 'warehouse_name']} pageSize={25}
 exportName="saldo-stok"
 emptyTitle="Belum ada saldo stok" emptyMessage="Saldo akan muncul otomatis setelah terjadi mutasi stok." />
 {loading ? null : (
 <p className="text-caption text-ink-400 mt-2">Ekspor mengikuti data yang tampil pada filter saat ini ({exportRows.length} baris).</p>
 )}

 <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Penyesuaian Stok"
 subtitle="Saldo pada Saldo Stok diperbarui otomatis oleh basis data setelah mutasi ADJUST tersimpan."
 footer={<><Button variant="outline" onClick={() => setAdjustOpen(false)}>Batal</Button><Button loading={adjustSaving} onClick={saveAdjust}>Simpan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Gudang" required><Select value={adjustForm.warehouse_id} onChange={(e: any) => setAdjustForm({ ...adjustForm, warehouse_id: e.target.value })} options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Field>
 <Field label="Item" required><Select value={adjustForm.item_id} onChange={(e: any) => setAdjustForm({ ...adjustForm, item_id: e.target.value })} options={items.map((i: any) => ({ value: i.id, label: `${i.code} · ${i.name}` }))} /></Field>
 <Field label="Qty Sistem"><Input value={num(qtySistemAdjust)} disabled /></Field>
 <Field label="Qty Fisik (hasil hitung)" required><Input type="number" min="0" value={adjustForm.qty_fisik} onChange={(e: any) => setAdjustForm({ ...adjustForm, qty_fisik: e.target.value })} /></Field>
 <Field label="Selisih" className="sm:col-span-2"><Input value={`${selisihAdjust > 0 ? '+' : ''}${num(selisihAdjust)}`} disabled className={selisihAdjust < 0 ? 'text-red-600' : selisihAdjust > 0 ? 'text-emerald-600' : ''} /></Field>
 <Field label="Alasan Penyesuaian" required className="sm:col-span-2"><Textarea value={adjustForm.note} onChange={(e: any) => setAdjustForm({ ...adjustForm, note: e.target.value })} placeholder="Wajib diisi, mis. hasil stock opname, barang rusak, selisih hitung fisik" /></Field>
 </div>
 </Modal>
 </div>
 )
}
