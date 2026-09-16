import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, nextDocNo, uploadFile, signedUrl } from '@/lib/db'
import {
  PageHeader, Card, DataTable, Badge, Button, Modal, Drawer, Tabs, Field, Input, Select, Textarea,
  Timeline, Desc, Section, ConfirmDialog, useToast, Plus,
} from '@/components/ui'
import { tglJam, durasi } from '@/lib/format'
import SlaCountdown from '../components/SlaCountdown'
import {
  TICKET_SOURCES, TICKET_TYPES, TICKET_STATUSES, ticketStatusLabel, ticketStatusTone,
  SEVERITAS, severityLabel, severityTone, slaDefaultMenit, SLA_DEFAULT_NOTE,
} from '../lib/constants'
import { tautanPeta } from '../lib/helpers'

const emptyForm = () => ({
  source: '', ticket_type: '', customer_name: '', customer_no: '', customer_phone: '',
  address: '', branch_id: '', network_element_id: '', category: '', sub_category: '',
  severity: 'sedang', sla_minutes: slaDefaultMenit('sedang'), description: '',
})

export default function Tiket() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const writable = can('OPERATIONS', 'write')

  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('semua')
  const [tickets, setTickets] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [elements, setElements] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [rootCauses, setRootCauses] = useState<any[]>([])

  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<any>(emptyForm())
  const [saving, setSaving] = useState(false)

  const [selected, setSelected] = useState<any>(null)
  const [drawerTab, setDrawerTab] = useState('ringkasan')
  const [activities, setActivities] = useState<any[]>([])
  const [slaEvents, setSlaEvents] = useState<any[]>([])
  const [attachments, setAttachments] = useState<any[]>([])
  const [attUrls, setAttUrls] = useState<Record<string, string>>({})
  const [drawerLoading, setDrawerLoading] = useState(false)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignTo, setAssignTo] = useState('')
  const [pauseOpen, setPauseOpen] = useState(false)
  const [pauseReason, setPauseReason] = useState('')
  const [resumeConfirm, setResumeConfirm] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completeForm, setCompleteForm] = useState({ root_cause_id: '', note: '' })
  const [closeConfirm, setCloseConfirm] = useState(false)
  const [newNote, setNewNote] = useState('')

  useEffect(() => { if (profile?.company_id) loadAll() }, [profile?.company_id])

  async function loadAll() {
    setLoading(true)
    try {
      const [t, br, el, emp, rc] = await Promise.all([
        list('tickets', { eq: { company_id: profile!.company_id }, order: { col: 'reported_at', asc: false }, limit: 2000 }),
        list('branches', { select: 'id,name', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
        list('network_elements', { select: 'id,code,name,element_type,branch_id', eq: { company_id: profile!.company_id }, order: { col: 'code', asc: true } }),
        list('employees', { select: 'id,full_name,position', eq: { company_id: profile!.company_id }, ilike: { col: 'position', value: 'teknisi' }, order: { col: 'full_name', asc: true } }),
        list('root_causes', { select: 'id,code,name,aspect', eq: { company_id: profile!.company_id }, order: { col: 'code', asc: true } }),
      ])
      setTickets(t); setBranches(br); setElements(el); setTechnicians(emp); setRootCauses(rc)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat tiket', 'error') }
    finally { setLoading(false) }
  }

  const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'
  const empName = (id?: string) => technicians.find(e => e.id === id)?.full_name ?? '-'
  const elName = (id?: string) => { const e = elements.find(x => x.id === id); return e ? `${e.element_type} · ${e.code}` : '-' }
  const rcName = (id?: string) => { const r = rootCauses.find(x => x.id === id); return r ? `${r.name} (${r.aspect})` : '-' }

  const filtered = useMemo(() => tab === 'semua' ? tickets : tickets.filter(t => t.status === tab), [tickets, tab])
  const tabs = [{ value: 'semua', label: 'Semua', count: tickets.length },
    ...TICKET_STATUSES.map(s => ({ value: s.value, label: s.label, count: tickets.filter(t => t.status === s.value).length }))]

  /* ---------------- Tiket baru ---------------- */
  function openNew() {
    setForm(emptyForm())
    setNewOpen(true)
  }
  function onSeverityChange(v: string) {
    setForm((f: any) => ({ ...f, severity: v, sla_minutes: slaDefaultMenit(v) }))
  }
  async function submitNew() {
    if (!form.source || !form.ticket_type || !form.customer_name || !form.branch_id || !form.sla_minutes) {
      toast.push('Lengkapi sumber, jenis, pelanggan, cabang, dan SLA terlebih dahulu', 'error'); return
    }
    setSaving(true)
    try {
      const ticketNo = await nextDocNo(profile!.company_id, 'TKT')
      const reportedAt = new Date()
      const dueAt = new Date(reportedAt.getTime() + Number(form.sla_minutes) * 60000)
      const row = await insert('tickets', {
        company_id: profile!.company_id, ticket_no: ticketNo, source: form.source, ticket_type: form.ticket_type,
        customer_name: form.customer_name, customer_no: form.customer_no || null, customer_phone: form.customer_phone || null,
        address: form.address || null, branch_id: form.branch_id, network_element_id: form.network_element_id || null,
        category: form.category || null, sub_category: form.sub_category || null, severity: form.severity,
        reported_at: reportedAt.toISOString(), sla_minutes: Number(form.sla_minutes), sla_due_at: dueAt.toISOString(),
        status: 'baru', description: form.description || null, created_by: profile!.id,
      })
      await insert('ticket_activities', {
        company_id: profile!.company_id, ticket_id: row.id, activity_type: 'dibuat',
        note: `Tiket dibuat dari sumber ${form.source}.`, created_by: profile!.id,
      })
      toast.push(`Tiket ${ticketNo} berhasil dibuat`, 'success')
      setNewOpen(false)
      await loadAll()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan tiket', 'error') }
    finally { setSaving(false) }
  }

  /* ---------------- Drawer detail ---------------- */
  async function openDetail(row: any) {
    setSelected(row); setDrawerTab('ringkasan'); setDrawerLoading(true)
    try {
      const [act, sla, att] = await Promise.all([
        list('ticket_activities', { eq: { company_id: profile!.company_id, ticket_id: row.id }, order: { col: 'created_at', asc: false } }),
        list('ticket_sla_events', { eq: { company_id: profile!.company_id, ticket_id: row.id }, order: { col: 'event_at', asc: false } }),
        list('attachments', { eq: { company_id: profile!.company_id, entity_type: 'ticket', entity_id: row.id }, order: { col: 'created_at', asc: false } }),
      ])
      setActivities(act); setSlaEvents(sla); setAttachments(att)
      const urls: Record<string, string> = {}
      await Promise.all(att.map(async (a: any) => { urls[a.id] = (await signedUrl(a.file_url)) ?? '' }))
      setAttUrls(urls)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat detail tiket', 'error') }
    finally { setDrawerLoading(false) }
  }
  function closeDrawer() { setSelected(null) }
  async function refreshDetail() {
    const row = await list('tickets', { eq: { id: selected.id }, limit: 1 })
    if (row[0]) { setSelected(row[0]); setTickets(ts => ts.map(t => t.id === row[0].id ? row[0] : t)) }
    const [act, sla] = await Promise.all([
      list('ticket_activities', { eq: { company_id: profile!.company_id, ticket_id: selected.id }, order: { col: 'created_at', asc: false } }),
      list('ticket_sla_events', { eq: { company_id: profile!.company_id, ticket_id: selected.id }, order: { col: 'event_at', asc: false } }),
    ])
    setActivities(act); setSlaEvents(sla)
  }

  async function addNote() {
    if (!newNote.trim()) return
    try {
      await insert('ticket_activities', { company_id: profile!.company_id, ticket_id: selected.id, activity_type: 'catatan', note: newNote.trim(), created_by: profile!.id })
      setNewNote(''); toast.push('Catatan ditambahkan', 'success'); await refreshDetail()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menambah catatan', 'error') }
  }

  async function doAssign() {
    if (!assignTo) { toast.push('Pilih teknisi terlebih dahulu', 'error'); return }
    try {
      await update('tickets', selected.id, { assigned_to: assignTo, status: selected.status === 'baru' ? 'ditugaskan' : selected.status })
      await insert('ticket_activities', { company_id: profile!.company_id, ticket_id: selected.id, activity_type: 'tugaskan', note: `Ditugaskan kepada ${empName(assignTo)}.`, created_by: profile!.id })
      toast.push('Teknisi berhasil ditugaskan', 'success'); setAssignOpen(false); setAssignTo(''); await refreshDetail()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menugaskan teknisi', 'error') }
  }

  async function doPause() {
    if (!pauseReason.trim()) { toast.push('Alasan pause SLA wajib diisi', 'error'); return }
    try {
      await insert('ticket_sla_events', { company_id: profile!.company_id, ticket_id: selected.id, event_type: 'pause', reason: pauseReason.trim(), created_by: profile!.id })
      await update('tickets', selected.id, { status: 'pause' })
      await insert('ticket_activities', { company_id: profile!.company_id, ticket_id: selected.id, activity_type: 'pause_sla', note: `SLA dijeda — ${pauseReason.trim()}`, created_by: profile!.id })
      toast.push('SLA dijeda', 'success'); setPauseOpen(false); setPauseReason(''); await refreshDetail()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menjeda SLA', 'error') }
  }

  async function doResume() {
    try {
      await insert('ticket_sla_events', { company_id: profile!.company_id, ticket_id: selected.id, event_type: 'resume', created_by: profile!.id })
      await update('tickets', selected.id, { status: 'dikerjakan' })
      await insert('ticket_activities', { company_id: profile!.company_id, ticket_id: selected.id, activity_type: 'resume_sla', note: 'SLA dilanjutkan.', created_by: profile!.id })
      toast.push('SLA dilanjutkan', 'success'); await refreshDetail()
    } catch (e: any) { toast.push(e.message ?? 'Gagal melanjutkan SLA', 'error') }
  }

  async function doComplete() {
    if (!completeForm.root_cause_id) { toast.push('Pilih root cause terlebih dahulu', 'error'); return }
    try {
      const now = new Date()
      const reported = new Date(selected.reported_at)
      const ttr = Math.max(0, Math.round((now.getTime() - reported.getTime()) / 60000))
      const slaStatus = ttr <= (selected.sla_minutes ?? 0) ? 'met' : 'breach'
      await update('tickets', selected.id, { status: 'selesai', resolved_at: now.toISOString(), ttr_minutes: ttr, sla_status: slaStatus, root_cause_id: completeForm.root_cause_id })
      await insert('ticket_activities', { company_id: profile!.company_id, ticket_id: selected.id, activity_type: 'rca', note: `Root cause: ${rcName(completeForm.root_cause_id)}. ${completeForm.note || ''}`.trim(), created_by: profile!.id })
      toast.push('Tiket ditandai selesai', 'success'); setCompleteOpen(false); setCompleteForm({ root_cause_id: '', note: '' }); await refreshDetail()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyelesaikan tiket', 'error') }
  }

  async function doClose() {
    try {
      await update('tickets', selected.id, { status: 'ditutup', closed_at: new Date().toISOString() })
      await insert('ticket_activities', { company_id: profile!.company_id, ticket_id: selected.id, activity_type: 'tutup', note: 'Tiket ditutup.', created_by: profile!.id })
      toast.push('Tiket ditutup', 'success'); await refreshDetail()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menutup tiket', 'error') }
  }

  async function onUploadAttachment(file?: File | null) {
    if (!file) return
    try {
      const path = await uploadFile(profile!.company_id, 'tickets', file)
      await insert('attachments', {
        company_id: profile!.company_id, entity_type: 'ticket', entity_id: selected.id,
        file_name: file.name, file_url: path, mime_type: file.type || null, size_bytes: file.size, uploaded_by: profile!.id,
      })
      toast.push('Lampiran berhasil diunggah', 'success')
      const att = await list('attachments', { eq: { company_id: profile!.company_id, entity_type: 'ticket', entity_id: selected.id }, order: { col: 'created_at', asc: false } })
      setAttachments(att)
      const urls: Record<string, string> = {}
      await Promise.all(att.map(async (a: any) => { urls[a.id] = (await signedUrl(a.file_url)) ?? '' }))
      setAttUrls(urls)
    } catch (e: any) { toast.push(e.message ?? 'Gagal mengunggah lampiran', 'error') }
  }

  const peta = tautanPeta(selected?.lat, selected?.lng)

  return (
    <div>
      <PageHeader title="Tiket Gangguan" subtitle="Pencatatan, dispatch & SLA tiket gangguan pelanggan"
        actions={writable && <Button icon={<Plus size={16} />} onClick={openNew}>Tiket Baru</Button>} />

      <Card className="mb-4">
        <Tabs tabs={tabs} value={tab} onChange={setTab} className="px-4" />
      </Card>

      <DataTable
        loading={loading}
        rows={filtered}
        onRowClick={openDetail}
        searchKeys={['ticket_no', 'customer_name', 'address']}
        exportName="tiket-gangguan"
        emptyTitle="Belum ada tiket"
        emptyMessage="Tiket gangguan yang dibuat akan muncul di sini."
        columns={[
          { key: 'ticket_no', header: 'No Tiket' },
          { key: 'source', header: 'Sumber', render: r => TICKET_SOURCES.find(s => s.value === r.source)?.label ?? r.source },
          { key: 'ticket_type', header: 'Jenis', render: r => TICKET_TYPES.find(s => s.value === r.ticket_type)?.label ?? r.ticket_type },
          { key: 'customer_name', header: 'Pelanggan' },
          { key: 'branch_id', header: 'Cabang', render: r => branchName(r.branch_id) },
          { key: 'severity', header: 'Keparahan', render: r => <Badge tone={severityTone(r.severity)}>{severityLabel(r.severity)}</Badge> },
          { key: 'reported_at', header: 'Dilaporkan', render: r => tglJam(r.reported_at) },
          { key: 'sla_due_at', header: 'Jatuh Tempo SLA', render: r => tglJam(r.sla_due_at) },
          { key: 'sisa', header: 'Sisa Waktu', sortable: false, render: r => <SlaCountdown dueAt={r.sla_due_at} slaMenit={r.sla_minutes} selesaiAt={r.resolved_at} /> },
          { key: 'status', header: 'Status', render: r => <Badge tone={ticketStatusTone(r.status)}>{ticketStatusLabel(r.status)}</Badge> },
          { key: 'assigned_to', header: 'Petugas', render: r => empName(r.assigned_to) },
        ]}
      />

      {/* Modal Tiket Baru */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Tiket Gangguan Baru" size="lg"
        footer={<><Button variant="outline" onClick={() => setNewOpen(false)}>Batal</Button>
          <Button loading={saving} onClick={submitNew}>Simpan Tiket</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="No Tiket"><Input value="Otomatis saat disimpan (TKT/…)" disabled /></Field>
          <Field label="Sumber Laporan" required><Select options={TICKET_SOURCES} value={form.source} onChange={(e: any) => setForm({ ...form, source: e.target.value })} /></Field>
          <Field label="Jenis Gangguan" required><Select options={TICKET_TYPES} value={form.ticket_type} onChange={(e: any) => setForm({ ...form, ticket_type: e.target.value })} /></Field>
          <Field label="Cabang" required><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={form.branch_id} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value, network_element_id: '' })} /></Field>
          <Field label="Nama Pelanggan" required><Input value={form.customer_name} onChange={(e: any) => setForm({ ...form, customer_name: e.target.value })} /></Field>
          <Field label="No Pelanggan"><Input value={form.customer_no} onChange={(e: any) => setForm({ ...form, customer_no: e.target.value })} /></Field>
          <Field label="No Telepon"><Input value={form.customer_phone} onChange={(e: any) => setForm({ ...form, customer_phone: e.target.value })} /></Field>
          <Field label="Elemen Jaringan Terdampak">
            <Select options={elements.filter(e => !form.branch_id || e.branch_id === form.branch_id).map(e => ({ value: e.id, label: `${e.element_type} · ${e.code} — ${e.name}` }))}
              value={form.network_element_id} onChange={(e: any) => setForm({ ...form, network_element_id: e.target.value })} />
          </Field>
          <Field label="Alamat" className="sm:col-span-2"><Textarea value={form.address} onChange={(e: any) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Kategori (opsional)"><Input value={form.category} onChange={(e: any) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Sub Kategori (opsional)"><Input value={form.sub_category} onChange={(e: any) => setForm({ ...form, sub_category: e.target.value })} /></Field>
          <Field label="Tingkat Keparahan" required><Select options={SEVERITAS} value={form.severity} onChange={(e: any) => onSeverityChange(e.target.value)} /></Field>
          <Field label="SLA (menit)" required hint={SLA_DEFAULT_NOTE}>
            <Input type="number" min={1} value={form.sla_minutes} onChange={(e: any) => setForm({ ...form, sla_minutes: e.target.value })} />
          </Field>
          <Field label="Deskripsi Keluhan" className="sm:col-span-2"><Textarea value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* Drawer detail */}
      <Drawer open={!!selected} onClose={closeDrawer} width="max-w-2xl"
        title={selected ? `${selected.ticket_no} — ${selected.customer_name}` : ''}
        footer={selected && writable && (
          <div className="flex flex-wrap gap-2 w-full">
            {!['selesai', 'ditutup'].includes(selected.status) && <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>Tugaskan Teknisi</Button>}
            {selected.status !== 'pause' && !['selesai', 'ditutup'].includes(selected.status) && <Button size="sm" variant="outline" onClick={() => setPauseOpen(true)}>Pause SLA</Button>}
            {selected.status === 'pause' && <Button size="sm" variant="outline" onClick={() => setResumeConfirm(true)}>Resume SLA</Button>}
            {!['selesai', 'ditutup'].includes(selected.status) && <Button size="sm" onClick={() => setCompleteOpen(true)}>Selesaikan</Button>}
            {selected.status === 'selesai' && <Button size="sm" variant="secondary" onClick={() => setCloseConfirm(true)}>Tutup Tiket</Button>}
          </div>)}>
        {selected && (
          <div>
            <Tabs className="mb-4" tabs={[
              { value: 'ringkasan', label: 'Ringkasan' }, { value: 'aktivitas', label: 'Aktivitas' },
              { value: 'sla', label: 'SLA' }, { value: 'rca', label: 'RCA' }, { value: 'lampiran', label: 'Lampiran' },
            ]} value={drawerTab} onChange={setDrawerTab} />

            {drawerTab === 'ringkasan' && (
              <Section>
                <Desc cols={2} items={[
                  { label: 'Status', value: <Badge tone={ticketStatusTone(selected.status)}>{ticketStatusLabel(selected.status)}</Badge> },
                  { label: 'Keparahan', value: <Badge tone={severityTone(selected.severity)}>{severityLabel(selected.severity)}</Badge> },
                  { label: 'Sumber', value: TICKET_SOURCES.find(s => s.value === selected.source)?.label ?? selected.source },
                  { label: 'Jenis', value: TICKET_TYPES.find(s => s.value === selected.ticket_type)?.label ?? selected.ticket_type },
                  { label: 'Pelanggan', value: `${selected.customer_name}${selected.customer_phone ? ' · ' + selected.customer_phone : ''}` },
                  { label: 'Cabang', value: branchName(selected.branch_id) },
                  { label: 'Elemen Jaringan', value: elName(selected.network_element_id) },
                  { label: 'Petugas', value: empName(selected.assigned_to) },
                  { label: 'Dilaporkan', value: tglJam(selected.reported_at) },
                  { label: 'Jatuh Tempo SLA', value: tglJam(selected.sla_due_at) },
                  { label: 'Sisa Waktu SLA', value: <SlaCountdown dueAt={selected.sla_due_at} slaMenit={selected.sla_minutes} selesaiAt={selected.resolved_at} /> },
                  { label: 'Alamat', value: <>{selected.address || '-'}{peta && <a href={peta} target="_blank" rel="noreferrer" className="block text-primary-600 dark:text-primary-300 mt-0.5">Lihat di Google Maps</a>}</> },
                ]} />
                {selected.description && <p className="mt-4 text-body text-ink-600 dark:text-ink-300">{selected.description}</p>}
              </Section>
            )}

            {drawerTab === 'aktivitas' && (
              <Section>
                {writable && (
                  <div className="flex gap-2 mb-4">
                    <Textarea placeholder="Tambah catatan aktivitas…" value={newNote} onChange={(e: any) => setNewNote(e.target.value)} className="flex-1" />
                    <Button onClick={addNote}>Tambah</Button>
                  </div>)}
                {activities.length === 0 ? <p className="text-caption text-ink-400">Belum ada aktivitas.</p> :
                  <Timeline items={activities.map(a => ({ title: a.note || a.activity_type, time: tglJam(a.created_at) }))} />}
              </Section>
            )}

            {drawerTab === 'sla' && (
              <Section>
                <Desc cols={2} items={[
                  { label: 'SLA Ditetapkan', value: durasi(selected.sla_minutes) },
                  { label: 'Status SLA', value: selected.sla_status ? <Badge tone={selected.sla_status === 'met' ? 'emerald' : 'red'}>{selected.sla_status === 'met' ? 'Terpenuhi' : 'Lewat SLA'}</Badge> : '-' },
                  { label: 'Waktu Penyelesaian (TTR)', value: durasi(selected.ttr_minutes) },
                  { label: 'Diselesaikan Pada', value: tglJam(selected.resolved_at) },
                ]} />
                <h4 className="font-display font-semibold text-caption uppercase tracking-wide text-ink-500 mt-5 mb-3">Riwayat Pause / Resume</h4>
                {slaEvents.length === 0 ? <p className="text-caption text-ink-400">Belum ada peristiwa pause/resume SLA.</p> :
                  <Timeline items={slaEvents.map(s => ({ title: s.event_type === 'pause' ? 'SLA Dijeda' : 'SLA Dilanjutkan', note: s.reason, time: tglJam(s.event_at) }))} />}
              </Section>
            )}

            {drawerTab === 'rca' && (
              <Section>
                {selected.root_cause_id ? (
                  <Desc cols={1} items={[{ label: 'Root Cause', value: rcName(selected.root_cause_id) }]} />
                ) : <p className="text-caption text-ink-400">Root cause diisi saat tiket diselesaikan melalui tombol "Selesaikan".</p>}
                <h4 className="font-display font-semibold text-caption uppercase tracking-wide text-ink-500 mt-5 mb-3">Catatan RCA</h4>
                {activities.filter(a => a.activity_type === 'rca').length === 0 ? <p className="text-caption text-ink-400">Belum ada catatan RCA.</p> :
                  <Timeline items={activities.filter(a => a.activity_type === 'rca').map(a => ({ title: a.note, time: tglJam(a.created_at) }))} />}
              </Section>
            )}

            {drawerTab === 'lampiran' && (
              <Section>
                {writable && (
                  <label className="inline-block mb-4">
                    <span className="inline-flex items-center h-9 px-3 rounded-sm border border-ink-200 dark:border-ink-700 text-body cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800">Unggah Lampiran</span>
                    <input type="file" className="hidden" onChange={e => onUploadAttachment(e.target.files?.[0])} />
                  </label>)}
                {attachments.length === 0 ? <p className="text-caption text-ink-400">Belum ada lampiran.</p> : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {attachments.map(a => (
                      <a key={a.id} href={attUrls[a.id] || '#'} target="_blank" rel="noreferrer" className="block border border-ink-200 dark:border-ink-800 rounded-md p-2 hover:shadow-e1">
                        {String(a.mime_type).startsWith('image/') && attUrls[a.id]
                          ? <img src={attUrls[a.id]} className="w-full h-24 object-cover rounded-xs mb-1.5" />
                          : <div className="w-full h-24 grid place-items-center bg-ink-50 dark:bg-surface-darker rounded-xs mb-1.5 text-ink-400 text-caption">Berkas</div>}
                        <p className="text-caption truncate text-ink-700 dark:text-ink-200">{a.file_name}</p>
                      </a>))}
                  </div>)}
              </Section>
            )}
          </div>
        )}
      </Drawer>

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Tugaskan Teknisi"
        footer={<><Button variant="outline" onClick={() => setAssignOpen(false)}>Batal</Button><Button onClick={doAssign}>Tugaskan</Button></>}>
        <Field label="Teknisi" required><Select options={technicians.map(t => ({ value: t.id, label: `${t.full_name} — ${t.position}` }))} value={assignTo} onChange={(e: any) => setAssignTo(e.target.value)} /></Field>
      </Modal>

      <Modal open={pauseOpen} onClose={() => setPauseOpen(false)} title="Pause SLA"
        footer={<><Button variant="outline" onClick={() => setPauseOpen(false)}>Batal</Button><Button variant="danger" onClick={doPause}>Jeda SLA</Button></>}>
        <Field label="Alasan Pause" required hint="Wajib diisi — akan dicatat sebagai riwayat peristiwa SLA.">
          <Textarea value={pauseReason} onChange={(e: any) => setPauseReason(e.target.value)} />
        </Field>
      </Modal>

      <ConfirmDialog open={resumeConfirm} onClose={() => setResumeConfirm(false)} title="Lanjutkan SLA"
        message="SLA tiket ini akan dilanjutkan dan status kembali menjadi Dikerjakan. Lanjutkan?" onConfirm={doResume} />

      <Modal open={completeOpen} onClose={() => setCompleteOpen(false)} title="Selesaikan Tiket"
        footer={<><Button variant="outline" onClick={() => setCompleteOpen(false)}>Batal</Button><Button variant="success" onClick={doComplete}>Tandai Selesai</Button></>}>
        <div className="space-y-4">
          <Field label="Root Cause" required><Select options={rootCauses.map(r => ({ value: r.id, label: `${r.name} (${r.aspect})` }))} value={completeForm.root_cause_id} onChange={(e: any) => setCompleteForm({ ...completeForm, root_cause_id: e.target.value })} /></Field>
          <Field label="Catatan Penyelesaian"><Textarea value={completeForm.note} onChange={(e: any) => setCompleteForm({ ...completeForm, note: e.target.value })} /></Field>
        </div>
      </Modal>

      <ConfirmDialog open={closeConfirm} onClose={() => setCloseConfirm(false)} title="Tutup Tiket"
        message="Tiket yang sudah selesai akan ditutup secara final. Lanjutkan?" onConfirm={doClose} />
    </div>
  )
}
