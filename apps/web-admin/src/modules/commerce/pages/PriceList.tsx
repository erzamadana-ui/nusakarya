import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import { rupiah, tgl } from '@/lib/format'
import {
 PageHeader, Card, DataTable, Modal, ConfirmDialog, Field, Input, Select, Textarea,
 Badge, Button, useToast, TableSkeleton, EmptyState, Plus, cx,
} from '@/components/ui'
import { ClipboardPaste, Download } from 'lucide-react'
import { PRICE_SOURCE_OPTIONS, PRICE_SOURCE_LABEL, priceSourceTone } from '../lib/constants'

const emptyForm = { item_code: '', description: '', uom: '', unit_price: 0, job_type_id: '', is_active: true, price_source: 'asumsi_sistem', price_source_ref: '' }

const TEMPLATE_HEADER = 'kode_pekerjaan;deskripsi;satuan;harga_satuan;sumber;rujukan'

type ImportRow = {
 line: number; kode: string; deskripsi: string; satuan: string; hargaRaw: string; harga: number
 sumber: string; sumberRaw: string; rujukan: string; error?: string; isOverwrite: boolean; existingId?: string; jobTypeId: string | null
}

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
 price_source: form.price_source || 'asumsi_sistem', price_source_ref: form.price_source_ref || null,
 }
 if (editing) { await update('contract_price_list', editing.id, payload); toast.push('Item price list diperbarui', 'success') }
 else { await insert('contract_price_list', { ...payload, company_id: profile!.company_id }); toast.push('Item price list ditambahkan', 'success') }
 setModal(false); load(contractId)
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan item', 'error') }
 finally { setSaving(false) }
 }

 const markVerified = async (row: any) => {
 try {
 await update('contract_price_list', row.id, { price_verified_at: new Date().toISOString(), price_verified_by: profile?.id })
 toast.push('Item price list ditandai terverifikasi', 'success'); load(contractId)
 } catch (e: any) { toast.push(e.message ?? 'Gagal menandai verifikasi', 'error') }
 }

 const doDelete = async () => {
 if (!delId) return
 try { await remove('contract_price_list', delId); toast.push('Item dihapus', 'success'); load(contractId) }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus item', 'error') }
 }

 /** Baris impor: format kode_pekerjaan;deskripsi;satuan;harga_satuan;sumber;rujukan — ditempel dari xlsx. */
 const parsedImportRows = useMemo<ImportRow[]>(() => {
 return importText.split('\n').map((raw, i) => ({ raw, line: i + 1 })).filter(x => x.raw.trim()).map(({ raw, line }) => {
 // Mendukung tempelan langsung dari Excel (tab) maupun teks berpemisah titik-koma.
 const parts = raw.split(/[;\t]/).map(s => s.trim())
 const [kode = '', deskripsi = '', satuan = '', hargaRaw = '', sumberRaw = '', rujukan = ''] = parts
 const harga = Number(hargaRaw.replace(/[^\d.-]/g, ''))
 const sumberNorm = sumberRaw.trim().toLowerCase()
 const sumberValid = !sumberNorm || PRICE_SOURCE_OPTIONS.some(o => o.value === sumberNorm)
 const sumber = sumberNorm && sumberValid ? sumberNorm : 'asumsi_sistem'
 const existing = rows.find(r => (r.item_code ?? '').trim().toLowerCase() === kode.toLowerCase())
 const jt = jobTypes.find(j => (j.code ?? '').trim().toLowerCase() === kode.toLowerCase())
 let error: string | undefined
 if (!kode) error = 'Kode pekerjaan kosong'
 else if (!satuan) error = 'Satuan kosong'
 else if (!hargaRaw || !isFinite(harga) || harga <= 0) error = 'Harga satuan harus angka lebih dari 0'
 else if (sumberRaw && !sumberValid) error = `Sumber "${sumberRaw}" tidak dikenali`
 return {
 line, kode, deskripsi, satuan, hargaRaw, harga, sumber, sumberRaw, rujukan, error,
 isOverwrite: !!existing, existingId: existing?.id, jobTypeId: jt?.id ?? null,
 } as ImportRow
 })
 }, [importText, rows, jobTypes])

 const validImportRows = useMemo(() => parsedImportRows.filter(r => !r.error), [parsedImportRows])
 const problemImportRows = useMemo(() => parsedImportRows.filter(r => r.error), [parsedImportRows])
 const importNewCount = useMemo(() => validImportRows.filter(r => !r.isOverwrite).length, [validImportRows])
 const importOverwriteCount = useMemo(() => validImportRows.filter(r => r.isOverwrite).length, [validImportRows])

 const doImport = async () => {
 if (!contractId) { toast.push('Pilih kontrak terlebih dahulu', 'error'); return }
 if (!validImportRows.length) { toast.push('Tidak ada baris valid untuk diimpor', 'error'); return }
 setImporting(true)
 try {
 for (const r of validImportRows) {
 const payload = {
 contract_id: contractId, item_code: r.kode, description: r.deskripsi, uom: r.satuan,
 unit_price: r.harga, job_type_id: r.jobTypeId, is_active: true,
 price_source: r.sumber, price_source_ref: r.rujukan || null,
 }
 if (r.isOverwrite && r.existingId) await update('contract_price_list', r.existingId, payload)
 else await insert('contract_price_list', { ...payload, company_id: profile!.company_id })
 }
 toast.push(`Impor selesai — ${importNewCount} item baru, ${importOverwriteCount} item menimpa data lama`, 'success')
 setImportOpen(false); setImportText(''); load(contractId)
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengimpor item', 'error') }
 finally { setImporting(false) }
 }

 /** Unduh template CSV siap isi (kolom sama dengan format impor), diisi kode/nama dari master job_types. */
 const downloadTemplate = () => {
 const body = jobTypes.length
 ? jobTypes.map(jt => `${jt.code};${jt.name};;;kontrak;`).join('\n')
 : 'PU-01;Penarikan kabel udara;meter;;kontrak;\nPU-02;Instalasi ODP;unit;;kontrak;'
 const csv = TEMPLATE_HEADER + '\n' + body
 const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
 const a = document.createElement('a')
 a.href = URL.createObjectURL(blob); a.download = 'template-price-list-nusakarya.csv'; a.click(); URL.revokeObjectURL(a.href)
 }

 const columns = [
 { key: 'item_code', header: 'Kode', width: '120px' },
 { key: 'description', header: 'Deskripsi Pekerjaan' },
 { key: 'uom', header: 'Satuan', width: '90px' },
 { key: 'unit_price', header: 'Harga Satuan', align: 'right' as const, render: (r: any) => rupiah(r.unit_price) },
 { key: 'job_type_id', header: 'Job Type', render: (r: any) => jobTypeMap[r.job_type_id] ?? '-' },
 {
 key: 'price_source', header: 'Sumber Tarif', render: (r: any) => (
 <div className="space-y-0.5">
 <Badge tone={priceSourceTone(r.price_source)}>{r.price_source === 'asumsi_sistem' ? 'ASUMSI' : (PRICE_SOURCE_LABEL[r.price_source] ?? r.price_source)}</Badge>
 {r.price_verified_at && <div className="text-caption text-ink-400 whitespace-nowrap">Terverifikasi {tgl(r.price_verified_at)}</div>}
 </div>
 ),
 },
 { key: 'is_active', header: 'Status', render: (r: any) => <Badge tone={r.is_active ? 'emerald' : 'slate'}>{r.is_active ? 'aktif' : 'nonaktif'}</Badge> },
 {
 key: 'aksi', header: '', width: '200px', sortable: false,
 render: (r: any) => (
 <div className="flex items-center gap-1">
 {can('COMMERCE', 'write') && <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Ubah</Button>}
 {can('COMMERCE', 'approve') && !r.price_verified_at && <Button size="sm" variant="outline" onClick={() => markVerified(r)}>Tandai Terverifikasi</Button>}
 {can('COMMERCE', 'approve') && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDelId(r.id)}>Hapus</Button>}
 </div>
 ),
 },
 ]

 return (
 <div>
 <PageHeader title="Price List Kontrak" subtitle="Daftar item pekerjaan dan harga satuan per kontrak."
 actions={<>
 <Button variant="outline" icon={<Download size={16} />} onClick={downloadTemplate}>Unduh Template</Button>
 {can('COMMERCE', 'write') && <>
 <Button variant="outline" icon={<ClipboardPaste size={16} />} onClick={() => setImportOpen(true)}>Impor dari Berkas</Button>
 <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Item</Button>
 </>}
 </>} />

 <Card className="p-4 mb-4">
 <Field label="Kontrak" className="max-w-md">
 <Select value={contractId} options={contracts.map(c => ({ value: c.id, label: `${c.contract_no} — ${c.contract_name}` }))} onChange={(e: any) => setContractId(e.target.value)} />
 </Field>
 </Card>

 {!contractId ? <EmptyState title="Pilih kontrak" message="Pilih kontrak terlebih dahulu untuk melihat price list." /> :
 loading ? <Card><TableSkeleton /></Card> : (
 <DataTable columns={columns} rows={rows} searchable searchKeys={['item_code', 'description']} exportName="price-list"
 emptyTitle="Belum ada item price list" emptyMessage="Tambahkan item satu per satu atau gunakan Impor dari Berkas."
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
 <Field label="Sumber Tarif" hint="Asumsi Sistem = angka karangan sistem, belum berdasar kontrak nyata.">
 <Select options={PRICE_SOURCE_OPTIONS} value={form.price_source ?? 'asumsi_sistem'} onChange={(e: any) => setForm({ ...form, price_source: e.target.value })} />
 </Field>
 <Field label="Rujukan (No Kontrak/SPK/Dokumen)"><Input value={form.price_source_ref ?? ''} onChange={e => setForm({ ...form, price_source_ref: e.target.value })} /></Field>
 </div>
 </Modal>

 <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Impor dari Berkas — Price List" size="lg"
 footer={<><Button variant="outline" onClick={() => setImportOpen(false)}>Batal</Button>
 <Button loading={importing} disabled={!validImportRows.length} onClick={doImport}>
 Simpan {validImportRows.length > 0 ? `(${importNewCount} baru, ${importOverwriteCount} menimpa)` : ''}
 </Button></>}>
 <Field label="Tempel Baris dari Berkas (xlsx)" hint="Buka file xlsx Anda, blok kolom kode_pekerjaan sampai rujukan, salin (Ctrl+C), lalu tempel di sini (Ctrl+V) — atau ketik manual dipisah titik-koma. Kolom: kode_pekerjaan;deskripsi;satuan;harga_satuan;sumber;rujukan">
 <Textarea rows={8} value={importText} onChange={e => setImportText(e.target.value)}
 placeholder={'PU-01;Penarikan kabel udara;meter;8500;kontrak;SPK/2026/001\nPU-02;Instalasi ODP;unit;350000;asumsi_sistem;'}
 className="min-h-[160px] font-mono text-caption" />
 </Field>
 {parsedImportRows.length > 0 && (
 <div className="mt-3 space-y-2">
 <p className="text-caption text-ink-500">
 {validImportRows.length} baris valid ({importNewCount} baru, {importOverwriteCount} menimpa data lama)
 {problemImportRows.length > 0 && <span className="text-red-600 font-medium"> · {problemImportRows.length} baris bermasalah — tidak akan disimpan</span>}
 </p>
 <div className="max-h-64 overflow-auto border border-ink-200 rounded-sm">
 <table className="w-full text-caption">
 <thead className="bg-ink-50 sticky top-0"><tr>
 <th className="px-2 py-1 text-left">Baris</th><th className="px-2 py-1 text-left">Kode</th><th className="px-2 py-1 text-left">Deskripsi</th>
 <th className="px-2 py-1 text-left">Satuan</th><th className="px-2 py-1 text-right">Harga</th><th className="px-2 py-1 text-left">Sumber</th>
 <th className="px-2 py-1 text-left">Rujukan</th><th className="px-2 py-1 text-left">Status</th>
 </tr></thead>
 <tbody>{parsedImportRows.map((r) => (
 <tr key={r.line} className={cx('border-b border-ink-100 last:border-0', r.error && 'bg-red-50 dark:bg-red-950/30')}>
 <td className="px-2 py-1 text-ink-400">{r.line}</td>
 <td className="px-2 py-1">{r.kode || '-'}</td><td className="px-2 py-1">{r.deskripsi || '-'}</td>
 <td className="px-2 py-1">{r.satuan || '-'}</td><td className="px-2 py-1 text-right tabular">{r.harga ? rupiah(r.harga) : '-'}</td>
 <td className="px-2 py-1"><Badge tone={priceSourceTone(r.sumber)}>{r.sumber === 'asumsi_sistem' ? 'ASUMSI' : (PRICE_SOURCE_LABEL[r.sumber] ?? r.sumber)}</Badge></td>
 <td className="px-2 py-1">{r.rujukan || '-'}</td>
 <td className="px-2 py-1">
 {r.error ? <span className="text-red-600 font-medium">{r.error}</span>
 : r.isOverwrite ? <Badge tone="amber">Menimpa</Badge> : <Badge tone="emerald">Baru</Badge>}
 </td>
 </tr>))}</tbody>
 </table>
 </div>
 </div>)}
 </Modal>

 <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={doDelete} danger
 title="Hapus Item" message="Item price list akan dihapus permanen. Lanjutkan?" confirmLabel="Ya, Hapus" />
 </div>
 )
}
