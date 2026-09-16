import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list } from '@/lib/db'
import { PageHeader, Card, CardHeader, KpiCard, DataTable, TableSkeleton, Badge } from '@/components/ui'
import { rupiah, num, pct, tgl, todayISO } from '@/lib/format'
import { PROJECT_STATUS_ACTIVE, CHART_COLORS, deviationTone } from '../lib/shared'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts'

const STATUS_LABEL: Record<string, string> = {
  perencanaan: 'Perencanaan', survey: 'Survey', design: 'Design', approval: 'Approval',
  pelaksanaan: 'Pelaksanaan', testing: 'Testing', bast: 'BAST', selesai: 'Selesai', hold: 'Hold', batal: 'Batal',
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [statusView, setStatusView] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [rfsCount, setRfsCount] = useState(0)

  useEffect(() => {
    (async () => {
      if (!profile?.company_id) return
      setLoading(true)
      try {
        const monthStart = todayISO().slice(0, 7) + '-01'
        const d = new Date(monthStart); d.setMonth(d.getMonth() + 1)
        const monthEnd = d.toISOString().slice(0, 10)
        const [p, e, sv, pr, rfs] = await Promise.all([
          list('projects', { select: 'id,project_code,project_name,status,progress_percent,contract_value,budget_cost,target_date,actual_finish_date,pm_id', order: { col: 'created_at', asc: false }, limit: 500 }),
          list('employees', { select: 'id,full_name' }),
          list('v_dashboard_deployment', { select: '*' }),
          list('progress_reports', { select: 'project_id,report_date,plan_percent,actual_percent,deviation', order: { col: 'report_date', asc: true }, limit: 3000 }),
          list('rfs_records', { select: 'id,rfs_date', gte: { rfs_date: monthStart }, lte: { rfs_date: monthEnd } }),
        ])
        setProjects(p); setEmployees(e); setStatusView(sv); setReports(pr); setRfsCount((rfs ?? []).length)
      } finally { setLoading(false) }
    })()
  }, [profile?.company_id])

  const empName = (id?: string) => employees.find(e => e.id === id)?.full_name ?? '-'

  const latestDeviation = useMemo(() => {
    const map: Record<string, any> = {}
    for (const r of reports) {
      const cur = map[r.project_id]
      if (!cur || r.report_date > cur.report_date) map[r.project_id] = r
    }
    return map
  }, [reports])

  const kpi = useMemo(() => {
    const aktif = projects.filter(p => PROJECT_STATUS_ACTIVE.includes(p.status))
    const terlambat = projects.filter(p => {
      const d = latestDeviation[p.id]
      return d && Number(d.deviation) < 0 && !['selesai', 'batal'].includes(p.status)
    })
    const nilaiBerjalan = aktif.reduce((s, p) => s + Number(p.contract_value ?? 0), 0)
    return { aktif: aktif.length, terlambat: terlambat.length, nilaiBerjalan }
  }, [projects, latestDeviation])

  const donutData = useMemo(() => statusView.map((s: any) => ({
    name: STATUS_LABEL[s.bucket] ?? s.bucket, value: Number(s.cnt), amount: Number(s.amount ?? 0),
  })), [statusView])

  const devBarData = useMemo(() => projects
    .filter(p => latestDeviation[p.id] && !['selesai', 'batal'].includes(p.status))
    .map(p => ({ kode: p.project_code, deviasi: Number(latestDeviation[p.id].deviation ?? 0) }))
    .sort((a, b) => a.deviasi - b.deviasi)
    .slice(0, 15), [projects, latestDeviation])

  const scurveData = useMemo(() => {
    const map: Record<string, { plan: number[]; actual: number[] }> = {}
    for (const r of reports) {
      const k = r.report_date
      if (!map[k]) map[k] = { plan: [], actual: [] }
      map[k].plan.push(Number(r.plan_percent ?? 0))
      map[k].actual.push(Number(r.actual_percent ?? 0))
    }
    return Object.keys(map).sort().map(k => ({
      tanggal: tgl(k),
      plan: map[k].plan.reduce((a, b) => a + b, 0) / map[k].plan.length,
      actual: map[k].actual.reduce((a, b) => a + b, 0) / map[k].actual.length,
    }))
  }, [reports])

  const berisiko = useMemo(() => projects
    .filter(p => {
      const d = latestDeviation[p.id]
      return (d && Number(d.deviation) < 0 && !['selesai', 'batal'].includes(p.status)) || p.status === 'hold'
    })
    .map(p => ({ ...p, _deviasi: latestDeviation[p.id]?.deviation ?? null }))
    .sort((a, b) => (a._deviasi ?? 0) - (b._deviasi ?? 0)), [projects, latestDeviation])

  if (loading) return <div><PageHeader title="Dashboard Deployment" /><TableSkeleton rows={8} /></div>

  return (
    <div>
      <PageHeader title="Dashboard Deployment" subtitle="Ringkasan portofolio proyek Design & Deployment" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-1">
        <KpiCard label="Proyek Aktif" value={num(kpi.aktif)} tone="teal" />
        <KpiCard label="Proyek Terlambat" value={num(kpi.terlambat)} tone={kpi.terlambat > 0 ? 'red' : 'emerald'} />
        <KpiCard label="Nilai Kontrak Berjalan" value={rupiah(kpi.nilaiBerjalan, true)} tone="amber" />
        <KpiCard label="RFS Bulan Ini" value={num(rfsCount)} tone="teal" />
      </div>
      <p className="text-caption text-ink-400 mb-5">Sumber data: tabel projects, progress_reports, rfs_records · ditarik {tgl(todayISO())}. "Terlambat" = laporan progres terakhir bernilai realisasi &lt; rencana.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader title="Proyek per Status" />
          <div className="p-4 h-[300px]">
            {donutData.length === 0 ? <p className="text-caption text-ink-400 text-center pt-24">Belum ada data proyek.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                    {donutData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any, p: any) => [`${v} proyek · ${rupiah(p?.payload?.amount, true)}`, n]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>)}
          </div>
        </Card>
        <Card>
          <CardHeader title="Deviasi Progres per Proyek" subtitle="Realisasi − Rencana (laporan terakhir)" />
          <div className="p-4 h-[300px]">
            {devBarData.length === 0 ? <p className="text-caption text-ink-400 text-center pt-24">Belum ada laporan progres.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={devBarData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="kode" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v: any) => `${num(v, 1)}%`} />
                  <Bar dataKey="deviasi" radius={[3, 3, 0, 0]}>
                    {devBarData.map((d, i) => <Cell key={i} fill={d.deviasi < 0 ? '#E11D48' : '#16A34A'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>)}
          </div>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader title="Kurva S Gabungan Portofolio" subtitle="Rata-rata rencana vs realisasi seluruh proyek per tanggal laporan" />
        <div className="p-4 h-[300px]">
          {scurveData.length === 0 ? <p className="text-caption text-ink-400 text-center pt-24">Belum ada laporan progres.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scurveData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: any) => `${num(v, 1)}%`} />
                <Legend />
                <Line type="monotone" dataKey="plan" name="Rencana" stroke="#64748B" strokeDasharray="4 3" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="actual" name="Realisasi" stroke="#1B8A92" dot={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>)}
        </div>
      </Card>

      <Card>
        <CardHeader title="Proyek Berisiko" subtitle="Deviasi negatif atau berstatus hold" />
        <DataTable
          searchable={false}
          columns={[
            { key: 'project_code', header: 'Kode' },
            { key: 'project_name', header: 'Proyek' },
            { key: 'pm_id', header: 'PM', render: (r: any) => empName(r.pm_id) },
            { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
            { key: '_deviasi', header: 'Deviasi', align: 'right', render: (r: any) => r._deviasi == null ? '-' : <span className={deviationTone(r._deviasi)}>{pct(r._deviasi)}</span> },
            { key: 'target_date', header: 'Target Selesai', render: (r: any) => tgl(r.target_date) },
          ]}
          rows={berisiko}
          emptyTitle="Tidak ada proyek berisiko"
          emptyMessage="Semua proyek berjalan sesuai atau lebih cepat dari rencana."
        />
      </Card>
    </div>
  )
}
