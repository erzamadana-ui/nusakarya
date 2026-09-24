import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import { rupiah, tgl, todayISO, exportCSV } from '@/lib/format'
import {
 PageHeader, Tabs, DataTable, Badge, Drawer, Modal, Field, Input, Select, Money, Textarea, Button,
 useToast, EmptyState, Section, Desc,
} from '@/components/ui'
import { CheckCircle2, XCircle, Download } from 'lucide-react'
import { sisaTagihan, umurLabel } from '../lib/helpers'

const rp = (v: any) => rupiah(Number(v) || 0)

function tabOf(inv: any): 'verifikasi' | 'disetujui' | 'jatuh_tempo' | 'lunas' {
 if (inv.status === 'lunas') return 'lunas'
 if (['draft', 'diajukan'].includes(inv.status)) return 'verifikasi'
 const sisa = sisaTagihan(inv.total, inv.paid_amount)
 const u = umurLabel(inv.due_date)
 if (sisa > 0 && u.days != null && u.days > 0) return 'jatuh_tempo'
 return 'disetujui'
}

function checklistFor(inv: any) {
 const items = [
 { key: 'po', label: 'Purchase Order (PO) tertaut', ok: !!inv.po_id },
 { key: 'gr', label: 'Good Receive (GR) tertaut', ok: !!inv.gr_id },
 { key: 'pajak', label: 'Nomor faktur pajak terisi', ok: !!inv.faktur_pajak_no },
 { key: 'rek', label: 'Nomor rekening vendor terisi', ok: !!inv.vendor?.bank_account },
 ]
 return { items, complete: items.every(i => i.ok), missing: items.filter(i => !i.ok).map(i => i.label) }
}

export default function AP() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [tab, setTab] = useState<'verifikasi' | 'disetujui' | 'jatuh_tempo' | 'lunas'>('verifikasi')
 const [selected, setSelected] = useState<string[]>([])
 const [detail, setDetail] = useState<any | null>(null)
 const [detailPayments, setDetailPayments] = useState<any[]>([])
 const [batchOpen, setBatchOpen] = useState(false)
 const [batchForm, setBatchForm] = useState<any>({ payment_date: todayISO(), method: 'Transfer Bank', bank_ref: '', note: '' })
 const [payOpen, setPayOpen] = useState(false)
 const [payForm, setPayForm] = useState<any>({ payment_date: todayISO(), amount: 0, method: 'Transfer Bank', bank_ref: '', note: '' })
 const [rejectOpen, setRejectOpen] = useState(false)
 const [rejectReason, setRejectReason] = useState('')
 const [busy, setBusy] = useState(false)

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

 async function load() {
 setLoading(true)
 try {
 const data = await list('vendor_invoices', {
 select: 'id,inv_no,vendor_invoice_no,invoice_date,due_date,dpp,ppn,pph23,total,paid_amount,match_status,match_note,status,po_id,gr_id,faktur_pajak_no,vendor_id,file_url,vendor:vendors(id,name,bank_name,bank_account,bank_holder,payment_term_days),po:purchase_orders(po_no),gr:goods_receipts(gr_no)',
 eq: { company_id: profile!.company_id }, order: { col: 'invoice_date', asc: false }, limit: 2000,
 })
 setRows(data)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat invoice vendor', 'error') } finally { setLoading(false) }
 }

 const withTab = useMemo(() => rows.map(r => ({ ...r, _tab: tabOf(r), _sisa: sisaTagihan(r.total, r.paid_amount), _umur: umurLabel(r.due_date) })), [rows])
 const counts = useMemo(() => ({
 verifikasi: withTab.filter(r => r._tab === 'verifikasi').length,
 disetujui: withTab.filter(r => r._tab === 'disetujui').length,
 jatuh_tempo: withTab.filter(r => r._tab === 'jatuh_tempo').length,
 lunas: withTab.filter(r => r._tab === 'lunas').length,
 }), [withTab])
 const view = useMemo(() => withTab.filter(r => r._tab === tab), [withTab, tab])

 function pesanGagalRls(e: any, aksi: string) {
 const msg = String(e?.message ?? '')
 if (/row-level security|permission denied|RLS/i.test(msg)) {
 return `Gagal ${aksi}: Anda tidak memiliki hak yang cukup pada modul Finance. Hubungi admin untuk memberi hak akses.`
 }
 return msg || `Gagal ${aksi}`
 }

 async function openDetail(row: any) {
 setDetail(row)
 setPayForm({ payment_date: todayISO(), amount: sisaTagihan(row.total, row.paid_amount), method: 'Transfer Bank', bank_ref: '', note: '' })
 try {
 const pays = await list('ap_payments', { eq: { invoice_id: row.id }, order: { col: 'payment_date', asc: false }, limit: 100 })
 setDetailPayments(pays)
 } catch { setDetailPayments([]) }
 }

 async function catatPembayaran() {
 if (!detail) return
 const amount = Number(payForm.amount) || 0
 const sisa = sisaTagihan(detail.total, detail.paid_amount)
 if (amount <= 0) { toast.push('Jumlah pembayaran harus lebih dari 0.', 'error'); return }
 if (amount > sisa) { toast.push('Jumlah pembayaran tidak boleh melebihi sisa tagihan.', 'error'); return }
 setBusy(true)
 try {
 const paymentNo = await nextDocNo(profile!.company_id, 'AP')
 const payment = await insert('ap_payments', {
 company_id: profile!.company_id, payment_no: paymentNo, payment_date: payForm.payment_date,
 vendor_id: detail.vendor_id, invoice_id: detail.id, amount, method: payForm.method,
 bank_ref: payForm.bank_ref || null, note: payForm.note || null, status: 'selesai',
 })
 const newPaid = Number(detail.paid_amount || 0) + amount
 const newStatus = newPaid >= Number(detail.total || 0) ? 'lunas' : 'dibayar_sebagian'
 await update('vendor_invoices', detail.id, { paid_amount: newPaid, status: newStatus })
 try {
 await insert('cash_flows', {
 company_id: profile!.company_id, flow_date: payForm.payment_date, direction: 'out',
 category: 'Pembayaran Vendor (AP)', description: `${detail.inv_no} — ${detail.vendor?.name ?? ''}`,
 amount, ref_type: 'ap_payments', ref_id: payment.id,
 })
 } catch (eKas: any) {
 // Pembayaran sudah tercatat sehingga tidak dibatalkan — tetapi kegagalan ini TIDAK
 // boleh disembunyikan: arus kas yang tidak tercatat membuat proyeksi kas salah.
 toast.push(`Pembayaran tersimpan, tetapi pencatatan arus kas GAGAL: ${eKas?.message ?? 'penyebab tidak diketahui'}. Catat manual di menu Arus Kas.`, 'error')
 }
 toast.push('Pembayaran berhasil dicatat.', 'success')
 setPayOpen(false); setDetail(null); await load()
 } catch (e: any) { toast.push(pesanGagalRls(e, 'mencatat pembayaran'), 'error') } finally { setBusy(false) }
 }

 async function doVerifikasi(inv: any) {
 setBusy(true)
 try {
 await update('vendor_invoices', inv.id, { status: 'diverifikasi' })
 toast.push('Invoice diverifikasi.', 'success')
 await load(); setDetail(null)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memverifikasi', 'error') } finally { setBusy(false) }
 }
 async function doAjukanPembayaran(inv: any) {
 const chk = checklistFor(inv)
 if (!chk.complete) { toast.push('Dokumen belum lengkap: ' + chk.missing.join(', '), 'error'); return }
 setBusy(true)
 try {
 await update('vendor_invoices', inv.id, { status: 'disetujui' })
 toast.push('Invoice diajukan untuk pembayaran.', 'success')
 await load(); setDetail(null)
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengajukan pembayaran', 'error') } finally { setBusy(false) }
 }
 function openReject() { setRejectReason(''); setRejectOpen(true) }
 async function submitTolak() {
 if (!detail) return
 if (!rejectReason.trim()) { toast.push('Alasan penolakan wajib diisi.', 'error'); return }
 setBusy(true)
 try {
 await insert('approvals', {
 company_id: profile!.company_id, entity_type: 'vendor_invoice', entity_id: detail.id, step: 1,
 status: 'rejected', note: rejectReason.trim(), approver_id: profile!.id, acted_at: new Date().toISOString(), created_by: profile!.id,
 })
 await update('vendor_invoices', detail.id, { status: 'ditolak' })
 toast.push('Invoice ditolak. Alasan penolakan tercatat.', 'success')
 setRejectOpen(false); await load(); setDetail(null)
 } catch (e: any) { toast.push(pesanGagalRls(e, 'menolak invoice'), 'error') } finally { setBusy(false) }
 }

 const selectedInvoices = useMemo(() => view.filter(r => selected.includes(r.id) && checklistFor(r).complete), [view, selected])
 const batchTotal = useMemo(() => selectedInvoices.reduce((s, r) => s + r._sisa, 0), [selectedInvoices])

 function csvRowsForBatch() {
 const byVendor: Record<string, { vendor: string; bank: string; rekening: string; atasNama: string; nominal: number }> = {}
 selectedInvoices.forEach(r => {
 const key = r.vendor_id
 if (!byVendor[key]) byVendor[key] = {
 vendor: r.vendor?.name ?? '-', bank: r.vendor?.bank_name ?? '-', rekening: r.vendor?.bank_account ?? '-',
 atasNama: r.vendor?.bank_holder ?? r.vendor?.name ?? '-', nominal: 0,
 }
 byVendor[key].nominal += r._sisa
 })
 return Object.values(byVendor).map(v => ({
 'Nama Vendor': v.vendor, Bank: v.bank, 'Nomor Rekening': v.rekening, 'Atas Nama': v.atasNama, 'Nominal (Rp)': v.nominal,
 }))
 }
 function unduhCsv() {
 if (selectedInvoices.length === 0) { toast.push('Pilih invoice terlebih dahulu.', 'error'); return }
 exportCSV(csvRowsForBatch(), `daftar-transfer-ap-${todayISO()}`)
 }

 async function buatBatchPembayaran() {
 if (selectedInvoices.length === 0) { toast.push('Pilih invoice terlebih dahulu.', 'error'); return }
 setBusy(true)
 try {
 for (const inv of selectedInvoices) {
 const paymentNo = await nextDocNo(profile!.company_id, 'AP')
 const payment = await insert('ap_payments', {
 company_id: profile!.company_id, payment_no: paymentNo, payment_date: batchForm.payment_date,
 vendor_id: inv.vendor_id, invoice_id: inv.id, amount: inv._sisa, method: batchForm.method,
 bank_ref: batchForm.bank_ref || null, note: batchForm.note || null, status: 'selesai',
 })
 await update('vendor_invoices', inv.id, { paid_amount: Number(inv.paid_amount || 0) + inv._sisa, status: 'lunas' })
 try {
 await insert('cash_flows', {
 company_id: profile!.company_id, flow_date: batchForm.payment_date, direction: 'out',
 category: 'Pembayaran Vendor (AP)', description: `${inv.inv_no} — ${inv.vendor?.name ?? ''}`,
 amount: inv._sisa, ref_type: 'ap_payments', ref_id: payment.id,
 })
 } catch { /* pencatatan kas gagal tidak membatalkan pembayaran yang sudah tercatat */ }
 }
 toast.push(`Batch pembayaran untuk ${selectedInvoices.length} invoice berhasil dibuat.`, 'success')
 setBatchOpen(false); setSelected([]); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal membuat batch pembayaran', 'error') } finally { setBusy(false) }
 }

 const tabs = [
 { value: 'verifikasi', label: 'Perlu Verifikasi', count: counts.verifikasi },
 { value: 'disetujui', label: 'Disetujui Belum Bayar', count: counts.disetujui },
 { value: 'jatuh_tempo', label: 'Jatuh Tempo', count: counts.jatuh_tempo },
 { value: 'lunas', label: 'Lunas', count: counts.lunas },
 ]

 return (
 <div>
 <PageHeader title="Hutang & Pembayaran Mitra (AP)" subtitle="Verifikasi, kelola dokumen wajib, dan bayar invoice vendor tepat waktu." />

 <Tabs tabs={tabs} value={tab} onChange={(v: any) => { setTab(v); setSelected([]) }} className="mb-4" />

 <DataTable
 loading={loading}
 rows={view}
 rowKey="id"
 onRowClick={openDetail}
 selectable={tab === 'disetujui'}
 onSelect={setSelected}
 searchKeys={['inv_no', 'vendor_invoice_no']}
 exportName={`ap-invoices-${tab}`}
 emptyTitle="Tidak ada invoice"
 emptyMessage={tab === 'verifikasi' ? 'Belum ada invoice vendor yang perlu diverifikasi.' : tab === 'jatuh_tempo' ? 'Tidak ada invoice yang jatuh tempo.' : 'Belum ada data pada tab ini.'}
 toolbar={tab === 'disetujui' && can('FINANCE', 'approve') ? (
 <Button size="sm" disabled={selected.length === 0} onClick={() => setBatchOpen(true)}>Buat Batch Pembayaran ({selected.length})</Button>
 ) : undefined}
 columns={[
 { key: 'inv_no', header: 'No Invoice', render: (r) => <div><div className="font-medium text-ink-900">{r.inv_no}</div>{r.vendor_invoice_no && <div className="text-caption text-ink-400">{r.vendor_invoice_no}</div>}</div> },
 { key: 'vendor', header: 'Vendor', render: (r) => r.vendor?.name ?? '-' },
 { key: 'invoice_date', header: 'Tanggal', render: (r) => tgl(r.invoice_date) },
 { key: 'due_date', header: 'Jatuh Tempo', render: (r) => tgl(r.due_date) },
 { key: 'dpp', header: 'DPP', align: 'right', render: (r) => rp(r.dpp) },
 { key: 'ppn', header: 'PPN', align: 'right', render: (r) => rp(r.ppn) },
 { key: 'pph23', header: 'PPh 23', align: 'right', render: (r) => rp(r.pph23) },
 { key: 'total', header: 'Total', align: 'right', render: (r) => rp(r.total) },
 { key: 'paid_amount', header: 'Sudah Dibayar', align: 'right', render: (r) => rp(r.paid_amount) },
 { key: '_sisa', header: 'Sisa', align: 'right', render: (r) => <span className="font-medium">{rp(r._sisa)}</span> },
 { key: '_umur', header: 'Umur Hutang', render: (r) => <Badge tone={r._umur.tone}>{r._umur.label}</Badge> },
 { key: 'match_status', header: 'Match 3-Way', align: 'center', render: (r) => <Badge>{r.match_status}</Badge> },
 { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
 ]}
 />

 <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.inv_no} width="max-w-2xl"
 footer={detail && (
 <>
 {['draft', 'diajukan', 'diverifikasi'].includes(detail.status) && can('FINANCE', 'approve') && (
 <Button variant="danger" loading={busy} onClick={openReject}>Tolak</Button>
 )}
 {(detail.status === 'draft' || detail.status === 'diajukan') && can('FINANCE', 'write') && (
 <Button variant="outline" loading={busy} onClick={() => doVerifikasi(detail)}>Verifikasi</Button>
 )}
 {detail.status === 'diverifikasi' && can('FINANCE', 'approve') && (
 <Button loading={busy} disabled={!checklistFor(detail).complete} onClick={() => doAjukanPembayaran(detail)}>Ajukan Pembayaran</Button>
 )}
 {['disetujui', 'dibayar_sebagian'].includes(detail.status) && can('FINANCE', 'write') && (
 <Button loading={busy} onClick={() => setPayOpen(true)}>Catat Pembayaran</Button>
 )}
 </>
 )}>
 {detail && (() => {
 const chk = checklistFor(detail)
 const umur = umurLabel(detail.due_date)
 return (
 <>
 <Section title="Ringkasan">
 <Desc cols={2} items={[
 { label: 'Vendor', value: detail.vendor?.name },
 { label: 'Status', value: <Badge>{detail.status}</Badge> },
 { label: 'Tanggal Invoice', value: tgl(detail.invoice_date) },
 { label: 'Jatuh Tempo', value: tgl(detail.due_date) },
 { label: 'Total', value: rp(detail.total) },
 { label: 'Sudah Dibayar', value: rp(detail.paid_amount) },
 { label: 'Sisa', value: rp(sisaTagihan(detail.total, detail.paid_amount)) },
 { label: 'Umur Hutang', value: <Badge tone={umur.tone}>{umur.label}</Badge> },
 { label: 'Status Match 3-Way', value: <Badge>{detail.match_status}</Badge> },
 { label: 'Catatan Match', value: detail.match_note || '-' },
 { label: 'No PO', value: detail.po?.po_no || '-' },
 { label: 'No GR', value: detail.gr?.gr_no || '-' },
 { label: 'No Faktur Pajak', value: detail.faktur_pajak_no || '-' },
 { label: 'Rekening Vendor', value: detail.vendor?.bank_account ? `${detail.vendor?.bank_name ?? ''} — ${detail.vendor?.bank_account}` : '-' },
 ]} />
 </Section>
 <Section title="Checklist Dokumen Wajib Sebelum Dibayar">
 <div className="space-y-2">
 {chk.items.map(it => (
 <div key={it.key} className="flex items-center gap-2 text-body">
 {it.ok ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <XCircle size={16} className="text-red-500 shrink-0" />}
 <span className={it.ok ? 'text-ink-700' : 'text-red-600'}>{it.label}</span>
 </div>
 ))}
 </div>
 {!chk.complete && <p className="text-caption text-red-600 mt-2">Belum bisa diajukan ke pembayaran — lengkapi: {chk.missing.join(', ')}.</p>}
 </Section>
 <Section title="Riwayat Pembayaran Parsial">
 {detailPayments.length === 0 ? <EmptyState title="Belum ada pembayaran" message="Belum ada transaksi pembayaran tercatat untuk invoice ini." /> : (
 <div className="border border-ink-200 rounded-md divide-y divide-ink-200">
 {detailPayments.map(p => (
 <div key={p.payment_no} className="flex items-center justify-between px-3 py-2 text-body">
 <div><div className="font-medium">{p.payment_no}</div><div className="text-caption text-ink-400">{tgl(p.payment_date)} · {p.method ?? '-'}</div></div>
 <div className="font-medium tabular">{rp(p.amount)}</div>
 </div>
 ))}
 </div>
 )}
 </Section>
 </>
 )
 })()}
 </Drawer>

 <Modal open={batchOpen} onClose={() => setBatchOpen(false)} title="Buat Batch Pembayaran" size="lg"
 footer={<>
 <Button variant="outline" icon={<Download size={14} />} onClick={unduhCsv}>Unduh CSV Transfer</Button>
 <Button loading={busy} onClick={buatBatchPembayaran}>Buat Pembayaran ({selectedInvoices.length})</Button>
 </>}>
 <div className="grid sm:grid-cols-2 gap-3 mb-4">
 <Field label="Tanggal Pembayaran" required>
 <Input type="date" value={batchForm.payment_date} onChange={(e: any) => setBatchForm((f: any) => ({ ...f, payment_date: e.target.value }))} />
 </Field>
 <Field label="Metode">
 <Select value={batchForm.method} onChange={(e: any) => setBatchForm((f: any) => ({ ...f, method: e.target.value }))}
 options={['Transfer Bank', 'Giro', 'Kliring']} />
 </Field>
 <Field label="Referensi / Catatan Bank" className="sm:col-span-2">
 <Input value={batchForm.bank_ref} onChange={(e: any) => setBatchForm((f: any) => ({ ...f, bank_ref: e.target.value }))} placeholder="No. referensi transfer (opsional)" />
 </Field>
 <Field label="Catatan Batch" className="sm:col-span-2">
 <Textarea rows={2} value={batchForm.note} onChange={(e: any) => setBatchForm((f: any) => ({ ...f, note: e.target.value }))} placeholder="Opsional" />
 </Field>
 </div>
 <p className="text-caption text-ink-500 mb-2">{selectedInvoices.length} invoice dipilih, total {rp(batchTotal)}. Setiap invoice akan dilunasi penuh sebesar sisa tagihannya.</p>
 <div className="border border-ink-200 rounded-md divide-y divide-ink-200 max-h-52 overflow-y-auto">
 {selectedInvoices.map(r => (
 <div key={r.id} className="flex items-center justify-between px-3 py-2 text-body">
 <div><div className="font-medium">{r.inv_no}</div><div className="text-caption text-ink-400">{r.vendor?.name}</div></div>
 <div className="tabular">{rp(r._sisa)}</div>
 </div>
 ))}
 </div>
 </Modal>

 <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Catat Pembayaran" size="sm"
 footer={<Button loading={busy} onClick={catatPembayaran}>Simpan</Button>}>
 <div className="space-y-3">
 <Desc cols={2} items={[
 { label: 'Vendor', value: detail?.vendor?.name },
 { label: 'Sisa Tagihan', value: detail ? rp(sisaTagihan(detail.total, detail.paid_amount)) : '-' },
 ]} />
 <Field label="Tanggal Pembayaran" required><Input type="date" value={payForm.payment_date} onChange={(e: any) => setPayForm((f: any) => ({ ...f, payment_date: e.target.value }))} /></Field>
 <Field label="Jumlah" required hint="Boleh sebagian — sisa tagihan akan berstatus 'dibayar sebagian'.">
 <Money value={payForm.amount} onChange={(v: number) => setPayForm((f: any) => ({ ...f, amount: v }))} />
 </Field>
 <Field label="Metode"><Select value={payForm.method} onChange={(e: any) => setPayForm((f: any) => ({ ...f, method: e.target.value }))} options={['Transfer Bank', 'Giro', 'Kliring']} /></Field>
 <Field label="Referensi Bank"><Input value={payForm.bank_ref} onChange={(e: any) => setPayForm((f: any) => ({ ...f, bank_ref: e.target.value }))} placeholder="Opsional" /></Field>
 <Field label="Catatan"><Textarea rows={2} value={payForm.note} onChange={(e: any) => setPayForm((f: any) => ({ ...f, note: e.target.value }))} placeholder="Opsional" /></Field>
 </div>
 </Modal>

 <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Tolak Invoice" size="sm"
 footer={<Button variant="danger" loading={busy} onClick={submitTolak}>Tolak Invoice</Button>}>
 <div className="space-y-3">
 <p className="text-body text-ink-600">Invoice <strong>{detail?.inv_no}</strong> dari <strong>{detail?.vendor?.name}</strong> akan ditolak.</p>
 <Field label="Alasan Penolakan" required>
 <Textarea rows={3} value={rejectReason} onChange={(e: any) => setRejectReason(e.target.value)} placeholder="Jelaskan alasan invoice ditolak (mis. dokumen tidak sesuai, nilai tidak cocok PO)" />
 </Field>
 </div>
 </Modal>
 </div>
 )
}
