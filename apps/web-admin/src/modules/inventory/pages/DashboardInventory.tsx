import React, { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import { list } from '@/lib/db'
import { PageHeader, Card, CardHeader, KpiCard, DataTable, Badge, TableSkeleton, EmptyState, useToast } from '@/components/ui'
import { rupiah, num, tgl, todayISO } from '@/lib/format'
import { Boxes, AlertTriangle, Router, ClipboardCheck } from 'lucide-react'
import { CHART_COLORS } from '../lib/shared'

export default function DashboardInventory() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [dash, setDash] = useState<any[]>([])
  const [opnameVar, setOpnameVar] = useState<any | null>(null)
  const [kritis, setKritis] = useState<any[]>([])
  const [moves, setMoves] = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const since = new Date(); since.setDate(since.getDate() - 30)
      const sinceISO = since.toISOString().slice(0, 10)
      const [dv, ov, sb, mv] = await Promise.all([
        list('v_dashboard_inventory', {}).catch(() => []),
        list('v_stock_opname_variance', { order: { col: 'opname_date', asc: false }, limit: 1 }).catch(() => []),
        list('stock_balances', {
          select: 'id,qty,qty_reserved,warehouse:warehouses!warehouse_id(name),item:item_catalog!item_id(code,name,min_stock,category,uom)',
        }),
        list('stock_movements', { select: 'move_date,move_type,qty', gte: { move_date: sinceISO }, order: { col: 'move_date', asc: true }, limit: 3000 }),
      ])
      setDash(dv as any[])
      setOpnameVar((ov as any[])?.[0] ?? null)
      setKritis((sb as any[]).filter(r => r.item && Number(r.qty || 0) < Number(r.item.min_stock || 0)))
      setMoves(mv as any[])
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat dashboard inventory', 'error') }
    finally { setLoading(false) }
  }

  const nilaiPerGudang = useMemo(() =>
    dash.filter(r => r.metric === 'stock_value_by_warehouse').map(r => ({ gudang: r.bucket, nilai: Number(r.amount || 0) })),
    [dash])
  const totalNilaiStok = useMemo(() => nilaiPerGudang.reduce((s, r) => s + r.nilai, 0), [nilaiPerGudang])

  const serialByStatus = useMemo(() =>
    dash.filter(r => r.metric === 'serial_nte_by_status').map(r => ({ status: r.bucket, jumlah: Number(r.cnt || 0) })),
    [dash])
  const nteTersedia = serialByStatus.find(s => s.status === 'in_stock')?.jumlah ?? 0
  const nteTerpasang = serialByStatus.find(s => s.status === 'installed')?.jumlah ?? 0

  const pergerakan = useMemo(() => {
    const m = new Map<string, { tanggal: string; masuk: number; keluar: number }>()
    moves.forEach((r: any) => {
      const key = r.move_date
      if (!m.has(key)) m.set(key, { tanggal: key, masuk: 0, keluar: 0 })
      const row = m.get(key)!
      if (r.move_type === 'GR' || r.move_type === 'RETURN') row.masuk += Number(r.qty || 0)
      else if (r.move_type === 'ISSUE' || r.move_type === 'SCRAP' || r.move_type === 'TRANSFER') row.keluar += Number(r.qty || 0)
    })
    return Array.from(m.values()).sort((a, b) => a.tanggal.localeCompare(b.tanggal))
      .map(r => ({ ...r, label: tgl(r.tanggal) }))
  }, [moves])

  return (
    <div>
      <PageHeader title="Dashboard Inventory" subtitle="Ringkasan persediaan NTE, material non-NTE, dan pergerakan stok." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Nilai Stok Total" value={rupiah(totalNilaiStok, true)} icon={<Boxes size={16} />} tone="teal" />
        <KpiCard label="Item Di Bawah Stok Minimum" value={num(kritis.length)} icon={<AlertTriangle size={16} />} tone="red" />
        <KpiCard label="Unit NTE Tersedia / Terpasang" value={`${num(nteTersedia)} / ${num(nteTerpasang)}`} icon={<Router size={16} />} tone="amber" />
        <KpiCard label="Selisih Opname Terakhir" value={opnameVar ? rupiah(opnameVar.total_variance_value, true) : '-'}
          sub={opnameVar ? `${opnameVar.opname_no} · ${tgl(opnameVar.opname_date)}` : 'Belum ada opname'} icon={<ClipboardCheck size={16} />} tone={opnameVar && Number(opnameVar.total_variance_value) !== 0 ? 'red' : 'emerald'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader title="Nilai Stok per Gudang" />
          <div className="p-4 h-64">
            {loading ? <TableSkeleton rows={4} /> : nilaiPerGudang.length === 0 ? <EmptyState title="Belum ada data stok" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={nilaiPerGudang}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EB" vertical={false} />
                  <XAxis dataKey="gudang" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => rupiah(v, true)} width={70} />
                  <Tooltip formatter={(v: any) => rupiah(Number(v))} />
                  <Bar dataKey="nilai" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>)}
          </div>
        </Card>
        <Card>
          <CardHeader title="Sebaran Status Serial NTE" />
          <div className="p-4 h-64">
            {loading ? <TableSkeleton rows={4} /> : serialByStatus.length === 0 ? <EmptyState title="Belum ada serial NTE" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={serialByStatus} dataKey="jumlah" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {serialByStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>)}
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Pergerakan Stok 30 Hari Terakhir" subtitle="Masuk: GR & Retur · Keluar: Issue, Scrap & Transfer" />
        <div className="p-4 h-64">
          {loading ? <TableSkeleton rows={4} /> : pergerakan.length === 0 ? <EmptyState title="Belum ada pergerakan stok 30 hari terakhir" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pergerakan}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EB" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="masuk" name="Masuk" stroke={CHART_COLORS[6]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="keluar" name="Keluar" stroke={CHART_COLORS[5]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>)}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Item Kritis Di Bawah Stok Minimum" subtitle={`${kritis.length} kombinasi item-gudang terdeteksi`} />
        <DataTable
          loading={loading}
          columns={[
            { key: 'code', header: 'Kode', width: '110px', render: (r: any) => r.item?.code },
            { key: 'name', header: 'Nama Item', render: (r: any) => r.item?.name },
            { key: 'category', header: 'Kategori', render: (r: any) => <Badge tone="slate">{r.item?.category}</Badge> },
            { key: 'gudang', header: 'Gudang', render: (r: any) => r.warehouse?.name },
            { key: 'qty', header: 'Qty Tersedia', align: 'right', render: (r: any) => <span className="text-red-600 font-semibold">{num(r.qty)} {r.item?.uom}</span> },
            { key: 'min', header: 'Stok Minimum', align: 'right', render: (r: any) => num(r.item?.min_stock) },
          ]}
          rows={kritis}
          searchable={false}
          pageSize={8}
          emptyTitle="Tidak ada item di bawah stok minimum"
        />
      </Card>
      <p className="text-caption text-ink-400 mt-4">Sumber data: v_dashboard_inventory, v_stock_opname_variance, stock_balances, stock_movements — ditarik {tgl(todayISO())}.</p>
    </div>
  )
}
