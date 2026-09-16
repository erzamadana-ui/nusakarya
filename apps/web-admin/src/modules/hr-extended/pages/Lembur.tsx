import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo } from '@/lib/db'
import {
  PageHeader, DataTable, Badge, Button, Modal, Field, Select, Input, Textarea, Tabs, KpiCard, useToast, Plus,
} from '@/components/ui'
import { rupiah, num, tgl, todayISO } from '@/lib/format'
import { OVERTIME_STATUS_TABS } from '../lib/constants'
import { calcOvertimeAmount, isRestDay, weekRange, hoursBetween } from '../lib/overtime'

const emptyForm = { employee_id: '', work_date: todayISO(), jam_mulai: '17:00', jam_selesai: '19:00', reason: '', work_order_id: '' }

export default function Lembur() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [salaries, setSalaries] = useState<any[]>([])
  const [tab, setTab] = useState('diajukan')

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)

  const [reject, setReject] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [ov, emp, wo, basic] = await Promise.all([
        list<any>('overtime_requests', { select: '*,employees(full_name,position),work_orders(wo_no,title)', order: { col: 'work_date', asc: false } }),
        list<any>('employees', { select: 'id,full_name,position', eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
        list<any>('work_orders', { select: 'id,wo_no,title', order: { col: 'created_at', asc: false }, limit: 300 }),
        list<any>('salary_components', { select: 'id,code', eq: { code: 'BASIC' }, limit: 1 }),
      ])
      let sal: any[] = []
      if (basic?.[0]?.id) {
        sal = await list<any>('employee_salaries', { select: 'employee_id,amount,effective_date,end_date', eq: { component_id: basic[0].id } })
      }
      setRows(ov); setEmployees(emp); setWorkOrders(wo); setSalaries(sal)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data lembur', 'error') }
    finally { setLoading(false) }
  }

  function basicSalaryFor(employeeId: string, dateStr: string): number {
    if (!employeeId || !dateStr) return 0
    const cand = salaries
      .filter(s => s.employee_id === employeeId && s.effective_date <= dateStr && (!s.end_date || s.end_date >= dateStr))
      .sort((a, b) => (a.effective_date < b.effective_date ? 1 : -1))
    return Number(cand[0]?.amount ?? 0)
  }

  const filtered = useMemo(() => {
    if (tab === 'semua') return rows
    return rows.filter(r => r.status === tab)
  }, [rows, tab])

  function openAdd() { setForm(emptyForm); setModalOpen(true) }

  const hours = useMemo(() => hoursBetween(form.jam_mulai, form.jam_selesai), [form.jam_mulai, form.jam_selesai])
  const restDay = useMemo(() => isRestDay(form.work_date), [form.work_date])
  const basicSalary = useMemo(() => basicSalaryFor(form.employee_id, form.work_date), [form.employee_id, form.work_date, salaries])
  const calc = useMemo(() => calcOvertimeAmount(basicSalary, hours, restDay), [basicSalary, hours, restDay])

  const weeklyTotalHours = useMemo(() => {
    if (!form.employee_id || !form.work_date) return hours
    const [wStart, wEnd] = weekRange(form.work_date)
    const existing = rows
      .filter(r => r.employee_id === form.employee_id && r.status !== 'ditolak' && r.work_date >= wStart && r.work_date <= wEnd)
      .reduce((s, r) => s + Number(r.hours ?? 0), 0)
    return existing + hours
  }, [rows, form.employee_id, form.work_date, hours])

  async function save() {
    if (!form.employee_id || !form.work_date || !form.jam_mulai || !form.jam_selesai) { toast.push('Karyawan, tanggal, dan jam wajib diisi', 'error'); return }
    if (hours <= 0) { toast.push('Jam selesai harus setelah jam mulai', 'error'); return }
    setSaving(true)
    try {
      const spl_no = await nextDocNo(profile!.company_id, 'SPL')
      await insert('overtime_requests', {
        company_id: profile?.company_id, employee_id: form.employee_id, spl_no,
        work_date: form.work_date, start_at: `${form.work_date}T${form.jam_mulai}:00`, end_at: `${form.work_date}T${form.jam_selesai}:00`,
        hours, reason: form.reason || null, work_order_id: form.work_order_id || null,
        calculated_amount: Math.round(calc.total), status: 'diajukan', created_by: profile?.id,
      })
      toast.push('Pengajuan lembur (SPL) dibuat'); setModalOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal membuat pengajuan lembur', 'error') }
    finally { setSaving(false) }
  }

  async function approve(r: any) {
    setBusyId(r.id)
    try {
      await update('overtime_requests', r.id, { status: 'disetujui', approved_by: profile?.id, approved_at: new Date().toISOString() })
      toast.push('Pengajuan lembur disetujui'); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyetujui pengajuan', 'error') }
    finally { setBusyId(null) }
  }
  async function submitReject() {
    if (!rejectReason.trim()) { toast.push('Alasan penolakan wajib diisi', 'error'); return }
    setBusyId(reject.id)
    try {
      await update('overtime_requests', reject.id, {
        status: 'ditolak', approved_by: profile?.id, approved_at: new Date().toISOString(),
        reason: `${reject.reason ?? ''}\n\nAlasan penolakan: ${rejectReason}`.trim(),
      })
      toast.push('Pengajuan lembur ditolak'); setReject(null); setRejectReason(''); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menolak pengajuan', 'error') }
    finally { setBusyId(null) }
  }

  const bulanIni = rows.filter(r => { const d = new Date(r.work_date); const n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() })
  const totalJamBulanIni = bulanIni.reduce((s, r) => s + Number(r.hours ?? 0), 0)
  const totalBiayaBulanIni = bulanIni.filter(r => r.status !== 'ditolak').reduce((s, r) => s + Number(r.calculated_amount ?? 0), 0)

  return (
    <div>
      <PageHeader title="Pengajuan Lembur (SPL)" subtitle="Surat Perintah Lembur & estimasi upah lembur karyawan"
        actions={can('HR', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Ajukan SPL</Button>} />

      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="Pengajuan Bulan Ini" value={num(bulanIni.length)} />
        <KpiCard label="Total Jam Lembur Bulan Ini" value={`${num(totalJamBulanIni, 1)} jam`} />
        <KpiCard label="Estimasi Biaya Bulan Ini" value={rupiah(totalBiayaBulanIni)} sub="Tidak termasuk yang ditolak" />
      </div>

      <Tabs className="mb-4" value={tab} onChange={setTab}
        tabs={OVERTIME_STATUS_TABS.map(t => ({ ...t, count: t.value === 'semua' ? rows.length : rows.filter(r => r.status === t.value).length }))} />

      <DataTable
        loading={loading} rows={filtered} searchKeys={['spl_no']} emptyTitle="Belum ada pengajuan lembur"
        columns={[
          { key: 'spl_no', header: 'No. SPL' },
          { key: 'nama', header: 'Karyawan', render: r => r.employees?.full_name ?? '-' },
          { key: 'work_date', header: 'Tanggal', render: r => tgl(r.work_date) },
          { key: 'jam', header: 'Jam', render: r => `${new Date(r.start_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}–${new Date(r.end_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` },
          { key: 'hours', header: 'Durasi', align: 'right', render: r => `${num(r.hours, 1)} jam` },
          { key: 'hari', header: 'Jenis Hari', render: r => isRestDay(r.work_date) ? <Badge tone="amber">Hari Libur</Badge> : <Badge tone="slate">Hari Kerja</Badge> },
          { key: 'calculated_amount', header: 'Estimasi Upah', align: 'right', render: r => rupiah(r.calculated_amount) },
          { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
          ...(can('HR', 'approve') ? [{ key: 'aksi', header: 'Aksi', align: 'center' as const, sortable: false, render: (r: any) => r.status === 'diajukan' ? (
            <div className="flex items-center gap-1.5 justify-center">
              <Button size="sm" variant="success" loading={busyId === r.id} onClick={() => approve(r)}>Setujui</Button>
              <Button size="sm" variant="danger" onClick={() => { setReject(r); setRejectReason('') }}>Tolak</Button>
            </div>) : <span className="text-ink-300">-</span> }] : []),
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Ajukan Surat Perintah Lembur (SPL)" size="lg"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Ajukan</Button></>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Karyawan" required className="sm:col-span-2">
            <Select value={form.employee_id} onChange={(e: any) => setForm({ ...form, employee_id: e.target.value })} options={employees.map(e => ({ value: e.id, label: `${e.full_name} — ${e.position}` }))} />
          </Field>
          <Field label="Tanggal Lembur" required><Input type="date" value={form.work_date} onChange={(e: any) => setForm({ ...form, work_date: e.target.value })} /></Field>
          <Field label="Terkait Work Order (opsional)">
            <Select value={form.work_order_id} onChange={(e: any) => setForm({ ...form, work_order_id: e.target.value })} options={workOrders.map(w => ({ value: w.id, label: `${w.wo_no} — ${w.title}` }))} />
          </Field>
          <Field label="Jam Mulai" required><Input type="time" value={form.jam_mulai} onChange={(e: any) => setForm({ ...form, jam_mulai: e.target.value })} /></Field>
          <Field label="Jam Selesai" required><Input type="time" value={form.jam_selesai} onChange={(e: any) => setForm({ ...form, jam_selesai: e.target.value })} /></Field>
          <Field label="Alasan Lembur" className="sm:col-span-2"><Textarea value={form.reason} onChange={(e: any) => setForm({ ...form, reason: e.target.value })} /></Field>
        </div>

        {(hours > 4 || weeklyTotalHours > 18) && (
          <div className="mt-4 rounded-sm border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-caption text-amber-700 dark:text-amber-300">
            {hours > 4 && <p>Durasi lembur ({num(hours, 1)} jam) melewati batas maksimal 4 jam/hari.</p>}
            {weeklyTotalHours > 18 && <p>Total lembur minggu ini ({num(weeklyTotalHours, 1)} jam) melewati batas maksimal 18 jam/minggu.</p>}
          </div>
        )}

        <div className="mt-4 rounded-md border border-ink-200 dark:border-ink-800 overflow-hidden">
          <div className="px-3.5 py-2.5 bg-ink-50 dark:bg-surface-darker text-caption font-semibold text-ink-600 dark:text-ink-300 flex items-center justify-between">
            <span>Rincian Perhitungan Upah Lembur</span>
            <Badge tone={restDay ? 'amber' : 'slate'}>{restDay ? 'Hari Libur' : 'Hari Kerja'}</Badge>
          </div>
          <div className="px-3.5 py-2.5 text-caption text-ink-500">
            Gaji pokok: <span className="text-ink-800 dark:text-ink-100 font-medium">{rupiah(basicSalary)}</span> · Upah sejam (÷173): <span className="text-ink-800 dark:text-ink-100 font-medium">{rupiah(calc.hourlyWage)}</span>
            {!basicSalary && <span className="block mt-1 text-amber-600">Komponen Gaji Pokok belum ditemukan untuk karyawan/tanggal ini — estimasi Rp 0.</span>}
          </div>
          {calc.lines.length > 0 && (
            <table className="w-full text-caption">
              <thead><tr className="border-t border-ink-200 dark:border-ink-800 text-ink-400">
                <th className="text-left px-3.5 py-1.5 font-medium">Jam ke-</th>
                <th className="text-right px-3.5 py-1.5 font-medium">Pengali</th>
                <th className="text-right px-3.5 py-1.5 font-medium">Upah</th>
              </tr></thead>
              <tbody>
                {calc.lines.map(l => (
                  <tr key={l.jam} className="border-t border-ink-100 dark:border-ink-800">
                    <td className="px-3.5 py-1.5">{l.jam}</td>
                    <td className="px-3.5 py-1.5 text-right">{l.pengali}×</td>
                    <td className="px-3.5 py-1.5 text-right tabular">{rupiah(l.upah)}</td>
                  </tr>))}
              </tbody>
            </table>
          )}
          <div className="px-3.5 py-2.5 border-t border-ink-200 dark:border-ink-800 flex items-center justify-between font-semibold">
            <span className="text-body text-ink-700 dark:text-ink-200">Total Estimasi Upah Lembur</span>
            <span className="text-body-l text-ink-900 dark:text-ink-50 tabular">{rupiah(calc.total)}</span>
          </div>
          <p className="px-3.5 pb-2.5 text-caption text-ink-400">Sumber: PP 35/2021 Pasal 31, wajib diverifikasi HR sebelum pembayaran.</p>
        </div>
      </Modal>

      <Modal open={!!reject} onClose={() => setReject(null)} title="Tolak Pengajuan Lembur" size="sm"
        footer={<><Button variant="outline" onClick={() => setReject(null)}>Batal</Button><Button variant="danger" loading={busyId === reject?.id} onClick={submitReject}>Tolak Pengajuan</Button></>}>
        <Field label="Alasan Penolakan" required><Textarea value={rejectReason} onChange={(e: any) => setRejectReason(e.target.value)} placeholder="Wajib diisi" /></Field>
      </Modal>
    </div>
  )
}
