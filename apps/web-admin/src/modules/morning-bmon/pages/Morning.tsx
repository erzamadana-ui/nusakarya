import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useAuth } from '@/lib/auth'
import { list } from '@/lib/db'
import { chartColors } from '@/lib/theme'
import {
  Card, CardHeader, PageHeader, KpiCard, DataTable, FilterBar, Field, Input, Select, Button,
  Badge, Drawer, useToast, TableSkeleton, cx,
} from '@/components/ui'
import { num, pct, durasi, tglJam, todayISO } from '@/lib/format'
import { woTypeLabel, isWoDone, isWoFail } from '../lib/constants'
import { dateBounds, withinBounds, last30Days, umurMenit, formatUmur, waktuTarik } from '../lib/helpers'

const TOTAL_KEY = '__total__'

export default function Morning() {
  const { profile } = useAuth()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [networkElements, setNetworkElements] = useState<any[]>([])
  const [pulledAt, setPulledAt] = useState<Date | null>(null)

  const today = todayISO()
  const [f, setF] = useState({ from: today, to: today, branch_id: '', sto: '', wo_type: '', assigned_to: '' })
  const [detailBranch, setDetailBranch] = useState<any>(null)

  useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

  async function load() {
    setLoading(true)
    try {
      const [wo, br, emp, ne] = await Promise.all([
        list('work_orders', {
          select: 'id,wo_no,wo_type,status,customer_name,address,branch_id,assigned_to,scheduled_at,started_at,finished_at,duration_minutes,points,qc_status,fail_reason',
          eq: { company_id: profile!.company_id }, order: { col: 'scheduled_at', asc: false }, limit: 5000,
        }),
        list('branches', { select: 'id,name,code', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
        list('employees', { select: 'id,full_name,branch_id,position', eq: { company_id: profile!.company_id }, order: { col: 'full_name', asc: true } }),
        list('network_elements', { select: 'id,sto,branch_id', eq: { company_id: profile!.company_id } }),
      ])
      setWorkOrders(wo); setBranches(br); setEmployees(emp); setNetworkElements(ne); setPulledAt(new Date())
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data MORNING', 'error') }
    finally { setLoading(false) }
  }

  const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'
  const empName = (id?: string) => employees.find(e => e.id === id)?.full_name ?? (id ? 'Tidak diketahui' : '-')

  /* ---------------- Referensi filter ---------------- */
  const stoList = useMemo(() => Array.from(new Set(networkElements.map((n: any) => n.sto).filter(Boolean))).sort(), [networkElements])
  const stoBranchMap = useMemo(() => {
    const m: Record<string, string> = {}
    networkElements.forEach((n: any) => { if (n.sto && n.branch_id && !m[n.sto]) m[n.sto] = n.branch_id })
    return m
  }, [networkElements])
  const woTypeOptions = useMemo(() => Array.from(new Set(workOrders.map(w => w.wo_type))).sort()
    .map(v => ({ value: v, label: woTypeLabel(v) })), [workOrders])
  const teknisiOptions = useMemo(() => {
    const ids = Array.from(new Set(workOrders.map(w => w.assigned_to).filter(Boolean)))
    return ids.map(id => ({ value: id, label: empName(id) })).sort((a, b) => a.label.localeCompare(b.label, 'id'))
  }, [workOrders, employees])

  /* ---------------- Lingkup data terfilter ---------------- */
  function matchNonDate(w: any) {
    const stoBranch = f.sto ? stoBranchMap[f.sto] : null
    if (f.branch_id && w.branch_id !== f.branch_id) return false
    if (stoBranch && w.branch_id !== stoBranch) return false
    if (f.wo_type && w.wo_type !== f.wo_type) return false
    if (f.assigned_to && w.assigned_to !== f.assigned_to) return false
    return true
  }
  const scope = useMemo(() => {
    const { from, to } = dateBounds(f.from, f.to)
    return workOrders.filter(w => withinBounds(w.scheduled_at, from, to) && matchNonDate(w))
  }, [workOrders, f, stoBranchMap])
  const scopeNoDate = useMemo(() => workOrders.filter(matchNonDate), [workOrders, f, stoBranchMap])

  /* ---------------- KPI hari ini / periode terpilih ---------------- */
  const kpi = useMemo(() => {
    const masuk = scope.length
    const selesai = scope.filter(w => isWoDone(w.status)).length
    const gagal = scope.filter(w => isWoFail(w.status)).length
    const berjalan = masuk - selesai - gagal
    const keberhasilan = masuk ? (selesai / masuk) * 100 : null
    return { masuk, selesai, gagal, berjalan, keberhasilan }
  }, [scope])

  /* ---------------- Tabel per cabang ---------------- */
  const perCabang = useMemo(() => {
    const g: Record<string, { masuk: number; selesai: number; gagal: number; durSum: number; durCnt: number }> = {}
    scope.forEach(w => {
      const b = w.branch_id || 'tanpa_cabang'
      g[b] = g[b] || { masuk: 0, selesai: 0, gagal: 0, durSum: 0, durCnt: 0 }
      g[b].masuk += 1
      if (isWoDone(w.status)) {
        g[b].selesai += 1
        if (w.duration_minutes != null) { g[b].durSum += w.duration_minutes; g[b].durCnt += 1 }
      } else if (isWoFail(w.status)) g[b].gagal += 1
    })
    const rows = Object.entries(g).map(([bid, v]) => ({
      branch_id: bid, branch: bid === 'tanpa_cabang' ? 'Tanpa Cabang' : branchName(bid),
      masuk: v.masuk, selesai: v.selesai, gagal: v.gagal, berjalan: v.masuk - v.selesai - v.gagal,
      keberhasilan: v.masuk ? (v.selesai / v.masuk) * 100 : 0,
      rataDurasi: v.durCnt ? v.durSum / v.durCnt : null,
    })).sort((a, b) => b.masuk - a.masuk)
    const t = { masuk: 0, selesai: 0, gagal: 0, berjalan: 0, durSum: 0, durCnt: 0 }
    Object.values(g).forEach(v => { t.masuk += v.masuk; t.selesai += v.selesai; t.gagal += v.gagal; t.berjalan += v.masuk - v.selesai - v.gagal; t.durSum += v.durSum; t.durCnt += v.durCnt })
    const totalRow = {
      branch_id: TOTAL_KEY, branch: 'TOTAL', masuk: t.masuk, selesai: t.selesai, gagal: t.gagal, berjalan: t.berjalan,
      keberhasilan: t.masuk ? (t.selesai / t.masuk) * 100 : 0, rataDurasi: t.durCnt ? t.durSum / t.durCnt : null,
    }
    return [...rows, totalRow]
  }, [scope, branches])

  /* ---------------- Peringkat teknisi ---------------- */
  const perTeknisi = useMemo(() => {
    const g: Record<string, { selesai: number; gagal: number; poin: number; durSum: number; durCnt: number; total: number }> = {}
    scope.forEach(w => {
      if (!w.assigned_to) return
      const k = w.assigned_to
      g[k] = g[k] || { selesai: 0, gagal: 0, poin: 0, durSum: 0, durCnt: 0, total: 0 }
      g[k].total += 1
      g[k].poin += Number(w.points ?? 0)
      if (isWoDone(w.status)) {
        g[k].selesai += 1
        if (w.duration_minutes != null) { g[k].durSum += w.duration_minutes; g[k].durCnt += 1 }
      } else if (isWoFail(w.status)) g[k].gagal += 1
    })
    return Object.entries(g).map(([id, v]) => {
      const emp = employees.find(e => e.id === id)
      return {
        id, nama: emp?.full_name ?? 'Tidak diketahui', cabang: emp?.branch_id ? branchName(emp.branch_id) : '-',
        selesai: v.selesai, gagal: v.gagal, poin: v.poin,
        rataDurasi: v.durCnt ? v.durSum / v.durCnt : null,
        keberhasilan: v.total ? (v.selesai / v.total) * 100 : 0,
      }
    }).sort((a, b) => b.poin - a.poin)
  }, [scope, employees, branches])

  /* ---------------- Pareto penyebab gagal ---------------- */
  const pareto = useMemo(() => {
    const g: Record<string, number> = {}
    scope.filter(w => w.status === 'failed' && w.fail_reason).forEach(w => { g[w.fail_reason] = (g[w.fail_reason] ?? 0) + 1 })
    const rows = Object.entries(g).map(([reason, jumlah]) => ({ reason, jumlah })).sort((a, b) => b.jumlah - a.jumlah)
    const total = rows.reduce((a, r) => a + r.jumlah, 0)
    let kum = 0
    return rows.map(r => { kum += r.jumlah; return { ...r, kumulatif: total ? +((kum / total) * 100).toFixed(1) : 0 } })
  }, [scope])

  /* ---------------- Tren 30 hari (mengikuti filter selain tanggal) ---------------- */
  const tren30 = useMemo(() => {
    const days = last30Days()
    const idx: Record<string, number> = {}
    const data = days.map((d, i) => { idx[d.key] = i; return { ...d, selesai: 0, gagal: 0 } })
    scopeNoDate.forEach(w => {
      if (!w.scheduled_at) return
      const key = String(w.scheduled_at).slice(0, 10)
      const i = idx[key]
      if (i == null) return
      if (isWoDone(w.status)) data[i].selesai += 1
      else if (isWoFail(w.status)) data[i].gagal += 1
    })
    return data
  }, [scopeNoDate])

  /* ---------------- Order berisiko ---------------- */
  const berisiko = useMemo(() => {
    const now = new Date()
    const satuHari = 24 * 60 * 60 * 1000
    return scopeNoDate.filter(w => {
      if (isWoDone(w.status) || isWoFail(w.status)) return false
      const terjadwalHariIni = w.scheduled_at && String(w.scheduled_at).slice(0, 10) === today
      const belumMulai = !w.started_at
      if (terjadwalHariIni && belumMulai) return true
      if (w.started_at && !w.finished_at && (now.getTime() - new Date(w.started_at).getTime()) > satuHari) return true
      return false
    }).map(w => ({
      ...w,
      keterangan: (w.scheduled_at && String(w.scheduled_at).slice(0, 10) === today && !w.started_at)
        ? 'Terjadwal hari ini, belum dimulai' : `Berjalan ${formatUmur(umurMenit(w.started_at))}`,
    })).sort((a, b) => new Date(a.started_at ?? a.scheduled_at ?? 0).getTime() - new Date(b.started_at ?? b.scheduled_at ?? 0).getTime())
  }, [scopeNoDate, today])

  const cc = chartColors()
  const Sumber = ({ text }: { text: string }) => (
    <p className="px-4 py-2 text-caption text-ink-400 border-t border-ink-100">Sumber: {text}. Ditarik {waktuTarik(pulledAt)}.</p>
  )

  return (
    <div>
      <PageHeader title="MORNING — Provisioning" subtitle="Pemantauan harian pemasangan baru (PSB), migrasi & order lapangan" />

      <FilterBar>
        <Field label="Dari Tanggal"><Input type="date" value={f.from} onChange={(e: any) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="Sampai Tanggal"><Input type="date" value={f.to} onChange={(e: any) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label="Cabang"><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={f.branch_id} onChange={(e: any) => setF({ ...f, branch_id: e.target.value })} /></Field>
        <Field label="STO"><Select options={stoList.map(s => ({ value: s, label: s }))} value={f.sto} onChange={(e: any) => setF({ ...f, sto: e.target.value })} /></Field>
        <Field label="Jenis Order"><Select options={woTypeOptions} value={f.wo_type} onChange={(e: any) => setF({ ...f, wo_type: e.target.value })} /></Field>
        <Field label="Teknisi"><Select options={teknisiOptions} value={f.assigned_to} onChange={(e: any) => setF({ ...f, assigned_to: e.target.value })} /></Field>
        <Button variant="outline" size="sm" onClick={() => setF({ from: today, to: today, branch_id: '', sto: '', wo_type: '', assigned_to: '' })}>Reset Filter</Button>
      </FilterBar>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-1">
        <KpiCard label="Order Masuk" value={loading ? '…' : num(kpi.masuk)} />
        <KpiCard label="Selesai (PS)" value={loading ? '…' : num(kpi.selesai)} tone="emerald" />
        <KpiCard label="Gagal (Workfail/Canceled)" value={loading ? '…' : num(kpi.gagal)} tone="red" />
        <KpiCard label="Sisa Berjalan" value={loading ? '…' : num(kpi.berjalan)} tone="amber" />
        <KpiCard label="Keberhasilan %" value={loading ? '…' : pct(kpi.keberhasilan)} tone={kpi.keberhasilan != null && kpi.keberhasilan < 80 ? 'red' : 'emerald'} />
      </div>
      <p className="text-caption text-ink-400 mb-5 px-1">
        * Keberhasilan dihitung sebagai order selesai ÷ seluruh order masuk pada periode terpilih, <strong>tanpa mengecualikan order yang dibatalkan (Canceled)</strong> dari penyebut.
        Definisi ini berbeda-beda antar perusahaan — sebagian hanya membandingkan terhadap order yang telah dieksekusi (selesai + gagal kerja), sebagian lain mengecualikan pembatalan pelanggan dari perhitungan. Sesuaikan dengan kebijakan pelaporan internal.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="overflow-hidden">
          <CardHeader title="Order per Cabang" subtitle="Klik baris untuk melihat rincian order" />
          <DataTable
            loading={loading} rows={perCabang} rowKey="branch_id" searchable={false} exportName="order-per-cabang-morning"
            emptyTitle="Belum ada order" onRowClick={(r: any) => r.branch_id !== TOTAL_KEY && setDetailBranch(r)}
            columns={[
              { key: 'branch', header: 'Cabang', sortable: false, render: r => <span className={cx(r.branch_id === TOTAL_KEY && 'font-semibold')}>{r.branch}</span> },
              { key: 'masuk', header: 'Masuk', align: 'right', sortable: false, render: r => <span className={cx(r.branch_id === TOTAL_KEY && 'font-semibold')}>{num(r.masuk)}</span> },
              { key: 'selesai', header: 'Selesai', align: 'right', sortable: false, render: r => <span className={cx(r.branch_id === TOTAL_KEY && 'font-semibold')}>{num(r.selesai)}</span> },
              { key: 'gagal', header: 'Gagal', align: 'right', sortable: false, render: r => <span className={cx(r.branch_id === TOTAL_KEY && 'font-semibold')}>{num(r.gagal)}</span> },
              { key: 'berjalan', header: 'Berjalan', align: 'right', sortable: false, render: r => <span className={cx(r.branch_id === TOTAL_KEY && 'font-semibold')}>{num(r.berjalan)}</span> },
              { key: 'keberhasilan', header: 'Keberhasilan %', align: 'right', sortable: false, render: r => <span className={cx(r.branch_id === TOTAL_KEY && 'font-semibold')}>{pct(r.keberhasilan)}</span> },
              { key: 'rataDurasi', header: 'Rata² Durasi', align: 'right', sortable: false, render: r => <span className={cx(r.branch_id === TOTAL_KEY && 'font-semibold')}>{durasi(r.rataDurasi)}</span> },
            ]}
          />
          <Sumber text="tabel work_orders (order selesai berstatus done; rata-rata durasi dari order selesai yang memiliki catatan durasi)" />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Peringkat Teknisi" />
          <DataTable
            loading={loading} rows={perTeknisi} rowKey="id" searchKeys={['nama', 'cabang']} exportName="peringkat-teknisi-morning"
            emptyTitle="Belum ada order dengan teknisi pada periode ini"
            columns={[
              { key: 'nama', header: 'Nama' },
              { key: 'cabang', header: 'Cabang' },
              { key: 'selesai', header: 'Selesai', align: 'right' },
              { key: 'gagal', header: 'Gagal', align: 'right' },
              { key: 'poin', header: 'Poin', align: 'right', render: r => num(r.poin, 1) },
              { key: 'rataDurasi', header: 'Rata² Durasi', align: 'right', render: r => durasi(r.rataDurasi) },
              { key: 'keberhasilan', header: 'Keberhasilan %', align: 'right', render: r => pct(r.keberhasilan) },
            ]}
          />
          <Sumber text="tabel work_orders & employees" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader title="Pareto Penyebab Gagal" subtitle="Order berstatus Workfail (failed) dengan alasan tercatat" />
          <div className="p-4 h-72">
            {loading ? <TableSkeleton rows={4} /> : pareto.length === 0 ? <div className="grid place-items-center h-full text-ink-400 text-body">Tidak ada order gagal dengan alasan tercatat pada periode ini.</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pareto} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="reason" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="jumlah" name="Jumlah" fill={cc.primary} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="kumulatif" name="Kumulatif %" stroke={cc.accent} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>)}
          </div>
          <Sumber text="tabel work_orders (kolom fail_reason)" />
        </Card>
        <Card>
          <CardHeader title="Tren 30 Hari — Selesai vs Gagal" />
          <div className="p-4 h-72">
            {loading ? <TableSkeleton rows={4} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={tren30} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="selesai" name="Selesai" fill={cc.success} radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="gagal" name="Gagal" stroke={cc.danger} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>)}
          </div>
          <Sumber text="tabel work_orders, 30 hari terakhir berdasarkan scheduled_at (mengikuti filter cabang/STO/jenis/teknisi, di luar filter tanggal)" />
        </Card>
      </div>

      <Card className="overflow-hidden mb-2">
        <CardHeader title="Order Berisiko" subtitle="Terjadwal hari ini namun belum dimulai, atau sudah berjalan lebih dari 1 hari" />
        <DataTable
          loading={loading} rows={berisiko} searchable={false} emptyTitle="Tidak ada order berisiko"
          emptyMessage="Semua order pada lingkup filter berjalan sesuai jadwal."
          columns={[
            { key: 'wo_no', header: 'No WO' },
            { key: 'wo_type', header: 'Jenis', render: r => woTypeLabel(r.wo_type) },
            { key: 'customer_name', header: 'Pelanggan', render: r => r.customer_name || '-' },
            { key: 'branch_id', header: 'Cabang', render: r => branchName(r.branch_id) },
            { key: 'assigned_to', header: 'Teknisi', render: r => empName(r.assigned_to) },
            { key: 'scheduled_at', header: 'Dijadwalkan', render: r => tglJam(r.scheduled_at) },
            { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
            { key: 'keterangan', header: 'Keterangan Risiko', render: r => <span className="text-amber-600 dark:text-amber-400 font-medium">{r.keterangan}</span> },
          ]}
        />
        <Sumber text="tabel work_orders (started_at, finished_at, scheduled_at)" />
      </Card>

      <Drawer open={!!detailBranch} onClose={() => setDetailBranch(null)} title={`Rincian Order — ${detailBranch?.branch ?? ''}`} width="max-w-3xl">
        {detailBranch && (
          <DataTable
            rows={scope.filter(w => (w.branch_id || 'tanpa_cabang') === detailBranch.branch_id)}
            searchKeys={['wo_no', 'customer_name']}
            emptyTitle="Tidak ada order"
            columns={[
              { key: 'wo_no', header: 'No WO' },
              { key: 'wo_type', header: 'Jenis', render: r => woTypeLabel(r.wo_type) },
              { key: 'customer_name', header: 'Pelanggan', render: r => r.customer_name || '-' },
              { key: 'assigned_to', header: 'Teknisi', render: r => empName(r.assigned_to) },
              { key: 'scheduled_at', header: 'Dijadwalkan', render: r => tglJam(r.scheduled_at) },
              { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
              { key: 'duration_minutes', header: 'Durasi', align: 'right', render: r => durasi(r.duration_minutes) },
            ]}
          />
        )}
      </Drawer>
    </div>
  )
}
