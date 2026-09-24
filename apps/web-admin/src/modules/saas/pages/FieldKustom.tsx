import React, { useEffect, useMemo, useState } from 'react'
import { Plus, SlidersHorizontal, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { hapusCacheKonfigurasi } from '@/lib/konfigurasi'
import { PageHeader, SectionCard, DataTable, Badge, Button, Drawer, Field, Input, Select, Checkbox, Tabs, ConfirmDialog, EmptyState, useToast, type Column } from '@/components/ui'
import { ENTITAS_FIELD, TIPE_FIELD, slug } from '../lib/konstanta'
import UpgradeGate from '../components/UpgradeGate'

const kosong = { label: '', field_key: '', data_type: 'teks', options: '', required: false, show_in_table: true, filterable: false, help_text: '', sort_order: 10, is_active: true }

export default function FieldKustom() {
  const { profile, fitur, hanyaBaca } = useAuth()
  const toast = useToast()
  const [entity, setEntity] = useState('work_orders')
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<any>(null)
  const [hapus, setHapus] = useState<any>(null)
  const [sibuk, setSibuk] = useState(false)
  const boleh = profile?.role === 'super_admin' && !hanyaBaca

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('custom_field_defs').select('*').not('entity', 'like', 'ct:%').order('entity').order('sort_order')
    setRows(data ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])
  const tampil = useMemo(() => rows.filter(r => r.entity === entity), [rows, entity])

  if (!fitur('custom_field')) return <UpgradeGate fitur="Field kustom" />

  const simpan = async () => {
    if (!form.label.trim()) { toast.push('Nama field wajib diisi', 'error'); return }
    const key = form.id ? form.field_key : (form.field_key || slug(form.label))
    const options = form.data_type === 'pilihan' ? String(form.options).split(/[\n,;]/).map((s: string) => s.trim()).filter(Boolean) : []
    if (form.data_type === 'pilihan' && !options.length) { toast.push('Isi minimal satu pilihan', 'error'); return }
    setSibuk(true)
    try {
      const payload = { entity, field_key: key, label: form.label.trim(), data_type: form.data_type, options, required: form.required,
        show_in_table: form.show_in_table, filterable: form.filterable, help_text: form.help_text || null, sort_order: Number(form.sort_order) || 0, is_active: form.is_active }
      const q = form.id ? supabase.from('custom_field_defs').update(payload).eq('id', form.id)
        : supabase.from('custom_field_defs').insert({ ...payload, company_id: profile!.company_id })
      const { error } = await q
      if (error) throw error
      hapusCacheKonfigurasi()
      toast.push('Field disimpan — form, tabel, dan template impor langsung ikut berubah.', 'success'); setForm(null); load()
    } catch (e: any) { toast.push(/duplicate/.test(e.message) ? 'Kode field sudah dipakai di entitas ini' : e.message, 'error') } finally { setSibuk(false) }
  }

  const ent = ENTITAS_FIELD.find(e => e.value === entity)!
  const cols: Column[] = [
    { key: 'label', header: 'Nama Field' },
    { key: 'field_key', header: 'Kode', render: r => <code className="text-caption">{r.field_key}</code> },
    { key: 'data_type', header: 'Tipe', render: r => TIPE_FIELD.find(t => t.value === r.data_type)?.label ?? r.data_type },
    { key: 'options', header: 'Pilihan', render: r => r.options?.length ? r.options.join(', ') : '-' },
    { key: 'required', header: 'Wajib', render: r => r.required ? <Badge tone="amber">Wajib</Badge> : '-' },
    { key: 'show_in_table', header: 'Di tabel', render: r => r.show_in_table ? 'Ya' : 'Tidak' },
    { key: 'is_active', header: 'Status', render: r => <Badge tone={r.is_active ? 'emerald' : 'slate'}>{r.is_active ? 'Aktif' : 'Nonaktif'}</Badge> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Field Kustom" breadcrumb={['Pengaturan', 'Field Kustom']}
        subtitle="Tambahkan kolom khusus perusahaan Anda (mis. No. SC, Nama ODP, Laborcode) tanpa mengubah struktur inti aplikasi."
        actions={boleh && <Button icon={<Plus size={16} />} onClick={() => setForm({ ...kosong })}>Tambah Field</Button>} />
      <Tabs value={entity} onChange={setEntity} tabs={ENTITAS_FIELD.map(e => ({ value: e.value, label: e.label, count: rows.filter(r => r.entity === e.value).length }))} />
      <SectionCard title={`Field tambahan — ${ent.label}`}
        subtitle="Field muncul otomatis di form, kolom tabel, filter, dan template Pusat Impor. Nilainya divalidasi di basis data."
        action={<Link to={ent.halaman} className="inline-flex items-center gap-1 text-caption text-primary-600">Buka halaman {ent.label} <ExternalLink size={12} /></Link>}>
        <DataTable columns={cols} rows={tampil} loading={loading} dense searchable={false}
          onRowClick={boleh ? (r) => setForm({ ...r, options: (r.options ?? []).join('\n') }) : undefined}
          emptyTitle="Belum ada field tambahan"
          emptyMessage="Contoh untuk mitra Telkom Akses: No. SC / Order ID, Nama ODP, SN ONT, Jenis Order."
          emptyAction={boleh && <Button size="sm" icon={<SlidersHorizontal size={14} />} onClick={() => setForm({ ...kosong })}>Buat field pertama</Button>} />
      </SectionCard>
      <p className="text-caption text-ink-500">Catatan: field kustom tidak mengubah tabel inti. Menonaktifkan field menyembunyikannya tanpa menghapus nilai lama. Setiap perubahan tercatat di Log Audit.</p>

      <Drawer open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Ubah Field' : `Field baru — ${ent.label}`}
        footer={<>
          <Button variant="outline" onClick={() => setForm(null)}>Batal</Button>
          {form?.id && <Button variant="danger" onClick={() => { setHapus(form); setForm(null) }}>Hapus</Button>}
          <Button loading={sibuk} onClick={simpan}>Simpan</Button></>}>
        {form && <div className="space-y-4">
          <Field label="Nama field" required hint="Tampil sebagai judul kolom & label form."><Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="mis. Nama ODP" /></Field>
          <Field label="Kode" hint={form.id ? 'Kode tidak bisa diubah setelah dibuat.' : 'Dibuat otomatis dari nama; huruf kecil & garis bawah.'}>
            <Input value={form.id ? form.field_key : (form.field_key || slug(form.label))} disabled={!!form.id} onChange={e => setForm({ ...form, field_key: slug(e.target.value) })} /></Field>
          <Field label="Tipe data" required><Select value={form.data_type} onChange={(e: any) => setForm({ ...form, data_type: e.target.value })} options={TIPE_FIELD} /></Field>
          {form.data_type === 'pilihan' && <Field label="Daftar pilihan" required hint="Satu pilihan per baris (atau pisahkan dengan koma)."><textarea className="w-full rounded-sm border border-ink-200 p-2 text-body min-h-[90px] bg-surface" value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} /></Field>}
          <Field label="Teks bantuan"><Input value={form.help_text ?? ''} onChange={e => setForm({ ...form, help_text: e.target.value })} /></Field>
          <Field label="Urutan"><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} /></Field>
          <Checkbox label="Wajib diisi (berlaku untuk data baru/diubah)" checked={form.required} onChange={(e: any) => setForm({ ...form, required: e.target.checked })} />
          <Checkbox label="Tampilkan sebagai kolom tabel" checked={form.show_in_table} onChange={(e: any) => setForm({ ...form, show_in_table: e.target.checked })} />
          <Checkbox label="Bisa dipakai menyaring" checked={form.filterable} onChange={(e: any) => setForm({ ...form, filterable: e.target.checked })} />
          <Checkbox label="Aktif" checked={form.is_active} onChange={(e: any) => setForm({ ...form, is_active: e.target.checked })} />
        </div>}
      </Drawer>
      <ConfirmDialog open={!!hapus} onClose={() => setHapus(null)} danger title="Hapus field?"
        message={`Definisi field "${hapus?.label}" dihapus. Nilai lama tetap tersimpan di data tetapi tidak ditampilkan. Lebih aman: nonaktifkan saja.`}
        onConfirm={async () => { const { error } = await supabase.from('custom_field_defs').delete().eq('id', hapus.id); if (error) toast.push(error.message, 'error'); else { hapusCacheKonfigurasi(); load() } }} />
      {!boleh && !loading && tampil.length === 0 && <EmptyState title="Hanya Super Admin yang dapat mengatur field" />}
    </div>
  )
}
