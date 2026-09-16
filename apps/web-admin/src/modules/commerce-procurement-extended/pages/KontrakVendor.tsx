import React, { useEffect, useMemo, useState } from 'react'
import { Upload, AlertTriangle, Paperclip } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, uploadFile, signedUrl, nextDocNo } from '@/lib/db'
import { rupiah, tgl, pct, todayISO } from '@/lib/format'
import {
 PageHeader, Card, CardHeader, KpiCard, DataTable, Badge, Button, Modal, Drawer, ConfirmDialog,
 Field, Input, Select, Textarea, Money, Progress, useToast, TableSkeleton, EmptyState, Desc, Plus,
} from '@/components/ui'
import { VENDOR_CONTRACT_TYPE_OPTIONS, VENDOR_CONTRACT_STATUS_OPTIONS, VC_EXPIRY_WARNING_DAYS, VC_CEILING_WARNING_PERCENT } from '../lib/constants'
import { daysUntil } from '../lib/helpers'

function emptyForm() {
 return {
 contract_no: '', vendor_id: '', contract_type: 'rangka', start_date: todayISO(), end_date: '',
 ceiling_value: 0, used_value: 0, payment_term_days: 30, status: 'draft', file_url: '', note: '',
 }
}

export default function KontrakVendor() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const writable = can('PROCUREMENT', 'write')
 const approver = can('PROCUREMENT', 'approve')

 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [vendors, setVendors] = useState<any[]>([])
 const [pos, setPos] = useState<any[]>([])

 const [modal, setModal] = useState(false)
 const [editing, setEditing] = useState<any>(null)
 const [form, setForm] = useState<any>(emptyForm())
 const [saving, setSaving] = useState(false)
 const [uploading, setUploading] = useState(false)
 const [delId, setDelId] = useState<string | null>(null)
 const [detail, setDetail] = useState<any>(null)

 const vendorMap = useMemo(() => Object.fromEntries(vendors.map(v => [v.id, v.name])), [vendors])
 const typeLabel = (t: string) => VENDOR_CONTRACT_TYPE_OPTIONS.find(o => o.value === t)?.label ?? t

 const load = async () => {
 setLoading(true)
 try {
 const [vc, v, po] = await Promise.all([
 list('vendor_contracts', { order: { col: 'created_at', asc: false }, limit: 1000 }),
 list('vendors', { select: 'id,name', order: { col: 'name', asc: true }, limit: 1000 }),
 list('purchase_orders', { select: 'id,po_no,vendor_id,po_date,total,status', limit: 3000 }),
 ])
 setRows(vc); setVendors(v); setPos(po)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat kontrak vendor', 'error') }
 finally { setLoading(false) }
 }
 useEffect(() => { load() }, [])

 const usagePercent = (r: any) => (Number(r.ceiling_value) > 0 ? (Number(r.used_value) / Number(r.ceiling_value)) * 100 : 0)

 /* ---------------- Peringatan ---------------- */
 const expiringSoon = useMemo(() => rows.filter(r => {
 if (r.status !== 'aktif') return false
 const d = daysUntil(r.end_date)
 return d != null && d >= 0 && d < VC_EXPIRY_WARNING_DAYS
 }).sort((a, b) => (daysUntil(a.end_date) ?? 0) - (daysUntil(b.end_date) ?? 0)), [rows])
 const ceilingCritical = useMemo(() => rows.filter(r => r.status === 'aktif' && usagePercent(r) >= VC_CEILING_WARNING_PERCENT)
 .sort((a, b) => usagePercent(b) - usagePercent(a)), [rows])

 const kpi = useMemo(() => {
 const active = rows.filter(r => r.status === 'aktif')
 return {
 activeCount: active.length,
 totalCeiling: active.reduce((s, r) => s + Number(r.ceiling_value || 0), 0),
 totalUsed: active.reduce((s, r) => s + Number(r.used_value || 0), 0),
 expiringCount: expiringSoon.length,
 criticalCount: ceilingCritical.length,
 }
 }, [rows, expiringSoon, ceilingCritical])

 /* ---------------- CRUD ---------------- */
 const openAdd = async () => {
 setEditing(null)
 let no = ''
 try { no = await nextDocNo(profile!.company_id, 'VC') } catch { /* biarkan kosong bila gagal */ }
 setForm({ ...emptyForm(), contract_no: no })
 setModal(true)
 }
 const openEdit = (row: any) => { setEditing(row); setForm({ ...emptyForm(), ...row }); setModal(true) }

 const handleUpload = async (file: File) => {
 if (!file) return
 setUploading(true)
 try { const path = await uploadFile(profile!.company_id, 'kontrak-vendor', file); setForm((f: any) => ({ ...f, file_url: path })); toast.push('Berkas terunggah', 'success') }
 catch (e: any) { toast.push(e.message ?? 'Gagal mengunggah berkas', 'error') }
 finally { setUploading(false) }
 }

 const save = async () => {
 if (!form.contract_no || !form.vendor_id || !form.start_date) { toast.push('No kontrak, vendor, dan tanggal mulai wajib diisi', 'error'); return }
 if (form.end_date && form.end_date < form.start_date) { toast.push('Tanggal berakhir tidak boleh mendahului tanggal mulai', 'error'); return }
 if (Number(form.ceiling_value) < 0 || Number(form.used_value) < 0) { toast.push('Nilai plafon dan terpakai tidak boleh negatif', 'error'); return }
 setSaving(true)
 try {
 const payload = {
 contract_no: form.contract_no, vendor_id: form.vendor_id, contract_type: form.contract_type,
 start_date: form.start_date || null, end_date: form.end_date || null, ceiling_value: Number(form.ceiling_value) || 0,
 used_value: Number(form.used_value) || 0, payment_term_days: Number(form.payment_term_days) || 30,
 status: form.status, file_url: form.file_url || null, note: form.note || '',
 }
 if (editing) { await update('vendor_contracts', editing.id, payload); toast.push('Kontrak vendor diperbarui', 'success') }
 else { await insert('vendor_contracts', { ...payload, company_id: profile!.company_id, created_by: profile!.id }); toast.push('Kontrak vendor ditambahkan', 'success') }
 setModal(false); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan kontrak vendor', 'error') }
 finally { setSaving(false) }
 }

 const doDelete = async () => {
 if (!delId) return
 try { await remove('vendor_contracts', delId); toast.push('Kontrak vendor dihapus', 'success'); load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus kontrak vendor', 'error') }
 }

 /* ---------------- PO dalam periode kontrak (untuk drawer detail) ---------------- */
 const posInPeriod = useMemo(() => {
 if (!detail) return []
 return pos.filter(p => p.vendor_id === detail.vendor_id
 && (!detail.start_date || p.po_date >= detail.start_date)
 && (!detail.end_date || p.po_date <= detail.end_date)
 && p.status !== 'batal')
 }, [detail, pos])
 const posTotal = posInPeriod.reduce((s, p) => s + Number(p.total || 0), 0)
 const selisih = detail ? posTotal - Number(detail.used_value || 0) : 0

 const columns = [
 { key: 'contract_no', header: 'No Kontrak', width: '150px' },
 { key: 'vendor_id', header: 'Vendor', render: (r: any) => vendorMap[r.vendor_id] ?? '-' },
 { key: 'contract_type', header: 'Jenis', render: (r: any) => typeLabel(r.contract_type) },
 { key: 'periode', header: 'Periode', sortable: false, render: (r: any) => `${tgl(r.start_date)} – ${tgl(r.end_date)}` },
 { key: 'ceiling_value', header: 'Plafon', align: 'right' as const, render: (r: any) => rupiah(r.ceiling_value) },
 {
 key: 'used_value', header: 'Terpakai', width: '180px', sortable: false, render: (r: any) => {
 const p = usagePercent(r); const critical = p >= VC_CEILING_WARNING_PERCENT
 return <div>
 <div className="flex items-center justify-between text-caption mb-1"><span className="tabular">{rupiah(r.used_value, true)}</span><span className={critical ? 'text-red-600 font-medium' : 'text-ink-500'}>{pct(p, 0)}</span></div>
 <Progress value={p} tone={critical ? 'danger' : p >= 70 ? 'warning' : 'primary'} height={6} />
 {critical && <Badge tone="red" className="mt-1">Plafon &gt; 90%</Badge>}
 </div>
 },
 },
 { key: 'payment_term_days', header: 'Termin', align: 'right' as const, render: (r: any) => `${r.payment_term_days ?? '-'} hari` },
 { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
 ]

 return (
 <div>
 <PageHeader title="Kontrak Rangka Vendor" subtitle="Kontrak rangka / blanket PO / sewa / jasa berkala — pantau plafon terpakai dan masa berlaku."
 actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Kontrak</Button>} />

 {loading ? <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">{Array.from({ length: 5 }).map((_, i) => <Card key={i} className="p-4"><TableSkeleton rows={2} /></Card>)}</div> : (
 <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
 <KpiCard label="Kontrak Aktif" value={String(kpi.activeCount)} tone="teal" />
 <KpiCard label="Total Plafon" value={rupiah(kpi.totalCeiling, true)} tone="blue" />
 <KpiCard label="Total Terpakai" value={rupiah(kpi.totalUsed, true)} tone="amber" />
 <KpiCard label="Segera Berakhir" value={String(kpi.expiringCount)} sub={`< ${VC_EXPIRY_WARNING_DAYS} hari`} tone="orange" />
 <KpiCard label="Plafon Kritis" value={String(kpi.criticalCount)} sub="&gt; 90% terpakai" tone="red" />
 </div>
 )}
 <p className="text-caption text-ink-400 -mt-3 mb-5">Sumber data: vendor_contracts — ditarik {tgl(todayISO())}.</p>

 {(expiringSoon.length > 0 || ceilingCritical.length > 0) && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
 <Card className={expiringSoon.length ? 'border-orange-300 dark:border-orange-800' : ''}>
 <CardHeader title="Kontrak Akan Berakhir" subtitle={`Sisa masa berlaku < ${VC_EXPIRY_WARNING_DAYS} hari`} action={<AlertTriangle size={16} className="text-orange-500" />} />
 <div className="p-4 space-y-2">
 {expiringSoon.length === 0 ? <EmptyState title="Tidak ada kontrak yang segera berakhir" /> : expiringSoon.map(r => (
 <div key={r.id} onClick={() => setDetail(r)} className="flex items-center justify-between gap-2 text-body cursor-pointer hover:text-primary-600">
 <span>{r.contract_no} — {vendorMap[r.vendor_id]}</span>
 <Badge tone="orange">{Math.max(0, daysUntil(r.end_date) ?? 0)} hari lagi</Badge>
 </div>))}
 </div>
 </Card>
 <Card className={ceilingCritical.length ? 'border-red-300 dark:border-red-800' : ''}>
 <CardHeader title="Plafon Hampir Habis" subtitle={`Terpakai ≥ ${VC_CEILING_WARNING_PERCENT}% dari plafon`} action={<AlertTriangle size={16} className="text-red-500" />} />
 <div className="p-4 space-y-2">
 {ceilingCritical.length === 0 ? <EmptyState title="Tidak ada kontrak dengan plafon kritis" /> : ceilingCritical.map(r => (
 <div key={r.id} onClick={() => setDetail(r)} className="flex items-center justify-between gap-2 text-body cursor-pointer hover:text-primary-600">
 <span>{r.contract_no} — {vendorMap[r.vendor_id]}</span>
 <Badge tone="red">{pct(usagePercent(r), 0)}</Badge>
 </div>))}
 </div>
 </Card>
 </div>
 )}

 {loading ? <Card><TableSkeleton /></Card> : (
 <DataTable columns={columns} rows={rows} searchable searchKeys={['contract_no']} exportName="kontrak-vendor" onRowClick={setDetail}
 emptyTitle="Belum ada kontrak vendor" emptyMessage="Tambahkan kontrak rangka, blanket PO, sewa, atau jasa berkala pertama."
 emptyAction={writable && <Button size="sm" icon={<Plus size={16} />} onClick={openAdd}>Tambah Kontrak</Button>} />
 )}

 <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Ubah Kontrak Vendor' : 'Tambah Kontrak Vendor'} size="lg"
 footer={<><Button variant="outline" onClick={() => setModal(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Field label="No Kontrak" required><Input value={form.contract_no} onChange={e => setForm({ ...form, contract_no: e.target.value })} /></Field>
 <Field label="Vendor" required><Select value={form.vendor_id} options={vendors.map(v => ({ value: v.id, label: v.name }))} onChange={(e: any) => setForm({ ...form, vendor_id: e.target.value })} /></Field>
 <Field label="Jenis Kontrak"><Select value={form.contract_type} options={VENDOR_CONTRACT_TYPE_OPTIONS} onChange={(e: any) => setForm({ ...form, contract_type: e.target.value })} /></Field>
 <Field label="Status"><Select value={form.status} options={VENDOR_CONTRACT_STATUS_OPTIONS} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>
 <Field label="Tanggal Mulai" required><Input type="date" value={form.start_date ?? ''} onChange={e => setForm({ ...form, start_date: e.target.value })} /></Field>
 <Field label="Tanggal Berakhir"><Input type="date" value={form.end_date ?? ''} onChange={e => setForm({ ...form, end_date: e.target.value })} /></Field>
 <Field label="Nilai Plafon"><Money value={form.ceiling_value} onChange={(v: number) => setForm({ ...form, ceiling_value: v })} /></Field>
 <Field label="Nilai Terpakai" hint="Diperbarui manual berdasarkan realisasi PO/tagihan."><Money value={form.used_value} onChange={(v: number) => setForm({ ...form, used_value: v })} /></Field>
 <Field label="Termin Pembayaran (hari)"><Input type="number" value={form.payment_term_days} onChange={e => setForm({ ...form, payment_term_days: e.target.value })} /></Field>
 <Field label="Berkas Kontrak">
 <div className="flex items-center gap-2">
 <label className="inline-flex items-center gap-2 h-10 px-4 rounded-sm border border-ink-200 text-body cursor-pointer hover:bg-ink-50">
 <Upload size={15} />{uploading ? 'Mengunggah…' : 'Pilih Berkas'}
 <input type="file" className="hidden" disabled={uploading} onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
 </label>
 {form.file_url && <span className="text-caption text-ink-500">Berkas terpasang</span>}
 </div>
 </Field>
 <Field label="Catatan" className="sm:col-span-2"><Textarea value={form.note ?? ''} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
 </div>
 </Modal>

 <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.contract_no} width="max-w-2xl"
 footer={detail && (
 <div className="flex flex-wrap justify-end gap-2 w-full">
 {writable && <Button variant="outline" onClick={() => { const r = detail; setDetail(null); openEdit(r) }}>Ubah</Button>}
 {approver && <Button variant="danger" onClick={() => setDelId(detail.id)}>Hapus</Button>}
 </div>
 )}>
 {detail && (
 <>
 <Desc items={[
 { label: 'Vendor', value: vendorMap[detail.vendor_id] },
 { label: 'Jenis', value: typeLabel(detail.contract_type) },
 { label: 'Periode', value: `${tgl(detail.start_date)} – ${tgl(detail.end_date)}` },
 { label: 'Nilai Plafon', value: rupiah(detail.ceiling_value) },
 { label: 'Nilai Terpakai', value: rupiah(detail.used_value) },
 { label: 'Termin', value: `${detail.payment_term_days ?? '-'} hari` },
 { label: 'Status', value: <Badge>{detail.status}</Badge> },
 { label: 'Berkas', value: detail.file_url ? <Button size="sm" variant="outline" icon={<Paperclip size={13} />} onClick={async () => { const u = await signedUrl(detail.file_url); if (u) window.open(u, '_blank') }}>Buka Berkas</Button> : '-' },
 ]} />
 {detail.note && <p className="text-body text-ink-600 mt-3">{detail.note}</p>}

 <h4 className="font-display font-semibold text-[13px] uppercase tracking-wide text-ink-500 mt-6 mb-2">Realisasi PO dalam Periode Kontrak</h4>
 <p className="text-caption text-ink-400 mb-3">PO dengan vendor sama yang terbit dalam periode kontrak — dibandingkan terhadap nilai terpakai tercatat.</p>
 {posInPeriod.length === 0 ? <EmptyState title="Belum ada PO pada periode ini" /> : (
 <div className="space-y-1.5 mb-3">
 {posInPeriod.map((p: any) => (
 <div key={p.id} className="flex items-center justify-between text-body px-3 py-2 rounded-sm bg-ink-50">
 <span>{p.po_no} <span className="text-caption text-ink-400">· {tgl(p.po_date)}</span></span>
 <span className="tabular">{rupiah(p.total)}</span>
 </div>))}
 </div>
 )}
 <div className="flex items-center justify-between text-body-l font-semibold border-t border-ink-200 pt-2">
 <span>Total Realisasi PO</span><span className="tabular">{rupiah(posTotal)}</span>
 </div>
 <div className={`mt-2 flex items-center justify-between text-body px-3 py-2 rounded-sm ${selisih === 0 ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'}`}>
 <span>Selisih terhadap Nilai Terpakai Tercatat</span>
 <span className="tabular font-semibold">{selisih === 0 ? 'Cocok' : rupiah(selisih)}</span>
 </div>
 </>
 )}
 </Drawer>

 <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={doDelete} danger
 title="Hapus Kontrak Vendor" message="Kontrak vendor ini akan dihapus permanen. Pastikan tidak lagi dirujuk PO aktif." confirmLabel="Ya, Hapus" />
 </div>
 )
}
