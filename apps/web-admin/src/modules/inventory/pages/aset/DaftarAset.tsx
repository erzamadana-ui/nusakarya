import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, uploadFile, signedUrl, nextDocNo } from '@/lib/db'
import { rupiah, num, tgl } from '@/lib/format'
import {
  PageHeader, FilterBar, KpiCard, DataTable, Modal, Drawer, ConfirmDialog, Desc,
  Button, Field, Input, Select, Money, Badge, useToast, Plus,
} from '@/components/ui'
import { ASSET_CATEGORY, ASSET_CONDITION, ASSET_STATUS, bookValueNow } from '../../lib/shared'

export default function DaftarAset() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fCategory, setFCategory] = useState('')

  const [modal, setModal] = useState<{ open: boolean; row?: any }>({ open: false })
  const [form, setForm] = useState<any>({})
  const [photoFile, setPhotoFile] = useState<File | undefined>()
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState<any | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, b, e, w] = await Promise.all([
        list('assets', { order: { col: 'created_at', asc: false } }),
        list('branches', { order: { col: 'name', asc: true } }),
        list('employees', { eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
        list('warehouses', { order: { col: 'name', asc: true } }),
      ])
      setRows(a); setBranches(b); setEmployees(e); setWarehouses(w)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data aset', 'error') }
    finally { setLoading(false) }
  }, [toast])
  useEffect(() => { load() }, [load])

  const branchName = (id?: string | null) => branches.find(b => b.id === id)?.name ?? '-'
  const employeeName = (id?: string | null) => employees.find(e => e.id === id)?.full_name ?? '-'
  const filtered = rows.filter(r => !fCategory || r.asset_category === fCategory)
  const totalNilaiBuku = filtered.reduce((s, r) => s + bookValueNow(r.purchase_price, r.useful_life_months, r.purchase_date), 0)

  function openAdd() {
    setForm({ asset_name: '', asset_category: 'tools', brand: '', model: '', serial_no: '', purchase_date: '', purchase_price: 0, useful_life_months: 36, condition: 'baik', status: 'tersedia', branch_id: '', holder_employee_id: '', warehouse_id: '', note: '' })
    setPhotoFile(undefined)
    setModal({ open: true })
  }
  function openEdit(row: any) { setForm({ ...row }); setPhotoFile(undefined); setModal({ open: true, row }) }

  async function save() {
    if (!form.asset_name) { toast.push('Nama aset wajib diisi', 'error'); return }
    setSaving(true)
    try {
      let photo_url = form.photo_url ?? null
      if (photoFile) photo_url = await uploadFile(profile!.company_id, 'aset', photoFile)
      const bookValue = bookValueNow(form.purchase_price, form.useful_life_months, form.purchase_date)
      const payload: any = {
        asset_name: form.asset_name, asset_category: form.asset_category || null, brand: form.brand || null, model: form.model || null,
        serial_no: form.serial_no || null, purchase_date: form.purchase_date || null, purchase_price: Number(form.purchase_price || 0),
        useful_life_months: form.useful_life_months ? Number(form.useful_life_months) : null, depreciation_method: 'garis_lurus',
        book_value: bookValue, condition: form.condition || null, status: form.status || 'tersedia',
        branch_id: form.branch_id || null, holder_employee_id: form.holder_employee_id || null, warehouse_id: form.warehouse_id || null,
        photo_url, note: form.note || null,
      }
      if (modal.row) {
        await update('assets', modal.row.id, payload)
        toast.push('Aset diperbarui')
      } else {
        const asset_no = await nextDocNo(profile!.company_id, 'AST')
        await insert('assets', { ...payload, asset_no, company_id: profile!.company_id, created_by: profile!.id })
        toast.push(`Aset ${asset_no} ditambahkan`)
      }
      setModal({ open: false }); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan aset', 'error') }
    finally { setSaving(false) }
  }

  async function openDetail(row: any) {
    setDetail(row); setPhotoUrl(null)
    if (row.photo_url) setPhotoUrl(await signedUrl(row.photo_url))
  }

  async function doDelete() {
    if (!confirmDel) return
    try { await update('assets', confirmDel.id, { status: 'dihapus' }); toast.push('Aset ditandai dihapus'); setConfirmDel(null); load() }
    catch (e: any) { toast.push(e.message ?? 'Gagal menghapus aset', 'error') }
  }

  const columns = [
    { key: 'asset_no', header: 'No. Aset', width: '110px' },
    { key: 'asset_name', header: 'Nama Aset' },
    { key: 'asset_category', header: 'Kategori', render: (r: any) => <Badge tone="slate">{ASSET_CATEGORY.find(c => c.value === r.asset_category)?.label ?? r.asset_category}</Badge> },
    { key: 'brand', header: 'Merek/Model', render: (r: any) => [r.brand, r.model].filter(Boolean).join(' / ') || '-' },
    { key: 'serial_no', header: 'No. Seri', render: (r: any) => r.serial_no || '-' },
    { key: 'condition', header: 'Kondisi', render: (r: any) => <Badge>{r.condition ?? '-'}</Badge> },
    { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
    { key: 'holder_employee_id', header: 'Pemegang', render: (r: any) => employeeName(r.holder_employee_id) },
    { key: 'branch_id', header: 'Cabang', render: (r: any) => branchName(r.branch_id) },
    { key: 'book_value', header: 'Nilai Buku Berjalan', align: 'right' as const, render: (r: any) => rupiah(bookValueNow(r.purchase_price, r.useful_life_months, r.purchase_date)) },
  ]

  return (
    <div>
      <PageHeader title="Daftar Aset" subtitle="Induk data aset perusahaan: alat ukur, kendaraan, IT, dan lainnya."
        actions={can('ASSET', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Aset</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total Aset" value={num(rows.length)} />
        <KpiCard label="Dipakai" value={num(rows.filter(r => r.status === 'dipakai').length)} tone="amber" />
        <KpiCard label="Perbaikan" value={num(rows.filter(r => r.status === 'perbaikan').length)} tone="red" />
        <KpiCard label="Nilai Buku Berjalan (Terfilter)" value={rupiah(totalNilaiBuku, true)} tone="teal" />
      </div>

      <FilterBar>
        <Field label="Kategori Aset" className="w-56"><Select value={fCategory} onChange={(e: any) => setFCategory(e.target.value)} options={ASSET_CATEGORY} /></Field>
      </FilterBar>

      <DataTable columns={columns} rows={filtered} loading={loading} onRowClick={openDetail}
        searchable searchKeys={['asset_no', 'asset_name', 'serial_no', 'brand', 'model']} exportName="daftar-aset"
        emptyTitle="Belum ada aset" emptyMessage="Tambahkan aset perusahaan untuk mulai pelacakan." />
      <p className="text-caption text-ink-400 mt-2">Nilai buku dihitung otomatis oleh sistem secara garis lurus berjalan dan bukan angka akuntansi resmi.</p>

      <Modal open={modal.open} onClose={() => setModal({ open: false })} size="lg" title={modal.row ? 'Ubah Aset' : 'Tambah Aset'}
        footer={<><Button variant="outline" onClick={() => setModal({ open: false })}>Batal</Button>
          <Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nama Aset" required className="sm:col-span-2"><Input value={form.asset_name ?? ''} onChange={(e: any) => setForm({ ...form, asset_name: e.target.value })} /></Field>
          <Field label="Kategori"><Select value={form.asset_category ?? ''} onChange={(e: any) => setForm({ ...form, asset_category: e.target.value })} options={ASSET_CATEGORY} /></Field>
          <Field label="Kondisi"><Select value={form.condition ?? 'baik'} onChange={(e: any) => setForm({ ...form, condition: e.target.value })} options={ASSET_CONDITION} /></Field>
          <Field label="Merek"><Input value={form.brand ?? ''} onChange={(e: any) => setForm({ ...form, brand: e.target.value })} /></Field>
          <Field label="Model"><Input value={form.model ?? ''} onChange={(e: any) => setForm({ ...form, model: e.target.value })} /></Field>
          <Field label="Nomor Seri"><Input value={form.serial_no ?? ''} onChange={(e: any) => setForm({ ...form, serial_no: e.target.value })} /></Field>
          <Field label="Status"><Select value={form.status ?? 'tersedia'} onChange={(e: any) => setForm({ ...form, status: e.target.value })} options={ASSET_STATUS} /></Field>
          <Field label="Tanggal Pembelian"><Input type="date" value={form.purchase_date ?? ''} onChange={(e: any) => setForm({ ...form, purchase_date: e.target.value })} /></Field>
          <Field label="Harga Beli"><Money value={form.purchase_price} onChange={(v: number) => setForm({ ...form, purchase_price: v })} /></Field>
          <Field label="Umur Manfaat (bulan)"><Input type="number" min="1" value={form.useful_life_months ?? ''} onChange={(e: any) => setForm({ ...form, useful_life_months: e.target.value })} /></Field>
          <Field label="Cabang"><Select value={form.branch_id ?? ''} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value })}
            options={branches.map((b: any) => ({ value: b.id, label: b.name }))} /></Field>
          <Field label="Gudang Penyimpanan"><Select value={form.warehouse_id ?? ''} onChange={(e: any) => setForm({ ...form, warehouse_id: e.target.value })}
            options={warehouses.map((w: any) => ({ value: w.id, label: w.name }))} /></Field>
          <Field label="Pemegang Saat Ini"><Select value={form.holder_employee_id ?? ''} onChange={(e: any) => setForm({ ...form, holder_employee_id: e.target.value })}
            options={employees.map((e: any) => ({ value: e.id, label: e.full_name }))} /></Field>
          <Field label="Catatan" className="sm:col-span-2"><Input value={form.note ?? ''} onChange={(e: any) => setForm({ ...form, note: e.target.value })} /></Field>
          <Field label="Foto Aset" className="sm:col-span-2">
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0])}
              className="block w-full text-body text-ink-600 file:mr-3 file:py-2 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
          </Field>
        </div>
      </Modal>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.asset_name}>
        {detail && (<>
          <div className="flex items-center gap-2 mb-3"><Badge>{detail.status}</Badge><span className="text-caption text-ink-500">{detail.asset_no}</span></div>
          {photoUrl && <img src={photoUrl} alt="Foto aset" className="w-full max-h-56 object-cover rounded-md mb-4 border border-ink-200 dark:border-ink-800" />}
          <Desc cols={2} items={[
            { label: 'Kategori', value: ASSET_CATEGORY.find(c => c.value === detail.asset_category)?.label },
            { label: 'Kondisi', value: detail.condition },
            { label: 'Merek / Model', value: [detail.brand, detail.model].filter(Boolean).join(' / ') },
            { label: 'Nomor Seri', value: detail.serial_no },
            { label: 'Tanggal Beli', value: tgl(detail.purchase_date) },
            { label: 'Harga Beli', value: rupiah(detail.purchase_price) },
            { label: 'Umur Manfaat', value: detail.useful_life_months ? `${detail.useful_life_months} bulan` : '-' },
            { label: 'Nilai Buku Berjalan', value: rupiah(bookValueNow(detail.purchase_price, detail.useful_life_months, detail.purchase_date)) },
            { label: 'Pemegang', value: employeeName(detail.holder_employee_id) },
            { label: 'Cabang', value: branchName(detail.branch_id) },
            { label: 'Catatan', value: detail.note },
          ]} />
          <p className="text-caption text-ink-400 mt-3">Nilai buku dihitung sistem (garis lurus berjalan), bukan angka akuntansi resmi.</p>
          {can('ASSET', 'write') && (
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => { openEdit(detail); setDetail(null) }}>Ubah</Button>
              {can('ASSET', 'approve') && detail.status !== 'dihapus' && <Button variant="danger" onClick={() => setConfirmDel(detail)}>Hapus Aset</Button>}
            </div>
          )}
        </>)}
      </Drawer>

      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={doDelete} danger
        title="Hapus Aset" confirmLabel="Ya, Hapus" message={`Aset "${confirmDel?.asset_name}" akan ditandai berstatus dihapus. Lanjutkan?`} />
    </div>
  )
}
