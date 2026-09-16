import React, { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import {
  PageHeader, Card, CardHeader, DataTable, Badge, Button, Modal, Drawer, Tabs, Stepper, Field, Input, Select,
  Textarea, Money, KpiCard, Desc, Section, useToast, Plus, TableSkeleton,
} from '@/components/ui'
import { tgl, tglJam, num, pct, todayISO, rupiah } from '@/lib/format'
import PhotoUploader from '../components/PhotoUploader'
import {
  INCIDENT_TYPES, incidentTypeLabel, incidentTypeTone, incidentStatusLabel, incidentStatusTone,
  incidentStatusIndex, INCIDENT_STATUSES, ASPEK_RCA, ASPECT_COLORS, isMajorIncident, CHART_COLORS,
} from '../lib/constants'
import { tautanPeta, monthsAgoISODate } from '../lib/helpers'

function newForm() {
  return {
    incident_date: todayISO(), incident_type: '', location: '', lat: '', lng: '', branch_id: '',
    employee_id: '', work_order_id: '', description: '', immediate_action: '', photo_urls: [] as string[],
  }
}
function invFormFrom(r: any) {
  return { root_cause_id: r.root_cause_id || '', corrective_action: r.corrective_action || '', lost_days: r.lost_days ?? 0, cost_estimate: r.cost_estimate ?? 0 }
}

export default function Insiden() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const writable = can('OPERATIONS', 'write')

  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('semua')
  const [incidents, setIncidents] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [rootCauses, setRootCauses] = useState<any[]>([])

  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<any>(newForm())
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)

  const [selected, setSelected] = useState<any>(null)
  const [drawerTab, setDrawerTab] = useState('ringkasan')
  const [invForm, setInvForm] = useState<any>(invFormFrom({}))
  const [invSaving, setInvSaving] = useState(false)

  useEffect(() => { if (profile?.company_id) loadAll() }, [profile?.company_id])

  async function loadAll() {
    setLoading(true)
    try {
      const [inc, br, emp, wo, rc] = await Promise.all([
        list('hse_incidents', { eq: { company_id: profile!.company_id }, order: { col: 'incident_date', asc: false }, limit: 2000 }),
        list('branches', { select: 'id,name', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
        list('employees', { select: 'id,full_name,position', eq: { company_id: profile!.company_id }, order: { col: 'full_name', asc: true }, limit: 1000 }),
        list('work_orders', { select: 'id,wo_no,title', eq: { company_id: profile!.company_id }, order: { col: 'created_at', asc: false }, limit: 500 }),
        list('root_causes', { select: 'id,code,name,aspect', eq: { company_id: profile!.company_id }, order: { col: 'code', asc: true } }),
      ])
      setIncidents(inc); setBranches(br); setEmployees(emp); setWorkOrders(wo); setRootCauses(rc)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data insiden', 'error') }
    finally { setLoading(false) }
  }

  const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'
  const empName = (id?: string) => employees.find(e => e.id === id)?.full_name ?? '-'
  const woLabel = (id?: string) => { const w = workOrders.find(x => x.id === id); return w ? `${w.wo_no} — ${w.title ?? ''}` : '-' }
  const rcById = useMemo(() => Object.fromEntries(rootCauses.map(r => [r.id, r])), [rootCauses])
  const rcLabel = (id?: string) => rcById[id] ? `${rcById[id].name} (${rcById[id].aspect})` : '-'

  const filtered = useMemo(() => tab === 'semua' ? incidents : incidents.filter(i => i.status === tab), [incidents, tab])
  const tabs = [{ value: 'semua', label: 'Semua', count: incidents.length },
    ...INCIDENT_STATUSES.map(s => ({ value: s.value, label: s.label, count: incidents.filter(i => i.status === s.value).length }))]

  /* ---------------- KPI ---------------- */
  const twelveMonthsAgo = monthsAgoISODate(12)
  const kpi = useMemo(() => {
    const terbuka = incidents.filter(i => i.status !== 'selesai')
    const beratFatal = incidents.filter(i => i.incident_date >= twelveMonthsAgo && isMajorIncident(i.incident_type))
    const nearmiss = incidents.filter(i => i.incident_date >= twelveMonthsAgo && i.incident_type === 'nearmiss')
    return { total: incidents.length, terbuka: terbuka.length, beratFatal: beratFatal.length, nearmiss: nearmiss.length }
  }, [incidents, twelveMonthsAgo])

  /* ---------------- Pareto penyebab per aspek ---------------- */
  const berRootCause = useMemo(() => incidents.filter(i => i.root_cause_id), [incidents])
  const perAspek = useMemo(() => {
    const g: Record<string, number> = { People: 0, Process: 0, Tools: 0, Partnership: 0 }
    berRootCause.forEach(i => { const asp = rcById[i.root_cause_id]?.aspect; if (asp) g[asp] = (g[asp] ?? 0) + 1 })
    return Object.entries(g).map(([name, jumlah]) => ({ name, jumlah }))
  }, [berRootCause, rcById])
  const pareto = useMemo(() => {
    const g: Record<string, number> = {}
    berRootCause.forEach(i => { g[i.root_cause_id] = (g[i.root_cause_id] ?? 0) + 1 })
    const rows = Object.entries(g).map(([id, freq]) => ({ id, name: rcById[id]?.name ?? '(tidak dikenal)', aspect: rcById[id]?.aspect ?? '-', freq }))
      .sort((a, b) => b.freq - a.freq)
    const total = rows.reduce((a, b) => a + b.freq, 0)
    let kum = 0
    return rows.map(r => { kum += r.freq; return { ...r, kumulatif: total ? (kum / total) * 100 : 0 } })
  }, [berRootCause, rcById])

  /* ---------------- Insiden baru ---------------- */
  function openNew() { setForm(newForm()); setNewOpen(true) }
  function useCurrentLocation() {
    if (!navigator.geolocation) { toast.push('Perangkat tidak mendukung penangkapan lokasi', 'error'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setForm((f: any) => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })); setLocating(false); toast.push('Koordinat berhasil ditangkap', 'success') },
      () => { setLocating(false); toast.push('Gagal menangkap lokasi — pastikan izin lokasi diaktifkan', 'error') },
    )
  }
  async function submitNew() {
    if (!form.incident_date || !form.incident_type || !form.location || !form.branch_id || !form.description) {
      toast.push('Lengkapi tanggal, jenis, lokasi, cabang, dan uraian terlebih dahulu', 'error'); return
    }
    setSaving(true)
    try {
      const incidentNo = await nextDocNo(profile!.company_id, 'INC')
      await insert('hse_incidents', {
        company_id: profile!.company_id, incident_no: incidentNo, incident_date: form.incident_date,
        incident_type: form.incident_type, location: form.location, lat: form.lat || null, lng: form.lng || null,
        branch_id: form.branch_id, employee_id: form.employee_id || null, work_order_id: form.work_order_id || null,
        description: form.description, immediate_action: form.immediate_action || null, photo_urls: form.photo_urls,
        status: 'dilaporkan', reported_by: profile!.id, created_by: profile!.id,
      })
      toast.push(`Insiden ${incidentNo} berhasil dilaporkan`, 'success')
      setNewOpen(false); await loadAll()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan laporan insiden', 'error') }
    finally { setSaving(false) }
  }

  /* ---------------- Drawer investigasi ---------------- */
  function openDetail(row: any) { setSelected(row); setDrawerTab('ringkasan'); setInvForm(invFormFrom(row)) }
  function closeDrawer() { setSelected(null) }
  async function refreshSelected(id: string) {
    const row = (await list('hse_incidents', { eq: { id }, limit: 1 }))[0]
    if (row) { setSelected(row); setIncidents(is => is.map(i => i.id === row.id ? row : i)); setInvForm(invFormFrom(row)) }
  }
  async function simpanInvestigasi() {
    if (!invForm.root_cause_id) { toast.push('Pilih root cause terlebih dahulu', 'error'); return }
    setInvSaving(true)
    try {
      const nextStatus = selected.status === 'dilaporkan' ? 'investigasi' : selected.status
      await update('hse_incidents', selected.id, {
        root_cause_id: invForm.root_cause_id, corrective_action: invForm.corrective_action || null,
        lost_days: Number(invForm.lost_days) || 0, cost_estimate: Number(invForm.cost_estimate) || 0, status: nextStatus,
      })
      toast.push('Data investigasi disimpan', 'success'); await refreshSelected(selected.id)
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan investigasi', 'error') }
    finally { setInvSaving(false) }
  }
  async function tutupInsiden() {
    if (!invForm.root_cause_id || !invForm.corrective_action) { toast.push('Root cause dan tindakan korektif wajib diisi sebelum insiden ditutup', 'error'); return }
    setInvSaving(true)
    try {
      await update('hse_incidents', selected.id, {
        root_cause_id: invForm.root_cause_id, corrective_action: invForm.corrective_action,
        lost_days: Number(invForm.lost_days) || 0, cost_estimate: Number(invForm.cost_estimate) || 0,
        status: 'selesai', closed_at: new Date().toISOString(),
      })
      toast.push('Insiden ditutup', 'success'); await refreshSelected(selected.id)
    } catch (e: any) { toast.push(e.message ?? 'Gagal menutup insiden', 'error') }
    finally { setInvSaving(false) }
  }

  const peta = selected ? tautanPeta(selected.lat, selected.lng) : null

  return (
    <div>
      <PageHeader title="Laporan Insiden K3" subtitle="Pencatatan & investigasi insiden, nearmiss, dan kecelakaan kerja"
        actions={writable && <Button icon={<Plus size={16} />} onClick={openNew}>Lapor Insiden</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total Insiden" value={loading ? '…' : num(kpi.total)} />
        <KpiCard label="Belum Selesai Investigasi" value={loading ? '…' : num(kpi.terbuka)} tone={kpi.terbuka > 0 ? 'amber' : 'teal'} />
        <KpiCard label="Berat/Fatal (12 Bulan)" value={loading ? '…' : num(kpi.beratFatal)} tone={kpi.beratFatal > 0 ? 'red' : 'teal'} />
        <KpiCard label="Nearmiss (12 Bulan)" value={loading ? '…' : num(kpi.nearmiss)} />
      </div>

      <Card className="mb-4">
        <Tabs tabs={tabs} value={tab} onChange={setTab} className="px-4" />
      </Card>

      <DataTable
        loading={loading} rows={filtered} onRowClick={openDetail}
        searchKeys={['incident_no', 'location', 'description']} exportName="insiden-k3"
        emptyTitle="Belum ada insiden" emptyMessage="Insiden yang dilaporkan akan muncul di sini."
        columns={[
          { key: 'incident_no', header: 'No Insiden' },
          { key: 'incident_date', header: 'Tanggal', render: r => tgl(r.incident_date) },
          { key: 'incident_type', header: 'Jenis', render: r => <Badge tone={incidentTypeTone(r.incident_type)}>{incidentTypeLabel(r.incident_type)}</Badge> },
          { key: 'location', header: 'Lokasi' },
          { key: 'branch_id', header: 'Cabang', render: r => branchName(r.branch_id) },
          { key: 'employee_id', header: 'Karyawan Terlibat', render: r => empName(r.employee_id) },
          { key: 'lost_days', header: 'Hari Hilang', align: 'right', render: r => num(r.lost_days) },
          { key: 'status', header: 'Status', render: r => <Badge tone={incidentStatusTone(r.status)}>{incidentStatusLabel(r.status)}</Badge> },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader title="Insiden per Aspek Root Cause" />
          <div className="p-4 h-64">
            {loading ? <TableSkeleton rows={4} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perAspek}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="jumlah" radius={[4, 4, 0, 0]}>
                    {perAspek.map((r, i) => <Cell key={i} fill={ASPECT_COLORS[r.name] ?? CHART_COLORS[0]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>)}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Tabel Pareto Penyebab Insiden" subtitle="Diurutkan dari frekuensi tertinggi — hanya insiden dengan root cause terisi" />
          <DataTable
            loading={loading} rows={pareto} searchable={false} pageSize={10} emptyTitle="Belum ada insiden dengan root cause"
            columns={[
              { key: 'name', header: 'Penyebab' },
              { key: 'aspect', header: 'Aspek', render: r => <Badge>{r.aspect}</Badge> },
              { key: 'freq', header: 'Frekuensi', align: 'right' },
              { key: 'kumulatif', header: 'Kumulatif %', align: 'right', render: r => pct(r.kumulatif) },
            ]}
          />
        </Card>
      </div>

      {/* Modal lapor insiden baru */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Lapor Insiden K3 Baru" size="lg"
        footer={<><Button variant="outline" onClick={() => setNewOpen(false)}>Batal</Button>
          <Button loading={saving} onClick={submitNew}>Simpan Laporan</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="No Insiden"><Input value="Otomatis saat disimpan (INC/…)" disabled /></Field>
          <Field label="Tanggal Kejadian" required><Input type="date" value={form.incident_date} onChange={(e: any) => setForm({ ...form, incident_date: e.target.value })} /></Field>
          <Field label="Jenis Insiden" required><Select options={INCIDENT_TYPES} value={form.incident_type} onChange={(e: any) => setForm({ ...form, incident_type: e.target.value })} /></Field>
          <Field label="Cabang" required><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={form.branch_id} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value })} /></Field>
          <Field label="Lokasi" required className="sm:col-span-2"><Input value={form.location} onChange={(e: any) => setForm({ ...form, location: e.target.value })} placeholder="Contoh: Tiang T-045, Jl. Merdeka" /></Field>
          <Field label="Latitude" hint="Isi manual atau tangkap otomatis">
            <div className="flex gap-2">
              <Input value={form.lat} onChange={(e: any) => setForm({ ...form, lat: e.target.value })} placeholder="-6.200000" />
              <Button type="button" variant="outline" size="md" loading={locating} onClick={useCurrentLocation}>Tangkap</Button>
            </div>
          </Field>
          <Field label="Longitude"><Input value={form.lng} onChange={(e: any) => setForm({ ...form, lng: e.target.value })} placeholder="106.816666" /></Field>
          <Field label="Karyawan Terlibat"><Select options={employees.map(e => ({ value: e.id, label: `${e.full_name} — ${e.position ?? ''}` }))} value={form.employee_id} onChange={(e: any) => setForm({ ...form, employee_id: e.target.value })} /></Field>
          <Field label="Tautan Work Order"><Select options={workOrders.map(w => ({ value: w.id, label: `${w.wo_no} — ${w.title ?? ''}` }))} value={form.work_order_id} onChange={(e: any) => setForm({ ...form, work_order_id: e.target.value })} /></Field>
          <Field label="Uraian Kejadian" required className="sm:col-span-2"><Textarea value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Tindakan Segera" className="sm:col-span-2"><Textarea value={form.immediate_action} onChange={(e: any) => setForm({ ...form, immediate_action: e.target.value })} /></Field>
          <Field label="Foto Bukti" className="sm:col-span-2">
            <PhotoUploader companyId={profile!.company_id} entity="hse-incidents" paths={form.photo_urls} onChange={p => setForm({ ...form, photo_urls: p })} />
          </Field>
        </div>
      </Modal>

      {/* Drawer detail & investigasi */}
      <Drawer open={!!selected} onClose={closeDrawer} width="max-w-2xl" title={selected ? `${selected.incident_no} — ${incidentTypeLabel(selected.incident_type)}` : ''}>
        {selected && (
          <div>
            <div className="mb-4"><Stepper steps={INCIDENT_STATUSES.map(s => s.label)} current={incidentStatusIndex(selected.status)} /></div>
            <Tabs className="mb-4" tabs={[{ value: 'ringkasan', label: 'Ringkasan' }, { value: 'investigasi', label: 'Investigasi' }, { value: 'lampiran', label: 'Lampiran' }]} value={drawerTab} onChange={setDrawerTab} />

            {drawerTab === 'ringkasan' && (
              <Section>
                <Desc cols={2} items={[
                  { label: 'Status', value: <Badge tone={incidentStatusTone(selected.status)}>{incidentStatusLabel(selected.status)}</Badge> },
                  { label: 'Jenis', value: <Badge tone={incidentTypeTone(selected.incident_type)}>{incidentTypeLabel(selected.incident_type)}</Badge> },
                  { label: 'Tanggal Kejadian', value: tgl(selected.incident_date) },
                  { label: 'Cabang', value: branchName(selected.branch_id) },
                  { label: 'Karyawan Terlibat', value: empName(selected.employee_id) },
                  { label: 'Tautan Work Order', value: woLabel(selected.work_order_id) },
                  { label: 'Lokasi', value: <>{selected.location || '-'}{peta && <a href={peta} target="_blank" rel="noreferrer" className="block text-primary-600 dark:text-primary-300 mt-0.5">Lihat di Google Maps</a>}</> },
                  { label: 'Ditutup Pada', value: tglJam(selected.closed_at) },
                ]} />
                {selected.description && <p className="mt-4 text-body text-ink-600 dark:text-ink-300"><span className="font-medium text-ink-800 dark:text-ink-100">Uraian: </span>{selected.description}</p>}
                {selected.immediate_action && <p className="mt-2 text-body text-ink-600 dark:text-ink-300"><span className="font-medium text-ink-800 dark:text-ink-100">Tindakan Segera: </span>{selected.immediate_action}</p>}
              </Section>
            )}

            {drawerTab === 'investigasi' && (
              <Section>
                {selected.status === 'selesai' ? (
                  <Desc cols={1} items={[
                    { label: 'Root Cause', value: rcLabel(selected.root_cause_id) },
                    { label: 'Tindakan Korektif', value: selected.corrective_action },
                    { label: 'Hari Kerja Hilang', value: num(selected.lost_days) },
                    { label: 'Perkiraan Biaya', value: rupiah(selected.cost_estimate) },
                  ]} />
                ) : writable ? (
                  <div className="space-y-4">
                    <Field label="Root Cause (4 Aspek)" required>
                      <Select options={ASPEK_RCA.flatMap(a => rootCauses.filter(r => r.aspect === a.value).map(r => ({ value: r.id, label: `[${a.value}] ${r.name}` })))}
                        value={invForm.root_cause_id} onChange={(e: any) => setInvForm({ ...invForm, root_cause_id: e.target.value })} />
                    </Field>
                    <Field label="Tindakan Korektif"><Textarea value={invForm.corrective_action} onChange={(e: any) => setInvForm({ ...invForm, corrective_action: e.target.value })} /></Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Hari Kerja Hilang"><Input type="number" min={0} value={invForm.lost_days} onChange={(e: any) => setInvForm({ ...invForm, lost_days: e.target.value })} /></Field>
                      <Field label="Perkiraan Biaya"><Money value={invForm.cost_estimate} onChange={(v: number) => setInvForm({ ...invForm, cost_estimate: v })} /></Field>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button variant="outline" loading={invSaving} onClick={simpanInvestigasi}>Simpan Investigasi</Button>
                      <Button variant="success" loading={invSaving} onClick={tutupInsiden}>Tutup Insiden</Button>
                    </div>
                  </div>
                ) : <p className="text-caption text-ink-400">Belum ada data investigasi.</p>}
              </Section>
            )}

            {drawerTab === 'lampiran' && (
              <Section>
                <PhotoUploader companyId={profile!.company_id} entity="hse-incidents" paths={selected.photo_urls || []}
                  disabled={!writable}
                  onChange={async (p) => { try { await update('hse_incidents', selected.id, { photo_urls: p }); await refreshSelected(selected.id) } catch (e: any) { toast.push(e.message ?? 'Gagal memperbarui foto', 'error') } }} />
              </Section>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
