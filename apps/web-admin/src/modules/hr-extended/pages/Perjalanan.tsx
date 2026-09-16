import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, uploadFile, signedUrl, nextDocNo } from '@/lib/db'
import {
  PageHeader, DataTable, Badge, Button, Modal, Drawer, Field, Select, Input, Textarea, Money, Stepper, Section, Desc,
  KpiCard, useToast, Plus,
} from '@/components/ui'
import { rupiah, tgl, todayISO } from '@/lib/format'
import { TRANSPORT_TYPE_OPTIONS, EXPENSE_CATEGORY_OPTIONS, TRIP_STEPS, isThisMonth } from '../lib/constants'

const emptyForm = { employee_id: '', destination: '', purpose: '', start_date: todayISO(), end_date: todayISO(), transport_type: 'Kendaraan Dinas', daily_allowance: 0, total_advance: 0 }
const emptyExpense = { category: 'Transportasi', expense_date: todayISO(), description: '', amount: 0 }

export default function Perjalanan() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)

  const [detail, setDetail] = useState<any>(null)
  const [expenses, setExpenses] = useState<any[]>([])
  const [expLoading, setExpLoading] = useState(false)
  const [expModalOpen, setExpModalOpen] = useState(false)
  const [expForm, setExpForm] = useState<any>(emptyExpense)
  const [expFile, setExpFile] = useState<File | null>(null)
  const [expSaving, setExpSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [tr, emp] = await Promise.all([
        list<any>('business_trips', { select: '*,employees(full_name,position)', order: { col: 'start_date', asc: false } }),
        list<any>('employees', { select: 'id,full_name,position', eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
      ])
      setRows(tr); setEmployees(emp)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data perjalanan dinas', 'error') }
    finally { setLoading(false) }
  }

  function openAdd() { setForm(emptyForm); setModalOpen(true) }

  async function save() {
    if (!form.employee_id || !form.destination || !form.start_date || !form.end_date) { toast.push('Karyawan, tujuan, dan periode wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const sppd_no = await nextDocNo(profile!.company_id, 'SPPD')
      await insert('business_trips', {
        company_id: profile?.company_id, employee_id: form.employee_id, sppd_no, destination: form.destination,
        purpose: form.purpose || null, start_date: form.start_date, end_date: form.end_date, transport_type: form.transport_type,
        daily_allowance: form.daily_allowance || 0, total_advance: form.total_advance || 0, status: 'diajukan', created_by: profile?.id,
      })
      toast.push('Pengajuan SPPD dibuat'); setModalOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal membuat pengajuan SPPD', 'error') }
    finally { setSaving(false) }
  }

  async function openDetail(r: any) {
    setDetail(r); setExpLoading(true)
    try {
      const ex = await list<any>('trip_expenses', { select: '*', eq: { trip_id: r.id }, order: { col: 'expense_date', asc: true } })
      setExpenses(ex)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat rincian biaya', 'error') }
    finally { setExpLoading(false) }
  }

  const totalKlaim = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0), [expenses])
  const selisih = useMemo(() => (detail ? totalKlaim - Number(detail.total_advance ?? 0) : 0), [totalKlaim, detail])

  async function addExpense() {
    if (!expForm.category || !expForm.expense_date || !expForm.amount) { toast.push('Kategori, tanggal, dan jumlah biaya wajib diisi', 'error'); return }
    setExpSaving(true)
    try {
      let receipt_url: string | null = null
      if (expFile) receipt_url = await uploadFile(profile!.company_id, 'perjalanan', expFile)
      await insert('trip_expenses', {
        company_id: profile?.company_id, trip_id: detail.id, category: expForm.category, expense_date: expForm.expense_date,
        description: expForm.description || null, amount: expForm.amount, receipt_url, status: 'diajukan', created_by: profile?.id,
      })
      toast.push('Biaya perjalanan dicatat'); setExpModalOpen(false); setExpForm(emptyExpense); setExpFile(null)
      openDetail(detail)
    } catch (e: any) { toast.push(e.message ?? 'Gagal mencatat biaya', 'error') }
    finally { setExpSaving(false) }
  }

  async function viewReceipt(path?: string | null) {
    const url = await signedUrl(path)
    if (url) window.open(url, '_blank'); else toast.push('Bukti belum tersedia', 'error')
  }

  async function setExpenseStatus(e: any, status: string) {
    setBusyId(e.id)
    try {
      await update('trip_expenses', e.id, { status })
      toast.push(status === 'diverifikasi' ? 'Biaya diverifikasi' : 'Biaya disetujui')
      openDetail(detail)
    } catch (err: any) { toast.push(err.message ?? 'Gagal memperbarui status biaya', 'error') }
    finally { setBusyId(null) }
  }

  async function advanceTripStatus(status: string) {
    setBusyId(detail.id)
    try {
      await update('business_trips', detail.id, { status, ...(status === 'disetujui' ? { approved_by: profile?.id } : {}) })
      toast.push('Status perjalanan diperbarui'); setDetail({ ...detail, status }); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal memperbarui status', 'error') }
    finally { setBusyId(null) }
  }

  const activeCount = rows.filter(r => r.status !== 'selesai' && r.status !== 'ditolak').length
  const advanceBulanIni = rows.filter(r => isThisMonth(r.start_date)).reduce((s, r) => s + Number(r.total_advance ?? 0), 0)
  const selesaiBulanIni = rows.filter(r => r.status === 'selesai' && isThisMonth(r.end_date)).length

  return (
    <div>
      <PageHeader title="Dinas & Reimbursement" subtitle="Surat Perintah Perjalanan Dinas (SPPD) dan klaim biaya perjalanan"
        actions={can('HR', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Ajukan SPPD</Button>} />

      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="Perjalanan Aktif" value={activeCount} />
        <KpiCard label="Uang Muka Bulan Ini" value={rupiah(advanceBulanIni)} />
        <KpiCard label="Selesai Bulan Ini" value={selesaiBulanIni} />
      </div>

      <DataTable
        loading={loading} rows={rows} searchKeys={['sppd_no', 'destination']} emptyTitle="Belum ada pengajuan SPPD"
        onRowClick={openDetail}
        columns={[
          { key: 'sppd_no', header: 'No. SPPD' },
          { key: 'nama', header: 'Karyawan', render: r => r.employees?.full_name ?? '-' },
          { key: 'destination', header: 'Tujuan' },
          { key: 'periode', header: 'Periode', render: r => `${tgl(r.start_date)} – ${tgl(r.end_date)}` },
          { key: 'transport_type', header: 'Moda Transport' },
          { key: 'total_advance', header: 'Uang Muka', align: 'right', render: r => rupiah(r.total_advance) },
          { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Ajukan SPPD"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Ajukan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Karyawan" required className="sm:col-span-2">
            <Select value={form.employee_id} onChange={(e: any) => setForm({ ...form, employee_id: e.target.value })} options={employees.map(e => ({ value: e.id, label: `${e.full_name} — ${e.position}` }))} />
          </Field>
          <Field label="Tujuan" required className="sm:col-span-2"><Input value={form.destination} onChange={(e: any) => setForm({ ...form, destination: e.target.value })} /></Field>
          <Field label="Keperluan" className="sm:col-span-2"><Textarea value={form.purpose} onChange={(e: any) => setForm({ ...form, purpose: e.target.value })} /></Field>
          <Field label="Tanggal Berangkat" required><Input type="date" value={form.start_date} onChange={(e: any) => setForm({ ...form, start_date: e.target.value })} /></Field>
          <Field label="Tanggal Kembali" required><Input type="date" value={form.end_date} onChange={(e: any) => setForm({ ...form, end_date: e.target.value })} /></Field>
          <Field label="Moda Transport"><Select value={form.transport_type} onChange={(e: any) => setForm({ ...form, transport_type: e.target.value })} options={TRANSPORT_TYPE_OPTIONS} /></Field>
          <Field label="Uang Harian"><Money value={form.daily_allowance} onChange={(v: number) => setForm({ ...form, daily_allowance: v })} /></Field>
          <Field label="Total Uang Muka" className="sm:col-span-2"><Money value={form.total_advance} onChange={(v: number) => setForm({ ...form, total_advance: v })} /></Field>
        </div>
      </Modal>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail ? `SPPD ${detail.sppd_no}` : ''} width="max-w-2xl"
        footer={detail && can('HR', 'approve') && (
          <>
            {detail.status === 'diajukan' && <><Button variant="danger" loading={busyId === detail.id} onClick={() => advanceTripStatus('ditolak')}>Tolak</Button><Button variant="secondary" loading={busyId === detail.id} onClick={() => advanceTripStatus('diverifikasi')}>Verifikasi Perjalanan</Button></>}
            {detail.status === 'diverifikasi' && <Button loading={busyId === detail.id} onClick={() => advanceTripStatus('disetujui')}>Setujui Perjalanan</Button>}
            {detail.status === 'disetujui' && <Button variant="success" loading={busyId === detail.id} onClick={() => advanceTripStatus('selesai')}>Tandai Selesai</Button>}
          </>
        )}>
        {detail && (
          <>
            <Stepper steps={TRIP_STEPS} current={detail.status === 'ditolak' ? 0 : Math.max(0, TRIP_STEPS.findIndex(s => s.key === detail.status))} />
            {detail.status === 'ditolak' && <div className="mt-3"><Badge tone="red">Ditolak</Badge></div>}
            <Section title="Ringkasan" className="mt-5">
              <Desc items={[
                { label: 'Karyawan', value: detail.employees?.full_name },
                { label: 'Tujuan', value: detail.destination },
                { label: 'Keperluan', value: detail.purpose },
                { label: 'Periode', value: `${tgl(detail.start_date)} – ${tgl(detail.end_date)}` },
                { label: 'Moda Transport', value: detail.transport_type },
                { label: 'Uang Harian', value: rupiah(detail.daily_allowance) },
                { label: 'Total Uang Muka', value: rupiah(detail.total_advance) },
              ]} />
            </Section>

            <Section title="Biaya Perjalanan" className="mt-5">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <KpiCard label="Total Klaim" value={rupiah(totalKlaim)} />
                <KpiCard label="Uang Muka" value={rupiah(detail.total_advance)} />
                <KpiCard label={selisih > 0 ? 'Kurang Bayar' : 'Lebih Bayar'} value={rupiah(Math.abs(selisih))} tone={selisih > 0 ? 'amber' : 'teal'} />
              </div>
              {can('HR', 'write') && <div className="mb-3"><Button size="sm" icon={<Plus size={14} />} onClick={() => { setExpForm(emptyExpense); setExpFile(null); setExpModalOpen(true) }}>Tambah Biaya</Button></div>}
              <DataTable
                loading={expLoading} rows={expenses} searchable={false} pageSize={100} emptyTitle="Belum ada biaya tercatat"
                columns={[
                  { key: 'category', header: 'Kategori' },
                  { key: 'expense_date', header: 'Tanggal', render: r => tgl(r.expense_date) },
                  { key: 'description', header: 'Keterangan' },
                  { key: 'amount', header: 'Jumlah', align: 'right', render: r => rupiah(r.amount) },
                  { key: 'receipt_url', header: 'Bukti', align: 'center', render: r => r.receipt_url ? <Button size="sm" variant="ghost" onClick={() => viewReceipt(r.receipt_url)}>Lihat</Button> : '-' },
                  { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
                  ...(can('HR', 'approve') ? [{ key: 'aksi', header: 'Aksi', align: 'center' as const, sortable: false, render: (r: any) => (
                    r.status === 'diajukan' ? <Button size="sm" variant="secondary" loading={busyId === r.id} onClick={() => setExpenseStatus(r, 'diverifikasi')}>Verifikasi</Button>
                    : r.status === 'diverifikasi' ? <Button size="sm" variant="success" loading={busyId === r.id} onClick={() => setExpenseStatus(r, 'disetujui')}>Setujui</Button>
                    : <span className="text-ink-300">-</span>
                  ) }] : []),
                ]}
              />
            </Section>
          </>
        )}
      </Drawer>

      <Modal open={expModalOpen} onClose={() => setExpModalOpen(false)} title="Tambah Biaya Perjalanan" size="sm"
        footer={<><Button variant="outline" onClick={() => setExpModalOpen(false)}>Batal</Button><Button loading={expSaving} onClick={addExpense}>Simpan</Button></>}>
        <div className="grid gap-4">
          <Field label="Kategori" required><Select value={expForm.category} onChange={(e: any) => setExpForm({ ...expForm, category: e.target.value })} options={EXPENSE_CATEGORY_OPTIONS} /></Field>
          <Field label="Tanggal" required><Input type="date" value={expForm.expense_date} onChange={(e: any) => setExpForm({ ...expForm, expense_date: e.target.value })} /></Field>
          <Field label="Keterangan"><Textarea value={expForm.description} onChange={(e: any) => setExpForm({ ...expForm, description: e.target.value })} /></Field>
          <Field label="Jumlah" required><Money value={expForm.amount} onChange={(v: number) => setExpForm({ ...expForm, amount: v })} /></Field>
          <Field label="Bukti Biaya">
            <input type="file" onChange={e => setExpFile(e.target.files?.[0] ?? null)}
              className="block w-full text-body text-ink-600 dark:text-ink-300 file:mr-3 file:py-2 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
