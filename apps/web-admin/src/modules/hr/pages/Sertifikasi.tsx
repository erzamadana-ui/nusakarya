import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, uploadFile, signedUrl } from '@/lib/db'
import {
  PageHeader, Card, DataTable, Badge, Button, Modal, Field, Select, Input, Tabs, useToast, Plus,
} from '@/components/ui'
import { tgl, todayISO } from '@/lib/format'
import { CERT_TYPE_OPTIONS, expiryTone } from '../lib/constants'

const emptyForm = { id: null, employee_id: '', cert_type: 'K3', cert_name: '', cert_no: '', issuer: '', issued_date: '', expiry_date: '', status: 'aktif', file_url: '' }

export default function Sertifikasi() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('sertifikasi')
  const [loading, setLoading] = useState(true)
  const [certs, setCerts] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [c, e] = await Promise.all([
        list<any>('employee_certifications', { select: '*,employees(full_name,position)', order: { col: 'expiry_date', asc: true } }),
        list<any>('employees', { select: 'id,full_name,position,employment_type,contract_end', eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
      ])
      setCerts(c); setEmployees(e)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data sertifikasi', 'error') }
    finally { setLoading(false) }
  }

  const pkwt = useMemo(() => employees.filter(e => e.employment_type === 'PKWT' && e.contract_end), [employees])

  function openAdd() { setForm(emptyForm); setFile(null); setModalOpen(true) }
  function openEdit(r: any) { setForm({ ...emptyForm, ...r }); setFile(null); setModalOpen(true) }

  async function save() {
    if (!form.employee_id || !form.cert_name || !form.expiry_date) { toast.push('Karyawan, nama sertifikat, dan tanggal berakhir wajib diisi', 'error'); return }
    setSaving(true)
    try {
      let file_url = form.file_url
      if (file) file_url = await uploadFile(profile!.company_id, 'sertifikasi', file)
      const payload = { ...form, file_url }
      delete payload.employees
      if (form.id) { await update('employee_certifications', form.id, payload); toast.push('Sertifikasi diperbarui') }
      else { await insert('employee_certifications', { ...payload, id: undefined, company_id: profile?.company_id, created_by: profile?.id }); toast.push('Sertifikasi ditambahkan') }
      setModalOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan sertifikasi', 'error') }
    finally { setSaving(false) }
  }

  async function openFile(path?: string | null) {
    if (!path) { toast.push('Berkas belum diunggah', 'info'); return }
    const url = await signedUrl(path)
    if (url) window.open(url, '_blank')
  }

  return (
    <div>
      <PageHeader title="Kontrak & Sertifikasi" subtitle="Pantau masa berlaku sertifikasi dan kontrak PKWT karyawan"
        actions={tab === 'sertifikasi' && can('HR', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Sertifikasi</Button>} />

      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[
        { value: 'sertifikasi', label: 'Sertifikasi Karyawan', count: certs.length },
        { value: 'pkwt', label: 'Kontrak PKWT', count: pkwt.length },
      ]} />

      {tab === 'sertifikasi' && (
        <DataTable
          loading={loading} rows={certs} searchKeys={['cert_name', 'cert_no', 'cert_type']}
          onRowClick={can('HR', 'write') ? openEdit : undefined}
          emptyTitle="Belum ada data sertifikasi"
          columns={[
            { key: 'nama', header: 'Karyawan', render: r => r.employees?.full_name ?? '-' },
            { key: 'cert_type', header: 'Jenis' },
            { key: 'cert_name', header: 'Nama Sertifikat' },
            { key: 'cert_no', header: 'No. Sertifikat' },
            { key: 'issued_date', header: 'Terbit', render: r => tgl(r.issued_date) },
            { key: 'expiry_date', header: 'Berakhir', render: r => tgl(r.expiry_date) },
            { key: 'status_masa', header: 'Masa Berlaku', render: r => { const t = expiryTone(r.expiry_date); return <Badge tone={t.tone}>{t.label}</Badge> } },
            { key: 'berkas', header: 'Berkas', align: 'center', render: r => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openFile(r.file_url) }}>Lihat</Button> },
          ]}
        />)}

      {tab === 'pkwt' && (
        <DataTable
          loading={loading} rows={pkwt} searchable={false} emptyTitle="Tidak ada karyawan PKWT"
          columns={[
            { key: 'full_name', header: 'Nama' }, { key: 'position', header: 'Jabatan' },
            { key: 'contract_end', header: 'Berakhir Kontrak', render: r => tgl(r.contract_end) },
            { key: 'status_masa', header: 'Sisa Waktu', render: r => { const t = expiryTone(r.contract_end); return <Badge tone={t.tone}>{t.label}</Badge> } },
          ]}
        />)}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? 'Ubah Sertifikasi' : 'Tambah Sertifikasi'}
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Karyawan" required className="sm:col-span-2">
            <Select value={form.employee_id} onChange={(e: any) => setForm({ ...form, employee_id: e.target.value })}
              options={employees.map(e => ({ value: e.id, label: `${e.full_name} — ${e.position}` }))} />
          </Field>
          <Field label="Jenis Sertifikat"><Select value={form.cert_type} onChange={(e: any) => setForm({ ...form, cert_type: e.target.value })} options={CERT_TYPE_OPTIONS} /></Field>
          <Field label="Nama Sertifikat" required><Input value={form.cert_name} onChange={(e: any) => setForm({ ...form, cert_name: e.target.value })} /></Field>
          <Field label="No. Sertifikat"><Input value={form.cert_no} onChange={(e: any) => setForm({ ...form, cert_no: e.target.value })} /></Field>
          <Field label="Penerbit"><Input value={form.issuer} onChange={(e: any) => setForm({ ...form, issuer: e.target.value })} /></Field>
          <Field label="Tanggal Terbit"><Input type="date" value={form.issued_date} onChange={(e: any) => setForm({ ...form, issued_date: e.target.value })} /></Field>
          <Field label="Tanggal Berakhir" required><Input type="date" value={form.expiry_date} onChange={(e: any) => setForm({ ...form, expiry_date: e.target.value })} /></Field>
          <Field label="Status"><Select value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })} options={['aktif', 'nonaktif']} /></Field>
          <Field label="Berkas Sertifikat" className="sm:col-span-2">
            <input type="file" accept="application/pdf,image/*" onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-body text-ink-600 dark:text-ink-300 file:mr-3 file:py-2 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
            {form.file_url && !file && <p className="text-caption text-ink-400 mt-1">Berkas tersimpan. Unggah berkas baru untuk mengganti.</p>}
          </Field>
        </div>
      </Modal>
      <p className="text-caption text-ink-400 mt-4">Warna status: hijau &gt;90 hari, kuning 30–90 hari, merah &lt;30 hari atau sudah kedaluwarsa. Ditarik {tgl(todayISO())}.</p>
    </div>
  )
}
