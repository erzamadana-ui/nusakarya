import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { list, getOne, insert, update, remove, nextDocNo } from '@/lib/db'
import {
  PageHeader, Card, CardHeader, DataTable, Drawer, Modal, ConfirmDialog, Tabs, Field, Input, Select,
  Money, Button, Badge, Progress, Desc, Section, useToast, Plus, EmptyState,
} from '@/components/ui'
import { rupiah, num, pct, tgl, todayISO } from '@/lib/format'
import { PROJECT_TYPES, PROJECT_STATUS, MILESTONE_STATUS, projectLabel } from '../lib/shared'

type Project = any

export default function Proyek() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const writable = can('DEPLOYMENT', 'write')

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Project[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const [drawerRow, setDrawerRow] = useState<Project | null>(null)
  const [tab, setTab] = useState('ringkasan')

  const [delRow, setDelRow] = useState<Project | null>(null)

  const load = async () => {
    if (!profile?.company_id) return
    setLoading(true)
    try {
      const [p, c, b, e] = await Promise.all([
        list('projects', { order: { col: 'created_at', asc: false }, limit: 1000 }),
        list('customers', { select: 'id,name', order: { col: 'name', asc: true } }),
        list('branches', { select: 'id,name', order: { col: 'name', asc: true } }),
        list('employees', { select: 'id,full_name,position', order: { col: 'full_name', asc: true } }),
      ])
      setRows(p); setCustomers(c); setBranches(b); setEmployees(e)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data', 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [profile?.company_id])

  const custName = (id?: string) => customers.find(c => c.id === id)?.name ?? '-'
  const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'
  const empName = (id?: string) => employees.find(e => e.id === id)?.full_name ?? '-'

  const openAdd = async () => {
    let kode = ''
    try { kode = await nextDocNo(profile!.company_id, 'PRJ') } catch { /* biarkan kosong bila gagal */ }
    setEditing(null)
    setForm({ project_code: kode, project_type: 'deployment', status: 'perencanaan', contract_value: 0, budget_cost: 0, progress_percent: 0 })
    setFormOpen(true)
  }
  const openEdit = (row: Project) => {
    setEditing(row)
    setForm({ ...row })
    setFormOpen(true)
  }
  const saveForm = async () => {
    if (!form.project_name || !form.customer_id) { toast.push('Nama proyek dan pelanggan wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        company_id: profile!.company_id,
        project_code: form.project_code,
        project_name: form.project_name,
        customer_id: form.customer_id,
        project_type: form.project_type || null,
        branch_id: form.branch_id || null,
        location: form.location || null,
        start_date: form.start_date || null,
        target_date: form.target_date || null,
        actual_finish_date: form.actual_finish_date || null,
        contract_value: Number(form.contract_value ?? 0),
        budget_cost: Number(form.budget_cost ?? 0),
        progress_percent: Number(form.progress_percent ?? 0),
        status: form.status || 'perencanaan',
        pm_id: form.pm_id || null,
        note: form.note || null,
      }
      if (editing) {
        const upd = await update('projects', editing.id, payload)
        setRows(rs => rs.map(r => r.id === upd.id ? upd : r))
        if (drawerRow?.id === upd.id) setDrawerRow(upd)
        toast.push('Proyek diperbarui')
      } else {
        const created = await insert('projects', { ...payload, created_by: profile!.id })
        setRows(rs => [created, ...rs])
        toast.push('Proyek ditambahkan')
      }
      setFormOpen(false)
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan', 'error') }
    finally { setSaving(false) }
  }
  const doDelete = async () => {
    if (!delRow) return
    try {
      await remove('projects', delRow.id)
      setRows(rs => rs.filter(r => r.id !== delRow.id))
      if (drawerRow?.id === delRow.id) setDrawerRow(null)
      toast.push('Proyek dihapus')
    } catch (e: any) { toast.push(e.message ?? 'Gagal menghapus', 'error') }
  }

  return (
    <div>
      <PageHeader title="Proyek" subtitle="Data proyek deployment & manage service"
        actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Proyek</Button>} />

      <DataTable
        loading={loading}
        searchKeys={['project_code', 'project_name']}
        exportName="proyek"
        onRowClick={(r) => { setDrawerRow(r); setTab('ringkasan') }}
        emptyTitle="Belum ada proyek"
        emptyMessage="Tambahkan proyek pertama untuk mulai mengelola deployment."
        emptyAction={writable && <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Tambah Proyek</Button>}
        columns={[
          { key: 'project_code', header: 'Kode', width: '110px' },
          { key: 'project_name', header: 'Nama Proyek' },
          { key: 'customer_id', header: 'Pelanggan', render: (r) => custName(r.customer_id) },
          { key: 'project_type', header: 'Jenis', render: (r) => PROJECT_TYPES.find(t => t.value === r.project_type)?.label ?? '-' },
          { key: 'branch_id', header: 'Cabang', render: (r) => branchName(r.branch_id) },
          { key: 'contract_value', header: 'Nilai Kontrak', align: 'right', render: (r) => rupiah(r.contract_value, true) },
          { key: 'progress_percent', header: 'Progres', width: '140px', render: (r) => (
            <div className="flex items-center gap-2"><Progress value={Number(r.progress_percent ?? 0)} tone={Number(r.progress_percent ?? 0) >= 100 ? 'success' : 'primary'} />
              <span className="text-caption tabular w-9 text-right">{pct(r.progress_percent, 0)}</span></div>) },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'pm_id', header: 'PM', render: (r) => empName(r.pm_id) },
        ]}
        rows={rows}
      />

      {/* ---- Form Tambah/Ubah ---- */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} size="lg"
        title={editing ? 'Ubah Proyek' : 'Tambah Proyek'}
        footer={<><Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
          <Button loading={saving} onClick={saveForm}>Simpan</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Kode Proyek"><Input value={form.project_code ?? ''} readOnly disabled /></Field>
          <Field label="Nama Proyek" required><Input value={form.project_name ?? ''} onChange={e => setForm({ ...form, project_name: e.target.value })} /></Field>
          <Field label="Pelanggan" required><Select options={customers.map(c => ({ value: c.id, label: c.name }))} value={form.customer_id ?? ''} onChange={(e: any) => setForm({ ...form, customer_id: e.target.value })} /></Field>
          <Field label="Jenis Proyek"><Select options={PROJECT_TYPES} value={form.project_type ?? ''} onChange={(e: any) => setForm({ ...form, project_type: e.target.value })} /></Field>
          <Field label="Cabang"><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={form.branch_id ?? ''} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value })} /></Field>
          <Field label="Lokasi"><Input value={form.location ?? ''} onChange={e => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="Tanggal Mulai"><Input type="date" value={form.start_date ?? ''} onChange={e => setForm({ ...form, start_date: e.target.value })} /></Field>
          <Field label="Target Selesai"><Input type="date" value={form.target_date ?? ''} onChange={e => setForm({ ...form, target_date: e.target.value })} /></Field>
          <Field label="Tanggal Selesai Aktual" hint="Isi bila proyek sudah selesai"><Input type="date" value={form.actual_finish_date ?? ''} onChange={e => setForm({ ...form, actual_finish_date: e.target.value })} /></Field>
          <Field label="Nilai Kontrak"><Money value={form.contract_value} onChange={(v: number) => setForm({ ...form, contract_value: v })} /></Field>
          <Field label="Anggaran Biaya"><Money value={form.budget_cost} onChange={(v: number) => setForm({ ...form, budget_cost: v })} /></Field>
          <Field label="Progres (%)"><Input type="number" min={0} max={100} value={form.progress_percent ?? 0} onChange={e => setForm({ ...form, progress_percent: e.target.value })} /></Field>
          <Field label="Status"><Select options={PROJECT_STATUS} value={form.status ?? ''} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>
          <Field label="Project Manager"><Select options={employees.map(e => ({ value: e.id, label: e.position ? `${e.full_name} — ${e.position}` : e.full_name }))} value={form.pm_id ?? ''} onChange={(e: any) => setForm({ ...form, pm_id: e.target.value })} /></Field>
          <Field label="Catatan" className="sm:col-span-2"><Input value={form.note ?? ''} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* ---- Drawer Detail ---- */}
      <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} width="max-w-3xl"
        title={drawerRow ? projectLabel(drawerRow) : ''}
        footer={drawerRow && <>
          {can('DEPLOYMENT', 'approve') && <Button variant="danger" onClick={() => setDelRow(drawerRow)}>Hapus</Button>}
          {writable && <Button onClick={() => openEdit(drawerRow)}>Ubah Proyek</Button>}
        </>}>
        {drawerRow && (
          <div>
            <Tabs value={tab} onChange={setTab} className="mb-4"
              tabs={[{ value: 'ringkasan', label: 'Ringkasan' }, { value: 'milestone', label: 'Milestone' }, { value: 'boq', label: 'BoQ' }, { value: 'progres', label: 'Progres' }, { value: 'dokumen', label: 'Dokumen' }, { value: 'qc', label: 'QC' }]} />
            {tab === 'ringkasan' && <RingkasanTab row={drawerRow} custName={custName} branchName={branchName} empName={empName} />}
            {tab === 'milestone' && <MilestoneTab project={drawerRow} companyId={profile!.company_id} userId={profile!.id} writable={writable} />}
            {tab === 'boq' && <BoqTab project={drawerRow} onOpenFull={() => nav('/deploy/boq', { state: { projectId: drawerRow.id } })} />}
            {tab === 'progres' && <ProgresTab project={drawerRow} onOpenFull={() => nav('/deploy/progres', { state: { projectId: drawerRow.id } })} />}
            {tab === 'dokumen' && <DokumenTab project={drawerRow} onOpenFull={() => nav('/deploy/dokumen', { state: { projectId: drawerRow.id } })} />}
            {tab === 'qc' && <QcTab project={drawerRow} onOpenFull={() => nav('/deploy/qc', { state: { projectId: drawerRow.id } })} />}
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={!!delRow} onClose={() => setDelRow(null)} onConfirm={doDelete} danger
        title="Hapus Proyek" message={`Hapus proyek "${delRow?.project_name}"? Tindakan ini tidak dapat dibatalkan.`} />
    </div>
  )
}

/* ============ Tab: Ringkasan ============ */
function RingkasanTab({ row, custName, branchName, empName }: any) {
  return (
    <div>
      <Section title="Informasi Umum">
        <Desc items={[
          { label: 'Kode Proyek', value: row.project_code },
          { label: 'Pelanggan', value: custName(row.customer_id) },
          { label: 'Jenis', value: PROJECT_TYPES.find(t => t.value === row.project_type)?.label },
          { label: 'Cabang', value: branchName(row.branch_id) },
          { label: 'Lokasi', value: row.location },
          { label: 'PM', value: empName(row.pm_id) },
          { label: 'Periode', value: `${tgl(row.start_date)} — ${tgl(row.target_date)}` },
          { label: 'Selesai Aktual', value: tgl(row.actual_finish_date) },
          { label: 'Status', value: <Badge>{row.status}</Badge> },
        ]} />
      </Section>
      <Section title="Keuangan & Progres">
        <Desc items={[
          { label: 'Nilai Kontrak', value: rupiah(row.contract_value) },
          { label: 'Anggaran Biaya', value: rupiah(row.budget_cost) },
          { label: 'Progres', value: `${pct(row.progress_percent, 0)}` },
        ]} />
        <div className="mt-3"><Progress value={Number(row.progress_percent ?? 0)} /></div>
      </Section>
      {row.note && <Section title="Catatan"><p className="text-body text-ink-700 dark:text-ink-200">{row.note}</p></Section>}
    </div>
  )
}

/* ============ Tab: Milestone ============ */
function MilestoneTab({ project, companyId, userId, writable }: any) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [delRow, setDelRow] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try { setRows(await list('project_milestones', { eq: { project_id: project.id }, order: { col: 'seq', asc: true } })) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [project.id])

  const totalBobot = useMemo(() => rows.reduce((s, r) => s + Number(r.weight_percent ?? 0), 0), [rows])

  const openAdd = () => { setEditing(null); setForm({ seq: rows.length + 1, weight_percent: 0, status: 'belum_mulai' }); setOpen(true) }
  const openEdit = (r: any) => { setEditing(r); setForm({ ...r }); setOpen(true) }
  const save = async () => {
    if (!form.milestone_name) { toast.push('Nama milestone wajib diisi', 'error'); return }
    const others = rows.filter(r => r.id !== editing?.id).reduce((s, r) => s + Number(r.weight_percent ?? 0), 0)
    const total = others + Number(form.weight_percent ?? 0)
    if (total > 100.001) { toast.push(`Total bobot milestone akan menjadi ${num(total, 1)}% (melebihi 100%). Sesuaikan bobot terlebih dahulu.`, 'error'); return }
    setSaving(true)
    try {
      const payload = {
        company_id: companyId, project_id: project.id, seq: Number(form.seq ?? 1),
        milestone_name: form.milestone_name, weight_percent: Number(form.weight_percent ?? 0),
        plan_start: form.plan_start || null, plan_end: form.plan_end || null,
        actual_start: form.actual_start || null, actual_end: form.actual_end || null,
        progress_percent: Number(form.progress_percent ?? 0), status: form.status || 'belum_mulai',
        note: form.note || null,
      }
      if (editing) setRows(rs => rs.map(r => r.id === editing.id ? { ...r, ...payload, id: editing.id } : r).sort((a, b) => a.seq - b.seq))
      else setRows(rs => [...rs, { id: 'tmp', ...payload }])
      if (editing) await update('project_milestones', editing.id, payload)
      else { const created = await insert('project_milestones', { ...payload, created_by: userId }); setRows(rs => rs.map(r => r.id === 'tmp' ? created : r)) }
      toast.push('Milestone disimpan')
      setOpen(false)
      load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan milestone', 'error'); load() }
    finally { setSaving(false) }
  }
  const doDelete = async () => {
    if (!delRow) return
    try { await remove('project_milestones', delRow.id); setRows(rs => rs.filter(r => r.id !== delRow.id)); toast.push('Milestone dihapus') }
    catch (e: any) { toast.push(e.message ?? 'Gagal menghapus', 'error') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Badge tone={Math.abs(totalBobot - 100) < 0.01 ? 'emerald' : 'red'}>Total Bobot: {num(totalBobot, 1)}%</Badge>
        {writable && <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Tambah Milestone</Button>}
      </div>
      <DataTable
        loading={loading} searchable={false}
        onRowClick={writable ? openEdit : undefined}
        emptyTitle="Belum ada milestone"
        columns={[
          { key: 'seq', header: '#', width: '40px' },
          { key: 'milestone_name', header: 'Milestone' },
          { key: 'weight_percent', header: 'Bobot', align: 'right', render: (r) => pct(r.weight_percent, 1) },
          { key: 'plan', header: 'Rencana', render: (r) => `${tgl(r.plan_start)} — ${tgl(r.plan_end)}` },
          { key: 'aktual', header: 'Aktual', render: (r) => `${tgl(r.actual_start)} — ${tgl(r.actual_end)}` },
          { key: 'progress_percent', header: 'Progres', align: 'right', render: (r) => pct(r.progress_percent, 0) },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          ...(writable ? [{ key: '_x', header: '', width: '40px', render: (r: any) => (
            <button onClick={(e) => { e.stopPropagation(); setDelRow(r) }} className="text-caption text-red-600 hover:underline">Hapus</button>) }] : []),
        ]}
        rows={rows}
      />
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Ubah Milestone' : 'Tambah Milestone'}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Urutan"><Input type="number" value={form.seq ?? 1} onChange={e => setForm({ ...form, seq: e.target.value })} /></Field>
          <Field label="Bobot (%)"><Input type="number" step="0.1" value={form.weight_percent ?? 0} onChange={e => setForm({ ...form, weight_percent: e.target.value })} /></Field>
          <Field label="Nama Milestone" className="sm:col-span-2" required><Input value={form.milestone_name ?? ''} onChange={e => setForm({ ...form, milestone_name: e.target.value })} /></Field>
          <Field label="Rencana Mulai"><Input type="date" value={form.plan_start ?? ''} onChange={e => setForm({ ...form, plan_start: e.target.value })} /></Field>
          <Field label="Rencana Selesai"><Input type="date" value={form.plan_end ?? ''} onChange={e => setForm({ ...form, plan_end: e.target.value })} /></Field>
          <Field label="Aktual Mulai"><Input type="date" value={form.actual_start ?? ''} onChange={e => setForm({ ...form, actual_start: e.target.value })} /></Field>
          <Field label="Aktual Selesai"><Input type="date" value={form.actual_end ?? ''} onChange={e => setForm({ ...form, actual_end: e.target.value })} /></Field>
          <Field label="Progres (%)"><Input type="number" value={form.progress_percent ?? 0} onChange={e => setForm({ ...form, progress_percent: e.target.value })} /></Field>
          <Field label="Status"><Select options={MILESTONE_STATUS} value={form.status ?? ''} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>
          <Field label="Catatan" className="sm:col-span-2"><Input value={form.note ?? ''} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
        </div>
      </Modal>
      <ConfirmDialog open={!!delRow} onClose={() => setDelRow(null)} onConfirm={doDelete} danger title="Hapus Milestone" message={`Hapus milestone "${delRow?.milestone_name}"?`} />
    </div>
  )
}

/* ============ Tab: BoQ (ringkasan) ============ */
function BoqTab({ project, onOpenFull }: any) {
  const [loading, setLoading] = useState(true)
  const [sum, setSum] = useState<Record<string, number>>({ plan: 0, revisi: 0, actual: 0 })
  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const items = await list('boq_items', { eq: { project_id: project.id }, select: 'boq_type,amount' })
        const s: Record<string, number> = { plan: 0, revisi: 0, actual: 0 }
        items.forEach((i: any) => { s[i.boq_type] = (s[i.boq_type] ?? 0) + Number(i.amount ?? 0) })
        setSum(s)
      } finally { setLoading(false) }
    })()
  }, [project.id])
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-3"><p className="text-caption text-ink-500">Rencana</p><p className="font-display font-bold text-[18px]">{rupiah(sum.plan, true)}</p></Card>
        <Card className="p-3"><p className="text-caption text-ink-500">Revisi</p><p className="font-display font-bold text-[18px]">{rupiah(sum.revisi, true)}</p></Card>
        <Card className="p-3"><p className="text-caption text-ink-500">Realisasi</p><p className="font-display font-bold text-[18px]">{rupiah(sum.actual, true)}</p></Card>
      </div>
      {!loading && sum.plan === 0 && sum.revisi === 0 && sum.actual === 0 && <EmptyState title="Belum ada BoQ" message="Kelola BoQ lengkap pada modul BoQ Plan vs Actual." />}
      <Button variant="outline" onClick={onOpenFull}>Buka BoQ Lengkap →</Button>
    </div>
  )
}

/* ============ Tab: Progres (ringkasan) ============ */
function ProgresTab({ project, onOpenFull }: any) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    (async () => { setLoading(true); try { setRows(await list('progress_reports', { eq: { project_id: project.id }, order: { col: 'report_date', asc: false }, limit: 8 })) } finally { setLoading(false) } })()
  }, [project.id])
  return (
    <div>
      <DataTable loading={loading} searchable={false} emptyTitle="Belum ada laporan progres"
        columns={[
          { key: 'report_date', header: 'Tanggal', render: (r) => tgl(r.report_date) },
          { key: 'week_no', header: 'Minggu' },
          { key: 'plan_percent', header: 'Rencana', align: 'right', render: (r) => pct(r.plan_percent, 0) },
          { key: 'actual_percent', header: 'Realisasi', align: 'right', render: (r) => pct(r.actual_percent, 0) },
          { key: 'deviation', header: 'Deviasi', align: 'right', render: (r) => pct(r.deviation, 1) },
        ]}
        rows={rows} />
      <div className="mt-3"><Button variant="outline" onClick={onOpenFull}>Buka Progres & Kurva S →</Button></div>
    </div>
  )
}

/* ============ Tab: Dokumen (ringkasan) ============ */
function DokumenTab({ project, onOpenFull }: any) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    (async () => { setLoading(true); try { setRows(await list('documents', { eq: { project_id: project.id }, order: { col: 'created_at', asc: false }, limit: 10 })) } finally { setLoading(false) } })()
  }, [project.id])
  return (
    <div>
      <DataTable loading={loading} searchable={false} emptyTitle="Belum ada dokumen"
        columns={[
          { key: 'doc_type', header: 'Jenis' },
          { key: 'title', header: 'Judul' },
          { key: 'version', header: 'Versi', align: 'right' },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
        rows={rows} />
      <div className="mt-3"><Button variant="outline" onClick={onOpenFull}>Buka Dokumen & ABD →</Button></div>
    </div>
  )
}

/* ============ Tab: QC (ringkasan) ============ */
function QcTab({ project, onOpenFull }: any) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    (async () => { setLoading(true); try { setRows(await list('qc_records', { eq: { project_id: project.id }, order: { col: 'qc_date', asc: false }, limit: 200 })) } finally { setLoading(false) } })()
  }, [project.id])
  const lulus = rows.filter(r => r.result === 'lulus').length
  const rate = rows.length ? (lulus / rows.length) * 100 : null
  return (
    <div>
      <Card className="p-3 mb-4"><p className="text-caption text-ink-500">Tingkat Kelulusan QC</p>
        <p className="font-display font-bold text-[22px]">{rate == null ? '-' : pct(rate, 1)}</p>
        <p className="text-caption text-ink-400">{lulus} lulus dari {rows.length} titik ukur</p></Card>
      <DataTable loading={loading} searchable={false} emptyTitle="Belum ada data QC"
        columns={[
          { key: 'qc_date', header: 'Tanggal', render: (r) => tgl(r.qc_date) },
          { key: 'qc_type', header: 'Jenis' },
          { key: 'measured_value', header: 'Nilai Terukur', align: 'right' },
          { key: 'threshold_value', header: 'Ambang', align: 'right' },
          { key: 'result', header: 'Hasil', render: (r) => <Badge>{r.result}</Badge> },
        ]}
        rows={rows.slice(0, 10)} />
      <div className="mt-3"><Button variant="outline" onClick={onOpenFull}>Buka Quality Control →</Button></div>
    </div>
  )
}
