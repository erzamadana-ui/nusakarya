import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, nextDocNo, uploadFile, signedUrl } from '@/lib/db'
import {
  PageHeader, Card, DataTable, Drawer, Modal, ConfirmDialog, Field, Input, Textarea, Select,
  Button, Badge, Desc, Section, useToast, Plus, EmptyState,
} from '@/components/ui'
import { tgl, tglJam } from '@/lib/format'
import { FEASIBILITY, projectLabel } from '../lib/shared'
import { MapPin, Image as ImageIcon } from 'lucide-react'

export default function Survey() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const loc = useLocation() as any
  const writable = can('DEPLOYMENT', 'write')

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  const [drawerRow, setDrawerRow] = useState<any>(null)
  const [gallery, setGallery] = useState<string[]>([])
  const [delRow, setDelRow] = useState<any>(null)

  const load = async () => {
    if (!profile?.company_id) return
    setLoading(true)
    try {
      const [s, p, e] = await Promise.all([
        list('surveys', { order: { col: 'created_at', asc: false }, limit: 500 }),
        list('projects', { select: 'id,project_code,project_name', order: { col: 'project_code', asc: true } }),
        list('employees', { select: 'id,full_name', order: { col: 'full_name', asc: true } }),
      ])
      setRows(s); setProjects(p); setEmployees(e)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data', 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [profile?.company_id])

  const projName = (id?: string) => { const p = projects.find(x => x.id === id); return p ? projectLabel(p) : '-' }
  const empName = (id?: string) => employees.find(e => e.id === id)?.full_name ?? '-'

  const openAdd = async () => {
    let no = ''
    try { no = await nextDocNo(profile!.company_id, 'SRV') } catch {}
    setEditing(null)
    setFiles([])
    setForm({ survey_no: no, survey_date: new Date().toISOString().slice(0, 10), feasibility: 'layak', status: 'draft', project_id: loc?.state?.projectId ?? '' })
    setOpen(true)
  }
  const openEdit = (row: any) => { setEditing(row); setFiles([]); setForm({ ...row }); setOpen(true) }

  const ambilKoordinat = () => {
    if (!navigator.geolocation) { toast.push('Perangkat tidak mendukung geolokasi', 'error'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setForm((f: any) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude })); setLocating(false); toast.push('Koordinat berhasil diambil') },
      (err) => { setLocating(false); toast.push(err.message || 'Gagal mengambil koordinat', 'error') },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const save = async () => {
    if (!form.project_id) { toast.push('Proyek wajib dipilih', 'error'); return }
    setSaving(true)
    try {
      let photoUrls: string[] = Array.isArray(form.photo_urls) ? [...form.photo_urls] : []
      for (const f of files) { const path = await uploadFile(profile!.company_id, 'survey', f); photoUrls.push(path) }
      const payload = {
        company_id: profile!.company_id, survey_no: form.survey_no, project_id: form.project_id,
        survey_date: form.survey_date || null, surveyor_id: form.surveyor_id || null, location: form.location || null,
        lat: form.lat ?? null, lng: form.lng ?? null, findings: form.findings || null,
        feasibility: form.feasibility || null, recommendation: form.recommendation || null,
        photo_urls: photoUrls, status: form.status || 'draft',
      }
      if (editing) {
        const upd = await update('surveys', editing.id, payload)
        setRows(rs => rs.map(r => r.id === upd.id ? upd : r))
        toast.push('Survey diperbarui')
      } else {
        const created = await insert('surveys', { ...payload, created_by: profile!.id })
        setRows(rs => [created, ...rs])
        toast.push('Survey ditambahkan')
      }
      setOpen(false)
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan', 'error') }
    finally { setSaving(false) }
  }
  const doDelete = async () => {
    if (!delRow) return
    try { await remove('surveys', delRow.id); setRows(rs => rs.filter(r => r.id !== delRow.id)); if (drawerRow?.id === delRow.id) setDrawerRow(null); toast.push('Survey dihapus') }
    catch (e: any) { toast.push(e.message ?? 'Gagal menghapus', 'error') }
  }

  const openDrawer = async (row: any) => {
    setDrawerRow(row)
    const urls = await Promise.all((row.photo_urls ?? []).map((p: string) => signedUrl(p)))
    setGallery(urls.filter(Boolean) as string[])
  }

  return (
    <div>
      <PageHeader title="Survey" subtitle="Survey lokasi & kelayakan teknis"
        actions={writable && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Survey</Button>} />

      <DataTable
        loading={loading} searchKeys={['survey_no', 'location']} exportName="survey"
        onRowClick={openDrawer}
        emptyTitle="Belum ada survey"
        emptyAction={writable && <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>Tambah Survey</Button>}
        columns={[
          { key: 'survey_no', header: 'Nomor', width: '120px' },
          { key: 'project_id', header: 'Proyek', render: (r) => projName(r.project_id) },
          { key: 'survey_date', header: 'Tanggal', render: (r) => tgl(r.survey_date) },
          { key: 'surveyor_id', header: 'Surveyor', render: (r) => empName(r.surveyor_id) },
          { key: 'location', header: 'Lokasi' },
          { key: 'feasibility', header: 'Kelayakan', render: (r) => r.feasibility ? <Badge>{r.feasibility}</Badge> : '-' },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
        rows={rows}
      />

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editing ? 'Ubah Survey' : 'Tambah Survey'}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nomor Survey"><Input value={form.survey_no ?? ''} readOnly disabled /></Field>
          <Field label="Proyek" required><Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} value={form.project_id ?? ''} onChange={(e: any) => setForm({ ...form, project_id: e.target.value })} /></Field>
          <Field label="Tanggal Survey"><Input type="date" value={form.survey_date ?? ''} onChange={e => setForm({ ...form, survey_date: e.target.value })} /></Field>
          <Field label="Surveyor"><Select options={employees.map(e => ({ value: e.id, label: e.full_name }))} value={form.surveyor_id ?? ''} onChange={(e: any) => setForm({ ...form, surveyor_id: e.target.value })} /></Field>
          <Field label="Lokasi" className="sm:col-span-2"><Input value={form.location ?? ''} onChange={e => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="Koordinat" className="sm:col-span-2">
            <div className="flex items-center gap-2">
              <Input readOnly value={form.lat != null && form.lng != null ? `${Number(form.lat).toFixed(6)}, ${Number(form.lng).toFixed(6)}` : ''} placeholder="Belum diambil" />
              <Button type="button" variant="outline" size="md" onClick={ambilKoordinat} loading={locating} icon={<MapPin size={16} />}>Ambil Koordinat</Button>
            </div>
          </Field>
          <Field label="Temuan" className="sm:col-span-2"><Textarea value={form.findings ?? ''} onChange={e => setForm({ ...form, findings: e.target.value })} /></Field>
          <Field label="Kelayakan"><Select options={FEASIBILITY} value={form.feasibility ?? ''} onChange={(e: any) => setForm({ ...form, feasibility: e.target.value })} /></Field>
          <Field label="Status"><Select options={['draft', 'selesai']} value={form.status ?? ''} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>
          <Field label="Rekomendasi" className="sm:col-span-2"><Textarea value={form.recommendation ?? ''} onChange={e => setForm({ ...form, recommendation: e.target.value })} /></Field>
          <Field label="Unggah Foto (bisa banyak)" className="sm:col-span-2">
            <input type="file" multiple accept="image/*" onChange={e => setFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-body text-ink-600 dark:text-ink-300 file:mr-3 file:h-9 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
            {Array.isArray(form.photo_urls) && form.photo_urls.length > 0 && <p className="text-caption text-ink-400 mt-1">{form.photo_urls.length} foto tersimpan sebelumnya.</p>}
          </Field>
        </div>
      </Modal>

      <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} title={drawerRow ? `Survey ${drawerRow.survey_no}` : ''}
        footer={drawerRow && <>
          {can('DEPLOYMENT', 'approve') && <Button variant="danger" onClick={() => setDelRow(drawerRow)}>Hapus</Button>}
          {writable && <Button onClick={() => openEdit(drawerRow)}>Ubah</Button>}
        </>}>
        {drawerRow && (
          <div>
            <Section title="Informasi Survey">
              <Desc items={[
                { label: 'Proyek', value: projName(drawerRow.project_id) },
                { label: 'Tanggal', value: tgl(drawerRow.survey_date) },
                { label: 'Surveyor', value: empName(drawerRow.surveyor_id) },
                { label: 'Lokasi', value: drawerRow.location },
                { label: 'Koordinat', value: drawerRow.lat != null ? `${drawerRow.lat}, ${drawerRow.lng}` : '-' },
                { label: 'Kelayakan', value: <Badge>{drawerRow.feasibility ?? '-'}</Badge> },
                { label: 'Status', value: <Badge>{drawerRow.status}</Badge> },
              ]} />
            </Section>
            {drawerRow.findings && <Section title="Temuan"><p className="text-body text-ink-700 dark:text-ink-200 whitespace-pre-line">{drawerRow.findings}</p></Section>}
            {drawerRow.recommendation && <Section title="Rekomendasi"><p className="text-body text-ink-700 dark:text-ink-200 whitespace-pre-line">{drawerRow.recommendation}</p></Section>}
            <Section title="Galeri Foto">
              {gallery.length === 0 ? <EmptyState icon={<ImageIcon size={22} />} title="Belum ada foto" /> : (
                <div className="grid grid-cols-3 gap-2">
                  {gallery.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="block aspect-square rounded-sm overflow-hidden border border-ink-200 dark:border-ink-800">
                    <img src={u} className="w-full h-full object-cover" /></a>)}
                </div>)}
            </Section>
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={!!delRow} onClose={() => setDelRow(null)} onConfirm={doDelete} danger title="Hapus Survey" message={`Hapus survey "${delRow?.survey_no}"?`} />
    </div>
  )
}
