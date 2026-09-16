import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo, uploadFile, signedUrl } from '@/lib/db'
import { rupiah, tgl, todayISO } from '@/lib/format'
import {
 PageHeader, FilterBar, Card, DataTable, Badge, Drawer, Modal, Field, Input, Select, Money, Textarea, Button,
 useToast, KpiCard, Section, Desc, Stepper, Plus,
} from '@/components/ui'
import { Paperclip, Printer, AlertTriangle } from 'lucide-react'

const rp = (v: any) => rupiah(Number(v) || 0)
const KATEGORI_OPTIONS = ['Isi Ulang Kas', 'ATK & Kantor', 'Konsumsi Rapat', 'Transport Lokal', 'Parkir & Tol', 'Operasional', 'Lain-lain']

const emptyForm = { transaction_date: todayISO(), branch_id: '', pic_id: '', direction: 'out', category: '', description: '', amount: 0 }

export default function KasKecil() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [branches, setBranches] = useState<any[]>([])
 const [employees, setEmployees] = useState<any[]>([])

 const [branchFilter, setBranchFilter] = useState('')
 const [dateFrom, setDateFrom] = useState('')
 const [dateTo, setDateTo] = useState('')
 const [threshold, setThreshold] = useState(500000)

 const [modalOpen, setModalOpen] = useState(false)
 const [form, setForm] = useState<any>(emptyForm)
 const [file, setFile] = useState<File | null>(null)
 const [busy, setBusy] = useState(false)

 const [detail, setDetail] = useState<any | null>(null)
 const [receiptUrl, setReceiptUrl] = useState<string | null>(null)

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

 async function load() {
 setLoading(true)
 try {
 const [pc, br, emp] = await Promise.all([
 list('petty_cash', { eq: { company_id: profile!.company_id }, order: { col: 'transaction_date', asc: true }, limit: 5000 }),
 list('branches', { eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true }, limit: 200 }),
 list('employees', { select: 'id,full_name,user_id', eq: { company_id: profile!.company_id }, limit: 1000 }),
 ])
 setRows(pc); setBranches(br); setEmployees(emp)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat kas kecil', 'error') } finally { setLoading(false) }
 }

 const branchMap = useMemo(() => Object.fromEntries(branches.map(b => [b.id, b.name])), [branches])
 const employeeMap = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e.full_name])), [employees])
 const branchOptions = useMemo(() => branches.map(b => ({ value: b.id, label: b.name })), [branches])
 const employeeOptions = useMemo(() => employees.map(e => ({ value: e.id, label: e.full_name })), [employees])

 const filtered = useMemo(() => rows
 .filter(r => !branchFilter || r.branch_id === branchFilter)
 .filter(r => (!dateFrom || r.transaction_date >= dateFrom) && (!dateTo || r.transaction_date <= dateTo))
 .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)), [rows, branchFilter, dateFrom, dateTo])

 const saldoPerCabang = useMemo(() => {
 const map: Record<string, { branch_id: string; nama: string; saldo: number; terakhir: string | null }> = {}
 branches.forEach(b => { map[b.id] = { branch_id: b.id, nama: b.name, saldo: 0, terakhir: null } })
 const sorted = [...rows].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || String(a.created_at).localeCompare(String(b.created_at)))
 sorted.forEach(r => {
 if (!map[r.branch_id]) map[r.branch_id] = { branch_id: r.branch_id, nama: branchMap[r.branch_id] ?? '-', saldo: 0, terakhir: null }
 map[r.branch_id].saldo = r.balance_after != null ? Number(r.balance_after) : map[r.branch_id].saldo + (r.direction === 'in' ? Number(r.amount) : -Number(r.amount))
 map[r.branch_id].terakhir = r.transaction_date
 })
 return Object.values(map)
 }, [rows, branches, branchMap])

 function openAdd() {
 setForm({ ...emptyForm, branch_id: profile?.branch_id ?? '', pic_id: employees.find(e => e.user_id === profile?.id)?.id ?? '' })
 setFile(null); setModalOpen(true)
 }

 async function simpan() {
 if (!form.branch_id) { toast.push('Cabang wajib dipilih.', 'error'); return }
 if (!form.pic_id) { toast.push('PIC wajib dipilih.', 'error'); return }
 if (!form.category) { toast.push('Kategori wajib dipilih.', 'error'); return }
 if (!form.amount || Number(form.amount) <= 0) { toast.push('Nominal harus lebih dari 0.', 'error'); return }
 setBusy(true)
 try {
 const saldoSebelum = saldoPerCabang.find(s => s.branch_id === form.branch_id)?.saldo ?? 0
 const balanceAfter = saldoSebelum + (form.direction === 'in' ? Number(form.amount) : -Number(form.amount))
 let receiptPath: string | null = null
 if (file) receiptPath = await uploadFile(profile!.company_id, 'petty-cash', file)
 const transactionNo = await nextDocNo(profile!.company_id, 'PC')
 await insert('petty_cash', {
 company_id: profile!.company_id, transaction_no: transactionNo, transaction_date: form.transaction_date,
 branch_id: form.branch_id, pic_id: form.pic_id, direction: form.direction, category: form.category,
 description: form.description || null, amount: Number(form.amount), balance_after: balanceAfter,
 receipt_url: receiptPath, status: 'diajukan', created_by: profile!.id,
 })
 toast.push('Transaksi kas kecil ditambahkan.', 'success')
 setModalOpen(false); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan transaksi', 'error') } finally { setBusy(false) }
 }

 async function openDetail(row: any) {
 setDetail(row); setReceiptUrl(row.receipt_url ? await signedUrl(row.receipt_url) : null)
 }
 async function setuju(row: any) {
 try { await update('petty_cash', row.id, { status: 'disetujui' }); toast.push('Transaksi disetujui.', 'success'); await load(); setDetail(null) }
 catch (e: any) { toast.push(e.message ?? 'Gagal menyetujui transaksi', 'error') }
 }
 async function tolak(row: any) {
 try { await update('petty_cash', row.id, { status: 'ditolak' }); toast.push('Transaksi ditolak.', 'success'); await load(); setDetail(null) }
 catch (e: any) { toast.push(e.message ?? 'Gagal menolak transaksi', 'error') }
 }
 function cetak() { window.print() }

 return (
 <div>
 <PageHeader title="Kas Kecil" subtitle="Buku kas kecil per cabang dengan saldo berjalan."
 actions={<>
 <Button variant="outline" icon={<Printer size={16} />} onClick={cetak}>Cetak Buku Kas</Button>
 {can('FINANCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Transaksi</Button>}
 </>} />

 <FilterBar>
 <Field label="Cabang"><Select value={branchFilter} onChange={(e: any) => setBranchFilter(e.target.value)} options={branchOptions} placeholder="Semua cabang" /></Field>
 <Field label="Dari Tanggal"><Input type="date" value={dateFrom} onChange={(e: any) => setDateFrom(e.target.value)} /></Field>
 <Field label="Sampai Tanggal"><Input type="date" value={dateTo} onChange={(e: any) => setDateTo(e.target.value)} /></Field>
 <Field label="Ambang Saldo Minimum" hint="Hanya tersimpan di tampilan ini, bukan di basis data.">
 <Money value={threshold} onChange={setThreshold} />
 </Field>
 </FilterBar>

 <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
 {saldoPerCabang.map(s => {
 const low = s.saldo < threshold
 return (
 <KpiCard key={s.branch_id} label={s.nama} value={rp(s.saldo)} tone={low ? 'red' : 'teal'}
 sub={low ? 'Saldo di bawah ambang minimum' : `Terakhir: ${s.terakhir ? tgl(s.terakhir) : '-'}`}
 icon={low ? <AlertTriangle size={16} /> : undefined} />
 )
 })}
 </div>

 <DataTable
 loading={loading} rows={filtered} rowKey="id" onRowClick={openDetail}
 searchKeys={['transaction_no', 'description', 'category']} exportName="kas-kecil"
 emptyTitle="Belum ada transaksi" emptyMessage="Belum ada transaksi kas kecil pada filter ini."
 columns={[
 { key: 'transaction_no', header: 'No Transaksi' },
 { key: 'transaction_date', header: 'Tanggal', render: (r) => tgl(r.transaction_date) },
 { key: 'branch_id', header: 'Cabang', render: (r) => branchMap[r.branch_id] ?? '-' },
 { key: 'pic_id', header: 'PIC', render: (r) => employeeMap[r.pic_id] ?? '-' },
 { key: 'category', header: 'Kategori', render: (r) => r.category || '-' },
 { key: 'direction', header: 'Arah', render: (r) => r.direction === 'in' ? <Badge tone="emerald">Masuk</Badge> : <Badge tone="red">Keluar</Badge> },
 { key: 'amount', header: 'Nominal', align: 'right', render: (r) => rp(r.amount) },
 { key: 'balance_after', header: 'Saldo Berjalan', align: 'right', render: (r) => rp(r.balance_after) },
 { key: 'receipt_url', header: 'Bukti', align: 'center', render: (r) => r.receipt_url ? <Paperclip size={14} className="inline text-ink-400" /> : '-' },
 { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
 ]}
 />

 <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.transaction_no}
 footer={detail?.status === 'diajukan' && can('FINANCE', 'approve') && (
 <>
 <Button variant="danger" onClick={() => tolak(detail)}>Tolak</Button>
 <Button onClick={() => setuju(detail)}>Setujui</Button>
 </>
 )}>
 {detail && (
 <>
 <div className="mb-4"><Stepper steps={['Diajukan', 'Disetujui']} current={detail.status === 'disetujui' ? 1 : 0} /></div>
 {detail.status === 'ditolak' && <div className="mb-4"><Badge tone="red">Ditolak</Badge></div>}
 <Section title="Ringkasan">
 <Desc cols={2} items={[
 { label: 'Tanggal', value: tgl(detail.transaction_date) },
 { label: 'Cabang', value: branchMap[detail.branch_id] },
 { label: 'PIC', value: employeeMap[detail.pic_id] },
 { label: 'Kategori', value: detail.category },
 { label: 'Arah', value: detail.direction === 'in' ? 'Masuk' : 'Keluar' },
 { label: 'Nominal', value: rp(detail.amount) },
 { label: 'Saldo Berjalan', value: rp(detail.balance_after) },
 { label: 'Status', value: <Badge>{detail.status}</Badge> },
 { label: 'Keterangan', value: detail.description || '-' },
 { label: 'Bukti', value: receiptUrl ? <Button size="sm" variant="outline" onClick={() => window.open(receiptUrl!, '_blank')}>Lihat Bukti</Button> : '-' },
 ]} />
 </Section>
 </>
 )}
 </Drawer>

 <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Transaksi Kas Kecil" size="md" footer={<Button loading={busy} onClick={simpan}>Simpan</Button>}>
 <div className="grid sm:grid-cols-2 gap-3">
 <Field label="Tanggal" required><Input type="date" value={form.transaction_date} onChange={(e: any) => setForm((f: any) => ({ ...f, transaction_date: e.target.value }))} /></Field>
 <Field label="Arah" required><Select value={form.direction} onChange={(e: any) => setForm((f: any) => ({ ...f, direction: e.target.value }))} options={[{ value: 'in', label: 'Masuk' }, { value: 'out', label: 'Keluar' }]} /></Field>
 <Field label="Cabang" required><Select value={form.branch_id} onChange={(e: any) => setForm((f: any) => ({ ...f, branch_id: e.target.value }))} options={branchOptions} /></Field>
 <Field label="PIC" required><Select value={form.pic_id} onChange={(e: any) => setForm((f: any) => ({ ...f, pic_id: e.target.value }))} options={employeeOptions} /></Field>
 <Field label="Kategori" required><Select value={form.category} onChange={(e: any) => setForm((f: any) => ({ ...f, category: e.target.value }))} options={KATEGORI_OPTIONS} /></Field>
 <Field label="Nominal" required><Money value={form.amount} onChange={(v: number) => setForm((f: any) => ({ ...f, amount: v }))} /></Field>
 <Field label="Keterangan" className="sm:col-span-2"><Textarea value={form.description} onChange={(e: any) => setForm((f: any) => ({ ...f, description: e.target.value }))} /></Field>
 <Field label="Bukti Transaksi" className="sm:col-span-2"><Input type="file" onChange={(e: any) => setFile(e.target.files?.[0] ?? null)} /></Field>
 </div>
 </Modal>
 </div>
 )
}
