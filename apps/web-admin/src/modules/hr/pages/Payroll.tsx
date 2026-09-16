import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update } from '@/lib/db'
import supabase from '@/lib/supabase'
import {
 PageHeader, Card, CardHeader, DataTable, Badge, Button, Modal, Drawer, Field, Input, Textarea,
 Stepper, Desc, useToast, Plus, Download, EmptyState, TableSkeleton,
} from '@/components/ui'
import { rupiah, tgl, periodCode, exportCSV } from '@/lib/format'
import { PAYROLL_STEPS, periodRange } from '../lib/constants'
import { calcPayrollForEmployee, pickEffectiveBpjsConfig } from '../lib/payrollCalc'
import { Calculator, Printer, ShieldAlert } from 'lucide-react'

const emptyPeriod = { period_code: periodCode(), start_date: '', end_date: '', pay_date: '', note: '' }

export default function Payroll() {
 const { profile, can } = useAuth()
 const toast = useToast()
 const [loading, setLoading] = useState(true)
 const [periods, setPeriods] = useState<any[]>([])
 const [selected, setSelected] = useState<any>(null)
 const [runs, setRuns] = useState<any[]>([])
 const [runsLoading, setRunsLoading] = useState(false)
 const [computing, setComputing] = useState(false)
 const [transitioning, setTransitioning] = useState(false)
 const [bpjsConfig, setBpjsConfig] = useState<any>(null)

 const [modalOpen, setModalOpen] = useState(false)
 const [form, setForm] = useState<any>(emptyPeriod)
 const [saving, setSaving] = useState(false)

 const [slip, setSlip] = useState<any>(null)
 const [slipLines, setSlipLines] = useState<any[] | null>(null)

 useEffect(() => { loadPeriods() }, [])
 useEffect(() => { if (selected) { loadRuns(selected.id); loadBpjsConfigForPeriod(selected) } else setBpjsConfig(null) }, [selected?.id])

 async function loadPeriods() {
 setLoading(true)
 try { setPeriods(await list('payroll_periods', { order: { col: 'start_date', asc: false } })) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memuat periode payroll', 'error') }
 finally { setLoading(false) }
 }
 async function loadBpjsConfigForPeriod(period: any) {
 try {
 const [start] = period.start_date && period.end_date ? [period.start_date, period.end_date] : periodRange(period.period_code)
 const bpjsRows = await list<any>('bpjs_config', { order: { col: 'effective_date', asc: false } })
 setBpjsConfig(pickEffectiveBpjsConfig(bpjsRows, start) ?? bpjsRows[0] ?? null)
 } catch { setBpjsConfig(null) }
 }
 async function loadRuns(periodId: string) {
 setRunsLoading(true)
 try { setRuns(await list('payroll_runs', { select: '*,employees(full_name,position,nip)', eq: { period_id: periodId }, order: { col: 'created_at', asc: true } })) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memuat data payroll_runs', 'error') }
 finally { setRunsLoading(false) }
 }

 function openAddPeriod() { setForm(emptyPeriod); setModalOpen(true) }
 async function savePeriod() {
 if (!form.period_code || !form.start_date || !form.end_date) { toast.push('Kode periode, tanggal mulai, dan tanggal akhir wajib diisi', 'error'); return }
 setSaving(true)
 try {
 await insert('payroll_periods', { company_id: profile?.company_id, ...form, pay_date: form.pay_date || null, note: form.note || null, created_by: profile?.id })
 toast.push('Periode payroll dibuat'); setModalOpen(false); loadPeriods()
 } catch (e: any) { toast.push(e.message ?? 'Gagal membuat periode payroll', 'error') }
 finally { setSaving(false) }
 }

 async function hitungUlang() {
 if (!selected) return
 setComputing(true)
 try {
 const [start, end] = selected.start_date && selected.end_date ? [selected.start_date, selected.end_date] : periodRange(selected.period_code)
 const [employees, bpjsRows, terRates, existingRuns] = await Promise.all([
 list<any>('employees', { select: 'id,full_name,ter_category', eq: { status: 'aktif' } }),
 list<any>('bpjs_config', { order: { col: 'effective_date', asc: false } }),
 list<any>('ter_rates', {}),
 list<any>('payroll_runs', { eq: { period_id: selected.id } }),
 ])
 // Pakai baris bpjs_config yang BERLAKU pada tanggal mulai periode (effective_date
 // terbesar yang <= start), bukan sekadar baris pertama/terbaru — bpjs_config bisa
 // punya beberapa versi riwayat (lihat halaman Setelan BPJS & Pajak).
 const bpjs = pickEffectiveBpjsConfig(bpjsRows, start) ?? bpjsRows[0]
 if (!bpjs) { toast.push('Konfigurasi BPJS (bpjs_config) belum tersedia', 'error'); setComputing(false); return }
 setBpjsConfig(bpjs)
 const runByEmp: Record<string, any> = {}
 existingRuns.forEach(r => { runByEmp[r.employee_id] = r })

 for (const emp of employees) {
 const [salLines, prodRows, attRows] = await Promise.all([
 list<any>('employee_salaries', { select: '*,component:salary_components(code,name,component_type,calc_type,taxable,is_bpjs_base)', eq: { employee_id: emp.id } }),
 list<any>('productivity_entries', { select: 'amount', eq: { employee_id: emp.id, status: 'diverifikasi' }, gte: { work_date: start }, lte: { work_date: end } }),
 list<any>('attendances', { select: 'overtime_minutes', eq: { employee_id: emp.id }, gte: { work_date: start }, lte: { work_date: end } }),
 ])
 const activeLines = salLines.filter(l => l.effective_date <= end && (!l.end_date || l.end_date >= start))
 const productivityAmount = prodRows.reduce((s, r) => s + Number(r.amount || 0), 0)
 const overtimeMinutes = attRows.reduce((s, r) => s + Number(r.overtime_minutes || 0), 0)
 const calc = calcPayrollForEmployee({ terCategory: emp.ter_category, salaryLines: activeLines, overtimeMinutes, productivityAmount, bpjs, terRates })

 const runPayload = {
 company_id: profile?.company_id, period_id: selected.id, employee_id: emp.id,
 gross: calc.gross, taxable_gross: calc.taxable_gross,
 bpjs_jht_company: calc.bpjs_jht_company, bpjs_jht_employee: calc.bpjs_jht_employee,
 bpjs_jkk: calc.bpjs_jkk, bpjs_jkm: calc.bpjs_jkm,
 bpjs_jp_company: calc.bpjs_jp_company, bpjs_jp_employee: calc.bpjs_jp_employee,
 bpjs_kes_company: calc.bpjs_kes_company, bpjs_kes_employee: calc.bpjs_kes_employee,
 overtime_amount: calc.overtime_amount, productivity_amount: calc.productivity_amount,
 pph21_amount: calc.pph21_amount, other_deduction: calc.other_deduction, net_pay: calc.net_pay,
 status: 'dihitung',
 }
 let runId = runByEmp[emp.id]?.id
 if (runId) { await update('payroll_runs', runId, runPayload) }
 else { const created = await insert<any>('payroll_runs', { ...runPayload, created_by: profile?.id }); runId = created.id }

 await supabase.from('payroll_run_lines').delete().eq('run_id', runId)
 if (calc.lines.length) {
 await supabase.from('payroll_run_lines').insert(calc.lines.map(l => ({
 company_id: profile?.company_id, run_id: runId, component_id: l.component_id,
 component_name: l.component_name, component_type: l.component_type, amount: l.amount, created_by: profile?.id,
 })))
 }
 }
 if (selected.status === 'draft') await update('payroll_periods', selected.id, { status: 'dihitung' })
 toast.push('Perhitungan payroll selesai')
 loadPeriods(); loadRuns(selected.id)
 setSelected((s: any) => s ? { ...s, status: s.status === 'draft' ? 'dihitung' : s.status } : s)
 } catch (e: any) { toast.push(e.message ?? 'Gagal menghitung payroll', 'error') }
 finally { setComputing(false) }
 }

 async function transition(next: string, alsoMarkRunsPaid?: boolean) {
 if (!selected) return
 setTransitioning(true)
 try {
 await update('payroll_periods', selected.id, { status: next })
 if (alsoMarkRunsPaid) {
 const ids = runs.map(r => r.id)
 if (ids.length) await supabase.from('payroll_runs').update({ status: 'dibayar', paid_at: new Date().toISOString() }).in('id', ids)
 }
 toast.push(`Status periode diperbarui menjadi "${next}"`)
 setSelected((s: any) => ({ ...s, status: next }))
 loadPeriods(); loadRuns(selected.id)
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengubah status periode', 'error') }
 finally { setTransitioning(false) }
 }

 const totals = useMemo(() => runs.reduce((a, r) => ({
 gross: a.gross + Number(r.gross || 0), bpjsCo: a.bpjsCo + Number(r.bpjs_jht_company || 0) + Number(r.bpjs_jkk || 0) + Number(r.bpjs_jkm || 0) + Number(r.bpjs_jp_company || 0) + Number(r.bpjs_kes_company || 0),
 bpjsEmp: a.bpjsEmp + Number(r.bpjs_jht_employee || 0) + Number(r.bpjs_jp_employee || 0) + Number(r.bpjs_kes_employee || 0),
 overtime: a.overtime + Number(r.overtime_amount || 0), prod: a.prod + Number(r.productivity_amount || 0),
 pph21: a.pph21 + Number(r.pph21_amount || 0), net: a.net + Number(r.net_pay || 0),
 }), { gross: 0, bpjsCo: 0, bpjsEmp: 0, overtime: 0, prod: 0, pph21: 0, net: 0 }), [runs])

 function exportRuns() {
 exportCSV(runs.map(r => ({
 nik: r.employees?.nip, nama: r.employees?.full_name, bruto: r.gross,
 bpjs_perusahaan: Number(r.bpjs_jht_company || 0) + Number(r.bpjs_jkk || 0) + Number(r.bpjs_jkm || 0) + Number(r.bpjs_jp_company || 0) + Number(r.bpjs_kes_company || 0),
 bpjs_pekerja: Number(r.bpjs_jht_employee || 0) + Number(r.bpjs_jp_employee || 0) + Number(r.bpjs_kes_employee || 0),
 lembur: r.overtime_amount, insentif_produktivitas: r.productivity_amount, pph21: r.pph21_amount, netto: r.net_pay,
 })), `payroll-${selected.period_code}`)
 }

 async function openSlip(r: any) {
 setSlip(r); setSlipLines(null)
 try { setSlipLines(await list('payroll_run_lines', { eq: { run_id: r.id }, order: { col: 'component_type', asc: false } })) }
 catch (e: any) { toast.push(e.message ?? 'Gagal memuat rincian slip gaji', 'error') }
 }

 const stepIdx = selected ? Math.max(0, PAYROLL_STEPS.findIndex(s => s.key === selected.status)) : 0

 return (
 <div>
 <PageHeader title="Payroll & Slip Gaji" subtitle="Kelola periode penggajian dan hitung slip gaji karyawan"
 actions={can('PAYROLL', 'write') && <Button icon={<Plus size={16} />} onClick={openAddPeriod}>Buat Periode</Button>} />

 {!selected && (
 <DataTable
 loading={loading} rows={periods} searchKeys={['period_code']} emptyTitle="Belum ada periode payroll"
 onRowClick={setSelected}
 columns={[
 { key: 'period_code', header: 'Periode' },
 { key: 'start_date', header: 'Mulai', render: r => tgl(r.start_date) },
 { key: 'end_date', header: 'Akhir', render: r => tgl(r.end_date) },
 { key: 'pay_date', header: 'Tgl Bayar', render: r => tgl(r.pay_date) },
 { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
 ]}
 />)}

 {selected && (
 <div>
 <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
 <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>← Kembali ke Daftar Periode</Button>
 <div className="flex items-center gap-2 flex-wrap">
 {can('PAYROLL', 'write') && selected.status !== 'dibayar' && selected.status !== 'closed' &&
 <Button size="sm" icon={<Calculator size={14} />} loading={computing} onClick={hitungUlang}>Hitung Ulang</Button>}
 {can('PAYROLL', 'approve') && selected.status === 'dihitung' && <Button size="sm" variant="success" loading={transitioning} onClick={() => transition('diverifikasi')}>Verifikasi</Button>}
 {can('PAYROLL', 'approve') && selected.status === 'diverifikasi' && <Button size="sm" variant="success" loading={transitioning} onClick={() => transition('disetujui')}>Setujui</Button>}
 {can('PAYROLL', 'approve') && selected.status === 'disetujui' && <Button size="sm" variant="success" loading={transitioning} onClick={() => transition('dibayar', true)}>Tandai Dibayar</Button>}
 {can('PAYROLL', 'approve') && selected.status === 'dibayar' && <Button size="sm" variant="outline" loading={transitioning} onClick={() => transition('closed')}>Tutup Periode</Button>}
 {runs.length > 0 && <Button size="sm" variant="outline" icon={<Download size={14} />} onClick={exportRuns}>Ekspor CSV</Button>}
 </div>
 </div>

 <Card className="p-4 mb-5">
 <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
 <p className="font-display font-semibold text-[17px]">Periode {selected.period_code} <span className="text-caption text-ink-400 font-normal">({tgl(selected.start_date)} – {tgl(selected.end_date)})</span></p>
 {bpjsConfig && !bpjsConfig.is_verified && (
 <span className="inline-flex items-center gap-1"><ShieldAlert size={13} className="text-amber-600" /><Badge tone="amber">Tarif belum diverifikasi</Badge></span>
 )}
 </div>
 <Stepper steps={PAYROLL_STEPS.map(s => s.label)} current={stepIdx} />
 </Card>

 <Card className="overflow-hidden">
 <CardHeader title="Rincian Payroll per Karyawan" subtitle={`${runs.length} karyawan`} />
 {runsLoading ? <TableSkeleton /> : runs.length === 0 ? <EmptyState title="Belum ada perhitungan" message="Klik Hitung Ulang untuk menghitung payroll periode ini." /> : (
 <div className="overflow-auto">
 <table className="w-full text-body border-separate border-spacing-0">
 <thead className="bg-ink-50">
 <tr>
 {['Karyawan', 'Bruto', 'BPJS Perusahaan', 'BPJS Pekerja', 'Lembur', 'Insentif Produktivitas', 'PPh 21', 'Netto', ''].map((h, i) => (
 <th key={i} className={`px-3 h-11 font-semibold text-caption uppercase text-ink-500 border-b border-ink-200 ${i > 0 && i < 8 ? 'text-right' : 'text-left'}`}>{h}</th>))}
 </tr>
 </thead>
 <tbody>
 {runs.map(r => (
 <tr key={r.id} className="border-b border-ink-100 hover:bg-primary-50/40 cursor-pointer" onClick={() => openSlip(r)}>
 <td className="px-3 py-2.5 text-ink-800 font-medium">{r.employees?.full_name}</td>
 <td className="px-3 py-2.5 text-right tabular">{rupiah(r.gross)}</td>
 <td className="px-3 py-2.5 text-right tabular">{rupiah(Number(r.bpjs_jht_company || 0) + Number(r.bpjs_jkk || 0) + Number(r.bpjs_jkm || 0) + Number(r.bpjs_jp_company || 0) + Number(r.bpjs_kes_company || 0))}</td>
 <td className="px-3 py-2.5 text-right tabular">{rupiah(Number(r.bpjs_jht_employee || 0) + Number(r.bpjs_jp_employee || 0) + Number(r.bpjs_kes_employee || 0))}</td>
 <td className="px-3 py-2.5 text-right tabular">{rupiah(r.overtime_amount)}</td>
 <td className="px-3 py-2.5 text-right tabular">{rupiah(r.productivity_amount)}</td>
 <td className="px-3 py-2.5 text-right tabular">{rupiah(r.pph21_amount)}</td>
 <td className="px-3 py-2.5 text-right tabular font-semibold">{rupiah(r.net_pay)}</td>
 <td className="px-3 py-2.5"><Badge>{r.status}</Badge></td>
 </tr>))}
 </tbody>
 <tfoot>
 <tr className="bg-ink-50 font-semibold">
 <td className="px-3 py-2.5">Total</td>
 <td className="px-3 py-2.5 text-right tabular">{rupiah(totals.gross)}</td>
 <td className="px-3 py-2.5 text-right tabular">{rupiah(totals.bpjsCo)}</td>
 <td className="px-3 py-2.5 text-right tabular">{rupiah(totals.bpjsEmp)}</td>
 <td className="px-3 py-2.5 text-right tabular">{rupiah(totals.overtime)}</td>
 <td className="px-3 py-2.5 text-right tabular">{rupiah(totals.prod)}</td>
 <td className="px-3 py-2.5 text-right tabular">{rupiah(totals.pph21)}</td>
 <td className="px-3 py-2.5 text-right tabular">{rupiah(totals.net)}</td>
 <td />
 </tr>
 </tfoot>
 </table>
 </div>)}
 </Card>
 <p className="text-caption text-ink-400 mt-4">Tarif TER dan iuran BPJS bersumber dari tabel referensi di basis data; verifikasi ke PMK 168/2023 dan sertifikat kepesertaan BPJS sebelum dipakai membayar.</p>
 </div>
 )}

 <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Buat Periode Payroll"
 footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button loading={saving} onClick={savePeriod}>Simpan</Button></>}>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Kode Periode" required><Input value={form.period_code} onChange={(e: any) => setForm({ ...form, period_code: e.target.value })} /></Field>
 <Field label="Tanggal Bayar"><Input type="date" value={form.pay_date} onChange={(e: any) => setForm({ ...form, pay_date: e.target.value })} /></Field>
 <Field label="Tanggal Mulai" required><Input type="date" value={form.start_date} onChange={(e: any) => setForm({ ...form, start_date: e.target.value })} /></Field>
 <Field label="Tanggal Akhir" required><Input type="date" value={form.end_date} onChange={(e: any) => setForm({ ...form, end_date: e.target.value })} /></Field>
 <Field label="Catatan" className="sm:col-span-2"><Textarea value={form.note} onChange={(e: any) => setForm({ ...form, note: e.target.value })} /></Field>
 </div>
 </Modal>

 <Drawer open={!!slip} onClose={() => setSlip(null)} title="Slip Gaji" width="max-w-xl"
 footer={<Button icon={<Printer size={14} />} onClick={() => window.print()}>Cetak</Button>}>
 {slip && <div id="slip-print">
 <Desc cols={2} items={[
 { label: 'Nama', value: slip.employees?.full_name }, { label: 'NIK', value: slip.employees?.nip },
 { label: 'Jabatan', value: slip.employees?.position }, { label: 'Periode', value: selected?.period_code },
 ]} />
 <div className="mt-5">
 {slipLines === null ? <TableSkeleton rows={4} /> : (
 <table className="w-full text-body">
 <tbody>
 {slipLines.filter(l => l.component_type === 'earning').map(l => <tr key={l.id}><td className="py-1 text-ink-600">{l.component_name}</td><td className="py-1 text-right tabular">{rupiah(l.amount)}</td></tr>)}
 <tr className="border-t border-ink-200"><td className="py-1.5 font-semibold">Total Bruto</td><td className="py-1.5 text-right tabular font-semibold">{rupiah(slip.gross)}</td></tr>
 {slipLines.filter(l => l.component_type === 'deduction').map(l => <tr key={l.id}><td className="py-1 text-ink-600">{l.component_name}</td><td className="py-1 text-right tabular text-red-600">-{rupiah(l.amount)}</td></tr>)}
 <tr className="border-t border-ink-200"><td className="py-2 font-display font-bold text-[15px]">Gaji Diterima (Netto)</td><td className="py-2 text-right tabular font-display font-bold text-[15px]">{rupiah(slip.net_pay)}</td></tr>
 </tbody>
 </table>)}
 </div>
 <p className="text-caption text-ink-400 mt-5">Tarif TER dan iuran BPJS bersumber dari tabel referensi di basis data; verifikasi ke PMK 168/2023 dan sertifikat kepesertaan BPJS sebelum dipakai membayar.</p>
 </div>}
 </Drawer>
 </div>
 )
}
