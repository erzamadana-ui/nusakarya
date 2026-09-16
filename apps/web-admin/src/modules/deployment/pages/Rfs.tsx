import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo, getOne } from '@/lib/db'
import {
  PageHeader, Card, CardHeader, DataTable, Drawer, Modal, ConfirmDialog, Field, Input, Textarea, Select,
  Button, Badge, Desc, Section, Stepper, useToast, Plus, EmptyState, FilterBar,
} from '@/components/ui'
import { tgl, tglJam, num } from '@/lib/format'
import { RFS_STEPS, rfsStepIndex, projectLabel } from '../lib/shared'
import { CheckCircle2, XCircle } from 'lucide-react'

export default function Rfs() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const loc = useLocation() as any
  const writable = can('DEPLOYMENT', 'write')
  const approver = can('DEPLOYMENT', 'approve')

  const [projects, setProjects] = useState<any[]>([])
  const [filterProject, setFilterProject] = useState<string>(loc?.state?.projectId ?? '')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [bastRows, setBastRows] = useState<any[]>([])

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [checklist, setChecklist] = useState<any[] | null>(null)
  const [checking, setChecking] = useState(false)

  const [drawerRow, setDrawerRow] = useState<any>(null)
  const [delRow, setDelRow] = useState<any>(null)

  const load = async () => {
    if (!profile?.company_id) return
    setLoading(true)
    try {
      const [r, p] = await Promise.all([
        list('rfs_records', { order: { col: 'created_at', asc: false }, limit: 1000 }),
        list('projects', { select: 'id,project_code,project_name,progress_percent', order: { col: 'project_code', asc: true } }),
      ])
      setRows(r); setProjects(p)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data', 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [profile?.company_id])

  useEffect(() => {
    (async () => {
      if (!filterProject) { setBastRows([]); return }
      try { setBastRows(await list('bast', { eq: { project_id: filterProject }, order: { col: 'bast_date', asc: false } })) } catch { setBastRows([]) }
    })()
  }, [filterProject])

  const projName = (id?: string) => { const p = projects.find(x => x.id === id); return p ? projectLabel(p) : '-' }
  const scoped = useMemo(() => filterProject ? rows.filter(r => r.project_id === filterProject) : rows, [rows, filterProject])

  const runChecklist = async (projectId: string) => {
    if (!projectId) { setChecklist(null); return }
    setChecking(true)
    try {
      const [proj, qc, boqActual, bast, abd] = await Promise.all([
        getOne('projects', projectId, 'progress_percent'),
        list('qc_records', { eq: { project_id: projectId }, select: 'result' }),
        list('boq_items', { eq: { project_id: projectId, boq_type: 'actual' }, select: 'id', limit: 1 }),
        list('bast', { eq: { project_id: projectId }, select: 'id', limit: 1 }),
        list('documents', { eq: { project_id: projectId, doc_type: 'ABD', status: 'approved' }, select: 'id', limit: 1 }),
      ])
      const progress100 = Number((proj as any)?.progress_percent ?? 0) >= 100
      const qcAllPass = qc.length > 0 && qc.every((q: any) => q.result === 'lulus')
      const items = [
        { key: 'progress', label: 'Progres proyek 100%', ok: progress100 },
        { key: 'qc', label: `Seluruh QC lulus (${qc.filter((q: any) => q.result === 'lulus').length}/${qc.length} lulus)`, ok: qcAllPass },
        { key: 'boq', label: 'BoQ realisasi sudah terisi', ok: boqActual.length > 0 },
        { key: 'bast', label: 'BAST tersedia', ok: bast.length > 0 },
        { key: 'abd', label: 'Dokumen ABD berstatus disetujui', ok: abd.length > 0 },
      ]
      setChecklist(items)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memeriksa kesiapan RFS', 'error'); setChecklist(null) }
    finally { setChecking(false) }
  }

  const openAdd = async () => {
    let no = ''
    try { no = await nextDocNo(profile!.company_id, 'RFS') } catch {}
    setEditing(null)
    const pid = filterProject || ''
    setForm({ rfs_no: no, rfs_date: new Date().toISOString().slice(0, 10), status: 'draft', project_id: pid })
    setChecklist(null)
    if (pid) runChecklist(pid)
    setOpen(true)
  }
  const openEdit = (r: any) => { setEditing(r); setForm({ ...r }); setChecklist(null); if (r.project_id) runChecklist(r.project_id); setOpen(true) }

  const allOk = checklist ? checklist.every(c => c.ok) : false

  const save = async () => {
    if (!form.project_id) { toast.push('Proyek wajib dipilih', 'error'); return }
    if (form.status === 'diajukan' && !allOk) {
      const missing = (checklist ?? []).filter(c => !c.ok).map(c => c.label)
      toast.push(`RFS belum dapat diajukan. Belum terpenuhi: ${missing.join('; ')}`, 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        company_id: profile!.company_id, rfs_no: form.rfs_no, project_id: form.project_id, rfs_date: form.rfs_date || null,
        scope: form.scope || null, capacity: form.capacity === '' ? null : Number(form.capacity), status: form.status || 'draft', note: form.note || null,
      }
      if (editing) { const upd = await update('rfs_records', editing.id, payload); setRows(rs => rs.map(r => r.id === upd.id ? upd : r)); toast.push('RFS diperbarui') }
      else { const created = await insert('rfs_records', { ...payload, created_by: profile!.id }); setRows(rs => [created, ...rs]); toast.push('RFS ditambahkan') }
      setOpen(false)
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan', 'error') }
    finally { setSaving(false) }
  }
  const doDelete = async () => {
    if (!delRow) return
    try { await remove('rfs_records', delRow.id); setRows(rs => rs.filter(r => r.id !== delRow.id)); if (drawerRow?.id === delRow.id) setDrawerRow(null); toast.push('RFS dihapus') }
    catch (e: any) { toast.push(e.message ?? 'Gagal menghapus', 'error') }
  }
  const putuskan = async (row: any, approve: boolean) => {
    try {
      const upd = await update('rfs_records', row.id, { status: approve ? 'disetujui' : 'ditolak', approved_by: profile!.id, approved_at: new Date().toISOString() })
      setRows(rs => rs.map(r => r.id === upd.id ? upd : r)); setDrawerRow(upd)
      toast.push(approve ? 'RFS disetujui' : 'RFS ditolak')
    } catch (e: any) { toast.push(e.message ?? 'Gagal memperbarui status', 'error') }
  }

  return (
    <div>
      <PageHeader title="BAST & RFS" subtitle="Ready for Service dan daftar BAST proyek"
        actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah RFS</Button>} />

      <FilterBar>
        <Field label="Proyek" className="min-w-[260px]">
          <Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} placeholder="Semua Proyek" value={filterProject} onChange={(e: any) => setFilterProject(e.target.value)} />
        </Field>
      </FilterBar>

      {filterProject && (
        <Card className="mb-4">
          <CardHeader title="BAST Terkait Proyek" subtitle="Data baca saja — pembuatan BAST dilakukan pada modul Commerce" />
          {bastRows.length === 0 ? <EmptyState title="Belum ada BAST" message="BAST untuk proyek ini belum dibuat pada modul Commerce." /> : (
            <DataTable searchable={false}
              columns={[
                { key: 'bast_no', header: 'Nomor BAST' },
                { key: 'bast_date', header: 'Tanggal', render: (r) => tgl(r.bast_date) },
                { key: 'title', header: 'Judul' },
                { key: 'signed_by_customer', header: 'Ditandatangani', render: (r) => r.signed_by_customer ? <Badge tone="emerald">ya</Badge> : <Badge tone="amber">belum</Badge> },
                { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              ]}
              rows={bastRows} />)}
        </Card>
      )}

      <Card>
        <CardHeader title="Daftar RFS" />
        <DataTable
          loading={loading} searchKeys={['rfs_no', 'scope']} exportName="rfs"
          onRowClick={(r) => setDrawerRow(r)}
          emptyTitle="Belum ada RFS"
          emptyAction={writable && <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Tambah RFS</Button>}
          columns={[
            { key: 'rfs_no', header: 'Nomor', width: '120px' },
            { key: 'project_id', header: 'Proyek', render: (r) => projName(r.project_id) },
            { key: 'rfs_date', header: 'Tanggal', render: (r) => tgl(r.rfs_date) },
            { key: 'scope', header: 'Lingkup' },
            { key: 'capacity', header: 'Kapasitas', align: 'right', render: (r) => num(r.capacity) },
            { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          ]}
          rows={scoped}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editing ? 'Ubah RFS' : 'Tambah RFS'}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nomor RFS"><Input value={form.rfs_no ?? ''} readOnly disabled /></Field>
          <Field label="Proyek" required><Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} value={form.project_id ?? ''} onChange={(e: any) => { setForm({ ...form, project_id: e.target.value }); runChecklist(e.target.value) }} /></Field>
          <Field label="Tanggal"><Input type="date" value={form.rfs_date ?? ''} onChange={e => setForm({ ...form, rfs_date: e.target.value })} /></Field>
          <Field label="Kapasitas"><Input type="number" value={form.capacity ?? ''} onChange={e => setForm({ ...form, capacity: e.target.value })} /></Field>
          <Field label="Lingkup" className="sm:col-span-2"><Textarea value={form.scope ?? ''} onChange={e => setForm({ ...form, scope: e.target.value })} /></Field>
          <Field label="Status" className="sm:col-span-2" hint={form.status === 'diajukan' && checklist && !allOk ? 'Kesiapan belum terpenuhi — lihat checklist di bawah.' : undefined}>
            <Select options={['draft', 'diajukan']} value={form.status ?? 'draft'} onChange={(e: any) => setForm({ ...form, status: e.target.value })} />
          </Field>
          <Field label="Catatan" className="sm:col-span-2"><Input value={form.note ?? ''} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
        </div>
        {form.project_id && (
          <Section title="Checklist Kesiapan RFS" className="mt-5">
            {checking ? <p className="text-caption text-ink-400">Memeriksa kesiapan…</p> : !checklist ? null : (
              <div className="space-y-2">
                {checklist.map(c => (
                  <div key={c.key} className="flex items-center gap-2 text-body">
                    {c.ok ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <XCircle size={16} className="text-red-600 shrink-0" />}
                    <span className={c.ok ? 'text-ink-700 dark:text-ink-200' : 'text-red-600 dark:text-red-400'}>{c.label}</span>
                  </div>))}
                {!allOk && <p className="text-caption text-red-600 mt-2">Pengajuan RFS (status "Diajukan") akan diblokir sampai seluruh butir terpenuhi. Anda tetap dapat menyimpan sebagai Draft.</p>}
              </div>)}
          </Section>
        )}
      </Modal>

      <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} title={drawerRow ? `RFS ${drawerRow.rfs_no}` : ''}
        footer={drawerRow && <>
          {can('DEPLOYMENT', 'approve') && drawerRow.status !== 'disetujui' && drawerRow.status !== 'ditolak' && <Button variant="danger" onClick={() => setDelRow(drawerRow)}>Hapus</Button>}
          {writable && drawerRow.status === 'draft' && <Button variant="outline" onClick={() => openEdit(drawerRow)}>Ubah</Button>}
          {approver && drawerRow.status === 'diajukan' && <><Button variant="danger" onClick={() => putuskan(drawerRow, false)}>Tolak</Button><Button variant="success" onClick={() => putuskan(drawerRow, true)}>Setujui</Button></>}
        </>}>
        {drawerRow && (
          <div>
            <Stepper steps={RFS_STEPS} current={rfsStepIndex(drawerRow.status)} />
            <Section title="Informasi" className="mt-4">
              <Desc items={[
                { label: 'Proyek', value: projName(drawerRow.project_id) },
                { label: 'Tanggal', value: tgl(drawerRow.rfs_date) },
                { label: 'Kapasitas', value: num(drawerRow.capacity) },
                { label: 'Status', value: <Badge>{drawerRow.status}</Badge> },
                { label: 'Disetujui Pada', value: drawerRow.approved_at ? tglJam(drawerRow.approved_at) : '-' },
              ]} />
            </Section>
            {drawerRow.scope && <Section title="Lingkup"><p className="text-body whitespace-pre-line">{drawerRow.scope}</p></Section>}
            {drawerRow.note && <Section title="Catatan"><p className="text-body whitespace-pre-line">{drawerRow.note}</p></Section>}
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={!!delRow} onClose={() => setDelRow(null)} onConfirm={doDelete} danger title="Hapus RFS" message={`Hapus RFS "${delRow?.rfs_no}"?`} />
    </div>
  )
}
