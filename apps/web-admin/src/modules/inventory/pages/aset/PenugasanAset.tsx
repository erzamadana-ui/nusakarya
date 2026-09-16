import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, uploadFile, signedUrl } from '@/lib/db'
import { num, tgl, tglJam } from '@/lib/format'
import {
  PageHeader, FilterBar, KpiCard, DataTable, Modal,
  Button, Field, Input, Select, Textarea, Badge, useToast, Plus,
} from '@/components/ui'
import { ASSET_CONDITION } from '../../lib/shared'

export default function PenugasanAset() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fOnly, setFOnly] = useState('dipegang')

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<any>({ asset_id: '', employee_id: '', condition_out: 'baik', note: '' })
  const [baFile, setBaFile] = useState<File | undefined>()
  const [saving, setSaving] = useState(false)

  const [returnModal, setReturnModal] = useState<any | null>(null)
  const [returnForm, setReturnForm] = useState<any>({ condition_in: 'baik', note: '' })
  const [returning, setReturning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [aa, a, e] = await Promise.all([
        list('asset_assignments', { select: 'id,asset_id,employee_id,assigned_at,returned_at,condition_out,condition_in,note,ba_url,asset:assets!asset_id(asset_no,asset_name),employee:employees!employee_id(full_name)', order: { col: 'assigned_at', asc: false }, limit: 500 }),
        list('assets', { order: { col: 'asset_name', asc: true } }),
        list('employees', { eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
      ])
      setRows((aa as any[]).map(r => ({ ...r, asset_no: r.asset?.asset_no, asset_name: r.asset?.asset_name, employee_name: r.employee?.full_name })))
      setAssets(a); setEmployees(e)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat penugasan aset', 'error') }
    finally { setLoading(false) }
  }, [toast])
  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => fOnly === 'semua' ? true : !r.returned_at)

  function openAdd() { setForm({ asset_id: '', employee_id: '', condition_out: 'baik', note: '' }); setBaFile(undefined); setModalOpen(true) }

  async function save() {
    if (!form.asset_id || !form.employee_id) { toast.push('Pilih aset dan karyawan penerima', 'error'); return }
    setSaving(true)
    try {
      let ba_url: string | null = null
      if (baFile) ba_url = await uploadFile(profile!.company_id, 'aset-ba', baFile)
      await insert('asset_assignments', {
        company_id: profile!.company_id, asset_id: form.asset_id, employee_id: form.employee_id,
        assigned_at: new Date().toISOString(), condition_out: form.condition_out, note: form.note || null, ba_url, created_by: profile!.id,
      })
      await update('assets', form.asset_id, { holder_employee_id: form.employee_id, status: 'dipakai', condition: form.condition_out })
      toast.push('Serah terima aset tercatat')
      setModalOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal mencatat serah terima aset', 'error') }
    finally { setSaving(false) }
  }

  function openReturn(row: any) { setReturnForm({ condition_in: 'baik', note: '' }); setReturnModal(row) }

  async function doReturn() {
    if (!returnModal) return
    setReturning(true)
    try {
      await update('asset_assignments', returnModal.id, { returned_at: new Date().toISOString(), condition_in: returnForm.condition_in, note: returnForm.note || returnModal.note })
      await update('assets', returnModal.asset_id, { holder_employee_id: null, status: 'tersedia', condition: returnForm.condition_in })
      toast.push('Aset dikembalikan')
      setReturnModal(null); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal mencatat pengembalian aset', 'error') }
    finally { setReturning(false) }
  }

  async function viewBa(path: string) { const url = await signedUrl(path); if (url) window.open(url, '_blank'); else toast.push('Gagal membuka berita acara', 'error') }

  const columns = [
    { key: 'asset_no', header: 'No. Aset', width: '110px' },
    { key: 'asset_name', header: 'Nama Aset' },
    { key: 'employee_name', header: 'Dipegang Oleh' },
    { key: 'assigned_at', header: 'Tgl Keluar', render: (r: any) => tglJam(r.assigned_at) },
    { key: 'condition_out', header: 'Kondisi Keluar', render: (r: any) => <Badge>{r.condition_out}</Badge> },
    { key: 'returned_at', header: 'Tgl Kembali', render: (r: any) => r.returned_at ? tglJam(r.returned_at) : <Badge tone="amber">Belum Kembali</Badge> },
    { key: 'condition_in', header: 'Kondisi Kembali', render: (r: any) => r.condition_in ? <Badge>{r.condition_in}</Badge> : '-' },
    {
      key: 'ba', header: 'Berita Acara', render: (r: any) => r.ba_url
        ? <Button size="sm" variant="outline" onClick={(e: any) => { e.stopPropagation(); viewBa(r.ba_url) }}>Lihat</Button> : '-',
    },
    {
      key: 'aksi', header: '', sortable: false, render: (r: any) => (
        <div onClick={e => e.stopPropagation()}>
          {can('ASSET', 'write') && !r.returned_at && <Button size="sm" onClick={() => openReturn(r)}>Kembalikan</Button>}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Penugasan Aset" subtitle="Serah terima aset ke karyawan dan riwayat pengembaliannya."
        actions={can('ASSET', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Serah Terima Aset</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <KpiCard label="Total Penugasan" value={num(rows.length)} />
        <KpiCard label="Sedang Dipegang" value={num(rows.filter(r => !r.returned_at).length)} tone="amber" />
        <KpiCard label="Sudah Dikembalikan" value={num(rows.filter(r => r.returned_at).length)} tone="emerald" />
      </div>

      <FilterBar>
        <Field label="Tampilkan" className="w-56"><Select value={fOnly} onChange={(e: any) => setFOnly(e.target.value)}
          options={[{ value: 'dipegang', label: 'Sedang Dipegang' }, { value: 'semua', label: 'Semua Riwayat' }]} /></Field>
      </FilterBar>

      <DataTable columns={columns} rows={filtered} loading={loading} searchable searchKeys={['asset_no', 'asset_name', 'employee_name']}
        exportName="penugasan-aset" emptyTitle="Belum ada penugasan aset" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Serah Terima Aset"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
          <Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Aset" required className="sm:col-span-2"><Select value={form.asset_id} onChange={(e: any) => setForm({ ...form, asset_id: e.target.value })}
            options={assets.map((a: any) => ({ value: a.id, label: `${a.asset_no} · ${a.asset_name}` }))} /></Field>
          <Field label="Diserahkan Kepada" required><Select value={form.employee_id} onChange={(e: any) => setForm({ ...form, employee_id: e.target.value })}
            options={employees.map((e: any) => ({ value: e.id, label: e.full_name }))} /></Field>
          <Field label="Kondisi Saat Keluar"><Select value={form.condition_out} onChange={(e: any) => setForm({ ...form, condition_out: e.target.value })} options={ASSET_CONDITION} /></Field>
          <Field label="Catatan" className="sm:col-span-2"><Textarea value={form.note} onChange={(e: any) => setForm({ ...form, note: e.target.value })} /></Field>
          <Field label="Unggah Berita Acara" className="sm:col-span-2">
            <input type="file" onChange={(e) => setBaFile(e.target.files?.[0])}
              className="block w-full text-body text-ink-600 file:mr-3 file:py-2 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
          </Field>
        </div>
      </Modal>

      <Modal open={!!returnModal} onClose={() => setReturnModal(null)} title="Pengembalian Aset" subtitle={returnModal?.asset_name}
        footer={<><Button variant="outline" onClick={() => setReturnModal(null)}>Batal</Button>
          <Button loading={returning} onClick={doReturn}>Simpan Pengembalian</Button></>}>
        <div className="space-y-4">
          <Field label="Kondisi Saat Kembali"><Select value={returnForm.condition_in} onChange={(e: any) => setReturnForm({ ...returnForm, condition_in: e.target.value })} options={ASSET_CONDITION} /></Field>
          <Field label="Catatan"><Textarea value={returnForm.note} onChange={(e: any) => setReturnForm({ ...returnForm, note: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}
