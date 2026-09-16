import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo, uploadFile, signedUrl } from '@/lib/db'
import { rupiah, tgl, exportCSV } from '@/lib/format'
import {
 PageHeader, FilterBar, Tabs, Card, DataTable, Badge, Modal, Field, Input, Select, Money, Textarea, Button,
 useToast, KpiCard, Download, Plus,
} from '@/components/ui'
import { Paperclip } from 'lucide-react'
import { TAX_TYPES, TAX_TYPE_LABEL, currentPeriod, periodLabel } from '../lib/helpers'

const rp = (v: any) => rupiah(Number(v) || 0)

const emptyForm = { tax_type: '', tax_period: currentPeriod(), counterparty_name: '', counterparty_npwp: '', dpp: 0, tax_amount: 0, faktur_no: '', bukti_potong_no: '' }

export default function Pajak() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [summary, setSummary] = useState<any[]>([])
 const [tab, setTab] = useState(TAX_TYPES[0].value)
 const [period, setPeriod] = useState(currentPeriod())

 const [modalOpen, setModalOpen] = useState(false)
 const [form, setForm] = useState<any>(emptyForm)
 const [busy, setBusy] = useState(false)
 const [uploadingId, setUploadingId] = useState<string | null>(null)
 const [koreksiRow, setKoreksiRow] = useState<any>(null)
 const [koreksiReason, setKoreksiReason] = useState('')
 const [koreksiBusy, setKoreksiBusy] = useState(false)

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

 async function load() {
 setLoading(true)
 try {
 const [tr, sm] = await Promise.all([
 list('tax_records', { eq: { company_id: profile!.company_id }, order: { col: 'tax_period', asc: false }, limit: 5000 }),
 list('v_tax_summary', { eq: { company_id: profile!.company_id }, limit: 5000 }),
 ])
 setRows(tr); setSummary(sm)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data pajak', 'error') } finally { setLoading(false) }
 }

 const rowsForTab = useMemo(() => rows.filter(r => r.tax_type === tab), [rows, tab])
 const summaryForTab = useMemo(() => summary.filter(s => s.tax_type === tab).sort((a, b) => String(b.tax_period).localeCompare(String(a.tax_period))), [summary, tab])

 const kpi = useMemo(() => {
 const sumType = (type: string) => summary.filter(s => s.tax_period === period && s.tax_type === type).reduce((s, r) => s + Number(r.total_tax || 0), 0)
 const ppnKeluaran = sumType('ppn_keluaran')
 const ppnMasukan = sumType('ppn_masukan')
 const pphTotal = ['pph21', 'pph23', 'pph4a2', 'pph_final'].reduce((s, t) => s + sumType(t), 0)
 return { ppnKeluaran, ppnMasukan, selisihPpn: ppnKeluaran - ppnMasukan, pphTotal }
 }, [summary, period])

 function openAdd() { setForm({ ...emptyForm, tax_type: tab, tax_period: period }); setModalOpen(true) }

 async function simpan() {
 if (!form.tax_type) { toast.push('Jenis pajak wajib dipilih.', 'error'); return }
 if (!form.tax_period) { toast.push('Masa pajak wajib diisi.', 'error'); return }
 if (!form.counterparty_name.trim()) { toast.push('Nama lawan transaksi wajib diisi.', 'error'); return }
 if (!form.dpp || Number(form.dpp) <= 0) { toast.push('DPP harus lebih dari 0.', 'error'); return }
 setBusy(true)
 try {
 const recordNo = await nextDocNo(profile!.company_id, 'TAX')
 const isPpn = form.tax_type.startsWith('ppn')
 await insert('tax_records', {
 company_id: profile!.company_id, record_no: recordNo, tax_type: form.tax_type, tax_period: form.tax_period,
 counterparty_name: form.counterparty_name.trim(), counterparty_npwp: form.counterparty_npwp || null,
 dpp: Number(form.dpp), tax_amount: Number(form.tax_amount) || 0,
 faktur_no: isPpn ? (form.faktur_no || null) : null, bukti_potong_no: !isPpn ? (form.bukti_potong_no || null) : null,
 status: 'draft', created_by: profile!.id,
 })
 toast.push('Data pajak ditambahkan.', 'success')
 setModalOpen(false); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan data pajak', 'error') } finally { setBusy(false) }
 }

 function pesanGagal(e: any, aksi: string) {
 const msg = String(e?.message ?? '')
 if (/row-level security|permission denied|RLS/i.test(msg)) {
 return `Gagal ${aksi}: Anda tidak memiliki hak Tulis pada modul Finance. Hubungi admin untuk memberi hak akses.`
 }
 return msg || `Gagal ${aksi}`
 }

 async function tandaiDilaporkan(row: any) {
 try { await update('tax_records', row.id, { status: 'dilaporkan' }); toast.push('Ditandai sudah dilaporkan.', 'success'); await load() }
 catch (e: any) { toast.push(pesanGagal(e, 'memperbarui status'), 'error') }
 }

 function openKoreksi(row: any) { setKoreksiRow(row); setKoreksiReason(''); }
 async function submitKoreksi() {
 if (!koreksiRow) return
 if (!koreksiReason.trim()) { toast.push('Alasan koreksi wajib diisi.', 'error'); return }
 setKoreksiBusy(true)
 try {
 // tax_records tidak punya kolom catatan — alasan koreksi dicatat di tabel approvals untuk jejak audit.
 await insert('approvals', {
 company_id: profile!.company_id, entity_type: 'tax_record', entity_id: koreksiRow.id, step: 1,
 status: 'skipped', note: `Dikoreksi: ${koreksiReason.trim()}`, approver_id: profile!.id,
 acted_at: new Date().toISOString(), created_by: profile!.id,
 })
 await update('tax_records', koreksiRow.id, { status: 'dikoreksi' })
 toast.push('Data pajak ditandai dikoreksi. Alasan koreksi tercatat untuk audit.', 'success')
 setKoreksiRow(null); await load()
 } catch (e: any) { toast.push(pesanGagal(e, 'menandai dikoreksi'), 'error') } finally { setKoreksiBusy(false) }
 }

 async function unggahBerkas(row: any, file: File) {
 setUploadingId(row.id)
 try {
 const path = await uploadFile(profile!.company_id, 'tax-records', file)
 await update('tax_records', row.id, { file_url: path })
 toast.push('Berkas terunggah.', 'success'); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengunggah berkas', 'error') } finally { setUploadingId(null) }
 }
 async function lihatBerkas(row: any) {
 const u = await signedUrl(row.file_url)
 if (u) window.open(u, '_blank'); else toast.push('Berkas belum diunggah.', 'error')
 }

 function eksporMasa() {
 const data = rowsForTab.filter(r => r.tax_period === period)
 if (!data.length) { toast.push('Tidak ada data pada masa pajak ini.', 'error'); return }
 const isPpn = tab.startsWith('ppn')
 exportCSV(data.map(r => ({
 'Masa Pajak': r.tax_period, 'Lawan Transaksi': r.counterparty_name, NPWP: r.counterparty_npwp || '-',
 DPP: Number(r.dpp), 'Nilai Pajak': Number(r.tax_amount),
 [isPpn ? 'No Faktur' : 'No Bukti Potong']: (isPpn ? r.faktur_no : r.bukti_potong_no) || '-', Status: r.status,
 })), `pajak-${tab}-${period}`)
 }

 const isPpnTab = tab.startsWith('ppn')

 return (
 <div>
 <PageHeader title="Pusat Pajak" subtitle="Rekap PPN Keluaran/Masukan dan PPh yang dipotong per masa pajak."
 actions={<>
 <Button variant="outline" icon={<Download size={16} />} onClick={eksporMasa}>Ekspor CSV Masa Ini</Button>
 {can('FINANCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Data Pajak</Button>}
 </>} />

 <FilterBar>
 <Field label="Masa Pajak (untuk kartu ringkasan)"><Input type="month" value={period} onChange={(e: any) => setPeriod(e.target.value)} /></Field>
 </FilterBar>

 <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
 <KpiCard label="PPN Keluaran" value={rp(kpi.ppnKeluaran)} sub={periodLabel(period)} tone="blue" />
 <KpiCard label="PPN Masukan" value={rp(kpi.ppnMasukan)} sub={periodLabel(period)} tone="amber" />
 <KpiCard label={kpi.selisihPpn >= 0 ? 'PPN Kurang Bayar' : 'PPN Lebih Bayar'} value={rp(Math.abs(kpi.selisihPpn))} sub="Keluaran − Masukan" tone={kpi.selisihPpn >= 0 ? 'red' : 'emerald'} />
 <KpiCard label="Total PPh Dipotong" value={rp(kpi.pphTotal)} sub={periodLabel(period)} tone="teal" />
 </div>

 <Tabs tabs={TAX_TYPES.map(t => ({ value: t.value, label: t.label, count: rows.filter(r => r.tax_type === t.value).length }))} value={tab} onChange={setTab} className="mb-4" />

 <DataTable
 loading={loading} rows={rowsForTab} rowKey="id"
 searchKeys={['counterparty_name', 'counterparty_npwp', 'faktur_no', 'bukti_potong_no']}
 exportName={`pajak-${tab}`}
 emptyTitle="Belum ada data" emptyMessage="Belum ada data pajak pada jenis ini."
 columns={[
 { key: 'tax_period', header: 'Masa Pajak' },
 { key: 'counterparty_name', header: 'Lawan Transaksi' },
 { key: 'counterparty_npwp', header: 'NPWP', render: (r) => r.counterparty_npwp || '-' },
 { key: 'dpp', header: 'DPP', align: 'right', render: (r) => rp(r.dpp) },
 { key: 'tax_amount', header: 'Nilai Pajak', align: 'right', render: (r) => rp(r.tax_amount) },
 { key: 'doc_no', header: isPpnTab ? 'No Faktur' : 'No Bukti Potong', render: (r) => (isPpnTab ? r.faktur_no : r.bukti_potong_no) || '-' },
 { key: 'file_url', header: 'Berkas', align: 'center', render: (r) => r.file_url
 ? <Button size="sm" variant="ghost" onClick={() => lihatBerkas(r)}><Paperclip size={14} /></Button>
 : can('FINANCE', 'write') && (
 <label className="inline-flex">
 <input type="file" className="hidden" disabled={uploadingId === r.id}
 onChange={(e: any) => { const f = e.target.files?.[0]; if (f) unggahBerkas(r, f) }} />
 <span className="text-caption text-primary-600 cursor-pointer hover:underline">{uploadingId === r.id ? 'Mengunggah…' : 'Unggah'}</span>
 </label>
 ) },
 { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
 {
 key: 'aksi', header: '', sortable: false, align: 'right', render: (r) => can('FINANCE', 'write') && (
 <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
 {r.status === 'draft' && <Button size="sm" variant="outline" onClick={() => tandaiDilaporkan(r)}>Tandai Dilaporkan</Button>}
 {r.status === 'dilaporkan' && can('FINANCE', 'approve') && <Button size="sm" variant="outline" className="text-amber-600" onClick={() => openKoreksi(r)}>Tandai Dikoreksi</Button>}
 </div>
 ),
 },
 ]}
 />

 <Card className="mt-5 overflow-hidden">
 <div className="px-4 py-3 border-b border-ink-200">
 <h4 className="font-display font-semibold text-[13px] uppercase tracking-wide text-ink-500">Ringkasan per Masa Pajak — {TAX_TYPE_LABEL[tab]}</h4>
 </div>
 {summaryForTab.length === 0 ? <div className="p-6 text-center text-body text-ink-400">Belum ada data.</div> : (
 <table className="w-full text-body">
 <thead className="bg-ink-50"><tr>
 <th className="text-left px-4 py-2.5 text-caption font-semibold uppercase text-ink-500">Masa Pajak</th>
 <th className="text-right px-4 py-2.5 text-caption font-semibold uppercase text-ink-500">Jumlah Dokumen</th>
 <th className="text-right px-4 py-2.5 text-caption font-semibold uppercase text-ink-500">Total DPP</th>
 <th className="text-right px-4 py-2.5 text-caption font-semibold uppercase text-ink-500">Total Pajak</th>
 </tr></thead>
 <tbody>
 {summaryForTab.map((s, i) => (
 <tr key={i} className="border-t border-ink-100">
 <td className="px-4 py-2.5">{s.tax_period}</td>
 <td className="px-4 py-2.5 text-right tabular">{s.cnt}</td>
 <td className="px-4 py-2.5 text-right tabular">{rp(s.total_dpp)}</td>
 <td className="px-4 py-2.5 text-right tabular font-medium">{rp(s.total_tax)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </Card>

 <p className="text-caption text-ink-400 mt-4">Rekap ini alat bantu internal, bukan pengganti e-Faktur/e-Bupot. Angka wajib direkonsiliasi sebelum pelaporan.</p>

 <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Data Pajak" size="md" footer={<Button loading={busy} onClick={simpan}>Simpan</Button>}>
 <div className="grid sm:grid-cols-2 gap-3">
 <Field label="Jenis Pajak" required><Select value={form.tax_type} onChange={(e: any) => setForm((f: any) => ({ ...f, tax_type: e.target.value }))} options={TAX_TYPES} /></Field>
 <Field label="Masa Pajak" required><Input type="month" value={form.tax_period} onChange={(e: any) => setForm((f: any) => ({ ...f, tax_period: e.target.value }))} /></Field>
 <Field label="Lawan Transaksi" required className="sm:col-span-2"><Input value={form.counterparty_name} onChange={(e: any) => setForm((f: any) => ({ ...f, counterparty_name: e.target.value }))} /></Field>
 <Field label="NPWP"><Input value={form.counterparty_npwp} onChange={(e: any) => setForm((f: any) => ({ ...f, counterparty_npwp: e.target.value }))} placeholder="Opsional" /></Field>
 {form.tax_type.startsWith('ppn')
 ? <Field label="No Faktur Pajak"><Input value={form.faktur_no} onChange={(e: any) => setForm((f: any) => ({ ...f, faktur_no: e.target.value }))} /></Field>
 : <Field label="No Bukti Potong"><Input value={form.bukti_potong_no} onChange={(e: any) => setForm((f: any) => ({ ...f, bukti_potong_no: e.target.value }))} /></Field>}
 <Field label="DPP" required><Money value={form.dpp} onChange={(v: number) => setForm((f: any) => ({ ...f, dpp: v }))} /></Field>
 <Field label="Nilai Pajak" required><Money value={form.tax_amount} onChange={(v: number) => setForm((f: any) => ({ ...f, tax_amount: v }))} /></Field>
 </div>
 </Modal>

 <Modal open={!!koreksiRow} onClose={() => setKoreksiRow(null)} title="Tandai Dikoreksi" size="sm"
 footer={<Button variant="danger" loading={koreksiBusy} onClick={submitKoreksi}>Tandai Dikoreksi</Button>}>
 <div className="space-y-3">
 <p className="text-body text-ink-600">
 Data pajak <strong>{koreksiRow?.record_no}</strong> ({koreksiRow?.counterparty_name}) akan ditandai <strong>dikoreksi</strong>.
 Baris data ini TIDAK diedit langsung — buat entri baru dengan nilai yang benar agar riwayat pelaporan asli tetap utuh untuk kebutuhan audit pajak.
 </p>
 <Field label="Alasan Koreksi" required>
 <Textarea rows={3} value={koreksiReason} onChange={(e: any) => setKoreksiReason(e.target.value)} placeholder="Jelaskan alasan pembetulan (mis. salah nilai DPP, salah lawan transaksi)" />
 </Field>
 </div>
 </Modal>
 </div>
 )
}
