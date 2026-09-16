import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import { rupiah, tgl, todayISO } from '@/lib/format'
import {
 PageHeader, FilterBar, Tabs, Card, DataTable, Badge, Drawer, Modal, Field, Input, Select, Money, Textarea, Button,
 useToast, Section, Desc, Stepper, KpiCard, EmptyState, TableSkeleton, Plus,
} from '@/components/ui'
import { Trash2 } from 'lucide-react'
import { JOURNAL_STATUS_STEPS, uid } from '../lib/helpers'

const rp = (v: any) => rupiah(Number(v) || 0)
const SOURCE_OPTIONS = [
 { value: 'manual', label: 'Manual' }, { value: 'ar_invoices', label: 'Invoice Pelanggan (AR)' },
 { value: 'vendor_invoices', label: 'Invoice Vendor (AP)' }, { value: 'purchase_orders', label: 'Purchase Order' },
 { value: 'payroll_runs', label: 'Payroll' }, { value: 'freelance_payouts', label: 'Payout Freelance' }, { value: 'petty_cash', label: 'Kas Kecil' },
]

function emptyLine() { return { _key: uid(), account_code: '', description: '', debit: 0, credit: 0, project_id: '' } }

/** Combobox akun yang bisa dicari (kode & nama) — pengganti <Select> polos untuk daftar akun yang panjang. */
function AccountCombobox({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
 const [open, setOpen] = useState(false)
 const [query, setQuery] = useState('')
 const selected = options.find(o => o.value === value)
 const filtered = useMemo(() => {
 const q = query.trim().toLowerCase()
 const base = !q ? options : options.filter(o => o.label.toLowerCase().includes(q))
 return base.slice(0, 60)
 }, [options, query])
 return (
 <div className="relative">
 <Input
 value={open ? query : (selected?.label ?? '')}
 onChange={(e: any) => { setQuery(e.target.value); if (!open) setOpen(true) }}
 onFocus={() => { setQuery(''); setOpen(true) }}
 onBlur={() => setTimeout(() => setOpen(false), 150)}
 placeholder={placeholder ?? 'Cari kode / nama akun…'}
 />
 {open && (
 <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-surface border border-ink-200 rounded-md shadow-e2 py-1">
 {filtered.length === 0 ? (
 <div className="px-3 py-2 text-caption text-ink-400">Tidak ada akun yang cocok</div>
 ) : filtered.map(o => (
 <button type="button" key={o.value}
 className="block w-full text-left px-3 py-1.5 text-body text-ink-700 hover:bg-primary-50 dark:hover:bg-primary-950/40"
 onMouseDown={(e) => e.preventDefault()}
 onClick={() => { onChange(o.value); setQuery(''); setOpen(false) }}>
 {o.label}
 </button>
 ))}
 </div>
 )}
 </div>
 )
}

export default function Jurnal() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [tab, setTab] = useState<'jurnal' | 'buku-besar'>('jurnal')
 const [loading, setLoading] = useState(true)
 const [rows, setRows] = useState<any[]>([])
 const [coa, setCoa] = useState<any[]>([])
 const [projects, setProjects] = useState<any[]>([])

 const [dateFrom, setDateFrom] = useState('')
 const [dateTo, setDateTo] = useState('')
 const [sourceFilter, setSourceFilter] = useState('')

 const [detail, setDetail] = useState<any | null>(null)
 const [detailLines, setDetailLines] = useState<any[]>([])
 const [busy, setBusy] = useState(false)

 const [modalOpen, setModalOpen] = useState(false)
 const [form, setForm] = useState<any>({ journal_date: todayISO(), description: '' })
 const [lines, setLines] = useState<any[]>([emptyLine(), emptyLine()])

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

 async function load() {
 setLoading(true)
 try {
 const [je, coaData, prj] = await Promise.all([
 list('journal_entries', { eq: { company_id: profile!.company_id }, order: { col: 'journal_date', asc: false }, limit: 2000 }),
 list('chart_of_accounts', { eq: { company_id: profile!.company_id, is_postable: true, is_active: true }, order: { col: 'account_code', asc: true }, limit: 2000 }),
 list('projects', { select: 'id,project_code,project_name', eq: { company_id: profile!.company_id }, limit: 500 }),
 ])
 setRows(je); setCoa(coaData); setProjects(prj)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat jurnal', 'error') } finally { setLoading(false) }
 }

 const coaMap = useMemo(() => Object.fromEntries(coa.map(c => [c.account_code, c])), [coa])
 const accountOptions = useMemo(() => coa.map(c => ({ value: c.account_code, label: `${c.account_code} — ${c.account_name}` })), [coa])
 const projectOptions = useMemo(() => projects.map(p => ({ value: p.id, label: `${p.project_code} — ${p.project_name}` })), [projects])

 const filtered = useMemo(() => rows
 .filter(r => (!dateFrom || r.journal_date >= dateFrom) && (!dateTo || r.journal_date <= dateTo))
 .filter(r => !sourceFilter || r.source_type === sourceFilter), [rows, dateFrom, dateTo, sourceFilter])

 async function openDetail(row: any) {
 setDetail(row)
 try {
 const l = await list('journal_lines', { eq: { journal_id: row.id }, order: { col: 'created_at', asc: true }, limit: 500 })
 setDetailLines(l)
 } catch { setDetailLines([]) }
 }

 function openAdd() { setForm({ journal_date: todayISO(), description: '' }); setLines([emptyLine(), emptyLine()]); setModalOpen(true) }
 function addLine() { setLines(ls => [...ls, emptyLine()]) }
 function removeLine(key: string) { setLines(ls => ls.length > 2 ? ls.filter(l => l._key !== key) : ls) }
 function setLine(key: string, patch: any) { setLines(ls => ls.map(l => l._key === key ? { ...l, ...patch } : l)) }

 const totalDebit = useMemo(() => lines.reduce((s, l) => s + (Number(l.debit) || 0), 0), [lines])
 const totalCredit = useMemo(() => lines.reduce((s, l) => s + (Number(l.credit) || 0), 0), [lines])
 const selisih = totalDebit - totalCredit
 const balanced = selisih === 0 && totalDebit > 0
 const linesValid = lines.every(l => l.account_code && (Number(l.debit) > 0 || Number(l.credit) > 0) && !(Number(l.debit) > 0 && Number(l.credit) > 0))

 async function simpanJurnal(status: 'draft' | 'diposting') {
 if (!form.description?.trim()) { toast.push('Uraian jurnal wajib diisi.', 'error'); return }
 if (!linesValid) { toast.push('Setiap baris wajib memiliki akun dan hanya diisi salah satu (debit atau kredit).', 'error'); return }
 if (status === 'diposting' && !balanced) { toast.push('Total debit dan kredit harus sama sebelum diposting.', 'error'); return }
 setBusy(true)
 try {
 const journalNo = await nextDocNo(profile!.company_id, 'JRN')
 const entry = await insert('journal_entries', {
 company_id: profile!.company_id, journal_no: journalNo, journal_date: form.journal_date, description: form.description.trim(),
 total_debit: totalDebit, total_credit: totalCredit, status, source_type: 'manual', created_by: profile!.id,
 posted_at: status === 'diposting' ? new Date().toISOString() : null, posted_by: status === 'diposting' ? profile!.id : null,
 })
 for (const l of lines) {
 await insert('journal_lines', {
 company_id: profile!.company_id, journal_id: entry.id, account_code: l.account_code, description: l.description || null,
 debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, project_id: l.project_id || null, created_by: profile!.id,
 })
 }
 toast.push(status === 'diposting' ? 'Jurnal berhasil diposting.' : 'Jurnal disimpan sebagai draft.', 'success')
 setModalOpen(false); await load()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan jurnal', 'error') } finally { setBusy(false) }
 }

 async function posting(row: any) {
 setBusy(true)
 try {
 await update('journal_entries', row.id, { status: 'diposting', posted_at: new Date().toISOString(), posted_by: profile!.id })
 toast.push('Jurnal diposting.', 'success'); await load(); setDetail((d: any) => d && { ...d, status: 'diposting' })
 } catch (e: any) { toast.push(e.message ?? 'Gagal memposting jurnal', 'error') } finally { setBusy(false) }
 }
 async function batalkanPosting(row: any) {
 setBusy(true)
 try {
 await update('journal_entries', row.id, { status: 'dibatalkan' })
 toast.push('Posting jurnal dibatalkan.', 'success'); await load(); setDetail((d: any) => d && { ...d, status: 'dibatalkan' })
 } catch (e: any) { toast.push(e.message ?? 'Gagal membatalkan posting', 'error') } finally { setBusy(false) }
 }

 return (
 <div>
 <PageHeader title="Jurnal Umum & Buku Besar" subtitle="Pencatatan jurnal berpasangan dan mutasi buku besar per akun."
 actions={tab === 'jurnal' && can('FINANCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Buat Jurnal</Button>} />

 <Tabs tabs={[{ value: 'jurnal', label: 'Jurnal Umum' }, { value: 'buku-besar', label: 'Buku Besar' }]} value={tab} onChange={setTab} className="mb-4" />

 {tab === 'jurnal' ? (
 <>
 <FilterBar>
 <Field label="Dari Tanggal"><Input type="date" value={dateFrom} onChange={(e: any) => setDateFrom(e.target.value)} /></Field>
 <Field label="Sampai Tanggal"><Input type="date" value={dateTo} onChange={(e: any) => setDateTo(e.target.value)} /></Field>
 <Field label="Sumber"><Select value={sourceFilter} onChange={(e: any) => setSourceFilter(e.target.value)} options={SOURCE_OPTIONS} placeholder="Semua sumber" /></Field>
 </FilterBar>

 <DataTable
 loading={loading} rows={filtered} rowKey="id" onRowClick={openDetail}
 searchKeys={['journal_no', 'description']} exportName="jurnal-umum"
 emptyTitle="Belum ada jurnal" emptyMessage="Belum ada jurnal pada rentang filter ini."
 columns={[
 { key: 'journal_no', header: 'No Jurnal' },
 { key: 'journal_date', header: 'Tanggal', render: (r) => tgl(r.journal_date) },
 { key: 'description', header: 'Uraian' },
 { key: 'source_type', header: 'Sumber', render: (r) => r.source_type || 'manual' },
 { key: 'total_debit', header: 'Total Debit', align: 'right', render: (r) => rp(r.total_debit) },
 { key: 'total_credit', header: 'Total Kredit', align: 'right', render: (r) => rp(r.total_credit) },
 { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
 ]}
 />
 </>
 ) : (
 <BukuBesar profile={profile} coaMap={coaMap} accountOptions={accountOptions} toast={toast} />
 )}

 <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.journal_no} width="max-w-2xl"
 footer={detail && (
 <>
 {detail.status === 'draft' && can('FINANCE', 'write') && <Button loading={busy} onClick={() => posting(detail)}>Posting</Button>}
 {detail.status === 'diposting' && can('FINANCE', 'approve') && <Button variant="danger" loading={busy} onClick={() => batalkanPosting(detail)}>Batalkan Posting</Button>}
 </>
 )}>
 {detail && (
 <>
 <div className="mb-4"><Stepper steps={JOURNAL_STATUS_STEPS} current={detail.status === 'dibatalkan' ? 0 : detail.status === 'diposting' ? 1 : 0} /></div>
 {detail.status === 'dibatalkan' && <div className="mb-4"><Badge tone="zinc">Dibatalkan</Badge></div>}
 <Section title="Ringkasan">
 <Desc cols={2} items={[
 { label: 'Tanggal', value: tgl(detail.journal_date) },
 { label: 'Sumber', value: detail.source_type || 'manual' },
 { label: 'Uraian', value: detail.description },
 { label: 'Status', value: <Badge>{detail.status}</Badge> },
 { label: 'Total Debit', value: rp(detail.total_debit) },
 { label: 'Total Kredit', value: rp(detail.total_credit) },
 { label: 'Diposting Pada', value: detail.posted_at ? tgl(detail.posted_at) : '-' },
 ]} />
 </Section>
 <Section title="Baris Jurnal">
 {detailLines.length === 0 ? <EmptyState title="Tidak ada baris" /> : (
 <div className="border border-ink-200 rounded-md overflow-hidden">
 <table className="w-full text-body">
 <thead className="bg-ink-50"><tr>
 <th className="text-left px-3 py-2 text-caption font-semibold uppercase text-ink-500">Akun</th>
 <th className="text-left px-3 py-2 text-caption font-semibold uppercase text-ink-500">Uraian</th>
 <th className="text-right px-3 py-2 text-caption font-semibold uppercase text-ink-500">Debit</th>
 <th className="text-right px-3 py-2 text-caption font-semibold uppercase text-ink-500">Kredit</th>
 </tr></thead>
 <tbody>
 {detailLines.map(l => (
 <tr key={l.id} className="border-t border-ink-100">
 <td className="px-3 py-2">{l.account_code} — {coaMap[l.account_code]?.account_name ?? '-'}</td>
 <td className="px-3 py-2">{l.description || '-'}</td>
 <td className="px-3 py-2 text-right tabular">{Number(l.debit) > 0 ? rp(l.debit) : '-'}</td>
 <td className="px-3 py-2 text-right tabular">{Number(l.credit) > 0 ? rp(l.credit) : '-'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </Section>
 </>
 )}
 </Drawer>

 <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Buat Jurnal" size="xl"
 footer={<>
 <span className={`text-body font-medium mr-auto ${selisih !== 0 ? 'text-red-600' : 'text-emerald-600'}`}>
 Selisih: {rp(Math.abs(selisih))} {selisih !== 0 && '(belum seimbang)'}
 </span>
 <Button variant="outline" loading={busy} onClick={() => simpanJurnal('draft')}>Simpan Draft</Button>
 <Button loading={busy} disabled={!balanced || !linesValid} onClick={() => simpanJurnal('diposting')}>Posting</Button>
 </>}>
 <div className="grid sm:grid-cols-2 gap-3 mb-4">
 <Field label="Tanggal" required><Input type="date" value={form.journal_date} onChange={(e: any) => setForm((f: any) => ({ ...f, journal_date: e.target.value }))} /></Field>
 <Field label="Uraian" required className="sm:col-span-1"><Input value={form.description} onChange={(e: any) => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="Uraian transaksi jurnal" /></Field>
 </div>
 <div className="border border-ink-200 rounded-md overflow-hidden mb-2">
 <table className="w-full text-body">
 <thead className="bg-ink-50"><tr>
 <th className="text-left px-2 py-2 text-caption font-semibold uppercase text-ink-500 w-56">Akun</th>
 <th className="text-left px-2 py-2 text-caption font-semibold uppercase text-ink-500">Uraian</th>
 <th className="text-right px-2 py-2 text-caption font-semibold uppercase text-ink-500 w-36">Debit</th>
 <th className="text-right px-2 py-2 text-caption font-semibold uppercase text-ink-500 w-36">Kredit</th>
 <th className="text-left px-2 py-2 text-caption font-semibold uppercase text-ink-500 w-44">Proyek</th>
 <th className="w-8"></th>
 </tr></thead>
 <tbody>
 {lines.map(l => (
 <tr key={l._key} className="border-t border-ink-100">
 <td className="px-2 py-1.5"><AccountCombobox value={l.account_code} onChange={(v: string) => setLine(l._key, { account_code: v })} options={accountOptions} /></td>
 <td className="px-2 py-1.5"><Input value={l.description} onChange={(e: any) => setLine(l._key, { description: e.target.value })} placeholder="Opsional" /></td>
 <td className="px-2 py-1.5"><Money value={l.debit} onChange={(v: number) => setLine(l._key, { debit: v, credit: v > 0 ? 0 : l.credit })} /></td>
 <td className="px-2 py-1.5"><Money value={l.credit} onChange={(v: number) => setLine(l._key, { credit: v, debit: v > 0 ? 0 : l.debit })} /></td>
 <td className="px-2 py-1.5"><Select value={l.project_id} onChange={(e: any) => setLine(l._key, { project_id: e.target.value })} options={projectOptions} placeholder="Opsional" /></td>
 <td className="px-2 py-1.5"><Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeLine(l._key)}><Trash2 size={14} /></Button></td>
 </tr>
 ))}
 </tbody>
 <tfoot><tr className="border-t border-ink-200 font-medium">
 <td className="px-2 py-2" colSpan={2}>Total</td>
 <td className="px-2 py-2 text-right tabular">{rp(totalDebit)}</td>
 <td className="px-2 py-2 text-right tabular">{rp(totalCredit)}</td>
 <td colSpan={2}></td>
 </tr></tfoot>
 </table>
 </div>
 <Button variant="outline" size="sm" onClick={addLine}>+ Tambah Baris</Button>
 </Modal>
 </div>
 )
}

function BukuBesar({ profile, coaMap, accountOptions, toast }: any) {
 const [account, setAccount] = useState('')
 const [dateFrom, setDateFrom] = useState(todayISO().slice(0, 8) + '01')
 const [dateTo, setDateTo] = useState(todayISO())
 const [loading, setLoading] = useState(false)
 const [entries, setEntries] = useState<any[]>([])

 useEffect(() => { if (account && profile?.company_id) fetchLedger() }, [account, profile?.company_id])

 async function fetchLedger() {
 setLoading(true)
 try {
 const data = await list('journal_lines', {
 select: 'id,debit,credit,description,journal:journal_entries(journal_no,journal_date,status,description)',
 eq: { company_id: profile.company_id, account_code: account }, limit: 5000,
 })
 setEntries(data)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat buku besar', 'error') } finally { setLoading(false) }
 }

 const normalBalance = coaMap[account]?.normal_balance ?? 'debit'
 const filtered = useMemo(() => entries
 .filter((e: any) => e.journal?.status === 'diposting')
 .filter((e: any) => (!dateFrom || (e.journal?.journal_date ?? '') >= dateFrom) && (!dateTo || (e.journal?.journal_date ?? '') <= dateTo))
 .sort((a: any, b: any) => String(a.journal?.journal_date).localeCompare(String(b.journal?.journal_date))), [entries, dateFrom, dateTo])

 const withBalance = useMemo(() => {
 let bal = 0
 return filtered.map((e: any) => {
 const d = Number(e.debit) || 0, k = Number(e.credit) || 0
 bal += normalBalance === 'debit' ? (d - k) : (k - d)
 return { ...e, _balance: bal }
 })
 }, [filtered, normalBalance])

 const totalDebit = filtered.reduce((s: number, e: any) => s + (Number(e.debit) || 0), 0)
 const totalCredit = filtered.reduce((s: number, e: any) => s + (Number(e.credit) || 0), 0)
 const saldoAkhir = withBalance.length ? withBalance[withBalance.length - 1]._balance : 0

 return (
 <div>
 <FilterBar>
 <Field label="Akun" className="min-w-[260px]"><AccountCombobox value={account} onChange={setAccount} options={accountOptions} placeholder="Cari kode / nama akun…" /></Field>
 <Field label="Dari Tanggal"><Input type="date" value={dateFrom} onChange={(e: any) => setDateFrom(e.target.value)} /></Field>
 <Field label="Sampai Tanggal"><Input type="date" value={dateTo} onChange={(e: any) => setDateTo(e.target.value)} /></Field>
 </FilterBar>

 {!account ? <EmptyState title="Pilih akun" message="Pilih akun untuk menampilkan mutasi buku besar." /> : (
 <>
 <div className="grid sm:grid-cols-3 gap-3 mb-4">
 <KpiCard label="Total Debit" value={rp(totalDebit)} tone="blue" />
 <KpiCard label="Total Kredit" value={rp(totalCredit)} tone="amber" />
 <KpiCard label="Saldo Akhir" value={rp(saldoAkhir)} sub={`Saldo normal: ${normalBalance === 'debit' ? 'Debit' : 'Kredit'}`} tone="teal" />
 </div>
 <Card className="overflow-hidden">
 {loading ? <TableSkeleton /> : withBalance.length === 0 ? <EmptyState title="Tidak ada mutasi" message="Tidak ada mutasi terposting pada rentang tanggal ini." /> : (
 <table className="w-full text-body">
 <thead className="bg-ink-50"><tr>
 <th className="text-left px-3 py-2 text-caption font-semibold uppercase text-ink-500">Tanggal</th>
 <th className="text-left px-3 py-2 text-caption font-semibold uppercase text-ink-500">No Jurnal</th>
 <th className="text-left px-3 py-2 text-caption font-semibold uppercase text-ink-500">Uraian</th>
 <th className="text-right px-3 py-2 text-caption font-semibold uppercase text-ink-500">Debit</th>
 <th className="text-right px-3 py-2 text-caption font-semibold uppercase text-ink-500">Kredit</th>
 <th className="text-right px-3 py-2 text-caption font-semibold uppercase text-ink-500">Saldo Berjalan</th>
 </tr></thead>
 <tbody>
 {withBalance.map((e: any) => (
 <tr key={e.id} className="border-t border-ink-100">
 <td className="px-3 py-2">{tgl(e.journal?.journal_date)}</td>
 <td className="px-3 py-2">{e.journal?.journal_no}</td>
 <td className="px-3 py-2">{e.description || e.journal?.description || '-'}</td>
 <td className="px-3 py-2 text-right tabular">{Number(e.debit) > 0 ? rp(e.debit) : '-'}</td>
 <td className="px-3 py-2 text-right tabular">{Number(e.credit) > 0 ? rp(e.credit) : '-'}</td>
 <td className="px-3 py-2 text-right tabular font-medium">{rp(e._balance)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </Card>
 <p className="text-caption text-ink-400 mt-2">Saldo awal diasumsikan 0 pada baris pertama rentang tanggal terpilih (tidak ada saldo awal tersimpan). Hanya jurnal berstatus diposting yang dihitung. Ditarik: {tgl(todayISO())}.</p>
 </>
 )}
 </div>
 )
}
