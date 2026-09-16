import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo, uploadFile, signedUrl } from '@/lib/db'
import {
  PageHeader, Card, CardHeader, DataTable, Drawer, Modal, ConfirmDialog, Field, Input, Textarea, Select, Money,
  Button, Badge, Desc, Section, Stepper, useToast, Plus, EmptyState, FilterBar, KpiCard,
} from '@/components/ui'
import { tgl, rupiah, num } from '@/lib/format'
import {
  PERMIT_TYPES, PERMIT_STATUS, PERMIT_STEPS, permitStepIndex, permitTypeLabel, daysToExpiry,
  projectLabel, fetchProjectsAndEmployees,
} from '../lib/shared'
import { AlertTriangle, ShieldAlert, FileText } from 'lucide-react'

export default function Perizinan() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const writable = can('DEPLOYMENT', 'write')
  const approver = can('DEPLOYMENT', 'approve')

  const [projects, setProjects] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [filterProject, setFilterProject] = useState('')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const [drawerRow, setDrawerRow] = useState<any>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [delRow, setDelRow] = useState<any>(null)

  const load = async () => {
    if (!profile?.company_id) return
    setLoading(true)
    try {
      const [p, extra] = await Promise.all([
        list('permits', { order: { col: 'created_at', asc: false }, limit: 2000 }),
        fetchProjectsAndEmployees(),
      ])
      setRows(p); setProjects(extra.projects); setEmployees(extra.employees)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data perizinan', 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [profile?.company_id])

  const projName = (id?: string) => { const p = projects.find(x => x.id === id); return p ? projectLabel(p) : '-' }
  const empName = (id?: string) => employees.find(e => e.id === id)?.full_name ?? '-'
  const scoped = useMemo(() => filterProject ? rows.filter(r => r.project_id === filterProject) : rows, [rows, filterProject])

  const kpi = useMemo(() => {
    const now = new Date()
    const dalamProses = rows.filter(r => r.status === 'proses').length
    const terbitBulanIni = rows.filter(r => r.status === 'terbit' && r.issued_date && new Date(r.issued_date).getMonth() === now.getMonth() && new Date(r.issued_date).getFullYear() === now.getFullYear()).length
    const totalBiaya = rows.reduce((s, r) => s + Number(r.cost || 0), 0)
    return { dalamProses, terbitBulanIni, totalBiaya }
  }, [rows])

  /** Izin yang mendekati/sudah kedaluwarsa — hanya yang berstatus terbit relevan untuk diwaspadai. */
  const expiryWarnings = useMemo(() => rows
    .filter(r => r.status === 'terbit' && r.expiry_date)
    .map(r => ({ ...r, sisaHari: daysToExpiry(r.expiry_date) }))
    .filter(r => r.sisaHari != null && r.sisaHari < 30)
    .sort((a, b) => (a.sisaHari ?? 0) - (b.sisaHari ?? 0)), [rows])

  /** Proyek berstatus pelaksanaan tanpa satu pun izin berstatus terbit — sering menghentikan pekerjaan lapangan. */
  const blockingProjects = useMemo(() => {
    const pelaksanaan = projects.filter(p => p.status === 'pelaksanaan')
    return pelaksanaan.map(p => {
      const permitsForProject = rows.filter(r => r.project_id === p.id)
      const adaTerbit = permitsForProject.some(r => r.status === 'terbit')
      return { project: p, permitsForProject, adaTerbit }
    }).filter(x => !x.adaTerbit)
  }, [projects, rows])

  const openAdd = async () => {
    let no = ''
    try { no = await nextDocNo(profile!.company_id, 'IZN') } catch {}
    setEditing(null); setFile(null)
    setForm({ permit_no: no, project_id: filterProject || '', permit_type: 'row', status: 'disiapkan', applied_date: '', cost: 0 })
    setOpen(true)
  }
  const openEdit = (r: any) => { setEditing(r); setFile(null); setForm({ ...r }); setOpen(true) }

  const save = async () => {
    if (!form.project_id) { toast.push('Proyek wajib dipilih', 'error'); return }
    if (!form.permit_type) { toast.push('Jenis izin wajib dipilih', 'error'); return }
    setSaving(true)
    try {
      let fileUrlPath = form.file_url ?? null
      if (file) fileUrlPath = await uploadFile(profile!.company_id, 'permits', file)
      const payload = {
        company_id: profile!.company_id, project_id: form.project_id, permit_type: form.permit_type,
        authority_name: form.authority_name || null, applied_date: form.applied_date || null, issued_date: form.issued_date || null,
        expiry_date: form.expiry_date || null, cost: form.cost === '' ? 0 : Number(form.cost || 0), pic_id: form.pic_id || null,
        status: form.status || 'disiapkan', note: form.note || null, file_url: fileUrlPath, permit_no: form.permit_no,
      }
      if (editing) { await update('permits', editing.id, payload); toast.push('Izin diperbarui') }
      else { await insert('permits', { ...payload, created_by: profile!.id }); toast.push('Izin ditambahkan') }
      setOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan izin', 'error') }
    finally { setSaving(false) }
  }
  const doDelete = async () => {
    if (!delRow) return
    try { await remove('permits', delRow.id); toast.push('Izin dihapus'); if (drawerRow?.id === delRow.id) setDrawerRow(null); load() }
    catch (e: any) { toast.push(e.message ?? 'Gagal menghapus izin', 'error') }
  }
  const openDrawer = async (row: any) => { setDrawerRow(row); setFileUrl(row.file_url ? await signedUrl(row.file_url) : null) }

  const expiryBadge = (r: any) => {
    const d = daysToExpiry(r.expiry_date)
    if (d == null) return '-'
    if (d < 0) return <Badge tone="red">kedaluwarsa {Math.abs(d)} hari lalu</Badge>
    if (d < 30) return <Badge tone="orange">{d} hari lagi</Badge>
    return <span className="text-ink-500">{tgl(r.expiry_date)}</span>
  }

  return (
    <div>
      <PageHeader title="Perizinan & RoW" subtitle="Izin RoW, galian, pemda, kawasan, ketinggian & lingkungan per proyek"
        actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Izin</Button>} />

      <FilterBar>
        <Field label="Proyek" className="min-w-[260px]">
          <Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} placeholder="Semua Proyek" value={filterProject} onChange={(e: any) => setFilterProject(e.target.value)} />
        </Field>
      </FilterBar>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="Izin Dalam Proses" value={num(kpi.dalamProses)} tone={kpi.dalamProses > 0 ? 'amber' : 'teal'} />
        <KpiCard label="Izin Terbit Bulan Ini" value={num(kpi.terbitBulanIni)} tone="emerald" />
        <KpiCard label="Total Biaya Perizinan" value={rupiah(kpi.totalBiaya, true)} tone="teal" />
      </div>

      {blockingProjects.length > 0 && (
        <Card className="mb-4 border border-red-200 dark:border-red-900">
          <CardHeader title={<span className="inline-flex items-center gap-2 text-red-700 dark:text-red-300"><ShieldAlert size={16} /> Izin yang Memblokir Proyek</span>}
            subtitle="Proyek berstatus pelaksanaan yang belum memiliki satu pun izin terbit — berisiko menghentikan pekerjaan di lapangan" />
          <DataTable searchable={false}
            columns={[
              { key: 'project', header: 'Proyek', render: (r: any) => projectLabel(r.project) },
              { key: 'jumlah', header: 'Izin Tercatat', align: 'right', render: (r: any) => num(r.permitsForProject.length) },
              { key: 'status_terjauh', header: 'Status Terjauh', render: (r: any) => {
                const order = ['disiapkan', 'diajukan', 'proses', 'ditolak']
                const terjauh = r.permitsForProject.slice().sort((a: any, b: any) => order.indexOf(b.status) - order.indexOf(a.status))[0]
                return terjauh ? <Badge>{terjauh.status}</Badge> : <Badge tone="red">belum ada izin diajukan</Badge>
              }},
            ]}
            rows={blockingProjects}
            onRowClick={(r: any) => setFilterProject(r.project.id)} />
        </Card>
      )}

      {expiryWarnings.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={<span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-300"><AlertTriangle size={16} /> Izin Mendekati / Sudah Kedaluwarsa</span>} />
          <DataTable searchable={false}
            columns={[
              { key: 'permit_no', header: 'Nomor' },
              { key: 'project_id', header: 'Proyek', render: (r: any) => projName(r.project_id) },
              { key: 'permit_type', header: 'Jenis', render: (r: any) => permitTypeLabel(r.permit_type) },
              { key: 'expiry_date', header: 'Kedaluwarsa', render: (r: any) => expiryBadge(r) },
            ]}
            rows={expiryWarnings}
            onRowClick={openDrawer} />
        </Card>
      )}

      <Card>
        <CardHeader title="Daftar Izin" />
        <DataTable
          loading={loading} searchKeys={['permit_no', 'authority_name']} exportName="perizinan"
          onRowClick={openDrawer}
          emptyTitle="Belum ada izin"
          emptyAction={writable && <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Tambah Izin</Button>}
          columns={[
            { key: 'permit_no', header: 'Nomor', width: '120px' },
            { key: 'project_id', header: 'Proyek', render: (r) => projName(r.project_id) },
            { key: 'permit_type', header: 'Jenis', render: (r) => permitTypeLabel(r.permit_type) },
            { key: 'authority_name', header: 'Instansi Penerbit' },
            { key: 'pic_id', header: 'PIC', render: (r) => empName(r.pic_id) },
            { key: 'cost', header: 'Biaya', align: 'right', render: (r) => rupiah(r.cost) },
            { key: 'expiry_date', header: 'Kedaluwarsa', render: (r) => expiryBadge(r) },
            { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          ]}
          rows={scoped}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editing ? 'Ubah Izin' : 'Tambah Izin'}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nomor Izin"><Input value={form.permit_no ?? ''} readOnly disabled /></Field>
          <Field label="Proyek" required><Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} value={form.project_id ?? ''} onChange={(e: any) => setForm({ ...form, project_id: e.target.value })} /></Field>
          <Field label="Jenis Izin" required><Select options={PERMIT_TYPES} value={form.permit_type ?? ''} onChange={(e: any) => setForm({ ...form, permit_type: e.target.value })} /></Field>
          <Field label="Instansi Penerbit"><Input value={form.authority_name ?? ''} onChange={e => setForm({ ...form, authority_name: e.target.value })} /></Field>
          <Field label="PIC"><Select options={employees.map(e => ({ value: e.id, label: e.full_name }))} value={form.pic_id ?? ''} onChange={(e: any) => setForm({ ...form, pic_id: e.target.value })} /></Field>
          <Field label="Biaya"><Money value={form.cost ?? 0} onChange={(v: number) => setForm({ ...form, cost: v })} /></Field>
          <Field label="Tanggal Ajukan"><Input type="date" value={form.applied_date ?? ''} onChange={e => setForm({ ...form, applied_date: e.target.value })} /></Field>
          <Field label="Tanggal Terbit"><Input type="date" value={form.issued_date ?? ''} onChange={e => setForm({ ...form, issued_date: e.target.value })} /></Field>
          <Field label="Tanggal Kedaluwarsa"><Input type="date" value={form.expiry_date ?? ''} onChange={e => setForm({ ...form, expiry_date: e.target.value })} /></Field>
          <Field label="Status">
            <Select options={PERMIT_STATUS} value={form.status ?? 'disiapkan'} onChange={(e: any) => setForm({ ...form, status: e.target.value })} />
          </Field>
          <Field label="Catatan" className="sm:col-span-2"><Textarea value={form.note ?? ''} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
          <Field label="Unggah Berkas Izin" className="sm:col-span-2">
            <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-body text-ink-600 dark:text-ink-300 file:mr-3 file:h-9 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
            {editing?.file_url && !file && <p className="text-caption text-ink-400 mt-1">Berkas sudah ada — unggah berkas baru untuk menggantinya.</p>}
          </Field>
        </div>
        <Section title="Status Proses Izin" className="mt-5">
          <Stepper steps={PERMIT_STEPS} current={permitStepIndex(form.status ?? 'disiapkan')} />
        </Section>
      </Modal>

      <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} title={drawerRow ? `Izin ${permitTypeLabel(drawerRow.permit_type)} — ${drawerRow.permit_no}` : ''}
        footer={drawerRow && <>
          {approver && <Button variant="danger" onClick={() => setDelRow(drawerRow)}>Hapus</Button>}
          {writable && <Button onClick={() => openEdit(drawerRow)}>Ubah</Button>}
        </>}>
        {drawerRow && (
          <div>
            <Stepper steps={PERMIT_STEPS} current={permitStepIndex(drawerRow.status)} />
            <Section title="Informasi Izin" className="mt-5">
              <Desc items={[
                { label: 'Proyek', value: projName(drawerRow.project_id) },
                { label: 'Jenis', value: permitTypeLabel(drawerRow.permit_type) },
                { label: 'Instansi Penerbit', value: drawerRow.authority_name },
                { label: 'PIC', value: empName(drawerRow.pic_id) },
                { label: 'Biaya', value: rupiah(drawerRow.cost) },
                { label: 'Tanggal Ajukan', value: tgl(drawerRow.applied_date) },
                { label: 'Tanggal Terbit', value: tgl(drawerRow.issued_date) },
                { label: 'Tanggal Kedaluwarsa', value: expiryBadge(drawerRow) },
                { label: 'Status', value: <Badge>{drawerRow.status}</Badge> },
              ]} />
            </Section>
            {drawerRow.note && <Section title="Catatan"><p className="text-body whitespace-pre-line">{drawerRow.note}</p></Section>}
            {fileUrl && <Section title="Berkas"><a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary-600 hover:underline"><FileText size={16} /> Buka berkas izin</a></Section>}
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={!!delRow} onClose={() => setDelRow(null)} onConfirm={doDelete} danger title="Hapus Izin" message="Hapus data izin ini? Tindakan tidak dapat dibatalkan." />
    </div>
  )
}
