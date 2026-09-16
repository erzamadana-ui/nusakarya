import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import {
  PageHeader, DataTable, Badge, Button, Modal, Drawer, Field, Select, Input, Money, Checkbox, useToast, Plus, EmptyState, TableSkeleton,
} from '@/components/ui'
import { rupiah, tgl, todayISO } from '@/lib/format'
import { SALARY_COMPONENT_TYPE_OPTIONS, SALARY_CALC_TYPE_OPTIONS } from '../lib/constants'
import { Users2 } from 'lucide-react'

const emptyForm = { id: null, code: '', name: '', component_type: 'earning', calc_type: 'fixed', taxable: false, is_bpjs_base: false, default_amount: 0, formula: '', is_active: true }
const emptyAssign = { component_id: '', amount: 0, effective_date: todayISO(), end_date: '' }

export default function KomponenGaji() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [empSel, setEmpSel] = useState('')
  const [assignments, setAssignments] = useState<any[] | null>(null)
  const [assignForm, setAssignForm] = useState<any>(emptyAssign)
  const [assignSaving, setAssignSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [sc, emp] = await Promise.all([
        list<any>('salary_components', { order: { col: 'component_type', asc: true } }),
        list<any>('employees', { select: 'id,full_name,position', eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
      ])
      setRows(sc); setEmployees(emp)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat komponen gaji', 'error') }
    finally { setLoading(false) }
  }

  function openAdd() { setForm(emptyForm); setModalOpen(true) }
  function openEdit(r: any) { setForm(r); setModalOpen(true) }

  async function save() {
    if (!form.code || !form.name) { toast.push('Kode dan nama komponen wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const payload = { code: form.code, name: form.name, component_type: form.component_type, calc_type: form.calc_type, taxable: form.taxable, is_bpjs_base: form.is_bpjs_base, default_amount: form.default_amount || 0, formula: form.formula || null, is_active: form.is_active }
      if (form.id) { await update('salary_components', form.id, payload); toast.push('Komponen gaji diperbarui') }
      else { await insert('salary_components', { ...payload, company_id: profile?.company_id, created_by: profile?.id }); toast.push('Komponen gaji ditambahkan') }
      setModalOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan komponen gaji', 'error') }
    finally { setSaving(false) }
  }

  async function openDrawer() { setDrawerOpen(true); setEmpSel(''); setAssignments(null) }
  async function pickEmployee(id: string) {
    setEmpSel(id); setAssignments(null)
    if (!id) return
    try { setAssignments(await list('employee_salaries', { select: '*,salary_components(name,component_type)', eq: { employee_id: id }, order: { col: 'effective_date', asc: false } })) }
    catch (e: any) { toast.push(e.message ?? 'Gagal memuat penetapan gaji', 'error') }
  }

  async function addAssignment() {
    if (!assignForm.component_id || !assignForm.effective_date) { toast.push('Komponen dan tanggal berlaku wajib diisi', 'error'); return }
    setAssignSaving(true)
    try {
      await insert('employee_salaries', {
        company_id: profile?.company_id, employee_id: empSel, component_id: assignForm.component_id,
        amount: assignForm.amount || 0, effective_date: assignForm.effective_date, end_date: assignForm.end_date || null, created_by: profile?.id,
      })
      toast.push('Komponen gaji ditetapkan'); setAssignForm(emptyAssign); pickEmployee(empSel)
    } catch (e: any) { toast.push(e.message ?? 'Gagal menetapkan komponen gaji', 'error') }
    finally { setAssignSaving(false) }
  }
  async function removeAssignment(id: string) {
    try { await remove('employee_salaries', id); toast.push('Penetapan komponen dihapus'); pickEmployee(empSel) }
    catch (e: any) { toast.push(e.message ?? 'Gagal menghapus penetapan', 'error') }
  }

  return (
    <div>
      <PageHeader title="Komponen Gaji" subtitle="Master komponen penggajian dan penetapan gaji per karyawan"
        actions={<>
          <Button variant="outline" icon={<Users2 size={16} />} onClick={openDrawer}>Penetapan Gaji Karyawan</Button>
          {can('PAYROLL', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Komponen</Button>}
        </>} />

      <DataTable
        loading={loading} rows={rows} onRowClick={can('PAYROLL', 'write') ? openEdit : undefined}
        searchKeys={['code', 'name']} emptyTitle="Belum ada komponen gaji"
        columns={[
          { key: 'code', header: 'Kode', width: '110px' },
          { key: 'name', header: 'Nama Komponen' },
          { key: 'component_type', header: 'Tipe', render: r => <Badge tone={r.component_type === 'deduction' ? 'red' : 'emerald'}>{r.component_type === 'deduction' ? 'Pengurang' : 'Penambah'}</Badge> },
          { key: 'calc_type', header: 'Cara Hitung' },
          { key: 'taxable', header: 'Kena Pajak', align: 'center', render: r => r.taxable ? <Badge tone="amber">Ya</Badge> : <Badge tone="slate">Tidak</Badge> },
          { key: 'is_bpjs_base', header: 'Dasar BPJS', align: 'center', render: r => r.is_bpjs_base ? <Badge tone="teal">Ya</Badge> : <Badge tone="slate">Tidak</Badge> },
          { key: 'default_amount', header: 'Nominal Default', align: 'right', render: r => rupiah(r.default_amount) },
          { key: 'is_active', header: 'Status', render: r => r.is_active ? <Badge tone="emerald">Aktif</Badge> : <Badge tone="slate">Nonaktif</Badge> },
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? 'Ubah Komponen Gaji' : 'Tambah Komponen Gaji'}
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Kode" required><Input value={form.code} onChange={(e: any) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Nama Komponen" required><Input value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Tipe"><Select value={form.component_type} onChange={(e: any) => setForm({ ...form, component_type: e.target.value })} options={SALARY_COMPONENT_TYPE_OPTIONS} /></Field>
          <Field label="Cara Hitung"><Select value={form.calc_type} onChange={(e: any) => setForm({ ...form, calc_type: e.target.value })} options={SALARY_CALC_TYPE_OPTIONS} /></Field>
          <Field label="Nominal Default"><Money value={form.default_amount} onChange={(v: number) => setForm({ ...form, default_amount: v })} /></Field>
          {form.calc_type === 'formula' && <Field label="Catatan Formula"><Input value={form.formula ?? ''} onChange={(e: any) => setForm({ ...form, formula: e.target.value })} placeholder="mis. tarif per jam lembur" /></Field>}
          <div className="sm:col-span-2 flex items-center gap-6">
            <Checkbox label="Kena pajak (PPh 21)" checked={form.taxable} onChange={(e: any) => setForm({ ...form, taxable: e.target.checked })} />
            <Checkbox label="Termasuk dasar BPJS" checked={form.is_bpjs_base} onChange={(e: any) => setForm({ ...form, is_bpjs_base: e.target.checked })} />
            <Checkbox label="Aktif" checked={form.is_active} onChange={(e: any) => setForm({ ...form, is_active: e.target.checked })} />
          </div>
        </div>
      </Modal>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Penetapan Gaji Karyawan" width="max-w-xl">
        <Field label="Pilih Karyawan"><Select value={empSel} onChange={(e: any) => pickEmployee(e.target.value)} options={employees.map(e => ({ value: e.id, label: `${e.full_name} — ${e.position}` }))} /></Field>
        {empSel && <>
          <div className="mt-4 mb-5 p-3 rounded-md border border-ink-200 dark:border-ink-800 grid sm:grid-cols-4 gap-3 items-end">
            <Field label="Komponen" className="sm:col-span-2"><Select value={assignForm.component_id} onChange={(e: any) => setAssignForm({ ...assignForm, component_id: e.target.value })} options={rows.filter(r => r.is_active).map(r => ({ value: r.id, label: `${r.code} — ${r.name}` }))} /></Field>
            <Field label="Nominal"><Money value={assignForm.amount} onChange={(v: number) => setAssignForm({ ...assignForm, amount: v })} /></Field>
            <Field label="Berlaku Sejak"><Input type="date" value={assignForm.effective_date} onChange={(e: any) => setAssignForm({ ...assignForm, effective_date: e.target.value })} /></Field>
            <Button className="sm:col-span-4" size="sm" loading={assignSaving} onClick={addAssignment}>Tambahkan Komponen</Button>
          </div>
          {assignments === null ? <TableSkeleton rows={3} /> : assignments.length === 0 ? <EmptyState title="Belum ada komponen ditetapkan" /> : (
            <div className="space-y-1.5">
              {assignments.map(a => (
                <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-sm border border-ink-200 dark:border-ink-800">
                  <div>
                    <p className="font-medium text-ink-800 dark:text-ink-100">{a.salary_components?.name}</p>
                    <p className="text-caption text-ink-400">{rupiah(a.amount)} · sejak {tgl(a.effective_date)}{a.end_date ? ` s.d. ${tgl(a.end_date)}` : ''}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeAssignment(a.id)}>Hapus</Button>
                </div>))}
            </div>)}
        </>}
      </Drawer>
    </div>
  )
}
