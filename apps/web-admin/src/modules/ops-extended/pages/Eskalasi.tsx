import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import {
  PageHeader, Card, CardHeader, Badge, Button, Modal, Field, Input, Select, Textarea, ConfirmDialog,
  useToast, TableSkeleton, EmptyState, DataTable, Plus,
} from '@/components/ui'
import { tglJam } from '@/lib/format'
import { TICKET_SEVERITIES, ticketSeverityLabel, ticketSeverityTone, ESKALASI_SEVERITY_ORDER, TICKET_STATUS_TERBUKA, ticketStatusLabel } from '../lib/constants'
import { umurMenit, formatMenit } from '../lib/helpers'

const emptyForm = () => ({ level: 1, branch_id: '', severity: 'kritis', elapsed_minutes: 30, role_to_notify: '', contact_name: '', contact_phone: '', note: '' })

export default function Eskalasi() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const writable = can('OPERATIONS', 'write')
  const approver = can('OPERATIONS', 'approve')

  const [loading, setLoading] = useState(true)
  const [matrix, setMatrix] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [delId, setDelId] = useState<string | null>(null)

  const [simSeverity, setSimSeverity] = useState('kritis')
  const [simBranch, setSimBranch] = useState('')
  const [simMinutes, setSimMinutes] = useState(60)
  const [simResult, setSimResult] = useState<any[] | null>(null)

  useEffect(() => { if (profile?.company_id) loadAll() }, [profile?.company_id])

  async function loadAll() {
    setLoading(true)
    try {
      const [m, br, t] = await Promise.all([
        list('escalation_matrix', { eq: { company_id: profile!.company_id }, order: { col: 'level', asc: true }, limit: 1000 }),
        list('branches', { select: 'id,name', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
        list('tickets', {
          select: 'id,ticket_no,customer_name,severity,branch_id,reported_at,status',
          eq: { company_id: profile!.company_id }, order: { col: 'reported_at', asc: true }, limit: 3000,
        }),
      ])
      setMatrix(m); setBranches(br); setTickets(t.filter((x: any) => TICKET_STATUS_TERBUKA.includes(x.status)))
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat matriks eskalasi', 'error') }
    finally { setLoading(false) }
  }

  const branchName = (id?: string | null) => id ? (branches.find(b => b.id === id)?.name ?? '-') : 'Semua Cabang'

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {}
    matrix.forEach(m => { const key = m.severity || 'lainnya'; (groups[key] = groups[key] || []).push(m) })
    Object.values(groups).forEach(arr => arr.sort((a, b) => a.level - b.level))
    const order = [...ESKALASI_SEVERITY_ORDER, ...Object.keys(groups).filter(k => !ESKALASI_SEVERITY_ORDER.includes(k))]
    return order.filter(k => groups[k]?.length).map(k => ({ key: k, rows: groups[k] }))
  }, [matrix])

  /* ---------------- CRUD ---------------- */
  function openNew() { setEditing(null); setForm(emptyForm()); setModal(true) }
  function openEdit(row: any) {
    setEditing(row)
    setForm({ level: row.level, branch_id: row.branch_id || '', severity: row.severity || '', elapsed_minutes: row.elapsed_minutes ?? 30, role_to_notify: row.role_to_notify || '', contact_name: row.contact_name || '', contact_phone: row.contact_phone || '', note: row.note || '' })
    setModal(true)
  }
  async function submit() {
    if (!form.level || !form.severity) { toast.push('Level dan tingkat keparahan wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        level: Number(form.level), branch_id: form.branch_id || null, severity: form.severity,
        elapsed_minutes: form.elapsed_minutes === '' ? null : Number(form.elapsed_minutes),
        role_to_notify: form.role_to_notify || null, contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null, note: form.note || null,
      }
      if (editing) await update('escalation_matrix', editing.id, payload)
      else await insert('escalation_matrix', { ...payload, company_id: profile!.company_id, created_by: profile!.id })
      toast.push(editing ? 'Matriks eskalasi diperbarui' : 'Baris matriks eskalasi ditambahkan', 'success')
      setModal(false); await loadAll()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan matriks eskalasi', 'error') }
    finally { setSaving(false) }
  }
  async function doDelete() {
    if (!delId) return
    try { await remove('escalation_matrix', delId); toast.push('Baris matriks dihapus', 'success'); await loadAll() }
    catch (e: any) { toast.push(e.message ?? 'Gagal menghapus baris matriks', 'error') }
    finally { setDelId(null) }
  }

  /* ---------------- Simulasi ---------------- */
  function simulasikan() {
    const hasil = matrix
      .filter(m => m.severity === simSeverity && (m.branch_id == null || m.branch_id === simBranch || !simBranch))
      .filter(m => (m.elapsed_minutes ?? 0) <= Number(simMinutes))
      .sort((a, b) => b.level - a.level)
    setSimResult(hasil)
  }

  /* ---------------- Tiket berjalan yang lewat ambang eskalasi ---------------- */
  const berisiko = useMemo(() => {
    const now = new Date()
    return tickets.map(t => {
      const elapsed = umurMenit(t.reported_at, null, now) ?? 0
      const rows = matrix.filter(m => m.severity === t.severity && (m.branch_id == null || m.branch_id === t.branch_id) && (m.elapsed_minutes ?? 0) <= elapsed)
        .sort((a, b) => b.level - a.level)
      const top = rows[0]
      return top ? { ...t, elapsed, level: top.level, role_to_notify: top.role_to_notify, contact_name: top.contact_name, contact_phone: top.contact_phone } : null
    }).filter(Boolean).sort((a: any, b: any) => b.level - a.level || b.elapsed - a.elapsed) as any[]
  }, [tickets, matrix])

  return (
    <div>
      <PageHeader title="Matriks Eskalasi" subtitle="Jalur eskalasi tiket gangguan berdasarkan keparahan & lama waktu berjalan"
        actions={writable && <Button icon={<Plus size={16} />} onClick={openNew}>Tambah Baris</Button>} />

      <Card className="mb-5">
        <CardHeader title="Matriks Eskalasi" subtitle="Dikelompokkan per tingkat keparahan, diurutkan berdasarkan level" />
        {loading ? <TableSkeleton /> : matrix.length === 0 ? (
          <EmptyState title="Belum ada matriks eskalasi" message="Tambahkan baris matriks untuk menentukan siapa yang dihubungi pada setiap level eskalasi." />
        ) : (
          <div className="divide-y divide-ink-200 dark:divide-ink-800">
            {grouped.map(g => (
              <div key={g.key} className="p-4">
                <div className="mb-2.5"><Badge tone={ticketSeverityTone(g.key)}>{ticketSeverityLabel(g.key)}</Badge></div>
                <div className="overflow-auto">
                  <table className="w-full text-body">
                    <thead>
                      <tr className="text-caption uppercase tracking-wide text-ink-500 text-left">
                        <th className="py-1.5 pr-3">Level</th>
                        <th className="py-1.5 pr-3">Cabang</th>
                        <th className="py-1.5 pr-3">Menit Berlalu</th>
                        <th className="py-1.5 pr-3">Jabatan Dihubungi</th>
                        <th className="py-1.5 pr-3">Kontak</th>
                        <th className="py-1.5 pr-3">Catatan</th>
                        {(writable || approver) && <th className="py-1.5 pr-3 text-right">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r: any) => (
                        <tr key={r.id} className="border-t border-ink-100 dark:border-ink-800">
                          <td className="py-2 pr-3"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-200 text-caption font-semibold">{r.level}</span></td>
                          <td className="py-2 pr-3">{branchName(r.branch_id)}</td>
                          <td className="py-2 pr-3 tabular">{formatMenit(r.elapsed_minutes)}</td>
                          <td className="py-2 pr-3">{r.role_to_notify || '-'}</td>
                          <td className="py-2 pr-3">{r.contact_name || '-'}{r.contact_phone ? ` · ${r.contact_phone}` : ''}</td>
                          <td className="py-2 pr-3 text-ink-500">{r.note || '-'}</td>
                          {(writable || approver) && (
                            <td className="py-2 pr-3 text-right whitespace-nowrap">
                              {writable && <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Ubah</Button>}
                              {approver && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDelId(r.id)}>Hapus</Button>}
                            </td>)}
                        </tr>))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-5">
        <CardHeader title="Panel Simulasi Eskalasi" subtitle="Cek siapa yang seharusnya sudah dihubungi untuk kondisi tertentu" />
        <div className="p-4 flex flex-wrap items-end gap-3">
          <Field label="Tingkat Keparahan" className="w-44"><Select options={TICKET_SEVERITIES} value={simSeverity} onChange={(e: any) => setSimSeverity(e.target.value)} /></Field>
          <Field label="Cabang (opsional)" className="w-52"><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={simBranch} onChange={(e: any) => setSimBranch(e.target.value)} /></Field>
          <Field label="Tiket Sudah Berjalan (menit)" className="w-52"><Input type="number" min={0} value={simMinutes} onChange={(e: any) => setSimMinutes(e.target.value)} /></Field>
          <Button onClick={simulasikan}>Simulasikan</Button>
        </div>
        {simResult && (
          <div className="px-4 pb-4">
            {simResult.length === 0 ? <p className="text-caption text-ink-400">Belum ada level eskalasi yang tercapai pada kondisi ini.</p> : (
              <div className="space-y-2">
                {simResult.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-md bg-ink-50 dark:bg-surface-darker border border-ink-200 dark:border-ink-800">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-caption font-bold">L{r.level}</span>
                    <div className="flex-1 text-body">
                      <span className="font-medium">{r.role_to_notify || 'Jabatan belum diatur'}</span>
                      {r.contact_name && <span className="text-ink-500"> — {r.contact_name}{r.contact_phone ? ` (${r.contact_phone})` : ''}</span>}
                      <span className="block text-caption text-ink-400">Sudah harus dihubungi sejak tiket berjalan {formatMenit(r.elapsed_minutes)} · {branchName(r.branch_id)}</span>
                    </div>
                  </div>))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Tiket Berjalan Melewati Ambang Eskalasi" subtitle="Tiket aktif yang belum diselesaikan namun sudah melewati satu atau lebih ambang eskalasi" />
        <DataTable
          loading={loading}
          rows={berisiko}
          searchable={false}
          emptyTitle="Tidak ada tiket melewati ambang eskalasi"
          emptyMessage="Semua tiket aktif masih berada dalam batas waktu level eskalasi pertama."
          columns={[
            { key: 'ticket_no', header: 'No Tiket' },
            { key: 'customer_name', header: 'Pelanggan' },
            { key: 'branch_id', header: 'Cabang', render: (r: any) => branchName(r.branch_id) },
            { key: 'severity', header: 'Keparahan', render: (r: any) => <Badge tone={ticketSeverityTone(r.severity)}>{ticketSeverityLabel(r.severity)}</Badge> },
            { key: 'status', header: 'Status', render: (r: any) => ticketStatusLabel(r.status) },
            { key: 'elapsed', header: 'Sudah Berjalan', align: 'right', render: (r: any) => formatMenit(r.elapsed) },
            { key: 'level', header: 'Level Eskalasi Saat Ini', align: 'right', render: (r: any) => <Badge tone="red">Level {r.level}</Badge> },
            { key: 'role_to_notify', header: 'Seharusnya Dihubungi', render: (r: any) => <>{r.role_to_notify || '-'}{r.contact_name ? ` — ${r.contact_name}` : ''}</> },
          ]}
        />
      </Card>

      {/* Modal tambah/ubah */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Ubah Baris Matriks Eskalasi' : 'Tambah Baris Matriks Eskalasi'}
        footer={<><Button variant="outline" onClick={() => setModal(false)}>Batal</Button><Button loading={saving} onClick={submit}>Simpan</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Level" required><Input type="number" min={1} value={form.level} onChange={(e: any) => setForm({ ...form, level: e.target.value })} /></Field>
          <Field label="Tingkat Keparahan" required><Select options={TICKET_SEVERITIES} value={form.severity} onChange={(e: any) => setForm({ ...form, severity: e.target.value })} /></Field>
          <Field label="Cabang" hint="Kosongkan untuk berlaku di semua cabang."><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={form.branch_id} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value })} /></Field>
          <Field label="Menit Berlalu" required hint="Tiket dianggap mencapai level ini setelah berjalan sekian menit."><Input type="number" min={0} value={form.elapsed_minutes} onChange={(e: any) => setForm({ ...form, elapsed_minutes: e.target.value })} /></Field>
          <Field label="Jabatan yang Dihubungi"><Input value={form.role_to_notify} onChange={(e: any) => setForm({ ...form, role_to_notify: e.target.value })} placeholder="mis. Supervisor Operations" /></Field>
          <Field label="Nama Kontak"><Input value={form.contact_name} onChange={(e: any) => setForm({ ...form, contact_name: e.target.value })} /></Field>
          <Field label="Telepon Kontak"><Input value={form.contact_phone} onChange={(e: any) => setForm({ ...form, contact_phone: e.target.value })} /></Field>
          <Field label="Catatan" className="sm:col-span-2"><Textarea value={form.note} onChange={(e: any) => setForm({ ...form, note: e.target.value })} /></Field>
        </div>
      </Modal>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} title="Hapus Baris Matriks" danger
        message="Baris matriks eskalasi ini akan dihapus permanen. Lanjutkan?" onConfirm={doDelete} />
    </div>
  )
}
