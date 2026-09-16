import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Bar, Line, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useAuth } from '@/lib/auth'
import { list } from '@/lib/db'
import { chartColors, chartSeries } from '@/lib/theme'
import {
  Card, CardHeader, PageHeader, KpiCard, DataTable, FilterBar, Field, Input, Select, Button,
  Badge, useToast, TableSkeleton, cx,
} from '@/components/ui'
import { num, pct, durasi, tglJam } from '@/lib/format'
import {
  SEVERITY_OPTIONS, severityLabel, TICKET_STATUS_OPTIONS, ASPEK_RCA,
  AMBANG_KEPATUHAN_KUNING, AMBANG_KEPATUHAN_MERAH, ALARM_UNHANDLED_STATUS,
} from '../lib/constants'
import { dateBounds, withinBounds, avg, last30Days, warnaKepatuhan, KELAS_WARNA, umurMenit, formatUmur, waktuTarik } from '../lib/helpers'
import SlaCountdown from '../components/SlaCountdown'

const TOTAL_KEY = '__total__'
const todayStr = () => new Date().toISOString().slice(0, 10)

export default function Bmon() {
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [networkElements, setNetworkElements] = useState<any[]>([])
  const [rootCauses, setRootCauses] = useState<any[]>([])
  const [alarms, setAlarms] = useState<any[]>([])
  const [pulledAt, setPulledAt] = useState<Date | null>(null)

  const today = todayStr()
  const [f, setF] = useState({ from: today, to: today, branch_id: '', sto: '', severity: '', status: '' })

  useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

  async function load() {
    setLoading(true)
    try {
      const [tk, br, ne, rc, al] = await Promise.all([
        list('tickets', {
          select: 'id,ticket_no,status,severity,branch_id,network_element_id,reported_at,responded_at,resolved_at,closed_at,ttr_minutes,sla_status,sla_due_at,sla_minutes,root_cause_id,customer_name',
          eq: { company_id: profile!.company_id }, order: { col: 'reported_at', asc: false }, limit: 5000,
        }),
        list('branches', { select: 'id,name,code', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
        list('network_elements', { select: 'id,code,name,element_type,sto,branch_id', eq: { company_id: profile!.company_id } }),
        list('root_causes', { select: 'id,name,aspect', eq: { company_id: profile!.company_id } }),
        list('nms_alarms', { select: 'id,alarm_type,description,severity,status,received_at,network_element_id', eq: { company_id: profile!.company_id }, order: { col: 'received_at', asc: false }, limit: 2000 }),
      ])
      setTickets(tk); setBranches(br); setNetworkElements(ne); setRootCauses(rc); setAlarms(al); setPulledAt(new Date())
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data BMON', 'error') }
    finally { setLoading(false) }
  }

  const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'
  const neById = useMemo(() => Object.fromEntries(networkElements.map((n: any) => [n.id, n])), [networkElements])
  const rcById = useMemo(() => Object.fromEntries(rootCauses.map((r: any) => [r.id, r])), [rootCauses])
  const stoList = useMemo(() => Array.from(new Set(networkElements.map((n: any) => n.sto).filter(Boolean))).sort(), [networkElements])

  function matchScope(t: any, opts: { skipStatus?: boolean } = {}) {
    if (f.branch_id && t.branch_id !== f.branch_id) return false
    if (f.sto && neById[t.network_element_id]?.sto !== f.sto) return false
    if (f.severity && t.severity !== f.severity) return false
    if (!opts.skipStatus && f.status && t.status !== f.status) return false
    return true
  }

  const ticketsScope = useMemo(() => tickets.filter(t => matchScope(t)), [tickets, f, neById])
  const ticketsInRange = useMemo(() => {
    const { from, to } = dateBounds(f.from, f.to)
    return tickets.filter(t => withinBounds(t.reported_at, from, to) && matchScope(t))
  }, [tickets, f, neById])
  const resolvedInRange = useMemo(() => {
    const { from, to } = dateBounds(f.from, f.to)
    return tickets.filter(t => withinBounds(t.resolved_at, from, to) && matchScope(t))
  }, [tickets, f, neById])
  const openNow = useMemo(() => tickets.filter(t => matchScope(t, { skipStatus: true }) && t.status !== 'cancelled' && !t.resolved_at), [tickets, f, neById])
  const openAtEnd = useMemo(() => {
    const toBoundary = f.to ? new Date(`${f.to}T23:59:59.999`) : new Date()
    return tickets.filter(t => matchScope(t, { skipStatus: true }) && t.status !== 'cancelled' &&
      t.reported_at && new Date(t.reported_at) <= toBoundary && (!t.resolved_at || new Date(t.resolved_at) > toBoundary))
  }, [tickets, f, neById])

  const now = new Date()
  const kpi = useMemo(() => {
    const dinilai = ticketsInRange.filter(t => t.sla_status === 'met' || t.sla_status === 'breach')
    const melanggar = ticketsInRange.filter(t => t.sla_status === 'breach' || (!t.resolved_at && t.sla_due_at && new Date(t.sla_due_at) < now)).length
    const kepatuhan = dinilai.length ? (dinilai.filter(t => t.sla_status === 'met').length / dinilai.length) * 100 : null
    const mttr = avg(ticketsInRange.filter(t => t.ttr_minutes != null).map(t => t.ttr_minutes))
    const mtta = avg(ticketsInRange.filter(t => t.responded_at && t.reported_at).map(t => (new Date(t.responded_at).getTime() - new Date(t.reported_at).getTime()) / 60000))
    return { terbuka: openNow.length, saldo: openAtEnd.length, melanggar, kepatuhan, mttr, mtta }
  }, [ticketsInRange, openNow, openAtEnd])

  /* ---------------- Papan saldo per cabang ---------------- */
  const perCabang = useMemo(() => {
    const ids = new Set<string>()
    ;[...ticketsInRange, ...resolvedInRange, ...openAtEnd].forEach(t => ids.add(t.branch_id || 'tanpa_cabang'))
    const rows = Array.from(ids).map(bid => {
      const masuk = ticketsInRange.filter(t => (t.branch_id || 'tanpa_cabang') === bid).length
      const selesaiList = resolvedInRange.filter(t => (t.branch_id || 'tanpa_cabang') === bid)
      const saldoAkhir = openAtEnd.filter(t => (t.branch_id || 'tanpa_cabang') === bid).length
      const dinilai = selesaiList.filter(t => t.sla_status === 'met' || t.sla_status === 'breach')
      const kepatuhan = dinilai.length ? (dinilai.filter(t => t.sla_status === 'met').length / dinilai.length) * 100 : null
      const mttr = avg(selesaiList.filter(t => t.ttr_minutes != null).map(t => t.ttr_minutes))
      return { branch_id: bid, branch: bid === 'tanpa_cabang' ? 'Tanpa Cabang' : branchName(bid), masuk, selesai: selesaiList.length, saldoAkhir, kepatuhan, mttr }
    }).sort((a, b) => b.masuk - a.masuk)
    const t = { masuk: 0, selesai: 0, saldoAkhir: 0 }
    rows.forEach(r => { t.masuk += r.masuk; t.selesai += r.selesai; t.saldoAkhir += r.saldoAkhir })
    const dinilaiTotal = resolvedInRange.filter(t2 => t2.sla_status === 'met' || t2.sla_status === 'breach')
    const kepatuhanTotal = dinilaiTotal.length ? (dinilaiTotal.filter(t2 => t2.sla_status === 'met').length / dinilaiTotal.length) * 100 : null
    const mttrTotal = avg(resolvedInRange.filter(t2 => t2.ttr_minutes != null).map(t2 => t2.ttr_minutes))
    const totalRow = { branch_id: TOTAL_KEY, branch: 'TOTAL', masuk: t.masuk, selesai: t.selesai, saldoAkhir: t.saldoAkhir, kepatuhan: kepatuhanTotal, mttr: mttrTotal }
    return [...rows, totalRow]
  }, [ticketsInRange, resolvedInRange, openAtEnd, branches])

  /* ---------------- Donut severitas ---------------- */
  const donutSeverity = useMemo(() => {
    const g: Record<string, number> = {}
    ticketsInRange.forEach(t => { const s = t.severity || 'lainnya'; g[s] = (g[s] ?? 0) + 1 })
    return Object.entries(g).map(([k, v]) => ({ key: k, name: severityLabel(k), value: v }))
  }, [ticketsInRange])

  /* ---------------- Tren 30 hari ---------------- */
  const tren30 = useMemo(() => {
    const days = last30Days()
    const idx: Record<string, number> = {}
    const data = days.map((d, i) => { idx[d.key] = i; return { ...d, masuk: 0, selesai: 0 } })
    tickets.filter(t => matchScope(t, { skipStatus: true })).forEach(t => {
      if (t.reported_at) { const i = idx[String(t.reported_at).slice(0, 10)]; if (i != null) data[i].masuk += 1 }
      if (t.resolved_at) { const i = idx[String(t.resolved_at).slice(0, 10)]; if (i != null) data[i].selesai += 1 }
    })
    return data
  }, [tickets, f, neById])

  /* ---------------- RCA ringkas ---------------- */
  const rca = useMemo(() => {
    const g: Record<string, number> = { People: 0, Process: 0, Tools: 0, Partnership: 0 }
    let total = 0
    ticketsInRange.forEach(t => {
      const asp = t.root_cause_id ? rcById[t.root_cause_id]?.aspect : null
      if (asp && g[asp] != null) { g[asp] += 1; total += 1 }
    })
    return ASPEK_RCA.map(a => ({ aspek: a, jumlah: g[a], persen: total ? (g[a] / total) * 100 : 0 }))
  }, [ticketsInRange, rcById])

  /* ---------------- Elemen jaringan paling bermasalah ---------------- */
  const topElements = useMemo(() => {
    const g: Record<string, number> = {}
    ticketsInRange.forEach(t => { if (t.network_element_id) g[t.network_element_id] = (g[t.network_element_id] ?? 0) + 1 })
    return Object.entries(g).map(([id, jumlah]) => {
      const ne: any = neById[id]
      return { id, kode: ne?.code ?? '-', nama: ne?.name ?? '(tidak dikenal)', tipe: ne?.element_type ?? '-', sto: ne?.sto ?? '-', jumlah }
    }).sort((a, b) => b.jumlah - a.jumlah).slice(0, 10)
  }, [ticketsInRange, neById])

  /* ---------------- Gangguan berjalan ---------------- */
  const berjalan = useMemo(() => ticketsScope
    .filter(t => !t.resolved_at && t.status !== 'cancelled' && t.status !== 'closed')
    .sort((a, b) => (a.sla_due_at ? new Date(a.sla_due_at).getTime() : Infinity) - (b.sla_due_at ? new Date(b.sla_due_at).getTime() : Infinity)),
    [ticketsScope])

  /* ---------------- Alarm NMS belum ditangani ---------------- */
  const alarmsScope = useMemo(() => alarms.filter((a: any) => {
    const ne = neById[a.network_element_id]
    if (f.branch_id && ne?.branch_id !== f.branch_id) return false
    if (f.sto && ne?.sto !== f.sto) return false
    return true
  }), [alarms, f, neById])
  const alarmsUnhandled = useMemo(() => alarmsScope
    .filter((a: any) => a.status === ALARM_UNHANDLED_STATUS)
    .sort((a: any, b: any) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()), [alarmsScope])

  const cc = chartColors()
  const series = chartSeries()
  const Sumber = ({ text }: { text: string }) => (
    <p className="px-4 py-2 text-caption text-ink-400 border-t border-ink-100">Sumber: {text}. Ditarik {waktuTarik(pulledAt)}.</p>
  )
  const kepatuhanCell = (v: number | null) => {
    const w = warnaKepatuhan(v)
    return <span className={cx('font-medium', KELAS_WARNA[w])}>{pct(v)}</span>
  }

  return (
    <div>
      <PageHeader title="BMON — Assurance" subtitle="Pemantauan gangguan berjalan, kepatuhan SLA & saldo gangguan" />

      <FilterBar>
        <Field label="Dari Tanggal"><Input type="date" value={f.from} onChange={(e: any) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="Sampai Tanggal"><Input type="date" value={f.to} onChange={(e: any) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label="Cabang"><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={f.branch_id} onChange={(e: any) => setF({ ...f, branch_id: e.target.value })} /></Field>
        <Field label="STO"><Select options={stoList.map((s: string) => ({ value: s, label: s }))} value={f.sto} onChange={(e: any) => setF({ ...f, sto: e.target.value })} /></Field>
        <Field label="Keparahan"><Select options={SEVERITY_OPTIONS} value={f.severity} onChange={(e: any) => setF({ ...f, severity: e.target.value })} /></Field>
        <Field label="Status"><Select options={TICKET_STATUS_OPTIONS} value={f.status} onChange={(e: any) => setF({ ...f, status: e.target.value })} /></Field>
        <Button variant="outline" size="sm" onClick={() => setF({ from: today, to: today, branch_id: '', sto: '', severity: '', status: '' })}>Reset Filter</Button>
      </FilterBar>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-1">
        <KpiCard label="Gangguan Terbuka" value={loading ? '…' : num(kpi.terbuka)} />
        <KpiCard label="Saldo Gangguan" value={loading ? '…' : num(kpi.saldo)} tone="amber" />
        <KpiCard label="Melanggar SLA" value={loading ? '…' : num(kpi.melanggar)} tone="red" />
        <KpiCard label="Kepatuhan SLA" value={loading ? '…' : pct(kpi.kepatuhan)} tone={kpi.kepatuhan != null && kpi.kepatuhan < AMBANG_KEPATUHAN_MERAH ? 'red' : 'emerald'} />
        <KpiCard label="MTTR" value={loading ? '…' : durasi(kpi.mttr)} />
        <KpiCard label="MTTA" value={loading ? '…' : durasi(kpi.mtta)} />
      </div>
      <p className="text-caption text-ink-400 mb-5 px-1">
        * <strong>Gangguan Terbuka</strong> dihitung real-time (tiket belum resolved & bukan dibatalkan) sesuai filter cabang/STO/keparahan, tidak dibatasi rentang tanggal.
        {' '}<strong>Saldo Gangguan</strong> adalah jumlah tiket yang masih terbuka pada akhir periode (tanggal "Sampai") — saldo awal + masuk − selesai. KPI lain (melanggar SLA, kepatuhan, MTTR, MTTA) dihitung dari tiket yang dilaporkan pada rentang tanggal terpilih.
      </p>

      <Card className="overflow-hidden mb-4">
        <CardHeader title="Papan Saldo Gangguan per Cabang" />
        <DataTable
          loading={loading} rows={perCabang} rowKey="branch_id" searchable={false} exportName="saldo-gangguan-cabang-bmon"
          emptyTitle="Belum ada data"
          columns={[
            { key: 'branch', header: 'Cabang', sortable: false, render: r => <span className={cx(r.branch_id === TOTAL_KEY && 'font-semibold')}>{r.branch}</span> },
            { key: 'masuk', header: 'Masuk', align: 'right', sortable: false, render: r => <span className={cx(r.branch_id === TOTAL_KEY && 'font-semibold')}>{num(r.masuk)}</span> },
            { key: 'selesai', header: 'Selesai', align: 'right', sortable: false, render: r => <span className={cx(r.branch_id === TOTAL_KEY && 'font-semibold')}>{num(r.selesai)}</span> },
            { key: 'saldoAkhir', header: 'Saldo Akhir', align: 'right', sortable: false, render: r => <span className={cx(r.branch_id === TOTAL_KEY && 'font-semibold')}>{num(r.saldoAkhir)}</span> },
            { key: 'kepatuhan', header: 'Kepatuhan SLA %', align: 'right', sortable: false, render: r => kepatuhanCell(r.kepatuhan) },
            { key: 'mttr', header: 'MTTR', align: 'right', sortable: false, render: r => <span className={cx(r.branch_id === TOTAL_KEY && 'font-semibold')}>{durasi(r.mttr)}</span> },
          ]}
        />
        <p className="px-4 py-2 text-caption text-ink-400 border-t border-ink-100">
          Ambang warna kepatuhan SLA: <span className={KELAS_WARNA.kuning}>{'< '}{AMBANG_KEPATUHAN_KUNING}%</span> kuning, <span className={KELAS_WARNA.merah}>{'< '}{AMBANG_KEPATUHAN_MERAH}%</span> merah — ambang bawaan sistem, sesuaikan dengan ketentuan kontrak pelanggan.
        </p>
        <Sumber text="tabel tickets (resolved_at, sla_status, ttr_minutes)" />
      </Card>

      <Card className="overflow-hidden mb-4">
        <CardHeader title="Gangguan Sedang Berjalan" subtitle="Klik baris untuk membuka Tiket Gangguan" />
        <DataTable
          loading={loading} rows={berjalan} searchKeys={['ticket_no', 'customer_name']} exportName="gangguan-berjalan-bmon"
          emptyTitle="Tidak ada gangguan berjalan" onRowClick={() => navigate('/ops/tiket')}
          columns={[
            { key: 'ticket_no', header: 'No Tiket' },
            { key: 'customer_name', header: 'Pelanggan', render: r => r.customer_name || '-' },
            { key: 'branch_id', header: 'Cabang', render: r => branchName(r.branch_id) },
            { key: 'severity', header: 'Keparahan', render: r => <Badge tone={{ kritis: 'red', tinggi: 'orange', sedang: 'amber', rendah: 'slate' }[r.severity] ?? 'slate'}>{severityLabel(r.severity)}</Badge> },
            { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
            { key: 'reported_at', header: 'Umur Tiket', render: r => formatUmur(umurMenit(r.reported_at)) },
            { key: 'sla_due_at', header: 'Sisa SLA', render: r => <SlaCountdown dueAt={r.sla_due_at} slaMenit={r.sla_minutes} /> },
          ]}
        />
        <Sumber text="tabel tickets" />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader title="Sebaran Gangguan per Keparahan" />
          <div className="p-4 h-72">
            {loading ? <TableSkeleton rows={4} /> : donutSeverity.length === 0 ? <div className="grid place-items-center h-full text-ink-400 text-body">Belum ada data pada periode ini.</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutSeverity} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {donutSeverity.map((_, i) => <Cell key={i} fill={series[i % series.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>)}
          </div>
          <Sumber text="tabel tickets (reported_at pada rentang filter)" />
        </Card>
        <Card>
          <CardHeader title="Tren Harian 30 Hari — Masuk vs Selesai" />
          <div className="p-4 h-72">
            {loading ? <TableSkeleton rows={4} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={tren30} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="masuk" name="Masuk" fill={cc.primary} radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="selesai" name="Selesai" stroke={cc.success} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>)}
          </div>
          <Sumber text="tabel tickets, 30 hari terakhir (mengikuti filter cabang/STO/keparahan, di luar filter tanggal)" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="overflow-hidden">
          <CardHeader title="RCA Ringkas — 4 Aspek" />
          <div className="p-4 h-56">
            {loading ? <TableSkeleton rows={4} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rca}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="aspek" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="jumlah" radius={[4, 4, 0, 0]}>
                    {rca.map((_, i) => <Cell key={i} fill={series[i % series.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>)}
          </div>
          <div className="px-4 pb-3 grid grid-cols-4 gap-2 text-center">
            {rca.map(r => (
              <div key={r.aspek}>
                <div className="text-caption text-ink-500">{r.aspek}</div>
                <div className="text-body font-semibold text-ink-900">{num(r.jumlah)} <span className="text-caption font-normal text-ink-400">({pct(r.persen)})</span></div>
              </div>
            ))}
          </div>
          <Sumber text="tabel tickets & root_causes (tiket dengan root cause tercatat pada periode)" />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Alarm NMS Belum Ditangani" action={<Button size="sm" variant="outline" onClick={() => navigate('/ops/alarm')}>Lihat Semua</Button>} />
          <div className="px-4 pt-3"><KpiCard label="Alarm Belum Ditangani" value={loading ? '…' : num(alarmsUnhandled.length)} tone={alarmsUnhandled.length > 0 ? 'red' : 'emerald'} /></div>
          <div className="max-h-56 overflow-auto px-4 py-2">
            {loading ? <TableSkeleton rows={3} /> : alarmsUnhandled.length === 0 ? <p className="text-caption text-ink-400 py-3">Tidak ada alarm yang belum ditangani.</p> : (
              <ul className="divide-y divide-ink-100">
                {alarmsUnhandled.slice(0, 8).map((a: any) => (
                  <li key={a.id} className="py-2 text-body flex items-center justify-between gap-2">
                    <div>
                      <div className="text-ink-800">{a.alarm_type || a.description || 'Alarm'}</div>
                      <div className="text-caption text-ink-400">{neById[a.network_element_id]?.code ?? '-'} · {tglJam(a.received_at)}</div>
                    </div>
                    <Badge tone={{ kritis: 'red', tinggi: 'orange', sedang: 'amber', rendah: 'slate' }[a.severity] ?? 'slate'}>{severityLabel(a.severity)}</Badge>
                  </li>
                ))}
              </ul>)}
          </div>
          <Sumber text="tabel nms_alarms (status = baru)" />
        </Card>
      </div>

      <Card className="overflow-hidden mb-2">
        <CardHeader title="Elemen Jaringan Paling Bermasalah" subtitle="10 besar berdasarkan jumlah gangguan — acuan keputusan perbaikan permanen" />
        <DataTable
          loading={loading} rows={topElements} rowKey="id" searchable={false} exportName="elemen-jaringan-bermasalah-bmon"
          emptyTitle="Belum ada gangguan tertaut elemen jaringan pada periode ini"
          columns={[
            { key: 'kode', header: 'Kode' },
            { key: 'nama', header: 'Nama Elemen' },
            { key: 'tipe', header: 'Tipe' },
            { key: 'sto', header: 'STO' },
            { key: 'jumlah', header: 'Jumlah Gangguan', align: 'right' },
          ]}
        />
        <Sumber text="tabel tickets & network_elements" />
      </Card>
    </div>
  )
}
