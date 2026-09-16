import React, { useEffect, useMemo, useState } from 'react'
import { chartColors } from '@/lib/theme'
import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
 PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, insert, nextDocNo } from '@/lib/db'
import supabase from '@/lib/supabase'
import { PageHeader, Card, CardHeader, KpiCard, DataTable, Badge, TableSkeleton, EmptyState, useToast, Button, Modal, Field, Select, Input, Textarea, Money, Plus } from '@/components/ui'
import { rupiah, num, tgl, todayISO } from '@/lib/format'
import { Boxes, AlertTriangle, Router, ClipboardCheck } from 'lucide-react'
import { CHART_COLORS } from '../lib/shared'

const emptyAdjust = { warehouse_id: '', item_id: '', qty_fisik: '', note: '' }
const emptyMr = { warehouse_id: '', purpose: '', item_id: '', qty_request: '' }

export default function DashboardInventory() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [dash, setDash] = useState<any[]>([])
 const [opnameVar, setOpnameVar] = useState<any | null>(null)
 const [kritis, setKritis] = useState<any[]>([])
 const [moves, setMoves] = useState<any[]>([])
 const [balances, setBalances] = useState<any[]>([])
 const [warehouses, setWarehouses] = useState<any[]>([])
 const [items, setItems] = useState<any[]>([])

 const [adjustOpen, setAdjustOpen] = useState(false)
 const [adjustForm, setAdjustForm] = useState<any>(emptyAdjust)
 const [adjustSaving, setAdjustSaving] = useState(false)

 const [mrOpen, setMrOpen] = useState(false)
 const [mrForm, setMrForm] = useState<any>(emptyMr)
 const [mrSaving, setMrSaving] = useState(false)

 useEffect(() => { load() }, [])

 async function load() {
 setLoading(true)
 try {
 const since = new Date(); since.setDate(since.getDate() - 30)
 const sinceISO = since.toISOString().slice(0, 10)
 const [dv, ov, sb, mv, wh, it] = await Promise.all([
 list('v_dashboard_inventory', {}).catch(() => []),
 list('v_stock_opname_variance', { order: { col: 'opname_date', asc: false }, limit: 1 }).catch(() => []),
 list('stock_balances', {
 select: 'id,qty,qty_reserved,warehouse_id,item_id,warehouse:warehouses!warehouse_id(name),item:item_catalog!item_id(code,name,min_stock,category,uom)',
 }),
 list('stock_movements', { select: 'move_date,move_type,qty', gte: { move_date: sinceISO }, order: { col: 'move_date', asc: true }, limit: 3000 }),
 list('warehouses', { select: 'id,name', order: { col: 'name', asc: true } }),
 list('item_catalog', { select: 'id,code,name,uom', eq: { is_active: true }, order: { col: 'name', asc: true } }),
 ])
 setDash(dv as any[])
 setOpnameVar((ov as any[])?.[0] ?? null)
 setKritis((sb as any[]).filter(r => r.item && Number(r.qty || 0) < Number(r.item.min_stock || 0)))
 setMoves(mv as any[])
 setBalances(sb as any[])
 setWarehouses(wh as any[])
 setItems(it as any[])
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat dashboard inventory', 'error') }
 finally { setLoading(false) }
 }

 function friendlyInvError(e: any, fallback: string) {
 const msg = e?.message ?? ''
 if (/row-level security|permission denied/i.test(msg)) return 'Gagal menyimpan — hak akses Anda pada modul Inventory tidak mengizinkan tindakan ini.'
 return msg || fallback
 }

 const qtySistemAdjust = useMemo(() => {
 const b = balances.find((r: any) => r.warehouse_id === adjustForm.warehouse_id && r.item_id === adjustForm.item_id)
 return b ? Number(b.qty || 0) : 0
 }, [balances, adjustForm.warehouse_id, adjustForm.item_id])
 const selisihAdjust = useMemo(() => (adjustForm.qty_fisik === '' ? 0 : Number(adjustForm.qty_fisik) - qtySistemAdjust), [adjustForm.qty_fisik, qtySistemAdjust])

 function openAdjust() { setAdjustForm(emptyAdjust); setAdjustOpen(true) }
 async function saveAdjust() {
 if (!adjustForm.warehouse_id || !adjustForm.item_id) { toast.push('Pilih gudang dan item', 'error'); return }
 if (adjustForm.qty_fisik === '' || Number(adjustForm.qty_fisik) < 0) { toast.push('Isi qty fisik hasil hitung', 'error'); return }
 if (!adjustForm.note?.trim()) { toast.push('Alasan penyesuaian wajib diisi', 'error'); return }
 const selisih = Number(adjustForm.qty_fisik) - qtySistemAdjust
 if (selisih === 0) { toast.push('Qty fisik sama dengan qty sistem — tidak ada yang perlu disesuaikan', 'error'); return }
 setAdjustSaving(true)
 try {
 const item = items.find((i: any) => i.id === adjustForm.item_id)
 const move_no = await nextDocNo(profile!.company_id, 'MOV')
 await insert('stock_movements', {
 company_id: profile!.company_id, move_no, move_date: todayISO(), move_type: 'ADJUST',
 item_id: adjustForm.item_id, qty: Math.abs(selisih), uom: item?.uom ?? null,
 from_warehouse_id: selisih < 0 ? adjustForm.warehouse_id : null,
 to_warehouse_id: selisih > 0 ? adjustForm.warehouse_id : null,
 note: adjustForm.note, created_by: profile!.id,
 })
 toast.push('Penyesuaian stok tersimpan, saldo diperbarui otomatis oleh basis data'); setAdjustOpen(false); load()
 } catch (e: any) { toast.push(friendlyInvError(e, 'Gagal menyimpan penyesuaian stok'), 'error') }
 finally { setAdjustSaving(false) }
 }

 function openMr() { setMrForm(emptyMr); setMrOpen(true) }
 async function saveMr() {
 if (!mrForm.warehouse_id) { toast.push('Pilih gudang tujuan permintaan', 'error'); return }
 if (!mrForm.item_id || !(Number(mrForm.qty_request) > 0)) { toast.push('Pilih item dan isi qty lebih dari 0', 'error'); return }
 setMrSaving(true)
 try {
 const mr_no = await nextDocNo(profile!.company_id, 'MR')
 const item = items.find((i: any) => i.id === mrForm.item_id)
 const mr = await insert<any>('material_requests', {
 company_id: profile!.company_id, mr_no, request_date: todayISO(), requester_id: profile!.id,
 warehouse_id: mrForm.warehouse_id, purpose: mrForm.purpose || null, status: 'diajukan', created_by: profile!.id,
 })
 const { error } = await supabase.from('material_request_items').insert({
 company_id: profile!.company_id, mr_id: mr.id, item_id: mrForm.item_id, qty_request: Number(mrForm.qty_request), uom: item?.uom ?? null, created_by: profile!.id,
 })
 if (error) throw error
 toast.push(`Permintaan ${mr_no} diajukan`); setMrOpen(false); load()
 } catch (e: any) { toast.push(friendlyInvError(e, 'Gagal menyimpan permintaan material'), 'error') }
 finally { setMrSaving(false) }
 }

 const nilaiPerGudang = useMemo(() =>
 dash.filter(r => r.metric === 'stock_value_by_warehouse').map(r => ({ gudang: r.bucket, nilai: Number(r.amount || 0) })),
 [dash])
 const totalNilaiStok = useMemo(() => nilaiPerGudang.reduce((s, r) => s + r.nilai, 0), [nilaiPerGudang])

 const serialByStatus = useMemo(() =>
 dash.filter(r => r.metric === 'serial_nte_by_status').map(r => ({ status: r.bucket, jumlah: Number(r.cnt || 0) })),
 [dash])
 const nteTersedia = serialByStatus.find(s => s.status === 'in_stock')?.jumlah ?? 0
 const nteTerpasang = serialByStatus.find(s => s.status === 'installed')?.jumlah ?? 0

 const pergerakan = useMemo(() => {
 const m = new Map<string, { tanggal: string; masuk: number; keluar: number }>()
 moves.forEach((r: any) => {
 const key = r.move_date
 if (!m.has(key)) m.set(key, { tanggal: key, masuk: 0, keluar: 0 })
 const row = m.get(key)!
 if (r.move_type === 'GR' || r.move_type === 'RETURN') row.masuk += Number(r.qty || 0)
 else if (r.move_type === 'ISSUE' || r.move_type === 'SCRAP' || r.move_type === 'TRANSFER') row.keluar += Number(r.qty || 0)
 })
 return Array.from(m.values()).sort((a, b) => a.tanggal.localeCompare(b.tanggal))
 .map(r => ({ ...r, label: tgl(r.tanggal) }))
 }, [moves])

 return (
 <div>
 <PageHeader title="Dashboard Inventory" subtitle="Ringkasan persediaan NTE, material non-NTE, dan pergerakan stok." />

 {can('INVENTORY', 'write') && (
 <div className="flex flex-wrap gap-2 mb-6">
 <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={openAdjust}>Penyesuaian Stok</Button>
 <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={openMr}>Permintaan Material</Button>
 </div>
 )}

 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 <KpiCard label="Nilai Stok Total" value={rupiah(totalNilaiStok, true)} icon={<Boxes size={16} />} tone="teal" />
 <KpiCard label="Item Di Bawah Stok Minimum" value={num(kritis.length)} icon={<AlertTriangle size={16} />} tone="red" />
 <KpiCard label="Unit NTE Tersedia / Terpasang" value={`${num(nteTersedia)} / ${num(nteTerpasang)}`} icon={<Router size={16} />} tone="amber" />
 <KpiCard label="Selisih Opname Terakhir" value={opnameVar ? rupiah(opnameVar.total_variance_value, true) : '-'}
 sub={opnameVar ? `${opnameVar.opname_no} · ${tgl(opnameVar.opname_date)}` : 'Belum ada opname'} icon={<ClipboardCheck size={16} />} tone={opnameVar && Number(opnameVar.total_variance_value) !== 0 ? 'red' : 'emerald'} />
 </div>

 <div className="grid lg:grid-cols-2 gap-5 mb-6">
 <Card>
 <CardHeader title="Nilai Stok per Gudang" />
 <div className="p-4 h-64">
 {loading ? <TableSkeleton rows={4} /> : nilaiPerGudang.length === 0 ? <EmptyState title="Belum ada data stok" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={nilaiPerGudang}>
 <CartesianGrid strokeDasharray="3 3" stroke={chartColors().grid} vertical={false} />
 <XAxis dataKey="gudang" tick={{ fontSize: 11 }} />
 <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => rupiah(v, true)} width={70} />
 <Tooltip formatter={(v: any) => rupiah(Number(v))} />
 <Bar dataKey="nilai" fill={CHART_COLORS()[0]} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 <Card>
 <CardHeader title="Sebaran Status Serial NTE" />
 <div className="p-4 h-64">
 {loading ? <TableSkeleton rows={4} /> : serialByStatus.length === 0 ? <EmptyState title="Belum ada serial NTE" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie data={serialByStatus} dataKey="jumlah" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={2}>
 {serialByStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS()[i % CHART_COLORS().length]} />)}
 </Pie>
 <Legend wrapperStyle={{ fontSize: 11 }} />
 <Tooltip />
 </PieChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 </div>

 <Card className="mb-6">
 <CardHeader title="Pergerakan Stok 30 Hari Terakhir" subtitle="Masuk: GR & Retur · Keluar: Issue, Scrap & Transfer" />
 <div className="p-4 h-64">
 {loading ? <TableSkeleton rows={4} /> : pergerakan.length === 0 ? <EmptyState title="Belum ada pergerakan stok 30 hari terakhir" /> : (
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={pergerakan}>
 <CartesianGrid strokeDasharray="3 3" stroke={chartColors().grid} vertical={false} />
 <XAxis dataKey="label" tick={{ fontSize: 10 }} />
 <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
 <Tooltip />
 <Legend wrapperStyle={{ fontSize: 11 }} />
 <Line type="monotone" dataKey="masuk" name="Masuk" stroke={CHART_COLORS()[6]} strokeWidth={2} dot={false} />
 <Line type="monotone" dataKey="keluar" name="Keluar" stroke={CHART_COLORS()[5]} strokeWidth={2} dot={false} />
 </LineChart>
 </ResponsiveContainer>)}
 </div>
 </Card>

 <Card className="overflow-hidden">
 <CardHeader title="Item Kritis Di Bawah Stok Minimum" subtitle={`${kritis.length} kombinasi item-gudang terdeteksi`} />
 <DataTable
 loading={loading}
 columns={[
 { key: 'code', header: 'Kode', width: '110px', render: (r: any) => r.item?.code },
 { key: 'name', header: 'Nama Item', render: (r: any) => r.item?.name },
 { key: 'category', header: 'Kategori', render: (r: any) => <Badge tone="slate">{r.item?.category}</Badge> },
 { key: 'gudang', header: 'Gudang', render: (r: any) => r.warehouse?.name },
 { key: 'qty', header: 'Qty Tersedia', align: 'right', render: (r: any) => <span className="text-red-600 font-semibold">{num(r.qty)} {r.item?.uom}</span> },
 { key: 'min', header: 'Stok Minimum', align: 'right', render: (r: any) => num(r.item?.min_stock) },
 ]}
 rows={kritis}
 searchable={false}
 pageSize={8}
 emptyTitle="Tidak ada item di bawah stok minimum"
 />
 </Card>
 <p className="text-caption text-ink-400 mt-4">Sumber data: v_dashboard_inventory, v_stock_opname_variance, stock_balances, stock_movements — ditarik {tgl(todayISO())}.</p>

 <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Penyesuaian Stok"
 subtitle="Saldo stok diperbarui otomatis oleh basis data setelah mutasi ADJUST tersimpan."
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

 <Modal open={mrOpen} onClose={() => setMrOpen(false)} title="Permintaan Material"
 footer={<><Button variant="outline" onClick={() => setMrOpen(false)}>Batal</Button><Button loading={mrSaving} onClick={saveMr}>Ajukan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Gudang Tujuan" required><Select value={mrForm.warehouse_id} onChange={(e: any) => setMrForm({ ...mrForm, warehouse_id: e.target.value })} options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Field>
 <Field label="Keperluan"><Input value={mrForm.purpose} onChange={(e: any) => setMrForm({ ...mrForm, purpose: e.target.value })} /></Field>
 <Field label="Item" required><Select value={mrForm.item_id} onChange={(e: any) => setMrForm({ ...mrForm, item_id: e.target.value })} options={items.map((i: any) => ({ value: i.id, label: `${i.code} · ${i.name}` }))} /></Field>
 <Field label="Qty Diminta" required><Input type="number" min="0" value={mrForm.qty_request} onChange={(e: any) => setMrForm({ ...mrForm, qty_request: e.target.value })} /></Field>
 </div>
 </Modal>
 </div>
 )
}
