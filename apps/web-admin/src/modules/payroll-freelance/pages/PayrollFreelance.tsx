import React, { useEffect, useMemo, useState } from 'react'
import { chartColors } from '@/lib/theme'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import supabase from '@/lib/supabase'
import {
 PageHeader, Card, CardHeader, DataTable, Badge, Button, Modal, Drawer, Field, Input, Select,
 Stepper, Tabs, useToast, Download, EmptyState, TableSkeleton,
} from '@/components/ui'
import { rupiah, num, tgl, todayISO, periodCode, exportCSV } from '@/lib/format'
import {
 PAYOUT_STATUS_TABS, PAYOUT_STEPS, TAX_SCHEME_OPTIONS, periodRange, lastPeriods,
 pickRateCard, calcPph21BukanPegawaiProgresif, calcPph23Jasa,
} from '../lib/constants'
import { Calculator, Printer, AlertTriangle } from 'lucide-react'

const isMitra = (e: any) => e?.employment_type === 'MITRA' || ['freelance', 'campuran'].includes(e?.payroll_scheme)

type PreviewLine = {
 productivityEntryId: string; workOrderId: string | null; jobTypeId: string; jobTypeName: string
 workDate: string; qty: number; rate: number; amount: number; usedFallback: boolean; qcStatus: string
}
type PreviewRow = {
 employeeId: string; employeeName: string; npwp: string | null; hasNpwp: boolean; branchId: string | null
 bank: string
 lines: PreviewLine[]; bruto: number
 taxScheme: string; taxChoice: 'client' | 'rpc'
 dpp: number; taxAmountClient: number; taxAmountRpc: number | null
 taxAmountPph23: number; taxAmountManual: number
 otherDeduction: number
 skip: boolean; skipReason?: string
}

function effectiveTax(r: PreviewRow) {
 switch (r.taxScheme) {
 case 'pph21_bukan_pegawai': return r.taxChoice === 'rpc' ? (r.taxAmountRpc ?? 0) : r.taxAmountClient
 case 'pph23_jasa': return r.taxAmountPph23
 case 'final': return r.taxAmountManual
 default: return 0
 }
}
function netto(r: PreviewRow) { return Math.max(0, Math.round(r.bruto - effectiveTax(r) - (r.otherDeduction || 0))) }

export default function PayrollFreelance() {
 const { profile, company, can } = useAuth()
 const toast = useToast()
 const write = can('PAYROLL', 'write')
 const approve = can('PAYROLL', 'approve')

 const [period, setPeriod] = useState(periodCode())
 const [branchFilter, setBranchFilter] = useState('')
 const [branches, setBranches] = useState<any[]>([])
 const [statusTab, setStatusTab] = useState('dihitung')
 const [loading, setLoading] = useState(true)
 const [payouts, setPayouts] = useState<any[]>([])
 const [selectedIds, setSelectedIds] = useState<string[]>([])
 const [transitioning, setTransitioning] = useState(false)

 const [payModal, setPayModal] = useState(false)
 const [payForm, setPayForm] = useState({ paid_at: todayISO(), payment_ref: '' })

 const [rejectRow, setRejectRow] = useState<any>(null)
 const [rejectReason, setRejectReason] = useState('')
 const [rejectSaving, setRejectSaving] = useState(false)

 const [drawerRow, setDrawerRow] = useState<any>(null)
 const [drawerLines, setDrawerLines] = useState<any[] | null>(null)

 // --- Wizard "Hitung Payout Periode" ---
 const [calcOpen, setCalcOpen] = useState(false)
 const [calcStep, setCalcStep] = useState<'pilih' | 'pratinjau'>('pilih')
 const [calcPeriod, setCalcPeriod] = useState(periodCode())
 const [calcBranch, setCalcBranch] = useState('')
 const [calcLoading, setCalcLoading] = useState(false)
 const [preview, setPreview] = useState<PreviewRow[]>([])
 const [calcSaving, setCalcSaving] = useState(false)

 // --- Dashboard ---
 const [dashLoading, setDashLoading] = useState(true)
 const [monthlyChart, setMonthlyChart] = useState<any[]>([])
 const [topMitra, setTopMitra] = useState<any[]>([])
 const [compareChart, setCompareChart] = useState<any[]>([])

 // --- Peringatan tarif asumsi sistem ---
 const [tarifAsumsiCount, setTarifAsumsiCount] = useState(0)

 useEffect(() => { list<any>('branches', { order: { col: 'name', asc: true } }).then(setBranches).catch(() => {}) }, [])
 useEffect(() => { loadPayouts() }, [period, branchFilter])
 useEffect(() => { loadDashboard() }, [])
 useEffect(() => {
 list<any>('v_tarif_belum_terverifikasi', { select: 'id', in: { sumber_tabel: ['freelance_rate_cards', 'job_types'] } })
 .then(r => setTarifAsumsiCount(r.length)).catch(() => {})
 }, [])

 async function loadPayouts() {
 setLoading(true)
 try {
 let rows = await list<any>('freelance_payouts', { select: '*,employees(full_name,branch_id,bank_name,bank_account,bank_holder)', eq: { period_code: period }, order: { col: 'created_at', asc: false } })
 if (branchFilter) rows = rows.filter(r => r.employees?.branch_id === branchFilter)
 setPayouts(rows); setSelectedIds([])
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data payout mitra freelance', 'error') }
 finally { setLoading(false) }
 }

 async function loadDashboard() {
 setDashLoading(true)
 try {
 const periods6 = lastPeriods(6)
 const [flPayouts, periods, employeesAll] = await Promise.all([
 list<any>('freelance_payouts', { select: 'period_code,gross_amount,net_amount,employee_id,employees(full_name)', in: { period_code: periods6 } }),
 list<any>('payroll_periods', { in: { period_code: periods6 } }),
 list<any>('employees', { select: 'id,full_name' }),
 ])
 const periodIds = periods.map((p: any) => p.id)
 const runs = periodIds.length ? await list<any>('payroll_runs', { select: 'net_pay,period_id', in: { period_id: periodIds } }) : []
 const runsByPeriodCode: Record<string, number> = {}
 periods.forEach((p: any) => { runsByPeriodCode[p.period_code] = 0 })
 runs.forEach((r: any) => {
 const pc = periods.find((p: any) => p.id === r.period_id)?.period_code
 if (pc) runsByPeriodCode[pc] = (runsByPeriodCode[pc] || 0) + Number(r.net_pay || 0)
 })
 const flByPeriodCode: Record<string, { bruto: number; netto: number }> = {}
 periods6.forEach(pc => { flByPeriodCode[pc] = { bruto: 0, netto: 0 } })
 flPayouts.forEach((r: any) => {
 if (!flByPeriodCode[r.period_code]) flByPeriodCode[r.period_code] = { bruto: 0, netto: 0 }
 flByPeriodCode[r.period_code].bruto += Number(r.gross_amount || 0)
 flByPeriodCode[r.period_code].netto += Number(r.net_amount || 0)
 })
 setMonthlyChart(periods6.map(pc => ({ periode: pc, bruto: flByPeriodCode[pc]?.bruto ?? 0, netto: flByPeriodCode[pc]?.netto ?? 0 })))
 setCompareChart(periods6.map(pc => ({ periode: pc, fix_salary: runsByPeriodCode[pc] ?? 0, freelance: flByPeriodCode[pc]?.netto ?? 0 })))

 const byEmp: Record<string, number> = {}
 flPayouts.forEach((r: any) => { if (r.employee_id) byEmp[r.employee_id] = (byEmp[r.employee_id] || 0) + Number(r.net_amount || 0) })
 const top = Object.entries(byEmp).map(([id, netto]) => ({ id, netto, nama: employeesAll.find((e: any) => e.id === id)?.full_name ?? '-' }))
 .sort((a, b) => b.netto - a.netto).slice(0, 10)
 setTopMitra(top)
 } catch (e: any) { toast.push(e.message ?? 'Gagal memuat dashboard payout freelance', 'error') }
 finally { setDashLoading(false) }
 }

 const filteredByTab = useMemo(() => payouts.filter(p => p.status === statusTab), [payouts, statusTab])
 const tabCounts = useMemo(() => PAYOUT_STATUS_TABS.map(t => ({ ...t, count: payouts.filter(p => p.status === t.value).length })), [payouts])
 const footerTotals = useMemo(() => filteredByTab.reduce((a, r) => ({
 bruto: a.bruto + Number(r.gross_amount || 0), dpp: a.dpp + Number(r.dpp_amount || 0),
 pajak: a.pajak + Number(r.tax_amount || 0), netto: a.netto + Number(r.net_amount || 0),
 }), { bruto: 0, dpp: 0, pajak: 0, netto: 0 }), [filteredByTab])

 // ---------- Wizard hitung ----------
 function openCalc() { setCalcStep('pilih'); setCalcPeriod(period); setCalcBranch(branchFilter); setPreview([]); setCalcOpen(true) }

 async function runCalc() {
 setCalcLoading(true)
 try {
 const [start, end] = periodRange(calcPeriod)
 const [entries, rateCards, brackets, existing] = await Promise.all([
 list<any>('productivity_entries', {
 select: 'id,employee_id,job_type_id,qty,work_date,work_order_id,employees(id,full_name,npwp,employment_type,payroll_scheme,branch_id,bank_name,bank_account,bank_holder),job_types(id,code,name,tariff_amount),work_orders(id,qc_status)',
 eq: { status: 'diverifikasi' }, gte: { work_date: start }, lte: { work_date: end },
 }),
 list<any>('freelance_rate_cards', { eq: { is_active: true } }),
 list<any>('tax_brackets_art17', {}),
 list<any>('freelance_payouts', { eq: { period_code: calcPeriod } }),
 ])
 const existingByEmp: Record<string, any> = {}
 existing.forEach((p: any) => { if (p.employee_id) existingByEmp[p.employee_id] = p })

 const relevant = entries.filter((row: any) => {
 const e = row.employees
 if (!e || !isMitra(e)) return false
 if (calcBranch && e.branch_id !== calcBranch) return false
 if (row.work_orders && row.work_orders.qc_status === 'tidak_lulus') return false
 return true
 })

 const grouped: Record<string, any[]> = {}
 relevant.forEach((row: any) => { (grouped[row.employee_id] ??= []).push(row) })

 const rows: PreviewRow[] = []
 for (const employeeId of Object.keys(grouped)) {
 const rowsForEmp = grouped[employeeId]
 const emp = rowsForEmp[0].employees
 const lines: PreviewLine[] = rowsForEmp.map((r: any) => {
 const jt = r.job_types
 const rc = pickRateCard(rateCards, r.job_type_id, employeeId, Number(r.qty || 1), r.work_date)
 const rate = rc ? Number(rc.rate_amount) : Number(jt?.tariff_amount || 0)
 const qty = Number(r.qty || 1)
 return {
 productivityEntryId: r.id, workOrderId: r.work_order_id, jobTypeId: r.job_type_id, jobTypeName: jt?.name ?? '-',
 workDate: r.work_date, qty, rate, amount: Math.round(qty * rate), usedFallback: !rc, qcStatus: r.work_orders?.qc_status ?? 'belum',
 }
 })
 const bruto = lines.reduce((s, l) => s + l.amount, 0)
 const hasNpwp = !!emp.npwp
 const { dpp, pajak: taxAmountClient } = calcPph21BukanPegawaiProgresif(bruto, hasNpwp, brackets)
 let taxAmountRpc: number | null = null
 try {
 const { data, error } = await supabase.rpc('fn_hitung_pph21_bukan_pegawai', { p_gross: bruto, p_has_npwp: hasNpwp })
 if (!error) taxAmountRpc = Number(data)
 } catch { /* RPC tidak tersedia — pakai perhitungan klien */ }
 const { pajak: taxAmountPph23 } = calcPph23Jasa(bruto, hasNpwp)

 const existingP = existingByEmp[employeeId]
 const skip = !!existingP && !['draft', 'dihitung'].includes(existingP.status)

 rows.push({
 employeeId, employeeName: emp.full_name, npwp: emp.npwp, hasNpwp,
 branchId: emp.branch_id, bank: emp.bank_account ? `${emp.bank_name ?? '-'} • ${emp.bank_account} a.n. ${emp.bank_holder ?? '-'}` : '-',
 lines, bruto, taxScheme: 'pph21_bukan_pegawai', taxChoice: 'client',
 dpp, taxAmountClient, taxAmountRpc, taxAmountPph23, taxAmountManual: 0, otherDeduction: 0,
 skip, skipReason: skip ? `Payout sudah berstatus "${existingP.status}" — tidak dihitung ulang` : undefined,
 })
 }
 rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'id'))
 setPreview(rows)
 setCalcStep('pratinjau')
 if (!rows.length) toast.push('Tidak ada entri produktivitas terverifikasi milik mitra pada periode ini', 'error')
 } catch (e: any) { toast.push(e.message ?? 'Gagal menghitung payout', 'error') }
 finally { setCalcLoading(false) }
 }

 function patchRow(idx: number, patch: Partial<PreviewRow>) { setPreview(p => p.map((r, i) => i === idx ? { ...r, ...patch } : r)) }

 const previewTotals = useMemo(() => preview.filter(r => !r.skip).reduce((a, r) => ({
 bruto: a.bruto + r.bruto, pajak: a.pajak + effectiveTax(r), netto: a.netto + netto(r),
 }), { bruto: 0, pajak: 0, netto: 0 }), [preview])

 async function saveCalc() {
 const toSave = preview.filter(r => !r.skip)
 if (!toSave.length) { toast.push('Tidak ada baris yang bisa disimpan', 'error'); return }
 setCalcSaving(true)
 try {
 const existing = await list<any>('freelance_payouts', { eq: { period_code: calcPeriod } })
 const existingByEmp: Record<string, any> = {}
 existing.forEach((p: any) => { if (p.employee_id) existingByEmp[p.employee_id] = p })

 for (const r of toSave) {
 const tax = effectiveTax(r)
 const dppAmount = r.taxScheme === 'pph21_bukan_pegawai' ? r.dpp : r.bruto
 const dppPercent = r.taxScheme === 'pph21_bukan_pegawai' ? 50 : 100
 const taxRate = r.bruto > 0 ? tax / r.bruto : 0
 const payload = {
 company_id: profile?.company_id, period_code: calcPeriod, employee_id: r.employeeId, payee_type: 'orang_pribadi',
 npwp: r.npwp, has_npwp: r.hasNpwp, gross_amount: r.bruto, dpp_percent: dppPercent, dpp_amount: Math.round(dppAmount),
 tax_scheme: r.taxScheme, tax_rate: taxRate, tax_amount: Math.round(tax), other_deduction: r.otherDeduction || 0,
 net_amount: netto(r), status: 'dihitung',
 }
 let payoutId = existingByEmp[r.employeeId]?.id
 if (payoutId) { await update('freelance_payouts', payoutId, payload) }
 else {
 const no = await nextDocNo(profile!.company_id, 'PYF')
 const created = await insert<any>('freelance_payouts', { ...payload, payout_no: no, created_by: profile?.id })
 payoutId = created.id
 }
 await supabase.from('freelance_payout_lines').delete().eq('payout_id', payoutId)
 if (r.lines.length) {
 await supabase.from('freelance_payout_lines').insert(r.lines.map(l => ({
 company_id: profile?.company_id, payout_id: payoutId, job_type_id: l.jobTypeId, work_date: l.workDate,
 qty: l.qty, rate: l.rate, amount: l.amount, qc_passed: l.qcStatus !== 'tidak_lulus',
 description: l.jobTypeName + (l.usedFallback ? ' (tarif cadangan job_types)' : ''),
 productivity_entry_id: l.productivityEntryId, work_order_id: l.workOrderId, created_by: profile?.id,
 })))
 }
 }
 toast.push(`${toSave.length} payout mitra berhasil dihitung & disimpan`); setCalcOpen(false)
 setPeriod(calcPeriod); setBranchFilter(calcBranch); setStatusTab('dihitung')
 loadPayouts(); loadDashboard()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan payout', 'error') }
 finally { setCalcSaving(false) }
 }

 // ---------- Alur status ----------
 async function bulkTransition(next: string) {
 if (!selectedIds.length) return
 setTransitioning(true)
 try {
 for (const id of selectedIds) {
 const patch: any = { status: next }
 if (next === 'disetujui') {
 const row = payouts.find(p => p.id === id)
 if (row && !row.self_billing_no) patch.self_billing_no = await nextDocNo(profile!.company_id, 'SBL')
 }
 await update('freelance_payouts', id, patch)
 }
 toast.push(`${selectedIds.length} payout diperbarui menjadi "${next}"`); loadPayouts()
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status payout', 'error') }
 finally { setTransitioning(false) }
 }

 async function confirmPay() {
 if (!payForm.paid_at || !payForm.payment_ref) { toast.push('Tanggal dan referensi transfer wajib diisi', 'error'); return }
 setTransitioning(true)
 try {
 for (const id of selectedIds) {
 await update('freelance_payouts', id, { status: 'dibayar', paid_at: new Date(payForm.paid_at).toISOString(), payment_ref: payForm.payment_ref })
 }
 toast.push(`${selectedIds.length} payout ditandai dibayar`); setPayModal(false); loadPayouts(); loadDashboard()
 } catch (e: any) { toast.push(e.message ?? 'Gagal menandai pembayaran', 'error') }
 finally { setTransitioning(false) }
 }

 function openReject(r: any) { setRejectRow(r); setRejectReason('') }
 function friendlyPayoutError(e: any, fallback: string) {
 const msg = e?.message ?? ''
 if (/row-level security|permission denied/i.test(msg)) return 'Gagal menyimpan — hak akses Anda pada modul PAYROLL tidak mengizinkan tindakan ini (perlu izin write/approve).'
 return msg || fallback
 }
 async function submitReject() {
 if (!rejectReason.trim()) { toast.push('Alasan penolakan wajib diisi', 'error'); return }
 setRejectSaving(true)
 try {
 await update('freelance_payouts', rejectRow.id, { status: 'ditolak', note: `${rejectRow.note ?? ''}\n\nAlasan penolakan: ${rejectReason}`.trim() })
 toast.push('Payout ditolak'); setRejectRow(null); setSelectedIds([]); setDrawerRow(null); loadPayouts(); loadDashboard()
 } catch (e: any) { toast.push(friendlyPayoutError(e, 'Gagal menolak payout'), 'error') }
 finally { setRejectSaving(false) }
 }

 function exportTransfer() {
 exportCSV(filteredByTab.map(r => ({
 nama: r.employees?.full_name, bank: r.employees?.bank_name, no_rekening: r.employees?.bank_account, netto: r.net_amount,
 })), `transfer-mitra-freelance-${period}`)
 }

 async function openDrawer(r: any) {
 setDrawerRow(r); setDrawerLines(null)
 try { setDrawerLines(await list('freelance_payout_lines', { select: '*,job_types(name)', eq: { payout_id: r.id }, order: { col: 'work_date', asc: true } })) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memuat rincian payout', 'error') }
 }

 const stepIdx = drawerRow ? Math.max(0, PAYOUT_STEPS.findIndex(s => s.key === drawerRow.status)) : 0

 return (
 <div>
 <PageHeader title="Payout Mitra Freelance" subtitle="Hitung dan kelola pembayaran mitra freelance per satuan pekerjaan"
 actions={write && <Button icon={<Calculator size={16} />} onClick={openCalc}>Hitung Payout Periode</Button>} />

 {tarifAsumsiCount > 0 && (
 <div className="mb-5 px-3 py-2 rounded-sm bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-caption font-medium flex items-start gap-2">
 <AlertTriangle size={15} className="mt-0.5 shrink-0" />
 <span>{tarifAsumsiCount} tarif dasar (rate card mitra / tarif standar jenis pekerjaan) yang bisa dipakai dalam perhitungan payout masih berstatus <b>asumsi sistem</b>, belum diverifikasi ke kontrak/SPK sebenarnya. Kelola di menu Mitra Freelance & Rate Card atau Produktivitas Teknisi.</span>
 </div>
 )}

 {/* Dashboard ringkas */}
 <div className="grid lg:grid-cols-2 gap-5 mb-5">
 <Card>
 <CardHeader title="Bruto & Netto Payout Freelance" subtitle="6 bulan terakhir" />
 <div className="p-4 h-64">
 {dashLoading ? <TableSkeleton rows={4} /> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={monthlyChart}>
 <CartesianGrid strokeDasharray="3 3" stroke={chartColors().grid} vertical={false} />
 <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
 <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => rupiah(v, true)} />
 <Tooltip formatter={(v: any) => rupiah(Number(v))} />
 <Legend />
 <Bar dataKey="bruto" name="Bruto" fill={chartColors().primarySoft} radius={[4, 4, 0, 0]} />
 <Bar dataKey="netto" name="Netto" fill={chartColors().primary} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 <Card>
 <CardHeader title="Fix Salary vs Freelance (Netto)" subtitle="Perbandingan biaya penggajian per bulan" />
 <div className="p-4 h-64">
 {dashLoading ? <TableSkeleton rows={4} /> : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={compareChart}>
 <CartesianGrid strokeDasharray="3 3" stroke={chartColors().grid} vertical={false} />
 <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
 <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => rupiah(v, true)} />
 <Tooltip formatter={(v: any) => rupiah(Number(v))} />
 <Legend />
 <Bar dataKey="fix_salary" name="Fix Salary (payroll_runs)" fill={chartColors().neutral} radius={[4, 4, 0, 0]} />
 <Bar dataKey="freelance" name="Freelance (freelance_payouts)" fill={chartColors().accent} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>)}
 </div>
 </Card>
 </div>

 <Card className="overflow-hidden mb-5">
 <CardHeader title="10 Mitra Penghasilan Tertinggi" subtitle="Netto, 6 bulan terakhir" />
 {dashLoading ? <TableSkeleton rows={4} /> : topMitra.length === 0 ? <EmptyState title="Belum ada data payout" /> : (
 <div className="p-4 h-64">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={topMitra} layout="vertical" margin={{ left: 24 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={chartColors().grid} horizontal={false} />
 <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => rupiah(v, true)} />
 <YAxis type="category" dataKey="nama" width={120} tick={{ fontSize: 11 }} />
 <Tooltip formatter={(v: any) => rupiah(Number(v))} />
 <Bar dataKey="netto" fill={chartColors().primary} radius={[0, 4, 4, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>)}
 </Card>
 <p className="text-caption text-ink-400 -mt-3 mb-5">Sumber data: freelance_payouts & payroll_runs, 6 periode berjalan — ditarik {tgl(todayISO())}.</p>

 {/* Daftar payout per periode */}
 <div className="flex flex-wrap items-end gap-3 mb-4">
 <Field label="Periode"><Input type="month" value={period} onChange={(e: any) => setPeriod(e.target.value)} /></Field>
 <Field label="Cabang" className="w-52"><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={branchFilter} onChange={(e: any) => setBranchFilter(e.target.value)} placeholder="Semua cabang" /></Field>
 </div>

 <Tabs tabs={tabCounts} value={statusTab} onChange={setStatusTab} />

 <div className="flex items-center justify-between flex-wrap gap-2 my-3">
 <span className="text-caption text-ink-500">{filteredByTab.length} payout</span>
 <div className="flex gap-2 flex-wrap">
 {write && statusTab === 'dihitung' && selectedIds.length > 0 && <Button size="sm" loading={transitioning} onClick={() => bulkTransition('diverifikasi')}>Verifikasi {selectedIds.length} Payout</Button>}
 {approve && statusTab === 'diverifikasi' && selectedIds.length > 0 && <Button size="sm" variant="success" loading={transitioning} onClick={() => bulkTransition('disetujui')}>Setujui {selectedIds.length} Payout</Button>}
 {approve && statusTab === 'disetujui' && selectedIds.length > 0 && <Button size="sm" variant="success" onClick={() => setPayModal(true)}>Tandai Dibayar ({selectedIds.length})</Button>}
 {(write || approve) && ['dihitung', 'diverifikasi', 'disetujui'].includes(statusTab) && selectedIds.length === 1 && <Button size="sm" variant="danger" onClick={() => openReject(payouts.find(p => p.id === selectedIds[0]))}>Tolak Payout</Button>}
 {(statusTab === 'disetujui' || statusTab === 'dibayar') && filteredByTab.length > 0 && <Button size="sm" variant="outline" icon={<Download size={14} />} onClick={exportTransfer}>Ekspor CSV Transfer</Button>}
 </div>
 </div>

 <DataTable
 loading={loading} rows={filteredByTab} onRowClick={openDrawer} emptyTitle="Belum ada payout pada status ini"
 searchKeys={['payout_no']} selectable={write || approve} onSelect={setSelectedIds}
 columns={[
 { key: 'payout_no', header: 'No Payout' },
 { key: 'period_code', header: 'Periode' },
 { key: 'nama', header: 'Mitra', render: r => r.employees?.full_name ?? '-' },
 { key: 'gross_amount', header: 'Bruto', align: 'right', render: r => rupiah(r.gross_amount) },
 { key: 'dpp_amount', header: 'DPP', align: 'right', render: r => rupiah(r.dpp_amount) },
 { key: 'tax_scheme', header: 'Jenis Pajak', render: r => TAX_SCHEME_OPTIONS.find(t => t.value === r.tax_scheme)?.label ?? r.tax_scheme },
 { key: 'tax_amount', header: 'Pajak', align: 'right', render: r => rupiah(r.tax_amount) },
 { key: 'net_amount', header: 'Netto', align: 'right', render: r => <span className="font-semibold">{rupiah(r.net_amount)}</span> },
 { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
 ]}
 />
 {filteredByTab.length > 0 && (
 <div className="flex flex-wrap gap-x-8 gap-y-1 px-4 py-3 mt-2 text-caption text-ink-500 border-t border-ink-200">
 <span>Total Bruto: <b className="text-ink-800">{rupiah(footerTotals.bruto)}</b></span>
 <span>Total DPP: <b className="text-ink-800">{rupiah(footerTotals.dpp)}</b></span>
 <span>Total Pajak: <b className="text-ink-800">{rupiah(footerTotals.pajak)}</b></span>
 <span>Total Netto: <b className="text-ink-800">{rupiah(footerTotals.netto)}</b></span>
 </div>
 )}

 <p className="text-caption text-ink-400 mt-5">
 Tarif PPh 21 bukan pegawai memakai DPP 50% atas bruto dan tarif progresif Pasal 17 UU 7/2021 (HPP). Perhitungan kumulatif setahun
 dan status berkesinambungan/tidak berkesinambungan wajib diverifikasi tim pajak sebelum pemotongan dilakukan.
 </p>

 {/* Modal tandai dibayar */}
 <Modal open={payModal} onClose={() => setPayModal(false)} title="Tandai Dibayar"
 footer={<><Button variant="outline" onClick={() => setPayModal(false)}>Batal</Button><Button loading={transitioning} onClick={confirmPay}>Konfirmasi Dibayar</Button></>}>
 <div className="space-y-4">
 <p className="text-body text-ink-600">{selectedIds.length} payout akan ditandai dibayar.</p>
 <Field label="Tanggal Transfer" required><Input type="date" value={payForm.paid_at} onChange={(e: any) => setPayForm({ ...payForm, paid_at: e.target.value })} /></Field>
 <Field label="Referensi Transfer" required><Input value={payForm.payment_ref} onChange={(e: any) => setPayForm({ ...payForm, payment_ref: e.target.value })} placeholder="No. referensi bank / batch transfer" /></Field>
 </div>
 </Modal>

 {/* Modal tolak payout */}
 <Modal open={!!rejectRow} onClose={() => setRejectRow(null)} title="Tolak Payout Mitra" size="sm"
 footer={<><Button variant="outline" onClick={() => setRejectRow(null)}>Batal</Button><Button variant="danger" loading={rejectSaving} onClick={submitReject}>Tolak Payout</Button></>}>
 {rejectRow && <div className="space-y-3">
 <p className="text-body text-ink-600">Payout <b>{rejectRow.payout_no}</b> milik <b>{rejectRow.employees?.full_name}</b> (Netto {rupiah(rejectRow.net_amount)}) akan ditolak dan tidak dilanjutkan ke pembayaran.</p>
 <Field label="Alasan Penolakan" required><Input value={rejectReason} onChange={(e: any) => setRejectReason(e.target.value)} placeholder="Wajib diisi — mis. salah hitung, tidak sesuai SPK" /></Field>
 </div>}
 </Modal>

 {/* Wizard Hitung Payout Periode */}
 <Modal open={calcOpen} onClose={() => setCalcOpen(false)} size="xl"
 title="Hitung Payout Periode"
 footer={calcStep === 'pilih'
 ? <><Button variant="outline" onClick={() => setCalcOpen(false)}>Batal</Button><Button loading={calcLoading} icon={<Calculator size={14} />} onClick={runCalc}>Tarik Data & Hitung</Button></>
 : <><Button variant="outline" onClick={() => setCalcStep('pilih')}>← Ubah Periode</Button><Button loading={calcSaving} onClick={saveCalc} disabled={!preview.some(r => !r.skip)}>Simpan {preview.filter(r => !r.skip).length} Payout</Button></>}>
 {calcStep === 'pilih' && (
 <div className="space-y-4">
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Periode" required><Input type="month" value={calcPeriod} onChange={(e: any) => setCalcPeriod(e.target.value)} /></Field>
 <Field label="Cabang (opsional)"><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={calcBranch} onChange={(e: any) => setCalcBranch(e.target.value)} placeholder="Semua cabang" /></Field>
 </div>
 <div className="bg-primary-50 border border-primary-200 rounded-md p-3 text-caption text-ink-600">
 Sistem menarik entri produktivitas berstatus <b>Diverifikasi</b> milik mitra freelance/campuran pada periode ini.
 Hanya pekerjaan dengan status QC <b>Lulus</b> atau <b>Belum di-QC</b> yang dihitung — pekerjaan dengan QC <b>Tidak Lulus</b> dikeluarkan otomatis.
 Tarif diambil dari rate card (khusus mitra → vendor → umum); bila tidak ada rate card, dipakai tarif standar job_types sebagai cadangan (ditandai).
 </div>
 </div>
 )}
 {calcStep === 'pratinjau' && (
 <div>
 {preview.length === 0 ? <EmptyState title="Tidak ada data untuk dihitung" /> : (
 <div className="overflow-auto -mx-1">
 <table className="w-full text-body border-separate border-spacing-0 min-w-[900px]">
 <thead className="bg-ink-50">
 <tr>
 {['Mitra', 'Pekerjaan', 'Bruto', 'Skema Pajak', 'DPP', 'Pajak', 'Potongan Lain', 'Netto', ''].map((h, i) => (
 <th key={i} className="px-2 h-10 font-semibold text-caption uppercase text-ink-500 border-b border-ink-200 text-left whitespace-nowrap">{h}</th>))}
 </tr>
 </thead>
 <tbody>
 {preview.map((r, idx) => {
 const fallbackCount = r.lines.filter(l => l.usedFallback).length
 const diff = r.taxScheme === 'pph21_bukan_pegawai' && r.taxAmountRpc != null && r.taxAmountRpc !== r.taxAmountClient
 return (
 <tr key={r.employeeId} className={`border-b border-ink-100 align-top ${r.skip ? 'opacity-50' : ''}`}>
 <td className="px-2 py-2 font-medium text-ink-800">
 {r.employeeName}
 {!r.hasNpwp && <div><Badge tone="red">Tanpa NPWP</Badge></div>}
 {r.skip && <div className="text-caption text-red-600 mt-1">{r.skipReason}</div>}
 </td>
 <td className="px-2 py-2 tabular">{r.lines.length} baris{fallbackCount > 0 && <div><Badge tone="amber">{fallbackCount} pakai tarif cadangan</Badge></div>}</td>
 <td className="px-2 py-2 text-right tabular">{rupiah(r.bruto)}</td>
 <td className="px-2 py-2 w-48">
 <Select disabled={r.skip} options={TAX_SCHEME_OPTIONS} value={r.taxScheme} onChange={(e: any) => patchRow(idx, { taxScheme: e.target.value })} />
 {r.taxScheme === 'pph21_bukan_pegawai' && diff && (
 <div className="mt-1 text-caption">
 <div className="text-amber-600 font-medium">Selisih hasil RPC vs perhitungan klien!</div>
 <label className="flex items-center gap-1"><input type="radio" checked={r.taxChoice === 'client'} onChange={() => patchRow(idx, { taxChoice: 'client' })} /> Progresif klien: {rupiah(r.taxAmountClient)}</label>
 <label className="flex items-center gap-1"><input type="radio" checked={r.taxChoice === 'rpc'} onChange={() => patchRow(idx, { taxChoice: 'rpc' })} /> RPC database: {rupiah(r.taxAmountRpc ?? 0)}</label>
 </div>)}
 {r.taxScheme === 'final' && <div className="mt-1"><Input type="number" placeholder="Nominal pajak" value={r.taxAmountManual} onChange={(e: any) => patchRow(idx, { taxAmountManual: Number(e.target.value) })} /></div>}
 </td>
 <td className="px-2 py-2 text-right tabular">{r.taxScheme === 'pph21_bukan_pegawai' ? rupiah(r.dpp) : rupiah(r.bruto)}</td>
 <td className="px-2 py-2 text-right tabular">{rupiah(effectiveTax(r))}</td>
 <td className="px-2 py-2 w-28"><Input type="number" disabled={r.skip} value={r.otherDeduction} onChange={(e: any) => patchRow(idx, { otherDeduction: Number(e.target.value) })} /></td>
 <td className="px-2 py-2 text-right tabular font-semibold">{rupiah(netto(r))}</td>
 <td className="px-2 py-2">{r.skip && <Badge tone="slate">Dilewati</Badge>}</td>
 </tr>
 )
 })}
 </tbody>
 <tfoot>
 <tr className="bg-ink-50 font-semibold">
 <td className="px-2 py-2" colSpan={2}>Total ({preview.filter(r => !r.skip).length} mitra)</td>
 <td className="px-2 py-2 text-right tabular">{rupiah(previewTotals.bruto)}</td>
 <td />
 <td />
 <td className="px-2 py-2 text-right tabular">{rupiah(previewTotals.pajak)}</td>
 <td />
 <td className="px-2 py-2 text-right tabular">{rupiah(previewTotals.netto)}</td>
 <td />
 </tr>
 </tfoot>
 </table>
 </div>
 )}
 </div>
 )}
 </Modal>

 {/* Drawer detail payout */}
 <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} title={drawerRow?.payout_no ?? ''} width="max-w-2xl"
 footer={drawerRow && <div className="flex flex-wrap gap-2 w-full justify-between">
 <div className="flex gap-2">
 {write && drawerRow.status === 'dihitung' && <Button size="sm" onClick={async () => { await update('freelance_payouts', drawerRow.id, { status: 'diverifikasi' }); toast.push('Payout diverifikasi'); setDrawerRow(null); loadPayouts() }}>Verifikasi</Button>}
 {approve && drawerRow.status === 'diverifikasi' && <Button size="sm" variant="success" onClick={async () => {
 const no = drawerRow.self_billing_no || await nextDocNo(profile!.company_id, 'SBL')
 await update('freelance_payouts', drawerRow.id, { status: 'disetujui', self_billing_no: no }); toast.push('Payout disetujui'); setDrawerRow(null); loadPayouts()
 }}>Setujui</Button>}
 {approve && drawerRow.status === 'disetujui' && <Button size="sm" variant="success" onClick={() => { setSelectedIds([drawerRow.id]); setDrawerRow(null); setPayModal(true) }}>Tandai Dibayar</Button>}
 {(write || approve) && ['dihitung', 'diverifikasi', 'disetujui'].includes(drawerRow.status) && <Button size="sm" variant="danger" onClick={() => openReject(drawerRow)}>Tolak</Button>}
 </div>
 <Button size="sm" variant="outline" icon={<Printer size={14} />} onClick={() => window.print()}>Cetak Self-Billing</Button>
 </div>}>
 {drawerRow && <div id="self-billing-print">
 <Stepper steps={PAYOUT_STEPS.map(s => s.label)} current={stepIdx} />
 <div className="mt-5 grid grid-cols-2 gap-4 text-caption">
 <div>
 <p className="font-semibold text-ink-800 mb-1">{company?.name ?? '-'}</p>
 <p className="text-ink-500">NPWP: {company?.npwp ?? '-'}</p>
 <p className="text-ink-500">{company?.address ?? '-'}</p>
 <p className="text-ink-500">{company?.phone ?? '-'}</p>
 </div>
 <div>
 <p className="font-semibold text-ink-800 mb-1">{drawerRow.employees?.full_name}</p>
 <p className="text-ink-500">NPWP: {drawerRow.npwp || 'Tanpa NPWP'}</p>
 <p className="text-ink-500">{drawerRow.employees?.bank_name} • {drawerRow.employees?.bank_account} a.n. {drawerRow.employees?.bank_holder}</p>
 <p className="text-ink-500">No. Self-Billing: {drawerRow.self_billing_no || '-'}</p>
 </div>
 </div>

 <p className="font-display font-semibold text-[15px] mt-5 mb-2">Rincian Pekerjaan — Periode {drawerRow.period_code}</p>
 {drawerLines === null ? <TableSkeleton rows={4} /> : (
 <table className="w-full text-body">
 <thead><tr className="text-caption text-ink-500 border-b border-ink-200">
 <th className="text-left py-1.5">Tanggal</th><th className="text-left py-1.5">Jenis Pekerjaan</th>
 <th className="text-right py-1.5">Qty</th><th className="text-right py-1.5">Tarif</th><th className="text-right py-1.5">Jumlah</th><th className="text-left py-1.5">QC</th>
 </tr></thead>
 <tbody>
 {drawerLines.map(l => (
 <tr key={l.id} className="border-b border-ink-100">
 <td className="py-1.5">{tgl(l.work_date)}</td><td className="py-1.5">{l.job_types?.name ?? l.description}</td>
 <td className="py-1.5 text-right tabular">{num(l.qty)}</td><td className="py-1.5 text-right tabular">{rupiah(l.rate)}</td>
 <td className="py-1.5 text-right tabular">{rupiah(l.amount)}</td>
 <td className="py-1.5"><Badge tone={l.qc_passed ? 'emerald' : 'amber'}>{l.qc_passed ? 'Lulus/Belum QC' : 'Perlu Cek'}</Badge></td>
 </tr>))}
 </tbody>
 </table>)}

 <div className="mt-5 max-w-xs ml-auto text-body">
 <div className="flex justify-between py-1"><span className="text-ink-500">Bruto</span><span className="tabular">{rupiah(drawerRow.gross_amount)}</span></div>
 <div className="flex justify-between py-1"><span className="text-ink-500">DPP ({drawerRow.dpp_percent}%)</span><span className="tabular">{rupiah(drawerRow.dpp_amount)}</span></div>
 <div className="flex justify-between py-1"><span className="text-ink-500">Pajak ({TAX_SCHEME_OPTIONS.find(t => t.value === drawerRow.tax_scheme)?.label ?? drawerRow.tax_scheme})</span><span className="tabular text-red-600">-{rupiah(drawerRow.tax_amount)}</span></div>
 {Number(drawerRow.other_deduction) > 0 && <div className="flex justify-between py-1"><span className="text-ink-500">Potongan Lain</span><span className="tabular text-red-600">-{rupiah(drawerRow.other_deduction)}</span></div>}
 <div className="flex justify-between py-2 border-t border-ink-200 font-display font-bold text-[15px]"><span>Netto Diterima</span><span className="tabular">{rupiah(drawerRow.net_amount)}</span></div>
 </div>

 <div className="grid grid-cols-2 gap-8 mt-10 text-center text-caption">
 <div><div className="h-16" /><p className="border-t border-ink-300 pt-1">Mitra / Penerima</p></div>
 <div><div className="h-16" /><p className="border-t border-ink-300 pt-1">Diketahui Perusahaan</p></div>
 </div>

 <p className="text-caption text-ink-400 mt-6">
 Tarif PPh 21 bukan pegawai memakai DPP 50% atas bruto dan tarif progresif Pasal 17 UU 7/2021 (HPP). Perhitungan kumulatif setahun
 dan status berkesinambungan/tidak berkesinambungan wajib diverifikasi tim pajak sebelum pemotongan dilakukan.
 </p>
 </div>}
 </Drawer>
 </div>
 )
}
