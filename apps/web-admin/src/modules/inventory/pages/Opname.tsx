import React, { useCallback, useEffect, useState } from 'react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import { rupiah, num, pct, tgl, todayISO } from '@/lib/format'
import {
 PageHeader, KpiCard, DataTable, Modal, Stepper, Card, CardHeader,
 Button, Field, Input, Select, Badge, useToast, Plus,
} from '@/components/ui'
import { OPNAME_STATUS, OPNAME_STEPS, opnameStepIndex } from '../lib/shared'

export default function Opname() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [rows, setRows] = useState<any[]>([])
 const [warehouses, setWarehouses] = useState<any[]>([])
 const [loading, setLoading] = useState(true)

 const [modalOpen, setModalOpen] = useState(false)
 const [form, setForm] = useState<any>({ warehouse_id: '', opname_date: todayISO() })
 const [creating, setCreating] = useState(false)

 const [selected, setSelected] = useState<any | null>(null)
 const [lines, setLines] = useState<any[]>([])
 const [physical, setPhysical] = useState<Record<string, string>>({})
 const [priceMap, setPriceMap] = useState<Record<string, number>>({})
 const [busy, setBusy] = useState(false)

 const load = useCallback(async () => {
 setLoading(true)
 try {
 const [op, w] = await Promise.all([
 list('stock_opnames', { select: 'id,opname_no,opname_date,warehouse_id,status,note,warehouse:warehouses!warehouse_id(name)', order: { col: 'opname_date', asc: false }, limit: 500 }),
 list('warehouses', { order: { col: 'name', asc: true } }),
 ])
 setRows((op as any[]).map(r => ({ ...r, warehouse_name: r.warehouse?.name })))
 setWarehouses(w)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat stock opname', 'error') }
 finally { setLoading(false) }
 }, [toast])
 useEffect(() => { load() }, [load])

 async function createOpname() {
 if (!form.warehouse_id) { toast.push('Pilih gudang', 'error'); return }
 setCreating(true)
 try {
 const opname_no = await nextDocNo(profile!.company_id, 'OPN')
 const op = await insert<any>('stock_opnames', {
 company_id: profile!.company_id, opname_no, opname_date: form.opname_date, warehouse_id: form.warehouse_id,
 status: 'draft', pic_id: profile!.id, created_by: profile!.id,
 })
 const balances = await list('stock_balances', { eq: { warehouse_id: form.warehouse_id } })
 if (balances.length > 0) {
 const { error } = await supabase.from('stock_opname_lines').insert(
 balances.map((b: any) => ({ company_id: profile!.company_id, opname_id: op.id, item_id: b.item_id, qty_system: b.qty, created_by: profile!.id }))
 )
 if (error) throw error
 }
 toast.push(`Opname ${opname_no} dibuat, ${balances.length} baris item ditarik dari sistem`)
 setModalOpen(false); setForm({ warehouse_id: '', opname_date: todayISO() }); load()
 openDetail({ ...op, warehouse_name: warehouses.find(w => w.id === form.warehouse_id)?.name })
 } catch (e: any) { toast.push(e.message ?? 'Gagal membuat opname', 'error') }
 finally { setCreating(false) }
 }

 async function openDetail(row: any) {
 setSelected(row)
 try {
 const [ln, bal] = await Promise.all([
 list('stock_opname_lines', { eq: { opname_id: row.id }, select: 'id,item_id,qty_system,qty_physical,variance,variance_value,reason,item:item_catalog!item_id(code,name,uom)' }),
 list('stock_balances', { eq: { warehouse_id: row.warehouse_id }, select: 'item_id,avg_price' }),
 ])
 setLines((ln as any[]).map(r => ({ ...r, item_code: r.item?.code, item_name: r.item?.name, uom: r.item?.uom })))
 const pm: Record<string, number> = {}
 ;(bal as any[]).forEach(b => { pm[b.item_id] = Number(b.avg_price || 0) })
 setPriceMap(pm)
 const ph: Record<string, string> = {}
 ;(ln as any[]).forEach(l => { ph[l.id] = l.qty_physical != null ? String(l.qty_physical) : String(l.qty_system ?? 0) })
 setPhysical(ph)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat baris opname', 'error') }
 }

 async function savePhysical(finish: boolean) {
 if (!selected) return
 setBusy(true)
 try {
 await Promise.all(lines.map(l => {
 const qp = Number(physical[l.id] ?? l.qty_system ?? 0)
 const variance = qp - Number(l.qty_system || 0)
 const variance_value = variance * (priceMap[l.item_id] ?? 0)
 return update('stock_opname_lines', l.id, { qty_physical: qp, variance, variance_value })
 }))
 const nextStatus = finish ? 'selesai' : 'berjalan'
 await update('stock_opnames', selected.id, { status: nextStatus })
 toast.push(finish ? 'Perhitungan fisik selesai, siap diajukan persetujuan' : 'Perhitungan fisik tersimpan')
 const updated = { ...selected, status: nextStatus }
 setSelected(updated); load(); openDetail(updated)
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan perhitungan fisik', 'error') }
 finally { setBusy(false) }
 }

 async function startCounting() {
 if (!selected) return
 setBusy(true)
 try { await update('stock_opnames', selected.id, { status: 'berjalan' }); setSelected({ ...selected, status: 'berjalan' }); load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal memulai opname', 'error') }
 finally { setBusy(false) }
 }

 async function approve() {
 if (!selected) return
 setBusy(true)
 try { await update('stock_opnames', selected.id, { status: 'disetujui' }); toast.push('Opname disetujui'); setSelected({ ...selected, status: 'disetujui' }); load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menyetujui opname', 'error') }
 finally { setBusy(false) }
 }

 const totalVarianceValue = lines.reduce((s, l) => {
 const qp = Number(physical[l.id] ?? l.qty_physical ?? l.qty_system ?? 0)
 const v = qp - Number(l.qty_system || 0)
 return s + v * (priceMap[l.item_id] ?? 0)
 }, 0)
 const countedLines = lines.filter(l => physical[l.id] !== undefined && physical[l.id] !== '')
 const matchLines = countedLines.filter(l => Number(physical[l.id]) === Number(l.qty_system || 0))
 const akurasi = countedLines.length ? (matchLines.length / countedLines.length) * 100 : 0
 const editable = selected && ['draft', 'berjalan'].includes(selected.status)

 if (selected) {
 return (
 <div>
 <PageHeader title={selected.opname_no} subtitle={`Gudang ${selected.warehouse_name} · ${tgl(selected.opname_date)}`}
 breadcrumb={['Stock Opname']}
 actions={<Button variant="outline" onClick={() => setSelected(null)}>Kembali ke Daftar</Button>} />

 <div className="mb-5"><Stepper steps={OPNAME_STEPS} current={opnameStepIndex(selected.status)} /></div>

 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
 <KpiCard label="Jumlah Item" value={num(lines.length)} />
 <KpiCard label="Sudah Dihitung" value={num(countedLines.length)} />
 <KpiCard label="Akurasi Opname" value={pct(akurasi)} tone={akurasi >= 95 ? 'teal' : 'amber'} />
 <KpiCard label="Nilai Selisih" value={rupiah(totalVarianceValue, true)} tone={totalVarianceValue === 0 ? 'emerald' : 'red'} />
 </div>

 <Card className="overflow-hidden">
 <CardHeader title="Baris Item" subtitle="Qty sistem ditarik otomatis. Isi qty fisik hasil hitung di lapangan." />
 <DataTable searchable={false} pageSize={100} rows={lines}
 columns={[
 { key: 'item_name', header: 'Item', render: (r: any) => <span>{r.item_code} · {r.item_name}</span> },
 { key: 'qty_system', header: 'Qty Sistem', align: 'right', render: (r: any) => `${num(r.qty_system)} ${r.uom ?? ''}` },
 {
 key: 'qty_physical', header: 'Qty Fisik', align: 'right', render: (r: any) => editable ? (
 <input type="number" value={physical[r.id] ?? ''} onChange={e => setPhysical({ ...physical, [r.id]: e.target.value })}
 className="w-28 h-8 px-2 text-right rounded-sm border border-ink-200 bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-400" />
 ) : num(r.qty_physical),
 },
 {
 key: 'variance', header: 'Selisih', align: 'right', render: (r: any) => {
 const qp = Number(physical[r.id] ?? r.qty_physical ?? r.qty_system ?? 0)
 const v = qp - Number(r.qty_system || 0)
 return <span className={v !== 0 ? 'text-red-600 font-semibold' : ''}>{num(v)}</span>
 },
 },
 {
 key: 'variance_value', header: 'Nilai Selisih', align: 'right', render: (r: any) => {
 const qp = Number(physical[r.id] ?? r.qty_physical ?? r.qty_system ?? 0)
 const v = qp - Number(r.qty_system || 0)
 return rupiah(v * (priceMap[r.item_id] ?? 0))
 },
 },
 ]} emptyTitle="Tidak ada item pada gudang ini" />
 </Card>

 {can('INVENTORY', 'write') && (
 <div className="flex justify-end gap-2 mt-4">
 {selected.status === 'draft' && <Button loading={busy} onClick={startCounting}>Mulai Hitung Fisik</Button>}
 {selected.status === 'berjalan' && <>
 <Button variant="outline" loading={busy} onClick={() => savePhysical(false)}>Simpan Sementara</Button>
 <Button loading={busy} onClick={() => savePhysical(true)}>Selesaikan Perhitungan</Button>
 </>}
 {selected.status === 'selesai' && can('INVENTORY', 'approve') && <Button loading={busy} onClick={approve}>Ajukan & Setujui</Button>}
 </div>
 )}
 </div>
 )
 }

 return (
 <div>
 <PageHeader title="Stock Opname" subtitle="Penghitungan fisik stok per gudang dan rekonsiliasi selisih terhadap saldo sistem."
 actions={can('INVENTORY', 'write') && <Button icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>Buat Opname</Button>} />

 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
 {OPNAME_STATUS.map(s => <KpiCard key={s} label={s} value={num(rows.filter(r => r.status === s).length)} />)}
 </div>

 <DataTable columns={[
 { key: 'opname_no', header: 'No. Opname' },
 { key: 'opname_date', header: 'Tanggal', render: (r: any) => tgl(r.opname_date) },
 { key: 'warehouse_name', header: 'Gudang' },
 { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
 ]} rows={rows} loading={loading} onRowClick={openDetail} searchable searchKeys={['opname_no', 'warehouse_name']}
 emptyTitle="Belum ada stock opname" emptyMessage="Buat opname baru untuk mulai penghitungan fisik." />

 <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Buat Stock Opname"
 footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
 <Button loading={creating} onClick={createOpname}>Buat & Tarik Saldo Sistem</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Gudang" required><Select value={form.warehouse_id} onChange={(e: any) => setForm({ ...form, warehouse_id: e.target.value })}
 options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Field>
 <Field label="Tanggal Opname"><Input type="date" value={form.opname_date} onChange={(e: any) => setForm({ ...form, opname_date: e.target.value })} /></Field>
 </div>
 </Modal>
 </div>
 )
}
