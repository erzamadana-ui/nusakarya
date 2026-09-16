import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { list, insert, update, remove } from '@/lib/db'
import {
  PageHeader, Card, CardHeader, DataTable, Modal, ConfirmDialog, Field, Input, Textarea, Select,
  Button, useToast, Plus, EmptyState, FilterBar,
} from '@/components/ui'
import { rupiah, num } from '@/lib/format'
import { BOQ_TYPES, CHART_COLORS, projectLabel } from '../lib/shared'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Upload } from 'lucide-react'

export default function Boq() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const loc = useLocation() as any
  const writable = can('DEPLOYMENT', 'write')

  const [projects, setProjects] = useState<any[]>([])
  const [projectId, setProjectId] = useState<string>(loc?.state?.projectId ?? '')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<any[]>([])

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [delRow, setDelRow] = useState<any>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [importType, setImportType] = useState('plan')
  const [importVersion, setImportVersion] = useState(1)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    (async () => {
      if (!profile?.company_id) return
      const p = await list('projects', { select: 'id,project_code,project_name', order: { col: 'project_code', asc: true } })
      setProjects(p)
      if (!projectId && p.length) setProjectId(loc?.state?.projectId ?? p[0].id)
    })()
  }, [profile?.company_id])

  const loadItems = async (pid: string) => {
    setLoading(true)
    try { setRows(await list('boq_items', { eq: { project_id: pid }, order: { col: 'category', asc: true } })) }
    catch (e: any) { toast.push(e.message ?? 'Gagal memuat BoQ', 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { if (projectId) loadItems(projectId) }, [projectId])

  const pivot = useMemo(() => {
    const map: Record<string, any> = {}
    for (const r of rows) {
      const key = `${r.item_code}||${r.description}||${r.uom}`
      if (!map[key]) map[key] = { item_code: r.item_code, description: r.description, uom: r.uom, category: r.category, qty_plan: 0, amount_plan: 0, qty_revisi: 0, amount_revisi: 0, qty_actual: 0, amount_actual: 0 }
      map[key][`qty_${r.boq_type === 'plan' ? 'plan' : r.boq_type === 'revisi' ? 'revisi' : 'actual'}`] += Number(r.qty ?? 0)
      map[key][`amount_${r.boq_type === 'plan' ? 'plan' : r.boq_type === 'revisi' ? 'revisi' : 'actual'}`] += Number(r.amount ?? 0)
    }
    return Object.values(map).map((r: any) => ({
      ...r, selisih_qty: r.qty_actual - r.qty_plan, selisih_nilai: r.amount_actual - r.amount_plan,
    }))
  }, [rows])

  const totals = useMemo(() => pivot.reduce((t, r) => ({
    qty_plan: t.qty_plan + r.qty_plan, amount_plan: t.amount_plan + r.amount_plan,
    qty_revisi: t.qty_revisi + r.qty_revisi, amount_revisi: t.amount_revisi + r.amount_revisi,
    qty_actual: t.qty_actual + r.qty_actual, amount_actual: t.amount_actual + r.amount_actual,
    selisih_nilai: t.selisih_nilai + r.selisih_nilai,
  }), { qty_plan: 0, amount_plan: 0, qty_revisi: 0, amount_revisi: 0, qty_actual: 0, amount_actual: 0, selisih_nilai: 0 }), [pivot])

  const chartData = useMemo(() => {
    const map: Record<string, any> = {}
    for (const r of rows) {
      const cat = r.category || 'Lainnya'
      if (!map[cat]) map[cat] = { kategori: cat, plan: 0, revisi: 0, actual: 0 }
      map[cat][r.boq_type === 'plan' ? 'plan' : r.boq_type === 'revisi' ? 'revisi' : 'actual'] += Number(r.amount ?? 0)
    }
    return Object.values(map)
  }, [rows])

  const openAdd = () => { setEditing(null); setForm({ boq_type: 'plan', version: 1, qty: 0, unit_price: 0 }); setOpen(true) }
  const openEdit = (r: any) => { setEditing(r); setForm({ ...r }); setOpen(true) }
  const save = async () => {
    if (!form.item_code || !form.description) { toast.push('Kode dan deskripsi wajib diisi', 'error'); return }
    setSaving(true)
    try {
      const qty = Number(form.qty ?? 0), price = Number(form.unit_price ?? 0)
      const payload = {
        company_id: profile!.company_id, project_id: projectId, boq_type: form.boq_type || 'plan',
        version: Number(form.version ?? 1), item_code: form.item_code, description: form.description,
        uom: form.uom || null, qty, unit_price: price, amount: qty * price, category: form.category || null, note: form.note || null,
      }
      if (editing) { await update('boq_items', editing.id, payload); toast.push('Baris BoQ diperbarui') }
      else { await insert('boq_items', { ...payload, created_by: profile!.id }); toast.push('Baris BoQ ditambahkan') }
      setOpen(false); loadItems(projectId)
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan', 'error') }
    finally { setSaving(false) }
  }
  const doDelete = async () => {
    if (!delRow) return
    try { await remove('boq_items', delRow.id); toast.push('Baris BoQ dihapus'); loadItems(projectId) }
    catch (e: any) { toast.push(e.message ?? 'Gagal menghapus', 'error') }
  }

  const doImport = async () => {
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) { toast.push('Tempelkan minimal satu baris', 'error'); return }
    setImporting(true)
    try {
      const payloads = lines.map(line => {
        const [kode, deskripsi, satuan, qty, harga] = line.split('|').map(s => (s ?? '').trim())
        const q = Number(qty) || 0, h = Number(harga) || 0
        return { company_id: profile!.company_id, project_id: projectId, boq_type: importType, version: Number(importVersion) || 1,
          item_code: kode || '-', description: deskripsi || '-', uom: satuan || null, qty: q, unit_price: h, amount: q * h, category: null, note: null, created_by: profile!.id }
      })
      for (const p of payloads) await insert('boq_items', p)
      toast.push(`${payloads.length} baris BoQ berhasil diimpor`)
      setImportOpen(false); setImportText(''); loadItems(projectId)
    } catch (e: any) { toast.push(e.message ?? 'Gagal mengimpor', 'error') }
    finally { setImporting(false) }
  }

  return (
    <div>
      <PageHeader title="BoQ Plan vs Actual" subtitle="Perbandingan Rencana, Revisi, dan Realisasi Bill of Quantity"
        actions={writable && <>
          <Button variant="outline" icon={<Upload size={16} />} onClick={() => setImportOpen(true)}>Impor Cepat</Button>
          <Button icon={<Plus size={16} />} onClick={openAdd} disabled={!projectId}>Tambah Baris</Button>
        </>} />

      <FilterBar>
        <Field label="Proyek" className="min-w-[280px]">
          <Select options={projects.map(p => ({ value: p.id, label: projectLabel(p) }))} value={projectId} onChange={(e: any) => setProjectId(e.target.value)} />
        </Field>
      </FilterBar>

      {!projectId ? <EmptyState title="Pilih proyek" message="Pilih proyek terlebih dahulu untuk melihat BoQ." /> : (
        <>
          <Card className="mb-4 overflow-hidden">
            <CardHeader title="Rencana vs Revisi vs Realisasi" />
            {loading ? <div className="p-4 text-caption text-ink-400">Memuat…</div> : pivot.length === 0 ? <EmptyState title="Belum ada baris BoQ" message="Tambahkan baris atau gunakan impor cepat." /> : (
              <div className="overflow-auto">
                <table className="w-full text-body border-separate border-spacing-0">
                  <thead className="bg-ink-50 dark:bg-surface-darker sticky top-0 z-10">
                    <tr>
                      {['Kode', 'Deskripsi', 'Satuan', 'Qty Rencana', 'Nilai Rencana', 'Qty Revisi', 'Nilai Revisi', 'Qty Realisasi', 'Nilai Realisasi', 'Selisih Qty', 'Selisih Nilai'].map((h, i) => (
                        <th key={i} className={`px-3 h-11 font-semibold text-caption uppercase text-ink-500 border-b border-ink-200 dark:border-ink-800 whitespace-nowrap ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {pivot.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-ink-100 dark:border-ink-800">
                        <td className="px-3 py-2">{r.item_code}</td><td className="px-3 py-2">{r.description}</td><td className="px-3 py-2">{r.uom}</td>
                        <td className="px-3 py-2 text-right tabular">{num(r.qty_plan)}</td><td className="px-3 py-2 text-right tabular">{rupiah(r.amount_plan, true)}</td>
                        <td className="px-3 py-2 text-right tabular">{num(r.qty_revisi)}</td><td className="px-3 py-2 text-right tabular">{rupiah(r.amount_revisi, true)}</td>
                        <td className="px-3 py-2 text-right tabular">{num(r.qty_actual)}</td><td className="px-3 py-2 text-right tabular">{rupiah(r.amount_actual, true)}</td>
                        <td className={`px-3 py-2 text-right tabular font-medium ${r.selisih_qty < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{num(r.selisih_qty)}</td>
                        <td className={`px-3 py-2 text-right tabular font-medium ${r.selisih_nilai < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{rupiah(r.selisih_nilai, true)}</td>
                      </tr>))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-ink-50 dark:bg-surface-darker font-semibold">
                      <td className="px-3 py-2.5" colSpan={3}>Total</td>
                      <td className="px-3 py-2.5 text-right tabular">{num(totals.qty_plan)}</td><td className="px-3 py-2.5 text-right tabular">{rupiah(totals.amount_plan, true)}</td>
                      <td className="px-3 py-2.5 text-right tabular">{num(totals.qty_revisi)}</td><td className="px-3 py-2.5 text-right tabular">{rupiah(totals.amount_revisi, true)}</td>
                      <td className="px-3 py-2.5 text-right tabular">{num(totals.qty_actual)}</td><td className="px-3 py-2.5 text-right tabular">{rupiah(totals.amount_actual, true)}</td>
                      <td className="px-3 py-2.5" />
                      <td className={`px-3 py-2.5 text-right tabular ${totals.selisih_nilai < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{rupiah(totals.selisih_nilai, true)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>)}
          </Card>

          <Card className="mb-4">
            <CardHeader title="Perbandingan Nilai per Kategori" />
            <div className="p-4 h-[300px]">
              {chartData.length === 0 ? <p className="text-caption text-ink-400 text-center pt-24">Belum ada data.</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="kategori" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => rupiah(v, true)} />
                    <Tooltip formatter={(v: any) => rupiah(v)} />
                    <Legend />
                    <Bar dataKey="plan" name="Rencana" fill={CHART_COLORS[4]} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="revisi" name="Revisi" fill={CHART_COLORS[1]} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="actual" name="Realisasi" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>)}
            </div>
          </Card>

          <Card>
            <CardHeader title="Daftar Baris BoQ" />
            <DataTable
              loading={loading} searchKeys={['item_code', 'description']} exportName="boq_items"
              onRowClick={writable ? openEdit : undefined}
              emptyTitle="Belum ada baris BoQ"
              columns={[
                { key: 'boq_type', header: 'Jenis', render: (r) => BOQ_TYPES.find(t => t.value === r.boq_type)?.label ?? r.boq_type },
                { key: 'version', header: 'Versi', align: 'right' },
                { key: 'item_code', header: 'Kode' },
                { key: 'description', header: 'Deskripsi' },
                { key: 'uom', header: 'Satuan' },
                { key: 'qty', header: 'Qty', align: 'right', render: (r) => num(r.qty) },
                { key: 'unit_price', header: 'Harga Satuan', align: 'right', render: (r) => rupiah(r.unit_price) },
                { key: 'amount', header: 'Nilai', align: 'right', render: (r) => rupiah(r.amount) },
                { key: 'category', header: 'Kategori' },
                ...(writable ? [{ key: '_x', header: '', width: '40px', render: (r: any) => (
                  <button onClick={(e) => { e.stopPropagation(); setDelRow(r) }} className="text-caption text-red-600 hover:underline">Hapus</button>) }] : []),
              ]}
              rows={rows}
            />
          </Card>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Ubah Baris BoQ' : 'Tambah Baris BoQ'}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button loading={saving} onClick={save}>Simpan</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Jenis"><Select options={BOQ_TYPES} value={form.boq_type ?? 'plan'} onChange={(e: any) => setForm({ ...form, boq_type: e.target.value })} /></Field>
          <Field label="Versi"><Input type="number" min={1} value={form.version ?? 1} onChange={e => setForm({ ...form, version: e.target.value })} /></Field>
          <Field label="Kode Item" required><Input value={form.item_code ?? ''} onChange={e => setForm({ ...form, item_code: e.target.value })} /></Field>
          <Field label="Satuan"><Input value={form.uom ?? ''} onChange={e => setForm({ ...form, uom: e.target.value })} /></Field>
          <Field label="Deskripsi" className="sm:col-span-2" required><Input value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Qty"><Input type="number" value={form.qty ?? 0} onChange={e => setForm({ ...form, qty: e.target.value })} /></Field>
          <Field label="Harga Satuan"><Input type="number" value={form.unit_price ?? 0} onChange={e => setForm({ ...form, unit_price: e.target.value })} /></Field>
          <Field label="Kategori"><Input value={form.category ?? ''} onChange={e => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Catatan"><Input value={form.note ?? ''} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} size="lg" title="Impor Cepat BoQ"
        footer={<><Button variant="outline" onClick={() => setImportOpen(false)}>Batal</Button><Button loading={importing} onClick={doImport}>Impor</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Jenis Baris"><Select options={BOQ_TYPES} value={importType} onChange={(e: any) => setImportType(e.target.value)} /></Field>
          <Field label="Versi"><Input type="number" min={1} value={importVersion} onChange={e => setImportVersion(Number(e.target.value))} /></Field>
        </div>
        <Field label="Tempel Data" hint="Satu baris per item, format: kode|deskripsi|satuan|qty|harga">
          <Textarea rows={10} value={importText} onChange={e => setImportText(e.target.value)} placeholder={'KBL-001|Kabel Fiber Optic 24 Core|meter|1200|18500\nCLO-002|Closure 24 Port|unit|8|450000'} className="min-h-[200px] font-mono text-caption" />
        </Field>
      </Modal>

      <ConfirmDialog open={!!delRow} onClose={() => setDelRow(null)} onConfirm={doDelete} danger title="Hapus Baris BoQ" message={`Hapus baris "${delRow?.item_code}"?`} />
    </div>
  )
}
