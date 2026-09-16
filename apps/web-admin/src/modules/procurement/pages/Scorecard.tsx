import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, insert, update } from '@/lib/db'
import { num, tgl, periodCode } from '@/lib/format'
import { PageHeader, FilterBar, KpiCard, DataTable, Modal, Card, CardHeader, Button, Field, Input, Textarea, Select, Badge, useToast, Plus } from '@/components/ui'
import { CHART_COLORS } from '../lib/shared'

const WEIGHTS = { otd: 0.3, quality: 0.3, price: 0.2, compliance: 0.2 }
function computeTotal(o: number, q: number, p: number, c: number) {
  return Math.round((o * WEIGHTS.otd + q * WEIGHTS.quality + p * WEIGHTS.price + c * WEIGHTS.compliance) * 10) / 10
}

export default function Scorecard() {
  const { profile, can } = useAuth()
  const toast = useToast()

  const [period, setPeriod] = useState(periodCode())
  const [rows, setRows] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState<{ open: boolean; row?: any }>({ open: false })
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [otdAuto, setOtdAuto] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sc, v] = await Promise.all([
        list('vendor_scorecards', { eq: { period_code: period }, order: { col: 'total_score', asc: false } }),
        list('vendors', { order: { col: 'name', asc: true } }),
      ])
      setRows(sc); setVendors(v)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat vendor scorecard', 'error') }
    finally { setLoading(false) }
  }, [period, toast])
  useEffect(() => { load() }, [load])

  const vendorName = (id: string) => vendors.find(v => v.id === id)?.name ?? '-'
  const chartData = useMemo(() => rows.slice(0, 10).map(r => ({ name: vendorName(r.vendor_id), skor: Number(r.total_score) })), [rows, vendors])

  function openAdd() {
    setForm({ vendor_id: '', period_code: period, otd_score: 0, quality_score: 0, price_score: 0, compliance_score: 0, note: '' })
    setOtdAuto(false); setModal({ open: true })
  }
  function openEdit(row: any) { setForm({ ...row }); setOtdAuto(false); setModal({ open: true, row }) }

  async function hitungOtdOtomatis() {
    if (!form.vendor_id) { toast.push('Pilih vendor terlebih dahulu', 'error'); return }
    setCalculating(true)
    try {
      const [y, m] = (form.period_code ?? period).split('-').map(Number)
      const start = `${form.period_code ?? period}-01`
      const endDate = new Date(y, m, 0); const end = endDate.toISOString().slice(0, 10)
      const pos = await list('purchase_orders', { eq: { vendor_id: form.vendor_id }, gte: { delivery_date: start }, lte: { delivery_date: end } })
      const relevant = pos.filter((p: any) => ['diterima', 'diterima_sebagian', 'ditutup'].includes(p.status))
      if (relevant.length === 0) { toast.push('Tidak ada PO terkirim vendor ini pada periode tersebut', 'info'); setCalculating(false); return }
      let onTime = 0
      for (const po of relevant) {
        const grs = await list('goods_receipts', { eq: { po_id: po.id }, order: { col: 'gr_date', asc: true }, limit: 1 })
        if (grs[0] && grs[0].gr_date <= po.delivery_date) onTime++
      }
      const score = Math.round((onTime / relevant.length) * 1000) / 10
      setForm((f: any) => ({ ...f, otd_score: score }))
      setOtdAuto(true)
      toast.push(`Skor ketepatan kirim dihitung sistem: ${score} dari ${relevant.length} PO`)
    } catch (e: any) { toast.push(e.message ?? 'Gagal menghitung skor otomatis', 'error') }
    finally { setCalculating(false) }
  }

  const totalScore = computeTotal(Number(form.otd_score) || 0, Number(form.quality_score) || 0, Number(form.price_score) || 0, Number(form.compliance_score) || 0)

  async function save() {
    if (!form.vendor_id || !form.period_code) { toast.push('Vendor dan periode wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const payload = { ...form, total_score: totalScore }
      if (modal.row) await update('vendor_scorecards', modal.row.id, payload)
      else await insert('vendor_scorecards', { ...payload, company_id: profile!.company_id, created_by: profile!.id })
      toast.push('Scorecard vendor tersimpan'); setModal({ open: false }); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan scorecard', 'error') }
    finally { setSaving(false) }
  }

  const columns = [
    { key: 'rank', header: '#', width: '48px', sortable: false, render: (_r: any, i: number) => i + 1 },
    { key: 'vendor_id', header: 'Vendor', render: (r: any) => vendorName(r.vendor_id) },
    { key: 'otd_score', header: 'Ketepatan Kirim', align: 'right' as const, render: (r: any) => num(r.otd_score, 1) },
    { key: 'quality_score', header: 'Mutu', align: 'right' as const, render: (r: any) => num(r.quality_score, 1) },
    { key: 'price_score', header: 'Harga', align: 'right' as const, render: (r: any) => num(r.price_score, 1) },
    { key: 'compliance_score', header: 'Kepatuhan', align: 'right' as const, render: (r: any) => num(r.compliance_score, 1) },
    { key: 'total_score', header: 'Skor Total', align: 'right' as const, render: (r: any) => <b>{num(r.total_score, 1)}</b> },
    {
      key: 'aksi', header: '', sortable: false, render: (r: any) => can('PROCUREMENT', 'write') && (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}><Button size="sm" variant="outline" onClick={() => openEdit(r)}>Ubah</Button></div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Vendor Scorecard" subtitle="Penilaian kinerja vendor per periode: ketepatan kirim, mutu, harga, dan kepatuhan."
        actions={can('PROCUREMENT', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Penilaian</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <KpiCard label="Vendor Dinilai" value={num(rows.length)} />
        <KpiCard label="Skor Rata-rata" value={num(rows.length ? rows.reduce((a, r) => a + Number(r.total_score), 0) / rows.length : 0, 1)} tone="teal" />
        <KpiCard label="Vendor Skor Terbaik" value={rows[0] ? vendorName(rows[0].vendor_id) : '-'} sub={rows[0] ? `Skor ${num(rows[0].total_score, 1)}` : ''} tone="amber" />
      </div>

      <FilterBar>
        <Field label="Periode" className="w-40"><Input type="month" value={period} onChange={(e: any) => setPeriod(e.target.value)} /></Field>
      </FilterBar>

      <Card className="mb-4">
        <CardHeader title="Peringkat Vendor" subtitle={`Skor total tertinggi periode ${period}`} />
        <div className="p-4" style={{ height: 300 }}>
          {chartData.length === 0 ? <p className="text-body text-ink-400 text-center py-10">Belum ada data scorecard pada periode ini.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => num(v, 1)} />
                <Bar dataKey="skor" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <DataTable columns={columns} rows={rows} loading={loading} searchable searchKeys={[]} exportName={`vendor-scorecard-${period}`}
        emptyTitle="Belum ada scorecard periode ini" emptyMessage="Tambahkan penilaian vendor untuk periode terpilih." />

      <Modal open={modal.open} onClose={() => setModal({ open: false })} size="lg" title={modal.row ? 'Ubah Vendor Scorecard' : 'Tambah Vendor Scorecard'}
        footer={<><Button variant="outline" onClick={() => setModal({ open: false })}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Vendor" required><Select value={form.vendor_id ?? ''} onChange={(e: any) => setForm({ ...form, vendor_id: e.target.value })} options={vendors.map(v => ({ value: v.id, label: v.name }))} /></Field>
          <Field label="Periode" required><Input type="month" value={form.period_code ?? ''} onChange={(e: any) => setForm({ ...form, period_code: e.target.value })} /></Field>
          <Field label="Skor Ketepatan Kirim (0-100)" hint={otdAuto ? 'Dihitung sistem dari data PO/Good Receive' : undefined}>
            <div className="flex gap-2">
              <Input type="number" min="0" max="100" value={form.otd_score ?? 0} onChange={(e: any) => { setForm({ ...form, otd_score: Number(e.target.value) }); setOtdAuto(false) }} />
              <Button size="sm" variant="outline" loading={calculating} onClick={hitungOtdOtomatis}>Hitung Otomatis</Button>
            </div>
            {otdAuto && <Badge tone="teal" className="mt-1.5">Perhitungan Sistem</Badge>}
          </Field>
          <Field label="Skor Mutu (0-100)"><Input type="number" min="0" max="100" value={form.quality_score ?? 0} onChange={(e: any) => setForm({ ...form, quality_score: Number(e.target.value) })} /></Field>
          <Field label="Skor Harga (0-100)"><Input type="number" min="0" max="100" value={form.price_score ?? 0} onChange={(e: any) => setForm({ ...form, price_score: Number(e.target.value) })} /></Field>
          <Field label="Skor Kepatuhan (0-100)"><Input type="number" min="0" max="100" value={form.compliance_score ?? 0} onChange={(e: any) => setForm({ ...form, compliance_score: Number(e.target.value) })} /></Field>
          <Field label="Catatan" className="sm:col-span-2"><Textarea value={form.note ?? ''} onChange={(e: any) => setForm({ ...form, note: e.target.value })} /></Field>
        </div>
        <div className="mt-4 flex items-center justify-between px-3 py-2.5 rounded-md bg-ink-50 dark:bg-surface-darker">
          <span className="text-body text-ink-600 dark:text-ink-300">Skor Total (bobot 30/30/20/20)</span>
          <span className="font-display font-bold text-[18px] tabular">{num(totalScore, 1)}</span>
        </div>
      </Modal>
    </div>
  )
}
