import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, signedUrl, uploadFile } from '@/lib/db'
import { rupiah, tgl, num } from '@/lib/format'
import {
 PageHeader, FilterBar, KpiCard, DataTable, Modal, Drawer, ConfirmDialog, Tabs, Desc,
 Button, Field, Input, Select, Checkbox, Badge, useToast, Plus, Card, CardHeader, Textarea,
} from '@/components/ui'
import { VENDOR_TYPES, VENDOR_STATUS } from '../lib/shared'

const SLA_UMUM_VALUE = '__umum__'

export default function Vendor() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [rows, setRows] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [fType, setFType] = useState(''); const [fStatus, setFStatus] = useState('')

 const [modal, setModal] = useState<{ open: boolean; row?: any }>({ open: false })
 const [form, setForm] = useState<any>({})
 const [saving, setSaving] = useState(false)

 const [detail, setDetail] = useState<any | null>(null)
 const [tab, setTab] = useState('ringkasan')
 const [pos, setPos] = useState<any[]>([]); const [invs, setInvs] = useState<any[]>([]); const [scores, setScores] = useState<any[]>([])
 const [docs, setDocs] = useState<{ name: string; path: string }[]>([])
 const [confirmBl, setConfirmBl] = useState<any | null>(null)

 // Target SLA Bayar Mitra (partner_payment_sla) — dipakai KPI "Ketepatan Bayar Mitra" di Finance.
 const [slaRows, setSlaRows] = useState<any[]>([])
 const [slaModal, setSlaModal] = useState<{ open: boolean; row?: any }>({ open: false })
 const [slaForm, setSlaForm] = useState<any>({})
 const [slaSaving, setSlaSaving] = useState(false)
 const [slaDelId, setSlaDelId] = useState<string | null>(null)

 const load = useCallback(async () => {
 setLoading(true)
 try {
 const [data, sla] = await Promise.all([
 list('vendors', { order: { col: 'name', asc: true } }),
 list('partner_payment_sla', { order: { col: 'created_at', asc: false }, limit: 1000 }),
 ])
 setRows(data); setSlaRows(sla)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat vendor', 'error') }
 finally { setLoading(false) }
 }, [toast])
 useEffect(() => { load() }, [load])

 const filtered = rows.filter(r => (!fType || r.vendor_type === fType) && (!fStatus || r.status === fStatus))

 function openAdd() {
 setForm({ code: '', name: '', vendor_type: 'material', npwp: '', pkp: false, address: '', city: '',
 phone: '', email: '', pic_name: '', bank_name: '', bank_account: '', bank_holder: '',
 payment_term_days: 30, rating: 0, status: 'aktif' })
 setModal({ open: true })
 }
 function openEdit(row: any) { setForm({ ...row }); setModal({ open: true, row }) }

 async function save() {
 if (!form.code || !form.name) { toast.push('Kode dan nama vendor wajib diisi', 'error'); return }
 setSaving(true)
 try {
 if (modal.row) {
 await update('vendors', modal.row.id, { ...form })
 toast.push('Vendor diperbarui')
 } else {
 await insert('vendors', { ...form, company_id: profile!.company_id, documents: [], created_by: profile!.id })
 toast.push('Vendor ditambahkan')
 }
 setModal({ open: false }); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan vendor', 'error') }
 finally { setSaving(false) }
 }

 async function openDetail(row: any) {
 setDetail(row); setTab('ringkasan')
 setDocs((row.documents ?? []).map((d: any) => (typeof d === 'string' ? { name: d, path: d } : d)))
 try {
 const [po, inv, sc] = await Promise.all([
 list('purchase_orders', { eq: { vendor_id: row.id }, order: { col: 'po_date', asc: false }, limit: 50 }),
 list('vendor_invoices', { eq: { vendor_id: row.id }, order: { col: 'invoice_date', asc: false }, limit: 50 }),
 list('vendor_scorecards', { eq: { vendor_id: row.id }, order: { col: 'period_code', asc: false }, limit: 24 }),
 ])
 setPos(po); setInvs(inv); setScores(sc)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat detail vendor', 'error') }
 }

 async function doBlacklist() {
 if (!confirmBl) return
 try {
 await update('vendors', confirmBl.id, { status: 'blacklist' })
 toast.push('Vendor diblacklist')
 load(); if (detail?.id === confirmBl.id) setDetail({ ...detail, status: 'blacklist' })
 } catch (e: any) { toast.push(e.message ?? 'Gagal memblacklist vendor', 'error') }
 }

 async function onUploadDoc(file: File | undefined) {
 if (!file || !detail) return
 try {
 const path = await uploadFile(profile!.company_id, 'vendor', file)
 const next = [...docs, { name: file.name, path }]
 await update('vendors', detail.id, { documents: next })
 setDocs(next); load()
 toast.push('Dokumen diunggah')
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengunggah dokumen', 'error') }
 }
 async function viewDoc(path: string) {
 const url = await signedUrl(path)
 if (url) window.open(url, '_blank')
 else toast.push('Gagal membuka dokumen', 'error')
 }

 const vendorNameById = (id: string) => rows.find(r => r.id === id)?.name ?? '-'

 function openSlaAdd() {
 setSlaForm({ vendor_id: SLA_UMUM_VALUE, target_days: 30, note: '' })
 setSlaModal({ open: true })
 }
 function openSlaEdit(row: any) {
 setSlaForm({ ...row, vendor_id: row.vendor_id ?? SLA_UMUM_VALUE })
 setSlaModal({ open: true, row })
 }
 async function saveSla() {
 if (!slaForm.target_days || Number(slaForm.target_days) <= 0) { toast.push('Target hari bayar wajib diisi dan lebih dari 0', 'error'); return }
 setSlaSaving(true)
 try {
 const payload = {
 vendor_id: slaForm.vendor_id === SLA_UMUM_VALUE ? null : slaForm.vendor_id,
 target_days: Number(slaForm.target_days), note: slaForm.note ?? '',
 }
 if (slaModal.row) { await update('partner_payment_sla', slaModal.row.id, payload); toast.push('Target SLA bayar diperbarui') }
 else { await insert('partner_payment_sla', { ...payload, company_id: profile!.company_id, created_by: profile!.id }); toast.push('Target SLA bayar ditambahkan') }
 setSlaModal({ open: false }); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan target SLA bayar', 'error') }
 finally { setSlaSaving(false) }
 }
 async function doDeleteSla() {
 if (!slaDelId) return
 try { await remove('partner_payment_sla', slaDelId); toast.push('Target SLA bayar dihapus'); load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus target SLA bayar', 'error') }
 finally { setSlaDelId(null) }
 }

 const totalAktif = rows.filter(r => r.status === 'aktif').length
 const totalBlacklist = rows.filter(r => r.status === 'blacklist').length
 const avgRating = rows.length ? rows.reduce((a, r) => a + Number(r.rating || 0), 0) / rows.length : 0

 const columns = [
 { key: 'code', header: 'Kode', width: '110px' },
 { key: 'name', header: 'Nama Vendor' },
 { key: 'vendor_type', header: 'Jenis', render: (r: any) => <span className="capitalize">{r.vendor_type}</span> },
 { key: 'pkp', header: 'PKP', align: 'center' as const, render: (r: any) => r.pkp ? <Badge tone="emerald">PKP</Badge> : <Badge tone="slate">Non-PKP</Badge> },
 { key: 'payment_term_days', header: 'Termin', align: 'right' as const, render: (r: any) => `${r.payment_term_days} hari` },
 { key: 'rating', header: 'Rating', align: 'right' as const, render: (r: any) => num(r.rating, 1) },
 { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
 {
 key: 'aksi', header: '', sortable: false, render: (r: any) => (
 <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
 {can('PROCUREMENT', 'write') && <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Ubah</Button>}
 {can('PROCUREMENT', 'approve') && r.status !== 'blacklist' && (
 <Button size="sm" variant="danger" onClick={() => setConfirmBl(r)}>Blacklist</Button>
 )}
 </div>
 ),
 },
 ]

 return (
 <div>
 <PageHeader title="Vendor" subtitle="Induk data mitra pemasok material, jasa, subkontraktor dan sewa."
 actions={can('PROCUREMENT', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Vendor</Button>} />

 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
 <KpiCard label="Total Vendor" value={num(rows.length)} />
 <KpiCard label="Vendor Aktif" value={num(totalAktif)} tone="teal" />
 <KpiCard label="Blacklist" value={num(totalBlacklist)} tone="red" />
 <KpiCard label="Rating Rata-rata" value={num(avgRating, 1)} tone="amber" />
 </div>

 <FilterBar>
 <Field label="Jenis Vendor" className="w-44"><Select value={fType} onChange={(e: any) => setFType(e.target.value)} options={VENDOR_TYPES} /></Field>
 <Field label="Status" className="w-44"><Select value={fStatus} onChange={(e: any) => setFStatus(e.target.value)} options={VENDOR_STATUS} /></Field>
 </FilterBar>

 <DataTable columns={columns} rows={filtered} loading={loading} onRowClick={openDetail}
 searchable searchKeys={['code', 'name', 'city', 'pic_name']} exportName="vendor"
 emptyTitle="Belum ada vendor" emptyMessage="Tambahkan vendor untuk mulai proses pengadaan." />

 <Card className="mt-5">
 <CardHeader title="Target SLA Bayar Mitra" subtitle="Target hari pembayaran yang disepakati per vendor — dasar KPI Ketepatan Bayar Mitra di Finance."
 action={can('PROCUREMENT', 'write') && <Button size="sm" icon={<Plus size={14} />} onClick={openSlaAdd}>Tambah Target</Button>} />
 <DataTable
 columns={[
 { key: 'vendor_id', header: 'Vendor', render: (r: any) => r.vendor_id ? vendorNameById(r.vendor_id) : <Badge tone="amber">Target Umum (default)</Badge> },
 { key: 'target_days', header: 'Target Hari Bayar', align: 'right' as const, render: (r: any) => `${num(r.target_days)} hari` },
 { key: 'note', header: 'Catatan', render: (r: any) => r.note || '-' },
 {
 key: 'aksi', header: '', sortable: false, width: '140px', render: (r: any) => (
 <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
 {can('PROCUREMENT', 'write') && <Button size="sm" variant="outline" onClick={() => openSlaEdit(r)}>Ubah</Button>}
 {can('PROCUREMENT', 'approve') && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setSlaDelId(r.id)}>Hapus</Button>}
 </div>
 ),
 },
 ]}
 rows={slaRows} loading={loading} searchable={false} pageSize={10} dense
 emptyTitle="Belum ada target SLA bayar" emptyMessage="Tambahkan target hari bayar per vendor, atau satu target umum bila vendor dikosongkan." />
 </Card>

 <Modal open={modal.open} onClose={() => setModal({ open: false })} size="lg"
 title={modal.row ? 'Ubah Vendor' : 'Tambah Vendor'}
 footer={<><Button variant="outline" onClick={() => setModal({ open: false })}>Batal</Button>
 <Button loading={saving} onClick={save}>Simpan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Kode Vendor" required><Input value={form.code ?? ''} onChange={(e: any) => setForm({ ...form, code: e.target.value })} placeholder="VND-001" /></Field>
 <Field label="Nama Vendor" required><Input value={form.name ?? ''} onChange={(e: any) => setForm({ ...form, name: e.target.value })} /></Field>
 <Field label="Jenis Vendor" required><Select value={form.vendor_type ?? ''} onChange={(e: any) => setForm({ ...form, vendor_type: e.target.value })} options={VENDOR_TYPES} /></Field>
 <Field label="Status"><Select value={form.status ?? 'aktif'} onChange={(e: any) => setForm({ ...form, status: e.target.value })} options={VENDOR_STATUS} /></Field>
 <Field label="NPWP"><Input value={form.npwp ?? ''} onChange={(e: any) => setForm({ ...form, npwp: e.target.value })} /></Field>
 <Field label="Status PKP"><Checkbox label="Vendor berstatus PKP" checked={!!form.pkp} onChange={(e: any) => setForm({ ...form, pkp: e.target.checked })} /></Field>
 <Field label="Kota"><Input value={form.city ?? ''} onChange={(e: any) => setForm({ ...form, city: e.target.value })} /></Field>
 <Field label="Telepon"><Input value={form.phone ?? ''} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} /></Field>
 <Field label="Alamat" className="sm:col-span-2"><Input value={form.address ?? ''} onChange={(e: any) => setForm({ ...form, address: e.target.value })} /></Field>
 <Field label="Email"><Input value={form.email ?? ''} onChange={(e: any) => setForm({ ...form, email: e.target.value })} /></Field>
 <Field label="Nama PIC"><Input value={form.pic_name ?? ''} onChange={(e: any) => setForm({ ...form, pic_name: e.target.value })} /></Field>
 <Field label="Nama Bank"><Input value={form.bank_name ?? ''} onChange={(e: any) => setForm({ ...form, bank_name: e.target.value })} /></Field>
 <Field label="No. Rekening"><Input value={form.bank_account ?? ''} onChange={(e: any) => setForm({ ...form, bank_account: e.target.value })} /></Field>
 <Field label="Nama Pemegang Rekening"><Input value={form.bank_holder ?? ''} onChange={(e: any) => setForm({ ...form, bank_holder: e.target.value })} /></Field>
 <Field label="Termin Pembayaran (hari)"><Input type="number" value={form.payment_term_days ?? 30} onChange={(e: any) => setForm({ ...form, payment_term_days: Number(e.target.value) })} /></Field>
 <Field label="Rating (0-5)"><Input type="number" step="0.1" min="0" max="5" value={form.rating ?? 0} onChange={(e: any) => setForm({ ...form, rating: Number(e.target.value) })} /></Field>
 </div>
 </Modal>

 <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.name} width="max-w-2xl">
 {detail && (<>
 <div className="flex items-center gap-2 mb-3">
 <Badge>{detail.status}</Badge>
 <span className="text-caption text-ink-500">{detail.code} · {detail.vendor_type}</span>
 </div>
 <Tabs className="mb-4" value={tab} onChange={setTab}
 tabs={[{ value: 'ringkasan', label: 'Ringkasan' }, { value: 'po', label: 'PO', count: pos.length },
 { value: 'invoice', label: 'Invoice', count: invs.length }, { value: 'scorecard', label: 'Scorecard', count: scores.length },
 { value: 'dokumen', label: 'Dokumen', count: docs.length }]} />
 {tab === 'ringkasan' && (
 <Desc cols={2} items={[
 { label: 'NPWP', value: detail.npwp }, { label: 'Status PKP', value: detail.pkp ? 'PKP' : 'Non-PKP' },
 { label: 'Alamat', value: detail.address }, { label: 'Kota', value: detail.city },
 { label: 'Telepon', value: detail.phone }, { label: 'Email', value: detail.email },
 { label: 'PIC', value: detail.pic_name }, { label: 'Termin Pembayaran', value: `${detail.payment_term_days} hari` },
 { label: 'Bank', value: detail.bank_name }, { label: 'No. Rekening', value: `${detail.bank_account} a.n ${detail.bank_holder}` },
 { label: 'Rating', value: num(detail.rating, 1) },
 ]} />
 )}
 {tab === 'po' && (
 <DataTable searchable={false} rows={pos}
 columns={[{ key: 'po_no', header: 'No. PO' }, { key: 'po_date', header: 'Tanggal', render: (r: any) => tgl(r.po_date) },
 { key: 'total', header: 'Total', align: 'right', render: (r: any) => rupiah(r.total) }, { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> }]}
 emptyTitle="Belum ada PO untuk vendor ini" />
 )}
 {tab === 'invoice' && (
 <DataTable searchable={false} rows={invs}
 columns={[{ key: 'inv_no', header: 'No. Invoice' }, { key: 'invoice_date', header: 'Tanggal', render: (r: any) => tgl(r.invoice_date) },
 { key: 'total', header: 'Total', align: 'right', render: (r: any) => rupiah(r.total) },
 { key: 'match_status', header: '3-Way Match', render: (r: any) => <Badge>{r.match_status}</Badge> },
 { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> }]}
 emptyTitle="Belum ada invoice untuk vendor ini" />
 )}
 {tab === 'scorecard' && (
 <DataTable searchable={false} rows={scores}
 columns={[{ key: 'period_code', header: 'Periode' }, { key: 'otd_score', header: 'Ketepatan Kirim', align: 'right', render: (r: any) => num(r.otd_score, 1) },
 { key: 'quality_score', header: 'Mutu', align: 'right', render: (r: any) => num(r.quality_score, 1) },
 { key: 'price_score', header: 'Harga', align: 'right', render: (r: any) => num(r.price_score, 1) },
 { key: 'compliance_score', header: 'Kepatuhan', align: 'right', render: (r: any) => num(r.compliance_score, 1) },
 { key: 'total_score', header: 'Total', align: 'right', render: (r: any) => <b>{num(r.total_score, 1)}</b> }]}
 emptyTitle="Belum ada scorecard untuk vendor ini" />
 )}
 {tab === 'dokumen' && (
 <div>
 {can('PROCUREMENT', 'write') && (
 <Field label="Unggah dokumen baru" className="mb-4 max-w-sm">
 <input type="file" onChange={(e) => onUploadDoc(e.target.files?.[0])}
 className="block w-full text-body text-ink-600 file:mr-3 file:py-2 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
 </Field>
 )}
 {docs.length === 0 ? <p className="text-body text-ink-400">Belum ada dokumen tersimpan.</p> : (
 <ul className="space-y-2">
 {docs.map((d, i) => (
 <li key={i} className="flex items-center justify-between px-3 py-2 border border-ink-200 rounded-sm">
 <span className="text-body truncate">{d.name}</span>
 <Button size="sm" variant="outline" onClick={() => viewDoc(d.path)}>Lihat</Button>
 </li>))}
 </ul>
 )}
 </div>
 )}
 </>)}
 </Drawer>

 <ConfirmDialog open={!!confirmBl} onClose={() => setConfirmBl(null)} onConfirm={doBlacklist} danger
 title="Blacklist Vendor" confirmLabel="Ya, Blacklist"
 message={`Vendor "${confirmBl?.name}" akan ditandai blacklist dan tidak direkomendasikan untuk transaksi baru. Lanjutkan?`} />

 <Modal open={slaModal.open} onClose={() => setSlaModal({ open: false })} size="md"
 title={slaModal.row ? 'Ubah Target SLA Bayar' : 'Tambah Target SLA Bayar'}
 footer={<><Button variant="outline" onClick={() => setSlaModal({ open: false })}>Batal</Button>
 <Button loading={slaSaving} onClick={saveSla}>Simpan</Button></>}>
 <div className="grid gap-4">
 <Field label="Vendor" hint="Kosongkan (pilih Target Umum) untuk target default yang berlaku bila vendor tidak punya target khusus.">
 <Select value={slaForm.vendor_id ?? SLA_UMUM_VALUE} onChange={(e: any) => setSlaForm({ ...slaForm, vendor_id: e.target.value })}
 options={[{ value: SLA_UMUM_VALUE, label: '— Target Umum (Default) —' }, ...rows.map(v => ({ value: v.id, label: v.name }))]} />
 </Field>
 <Field label="Target Hari Bayar" required><Input type="number" min="1" value={slaForm.target_days ?? 30} onChange={(e: any) => setSlaForm({ ...slaForm, target_days: Number(e.target.value) })} /></Field>
 <Field label="Catatan"><Textarea value={slaForm.note ?? ''} onChange={(e: any) => setSlaForm({ ...slaForm, note: e.target.value })} /></Field>
 </div>
 </Modal>

 <ConfirmDialog open={!!slaDelId} onClose={() => setSlaDelId(null)} onConfirm={doDeleteSla} danger
 title="Hapus Target SLA Bayar" confirmLabel="Ya, Hapus" message="Target SLA bayar ini akan dihapus permanen. Lanjutkan?" />
 </div>
 )
}
