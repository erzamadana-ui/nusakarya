import React, { useCallback, useEffect, useMemo, useState } from 'react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { list, update } from '@/lib/db'
import { tgl, tglJam, todayISO } from '@/lib/format'
import {
 PageHeader, FilterBar, KpiCard, DataTable, Modal, Drawer, Tabs, Timeline,
 Button, Field, Input, Textarea, Select, Badge, useToast, Plus,
} from '@/components/ui'
import { SERIAL_TABS } from '../lib/shared'

const AKSI_STATUS = [
 { value: 'issue_teknisi', label: 'Keluarkan ke Teknisi', to: 'issued' },
 { value: 'install', label: 'Pasang ke Pelanggan', to: 'installed' },
 { value: 'retur', label: 'Retur ke Gudang', to: 'returned' },
 { value: 'rusak', label: 'Tandai Rusak', to: 'damaged' },
]

export default function Nte() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [rows, setRows] = useState<any[]>([])
 const [items, setItems] = useState<any[]>([])
 const [warehouses, setWarehouses] = useState<any[]>([])
 const [employees, setEmployees] = useState<any[]>([])
 const [workOrders, setWorkOrders] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [tab, setTab] = useState('')

 const [bulkOpen, setBulkOpen] = useState(false)
 const [bulkForm, setBulkForm] = useState<any>({ item_id: '', warehouse_id: '', text: '' })
 const [bulkSaving, setBulkSaving] = useState(false)

 const [history, setHistory] = useState<any | null>(null)
 const [historyRows, setHistoryRows] = useState<any[]>([])
 const [historyLoading, setHistoryLoading] = useState(false)

 const [statusModal, setStatusModal] = useState<any | null>(null)
 const [statusForm, setStatusForm] = useState<any>({ aksi: 'issue_teknisi', to_employee_id: '', to_warehouse_id: '', customer_ref: '', note: '' })
 const [statusSaving, setStatusSaving] = useState(false)

 const [detailModal, setDetailModal] = useState<any | null>(null)
 const [detailForm, setDetailForm] = useState<any>({ mac_address: '', warranty_until: '', work_order_id: '', note: '' })
 const [detailSaving, setDetailSaving] = useState(false)

 const load = useCallback(async () => {
 setLoading(true)
 try {
 const [sr, it, w, em, wo] = await Promise.all([
 list('serials', {
 select: 'id,serial_no,mac_address,status,item_id,warehouse_id,holder_employee_id,customer_ref,work_order_id,install_date,warranty_until,principal,is_consignment,note,created_at,item:item_catalog!item_id(code,name,principal),warehouse:warehouses!warehouse_id(name),holder:employees!holder_employee_id(full_name)',
 order: { col: 'created_at', asc: false }, limit: 2000,
 }),
 list('item_catalog', { eq: { category: 'NTE' }, order: { col: 'name', asc: true } }),
 list('warehouses', { order: { col: 'name', asc: true } }),
 list('employees', { eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
 list('work_orders', { select: 'id,wo_no,title', order: { col: 'created_at', asc: false }, limit: 500 }),
 ])
 setRows((sr as any[]).map(r => ({ ...r, item_code: r.item?.code, item_name: r.item?.name, warehouse_name: r.warehouse?.name, holder_name: r.holder?.full_name })))
 setItems(it); setWarehouses(w); setEmployees(em); setWorkOrders(wo)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data NTE', 'error') }
 finally { setLoading(false) }
 }, [toast])
 useEffect(() => { load() }, [load])

 const filtered = useMemo(() => rows.filter(r => !tab || r.status === tab), [rows, tab])
 const counts = useMemo(() => {
 const m: Record<string, number> = {}
 rows.forEach(r => { m[r.status] = (m[r.status] || 0) + 1 })
 return m
 }, [rows])

 async function saveBulk() {
 if (!bulkForm.item_id || !bulkForm.warehouse_id) { toast.push('Pilih item dan gudang tujuan', 'error'); return }
 const lines = Array.from(new Set(String(bulkForm.text || '').split('\n').map((s: string) => s.trim()).filter(Boolean)))
 if (lines.length === 0) { toast.push('Masukkan minimal satu nomor seri', 'error'); return }
 setBulkSaving(true)
 const item = items.find(i => i.id === bulkForm.item_id)
 let ok = 0; let fail = 0
 for (const serial_no of lines) {
 const { error } = await supabase.from('serials').insert({
 company_id: profile!.company_id, item_id: bulkForm.item_id, warehouse_id: bulkForm.warehouse_id,
 serial_no, status: 'in_stock', principal: item?.principal ?? null, is_consignment: !!item?.is_consignment,
 created_by: profile!.id,
 })
 if (error) fail++; else ok++
 }
 setBulkSaving(false)
 toast.push(`${ok} serial berhasil ditambahkan${fail ? `, ${fail} gagal (kemungkinan duplikat)` : ''}`, fail ? 'info' : 'success')
 if (ok > 0) { setBulkOpen(false); setBulkForm({ item_id: '', warehouse_id: '', text: '' }); load() }
 }

 async function openHistory(row: any) {
 setHistory(row); setHistoryLoading(true)
 try {
 const h = await list('serial_movements', { eq: { serial_id: row.id }, order: { col: 'moved_at', asc: false }, limit: 100 })
 setHistoryRows(h)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat riwayat', 'error') }
 finally { setHistoryLoading(false) }
 }

 function openStatus(row: any) {
 setStatusForm({ aksi: 'issue_teknisi', to_employee_id: '', to_warehouse_id: row.warehouse_id ?? '', customer_ref: '', note: '' })
 setStatusModal(row)
 }

 async function saveStatus() {
 if (!statusModal) return
 const aksi = AKSI_STATUS.find(a => a.value === statusForm.aksi)!
 if (aksi.value === 'issue_teknisi' && !statusForm.to_employee_id) { toast.push('Pilih teknisi penerima', 'error'); return }
 if (aksi.value === 'install' && !statusForm.customer_ref) { toast.push('Isi referensi pelanggan', 'error'); return }
 if (aksi.value === 'retur' && !statusForm.to_warehouse_id) { toast.push('Pilih gudang tujuan retur', 'error'); return }
 setStatusSaving(true)
 try {
 const from_status = statusModal.status
 const patch: any = { status: aksi.to }
 if (aksi.value === 'issue_teknisi') { patch.holder_employee_id = statusForm.to_employee_id; patch.warehouse_id = null }
 if (aksi.value === 'install') { patch.customer_ref = statusForm.customer_ref; patch.install_date = todayISO() }
 if (aksi.value === 'retur') { patch.warehouse_id = statusForm.to_warehouse_id; patch.holder_employee_id = null; patch.customer_ref = null }
 await update('serials', statusModal.id, patch)
 await supabase.from('serial_movements').insert({
 company_id: profile!.company_id, serial_id: statusModal.id, move_type: aksi.value,
 from_status, to_status: aksi.to,
 from_warehouse_id: statusModal.warehouse_id ?? null,
 to_warehouse_id: aksi.value === 'retur' ? statusForm.to_warehouse_id : null,
 to_employee_id: aksi.value === 'issue_teknisi' ? statusForm.to_employee_id : null,
 note: statusForm.note || null, moved_by: profile!.id, created_by: profile!.id,
 })
 toast.push('Status serial diperbarui')
 setStatusModal(null); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status serial', 'error') }
 finally { setStatusSaving(false) }
 }

 function openDetail(row: any) {
 setDetailForm({ mac_address: row.mac_address ?? '', warranty_until: row.warranty_until ?? '', work_order_id: row.work_order_id ?? '', note: row.note ?? '' })
 setDetailModal(row)
 }

 async function saveDetail() {
 if (!detailModal) return
 setDetailSaving(true)
 try {
 await update('serials', detailModal.id, {
 mac_address: detailForm.mac_address || null, warranty_until: detailForm.warranty_until || null,
 work_order_id: detailForm.work_order_id || null, note: detailForm.note || null,
 })
 toast.push('Detail serial diperbarui')
 setDetailModal(null); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan detail serial', 'error') }
 finally { setDetailSaving(false) }
 }

 const columns = [
 { key: 'serial_no', header: 'Nomor Seri' },
 { key: 'mac_address', header: 'MAC Address' },
 { key: 'item_name', header: 'Item', render: (r: any) => <span>{r.item_code} · {r.item_name}</span> },
 { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
 { key: 'warehouse_name', header: 'Gudang', render: (r: any) => r.warehouse_name ?? '-' },
 { key: 'holder_name', header: 'Pemegang', render: (r: any) => r.holder_name ?? '-' },
 { key: 'customer_ref', header: 'Pelanggan', render: (r: any) => r.customer_ref ?? '-' },
 { key: 'install_date', header: 'Tgl Pasang', render: (r: any) => tgl(r.install_date) },
 { key: 'is_consignment', header: 'Konsinyasi', align: 'center' as const, render: (r: any) => r.is_consignment ? <Badge tone="amber">{r.principal || 'Konsinyasi'}</Badge> : '-' },
 {
 key: 'aksi', header: '', sortable: false, width: '260px', render: (r: any) => (
 <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
 <Button size="sm" variant="outline" onClick={() => openHistory(r)}>Riwayat</Button>
 {can('INVENTORY', 'write') && <Button size="sm" variant="outline" onClick={() => openDetail(r)}>Detail</Button>}
 {can('INVENTORY', 'write') && !['scrapped', 'lost'].includes(r.status) && <Button size="sm" onClick={() => openStatus(r)}>Ubah Status</Button>}
 </div>
 ),
 },
 ]

 return (
 <div>
 <PageHeader title="Inventory NTE (Serial)" subtitle="Pelacakan unit ONT/STB/router ber-nomor seri, termasuk unit konsinyasi principal."
 actions={can('INVENTORY', 'write') && <Button icon={<Plus size={16} />} onClick={() => setBulkOpen(true)}>Input Serial Massal</Button>} />

 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
 <KpiCard label="Total Unit NTE" value={rows.length} tone="teal" />
 <KpiCard label="Di Gudang" value={counts['in_stock'] ?? 0} tone="emerald" />
 <KpiCard label="Pada Teknisi" value={counts['issued'] ?? 0} tone="amber" />
 <KpiCard label="Terpasang" value={counts['installed'] ?? 0} />
 </div>

 <Tabs className="mb-4" value={tab} onChange={setTab}
 tabs={SERIAL_TABS.map(t => ({ value: t.value, label: t.label, count: t.value ? (counts[t.value] ?? 0) : rows.length }))} />

 <DataTable columns={columns} rows={filtered} loading={loading} searchable searchKeys={['serial_no', 'mac_address', 'customer_ref']}
 exportName="serial-nte" emptyTitle="Belum ada serial NTE" emptyMessage="Gunakan Input Serial Massal untuk menambahkan unit." />

 <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} size="lg" title="Input Serial Massal"
 subtitle="Satu nomor seri per baris. Duplikat akan otomatis dilewati oleh sistem."
 footer={<><Button variant="outline" onClick={() => setBulkOpen(false)}>Batal</Button>
 <Button loading={bulkSaving} onClick={saveBulk}>Simpan Semua</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4 mb-4">
 <Field label="Item NTE" required><Select value={bulkForm.item_id} onChange={(e: any) => setBulkForm({ ...bulkForm, item_id: e.target.value })}
 options={items.map(i => ({ value: i.id, label: `${i.code} · ${i.name}` }))} /></Field>
 <Field label="Gudang Tujuan" required><Select value={bulkForm.warehouse_id} onChange={(e: any) => setBulkForm({ ...bulkForm, warehouse_id: e.target.value })}
 options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Field>
 </div>
 <Field label="Daftar Nomor Seri" hint="Contoh: ONT2024000123 (satu per baris)">
 <Textarea rows={10} value={bulkForm.text} onChange={(e: any) => setBulkForm({ ...bulkForm, text: e.target.value })} className="min-h-[220px] font-mono" />
 </Field>
 </Modal>

 <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title="Detail Serial" subtitle={detailModal?.serial_no}
 footer={<><Button variant="outline" onClick={() => setDetailModal(null)}>Batal</Button>
 <Button loading={detailSaving} onClick={saveDetail}>Simpan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="MAC Address"><Input value={detailForm.mac_address} onChange={(e: any) => setDetailForm({ ...detailForm, mac_address: e.target.value })} placeholder="00:1A:2B:3C:4D:5E" /></Field>
 <Field label="Garansi Sampai"><Input type="date" value={detailForm.warranty_until} onChange={(e: any) => setDetailForm({ ...detailForm, warranty_until: e.target.value })} /></Field>
 <Field label="Tautan Work Order" className="sm:col-span-2"><Select value={detailForm.work_order_id} onChange={(e: any) => setDetailForm({ ...detailForm, work_order_id: e.target.value })}
 options={workOrders.map(w => ({ value: w.id, label: w.wo_no }))} /></Field>
 <Field label="Catatan" className="sm:col-span-2"><Textarea value={detailForm.note} onChange={(e: any) => setDetailForm({ ...detailForm, note: e.target.value })} /></Field>
 </div>
 </Modal>

 <Modal open={!!statusModal} onClose={() => setStatusModal(null)} title="Ubah Status Serial" subtitle={statusModal?.serial_no}
 footer={<><Button variant="outline" onClick={() => setStatusModal(null)}>Batal</Button>
 <Button loading={statusSaving} onClick={saveStatus}>Simpan</Button></>}>
 <div className="space-y-4">
 <Field label="Jenis Aksi"><Select value={statusForm.aksi} onChange={(e: any) => setStatusForm({ ...statusForm, aksi: e.target.value })}
 options={AKSI_STATUS.map(a => ({ value: a.value, label: a.label }))} /></Field>
 {statusForm.aksi === 'issue_teknisi' && (
 <Field label="Teknisi Penerima" required><Select value={statusForm.to_employee_id} onChange={(e: any) => setStatusForm({ ...statusForm, to_employee_id: e.target.value })}
 options={employees.map(e => ({ value: e.id, label: e.full_name }))} /></Field>
 )}
 {statusForm.aksi === 'install' && (
 <Field label="Referensi Pelanggan" required><Input value={statusForm.customer_ref} onChange={(e: any) => setStatusForm({ ...statusForm, customer_ref: e.target.value })} placeholder="No. Pelanggan / Nama Pelanggan" /></Field>
 )}
 {statusForm.aksi === 'retur' && (
 <Field label="Gudang Tujuan Retur" required><Select value={statusForm.to_warehouse_id} onChange={(e: any) => setStatusForm({ ...statusForm, to_warehouse_id: e.target.value })}
 options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Field>
 )}
 <Field label="Catatan"><Input value={statusForm.note} onChange={(e: any) => setStatusForm({ ...statusForm, note: e.target.value })} /></Field>
 </div>
 </Modal>

 <Drawer open={!!history} onClose={() => setHistory(null)} title={`Riwayat — ${history?.serial_no ?? ''}`}>
 {historyLoading ? <p className="text-body text-ink-400">Memuat…</p> : historyRows.length === 0 ? (
 <p className="text-body text-ink-400">Belum ada riwayat perpindahan untuk serial ini.</p>
 ) : (
 <Timeline items={historyRows.map((h: any) => ({
 title: `${h.from_status ?? '-'} → ${h.to_status ?? '-'}`,
 note: h.note || AKSI_STATUS.find(a => a.value === h.move_type)?.label || h.move_type,
 time: tglJam(h.moved_at),
 }))} />
 )}
 </Drawer>
 </div>
 )
}
