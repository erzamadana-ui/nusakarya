import React, { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, insert, update } from '@/lib/db'
import {
  PageHeader, Card, CardHeader, DataTable, Badge, Button, Modal, Field, Input, Select, Checkbox,
  Tabs, KpiCard, useToast, Plus, EmptyState, TableSkeleton, Progress,
} from '@/components/ui'
import { rupiah, num, pct, tgl, periodCode } from '@/lib/format'
import { periodRange } from '../lib/constants'

const emptyJobType = { id: null, code: '', name: '', category: '', point_weight: 0, standard_minutes: 0, tariff_amount: 0, is_active: true }

export default function Produktivitas() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('peringkat')
  const [period, setPeriod] = useState(periodCode())

  const [loading, setLoading] = useState(true)
  const [ranking, setRanking] = useState<any[]>([])
  const [trend, setTrend] = useState<{ date: string; poin: number }[]>([])
  const [draftEntries, setDraftEntries] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [verifying, setVerifying] = useState(false)

  const [jobTypes, setJobTypes] = useState<any[]>([])
  const [jtLoading, setJtLoading] = useState(true)
  const [jtModal, setJtModal] = useState(false)
  const [jtForm, setJtForm] = useState<any>(emptyJobType)
  const [jtSaving, setJtSaving] = useState(false)

  useEffect(() => { loadPeringkat() }, [period])
  useEffect(() => { if (can('PRODUCTIVITY', 'write')) loadJobTypes() }, [])

  async function loadPeringkat() {
    setLoading(true)
    try {
      const [start, end] = periodRange(period)
      const [rank, entries] = await Promise.all([
        list<any>('v_dashboard_productivity', { eq: { period_code: period }, order: { col: 'total_points', asc: false } }).catch(() => []),
        list<any>('productivity_entries', { select: 'work_date,points,status', gte: { work_date: start }, lte: { work_date: end } }),
      ])
      setRanking(rank)
      const m = new Map<string, number>()
      entries.forEach((e: any) => m.set(e.work_date, (m.get(e.work_date) || 0) + Number(e.points || 0)))
      setTrend(Array.from(m, ([date, poin]) => ({ date, poin })).sort((a, b) => a.date.localeCompare(b.date)))
      setDraftEntries(await list('productivity_entries', { select: '*,employees(full_name),job_types(name)', eq: { status: 'draft' }, gte: { work_date: start }, lte: { work_date: end }, order: { col: 'work_date', asc: false } }))
      setSelectedIds([])
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data produktivitas', 'error') }
    finally { setLoading(false) }
  }

  async function loadJobTypes() {
    setJtLoading(true)
    try { setJobTypes(await list('job_types', { order: { col: 'category', asc: true } })) }
    catch (e: any) { toast.push(e.message ?? 'Gagal memuat jenis pekerjaan', 'error') }
    finally { setJtLoading(false) }
  }

  const top10 = useMemo(() => ranking.slice(0, 10).map(r => ({ nama: r.employee_name, poin: Number(r.total_points || 0) })), [ranking])

  async function verifikasiMassal() {
    if (!selectedIds.length) return
    setVerifying(true)
    try {
      await Promise.all(selectedIds.map(id => update('productivity_entries', id, { status: 'diverifikasi', verified_by: profile?.id })))
      toast.push(`${selectedIds.length} entri produktivitas diverifikasi`); loadPeringkat()
    } catch (e: any) { toast.push(e.message ?? 'Gagal memverifikasi entri', 'error') }
    finally { setVerifying(false) }
  }

  function openAddJt() { setJtForm(emptyJobType); setJtModal(true) }
  function openEditJt(r: any) { setJtForm(r); setJtModal(true) }
  async function saveJt() {
    if (!jtForm.code || !jtForm.name) { toast.push('Kode dan nama jenis pekerjaan wajib diisi', 'error'); return }
    setJtSaving(true)
    try {
      const payload = { code: jtForm.code, name: jtForm.name, category: jtForm.category, point_weight: jtForm.point_weight || 0, standard_minutes: jtForm.standard_minutes || null, tariff_amount: jtForm.tariff_amount || 0, is_active: jtForm.is_active }
      if (jtForm.id) { await update('job_types', jtForm.id, payload); toast.push('Jenis pekerjaan diperbarui') }
      else { await insert('job_types', { ...payload, company_id: profile?.company_id, created_by: profile?.id }); toast.push('Jenis pekerjaan ditambahkan') }
      setJtModal(false); loadJobTypes()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan jenis pekerjaan', 'error') }
    finally { setJtSaving(false) }
  }

  const tabs = [{ value: 'peringkat', label: 'Peringkat & Tren' }, ...(can('PRODUCTIVITY', 'write') ? [{ value: 'jenis', label: 'Master Jenis Pekerjaan' }] : [])]

  return (
    <div>
      <PageHeader title="Produktivitas Teknisi" subtitle="Poin & nilai produktivitas teknisi terhadap target"
        actions={tab === 'peringkat' && <Field label="" className="w-36"><Input type="month" value={period} onChange={(e: any) => setPeriod(e.target.value)} /></Field>} />

      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={tabs} />

      {tab === 'peringkat' && <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <KpiCard label="Teknisi Tercatat" value={ranking.length} tone="teal" />
          <KpiCard label="Total Poin Periode" value={num(ranking.reduce((s, r) => s + Number(r.total_points || 0), 0), 1)} tone="emerald" />
          <KpiCard label="Rata-rata Capaian" value={pct(ranking.length ? ranking.reduce((s, r) => s + Number(r.achievement_percent || 0), 0) / ranking.length : 0)} tone="amber" />
          <KpiCard label="Entri Menunggu Verifikasi" value={draftEntries.length} tone="orange" />
        </div>

        <div className="grid lg:grid-cols-2 gap-5 mb-5">
          <Card>
            <CardHeader title="10 Teknisi Teratas" subtitle={`Periode ${period}`} />
            <div className="p-4 h-72">
              {loading ? <TableSkeleton rows={4} /> : top10.length === 0 ? <EmptyState title="Belum ada data periode ini" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top10} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EB" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nama" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="poin" fill="#1B8A92" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>)}
            </div>
          </Card>
          <Card>
            <CardHeader title="Tren Poin Harian" subtitle={`Periode ${period}`} />
            <div className="p-4 h-72">
              {loading ? <TableSkeleton rows={4} /> : trend.length === 0 ? <EmptyState title="Belum ada data periode ini" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EB" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(8, 10)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(d: any) => tgl(d)} />
                    <Line type="monotone" dataKey="poin" stroke="#F5A524" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>)}
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden mb-5">
          <CardHeader title="Peringkat vs Target" />
          <DataTable
            loading={loading} rows={ranking} searchable={false} emptyTitle="Belum ada data pada periode ini"
            columns={[
              { key: 'rank', header: '#', width: '48px', render: (_r, i) => i + 1 },
              { key: 'employee_name', header: 'Teknisi' },
              { key: 'total_points', header: 'Poin', align: 'right', render: r => num(r.total_points, 1) },
              { key: 'target_points', header: 'Target', align: 'right', render: r => num(r.target_points, 1) },
              { key: 'achievement_percent', header: 'Capaian', render: r => <div className="flex items-center gap-2 w-36"><Progress value={r.achievement_percent} tone={r.achievement_percent >= 100 ? 'success' : r.achievement_percent >= 70 ? 'warning' : 'danger'} /><span className="text-caption whitespace-nowrap">{pct(r.achievement_percent)}</span></div> },
              { key: 'total_amount', header: 'Nilai Insentif', align: 'right', render: r => rupiah(r.total_amount) },
            ]}
          />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Entri Menunggu Verifikasi (Status Draft)"
            action={can('PRODUCTIVITY', 'approve') && selectedIds.length > 0 && <Button size="sm" loading={verifying} onClick={verifikasiMassal}>Verifikasi {selectedIds.length} Entri</Button>} />
          <DataTable
            loading={loading} rows={draftEntries} searchable={false} emptyTitle="Tidak ada entri menunggu verifikasi"
            selectable={can('PRODUCTIVITY', 'approve')} onSelect={setSelectedIds}
            columns={[
              { key: 'work_date', header: 'Tanggal', render: r => tgl(r.work_date) },
              { key: 'nama', header: 'Teknisi', render: r => r.employees?.full_name ?? '-' },
              { key: 'jenis', header: 'Jenis Pekerjaan', render: r => r.job_types?.name ?? '-' },
              { key: 'qty', header: 'Qty', align: 'right' },
              { key: 'points', header: 'Poin', align: 'right', render: r => num(r.points, 1) },
              { key: 'amount', header: 'Nilai', align: 'right', render: r => rupiah(r.amount) },
              { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
            ]}
          />
        </Card>
      </>}

      {tab === 'jenis' && can('PRODUCTIVITY', 'write') && <>
        <div className="flex justify-end mb-4"><Button icon={<Plus size={16} />} onClick={openAddJt}>Tambah Jenis Pekerjaan</Button></div>
        <DataTable
          loading={jtLoading} rows={jobTypes} onRowClick={openEditJt} searchKeys={['code', 'name', 'category']}
          emptyTitle="Belum ada master jenis pekerjaan"
          columns={[
            { key: 'code', header: 'Kode', width: '120px' }, { key: 'name', header: 'Nama Pekerjaan' }, { key: 'category', header: 'Kategori' },
            { key: 'point_weight', header: 'Bobot Poin', align: 'right', render: r => num(r.point_weight, 1) },
            { key: 'standard_minutes', header: 'Menit Standar', align: 'right' },
            { key: 'tariff_amount', header: 'Tarif', align: 'right', render: r => rupiah(r.tariff_amount) },
            { key: 'is_active', header: 'Status', render: r => r.is_active ? <Badge tone="emerald">Aktif</Badge> : <Badge tone="slate">Nonaktif</Badge> },
          ]}
        />
      </>}

      <Modal open={jtModal} onClose={() => setJtModal(false)} title={jtForm.id ? 'Ubah Jenis Pekerjaan' : 'Tambah Jenis Pekerjaan'}
        footer={<><Button variant="outline" onClick={() => setJtModal(false)}>Batal</Button><Button loading={jtSaving} onClick={saveJt}>Simpan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Kode" required><Input value={jtForm.code} onChange={(e: any) => setJtForm({ ...jtForm, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Nama Pekerjaan" required><Input value={jtForm.name} onChange={(e: any) => setJtForm({ ...jtForm, name: e.target.value })} /></Field>
          <Field label="Kategori"><Input value={jtForm.category} onChange={(e: any) => setJtForm({ ...jtForm, category: e.target.value })} placeholder="mis. DEPLOYMENT" /></Field>
          <Field label="Bobot Poin"><Input type="number" step="0.1" value={jtForm.point_weight} onChange={(e: any) => setJtForm({ ...jtForm, point_weight: Number(e.target.value) })} /></Field>
          <Field label="Menit Standar"><Input type="number" value={jtForm.standard_minutes ?? ''} onChange={(e: any) => setJtForm({ ...jtForm, standard_minutes: Number(e.target.value) })} /></Field>
          <Field label="Tarif per Pekerjaan"><Input type="number" value={jtForm.tariff_amount} onChange={(e: any) => setJtForm({ ...jtForm, tariff_amount: Number(e.target.value) })} /></Field>
          <Checkbox label="Aktif" checked={jtForm.is_active} onChange={(e: any) => setJtForm({ ...jtForm, is_active: e.target.checked })} />
        </div>
      </Modal>
    </div>
  )
}
