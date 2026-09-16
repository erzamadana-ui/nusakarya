import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo } from '@/lib/db'
import { rupiah, tgl, todayISO } from '@/lib/format'
import {
 PageHeader, FilterBar, Tabs, Card, DataTable, Badge, Drawer, Modal, Field, Input, Select, Money, Textarea, Button,
 useToast, ConfirmDialog, KpiCard, EmptyState, Section, Plus,
} from '@/components/ui'
import { findCandidates, parseStatementLines, MatchCandidate } from '../lib/helpers'

const rp = (v: any) => rupiah(Number(v) || 0)
const emptyAccountForm = { bank_name: '', account_no: '', account_holder: '', currency: 'IDR', opening_balance: 0, current_balance: 0, is_active: true }

export default function Bank() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [tab, setTab] = useState<'rekening' | 'rekonsiliasi'>('rekening')
 const [loading, setLoading] = useState(true)
 const [accounts, setAccounts] = useState<any[]>([])
 const [recons, setRecons] = useState<any[]>([])

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

 async function load() {
 setLoading(true)
 try {
 const [acc, rec] = await Promise.all([
 list('bank_accounts', { eq: { company_id: profile!.company_id }, order: { col: 'bank_name', asc: true }, limit: 200 }),
 list('bank_reconciliations', { eq: { company_id: profile!.company_id }, order: { col: 'period_end', asc: false }, limit: 500 }),
 ])
 setAccounts(acc); setRecons(rec)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data bank', 'error') } finally { setLoading(false) }
 }

 return (
 <div>
 <PageHeader title="Bank & Rekonsiliasi" subtitle="Kelola rekening bank dan lakukan rekonsiliasi dengan rekening koran." />
 <Tabs tabs={[{ value: 'rekening', label: 'Rekening' }, { value: 'rekonsiliasi', label: 'Rekonsiliasi' }]} value={tab} onChange={setTab} className="mb-4" />
 {tab === 'rekening'
 ? <Rekening profile={profile} can={can} toast={toast} accounts={accounts} loading={loading} reload={load} />
 : <Rekonsiliasi profile={profile} can={can} toast={toast} accounts={accounts} recons={recons} loading={loading} reload={load} />}
 </div>
 )
}

function Rekening({ profile, can, toast, accounts, loading, reload }: any) {
 const [modalOpen, setModalOpen] = useState(false)
 const [editing, setEditing] = useState<any | null>(null)
 const [form, setForm] = useState<any>(emptyAccountForm)
 const [confirmDelete, setConfirmDelete] = useState<any | null>(null)
 const [busy, setBusy] = useState(false)

 function openAdd() { setEditing(null); setForm(emptyAccountForm); setModalOpen(true) }
 function openEdit(row: any) { setEditing(row); setForm({ ...row }); setModalOpen(true) }

 async function simpan() {
 if (!form.bank_name.trim()) { toast.push('Nama bank wajib diisi.', 'error'); return }
 if (!form.account_no.trim()) { toast.push('Nomor rekening wajib diisi.', 'error'); return }
 if (!form.account_holder.trim()) { toast.push('Nama pemegang rekening wajib diisi.', 'error'); return }
 setBusy(true)
 try {
 const payload = {
 company_id: profile!.company_id, bank_name: form.bank_name.trim(), account_no: form.account_no.trim(),
 account_holder: form.account_holder.trim(), currency: form.currency || 'IDR', opening_balance: Number(form.opening_balance) || 0,
 current_balance: editing ? Number(form.current_balance) || 0 : Number(form.opening_balance) || 0, is_active: !!form.is_active,
 }
 if (editing) { await update('bank_accounts', editing.id, payload); toast.push('Rekening diperbarui.', 'success') }
 else { await insert('bank_accounts', payload); toast.push('Rekening ditambahkan.', 'success') }
 setModalOpen(false); await reload()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan rekening', 'error') } finally { setBusy(false) }
 }
 async function hapus() {
 if (!confirmDelete) return
 try { await remove('bank_accounts', confirmDelete.id); toast.push('Rekening dihapus.', 'success'); await reload() }
 catch (e: any) { toast.push(e.message ?? 'Gagal menghapus rekening', 'error') }
 }

 return (
 <div>
 <div className="flex justify-end mb-3">{can('FINANCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Rekening</Button>}</div>
 <DataTable
 loading={loading} rows={accounts} rowKey="id" searchKeys={['bank_name', 'account_no', 'account_holder']} exportName="rekening-bank"
 emptyTitle="Belum ada rekening"
 columns={[
 { key: 'bank_name', header: 'Bank' },
 { key: 'account_no', header: 'Nomor Rekening' },
 { key: 'account_holder', header: 'Atas Nama' },
 { key: 'currency', header: 'Mata Uang' },
 { key: 'current_balance', header: 'Saldo Berjalan', align: 'right', render: (r) => rp(r.current_balance) },
 { key: 'is_active', header: 'Status', render: (r) => r.is_active ? <Badge tone="emerald">Aktif</Badge> : <Badge tone="slate">Nonaktif</Badge> },
 { key: 'aksi', header: '', sortable: false, align: 'right', render: (r) => can('FINANCE', 'write') && (
 <div className="flex justify-end gap-1">
 <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Ubah</Button>
 {can('FINANCE', 'approve') && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(r)}>Hapus</Button>}
 </div>
 ) },
 ]}
 />
 <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Ubah Rekening' : 'Tambah Rekening'} size="md" footer={<Button loading={busy} onClick={simpan}>Simpan</Button>}>
 <div className="grid sm:grid-cols-2 gap-3">
 <Field label="Nama Bank" required><Input value={form.bank_name} onChange={(e: any) => setForm((f: any) => ({ ...f, bank_name: e.target.value }))} /></Field>
 <Field label="Nomor Rekening" required><Input value={form.account_no} onChange={(e: any) => setForm((f: any) => ({ ...f, account_no: e.target.value }))} /></Field>
 <Field label="Atas Nama" required className="sm:col-span-2"><Input value={form.account_holder} onChange={(e: any) => setForm((f: any) => ({ ...f, account_holder: e.target.value }))} /></Field>
 <Field label="Mata Uang"><Input value={form.currency} onChange={(e: any) => setForm((f: any) => ({ ...f, currency: e.target.value }))} /></Field>
 <Field label="Saldo Awal"><Money value={form.opening_balance} onChange={(v: number) => setForm((f: any) => ({ ...f, opening_balance: v }))} /></Field>
 {editing && <Field label="Saldo Berjalan"><Money value={form.current_balance} onChange={(v: number) => setForm((f: any) => ({ ...f, current_balance: v }))} /></Field>}
 </div>
 </Modal>
 <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={hapus} danger
 title="Hapus Rekening" message={`Hapus rekening ${confirmDelete?.bank_name} — ${confirmDelete?.account_no}?`} />
 </div>
 )
}

function Rekonsiliasi({ profile, can, toast, accounts, recons, loading, reload }: any) {
 const [modalOpen, setModalOpen] = useState(false)
 const [form, setForm] = useState<any>({ bank_account_id: '', period_start: todayISO().slice(0, 8) + '01', period_end: todayISO(), statement_balance: 0, book_balance: 0 })
 const [busy, setBusy] = useState(false)
 const [selected, setSelected] = useState<any | null>(null)

 const accountOptions = useMemo(() => accounts.map((a: any) => ({ value: a.id, label: `${a.bank_name} — ${a.account_no}` })), [accounts])
 const accountMap = useMemo(() => Object.fromEntries(accounts.map((a: any) => [a.id, a])), [accounts])

 function openAdd() {
 const acc = accounts[0]
 setForm({ bank_account_id: acc?.id ?? '', period_start: todayISO().slice(0, 8) + '01', period_end: todayISO(), statement_balance: 0, book_balance: acc?.current_balance ?? 0 })
 setModalOpen(true)
 }
 function pickAccount(id: string) { setForm((f: any) => ({ ...f, bank_account_id: id, book_balance: accountMap[id]?.current_balance ?? 0 })) }

 async function buatRekonsiliasi() {
 if (!form.bank_account_id) { toast.push('Pilih rekening terlebih dahulu.', 'error'); return }
 setBusy(true)
 try {
 const reconNo = await nextDocNo(profile!.company_id, 'BR')
 const difference = Number(form.statement_balance) - Number(form.book_balance)
 const row = await insert('bank_reconciliations', {
 company_id: profile!.company_id, recon_no: reconNo, bank_account_id: form.bank_account_id,
 period_start: form.period_start, period_end: form.period_end, statement_balance: Number(form.statement_balance) || 0,
 book_balance: Number(form.book_balance) || 0, difference, status: 'draft', created_by: profile!.id,
 })
 toast.push('Rekonsiliasi dibuat.', 'success')
 setModalOpen(false); await reload(); setSelected(row)
 } catch (e: any) { toast.push(e.message ?? 'Gagal membuat rekonsiliasi', 'error') } finally { setBusy(false) }
 }

 return (
 <div>
 <div className="flex justify-end mb-3">{can('FINANCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Buat Rekonsiliasi</Button>}</div>
 <DataTable
 loading={loading} rows={recons} rowKey="id" onRowClick={setSelected}
 searchKeys={['recon_no']} exportName="rekonsiliasi-bank" emptyTitle="Belum ada rekonsiliasi"
 columns={[
 { key: 'recon_no', header: 'No Rekonsiliasi' },
 { key: 'bank_account_id', header: 'Rekening', render: (r) => accountMap[r.bank_account_id] ? `${accountMap[r.bank_account_id].bank_name} — ${accountMap[r.bank_account_id].account_no}` : '-' },
 { key: 'period_end', header: 'Periode', render: (r) => `${tgl(r.period_start)} – ${tgl(r.period_end)}` },
 { key: 'book_balance', header: 'Saldo Buku', align: 'right', render: (r) => rp(r.book_balance) },
 { key: 'statement_balance', header: 'Saldo Koran', align: 'right', render: (r) => rp(r.statement_balance) },
 { key: 'difference', header: 'Selisih', align: 'right', render: (r) => <span className={Number(r.difference) !== 0 ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>{rp(r.difference)}</span> },
 { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
 ]}
 />
 <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Buat Rekonsiliasi" size="md" footer={<Button loading={busy} onClick={buatRekonsiliasi}>Buat</Button>}>
 <div className="grid sm:grid-cols-2 gap-3">
 <Field label="Rekening" required className="sm:col-span-2"><Select value={form.bank_account_id} onChange={(e: any) => pickAccount(e.target.value)} options={accountOptions} /></Field>
 <Field label="Awal Periode" required><Input type="date" value={form.period_start} onChange={(e: any) => setForm((f: any) => ({ ...f, period_start: e.target.value }))} /></Field>
 <Field label="Akhir Periode" required><Input type="date" value={form.period_end} onChange={(e: any) => setForm((f: any) => ({ ...f, period_end: e.target.value }))} /></Field>
 <Field label="Saldo Buku" hint="Diambil dari saldo berjalan rekening, dapat diubah."><Money value={form.book_balance} onChange={(v: number) => setForm((f: any) => ({ ...f, book_balance: v }))} /></Field>
 <Field label="Saldo Rekening Koran" required><Money value={form.statement_balance} onChange={(v: number) => setForm((f: any) => ({ ...f, statement_balance: v }))} /></Field>
 </div>
 </Modal>

 <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.recon_no} width="max-w-3xl">
 {selected && <ReconDetail profile={profile} can={can} toast={toast} recon={selected} account={accountMap[selected.bank_account_id]}
 onUpdated={async (patch: any) => { setSelected((s: any) => ({ ...s, ...patch })); await reload() }} />}
 </Drawer>
 </div>
 )
}

function ReconDetail({ profile, can, toast, recon, account, onUpdated }: any) {
 const [lines, setLines] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [pasteText, setPasteText] = useState('')
 const [busy, setBusy] = useState(false)
 const [candidates, setCandidates] = useState<Record<string, MatchCandidate[]>>({})
 const [pickedCandidate, setPickedCandidate] = useState<Record<string, string>>({})

 useEffect(() => { loadLines() }, [recon.id])

 async function loadLines() {
 setLoading(true)
 try {
 const l = await list('bank_statement_lines', { eq: { recon_id: recon.id }, order: { col: 'transaction_date', asc: true }, limit: 2000 })
 setLines(l)
 const unmatched = l.filter((x: any) => !x.is_matched)
 if (unmatched.length) await loadCandidates(unmatched)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat baris mutasi', 'error') } finally { setLoading(false) }
 }

 async function loadCandidates(unmatched: any[]) {
 try {
 const dates = unmatched.map(u => u.transaction_date).sort()
 const from = dates[0], to = dates[dates.length - 1]
 const [cf, ap, ar] = await Promise.all([
 list('cash_flows', { eq: { company_id: profile.company_id }, gte: { flow_date: from }, lte: { flow_date: to }, limit: 2000 }),
 list('ap_payments', { select: 'id,payment_no,payment_date,amount,vendor:vendors(name)', eq: { company_id: profile.company_id }, gte: { payment_date: from }, lte: { payment_date: to }, limit: 2000 }),
 list('ar_payments', { select: 'id,payment_no,payment_date,amount,customer:customers(name)', eq: { company_id: profile.company_id }, gte: { payment_date: from }, lte: { payment_date: to }, limit: 2000 }),
 ])
 const map: Record<string, MatchCandidate[]> = {}
 unmatched.forEach(u => { map[u.id] = findCandidates(u, { cashFlows: cf, apPayments: ap, arPayments: ar }) })
 setCandidates(map)
 } catch { /* pencocokan tetap bisa dilakukan manual tanpa usulan */ }
 }

 async function impor() {
 const parsed = parseStatementLines(pasteText)
 if (!parsed.length) { toast.push('Tidak ada baris valid untuk diimpor. Format: tanggal|uraian|debit|kredit', 'error'); return }
 setBusy(true)
 try {
 for (const p of parsed) {
 await insert('bank_statement_lines', {
 company_id: profile.company_id, recon_id: recon.id, transaction_date: p.transaction_date,
 description: p.description || null, debit: p.debit, credit: p.credit, is_matched: false, created_by: profile.id,
 })
 }
 toast.push(`${parsed.length} baris mutasi diimpor.`, 'success')
 setPasteText(''); await loadLines()
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengimpor baris mutasi', 'error') } finally { setBusy(false) }
 }

 async function cocokkan(line: any) {
 const candId = pickedCandidate[line.id]
 const cand = (candidates[line.id] ?? []).find(c => c.id === candId)
 if (!cand) { toast.push('Pilih calon pasangan terlebih dahulu.', 'error'); return }
 try {
 await update('bank_statement_lines', line.id, { is_matched: true, matched_ref_type: cand.source, matched_ref_id: cand.id })
 toast.push('Baris dicocokkan.', 'success'); await loadLines()
 } catch (e: any) { toast.push(e.message ?? 'Gagal mencocokkan baris', 'error') }
 }

 async function tandaiSelesai() {
 if (Number(recon.difference) !== 0) { toast.push('Selisih belum nol — rekonsiliasi belum bisa ditandai selesai.', 'error'); return }
 try { await update('bank_reconciliations', recon.id, { status: 'selesai' }); toast.push('Rekonsiliasi ditandai selesai.', 'success'); onUpdated({ status: 'selesai' }) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memperbarui status', 'error') }
 }

 const belumCocok = lines.filter(l => !l.is_matched).length

 return (
 <div>
 <Section title="Ringkasan">
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <KpiCard label="Saldo Buku" value={rp(recon.book_balance)} tone="blue" />
 <KpiCard label="Saldo Koran" value={rp(recon.statement_balance)} tone="amber" />
 <KpiCard label="Selisih" value={rp(recon.difference)} tone={Number(recon.difference) === 0 ? 'emerald' : 'red'} />
 <KpiCard label="Belum Cocok" value={String(belumCocok)} tone={belumCocok > 0 ? 'red' : 'emerald'} />
 </div>
 <p className="text-caption text-ink-400 mt-2">Rekening: {account ? `${account.bank_name} — ${account.account_no}` : '-'} · Periode {tgl(recon.period_start)} – {tgl(recon.period_end)}</p>
 {can('FINANCE', 'approve') && recon.status !== 'selesai' && (
 <Button className="mt-3" size="sm" disabled={Number(recon.difference) !== 0} onClick={tandaiSelesai}>Tandai Selesai</Button>
 )}
 </Section>

 {recon.status !== 'selesai' && can('FINANCE', 'write') && (
 <Section title="Impor Baris Mutasi Rekening Koran">
 <p className="text-caption text-ink-500 mb-2">Satu baris per transaksi, format: <code>tanggal|uraian|debit|kredit</code> — contoh: <code>2026-05-10|Transfer masuk PT ABC|0|5000000</code></p>
 <Textarea rows={4} value={pasteText} onChange={(e: any) => setPasteText(e.target.value)} placeholder={'2026-05-10|Transfer masuk PT ABC|0|5000000\n2026-05-11|Biaya admin bank|25000|0'} />
 <Button className="mt-2" size="sm" loading={busy} onClick={impor}>Impor Baris</Button>
 </Section>
 )}

 <Section title="Baris Mutasi">
 {loading ? <div className="text-body text-ink-400">Memuat…</div> : lines.length === 0 ? <EmptyState title="Belum ada baris mutasi" message="Impor baris mutasi rekening koran di atas." /> : (
 <div className="border border-ink-200 rounded-md divide-y divide-ink-200">
 {lines.map(l => (
 <div key={l.id} className="p-3">
 <div className="flex items-center justify-between gap-3">
 <div className="min-w-0">
 <div className="font-medium truncate">{l.description || '-'}</div>
 <div className="text-caption text-ink-400">{tgl(l.transaction_date)} · {l.debit > 0 ? `Debit ${rp(l.debit)}` : `Kredit ${rp(l.credit)}`}</div>
 </div>
 {l.is_matched ? <Badge tone="emerald">Cocok</Badge> : <Badge tone="amber">Belum Cocok</Badge>}
 </div>
 {!l.is_matched && can('FINANCE', 'write') && (
 <div className="flex items-center gap-2 mt-2">
 <Select className="flex-1" value={pickedCandidate[l.id] ?? ''} onChange={(e: any) => setPickedCandidate(p => ({ ...p, [l.id]: e.target.value }))}
 options={(candidates[l.id] ?? []).map(c => ({ value: c.id, label: `${c.label} · ${tgl(c.date)} · ${rp(c.amount)}` }))}
 placeholder={(candidates[l.id] ?? []).length ? 'Pilih calon pasangan' : 'Tidak ada usulan pasangan'} />
 <Button size="sm" disabled={!pickedCandidate[l.id]} onClick={() => cocokkan(l)}>Cocokkan</Button>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </Section>
 </div>
 )
}
