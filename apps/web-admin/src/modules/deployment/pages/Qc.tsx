import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, uploadFile, signedUrl } from '@/lib/db'
import {
  PageHeader, Card, CardHeader, DataTable, Drawer, Modal, ConfirmDialog, Field, Input, Textarea, Select,
  Button, Badge, Desc, Section, useToast, Plus, EmptyState, FilterBar, KpiCard,
} from '@/components/ui'
import { pct, tgl, num } from '@/lib/format'
import { QC_TYPES, QC_RESULT, QC_DIRECTION, qcSuggestedResult, projectLabel } from '../lib/shared'
import { AlertTriangle, Image as ImageIcon } from 'lucide-react'

export default function Qc() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const loc = useLocation() as any
  const writable = can('DEPLOYMENT', 'write')

  const [projects, setProjects] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [filterProject, setFilterProject] = useState<string>(loc?.state?.projectId ?? '')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  const [drawerRow, setDrawerRow] = useState<any>(null)
  const [gallery, setGallery] = useState<string[]>([])
  const [delRow, setDelRow] = useState<any>(null)

  const load = async () => {
    if (!profile?.company_id) return
    setLoading(true)
    try {
      const [q, p, e] = await Promise.all([
        list('qc_records', { order: { col: 'qc_date', asc: false }, limit: 2000 }),
        list('projects', { select: 'id,project_code,project_name', order: { col: 'project_code', asc: true } }),
        list('employees', { select: 'id,full_name', order: { col: 'full_name', asc: true } }),
      ])
      setRows(q); setProjects(p); setEmployees(e)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data', 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [profile?.company_id])

  const projName = (id?: string) => { const p = projects.find(x => x.id === id); return p ? projectLabel(p) : '-' }
  const empName = (id?: string) => employees.find(e => e.id === id)?.full_name ?? '-'

  const scoped = useMemo(() => filterProject ? rows.filter(r => r.project_id === filterProject) : rows, [rows, filterProject])
  const failedPoints = useMemo(() => scoped.filter(r => r.result === 'tidak_lulus').sort((a, b) => b.qc_date.localeCompare(a.qc_date)), [scoped])

  const perProject = useMemo(() => {
    const map: Record<string, { total: number; lulus: number }> = {}
    for (const r of rows) {
      if (!map[r.project_id]) map[r.project_id] = { total: 0, lulus: 0 }
      map[r.project_id].total++
      if (r.result === 'lulus') map[r.project_id].lulus++
    }
    return Object.entries(map).map(([pid, v]) => ({ project_id: pid, ...v, rate: v.total ? (v.lulus / v.total) * 100 : 0 }))
      .sort((a, b) => a.rate - b.rate)
  }, [rows])

  const overallRate = scoped.length ? (scoped.filter(r => r.result === 'lulus').length / scoped.length) * 100 : null

  const openAdd = () => {
    setEditing(null); setFiles([])
    setForm({ project_id: filterProject || '', qc_date: new Date().toISOString().slice(0, 10), qc_type: 'OTDR' })
    setOpen(true)
  }
  const openEdit = (r: any) => { setEditing(r); setFiles([]); setForm({ ...r }); setOpen(true) }

  const suggestion = useMemo(() => qcSuggestedResult(form.qc_type, form.measured_value, form.threshold_value), [form.qc_type, form.measured_value, form.threshold_value])
  const direction = QC_DIRECTION[form.qc_type as string]

  const save = async () => {
    if (!form.project_id) { toast.push('Proyek wajib dipilih', 'error'); return }
    if (!form.result) { toast.push('Hasil pengukuran wajib dipilih/diperiksa inspektor', 'error'); return }
    setSaving(true)
    try {
      let photoUrls: string[] = Array.isArray(form.photo_urls) ? [...form.photo_urls] : []
      for (const f of files) { const path = await uploadFile(profile!.company_id, 'qc', f); photoUrls.push(path) }
      const payload = {
        company_id: profile!.company_id, project_id: form.project_id, qc_date: form.qc_date || null, qc_type: form.qc_type || null,
        measured_value: form.measured_value === '' ? null : Number(form.measured_value), threshold_value: form.threshold_value === '' ? null : Number(form.threshold_value),
        unit: form.unit || null, result: form.result, inspector_id: form.inspector_id || null, photo_urls: photoUrls, note: form.note || null,
      }
      if (editing) { await update('qc_records', editing.id, payload); toast.push('Data QC diperbarui') }
      else { await insert('qc_records', { ...payload, created_by: profile!.id }); toast.push('Data QC ditambahkan') }
      setOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan', 'error') }
    finally { setSaving(false) }
  }
  const doDelete = async () => {
    if (!delRow) return
    try { await remove('qc_records', delRow.id); toast.push('Data QC dihapus'); if (drawerRow?.id === delRow.id) setDrawerRow(null); load() }
    catch (e: any) { toast.push(e.message ?? 'Gagal menghapus', 'error') }
  }
  const openDrawer = async (row: any) => { setDrawerRow(row); setGallery((await Promise.all((row.photo_urls ?? []).map((p: string) => signedUrl(p)))).filter(Boolean) as string[]) }

  return (
    <div>
      <PageHeader title="Quality Control" subtitle="Pengukuran OTDR, OPM, Visual, Splicing & Instalasi"
        actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Data QC</Button>} />

      <FilterBar>
        <Field label="Proyek" className="min-w-[260px]">
          <Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} placeholder="Semua Proyek" value={filterProject} onChange={(e: any) => setFilterProject(e.target.value)} />
        </Field>
      </FilterBar>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="Tingkat Kelulusan QC" value={overallRate == null ? '-' : pct(overallRate, 1)} tone={overallRate != null && overallRate < 90 ? 'red' : 'emerald'} />
        <KpiCard label="Total Titik Ukur" value={num(scoped.length)} />
        <KpiCard label="Titik Tidak Lulus" value={num(failedPoints.length)} tone={failedPoints.length > 0 ? 'red' : 'emerald'} />
      </div>

      {!filterProject && (
        <Card className="mb-4">
          <CardHeader title="Tingkat Kelulusan QC per Proyek" />
          <DataTable searchable={false} emptyTitle="Belum ada data QC"
            columns={[
              { key: 'project_id', header: 'Proyek', render: (r) => projName(r.project_id) },
              { key: 'total', header: 'Total Titik', align: 'right' },
              { key: 'lulus', header: 'Lulus', align: 'right' },
              { key: 'rate', header: '% Lulus', align: 'right', render: (r) => <span className={r.rate < 90 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>{pct(r.rate, 1)}</span> },
            ]}
            rows={perProject} />
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader title="Titik Tidak Lulus" subtitle="Perlu tindak lanjut perbaikan" />
        {failedPoints.length === 0 ? <EmptyState icon={<AlertTriangle size={22} />} title="Tidak ada titik tidak lulus" /> : (
          <DataTable searchable={false}
            columns={[
              { key: 'qc_date', header: 'Tanggal', render: (r) => tgl(r.qc_date) },
              { key: 'project_id', header: 'Proyek', render: (r) => projName(r.project_id) },
              { key: 'qc_type', header: 'Jenis' },
              { key: 'measured_value', header: 'Nilai Terukur', align: 'right', render: (r) => `${num(r.measured_value, 2)} ${r.unit ?? ''}` },
              { key: 'threshold_value', header: 'Ambang', align: 'right', render: (r) => `${num(r.threshold_value, 2)} ${r.unit ?? ''}` },
            ]}
            rows={failedPoints}
            onRowClick={openDrawer} />)}
      </Card>

      <Card>
        <CardHeader title="Seluruh Data QC" />
        <DataTable
          loading={loading} searchKeys={['qc_no', 'qc_type']} exportName="qc_records"
          onRowClick={openDrawer}
          emptyTitle="Belum ada data QC"
          emptyAction={writable && <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Tambah Data QC</Button>}
          columns={[
            { key: 'qc_date', header: 'Tanggal', render: (r) => tgl(r.qc_date) },
            { key: 'project_id', header: 'Proyek', render: (r) => projName(r.project_id) },
            { key: 'qc_type', header: 'Jenis' },
            { key: 'measured_value', header: 'Nilai Terukur', align: 'right', render: (r) => `${num(r.measured_value, 2)} ${r.unit ?? ''}` },
            { key: 'threshold_value', header: 'Ambang', align: 'right', render: (r) => `${num(r.threshold_value, 2)} ${r.unit ?? ''}` },
            { key: 'result', header: 'Hasil', render: (r) => <Badge>{r.result}</Badge> },
            { key: 'inspector_id', header: 'Inspektor', render: (r) => empName(r.inspector_id) },
          ]}
          rows={scoped}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editing ? 'Ubah Data QC' : 'Tambah Data QC'}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Proyek" required><Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} value={form.project_id ?? ''} onChange={(e: any) => setForm({ ...form, project_id: e.target.value })} /></Field>
          <Field label="Tanggal"><Input type="date" value={form.qc_date ?? ''} onChange={e => setForm({ ...form, qc_date: e.target.value })} /></Field>
          <Field label="Jenis Pengukuran"><Select options={QC_TYPES} value={form.qc_type ?? ''} onChange={(e: any) => setForm({ ...form, qc_type: e.target.value, result: '' })} /></Field>
          <Field label="Inspektor"><Select options={employees.map(e => ({ value: e.id, label: e.full_name }))} value={form.inspector_id ?? ''} onChange={(e: any) => setForm({ ...form, inspector_id: e.target.value })} /></Field>
          <Field label="Nilai Terukur"><Input type="number" step="0.01" value={form.measured_value ?? ''} onChange={e => setForm({ ...form, measured_value: e.target.value })} /></Field>
          <Field label="Ambang Batas"><Input type="number" step="0.01" value={form.threshold_value ?? ''} onChange={e => setForm({ ...form, threshold_value: e.target.value })} /></Field>
          <Field label="Satuan"><Input value={form.unit ?? ''} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="dB, dBm, …" /></Field>
          <Field label="Hasil" required hint={!direction ? 'Tidak ada aturan arah otomatis untuk jenis ini — tentukan hasil secara manual.' : `Saran otomatis (arah: ${direction === 'max' ? 'terukur ≤ ambang' : 'terukur ≥ ambang'}): ${suggestion ? QC_RESULT.find(x => x.value === suggestion)?.label : '—'}. Inspektor tetap wajib memeriksa kembali sebelum menetapkan hasil.`}>
            <Select options={QC_RESULT} value={form.result ?? ''} onChange={(e: any) => setForm({ ...form, result: e.target.value })} />
          </Field>
          <Field label="Catatan" className="sm:col-span-2"><Textarea value={form.note ?? ''} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
          <Field label="Unggah Foto Hasil Ukur" className="sm:col-span-2">
            <input type="file" multiple accept="image/*" onChange={e => setFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-body text-ink-600 dark:text-ink-300 file:mr-3 file:h-9 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
          </Field>
        </div>
      </Modal>

      <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} title={drawerRow ? `QC ${drawerRow.qc_type} — ${tgl(drawerRow.qc_date)}` : ''}
        footer={drawerRow && <>
          {can('DEPLOYMENT', 'approve') && <Button variant="danger" onClick={() => setDelRow(drawerRow)}>Hapus</Button>}
          {writable && <Button onClick={() => openEdit(drawerRow)}>Ubah</Button>}
        </>}>
        {drawerRow && (
          <div>
            <Section title="Ringkasan">
              <Desc items={[
                { label: 'Proyek', value: projName(drawerRow.project_id) },
                { label: 'Jenis', value: drawerRow.qc_type },
                { label: 'Nilai Terukur', value: `${num(drawerRow.measured_value, 2)} ${drawerRow.unit ?? ''}` },
                { label: 'Ambang Batas', value: `${num(drawerRow.threshold_value, 2)} ${drawerRow.unit ?? ''}` },
                { label: 'Hasil', value: <Badge>{drawerRow.result}</Badge> },
                { label: 'Inspektor', value: empName(drawerRow.inspector_id) },
              ]} />
            </Section>
            {drawerRow.note && <Section title="Catatan"><p className="text-body whitespace-pre-line">{drawerRow.note}</p></Section>}
            <Section title="Foto Hasil Ukur">
              {gallery.length === 0 ? <EmptyState icon={<ImageIcon size={22} />} title="Belum ada foto" /> : (
                <div className="grid grid-cols-3 gap-2">{gallery.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="block aspect-square rounded-sm overflow-hidden border border-ink-200 dark:border-ink-800"><img src={u} className="w-full h-full object-cover" /></a>)}</div>)}
            </Section>
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={!!delRow} onClose={() => setDelRow(null)} onConfirm={doDelete} danger title="Hapus Data QC" message="Hapus data QC ini?" />
    </div>
  )
}
