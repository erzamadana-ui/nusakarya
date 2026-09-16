import React, { useEffect, useMemo, useState } from 'react'
import { chartColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { list } from '@/lib/db'
import { rupiah, pct, tgl, todayISO } from '@/lib/format'
import { PageHeader, Card, CardHeader, KpiCard, Badge, TableSkeleton, EmptyState, Section, DataTable } from '@/components/ui'
import { Wallet, TrendingDown, AlertTriangle, Clock3, PieChart } from 'lucide-react'
import {
 ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Cell,
} from 'recharts'
import {
 daysSince, sisaTagihan, agingBucketKey, AGING_BUCKETS, agingTone, lastMonths, ymLabel, addDays, CHART_COLORS,
} from '../lib/helpers'

const rp = (v: any) => rupiah(Number(v) || 0)

export default function DashboardFinance() {
 const { profile } = useAuth()
 const [loading, setLoading] = useState(true)
 const [err, setErr] = useState<string | null>(null)

 const [dashRows, setDashRows] = useState<any[]>([])
 const [marginRows, setMarginRows] = useState<any[]>([])
 const [vendorInvoices, setVendorInvoices] = useState<any[]>([])
 const [arInvoices, setArInvoices] = useState<any[]>([])
 const [vendors, setVendors] = useState<any[]>([])
 const [apPayments, setApPayments] = useState<any[]>([])
 const [slaRows, setSlaRows] = useState<any[]>([])
 const [jobCosts, setJobCosts] = useState<any[]>([])

 useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

 async function load() {
 setLoading(true); setErr(null)
 try {
 const cid = profile!.company_id
 const [dash, margin, vinv, ainv, vend, appay, sla, jc] = await Promise.all([
 list('v_dashboard_finance', { eq: { company_id: cid }, limit: 3000 }),
 list('v_project_margin', { eq: { company_id: cid }, limit: 500 }),
 list('vendor_invoices', { select: 'id,inv_no,vendor_id,invoice_date,due_date,total,paid_amount,status', eq: { company_id: cid }, limit: 3000 }),
 list('ar_invoices', { select: 'id,inv_no,customer_id,invoice_date,due_date,total,paid_amount,status', eq: { company_id: cid }, limit: 3000 }),
 list('vendors', { select: 'id,name,payment_term_days', eq: { company_id: cid }, limit: 1000 }),
 list('ap_payments', { select: 'invoice_id,payment_date', eq: { company_id: cid }, limit: 5000 }),
 list('partner_payment_sla', { select: 'vendor_id,target_days', eq: { company_id: cid }, limit: 500 }),
 list('job_costs', { select: 'cost_date,amount', eq: { company_id: cid }, limit: 5000 }),
 ])
 setDashRows(dash); setMarginRows(margin); setVendorInvoices(vinv); setArInvoices(ainv)
 setVendors(vend); setApPayments(appay); setSlaRows(sla); setJobCosts(jc)
 } catch (e: any) {
 setErr(e.message ?? 'Gagal memuat dashboard finance')
 } finally { setLoading(false) }
 }

 const months = useMemo(() => lastMonths(12), [])
 const cashflowMonthly = useMemo(() => dashRows.filter(r => r.metric === 'cashflow_monthly'), [dashRows])
 const apAgingView = useMemo(() => dashRows.filter(r => r.metric === 'ap_aging'), [dashRows])

 const cfChart = useMemo(() => months.map(m => {
 const masuk = Number(cashflowMonthly.find(r => r.bucket === `${m}:in`)?.amount ?? 0)
 const keluar = Number(cashflowMonthly.find(r => r.bucket === `${m}:out`)?.amount ?? 0)
 return { bulan: ymLabel(m), masuk, keluar, saldo: masuk - keluar }
 }), [months, cashflowMonthly])
 const currentMonth = cfChart[cfChart.length - 1] ?? { masuk: 0, keluar: 0, saldo: 0 }

 const apAgingChart = useMemo(() => AGING_BUCKETS.map(b => ({
 bucket: b, amount: Number(apAgingView.find(r => r.bucket === b)?.amount ?? 0),
 })), [apAgingView])
 const arAgingChart = useMemo(() => {
 const open = arInvoices.filter(i => !['lunas', 'batal'].includes(i.status) && i.due_date)
 return AGING_BUCKETS.map(b => ({
 bucket: b,
 amount: open.filter(i => agingBucketKey(daysSince(i.due_date) ?? 0) === b)
 .reduce((s, i) => s + sisaTagihan(i.total, i.paid_amount), 0),
 }))
 }, [arInvoices])

 const arBelumTertagih = useMemo(() =>
 arInvoices.filter(i => !['lunas', 'batal'].includes(i.status))
 .reduce((s, i) => s + sisaTagihan(i.total, i.paid_amount), 0), [arInvoices])

 const apJatuhTempo7 = useMemo(() => {
 const today = todayISO(); const limit = addDays(today, 7)
 return vendorInvoices.filter(i => !['lunas', 'ditolak'].includes(i.status) && i.due_date && i.due_date >= today && i.due_date <= limit)
 .reduce((s, i) => s + sisaTagihan(i.total, i.paid_amount), 0)
 }, [vendorInvoices])

 const marginBulanIni = useMemo(() => {
 const ymNow = new Date().toISOString().slice(0, 7)
 const revenue = arInvoices.filter(i => (i.invoice_date ?? '').slice(0, 7) === ymNow).reduce((s, i) => s + Number(i.total || 0), 0)
 const cost = jobCosts.filter(c => (c.cost_date ?? '').slice(0, 7) === ymNow).reduce((s, c) => s + Number(c.amount || 0), 0)
 const rp_ = revenue - cost
 const pctv = revenue > 0 ? (rp_ / revenue) * 100 : null
 return { revenue, cost, rp: rp_, pct: pctv }
 }, [arInvoices, jobCosts])

 const marginProyek = useMemo(() =>
 [...marginRows].sort((a, b) => Number(a.margin_percent ?? 0) - Number(b.margin_percent ?? 0)).slice(0, 12)
 .map(r => ({ nama: (r.project_name ?? '-').slice(0, 18), marginPct: Number(r.margin_percent ?? 0), marginRp: Number(r.margin ?? 0) })),
 [marginRows])

 // --- Kepatuhan SLA Pembayaran Mitra ---
 const sla = useMemo(() => {
 const vendorMap: Record<string, any> = {}; vendors.forEach(v => { vendorMap[v.id] = v })
 const slaByVendor: Record<string, number> = {}; let defaultTarget: number | null = null
 slaRows.forEach(r => { if (r.vendor_id) slaByVendor[r.vendor_id] = r.target_days; else defaultTarget = r.target_days })
 const targetFor = (vid: string) => slaByVendor[vid] ?? defaultTarget ?? vendorMap[vid]?.payment_term_days ?? 30

 const lastPay: Record<string, string> = {}
 apPayments.forEach(p => { if (!p.invoice_id) return; if (!lastPay[p.invoice_id] || p.payment_date > lastPay[p.invoice_id]) lastPay[p.invoice_id] = p.payment_date })

 const actuals: number[] = []; let onTime = 0
 vendorInvoices.filter(i => i.status === 'lunas').forEach(inv => {
 const pd = lastPay[inv.id]; if (!pd) return
 const actual = daysSince(inv.invoice_date, new Date(pd))
 if (actual == null) return
 actuals.push(actual)
 if (actual <= targetFor(inv.vendor_id)) onTime++
 })
 const avgActual = actuals.length ? actuals.reduce((a, b) => a + b, 0) / actuals.length : null
 const avgTarget = vendors.length ? vendors.reduce((s, v) => s + targetFor(v.id), 0) / vendors.length : null
 const pctOnTime = actuals.length ? (onTime / actuals.length) * 100 : null

 const atRisk = vendorInvoices.filter(i => !['lunas', 'ditolak'].includes(i.status)).map(inv => {
 const elapsed = daysSince(inv.invoice_date) ?? 0
 const target = targetFor(inv.vendor_id)
 const remaining = target - elapsed
 return { ...inv, target, remaining, vendorName: vendorMap[inv.vendor_id]?.name ?? '-' }
 }).filter(x => x.remaining <= 5).sort((a, b) => a.remaining - b.remaining).slice(0, 8)

 return { avgActual, avgTarget, pctOnTime, atRisk, sampleSize: actuals.length }
 }, [vendors, slaRows, apPayments, vendorInvoices])

 const sourceNote = `Sumber data: cash_flows, vendor_invoices, ar_invoices, job_costs, ap_payments, partner_payment_sla (via v_dashboard_finance & v_project_margin). Ditarik: ${tgl(todayISO())}.`

 if (err) return <div className="p-6"><PageHeader title="Dashboard Finance" /><EmptyState title="Gagal memuat" message={err} /></div>

 return (
 <div>
 <PageHeader title="Dashboard Finance" subtitle="Ringkasan kas, piutang, hutang, dan margin — fokus pada kelancaran pembayaran mitra." />

 {loading ? <TableSkeleton rows={4} /> : (
 <>
 <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
 <KpiCard label="Kas Masuk Bulan Ini" value={rp(currentMonth.masuk)} tone="emerald" icon={<Wallet size={16} />} />
 <KpiCard label="Kas Keluar Bulan Ini" value={rp(currentMonth.keluar)} tone="red" icon={<TrendingDown size={16} />} />
 <KpiCard label="Saldo Bersih Bulan Ini" value={rp(currentMonth.saldo)} tone={currentMonth.saldo >= 0 ? 'emerald' : 'red'} />
 <KpiCard label="AR Belum Tertagih" value={rp(arBelumTertagih)} tone="amber" icon={<Clock3 size={16} />} />
 <KpiCard label="AP Jatuh Tempo 7 Hari" value={rp(apJatuhTempo7)} tone="orange" icon={<AlertTriangle size={16} />} />
 <KpiCard label="Margin Kotor Bulan Ini" value={rp(marginBulanIni.rp)} sub={marginBulanIni.pct != null ? pct(marginBulanIni.pct) : undefined}
 tone={marginBulanIni.pct != null && marginBulanIni.pct < 10 ? 'red' : 'teal'} icon={<PieChart size={16} />} />
 </div>
 <p className="text-caption text-ink-400 -mt-3 mb-5">{sourceNote} Margin kotor bulan berjalan = total invoice AR (akrual) bulan berjalan dikurangi job cost bulan berjalan; berbeda dari margin per proyek (kumulatif sejak awal proyek).</p>

 <Section title="Arus Kas Masuk vs Keluar — 12 Bulan Terakhir">
 <Card className="p-4">
 <ResponsiveContainer width="100%" height={300}>
 <ComposedChart data={cfChart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={chartColors().grid} />
 <XAxis dataKey="bulan" tick={{ fontSize: 12 }} />
 <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => rupiah(v, true)} width={70} />
 <Tooltip formatter={(v: any) => rp(v)} />
 <Legend />
 <Bar dataKey="masuk" name="Kas Masuk" fill={CHART_COLORS().masuk} radius={[3, 3, 0, 0]} />
 <Bar dataKey="keluar" name="Kas Keluar" fill={CHART_COLORS().keluar} radius={[3, 3, 0, 0]} />
 <Line type="monotone" dataKey="saldo" name="Saldo Bersih" stroke={CHART_COLORS().primary} strokeWidth={2} dot={false} />
 </ComposedChart>
 </ResponsiveContainer>
 <p className="text-caption text-ink-400 mt-2">Sumber: cash_flows via v_dashboard_finance (metric cashflow_monthly). Ditarik: {tgl(todayISO())}.</p>
 </Card>
 </Section>

 <div className="grid md:grid-cols-2 gap-4 mb-6">
 <Card className="p-4">
 <CardHeader className="px-0 pt-0" title="Aging Hutang (AP)" subtitle="Sisa tagihan vendor per umur" />
 <ResponsiveContainer width="100%" height={220}>
 <BarChart data={apAgingChart}>
 <CartesianGrid strokeDasharray="3 3" stroke={chartColors().grid} />
 <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
 <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => rupiah(v, true)} width={64} />
 <Tooltip formatter={(v: any) => rp(v)} />
 <Bar dataKey="amount" name="Sisa AP" radius={[3, 3, 0, 0]}>
 {apAgingChart.map((d, i) => <Cell key={i} fill={agingTone(d.bucket) === 'red' ? chartColors().danger : agingTone(d.bucket) === 'orange' ? chartColors().warning : chartColors().accent} />)}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </Card>
 <Card className="p-4">
 <CardHeader className="px-0 pt-0" title="Aging Piutang (AR)" subtitle="Sisa tagihan pelanggan per umur" />
 <ResponsiveContainer width="100%" height={220}>
 <BarChart data={arAgingChart}>
 <CartesianGrid strokeDasharray="3 3" stroke={chartColors().grid} />
 <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
 <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => rupiah(v, true)} width={64} />
 <Tooltip formatter={(v: any) => rp(v)} />
 <Bar dataKey="amount" name="Sisa AR" fill={CHART_COLORS().teal} radius={[3, 3, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </Card>
 </div>
 <p className="text-caption text-ink-400 -mt-4 mb-6">Bucket "0-30" turut mencakup invoice yang belum jatuh tempo, mengikuti definisi view v_dashboard_finance. Ditarik: {tgl(todayISO())}.</p>

 <Section title="Margin per Proyek">
 <Card className="p-4">
 {marginProyek.length === 0 ? <EmptyState title="Belum ada data proyek" /> : (
 <ResponsiveContainer width="100%" height={Math.max(220, marginProyek.length * 34)}>
 <BarChart data={marginProyek} layout="vertical" margin={{ left: 24 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={chartColors().grid} />
 <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
 <YAxis type="category" dataKey="nama" tick={{ fontSize: 12 }} width={140} />
 <Tooltip formatter={(v: any, n: any) => n === 'marginPct' ? [`${Number(v).toFixed(1)}%`, 'Margin %'] : [rp(v), 'Margin Rp']} />
 <Bar dataKey="marginPct" name="marginPct" radius={[0, 3, 3, 0]}>
 {marginProyek.map((d, i) => <Cell key={i} fill={d.marginPct < 10 ? chartColors().danger : CHART_COLORS().primary} />)}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 )}
 <p className="text-caption text-ink-400 mt-2">Sumber: v_project_margin (kontrak dikurangi total job cost, kumulatif sejak awal proyek). Batang merah = margin di bawah 10%. Ditarik: {tgl(todayISO())}.</p>
 </Card>
 </Section>

 <Section title="Kepatuhan SLA Pembayaran Mitra">
 <Card className="p-4">
 <div className="grid sm:grid-cols-3 gap-3 mb-4">
 <div className="p-3 rounded-md bg-ink-50">
 <p className="text-caption text-ink-500">Rata-rata Hari Bayar Aktual</p>
 <p className="font-display text-[22px] font-bold text-ink-900 mt-1">{sla.avgActual != null ? `${sla.avgActual.toFixed(1)} hari` : '-'}</p>
 </div>
 <div className="p-3 rounded-md bg-ink-50">
 <p className="text-caption text-ink-500">Rata-rata Target SLA</p>
 <p className="font-display text-[22px] font-bold text-ink-900 mt-1">{sla.avgTarget != null ? `${sla.avgTarget.toFixed(1)} hari` : '-'}</p>
 </div>
 <div className="p-3 rounded-md bg-ink-50">
 <p className="text-caption text-ink-500">Persen Tepat Waktu</p>
 <p className={`font-display text-[22px] font-bold mt-1 ${sla.pctOnTime != null && sla.pctOnTime < 80 ? 'text-red-600' : 'text-emerald-600'}`}>
 {sla.pctOnTime != null ? pct(sla.pctOnTime) : '-'}</p>
 </div>
 </div>
 <p className="text-caption font-medium text-ink-600 mb-2">Invoice yang akan / sudah melewati SLA pembayaran</p>
 <DataTable
 searchable={false}
 columns={[
 { key: 'inv_no', header: 'No Invoice' },
 { key: 'vendorName', header: 'Vendor' },
 { key: 'invoice_date', header: 'Tgl Invoice', render: (r) => tgl(r.invoice_date) },
 { key: 'target', header: 'Target (hari)', align: 'right' },
 {
 key: 'remaining', header: 'Status SLA', align: 'right', render: (r) =>
 r.remaining < 0
 ? <Badge tone="red">Lewat {Math.abs(r.remaining)} hari</Badge>
 : <Badge tone="amber">Sisa {r.remaining} hari</Badge>,
 },
 ]}
 rows={sla.atRisk}
 emptyTitle="Tidak ada invoice berisiko"
 emptyMessage="Semua invoice mitra masih di dalam target SLA pembayaran."
 />
 <p className="text-caption text-ink-400 mt-2">Target dari partner_payment_sla per vendor (fallback: SLA default perusahaan atau termin pembayaran vendor). Hari bayar aktual dihitung dari tanggal invoice sampai tanggal pembayaran terakhir di ap_payments. Sampel invoice lunas: {sla.sampleSize}. Ditarik: {tgl(todayISO())}.</p>
 </Card>
 </Section>
 </>
 )}
 </div>
 )
}
