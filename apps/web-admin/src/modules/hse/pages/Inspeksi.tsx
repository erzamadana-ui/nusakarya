import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { list, insert, nextDocNo } from '@/lib/db'
import {
  PageHeader, Card, CardHeader, DataTable, Badge, Button, Modal, Drawer, Field, Input, Select, Textarea,
  Checkbox, KpiCard, Desc, Section, useToast, Plus, cx,
} from '@/components/ui'
import { tgl, num, todayISO } from '@/lib/format'
import PhotoUploader from '../components/PhotoUploader'
import {
  INSPECTION_TYPES, inspectionTypeLabel, CHECKLIST_TEMPLATES, INSPECTION_RESULT_NOTE, INSPECTION_RESULTS,
  inspectionResultLabel, inspectionResultTone, computeInspectionResult, ChecklistItem,
} from '../lib/constants'

function newForm() {
  return {
    inspection_date: todayISO(), inspection_type: '', branch_id: '', inspector_id: '', target_ref: '',
    items: [] as ChecklistItem[], photo_urls: [] as string[], follow_up: '', due_date: '',
  }
}

export default function Inspeksi() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const writable = can('OPERATIONS', 'write')

  const [loading, setLoading] = useState(true)
  const [inspections, setInspections] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])

  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<any>(newForm())
  const [saving, setSaving] = useState(false)

  const [selected, setSelected] = useState<any>(null)

  useEffect(() => { if (profile?.company_id) loadAll() }, [profile?.company_id])

  async function loadAll() {
    setLoading(true)
    try {
      const [ins, br, emp] = await Promise.all([
        list('hse_inspections', { eq: { company_id: profile!.company_id }, order: { col: 'inspection_date', asc: false }, limit: 2000 }),
        list('branches', { select: 'id,name', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
        list('employees', { select: 'id,full_name,position', eq: { company_id: profile!.company_id, status: 'aktif' }, order: { col: 'full_name', asc: true }, limit: 1000 }),
      ])
      setInspections(ins); setBranches(br); setEmployees(emp)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data inspeksi', 'error') }
    finally { setLoading(false) }
  }

  const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'
  const empName = (id?: string) => employees.find(e => e.id === id)?.full_name ?? '-'

  const kpi = useMemo(() => {
    const g: Record<string, number> = { aman: 0, perlu_perbaikan: 0, tidak_aman: 0 }
    inspections.forEach(i => { if (i.result && g[i.result] != null) g[i.result] += 1 })
    return { total: inspections.length, aman: g.aman, perlu_perbaikan: g.perlu_perbaikan, tidak_aman: g.tidak_aman }
  }, [inspections])

  /* ---------------- Form baru ---------------- */
  function openNew() { setForm(newForm()); setNewOpen(true) }
  function onTypeChange(type: string) {
    const items: ChecklistItem[] = (CHECKLIST_TEMPLATES[type] ?? []).map(item => ({ item, pass: false, note: '' }))
    setForm((f: any) => ({ ...f, inspection_type: type, items }))
  }
  function toggleItem(i: number) {
    setForm((f: any) => ({ ...f, items: f.items.map((it: ChecklistItem, idx: number) => idx === i ? { ...it, pass: !it.pass } : it) }))
  }
  function noteItem(i: number, note: string) {
    setForm((f: any) => ({ ...f, items: f.items.map((it: ChecklistItem, idx: number) => idx === i ? { ...it, note } : it) }))
  }
  const livePreview = useMemo(() => computeInspectionResult(form.items), [form.items])

  async function submitNew() {
    if (!form.inspection_date || !form.inspection_type || !form.branch_id || !form.inspector_id || form.items.length === 0) {
      toast.push('Lengkapi tanggal, jenis, cabang, inspektor, dan checklist terlebih dahulu', 'error'); return
    }
    setSaving(true)
    try {
      const inspectionNo = await nextDocNo(profile!.company_id, 'INS')
      const { score, result } = computeInspectionResult(form.items)
      await insert('hse_inspections', {
        company_id: profile!.company_id, inspection_no: inspectionNo, inspection_date: form.inspection_date,
        inspection_type: form.inspection_type, branch_id: form.branch_id, inspector_id: form.inspector_id,
        target_ref: form.target_ref || null, findings: form.items, score, result, photo_urls: form.photo_urls,
        follow_up: form.follow_up || null, due_date: form.due_date || null, status: 'selesai', created_by: profile!.id,
      })
      toast.push(`Inspeksi ${inspectionNo} berhasil disimpan — hasil: ${inspectionResultLabel(result)}`, result === 'tidak_aman' ? 'error' : 'success')
      setNewOpen(false); await loadAll()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan inspeksi', 'error') }
    finally { setSaving(false) }
  }

  const overdue = (due?: string | null) => due && due < todayISO()

  return (
    <div>
      <PageHeader title="Inspeksi APD & Alat" subtitle="Inspeksi K3 lapangan dengan checklist dinamis per jenis"
        actions={writable && <Button icon={<Plus size={16} />} onClick={openNew}>Inspeksi Baru</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total Inspeksi" value={loading ? '…' : num(kpi.total)} />
        <KpiCard label="Aman" value={loading ? '…' : num(kpi.aman)} tone="emerald" />
        <KpiCard label="Perlu Perbaikan" value={loading ? '…' : num(kpi.perlu_perbaikan)} tone="amber" />
        <KpiCard label="Tidak Aman" value={loading ? '…' : num(kpi.tidak_aman)} tone={kpi.tidak_aman > 0 ? 'red' : 'teal'} />
      </div>
      <p className="text-caption text-ink-400 mb-4">{INSPECTION_RESULT_NOTE}</p>

      <DataTable
        loading={loading} rows={inspections} onRowClick={setSelected}
        searchKeys={['inspection_no', 'target_ref']} exportName="inspeksi-k3"
        emptyTitle="Belum ada inspeksi" emptyMessage="Inspeksi yang disimpan akan muncul di sini."
        columns={[
          { key: 'inspection_no', header: 'No Inspeksi' },
          { key: 'inspection_date', header: 'Tanggal', render: r => tgl(r.inspection_date) },
          { key: 'inspection_type', header: 'Jenis', render: r => inspectionTypeLabel(r.inspection_type) },
          { key: 'branch_id', header: 'Cabang', render: r => branchName(r.branch_id) },
          { key: 'inspector_id', header: 'Inspektor', render: r => empName(r.inspector_id) },
          { key: 'score', header: 'Skor', align: 'right', render: r => r.score != null ? `${num(r.score, 1)}%` : '-' },
          { key: 'result', header: 'Hasil', render: r => <Badge tone={inspectionResultTone(r.result)}>{inspectionResultLabel(r.result)}</Badge> },
          { key: 'due_date', header: 'Tenggat Tindak Lanjut', render: r => r.due_date ? <span className={overdue(r.due_date) ? 'text-red-600 dark:text-red-400 font-medium' : ''}>{tgl(r.due_date)}{overdue(r.due_date) ? ' · Lewat' : ''}</span> : '-' },
        ]}
      />

      {/* Modal inspeksi baru */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Inspeksi K3 Baru" size="lg"
        footer={<><Button variant="outline" onClick={() => setNewOpen(false)}>Batal</Button>
          <Button loading={saving} onClick={submitNew}>Simpan Inspeksi</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="No Inspeksi"><Input value="Otomatis saat disimpan (INS/…)" disabled /></Field>
            <Field label="Tanggal Inspeksi" required><Input type="date" value={form.inspection_date} onChange={(e: any) => setForm({ ...form, inspection_date: e.target.value })} /></Field>
            <Field label="Jenis Inspeksi" required><Select options={INSPECTION_TYPES} value={form.inspection_type} onChange={(e: any) => onTypeChange(e.target.value)} /></Field>
            <Field label="Cabang" required><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={form.branch_id} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value })} /></Field>
            <Field label="Inspektor" required><Select options={employees.map(e => ({ value: e.id, label: `${e.full_name} — ${e.position ?? ''}` }))} value={form.inspector_id} onChange={(e: any) => setForm({ ...form, inspector_id: e.target.value })} /></Field>
            <Field label="Referensi Objek" hint="Contoh: Kendaraan B 1234 XX, WO/2026/000123, ODP-01"><Input value={form.target_ref} onChange={(e: any) => setForm({ ...form, target_ref: e.target.value })} /></Field>
          </div>

          {form.inspection_type && (
            <div className="border border-ink-200 dark:border-ink-800 rounded-md">
              <div className="px-4 py-2.5 border-b border-ink-200 dark:border-ink-800 flex items-center justify-between">
                <span className="text-caption font-semibold uppercase tracking-wide text-ink-500">Checklist {inspectionTypeLabel(form.inspection_type)}</span>
                <Badge tone={inspectionResultTone(livePreview.result)}>{num(livePreview.score, 1)}% · {inspectionResultLabel(livePreview.result)}</Badge>
              </div>
              <div className="divide-y divide-ink-100 dark:divide-ink-800">
                {form.items.map((it: ChecklistItem, i: number) => (
                  <div key={i} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1"><Checkbox label={it.item} checked={it.pass} onChange={() => toggleItem(i)} /></div>
                    <Input placeholder="Catatan (opsional)" value={it.note} onChange={(e: any) => noteItem(i, e.target.value)} className="sm:w-56" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tindak Lanjut" className="sm:col-span-2"><Textarea value={form.follow_up} onChange={(e: any) => setForm({ ...form, follow_up: e.target.value })} placeholder="Rencana perbaikan bila hasil perlu perbaikan/tidak aman" /></Field>
            <Field label="Tenggat Tindak Lanjut"><Input type="date" value={form.due_date} onChange={(e: any) => setForm({ ...form, due_date: e.target.value })} /></Field>
          </div>
          <Field label="Foto Bukti"><PhotoUploader companyId={profile!.company_id} entity="hse-inspections" paths={form.photo_urls} onChange={p => setForm({ ...form, photo_urls: p })} /></Field>
        </div>
      </Modal>

      {/* Drawer detail */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.inspection_no} — ${inspectionTypeLabel(selected.inspection_type)}` : ''}>
        {selected && (
          <div>
            <Section>
              <Desc cols={2} items={[
                { label: 'Tanggal', value: tgl(selected.inspection_date) },
                { label: 'Cabang', value: branchName(selected.branch_id) },
                { label: 'Inspektor', value: empName(selected.inspector_id) },
                { label: 'Referensi Objek', value: selected.target_ref || '-' },
                { label: 'Skor', value: selected.score != null ? `${num(selected.score, 1)}%` : '-' },
                { label: 'Hasil', value: <Badge tone={inspectionResultTone(selected.result)}>{inspectionResultLabel(selected.result)}</Badge> },
                { label: 'Tenggat Tindak Lanjut', value: selected.due_date ? tgl(selected.due_date) : '-' },
              ]} />
              {selected.follow_up && <p className="mt-4 text-body text-ink-600 dark:text-ink-300"><span className="font-medium text-ink-800 dark:text-ink-100">Tindak Lanjut: </span>{selected.follow_up}</p>}
            </Section>
            <Section title="Checklist">
              <div className="divide-y divide-ink-100 dark:divide-ink-800 border border-ink-200 dark:border-ink-800 rounded-md">
                {(selected.findings ?? []).map((it: ChecklistItem, i: number) => (
                  <div key={i} className="px-3 py-2.5 flex items-start gap-2.5">
                    {it.pass ? <CheckCircle2 size={17} className="text-emerald-600 mt-0.5 shrink-0" /> : <XCircle size={17} className="text-red-500 mt-0.5 shrink-0" />}
                    <div>
                      <p className={cx('text-body', it.pass ? 'text-ink-700 dark:text-ink-200' : 'text-red-700 dark:text-red-300 font-medium')}>{it.item}</p>
                      {it.note && <p className="text-caption text-ink-400 mt-0.5">{it.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Foto Bukti">
              <PhotoUploader companyId={profile!.company_id} entity="hse-inspections" paths={selected.photo_urls || []} disabled />
            </Section>
          </div>
        )}
      </Drawer>
    </div>
  )
}
