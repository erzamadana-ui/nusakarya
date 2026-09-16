import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, uploadFile, signedUrl, nextDocNo } from '@/lib/db'
import { rupiah, tgl, todayISO } from '@/lib/format'
import {
  PageHeader, Card, DataTable, Modal, Drawer, ConfirmDialog, Field, Input, Select, Textarea,
  Badge, Button, Stepper, useToast, TableSkeleton, EmptyState, Section, Desc, Plus,
} from '@/components/ui'
import { Paperclip, Upload } from 'lucide-react'
import { SPK_STATUS_OPTIONS } from '../lib/constants'

const emptyForm = {
  spk_no: '', contract_id: '', spk_date: todayISO(), title: '', scope: '', location: '',
  branch_id: '', start_date: '', end_date: '', spk_value: 0, status: 'draft', file_url: '', pic_id: '',
}
const STEPS = ['draft', 'aktif', 'selesai']

export default function Spk() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [pics, setPics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [delId, setDelId] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [detailProjects, setDetailProjects] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const contractMap = useMemo(() => Object.fromEntries(contracts.map(c => [c.id, c])), [contracts])
  const branchMap = useMemo(() => Object.fromEntries(branches.map(b => [b.id, b.name])), [branches])

  const load = async () => {
    setLoading(true)
    try {
      const [s, c, b, p] = await Promise.all([
        list('spk', { order: { col: 'created_at', asc: false }, limit: 500 }),
        list('contracts', { select: 'id,contract_no,contract_name', order: { col: 'contract_name', asc: true }, limit: 500 }),
        list('branches', { select: 'id,name', order: { col: 'name', asc: true }, limit: 200 }),
        list('profiles', { select: 'id,full_name', eq: { is_active: true }, order: { col: 'full_name', asc: true }, limit: 500 }),
      ])
      setRows(s); setContracts(c); setBranches(b); setPics(p)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data SPK', 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openAdd = async () => {
    setEditing(null)
    let no = ''
    try { no = await nextDocNo(profile!.company_id, 'SPK') } catch { /* biarkan kosong bila gagal */ }
    setForm({ ...emptyForm, spk_no: no })
    setModal(true)
  }
  const openEdit = (row: any) => { setEditing(row); setForm({ ...emptyForm, ...row }); setModal(true) }

  const openDetail = async (row: any) => {
    setDetail(row); setDetailLoading(true)
    try { setDetailProjects(await list('projects', { eq: { spk_id: row.id }, order: { col: 'created_at', asc: false } })) }
    catch (e: any) { toast.push(e.message ?? 'Gagal memuat proyek terkait', 'error') }
    finally { setDetailLoading(false) }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try { const path = await uploadFile(profile!.company_id, 'spk', file); setForm((f: any) => ({ ...f, file_url: path })); toast.push('Berkas terunggah', 'success') }
    catch (e: any) { toast.push(e.message ?? 'Gagal mengunggah berkas', 'error') }
    finally { setUploading(false) }
  }

  const save = async () => {
    if (!form.spk_no || !form.contract_id || !form.title) { toast.push('No SPK, kontrak, dan judul wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        spk_no: form.spk_no, contract_id: form.contract_id, spk_date: form.spk_date || todayISO(), title: form.title,
        scope: form.scope, location: form.location, branch_id: form.branch_id || null,
        start_date: form.start_date || null, end_date: form.end_date || null, spk_value: Number(form.spk_value) || 0,
        status: form.status, file_url: form.file_url || null, pic_id: form.pic_id || null,
      }
      if (editing) { await update('spk', editing.id, payload); toast.push('SPK diperbarui', 'success') }
      else { await insert('spk', { ...payload, company_id: profile!.company_id }); toast.push('SPK ditambahkan', 'success') }
      setModal(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan SPK', 'error') }
    finally { setSaving(false) }
  }

  const doDelete = async () => {
    if (!delId) return
    try { await remove('spk', delId); toast.push('SPK dihapus', 'success'); load() }
    catch (e: any) { toast.push(e.message ?? 'Gagal menghapus SPK', 'error') }
  }

  const columns = [
    { key: 'spk_no', header: 'No SPK', width: '130px' },
    { key: 'title', header: 'Judul' },
    { key: 'contract_id', header: 'Kontrak', render: (r: any) => contractMap[r.contract_id]?.contract_name ?? '-' },
    { key: 'branch_id', header: 'Cabang', render: (r: any) => branchMap[r.branch_id] ?? '-' },
    { key: 'location', header: 'Lokasi', render: (r: any) => r.location || '-' },
    { key: 'spk_value', header: 'Nilai', align: 'right' as const, render: (r: any) => rupiah(r.spk_value) },
    { key: 'periode', header: 'Periode', sortable: false, render: (r: any) => `${tgl(r.start_date)} – ${tgl(r.end_date)}` },
    { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
    {
      key: 'aksi', header: '', width: '90px', sortable: false,
      render: (r: any) => can('COMMERCE', 'write') ? (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Ubah</Button>
          {can('COMMERCE', 'approve') && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDelId(r.id)}>Hapus</Button>}
        </div>
      ) : null,
    },
  ]

  return (
    <div>
      <PageHeader title="SPK" subtitle="Surat Perintah Kerja yang diterbitkan dari kontrak berjalan."
        actions={can('COMMERCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah SPK</Button>} />

      {loading ? <Card><TableSkeleton /></Card> : (
        <DataTable columns={columns} rows={rows} searchable searchKeys={['spk_no', 'title', 'location']} exportName="spk"
          onRowClick={openDetail} emptyTitle="Belum ada SPK" emptyMessage="Terbitkan SPK pertama dari kontrak yang aktif."
          emptyAction={can('COMMERCE', 'write') && <Button size="sm" icon={<Plus size={16} />} onClick={openAdd}>Tambah SPK</Button>} />
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Ubah SPK' : 'Tambah SPK'} size="lg"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="No SPK" required><Input value={form.spk_no} onChange={e => setForm({ ...form, spk_no: e.target.value })} /></Field>
          <Field label="Tanggal SPK"><Input type="date" value={form.spk_date ?? ''} onChange={e => setForm({ ...form, spk_date: e.target.value })} /></Field>
          <Field label="Kontrak" required className="sm:col-span-2"><Select value={form.contract_id} options={contracts.map(c => ({ value: c.id, label: `${c.contract_no} — ${c.contract_name}` }))} onChange={(e: any) => setForm({ ...form, contract_id: e.target.value })} /></Field>
          <Field label="Judul SPK" required className="sm:col-span-2"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Lingkup Pekerjaan" className="sm:col-span-2"><Textarea value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })} /></Field>
          <Field label="Lokasi"><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="Cabang"><Select value={form.branch_id} options={branches.map(b => ({ value: b.id, label: b.name }))} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value })} /></Field>
          <Field label="Tanggal Mulai"><Input type="date" value={form.start_date ?? ''} onChange={e => setForm({ ...form, start_date: e.target.value })} /></Field>
          <Field label="Tanggal Selesai"><Input type="date" value={form.end_date ?? ''} onChange={e => setForm({ ...form, end_date: e.target.value })} /></Field>
          <Field label="Nilai SPK"><Input type="number" value={form.spk_value} onChange={e => setForm({ ...form, spk_value: e.target.value })} /></Field>
          <Field label="PIC"><Select value={form.pic_id} options={pics.map(p => ({ value: p.id, label: p.full_name }))} onChange={(e: any) => setForm({ ...form, pic_id: e.target.value })} /></Field>
          <Field label="Status"><Select value={form.status} options={SPK_STATUS_OPTIONS} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>
          <Field label="Berkas SPK" className="sm:col-span-2">
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 h-10 px-4 rounded-sm border border-ink-200 dark:border-ink-700 text-body cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800">
                <Upload size={15} />{uploading ? 'Mengunggah…' : 'Pilih Berkas'}
                <input type="file" className="hidden" disabled={uploading} onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              </label>
              {form.file_url && <span className="text-caption text-ink-500">Berkas terpasang</span>}
            </div>
          </Field>
        </div>
      </Modal>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.title} width="max-w-2xl">
        {detail && (
          <>
            {detail.status !== 'batal' && <div className="mb-5"><Stepper steps={STEPS} current={Math.max(0, STEPS.indexOf(detail.status))} /></div>}
            {detail.status === 'batal' && <div className="mb-5"><Badge tone="zinc">Dibatalkan</Badge></div>}
            <Section title="Ringkasan">
              <Desc items={[
                { label: 'No SPK', value: detail.spk_no },
                { label: 'Kontrak', value: contractMap[detail.contract_id]?.contract_name },
                { label: 'Lingkup', value: detail.scope },
                { label: 'Lokasi', value: detail.location },
                { label: 'Cabang', value: branchMap[detail.branch_id] },
                { label: 'Nilai SPK', value: rupiah(detail.spk_value) },
                { label: 'Periode', value: `${tgl(detail.start_date)} – ${tgl(detail.end_date)}` },
                { label: 'Berkas', value: detail.file_url ? <Button size="sm" variant="outline" onClick={async () => { const u = await signedUrl(detail.file_url); if (u) window.open(u, '_blank') }}><Paperclip size={13} className="mr-1" />Lihat Berkas</Button> : '-' },
              ]} />
            </Section>
            <Section title="Proyek Terkait">
              {detailLoading ? <TableSkeleton rows={2} /> : detailProjects.length === 0 ? <EmptyState title="Belum ada proyek terkait" /> : (
                <div className="space-y-2">{detailProjects.map((p: any) => (
                  <Card key={p.id} className="p-3 flex items-center justify-between gap-3">
                    <div><p className="text-body font-medium">{p.project_name}</p><p className="text-caption text-ink-500">{p.project_code}</p></div>
                    <Badge>{p.status}</Badge>
                  </Card>))}</div>)}
            </Section>
          </>)}
      </Drawer>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={doDelete} danger
        title="Hapus SPK" message="SPK akan dihapus permanen. Lanjutkan?" confirmLabel="Ya, Hapus" />
    </div>
  )
}
