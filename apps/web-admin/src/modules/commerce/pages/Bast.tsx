import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove, uploadFile, signedUrl, nextDocNo } from '@/lib/db'
import { tgl, todayISO } from '@/lib/format'
import {
  PageHeader, Card, DataTable, Modal, Drawer, ConfirmDialog, Field, Input, Select, Textarea,
  Badge, Button, useToast, TableSkeleton, EmptyState, Section, Desc, Plus,
} from '@/components/ui'
import { MapPin, Upload, Printer, Image as ImageIcon } from 'lucide-react'
import { BAST_STATUS_OPTIONS } from '../lib/constants'

const emptyForm = {
  bast_no: '', bast_date: todayISO(), spk_id: '', project_id: '', work_order_id: '', customer_id: '',
  title: '', scope: '', signer_name: '', signer_position: '', signature_url: '',
  geotag_lat: null as number | null, geotag_lng: null as number | null, status: 'draft', file_url: '',
}

export default function Bast() {
  const { profile, company, can } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [spkList, setSpkList] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [delId, setDelId] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [printMode, setPrintMode] = useState(false)

  const spkMap = useMemo(() => Object.fromEntries(spkList.map(s => [s.id, s])), [spkList])
  const projectMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects])
  const customerMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c.name])), [customers])

  const load = async () => {
    setLoading(true)
    try {
      const [b, s, p, wo, c] = await Promise.all([
        list('bast', { order: { col: 'created_at', asc: false }, limit: 500 }),
        list('spk', { select: 'id,spk_no,title,contract_id', order: { col: 'spk_no', asc: true }, limit: 500 }),
        list('projects', { select: 'id,project_code,project_name', order: { col: 'project_name', asc: true }, limit: 500 }),
        list('work_orders', { select: 'id,wo_no,title', order: { col: 'wo_no', asc: true }, limit: 500 }),
        list('customers', { select: 'id,name', order: { col: 'name', asc: true }, limit: 500 }),
      ])
      setRows(b); setSpkList(s); setProjects(p); setWorkOrders(wo); setCustomers(c)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data BAST', 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openAdd = async () => {
    setEditing(null)
    let no = ''
    try { no = await nextDocNo(profile!.company_id, 'BAST') } catch { /* biarkan kosong */ }
    setForm({ ...emptyForm, bast_no: no })
    setModal(true)
  }
  const openEdit = (row: any) => { setEditing(row); setForm({ ...emptyForm, ...row }); setModal(true) }

  const captureGeotag = () => {
    if (!navigator.geolocation) { toast.push('Perangkat tidak mendukung geolokasi', 'error'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setForm((f: any) => ({ ...f, geotag_lat: pos.coords.latitude, geotag_lng: pos.coords.longitude })); setLocating(false); toast.push('Koordinat berhasil diambil', 'success') },
      () => { setLocating(false); toast.push('Gagal mengambil koordinat lokasi', 'error') },
      { enableHighAccuracy: true, timeout: 10000 })
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try { const path = await uploadFile(profile!.company_id, 'bast', file); setForm((f: any) => ({ ...f, signature_url: path })); toast.push('Berkas terunggah', 'success') }
    catch (e: any) { toast.push(e.message ?? 'Gagal mengunggah berkas', 'error') }
    finally { setUploading(false) }
  }

  const save = async () => {
    if (!form.bast_no || !form.customer_id || !form.signer_name) { toast.push('No BAST, pelanggan, dan nama penanda tangan wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        bast_no: form.bast_no, bast_date: form.bast_date || todayISO(), spk_id: form.spk_id || null,
        project_id: form.project_id || null, work_order_id: form.work_order_id || null, customer_id: form.customer_id,
        title: form.title, scope: form.scope, signer_name: form.signer_name, signer_position: form.signer_position,
        signature_url: form.signature_url || null, geotag_lat: form.geotag_lat, geotag_lng: form.geotag_lng,
        status: form.status, file_url: form.file_url || null,
      }
      if (editing) { await update('bast', editing.id, payload); toast.push('BAST diperbarui', 'success') }
      else { await insert('bast', { ...payload, company_id: profile!.company_id }); toast.push('BAST ditambahkan', 'success') }
      setModal(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan BAST', 'error') }
    finally { setSaving(false) }
  }

  const doDelete = async () => {
    if (!delId) return
    try { await remove('bast', delId); toast.push('BAST dihapus', 'success'); load() }
    catch (e: any) { toast.push(e.message ?? 'Gagal menghapus BAST', 'error') }
  }

  const columns = [
    { key: 'bast_no', header: 'No BAST', width: '140px' },
    { key: 'bast_date', header: 'Tanggal', render: (r: any) => tgl(r.bast_date) },
    { key: 'spk_id', header: 'SPK / Proyek', sortable: false, render: (r: any) => spkMap[r.spk_id]?.spk_no ?? projectMap[r.project_id]?.project_name ?? '-' },
    { key: 'customer_id', header: 'Pelanggan', render: (r: any) => customerMap[r.customer_id] ?? '-' },
    { key: 'signer_name', header: 'Penanda Tangan', render: (r: any) => r.signer_name || '-' },
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
      <PageHeader title="BAST" subtitle="Berita Acara Serah Terima pekerjaan dari SPK/proyek/work order."
        actions={can('COMMERCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah BAST</Button>} />

      {loading ? <Card><TableSkeleton /></Card> : (
        <DataTable columns={columns} rows={rows} searchable searchKeys={['bast_no', 'signer_name']} exportName="bast"
          onRowClick={r => setDetail(r)} emptyTitle="Belum ada BAST" emptyMessage="Buat BAST setelah pekerjaan selesai diserahterimakan."
          emptyAction={can('COMMERCE', 'write') && <Button size="sm" icon={<Plus size={16} />} onClick={openAdd}>Tambah BAST</Button>} />
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Ubah BAST' : 'Tambah BAST'} size="lg"
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="No BAST" required><Input value={form.bast_no} onChange={e => setForm({ ...form, bast_no: e.target.value })} /></Field>
          <Field label="Tanggal BAST"><Input type="date" value={form.bast_date ?? ''} onChange={e => setForm({ ...form, bast_date: e.target.value })} /></Field>
          <Field label="SPK"><Select value={form.spk_id} options={spkList.map(s => ({ value: s.id, label: s.spk_no }))} onChange={(e: any) => setForm({ ...form, spk_id: e.target.value })} /></Field>
          <Field label="Proyek"><Select value={form.project_id} options={projects.map(p => ({ value: p.id, label: p.project_name }))} onChange={(e: any) => setForm({ ...form, project_id: e.target.value })} /></Field>
          <Field label="Work Order"><Select value={form.work_order_id} options={workOrders.map(w => ({ value: w.id, label: w.wo_no }))} onChange={(e: any) => setForm({ ...form, work_order_id: e.target.value })} /></Field>
          <Field label="Pelanggan" required><Select value={form.customer_id} options={customers.map(c => ({ value: c.id, label: c.name }))} onChange={(e: any) => setForm({ ...form, customer_id: e.target.value })} /></Field>
          <Field label="Judul" className="sm:col-span-2"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Lingkup Pekerjaan" className="sm:col-span-2"><Textarea value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })} /></Field>
          <Field label="Nama Penanda Tangan" required><Input value={form.signer_name} onChange={e => setForm({ ...form, signer_name: e.target.value })} /></Field>
          <Field label="Jabatan Penanda Tangan"><Input value={form.signer_position} onChange={e => setForm({ ...form, signer_position: e.target.value })} /></Field>
          <Field label="Status"><Select value={form.status} options={BAST_STATUS_OPTIONS} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>
          <Field label="Koordinat Geotag">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" loading={locating} icon={<MapPin size={14} />} onClick={captureGeotag}>Ambil Lokasi</Button>
              {form.geotag_lat != null && <span className="text-caption text-ink-500">{Number(form.geotag_lat).toFixed(5)}, {Number(form.geotag_lng).toFixed(5)}</span>}
            </div>
          </Field>
          <Field label="Tanda Tangan / Foto" className="sm:col-span-2">
            <label className="inline-flex items-center gap-2 h-10 px-4 rounded-sm border border-ink-200 dark:border-ink-700 text-body cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800">
              <Upload size={15} />{uploading ? 'Mengunggah…' : 'Unggah Berkas'}
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            </label>
            {form.signature_url && <span className="ml-2 text-caption text-ink-500">Berkas terpasang</span>}
          </Field>
        </div>
      </Modal>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.bast_no} width="max-w-2xl"
        footer={detail && <Button variant="outline" icon={<Printer size={15} />} onClick={() => setPrintMode(true)}>Pratinjau Cetak</Button>}>
        {detail && (
          <>
            <div className="mb-4"><Badge>{detail.status}</Badge></div>
            <Section title="Ringkasan">
              <Desc items={[
                { label: 'Tanggal', value: tgl(detail.bast_date) },
                { label: 'Pelanggan', value: customerMap[detail.customer_id] },
                { label: 'SPK', value: spkMap[detail.spk_id]?.spk_no },
                { label: 'Proyek', value: projectMap[detail.project_id]?.project_name },
                { label: 'Judul', value: detail.title },
                { label: 'Lingkup', value: detail.scope },
                { label: 'Penanda Tangan', value: `${detail.signer_name ?? '-'}${detail.signer_position ? ' (' + detail.signer_position + ')' : ''}` },
                { label: 'Koordinat', value: detail.geotag_lat != null ? `${Number(detail.geotag_lat).toFixed(5)}, ${Number(detail.geotag_lng).toFixed(5)}` : '-' },
                { label: 'Berkas Tanda Tangan/Foto', value: detail.signature_url ? <Button size="sm" variant="outline" icon={<ImageIcon size={13} />} onClick={async () => { const u = await signedUrl(detail.signature_url); if (u) window.open(u, '_blank') }}>Lihat</Button> : '-' },
              ]} />
            </Section>
          </>)}
      </Drawer>

      {printMode && detail && (
        <div className="fixed inset-0 z-[200] bg-white overflow-auto p-8">
          <div className="print:hidden flex justify-end mb-4"><Button variant="outline" onClick={() => setPrintMode(false)}>Tutup</Button><Button className="ml-2" onClick={() => window.print()}>Cetak</Button></div>
          <div className="max-w-2xl mx-auto text-ink-900">
            <h1 className="text-center font-display text-xl font-bold mb-1">BERITA ACARA SERAH TERIMA (BAST)</h1>
            <p className="text-center text-body mb-6">{company?.name}</p>
            <table className="w-full text-body mb-4"><tbody>
              <tr><td className="py-0.5 w-44">No BAST</td><td>: {detail.bast_no}</td></tr>
              <tr><td className="py-0.5">Tanggal</td><td>: {tgl(detail.bast_date)}</td></tr>
              <tr><td className="py-0.5">Pelanggan</td><td>: {customerMap[detail.customer_id]}</td></tr>
              <tr><td className="py-0.5">SPK</td><td>: {spkMap[detail.spk_id]?.spk_no ?? '-'}</td></tr>
              <tr><td className="py-0.5">Judul Pekerjaan</td><td>: {detail.title || '-'}</td></tr>
            </tbody></table>
            <p className="text-body mb-1 font-medium">Lingkup Pekerjaan:</p>
            <p className="text-body mb-6">{detail.scope || '-'}</p>
            <p className="text-body mb-6">Koordinat lokasi serah terima: {detail.geotag_lat != null ? `${Number(detail.geotag_lat).toFixed(5)}, ${Number(detail.geotag_lng).toFixed(5)}` : '-'}</p>
            <div className="grid grid-cols-2 gap-8 mt-16 text-center text-body">
              <div><p>Yang Menyerahkan,</p><div className="h-20" /><p className="border-t border-ink-400 pt-1">Kontraktor</p></div>
              <div><p>Yang Menerima,</p><div className="h-20" /><p className="border-t border-ink-400 pt-1">{detail.signer_name || 'Pelanggan'}{detail.signer_position ? ` — ${detail.signer_position}` : ''}</p></div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={doDelete} danger
        title="Hapus BAST" message="BAST akan dihapus permanen. Lanjutkan?" confirmLabel="Ya, Hapus" />
    </div>
  )
}
