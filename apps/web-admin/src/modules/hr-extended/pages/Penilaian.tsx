import React, { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAuth } from '@/lib/auth'
import { list, insert, update } from '@/lib/db'
import {
  PageHeader, Card, CardHeader, DataTable, Badge, Button, Modal, Field, Select, Input, Textarea, Tabs, KpiCard,
  useToast, Plus,
} from '@/components/ui'
import { num, tgl, periodCode } from '@/lib/format'
import { REVIEW_TYPE_OPTIONS, REVIEW_STATUS_TABS, GRADE_ORDER, GRADE_TONE, gradeFromScore } from '../lib/constants'

const emptyItem = () => ({ key: Math.random().toString(36).slice(2), aspect: '', weight_percent: 0, target_value: 0, actual_value: 0, score: 0 })
const emptyForm = () => ({ employee_id: '', period_code: periodCode(), review_type: 'Bulanan', strengths: '', improvements: '', items: [emptyItem()] })

export default function Penilaian() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [tab, setTab] = useState('semua')
  const [fPeriod, setFPeriod] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(emptyForm())
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [rv, emp] = await Promise.all([
        list<any>('performance_reviews', { select: '*,employees(full_name,position)', order: { col: 'period_code', asc: false } }),
        list<any>('employees', { select: 'id,full_name,position', eq: { status: 'aktif' }, order: { col: 'full_name', asc: true } }),
      ])
      setRows(rv); setEmployees(emp)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data penilaian kinerja', 'error') }
    finally { setLoading(false) }
  }

  const periodOptions = useMemo(() => Array.from(new Set(rows.map(r => r.period_code))).sort().reverse(), [rows])
  const filtered = useMemo(() => rows.filter(r => (tab === 'semua' || r.status === tab) && (!fPeriod || r.period_code === fPeriod)), [rows, tab, fPeriod])

  const gradeChart = useMemo(() => {
    const src = fPeriod ? rows.filter(r => r.period_code === fPeriod) : rows
    return GRADE_ORDER.map(g => ({ grade: g, jumlah: src.filter(r => r.grade === g).length }))
  }, [rows, fPeriod])

  function openAdd() { setForm(emptyForm()); setModalOpen(true) }

  const totalWeight = useMemo(() => form.items.reduce((s: number, it: any) => s + (Number(it.weight_percent) || 0), 0), [form.items])
  const totalScore = useMemo(() => form.items.reduce((s: number, it: any) => s + ((Number(it.weight_percent) || 0) / 100) * (Number(it.score) || 0), 0), [form.items])
  const grade = useMemo(() => gradeFromScore(totalScore), [totalScore])

  function updateItem(key: string, patch: any) {
    setForm((f: any) => ({ ...f, items: f.items.map((it: any) => it.key === key ? { ...it, ...patch } : it) }))
  }
  function addItem() { setForm((f: any) => ({ ...f, items: [...f.items, emptyItem()] })) }
  function removeItem(key: string) { setForm((f: any) => ({ ...f, items: f.items.filter((it: any) => it.key !== key) })) }

  async function save(submit: boolean) {
    if (!form.employee_id || !form.period_code) { toast.push('Karyawan dan periode wajib diisi', 'error'); return }
    if (form.items.some((it: any) => !it.aspect)) { toast.push('Setiap aspek penilaian wajib memiliki nama', 'error'); return }
    if (submit && Math.round(totalWeight) !== 100) { toast.push(`Total bobot harus 100% (saat ini ${totalWeight}%)`, 'error'); return }
    setSaving(true)
    try {
      const review = await insert('performance_reviews', {
        company_id: profile?.company_id, employee_id: form.employee_id, period_code: form.period_code, review_type: form.review_type,
        strengths: form.strengths || null, improvements: form.improvements || null, total_score: Math.round(totalScore * 100) / 100,
        grade, status: submit ? 'diajukan' : 'draft', created_by: profile?.id,
      })
      for (const it of form.items) {
        await insert('performance_review_items', {
          company_id: profile?.company_id, review_id: review.id, aspect: it.aspect, weight_percent: it.weight_percent,
          target_value: it.target_value || null, actual_value: it.actual_value || null, score: it.score, created_by: profile?.id,
        })
      }
      toast.push('Penilaian kinerja disimpan'); setModalOpen(false); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan penilaian kinerja', 'error') }
    finally { setSaving(false) }
  }

  async function approve(r: any) {
    setBusyId(r.id)
    try {
      await update('performance_reviews', r.id, { status: 'disetujui', reviewer_id: profile?.employee_id ?? null, reviewed_at: new Date().toISOString() })
      toast.push('Penilaian kinerja disetujui'); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyetujui penilaian', 'error') }
    finally { setBusyId(null) }
  }

  return (
    <div>
      <PageHeader title="Penilaian Kinerja" subtitle="Penilaian kinerja karyawan berbasis aspek dan bobot"
        actions={can('HR', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Buat Penilaian</Button>} />

      <Card className="mb-4">
        <CardHeader title="Sebaran Grade" subtitle={fPeriod || 'Seluruh periode'}
          action={<div className="w-44"><Select value={fPeriod} onChange={(e: any) => setFPeriod(e.target.value)} placeholder="Semua periode" options={periodOptions} /></div>} />
        <div className="p-4" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gradeChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="grade" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: any) => [`${v} penilaian`, 'Jumlah']} />
              <Bar dataKey="jumlah" radius={[4, 4, 0, 0]}>
                {gradeChart.map((g, i) => <Cell key={i} fill={{ A: '#16A34A', B: '#1B8A92', C: '#F5A524', D: '#F59E0B', E: '#E11D48' }[g.grade]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="px-4 pb-3 text-caption text-ink-400">Sumber: performance_reviews — ditarik {tgl(new Date().toISOString())}.</p>
      </Card>

      <Tabs className="mb-4" value={tab} onChange={setTab}
        tabs={REVIEW_STATUS_TABS.map(t => ({ ...t, count: t.value === 'semua' ? rows.length : rows.filter(r => r.status === t.value).length }))} />

      <DataTable
        loading={loading} rows={filtered} searchKeys={['period_code']} emptyTitle="Belum ada penilaian kinerja"
        columns={[
          { key: 'nama', header: 'Karyawan', render: r => r.employees?.full_name ?? '-' },
          { key: 'period_code', header: 'Periode' },
          { key: 'review_type', header: 'Jenis' },
          { key: 'total_score', header: 'Total Skor', align: 'right', render: r => num(r.total_score, 1) },
          { key: 'grade', header: 'Grade', align: 'center', render: r => <Badge tone={GRADE_TONE[r.grade] as any}>{r.grade ?? '-'}</Badge> },
          { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
          ...(can('HR', 'approve') ? [{ key: 'aksi', header: 'Aksi', align: 'center' as const, sortable: false, render: (r: any) => r.status === 'diajukan' ? (
            <Button size="sm" variant="success" loading={busyId === r.id} onClick={() => approve(r)}>Setujui</Button>
          ) : <span className="text-ink-300">-</span> }] : []),
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Buat Penilaian Kinerja" size="xl"
        footer={<>
          <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
          <Button variant="secondary" loading={saving} onClick={() => save(false)}>Simpan Draft</Button>
          <Button loading={saving} onClick={() => save(true)}>Ajukan Penilaian</Button>
        </>}>
        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <Field label="Karyawan" required className="sm:col-span-2"><Select value={form.employee_id} onChange={(e: any) => setForm({ ...form, employee_id: e.target.value })} options={employees.map(e => ({ value: e.id, label: e.full_name }))} /></Field>
          <Field label="Periode" required><Input value={form.period_code} onChange={(e: any) => setForm({ ...form, period_code: e.target.value })} placeholder="YYYY-MM" /></Field>
          <Field label="Jenis Penilaian"><Select value={form.review_type} onChange={(e: any) => setForm({ ...form, review_type: e.target.value })} options={REVIEW_TYPE_OPTIONS} /></Field>
        </div>

        <div className="rounded-md border border-ink-200 dark:border-ink-800 overflow-hidden mb-2">
          <table className="w-full text-caption">
            <thead className="bg-ink-50 dark:bg-surface-darker">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-ink-500">Aspek</th>
                <th className="text-right px-3 py-2 font-semibold text-ink-500 w-24">Bobot %</th>
                <th className="text-right px-3 py-2 font-semibold text-ink-500 w-24">Target</th>
                <th className="text-right px-3 py-2 font-semibold text-ink-500 w-24">Realisasi</th>
                <th className="text-right px-3 py-2 font-semibold text-ink-500 w-24">Skor</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((it: any) => (
                <tr key={it.key} className="border-t border-ink-100 dark:border-ink-800">
                  <td className="px-3 py-1.5"><Input value={it.aspect} onChange={(e: any) => updateItem(it.key, { aspect: e.target.value })} placeholder="Nama aspek" /></td>
                  <td className="px-3 py-1.5"><Input type="number" className="text-right" value={it.weight_percent} onChange={(e: any) => updateItem(it.key, { weight_percent: Number(e.target.value) })} /></td>
                  <td className="px-3 py-1.5"><Input type="number" className="text-right" value={it.target_value} onChange={(e: any) => updateItem(it.key, { target_value: Number(e.target.value) })} /></td>
                  <td className="px-3 py-1.5"><Input type="number" className="text-right" value={it.actual_value} onChange={(e: any) => updateItem(it.key, { actual_value: Number(e.target.value) })} /></td>
                  <td className="px-3 py-1.5"><Input type="number" min={0} max={100} className="text-right" value={it.score} onChange={(e: any) => updateItem(it.key, { score: Number(e.target.value) })} /></td>
                  <td className="px-2 py-1.5 text-center">{form.items.length > 1 && <button className="text-ink-400 hover:text-red-600" onClick={() => removeItem(it.key)}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={addItem}>Tambah Aspek</Button>

        <div className={`mt-4 rounded-sm px-3 py-2 text-caption ${Math.round(totalWeight) === 100 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
          Total bobot: {totalWeight}% {Math.round(totalWeight) !== 100 && '— harus 100% sebelum diajukan'}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-md border border-ink-200 dark:border-ink-800 px-4 py-3">
          <span className="text-body font-medium text-ink-700 dark:text-ink-200">Total Skor & Grade</span>
          <span className="flex items-center gap-2 text-body-l font-bold text-ink-900 dark:text-ink-50">{num(totalScore, 1)} <Badge tone={GRADE_TONE[grade] as any}>{grade}</Badge></span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Field label="Kekuatan"><Textarea value={form.strengths} onChange={(e: any) => setForm({ ...form, strengths: e.target.value })} /></Field>
          <Field label="Area Pengembangan"><Textarea value={form.improvements} onChange={(e: any) => setForm({ ...form, improvements: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}
