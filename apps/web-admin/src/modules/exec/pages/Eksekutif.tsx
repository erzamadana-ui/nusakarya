import React, { useEffect, useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, BarChart, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, Activity, FileText, Landmark, AlertTriangle, Printer, Download, Wallet, Percent, ShieldCheck,
  Clock, ClipboardCheck, Gauge, FileWarning, Boxes as BoxesIcon,
} from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { rupiah, num, pct, tgl, tglJam, durasi, todayISO, exportCSV } from '@/lib/format'
import { Card, CardHeader, PageHeader, KpiCard, Skeleton, EmptyState, Button, Section, Badge } from '@/components/ui'
import { fetchMonthlyFinance, fetchTicketRows, type MonthlyFinance, type TicketRow } from '../lib/data'

const COLORS = { pendapatan: '#1B8A92', biaya: '#F5A524', ar: '#1B8A92', ap: '#E11D48', saldo: '#146F77' }

type MoneyRow = { total: number; paid_amount: number; due_date: string | null }
function agingBuckets(rows: MoneyRow[]) {
  const today = new Date()
  const b: Record<string, number> = { 'Belum jatuh tempo': 0, '1–30 hari': 0, '31–60 hari': 0, '61–90 hari': 0, '>90 hari': 0 }
  rows.forEach(r => {
    const out = Number(r.total ?? 0) - Number(r.paid_amount ?? 0)
    if (out <= 0 || !r.due_date) return
    const days = Math.floor((today.getTime() - new Date(r.due_date).getTime()) / 86400000)
    if (days <= 0) b['Belum jatuh tempo'] += out
    else if (days <= 30) b['1–30 hari'] += out
    else if (days <= 60) b['31–60 hari'] += out
    else if (days <= 90) b['61–90 hari'] += out
    else b['>90 hari'] += out
  })
  return b
}
function projectionInflow(rows: MoneyRow[]) {
  const today = new Date()
  const buckets = [0, 0, 0]
  rows.forEach(r => {
    const out = Number(r.total ?? 0) - Number(r.paid_amount ?? 0)
    if (out <= 0 || !r.due_date) return
    const days = Math.floor((new Date(r.due_date).getTime() - today.getTime()) / 86400000)
    if (days > 90) return
    if (days <= 30) buckets[0] += out
    else if (days <= 60) buckets[1] += out
    else buckets[2] += out
  })
  return buckets
}

export default function Eksekutif() {
  const { profile, company, can } = useAuth()
  const [loading, setLoading] = useState(true)
  const [drawn, setDrawn] = useState('')
  const [summary, setSummary] = useState<any>(null)
  const [finance, setFinance] = useState<MonthlyFinance[]>([])
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [avgAchievement, setAvgAchievement] = useState<number | null>(null)
  const [contracts, setContracts] = useState<any[]>([])
  const [slaPenaltyTotal, setSlaPenaltyTotal] = useState(0)
  const [arRows, setArRows] = useState<MoneyRow[]>([])
  const [apRows, setApRows] = useState<MoneyRow[]>([])
  const [cashOpening, setCashOpening] = useState(0)
  const [projectMargin, setProjectMargin] = useState<any[]>([])
  const [certExpired, setCertExpired] = useState<any[]>([])
  const [stockLow, setStockLow] = useState<any[]>([])

  useEffect(() => {
    if (!profile) return
    let alive = true
    setLoading(true)
    const today = todayISO()
    const in60 = new Date(); in60.setDate(in60.getDate() + 60)

    Promise.all([
      supabase.from('v_executive_summary').select('*').maybeSingle().then(r => r.data),
      fetchMonthlyFinance(),
      fetchTicketRows(),
      supabase.from('work_orders').select('status').then(r => r.data ?? []),
      supabase.from('v_dashboard_productivity').select('achievement_percent').then(r => {
        const rows = r.data ?? []
        if (!rows.length) return null
        return rows.reduce((s: number, x: any) => s + Number(x.achievement_percent ?? 0), 0) / rows.length
      }),
      supabase.from('contracts').select('id, contract_name, contract_value, end_date, status').eq('status', 'aktif').then(r => r.data ?? []),
      supabase.from('sla_penalties').select('penalty_amount').then(r => (r.data ?? []).reduce((s: number, x: any) => s + Number(x.penalty_amount ?? 0), 0)),
      supabase.from('ar_invoices').select('total, paid_amount, due_date').neq('status', 'lunas').then(r => r.data ?? []),
      supabase.from('vendor_invoices').select('total, paid_amount, due_date').neq('status', 'lunas').then(r => r.data ?? []),
      supabase.from('cash_flows').select('amount, direction').then(r => (r.data ?? []).reduce((s: number, x: any) => s + (x.direction === 'in' ? Number(x.amount ?? 0) : -Number(x.amount ?? 0)), 0)),
      supabase.from('v_project_margin').select('project_id, project_name, margin, margin_percent').then(r => r.data ?? []),
      supabase.from('employee_certifications').select('id, cert_name, expiry_date, employees(full_name)').lt('expiry_date', today).then(r => r.data ?? []),
      Promise.all([
        supabase.from('stock_balances').select('item_id, qty'),
        supabase.from('item_catalog').select('id, name, min_stock').eq('is_active', true).gt('min_stock', 0),
      ]).then(([sb, ic]) => {
        const qtyByItem: Record<string, number> = {}
        ;(sb.data ?? []).forEach((r: any) => { qtyByItem[r.item_id] = (qtyByItem[r.item_id] ?? 0) + Number(r.qty ?? 0) })
        return (ic.data ?? []).filter((it: any) => (qtyByItem[it.id] ?? 0) < Number(it.min_stock ?? 0))
          .map((it: any) => ({ name: it.name, qty: qtyByItem[it.id] ?? 0, min: it.min_stock }))
      }),
    ]).then(([sum, fin, tix, wo, achv, ctr, penalty, ar, ap, cash, margin, certs, stock]) => {
      if (!alive) return
      setSummary(sum); setFinance(fin as MonthlyFinance[]); setTickets(tix as TicketRow[])
      setWorkOrders(wo as any[]); setAvgAchievement(achv as number | null)
      setContracts(ctr as any[]); setSlaPenaltyTotal(penalty as number)
      setArRows(ar as MoneyRow[]); setApRows(ap as MoneyRow[]); setCashOpening(cash as number)
      setProjectMargin(margin as any[]); setCertExpired(certs as any[]); setStockLow(stock as any[])
      setDrawn(tglJam(new Date().toISOString()))
    }).catch(() => {}).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [profile])

  const slaCompliance = useMemo(() => {
    const withSla = tickets.filter(t => t.sla_status)
    return withSla.length ? (withSla.filter(t => t.sla_status === 'met').length / withSla.length) * 100 : null
  }, [tickets])
  const mttr = useMemo(() => {
    const done = tickets.filter(t => t.ttr_minutes != null)
    return done.length ? done.reduce((s, t) => s + Number(t.ttr_minutes ?? 0), 0) / done.length : null
  }, [tickets])
  const woCompletion = useMemo(() => {
    if (!workOrders.length) return null
    return (workOrders.filter((w: any) => ['selesai', 'done'].includes(w.status)).length / workOrders.length) * 100
  }, [workOrders])

  const ticketBreachByMonth = useMemo(() => {
    const now = new Date()
    const curCode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevCode = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    let cur = 0, prevN = 0
    tickets.forEach(t => {
      if (t.sla_status !== 'breach' || !t.reported_at) return
      const k = String(t.reported_at).slice(0, 7)
      if (k === curCode) cur++
      else if (k === prevCode) prevN++
    })
    return { cur, prevN }
  }, [tickets])

  const contractsExpiring = useMemo(() => {
    const today = new Date()
    return contracts.filter((c: any) => c.end_date && Math.floor((new Date(c.end_date).getTime() - today.getTime()) / 86400000) <= 60 && new Date(c.end_date) >= today)
      .sort((a: any, b: any) => a.end_date.localeCompare(b.end_date))
  }, [contracts])
  const contractActiveValue = useMemo(() => contracts.reduce((s: number, c: any) => s + Number(c.contract_value ?? 0), 0), [contracts])

  const agingAR = useMemo(() => agingBuckets(arRows), [arRows])
  const agingAP = useMemo(() => agingBuckets(apRows), [apRows])
  const agingChartData = useMemo(() => Object.keys(agingAR).map(k => ({ bucket: k, ar: agingAR[k], ap: agingAP[k] ?? 0 })), [agingAR, agingAP])

  const cashProjection = useMemo(() => {
    const inAR = projectionInflow(arRows)
    const outAP = projectionInflow(apRows)
    let running = cashOpening
    const labels = ['0–30 hari', '31–60 hari', '61–90 hari']
    const rows = [{ periode: 'Saat ini', saldo: cashOpening }]
    labels.forEach((label, i) => { running = running + inAR[i] - outAP[i]; rows.push({ periode: label, saldo: running }) })
    return rows
  }, [arRows, apRows, cashOpening])

  const vendorOverdue = useMemo(() => {
    const today = new Date()
    const rows = apRows.filter(r => r.due_date && new Date(r.due_date) < today && (Number(r.total ?? 0) - Number(r.paid_amount ?? 0)) > 0)
    return { count: rows.length, amount: rows.reduce((s, r) => s + (Number(r.total ?? 0) - Number(r.paid_amount ?? 0)), 0) }
  }, [apRows])
  const lowMarginProjects = useMemo(() => projectMargin.filter((p: any) => Number(p.margin_percent ?? 0) < 10), [projectMargin])

  const revenue = Number(summary?.revenue ?? 0)
  const cogs = Number(summary?.cogs ?? 0)
  const grossMargin = Number(summary?.margin ?? (revenue - cogs))
  const marginPct = revenue ? (grossMargin / revenue) * 100 : 0

  const handleExport = () => {
    const rows = [
      { metrik: 'Revenue', nilai: revenue },
      { metrik: 'COGS', nilai: cogs },
      { metrik: 'Gross Margin', nilai: grossMargin },
      { metrik: 'Margin %', nilai: marginPct.toFixed(1) },
      { metrik: 'Kepatuhan SLA %', nilai: slaCompliance == null ? '' : slaCompliance.toFixed(1) },
      { metrik: 'MTTR (menit)', nilai: mttr == null ? '' : mttr.toFixed(0) },
      { metrik: 'Penyelesaian Work Order %', nilai: woCompletion == null ? '' : woCompletion.toFixed(1) },
      { metrik: 'Produktivitas Rata-rata %', nilai: avgAchievement == null ? '' : avgAchievement.toFixed(1) },
      { metrik: 'Nilai Kontrak Aktif', nilai: contractActiveValue },
      { metrik: 'Kontrak Akan Habis <60 Hari', nilai: contractsExpiring.length },
      { metrik: 'Penalti SLA Terakumulasi', nilai: slaPenaltyTotal },
      { metrik: 'AR Belum Tertagih', nilai: arRows.reduce((s, r) => s + (Number(r.total ?? 0) - Number(r.paid_amount ?? 0)), 0) },
      { metrik: 'AP Belum Dibayar', nilai: apRows.reduce((s, r) => s + (Number(r.total ?? 0) - Number(r.paid_amount ?? 0)), 0) },
      { metrik: 'Proyeksi Kas 90 Hari', nilai: cashProjection[cashProjection.length - 1]?.saldo ?? 0 },
    ]
    exportCSV(rows, `ringkasan-eksekutif-${todayISO()}`)
  }

  return (
    <div>
      <style>{`@media print { .no-print { display: none !important } body { background: white !important } }`}</style>
      <PageHeader
        title="Portal Eksekutif" subtitle={`${company?.name ?? 'Perusahaan'} — kondisi keuangan, operasional & kontrak untuk pengambilan keputusan`}
        actions={<div className="no-print flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={handleExport}>Ekspor CSV</Button>
          <Button variant="outline" size="sm" icon={<Printer size={14} />} onClick={() => window.print()}>Cetak</Button>
        </div>}
      />

      {loading ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-md" />)}</div> : (
        <>
          {can('FINANCE') && (
            <Section title="Ringkasan Keuangan">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <KpiCard label="Revenue" value={rupiah(revenue, true)} icon={<Wallet size={16} />} />
                <KpiCard label="COGS" value={rupiah(cogs, true)} icon={<Landmark size={16} />} />
                <KpiCard label="Gross Margin" value={rupiah(grossMargin, true)} icon={<TrendingUp size={16} />} />
                <KpiCard label="Margin %" value={revenue ? pct(marginPct) : '-'} icon={<Percent size={16} />} />
              </div>
              <Card className="print:break-inside-avoid">
                <CardHeader title="Tren Pendapatan vs Biaya — 12 Bulan" subtitle="Dari ar_invoices & job_costs" />
                <div className="p-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={finance} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-ink-100 dark:stroke-ink-800" />
                      <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => rupiah(v, true)} tick={{ fontSize: 11 }} width={64} />
                      <Tooltip formatter={(v: any) => rupiah(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="biaya" name="Biaya" fill={COLORS.biaya} radius={[3, 3, 0, 0]} />
                      <Line type="monotone" dataKey="pendapatan" name="Pendapatan" stroke={COLORS.pendapatan} strokeWidth={2.5} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Section>
          )}

          {can('OPERATIONS') && (
            <Section title="Kinerja Operasional">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard label="Kepatuhan SLA %" value={slaCompliance == null ? '-' : pct(slaCompliance)} icon={<ShieldCheck size={16} />} />
                <KpiCard label="MTTR" value={mttr == null ? '-' : durasi(mttr)} icon={<Clock size={16} />} />
                <KpiCard label="Penyelesaian Work Order %" value={woCompletion == null ? '-' : pct(woCompletion)} icon={<ClipboardCheck size={16} />} />
                <KpiCard label="Produktivitas Rata-rata" value={avgAchievement == null ? '-' : pct(avgAchievement)} icon={<Gauge size={16} />} />
              </div>
            </Section>
          )}

          {can('COMMERCE') && (
            <Section title="Kesehatan Kontrak">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <KpiCard label="Nilai Kontrak Aktif" value={rupiah(contractActiveValue, true)} icon={<FileText size={16} />} />
                <KpiCard label="Kontrak Akan Habis <60 Hari" value={num(contractsExpiring.length)} sub={contractsExpiring[0] ? `Terdekat: ${contractsExpiring[0].contract_name}, ${tgl(contractsExpiring[0].end_date)}` : undefined} icon={<AlertTriangle size={16} />} />
                <KpiCard label="Penalti SLA Terakumulasi" value={rupiah(slaPenaltyTotal, true)} icon={<FileWarning size={16} />} />
              </div>
            </Section>
          )}

          {can('FINANCE') && (
            <Section title="Modal Kerja">
              <div className="grid lg:grid-cols-2 gap-4">
                <Card className="print:break-inside-avoid">
                  <CardHeader title="Aging Piutang (AR) vs Hutang (AP)" subtitle="Dari ar_invoices & vendor_invoices yang belum lunas" />
                  <div className="p-4 h-72">
                    {agingChartData.every(d => d.ar === 0 && d.ap === 0) ? <EmptyState title="Tidak ada piutang/hutang tertunda" /> : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={agingChartData} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-ink-100 dark:stroke-ink-800" />
                          <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                          <YAxis tickFormatter={(v) => rupiah(v, true)} tick={{ fontSize: 11 }} width={64} />
                          <Tooltip formatter={(v: any) => rupiah(Number(v))} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="ar" name="AR (Piutang)" fill={COLORS.ar} radius={[3, 3, 0, 0]} />
                          <Bar dataKey="ap" name="AP (Hutang)" fill={COLORS.ap} radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>
                <Card className="print:break-inside-avoid">
                  <CardHeader title="Proyeksi Kas 90 Hari" subtitle="Saldo kas historis + prakiraan tagih/bayar jatuh tempo" />
                  <div className="p-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cashProjection} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-ink-100 dark:stroke-ink-800" />
                        <XAxis dataKey="periode" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => rupiah(v, true)} tick={{ fontSize: 11 }} width={64} />
                        <Tooltip formatter={(v: any) => rupiah(Number(v))} />
                        <Line type="monotone" dataKey="saldo" name="Proyeksi Saldo Kas" stroke={COLORS.saldo} strokeWidth={2.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </Section>
          )}

          <Section title="">
            <Card className="border-amber-300 dark:border-amber-800 print:break-inside-avoid">
              <CardHeader title="Rekomendasi Sistem" subtitle={<Badge tone="amber">Usulan sistem — bukan keputusan manajemen</Badge>} />
              <div className="p-5">
                <ul className="space-y-3">
                  {lowMarginProjects.length > 0 && lowMarginProjects.map((p: any) => (
                    <RecoItem key={`margin-${p.project_id}`} text={`Proyek "${p.project_name}" bermargin ${pct(Number(p.margin_percent))} — di bawah ambang 10%. Sumber: v_project_margin.`} />
                  ))}
                  {vendorOverdue.count > 0 && (
                    <RecoItem text={`${num(vendorOverdue.count)} invoice mitra senilai ${rupiah(vendorOverdue.amount)} telah melewati SLA jatuh tempo bayar. Sumber: tabel vendor_invoices.`} />
                  )}
                  {contractsExpiring.length > 0 && (
                    <RecoItem text={`${num(contractsExpiring.length)} kontrak akan berakhir dalam 60 hari ke depan, terdekat "${contractsExpiring[0].contract_name}" pada ${tgl(contractsExpiring[0].end_date)}. Sumber: tabel contracts.`} />
                  )}
                  {certExpired.length > 0 && (
                    <RecoItem text={`${num(certExpired.length)} sertifikasi teknisi telah kedaluwarsa, di antaranya ${certExpired[0]?.employees?.full_name ?? 'karyawan'} (${certExpired[0]?.cert_name}). Sumber: tabel employee_certifications.`} />
                  )}
                  {stockLow.length > 0 && (
                    <RecoItem text={`${num(stockLow.length)} item persediaan berada di bawah stok minimum, contoh "${stockLow[0].name}" (${num(stockLow[0].qty)} dari minimum ${num(stockLow[0].min)}). Sumber: stock_balances & item_catalog.`} />
                  )}
                  {ticketBreachByMonth.cur > ticketBreachByMonth.prevN && (
                    <RecoItem text={`Tiket pelanggaran SLA naik menjadi ${num(ticketBreachByMonth.cur)} bulan ini dari ${num(ticketBreachByMonth.prevN)} bulan lalu. Sumber: tabel tickets.`} />
                  )}
                  {lowMarginProjects.length === 0 && vendorOverdue.count === 0 && contractsExpiring.length === 0 && certExpired.length === 0 && stockLow.length === 0 && ticketBreachByMonth.cur <= ticketBreachByMonth.prevN && (
                    <EmptyState title="Tidak ada indikasi risiko" message="Seluruh ambang batas pemantauan sistem berada dalam kondisi normal berdasarkan data saat ini." />
                  )}
                </ul>
              </div>
            </Card>
          </Section>
        </>
      )}

      <p className="text-caption text-ink-400 mt-2">
        Sumber data: v_executive_summary, v_project_margin, ar_invoices, vendor_invoices, job_costs, contracts, sla_penalties, tickets, work_orders, cash_flows, employee_certifications, stock_balances. Ditarik saat halaman dibuka{drawn ? `, ${drawn}` : ''}.
      </p>
    </div>
  )
}

function RecoItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5 text-body text-ink-700 dark:text-ink-200">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
      <span>{text}</span>
    </li>
  )
}
