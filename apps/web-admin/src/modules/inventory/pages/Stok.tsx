import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { list } from '@/lib/db'
import { rupiah, num } from '@/lib/format'
import { PageHeader, FilterBar, KpiCard, DataTable, Badge, Field, Select, useToast } from '@/components/ui'
import { ITEM_CATEGORY } from '../lib/shared'

export default function Stok() {
 const toast = useToast()
 const [rows, setRows] = useState<any[]>([])
 const [warehouses, setWarehouses] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [fWarehouse, setFWarehouse] = useState('')
 const [fCategory, setFCategory] = useState('')

 const load = useCallback(async () => {
 setLoading(true)
 try {
 const [sb, w] = await Promise.all([
 list('stock_balances', {
 select: 'id,qty,qty_reserved,avg_price,warehouse_id,item_id,warehouse:warehouses!warehouse_id(id,name),item:item_catalog!item_id(id,code,name,category,uom,min_stock)',
 order: { col: 'updated_at', asc: false },
 }),
 list('warehouses', { order: { col: 'name', asc: true } }),
 ])
 setRows((sb as any[]).map(r => ({ ...r, item_code: r.item?.code, item_name: r.item?.name, warehouse_name: r.warehouse?.name })))
 setWarehouses(w)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat saldo stok', 'error') }
 finally { setLoading(false) }
 }, [toast])
 useEffect(() => { load() }, [load])

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
 ]

 return (
 <div>
 <PageHeader title="Saldo Stok" subtitle="Saldo stok berjalan per item dan gudang." />

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
 </div>
 )
}
