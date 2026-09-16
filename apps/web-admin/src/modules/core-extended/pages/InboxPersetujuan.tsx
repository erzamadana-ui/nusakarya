import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import supabase from '@/lib/supabase'
import { list, update, insert } from '@/lib/db'
import {
  PageHeader, KpiCard, FilterBar, DataTable, Badge, Button, Modal, Field, Textarea,
  ConfirmDialog, EmptyState, useToast, cx,
} from '@/components/ui'
import { rupiah, tgl } from '@/lib/format'
import { ENTITY_MAP } from '../lib/entityMap'

const MODULE_LABEL: Record<string, string> = {
  PROCUREMENT: 'Procurement', COMMERCE: 'Commerce', HR: 'HR', INVENTORY: 'Inventory',
  PAYROLL: 'Payroll', DEPLOYMENT: 'Deployment', OPERATIONS: 'Operations', FINANCE: 'Finance',
}

function umur(requestedAt: string) {
  const d = Math.max(0, Math.floor((Date.now() - new Date(requestedAt).getTime()) / 86400000))
  return d
}
function umurTone(d: number) {
  if (d < 2) return 'text-emerald-600 dark:text-emerald-400'
  if (d <= 5) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export default function InboxPersetujuan() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [moduleFilter, setModuleFilter] = useState<string>('semua')
  const [selected, setSelected] = useState<string[]>([])

  const [rejectRow, setRejectRow] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  // Modul yang berhak disetujui pengguna (tombol Setujui/Tolak di jabatan-nya)
  const approvableModules = useMemo(
    () => Object.keys(MODULE_LABEL).filter(m => can(m, 'approve')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.role]
  )

  useEffect(() => { load() }, [profile?.id])

  async function load() {
    if (!profile) return
    setLoading(true)
    try {
      const inbox = await list<any>('v_approval_inbox', { order: { col: 'requested_at', asc: true } })
      const scoped = inbox.filter(r => can(r.module_code, 'approve'))
      setRows(scoped)
      const ids = Array.from(new Set(scoped.map(r => r.requested_by).filter(Boolean)))
      if (ids.length) {
        const [{ data: profs }, { data: emps }] = await Promise.all([
          supabase.from('profiles').select('id,full_name').in('id', ids),
          supabase.from('employees').select('id,full_name,user_id').in('user_id', ids),
        ])
        const map: Record<string, string> = {}
        ;(profs ?? []).forEach((p: any) => { map[p.id] = p.full_name })
        ;(emps ?? []).forEach((e: any) => { if (!map[e.user_id]) map[e.user_id] = e.full_name })
        setNames(map)
      } else setNames({})
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat inbox persetujuan', 'error') }
    finally { setLoading(false) }
  }

  const filtered = useMemo(
    () => moduleFilter === 'semua' ? rows : rows.filter(r => r.module_code === moduleFilter),
    [rows, moduleFilter]
  )

  const kpi = useMemo(() => {
    const total = filtered.length
    const nilai = filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const tertua = filtered.reduce((m, r) => Math.max(m, umur(r.requested_at)), 0)
    return { total, nilai, tertua }
  }, [filtered])

  const selectedRows = useMemo(() => filtered.filter(r => selected.includes(r.entity_id)), [filtered, selected])
  const selectedSameType = selectedRows.length > 0 && selectedRows.every(r => r.entity_type === selectedRows[0].entity_type)

  async function writeRejectNote(row: any, map: any, reason: string) {
    if (map.noteCol) {
      const prev = row[map.noteCol]
      const merged = prev ? `${prev}\n\nAlasan penolakan: ${reason}` : `Alasan penolakan: ${reason}`
      return { [map.noteCol]: merged }
    }
    await insert('approvals', {
      company_id: profile?.company_id, entity_type: row.entity_type, entity_id: row.entity_id,
      status: 'ditolak', note: reason, approver_id: profile?.id, acted_at: new Date().toISOString(), created_by: profile?.id,
    })
    return {}
  }

  function permissionError(e: any, moduleCode: string) {
    const msg = String(e?.message ?? '')
    if (/row-level security|permission denied|RLS/i.test(msg)) {
      return `Gagal: Anda tidak memiliki hak Setujui pada modul ${MODULE_LABEL[moduleCode] ?? moduleCode}. Hubungi admin untuk memberi hak akses.`
    }
    return msg || 'Gagal memproses aksi'
  }

  async function approveOne(row: any) {
    const map = ENTITY_MAP[row.entity_type]
    if (!map) { toast.push(`Jenis dokumen ${row.entity_type} belum didukung`, 'error'); return }
    setBusyId(row.entity_id)
    try {
      const payload: any = { [map.statusCol]: map.approveValue }
      if (map.approvedByCol) payload[map.approvedByCol] = profile?.id
      if (map.approvedAtCol) payload[map.approvedAtCol] = new Date().toISOString()
      await update(map.table, row.entity_id, payload)
      toast.push(`${map.label} ${row.doc_no} disetujui`)
      load()
    } catch (e: any) { toast.push(permissionError(e, row.module_code), 'error') }
    finally { setBusyId(null) }
  }

  async function submitReject() {
    if (!rejectReason.trim()) { toast.push('Alasan penolakan wajib diisi', 'error'); return }
    const row = rejectRow
    const map = ENTITY_MAP[row.entity_type]
    if (!map) { toast.push(`Jenis dokumen ${row.entity_type} belum didukung`, 'error'); return }
    setBusyId(row.entity_id)
    try {
      const extra = await writeRejectNote(row, map, rejectReason.trim())
      const payload: any = { [map.statusCol]: map.rejectValue, ...extra }
      if (map.approvedByCol) payload[map.approvedByCol] = profile?.id
      if (map.approvedAtCol) payload[map.approvedAtCol] = new Date().toISOString()
      await update(map.table, row.entity_id, payload)
      toast.push(`${map.label} ${row.doc_no} ditolak`)
      setRejectRow(null); setRejectReason(''); load()
    } catch (e: any) { toast.push(permissionError(e, row.module_code), 'error') }
    finally { setBusyId(null) }
  }

  async function bulkApprove() {
    setBulkBusy(true)
    try {
      const map = ENTITY_MAP[selectedRows[0].entity_type]
      if (!map) { toast.push('Jenis dokumen belum didukung', 'error'); return }
      for (const row of selectedRows) {
        const payload: any = { [map.statusCol]: map.approveValue }
        if (map.approvedByCol) payload[map.approvedByCol] = profile?.id
        if (map.approvedAtCol) payload[map.approvedAtCol] = new Date().toISOString()
        await update(map.table, row.entity_id, payload)
      }
      toast.push(`${selectedRows.length} dokumen disetujui`)
      setSelected([]); load()
    } catch (e: any) { toast.push(permissionError(e, selectedRows[0]?.module_code), 'error') }
    finally { setBulkBusy(false); setBulkConfirm(false) }
  }

  if (!loading && approvableModules.length === 0) {
    return (
      <div>
        <PageHeader title="Inbox Persetujuan" subtitle="Semua dokumen yang menunggu keputusan Anda" />
        <EmptyState title="Tidak ada hak persetujuan"
          message="Akun Anda belum memiliki hak 'Setujui' pada modul manapun. Hubungi admin untuk pengaturan hak akses jabatan." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Inbox Persetujuan" subtitle="Satu tempat untuk semua dokumen yang menunggu keputusan Anda" />

      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="Total Menunggu" value={kpi.total} sub="dokumen" />
        <KpiCard label="Nilai Total" value={rupiah(kpi.nilai, true)} sub="estimasi seluruh dokumen" />
        <KpiCard label="Tertua" value={`${kpi.tertua} hari`} sub="pengajuan menunggu terlama" tone={kpi.tertua > 5 ? 'red' : 'teal'} />
      </div>
      <p className="text-caption text-ink-400 -mt-2 mb-4">Sumber data: tampilan v_approval_inbox, ditarik saat halaman dibuka.</p>

      <FilterBar>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setModuleFilter('semua')}
            className={cx('h-8 px-3 rounded-full text-caption font-medium', moduleFilter === 'semua' ? 'bg-primary-500 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300')}>
            Semua ({rows.length})
          </button>
          {approvableModules.filter(m => rows.some(r => r.module_code === m)).map(m => (
            <button key={m} onClick={() => setModuleFilter(m)}
              className={cx('h-8 px-3 rounded-full text-caption font-medium', moduleFilter === m ? 'bg-primary-500 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300')}>
              {MODULE_LABEL[m] ?? m} ({rows.filter(r => r.module_code === m).length})
            </button>
          ))}
        </div>
      </FilterBar>

      <DataTable
        loading={loading} rows={filtered} rowKey="entity_id" searchKeys={['doc_no', 'title']}
        emptyTitle="Tidak ada dokumen menunggu" emptyMessage="Semua dokumen pada modul Anda sudah diputuskan."
        selectable onSelect={setSelected}
        toolbar={selected.length > 0 && (
          selectedSameType
            ? <Button size="sm" variant="success" onClick={() => setBulkConfirm(true)}>Setujui {selected.length} Dokumen</Button>
            : <span className="text-caption text-amber-600">Pilih dokumen dengan jenis yang sama untuk aksi massal</span>
        )}
        columns={[
          { key: 'entity_type', header: 'Jenis', render: r => ENTITY_MAP[r.entity_type]?.label ?? r.entity_type },
          { key: 'doc_no', header: 'Nomor' },
          { key: 'title', header: 'Judul', render: r => <span className="line-clamp-1 max-w-xs block">{r.title ?? '-'}</span> },
          { key: 'module_code', header: 'Modul', render: r => <Badge tone="teal">{MODULE_LABEL[r.module_code] ?? r.module_code}</Badge> },
          { key: 'requested_by', header: 'Diajukan Oleh', render: r => names[r.requested_by] ?? '-' },
          { key: 'requested_at', header: 'Tanggal Ajukan', render: r => tgl(r.requested_at) },
          { key: 'umur', header: 'Umur', align: 'right', render: r => { const d = umur(r.requested_at); return <span className={cx('font-semibold', umurTone(d))}>{d} hari</span> } },
          { key: 'amount', header: 'Nilai', align: 'right', render: r => rupiah(r.amount) },
          { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
          { key: 'aksi', header: 'Aksi', align: 'center', sortable: false, render: (r: any) => (
            <div className="flex items-center gap-1.5 justify-center">
              <Button size="sm" variant="outline" onClick={() => navigate(r.route_path)}>Buka</Button>
              <Button size="sm" variant="success" loading={busyId === r.entity_id} onClick={() => approveOne(r)}>Setujui</Button>
              <Button size="sm" variant="danger" onClick={() => { setRejectRow(r); setRejectReason('') }}>Tolak</Button>
            </div>
          ) },
        ]}
      />

      <Modal open={!!rejectRow} onClose={() => setRejectRow(null)} title="Tolak Dokumen" size="sm"
        subtitle={rejectRow ? `${ENTITY_MAP[rejectRow.entity_type]?.label ?? rejectRow.entity_type} — ${rejectRow.doc_no}` : ''}
        footer={<><Button variant="outline" onClick={() => setRejectRow(null)}>Batal</Button>
          <Button variant="danger" loading={busyId === rejectRow?.entity_id} onClick={submitReject}>Tolak Dokumen</Button></>}>
        <Field label="Alasan Penolakan" required><Textarea value={rejectReason} onChange={(e: any) => setRejectReason(e.target.value)} placeholder="Wajib diisi" /></Field>
      </Modal>

      <ConfirmDialog open={bulkConfirm} onClose={() => setBulkConfirm(false)} onConfirm={bulkApprove}
        title="Setujui Dokumen Terpilih"
        message={`Anda akan menyetujui ${selectedRows.length} dokumen (${ENTITY_MAP[selectedRows[0]?.entity_type]?.label ?? ''}) dengan total nilai ${rupiah(selectedRows.reduce((s, r) => s + (Number(r.amount) || 0), 0))}. Lanjutkan?`}
        confirmLabel="Ya, Setujui Semua" />
    </div>
  )
}
