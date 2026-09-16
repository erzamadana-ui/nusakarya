import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import { exportCSV } from '@/lib/format'
import {
  PageHeader, FilterBar, Card, DataTable, Badge, Modal, Field, Input, Select, Checkbox, Button,
  useToast, ConfirmDialog, EmptyState, TableSkeleton, Download, Plus,
} from '@/components/ui'
import { ChevronRight, ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABEL, NORMAL_BALANCE_OPTIONS, buildCoaTree, flattenCoaTree, isDescendant, CoaNode } from '../lib/helpers'

const emptyForm = { account_code: '', account_name: '', account_type: '', parent_code: '', normal_balance: '', is_postable: true, is_active: true }

export default function COA() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

  async function load() {
    setLoading(true)
    try {
      const data = await list('chart_of_accounts', { eq: { company_id: profile!.company_id }, order: { col: 'account_code', asc: true }, limit: 2000 })
      setRows(data)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat bagan akun', 'error') } finally { setLoading(false) }
  }

  const filteredRows = useMemo(() => typeFilter ? rows.filter(r => r.account_type === typeFilter) : rows, [rows, typeFilter])
  const tree = useMemo(() => buildCoaTree(filteredRows), [filteredRows])
  const parentOptions = useMemo(() => rows
    .filter(r => !editing || (r.account_code !== editing.account_code && !isDescendant(rows, editing.account_code, r.account_code)))
    .map(r => ({ value: r.account_code, label: `${r.account_code} — ${r.account_name}` })), [rows, editing])

  function toggle(code: string) {
    setExpanded(s => { const n = new Set(s); n.has(code) ? n.delete(code) : n.add(code); return n })
  }

  function openAdd() { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(row: any) { setEditing(row); setForm({ ...row, parent_code: row.parent_code ?? '' }); setModalOpen(true) }

  async function simpan() {
    if (!form.account_code.trim()) { toast.push('Kode akun wajib diisi.', 'error'); return }
    if (!form.account_name.trim()) { toast.push('Nama akun wajib diisi.', 'error'); return }
    if (!form.account_type) { toast.push('Jenis akun wajib dipilih.', 'error'); return }
    if (!form.normal_balance) { toast.push('Saldo normal wajib dipilih.', 'error'); return }
    const dup = rows.some(r => r.account_code === form.account_code.trim() && r.account_code !== editing?.account_code)
    if (dup) { toast.push('Kode akun sudah digunakan — kode akun harus unik.', 'error'); return }
    if (form.parent_code && form.parent_code === form.account_code) { toast.push('Akun tidak boleh menjadi induk dirinya sendiri.', 'error'); return }
    if (form.parent_code && !rows.some(r => r.account_code === form.parent_code) && form.parent_code !== editing?.account_code) {
      // parent baru boleh salah satu akun existing saja (termasuk yang sedang diedit tidak valid, dicegah di atas)
    }
    setBusy(true)
    try {
      const payload = {
        company_id: profile!.company_id, account_code: form.account_code.trim(), account_name: form.account_name.trim(),
        account_type: form.account_type, parent_code: form.parent_code || null, normal_balance: form.normal_balance,
        is_postable: !!form.is_postable, is_active: !!form.is_active,
      }
      if (editing) { await update('chart_of_accounts', editing.id, payload); toast.push('Akun diperbarui.', 'success') }
      else { await insert('chart_of_accounts', payload); toast.push('Akun ditambahkan.', 'success') }
      setModalOpen(false); await load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan akun', 'error') } finally { setBusy(false) }
  }

  async function hapus() {
    if (!confirmDelete) return
    const hasChildren = rows.some(r => r.parent_code === confirmDelete.account_code)
    if (hasChildren) { toast.push('Akun ini masih memiliki akun turunan — hapus atau pindahkan turunannya terlebih dahulu.', 'error'); return }
    try {
      const usage = await list('journal_lines', { eq: { company_id: profile!.company_id, account_code: confirmDelete.account_code }, limit: 1 })
      if (usage.length > 0) { toast.push('Akun ini sudah dipakai pada jurnal — tidak dapat dihapus.', 'error'); return }
      await remove('chart_of_accounts', confirmDelete.id)
      toast.push('Akun dihapus.', 'success'); await load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menghapus akun', 'error') }
  }

  function ekspor() {
    const data = flattenCoaTree(tree)
    if (!data.length) { toast.push('Tidak ada data untuk diekspor.', 'error'); return }
    exportCSV(data, 'bagan-akun-coa')
  }

  function Row({ node, depth }: { node: CoaNode; depth: number }) {
    const hasChildren = node.children.length > 0
    const open = expanded.has(node.account_code)
    return (
      <>
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-ink-100 dark:border-ink-800 hover:bg-primary-50/40 dark:hover:bg-ink-800/50">
          <div className="flex items-center gap-1.5 flex-1 min-w-0" style={{ paddingLeft: depth * 20 }}>
            {hasChildren ? (
              <button onClick={() => toggle(node.account_code)} className="p-0.5 rounded-xs text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700 shrink-0">
                {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
            ) : <span className="w-5 shrink-0" />}
            <span className="font-mono text-caption text-ink-500 shrink-0 w-16">{node.account_code}</span>
            <span className={`text-body truncate ${!node.is_active ? 'text-ink-400 line-through' : 'text-ink-800 dark:text-ink-100'}`}>{node.account_name}</span>
          </div>
          <div className="w-28 shrink-0"><Badge tone={{ aset: 'blue', liabilitas: 'amber', ekuitas: 'teal', pendapatan: 'emerald', beban: 'red' }[node.account_type] as any}>{ACCOUNT_TYPE_LABEL[node.account_type] ?? node.account_type}</Badge></div>
          <div className="w-20 shrink-0 text-caption text-ink-500">{node.normal_balance === 'debit' ? 'Debit' : 'Kredit'}</div>
          <div className="w-24 shrink-0 text-caption">{node.is_postable ? <Badge tone="emerald">Ya</Badge> : <Badge tone="slate">Tidak</Badge>}</div>
          {can('FINANCE', 'write') && (
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => openEdit(node)}><Pencil size={14} /></Button>
              {can('FINANCE', 'approve') && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(node)}><Trash2 size={14} /></Button>}
            </div>
          )}
        </div>
        {hasChildren && open && node.children.map(c => <Row key={c.account_code} node={c} depth={depth + 1} />)}
      </>
    )
  }

  return (
    <div>
      <PageHeader title="Bagan Akun (Chart of Accounts)" subtitle="Struktur akun perusahaan dalam bentuk pohon hierarki berdasarkan induk akun."
        actions={<>
          <Button variant="outline" icon={<Download size={16} />} onClick={ekspor}>Ekspor</Button>
          {can('FINANCE', 'write') && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Akun</Button>}
        </>} />

      <FilterBar>
        <Field label="Jenis Akun"><Select value={typeFilter} onChange={(e: any) => setTypeFilter(e.target.value)} options={ACCOUNT_TYPES} placeholder="Semua jenis" /></Field>
        <Button variant="outline" size="sm" onClick={() => setExpanded(new Set(rows.map(r => r.account_code)))}>Buka Semua</Button>
        <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>Tutup Semua</Button>
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-surface-darker text-caption font-semibold uppercase tracking-wide text-ink-500">
          <div className="flex-1">Kode &amp; Nama Akun</div>
          <div className="w-28 shrink-0">Jenis</div>
          <div className="w-20 shrink-0">Saldo Normal</div>
          <div className="w-24 shrink-0">Diposting</div>
          {can('FINANCE', 'write') && <div className="w-16 shrink-0">Aksi</div>}
        </div>
        {loading ? <TableSkeleton /> : tree.length === 0 ? (
          <EmptyState title="Belum ada akun" message="Belum ada akun pada jenis yang dipilih." />
        ) : tree.map(n => <Row key={n.account_code} node={n} depth={0} />)}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Ubah Akun' : 'Tambah Akun'} size="md"
        footer={<Button loading={busy} onClick={simpan}>Simpan</Button>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Kode Akun" required><Input value={form.account_code} onChange={(e: any) => setForm((f: any) => ({ ...f, account_code: e.target.value }))} placeholder="cth. 1104" /></Field>
          <Field label="Nama Akun" required><Input value={form.account_name} onChange={(e: any) => setForm((f: any) => ({ ...f, account_name: e.target.value }))} /></Field>
          <Field label="Jenis Akun" required><Select value={form.account_type} onChange={(e: any) => setForm((f: any) => ({ ...f, account_type: e.target.value }))} options={ACCOUNT_TYPES} /></Field>
          <Field label="Saldo Normal" required><Select value={form.normal_balance} onChange={(e: any) => setForm((f: any) => ({ ...f, normal_balance: e.target.value }))} options={NORMAL_BALANCE_OPTIONS} /></Field>
          <Field label="Induk Akun" className="sm:col-span-2"><Select value={form.parent_code} onChange={(e: any) => setForm((f: any) => ({ ...f, parent_code: e.target.value }))} options={parentOptions} placeholder="— tidak ada (akun utama) —" /></Field>
          <Field label="Dapat Diposting"><Checkbox label="Akun ini boleh dipakai pada baris jurnal" checked={!!form.is_postable} onChange={(e: any) => setForm((f: any) => ({ ...f, is_postable: e.target.checked }))} /></Field>
          <Field label="Status"><Checkbox label="Aktif" checked={!!form.is_active} onChange={(e: any) => setForm((f: any) => ({ ...f, is_active: e.target.checked }))} /></Field>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={hapus} danger
        title="Hapus Akun" message={`Hapus akun ${confirmDelete?.account_code} — ${confirmDelete?.account_name}? Tindakan ini tidak dapat dibatalkan.`} />
    </div>
  )
}
