import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo } from '@/lib/db'
import { rupiah, tgl, todayISO, num } from '@/lib/format'
import {
 PageHeader, Card, DataTable, Modal, Drawer, ConfirmDialog, Field, Input, Select, Textarea,
 Badge, Button, Stepper, useToast, TableSkeleton, EmptyState, Section, Desc, Plus,
} from '@/components/ui'
import { Printer, AlertTriangle } from 'lucide-react'
import { CLAIM_STATUS_STEPS } from '../lib/constants'

type Item = { id?: string; price_list_id: string | null; description: string; uom: string; unit_price: number; qty: number }

export default function Klaim() {
 const { profile, company, can } = useAuth()
 const toast = useToast()
 const [rows, setRows] = useState<any[]>([])
 const [spkList, setSpkList] = useState<any[]>([])
 const [contracts, setContracts] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [modal, setModal] = useState(false)
 const [saving, setSaving] = useState(false)

 // form pembuatan klaim baru
 const [fSpkId, setFSpkId] = useState('')
 const [fPeriodStart, setFPeriodStart] = useState(todayISO())
 const [fPeriodEnd, setFPeriodEnd] = useState(todayISO())
 const [fBaNo, setFBaNo] = useState('')
 const [fBaDate, setFBaDate] = useState(todayISO())
 const [fNote, setFNote] = useState('')
 const [items, setItems] = useState<Item[]>([])
 const [itemsLoading, setItemsLoading] = useState(false)
 const [priceListOptions, setPriceListOptions] = useState<any[]>([])
 const [editingId, setEditingId] = useState<string | null>(null)
 const [formContractId, setFormContractId] = useState<string | null>(null)

 const [detail, setDetail] = useState<any>(null)
 const [detailItems, setDetailItems] = useState<any[]>([])
 const [detailLoading, setDetailLoading] = useState(false)
 const [rejectOpen, setRejectOpen] = useState(false)
 const [rejectReason, setRejectReason] = useState('')
 const [delId, setDelId] = useState<string | null>(null)
 const [printMode, setPrintMode] = useState(false)
 const [tarifAsumsiCount, setTarifAsumsiCount] = useState(0)

 const spkMap = useMemo(() => Object.fromEntries(spkList.map(s => [s.id, s])), [spkList])
 const contractMap = useMemo(() => Object.fromEntries(contracts.map(c => [c.id, c])), [contracts])

 useEffect(() => {
 list<any>('v_tarif_belum_terverifikasi', { select: 'id', eq: { sumber_tabel: 'contract_price_list' } })
 .then(r => setTarifAsumsiCount(r.length)).catch(() => {})
 }, [])

 const load = async () => {
 setLoading(true)
 try {
 const [cl, sp, ct] = await Promise.all([
 list('progress_claims', { order: { col: 'created_at', asc: false }, limit: 500 }),
 list('spk', { select: 'id,spk_no,title,contract_id,status', eq: { status: 'aktif' }, order: { col: 'spk_no', asc: true }, limit: 500 }),
 list('contracts', { select: 'id,contract_name,retention_percent,customer_id', limit: 500 }),
 ])
 setRows(cl); setSpkList(sp); setContracts(ct)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data klaim', 'error') }
 finally { setLoading(false) }
 }
 useEffect(() => { load() }, [])

 const resetForm = () => {
 setFSpkId(''); setFPeriodStart(todayISO()); setFPeriodEnd(todayISO()); setFBaNo(''); setFBaDate(todayISO()); setFNote(''); setItems([]); setPriceListOptions([]); setFormContractId(null)
 }
 const openAdd = () => { resetForm(); setEditingId(null); setModal(true) }

 const pullPriceList = async (spkId: string) => {
 setFSpkId(spkId)
 const spk = spkMap[spkId]
 setFormContractId(spk?.contract_id ?? null)
 if (!spk) { setItems([]); setPriceListOptions([]); return }
 setItemsLoading(true)
 try {
 const pl = await list('contract_price_list', { eq: { contract_id: spk.contract_id, is_active: true }, order: { col: 'item_code', asc: true }, limit: 500 })
 setPriceListOptions(pl)
 setItems(pl.map((p: any) => ({ price_list_id: p.id, description: `${p.item_code ? p.item_code + ' — ' : ''}${p.description ?? ''}`, uom: p.uom ?? '', unit_price: Number(p.unit_price) || 0, qty: 0 })))
 } catch (e: any) { toast.push(e.message ?? 'Gagal menarik item price list', 'error') }
 finally { setItemsLoading(false) }
 }

 // Ubah klaim yang masih draft: item bisa ditambah/dihapus/diubah qty-nya.
 const openEditItems = async (row: any) => {
 setEditingId(row.id)
 setFSpkId(row.spk_id || ''); setFormContractId(row.contract_id || null)
 setFPeriodStart(row.period_start || todayISO()); setFPeriodEnd(row.period_end || todayISO())
 setFBaNo(row.ba_no || ''); setFBaDate(row.ba_date || todayISO()); setFNote(row.note || '')
 setItemsLoading(true)
 try {
 const [pl, existing] = await Promise.all([
 list('contract_price_list', { eq: { contract_id: row.contract_id, is_active: true }, order: { col: 'item_code', asc: true }, limit: 500 }),
 list('progress_claim_items', { eq: { claim_id: row.id }, order: { col: 'created_at', asc: true } }),
 ])
 setPriceListOptions(pl)
 const existingByPl: Record<string, any> = Object.fromEntries(existing.map((it: any) => [it.price_list_id, it]))
 const merged: Item[] = pl.map((p: any) => {
 const ex = existingByPl[p.id]
 return ex
 ? { id: ex.id, price_list_id: p.id, description: ex.description, uom: ex.uom, unit_price: Number(ex.unit_price) || 0, qty: Number(ex.qty) || 0 }
 : { price_list_id: p.id, description: `${p.item_code ? p.item_code + ' — ' : ''}${p.description ?? ''}`, uom: p.uom ?? '', unit_price: Number(p.unit_price) || 0, qty: 0 }
 })
 const plIds = new Set(pl.map((p: any) => p.id))
 const extras: Item[] = existing.filter((it: any) => !plIds.has(it.price_list_id)).map((it: any) => ({ id: it.id, price_list_id: it.price_list_id, description: it.description, uom: it.uom, unit_price: Number(it.unit_price) || 0, qty: Number(it.qty) || 0 }))
 setItems([...merged, ...extras])
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat item klaim untuk diubah', 'error') }
 finally { setItemsLoading(false) }
 setDetail(null)
 setModal(true)
 }

 function addItemRow() { setItems(v => [...v, { price_list_id: '', description: '', uom: '', unit_price: 0, qty: 0 }]) }
 function removeItemRow(idx: number) { setItems(v => v.filter((_, i) => i !== idx)) }
 function patchItemQty(idx: number, qty: number) { setItems(v => v.map((it, i) => i === idx ? { ...it, qty } : it)) }
 function onPickPriceItem(idx: number, priceListId: string) {
 const p = priceListOptions.find(x => x.id === priceListId)
 setItems(v => v.map((it, i) => i === idx ? {
 ...it, price_list_id: priceListId,
 description: p ? `${p.item_code ? p.item_code + ' — ' : ''}${p.description ?? ''}` : it.description,
 uom: p?.uom ?? it.uom, unit_price: p ? Number(p.unit_price) || 0 : it.unit_price,
 } : it))
 }

 const claimAmount = useMemo(() => items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0), [items])
 const contractIdForForm = formContractId ?? (fSpkId ? spkMap[fSpkId]?.contract_id : null)
 const retentionPercent = contractIdForForm ? Number(contractMap[contractIdForForm]?.retention_percent ?? 0) : 0
 const retentionAmount = Math.round(claimAmount * retentionPercent / 100)
 const netAmount = claimAmount - retentionAmount

 const save = async () => {
 if (!fSpkId) { toast.push('Pilih SPK terlebih dahulu', 'error'); return }
 const filledItems = items.filter(it => Number(it.qty) > 0)
 if (filledItems.length === 0) { toast.push('Isi minimal satu qty realisasi', 'error'); return }
 if (filledItems.some(it => !it.price_list_id)) { toast.push('Setiap baris item yang terisi wajib memilih item dari price list', 'error'); return }
 setSaving(true)
 try {
 if (editingId) {
 await update('progress_claims', editingId, {
 period_start: fPeriodStart || null, period_end: fPeriodEnd || null,
 claim_amount: claimAmount, retention_amount: retentionAmount,
 ba_no: fBaNo, ba_date: fBaDate || null, note: fNote,
 })
 const existing = await list('progress_claim_items', { eq: { claim_id: editingId } })
 for (const ex of existing) if (!filledItems.some(it => it.id === ex.id)) await remove('progress_claim_items', ex.id)
 for (const it of filledItems) {
 const amount = Number(it.qty) * Number(it.unit_price)
 if (it.id) await update('progress_claim_items', it.id, { price_list_id: it.price_list_id, description: it.description, uom: it.uom, qty: Number(it.qty), unit_price: Number(it.unit_price), amount })
 else await insert('progress_claim_items', { company_id: profile!.company_id, claim_id: editingId, price_list_id: it.price_list_id, description: it.description, uom: it.uom, qty: Number(it.qty), unit_price: Number(it.unit_price), amount })
 }
 toast.push('Klaim progres diperbarui', 'success')
 } else {
 const spk = spkMap[fSpkId]
 const claimNo = await nextDocNo(profile!.company_id, 'CLM')
 const claim = await insert<any>('progress_claims', {
 company_id: profile!.company_id, claim_no: claimNo, spk_id: fSpkId, contract_id: spk.contract_id,
 period_start: fPeriodStart || null, period_end: fPeriodEnd || null, progress_percent: 0,
 claim_amount: claimAmount, retention_amount: retentionAmount, status: 'draft',
 ba_no: fBaNo, ba_date: fBaDate || null, note: fNote,
 })
 for (const it of filledItems) {
 await insert('progress_claim_items', {
 company_id: profile!.company_id, claim_id: claim.id, price_list_id: it.price_list_id,
 description: it.description, uom: it.uom, qty: Number(it.qty), unit_price: Number(it.unit_price),
 amount: Number(it.qty) * Number(it.unit_price),
 })
 }
 toast.push('Klaim progres ditambahkan', 'success')
 }
 setModal(false); setEditingId(null); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan klaim', 'error') }
 finally { setSaving(false) }
 }

 const openDetail = async (row: any) => {
 setDetail(row); setDetailLoading(true)
 try { setDetailItems(await list('progress_claim_items', { eq: { claim_id: row.id }, order: { col: 'created_at', asc: true } })) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memuat item klaim', 'error') }
 finally { setDetailLoading(false) }
 }

 const changeStatus = async (status: string, note?: string) => {
 if (!detail) return
 try {
 const payload: any = { status }
 if (note != null) payload.note = note
 await update('progress_claims', detail.id, payload)
 toast.push('Status klaim diperbarui', 'success')
 setDetail({ ...detail, ...payload }); load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status', 'error') }
 }
 const doReject = async () => {
 if (!rejectReason.trim()) { toast.push('Alasan penolakan wajib diisi', 'error'); return }
 await changeStatus('ditolak', rejectReason)
 setRejectOpen(false); setRejectReason('')
 }
 const doDelete = async () => {
 if (!delId) return
 try { await remove('progress_claims', delId); toast.push('Klaim dihapus', 'success'); load() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus klaim', 'error') }
 }

 const columns = [
 { key: 'claim_no', header: 'No Klaim', width: '140px' },
 { key: 'spk_id', header: 'SPK', render: (r: any) => spkMap[r.spk_id]?.spk_no ?? '-' },
 { key: 'contract_id', header: 'Kontrak', render: (r: any) => contractMap[r.contract_id]?.contract_name ?? '-' },
 { key: 'periode', header: 'Periode', sortable: false, render: (r: any) => `${tgl(r.period_start)} – ${tgl(r.period_end)}` },
 { key: 'claim_amount', header: 'Nilai Klaim', align: 'right' as const, render: (r: any) => rupiah(r.claim_amount) },
 { key: 'retention_amount', header: 'Retensi', align: 'right' as const, render: (r: any) => rupiah(r.retention_amount) },
 { key: 'bersih', header: 'Nilai Bersih', align: 'right' as const, sortable: false, render: (r: any) => rupiah(Number(r.claim_amount) - Number(r.retention_amount)) },
 { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
 can('COMMERCE', 'approve') ? {
 key: 'aksi', header: '', width: '90px', sortable: false,
 render: (r: any) => <div onClick={e => e.stopPropagation()}><Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDelId(r.id)}>Hapus</Button></div>,
 } : null,
 ].filter(Boolean) as any

 const stepIdx = detail ? Math.max(0, CLAIM_STATUS_STEPS.indexOf(detail.status)) : 0

 return (
 <div>
 <PageHeader title="Klaim Progres / BA" subtitle="Klaim progres pekerjaan berdasarkan realisasi item price list per SPK."
 actions={can('COMMERCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Klaim</Button>} />

 {tarifAsumsiCount > 0 && (
 <div className="mb-4 px-3 py-2 rounded-sm bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-caption font-medium flex items-start gap-2">
 <AlertTriangle size={15} className="mt-0.5 shrink-0" />
 <span>{tarifAsumsiCount} harga satuan price list kontrak yang dipakai untuk menghitung nilai klaim progres masih berstatus <b>asumsi sistem</b>, belum diverifikasi ke kontrak sebenarnya. Kelola di menu Price List Kontrak.</span>
 </div>
 )}

 {loading ? <Card><TableSkeleton /></Card> : (
 <DataTable columns={columns} rows={rows} searchable searchKeys={['claim_no']} exportName="klaim-progres"
 onRowClick={openDetail} emptyTitle="Belum ada klaim progres" emptyMessage="Buat klaim progres dari SPK yang sedang berjalan."
 emptyAction={can('COMMERCE', 'write') && <Button size="sm" icon={<Plus size={16} />} onClick={openAdd}>Tambah Klaim</Button>} />
 )}

 <Modal open={modal} onClose={() => { setModal(false); setEditingId(null) }} title={editingId ? 'Ubah Klaim Progres' : 'Tambah Klaim Progres'} size="xl"
 footer={<><Button variant="outline" onClick={() => { setModal(false); setEditingId(null) }}>Batal</Button><Button loading={saving} onClick={save}>{editingId ? 'Simpan Perubahan' : 'Simpan Klaim'}</Button></>}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
 <Field label="SPK" required className="sm:col-span-2">
 <Select disabled={!!editingId} value={fSpkId} options={spkList.map(s => ({ value: s.id, label: `${s.spk_no} — ${s.title}` }))} onChange={(e: any) => pullPriceList(e.target.value)} />
 </Field>
 <Field label="Periode Mulai"><Input type="date" value={fPeriodStart} onChange={e => setFPeriodStart(e.target.value)} /></Field>
 <Field label="Periode Selesai"><Input type="date" value={fPeriodEnd} onChange={e => setFPeriodEnd(e.target.value)} /></Field>
 <Field label="No Berita Acara"><Input value={fBaNo} onChange={e => setFBaNo(e.target.value)} /></Field>
 <Field label="Tanggal Berita Acara"><Input type="date" value={fBaDate} onChange={e => setFBaDate(e.target.value)} /></Field>
 <Field label="Catatan" className="sm:col-span-2"><Textarea value={fNote} onChange={e => setFNote(e.target.value)} /></Field>
 </div>

 <div className="flex items-center justify-between mb-2">
 <h4 className="font-display font-semibold text-[13px] uppercase tracking-wide text-ink-500">Item Realisasi</h4>
 {(fSpkId || editingId) && <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={addItemRow}>Tambah Baris</Button>}
 </div>
 {itemsLoading ? <TableSkeleton rows={3} /> : items.length === 0 ? (
 <EmptyState title="Belum ada item" message="Pilih SPK untuk menarik item price list dari kontrak terkait, lalu isi qty realisasi atau tambah baris." />
 ) : (
 <div className="border border-ink-200 rounded-sm overflow-hidden mb-4 overflow-x-auto">
 <table className="w-full text-body">
 <thead className="bg-ink-50"><tr>
 <th className="px-3 py-2 text-left text-caption font-semibold text-ink-500 min-w-[220px]">Item</th>
 <th className="px-3 py-2 text-left text-caption font-semibold text-ink-500 w-20">Satuan</th>
 <th className="px-3 py-2 text-right text-caption font-semibold text-ink-500 w-32">Harga Satuan</th>
 <th className="px-3 py-2 text-right text-caption font-semibold text-ink-500 w-28">Qty Realisasi</th>
 <th className="px-3 py-2 text-right text-caption font-semibold text-ink-500 w-32">Nilai</th>
 <th className="px-3 py-2 w-10" />
 </tr></thead>
 <tbody>{items.map((it, i) => (
 <tr key={i} className="border-t border-ink-100">
 <td className="px-3 py-2">
 <Select value={it.price_list_id ?? ''} onChange={(e: any) => onPickPriceItem(i, e.target.value)}
 options={priceListOptions.map((p: any) => ({ value: p.id, label: `${p.item_code ? p.item_code + ' — ' : ''}${p.description ?? ''}` }))} />
 </td>
 <td className="px-3 py-2">{it.uom}</td>
 <td className="px-3 py-2 text-right tabular">{rupiah(it.unit_price)}</td>
 <td className="px-3 py-2">
 <input type="number" min={0} value={it.qty || ''} onChange={e => patchItemQty(i, Number(e.target.value) || 0)}
 className="w-full h-8 px-2 text-right rounded-xs border border-ink-200 bg-surface" />
 </td>
 <td className="px-3 py-2 text-right tabular">{rupiah((Number(it.qty) || 0) * it.unit_price)}</td>
 <td className="px-3 py-2 text-center"><button onClick={() => removeItemRow(i)} className="text-red-500 hover:text-red-700 text-caption">Hapus</button></td>
 </tr>))}</tbody>
 </table>
 </div>
 )}

 <Card className="p-4">
 <Desc cols={3} items={[
 { label: 'Nilai Klaim', value: rupiah(claimAmount) },
 { label: `Retensi (${retentionPercent}%)`, value: rupiah(retentionAmount) },
 { label: 'Nilai Bersih', value: <span className="font-semibold text-primary-600">{rupiah(netAmount)}</span> },
 ]} />
 </Card>
 </Modal>

 <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.claim_no} width="max-w-2xl"
 footer={detail && <>
 {detail.status === 'draft' && can('COMMERCE', 'write') && <Button variant="outline" onClick={() => openEditItems(detail)}>Ubah</Button>}
 {detail.status === 'draft' && can('COMMERCE', 'write') && <Button variant="outline" onClick={() => changeStatus('diajukan')}>Ajukan</Button>}
 {detail.status === 'diajukan' && can('COMMERCE', 'write') && <Button variant="outline" onClick={() => changeStatus('diverifikasi')}>Verifikasi</Button>}
 {detail.status === 'diverifikasi' && can('COMMERCE', 'approve') && <>
 <Button variant="danger" onClick={() => setRejectOpen(true)}>Tolak</Button>
 <Button variant="success" onClick={() => changeStatus('disetujui')}>Setujui</Button>
 </>}
 {detail.status === 'disetujui' && can('COMMERCE', 'write') && <Button variant="outline" onClick={() => changeStatus('ditagihkan')}>Tandai Ditagihkan</Button>}
 <Button variant="outline" icon={<Printer size={15} />} onClick={() => setPrintMode(true)}>Cetak BA</Button>
 </>}>
 {detail && (
 <>
 {detail.status !== 'ditolak' && <div className="mb-5"><Stepper steps={CLAIM_STATUS_STEPS} current={stepIdx} /></div>}
 {detail.status === 'ditolak' && <div className="mb-5"><Badge>ditolak</Badge>{detail.note && <p className="text-caption text-ink-500 mt-1">Alasan: {detail.note}</p>}</div>}
 <Section title="Ringkasan">
 <Desc items={[
 { label: 'SPK', value: spkMap[detail.spk_id]?.spk_no },
 { label: 'Kontrak', value: contractMap[detail.contract_id]?.contract_name },
 { label: 'Periode', value: `${tgl(detail.period_start)} – ${tgl(detail.period_end)}` },
 { label: 'No Berita Acara', value: detail.ba_no },
 { label: 'Tanggal BA', value: tgl(detail.ba_date) },
 { label: 'Nilai Klaim', value: rupiah(detail.claim_amount) },
 { label: 'Retensi', value: rupiah(detail.retention_amount) },
 { label: 'Nilai Bersih', value: rupiah(Number(detail.claim_amount) - Number(detail.retention_amount)) },
 { label: 'Catatan', value: detail.note },
 ]} />
 </Section>
 <Section title="Item Realisasi">
 {detailLoading ? <TableSkeleton rows={3} /> : detailItems.length === 0 ? <EmptyState title="Belum ada item" /> : (
 <div className="space-y-2">{detailItems.map((it: any) => (
 <Card key={it.id} className="p-3 flex items-center justify-between gap-3">
 <div><p className="text-body">{it.description}</p><p className="text-caption text-ink-500">{num(it.qty)} {it.uom} × {rupiah(it.unit_price)}</p></div>
 <p className="text-body tabular font-medium">{rupiah(it.amount)}</p>
 </Card>))}</div>)}
 </Section>
 </>)}
 </Drawer>

 {printMode && detail && (
 <div className="fixed inset-0 z-[200] bg-surface overflow-auto p-8">
 <div className="print:hidden flex justify-end mb-4"><Button variant="outline" onClick={() => setPrintMode(false)}>Tutup</Button><Button className="ml-2" onClick={() => window.print()}>Cetak</Button></div>
 <div className="max-w-2xl mx-auto text-ink-900">
 <h1 className="text-center font-display text-xl font-bold mb-1">BERITA ACARA KLAIM PROGRES PEKERJAAN</h1>
 <p className="text-center text-body mb-6">{company?.name}</p>
 <table className="w-full text-body mb-4"><tbody>
 <tr><td className="py-0.5 w-40">No Klaim</td><td>: {detail.claim_no}</td></tr>
 <tr><td className="py-0.5">No Berita Acara</td><td>: {detail.ba_no || '-'}</td></tr>
 <tr><td className="py-0.5">Tanggal BA</td><td>: {tgl(detail.ba_date)}</td></tr>
 <tr><td className="py-0.5">SPK</td><td>: {spkMap[detail.spk_id]?.spk_no} — {spkMap[detail.spk_id]?.title}</td></tr>
 <tr><td className="py-0.5">Kontrak</td><td>: {contractMap[detail.contract_id]?.contract_name}</td></tr>
 <tr><td className="py-0.5">Periode</td><td>: {tgl(detail.period_start)} – {tgl(detail.period_end)}</td></tr>
 </tbody></table>
 <table className="w-full text-body border border-ink-300 mb-4">
 <thead><tr className="border-b border-ink-300">
 <th className="text-left p-2 border-r border-ink-300">Deskripsi</th>
 <th className="text-right p-2 border-r border-ink-300 w-20">Qty</th>
 <th className="text-right p-2 border-r border-ink-300 w-32">Harga Satuan</th>
 <th className="text-right p-2 w-32">Nilai</th>
 </tr></thead>
 <tbody>{detailItems.map((it: any) => (
 <tr key={it.id} className="border-b border-ink-200">
 <td className="p-2 border-r border-ink-300">{it.description}</td>
 <td className="p-2 border-r border-ink-300 text-right">{num(it.qty)} {it.uom}</td>
 <td className="p-2 border-r border-ink-300 text-right">{rupiah(it.unit_price)}</td>
 <td className="p-2 text-right">{rupiah(it.amount)}</td>
 </tr>))}</tbody>
 </table>
 <p className="text-body mb-1">Nilai Klaim: <b>{rupiah(detail.claim_amount)}</b></p>
 <p className="text-body mb-1">Retensi: <b>{rupiah(detail.retention_amount)}</b></p>
 <p className="text-body mb-6">Nilai Bersih Ditagihkan: <b>{rupiah(Number(detail.claim_amount) - Number(detail.retention_amount))}</b></p>
 <div className="grid grid-cols-2 gap-8 mt-16 text-center text-body">
 <div><p>Diserahkan oleh,</p><div className="h-20" /><p className="border-t border-ink-400 pt-1">Kontraktor</p></div>
 <div><p>Diterima oleh,</p><div className="h-20" /><p className="border-t border-ink-400 pt-1">Pelanggan</p></div>
 </div>
 </div>
 </div>
 )}

 <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Tolak Klaim"
 footer={<><Button variant="outline" onClick={() => setRejectOpen(false)}>Batal</Button><Button variant="danger" onClick={doReject}>Tolak Klaim</Button></>}>
 <Field label="Alasan Penolakan" required><Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} /></Field>
 </Modal>

 <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={doDelete} danger
 title="Hapus Klaim" message="Klaim progres akan dihapus permanen. Lanjutkan?" confirmLabel="Ya, Hapus" />
 </div>
 )
}
