import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import {
  PageHeader, DataTable, Badge, Button, Modal, Drawer, Field, Input, Select,
  Progress, FilterBar, Desc, Section, ConfirmDialog, useToast, Plus,
} from '@/components/ui'
import { tgl, tglJam, num } from '@/lib/format'
import { ELEMENT_TYPES } from '../lib/constants'
import { tautanPeta } from '../lib/helpers'

const STATUSES = ['aktif', 'nonaktif', 'rusak', 'pemeliharaan']

function newForm() {
  return { element_type: 'ODP', code: '', name: '', parent_id: '', branch_id: '', sto: '', lat: '', lng: '', capacity: '', used: '0', status: 'aktif', install_date: '' }
}

export default function AsetJaringan() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const writable = can('OPERATIONS', 'write')
  const approver = can('OPERATIONS', 'approve')

  const [loading, setLoading] = useState(true)
  const [elements, setElements] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])

  const [f, setF] = useState({ element_type: '', branch_id: '', sto: '', status: '' })

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<any>(newForm())
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState<any>(null)

  const [selected, setSelected] = useState<any>(null)

  useEffect(() => { if (profile?.company_id) load() }, [profile?.company_id])

  async function load() {
    setLoading(true)
    try {
      const [el, br, tk, pl] = await Promise.all([
        list('network_elements', { eq: { company_id: profile!.company_id }, order: { col: 'code', asc: true }, limit: 3000 }),
        list('branches', { select: 'id,name', eq: { company_id: profile!.company_id }, order: { col: 'name', asc: true } }),
        list('tickets', { select: 'id,ticket_no,status,severity,reported_at,network_element_id', eq: { company_id: profile!.company_id }, order: { col: 'reported_at', asc: false }, limit: 2000 }),
        list('maintenance_plans', { select: 'id,plan_no,plan_name,frequency,next_due_date,network_element_id', eq: { company_id: profile!.company_id } }),
      ])
      setElements(el); setBranches(br); setTickets(tk); setPlans(pl)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat aset jaringan', 'error') }
    finally { setLoading(false) }
  }

  const branchName = (id?: string) => branches.find(b => b.id === id)?.name ?? '-'
  const elName = (id?: string) => { const e = elements.find(x => x.id === id); return e ? `${e.element_type} · ${e.code} — ${e.name}` : '-' }

  const filtered = useMemo(() => elements.filter(e =>
    (!f.element_type || e.element_type === f.element_type) && (!f.branch_id || e.branch_id === f.branch_id) &&
    (!f.status || e.status === f.status) && (!f.sto || String(e.sto ?? '').toLowerCase().includes(f.sto.toLowerCase()))
  ), [elements, f])

  function openNew() { setEditing(null); setForm(newForm()); setFormOpen(true) }
  function openEdit(e: any) {
    setEditing(e)
    setForm({ ...e, capacity: e.capacity ?? '', used: e.used ?? 0, lat: e.lat ?? '', lng: e.lng ?? '', parent_id: e.parent_id ?? '', install_date: e.install_date ?? '' })
    setFormOpen(true)
  }
  async function submit() {
    if (!form.element_type || !form.code || !form.name || !form.branch_id) { toast.push('Lengkapi jenis, kode, nama dan cabang', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        element_type: form.element_type, code: form.code, name: form.name, parent_id: form.parent_id || null,
        branch_id: form.branch_id, sto: form.sto || null, lat: form.lat || null, lng: form.lng || null,
        capacity: form.capacity === '' ? null : Number(form.capacity), used: Number(form.used) || 0,
        status: form.status, install_date: form.install_date || null,
      }
      if (editing) { await update('network_elements', editing.id, payload); toast.push('Elemen jaringan diperbarui', 'success') }
      else { await insert('network_elements', { ...payload, company_id: profile!.company_id, created_by: profile!.id }); toast.push('Elemen jaringan dibuat', 'success') }
      setFormOpen(false); await load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan elemen jaringan', 'error') }
    finally { setSaving(false) }
  }
  async function doDelete() {
    try { await remove('network_elements', delConfirm.id); toast.push('Elemen jaringan dihapus', 'success'); setDelConfirm(null); setSelected(null); await load() }
    catch (e: any) { toast.push('Tidak dapat menghapus — elemen masih dirujuk oleh data lain (turunan, tiket, atau rencana maintenance).', 'error') }
  }

  const anak = (id: string) => elements.filter(e => e.parent_id === id)
  const riwayatTiket = (id: string) => tickets.filter(t => t.network_element_id === id).slice(0, 15)
  const jadwalMaint = (id: string) => plans.filter(p => p.network_element_id === id)
  const peta = tautanPeta(selected?.lat, selected?.lng)

  return (
    <div>
      <PageHeader title="Aset Jaringan" subtitle="ODC, ODP, FAT, FDT, closure, tiang, kabel, OLT & segmen"
        actions={writable && <Button icon={<Plus size={16} />} onClick={openNew}>Elemen Baru</Button>} />

      <FilterBar>
        <Field label="Jenis"><Select options={ELEMENT_TYPES} value={f.element_type} onChange={(e: any) => setF({ ...f, element_type: e.target.value })} /></Field>
        <Field label="Cabang"><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={f.branch_id} onChange={(e: any) => setF({ ...f, branch_id: e.target.value })} /></Field>
        <Field label="STO"><Input placeholder="Cari STO…" value={f.sto} onChange={(e: any) => setF({ ...f, sto: e.target.value })} /></Field>
        <Field label="Status"><Select options={STATUSES} value={f.status} onChange={(e: any) => setF({ ...f, status: e.target.value })} /></Field>
        <Button variant="outline" size="sm" onClick={() => setF({ element_type: '', branch_id: '', sto: '', status: '' })}>Reset</Button>
      </FilterBar>

      <DataTable
        loading={loading} rows={filtered} onRowClick={setSelected} searchKeys={['code', 'name', 'sto']} exportName="aset-jaringan"
        emptyTitle="Belum ada elemen jaringan"
        columns={[
          { key: 'element_type', header: 'Jenis' },
          { key: 'code', header: 'Kode' },
          { key: 'name', header: 'Nama' },
          { key: 'branch_id', header: 'Cabang', render: r => branchName(r.branch_id) },
          { key: 'sto', header: 'STO' },
          {
            key: 'kapasitas', header: 'Kapasitas Terpakai', width: '160px', render: r => r.capacity ? (
              <div className="min-w-[120px]">
                <div className="flex items-center justify-between text-caption mb-1"><span>{num(r.used)}/{num(r.capacity)}</span>{r.used >= r.capacity && <Badge tone="red">Penuh</Badge>}</div>
                <Progress value={(r.used / r.capacity) * 100} tone={r.used >= r.capacity ? 'danger' : (r.used / r.capacity) > 0.8 ? 'warning' : 'primary'} />
              </div>) : '-'
          },
          { key: 'status', header: 'Status', render: r => <Badge>{r.status}</Badge> },
        ]}
      />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Ubah Elemen Jaringan' : 'Elemen Jaringan Baru'} size="lg"
        footer={<><Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button><Button loading={saving} onClick={submit}>Simpan</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Jenis" required><Select options={ELEMENT_TYPES} value={form.element_type} onChange={(e: any) => setForm({ ...form, element_type: e.target.value })} /></Field>
          <Field label="Kode" required><Input value={form.code} onChange={(e: any) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Nama" required className="sm:col-span-2"><Input value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Cabang" required><Select options={branches.map(b => ({ value: b.id, label: b.name }))} value={form.branch_id} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value })} /></Field>
          <Field label="STO"><Input value={form.sto} onChange={(e: any) => setForm({ ...form, sto: e.target.value })} /></Field>
          <Field label="Elemen Induk">
            <Select options={elements.filter(e => e.id !== editing?.id).map(e => ({ value: e.id, label: `${e.element_type} · ${e.code} — ${e.name}` }))} value={form.parent_id} onChange={(e: any) => setForm({ ...form, parent_id: e.target.value })} />
          </Field>
          <Field label="Status" required><Select options={STATUSES} value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })} /></Field>
          <Field label="Kapasitas"><Input type="number" min={0} value={form.capacity} onChange={(e: any) => setForm({ ...form, capacity: e.target.value })} /></Field>
          <Field label="Terpakai"><Input type="number" min={0} value={form.used} onChange={(e: any) => setForm({ ...form, used: e.target.value })} /></Field>
          <Field label="Latitude"><Input value={form.lat} onChange={(e: any) => setForm({ ...form, lat: e.target.value })} /></Field>
          <Field label="Longitude"><Input value={form.lng} onChange={(e: any) => setForm({ ...form, lng: e.target.value })} /></Field>
          <Field label="Tanggal Instalasi"><Input type="date" value={form.install_date} onChange={(e: any) => setForm({ ...form, install_date: e.target.value })} /></Field>
        </div>
      </Modal>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.element_type} · ${selected.code}` : ''}
        footer={selected && writable && (
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={() => openEdit(selected)}>Ubah</Button>
            {approver && <Button variant="danger" onClick={() => setDelConfirm(selected)}>Hapus</Button>}
          </div>)}>
        {selected && (
          <div>
            <Section title="Detail Elemen">
              <Desc cols={2} items={[
                { label: 'Nama', value: selected.name },
                { label: 'Cabang', value: branchName(selected.branch_id) },
                { label: 'STO', value: selected.sto || '-' },
                { label: 'Status', value: <Badge>{selected.status}</Badge> },
                { label: 'Kapasitas', value: selected.capacity ? `${num(selected.used)} / ${num(selected.capacity)}` : '-' },
                { label: 'Tanggal Instalasi', value: tgl(selected.install_date) },
                { label: 'Pemeliharaan Terakhir', value: tglJam(selected.last_maintenance_at) },
                { label: 'Koordinat', value: <>{selected.lat && selected.lng ? `${selected.lat}, ${selected.lng}` : '-'}{peta && <a href={peta} target="_blank" rel="noreferrer" className="block text-primary-600 dark:text-primary-300 mt-0.5">Lihat di Google Maps</a>}</> },
              ]} />
            </Section>
            <Section title="Hierarki Jaringan">
              <Desc cols={1} items={[{ label: 'Elemen Induk', value: elName(selected.parent_id) }]} />
              <p className="text-caption text-ink-400 mt-3 mb-1.5">Elemen Turunan ({anak(selected.id).length})</p>
              {anak(selected.id).length === 0 ? <p className="text-caption text-ink-400">Tidak ada elemen turunan.</p> : (
                <ul className="space-y-1">{anak(selected.id).map(a => <li key={a.id} className="text-body text-ink-700 dark:text-ink-200">• {a.element_type} · {a.code} — {a.name}</li>)}</ul>)}
            </Section>
            <Section title={`Riwayat Tiket (${riwayatTiket(selected.id).length})`}>
              {riwayatTiket(selected.id).length === 0 ? <p className="text-caption text-ink-400">Belum ada tiket pada elemen ini.</p> : (
                <ul className="space-y-1.5">{riwayatTiket(selected.id).map(t => (
                  <li key={t.id} className="flex items-center justify-between text-body">
                    <span className="text-ink-700 dark:text-ink-200">{t.ticket_no} · {tgl(t.reported_at)}</span>
                    <Badge>{t.status}</Badge>
                  </li>))}</ul>)}
            </Section>
            <Section title={`Jadwal Maintenance (${jadwalMaint(selected.id).length})`}>
              {jadwalMaint(selected.id).length === 0 ? <p className="text-caption text-ink-400">Tidak ada rencana maintenance untuk elemen ini.</p> : (
                <ul className="space-y-1.5">{jadwalMaint(selected.id).map(p => (
                  <li key={p.id} className="flex items-center justify-between text-body">
                    <span className="text-ink-700 dark:text-ink-200">{p.plan_no} · {p.plan_name}</span>
                    <span className="text-caption text-ink-400">Jatuh tempo {tgl(p.next_due_date)}</span>
                  </li>))}</ul>)}
            </Section>
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={!!delConfirm} onClose={() => setDelConfirm(null)} danger title="Hapus Elemen Jaringan"
        message={`Elemen "${delConfirm?.code}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`} onConfirm={doDelete} />
    </div>
  )
}
