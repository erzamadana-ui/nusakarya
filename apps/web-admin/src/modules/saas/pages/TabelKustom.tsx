import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Plus, Table2, Upload, Settings2 } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { InputFieldKustom, formatNilaiKustom, periksaFieldKustom, hapusCacheKonfigurasi, type DefField } from '@/lib/konfigurasi'
import { PageHeader, SectionCard, DataTable, Button, Drawer, Field, Input, Select, Textarea, Badge, ConfirmDialog, EmptyState, useToast, type Column } from '@/components/ui'
import { MODUL_LABEL, TIPE_FIELD, slug } from '../lib/konstanta'
import UpgradeGate from '../components/UpgradeGate'

/** Daftar & perancang tabel kustom (fitur paket Enterprise). */
export default function TabelKustom() {
  const { profile, fitur, hanyaBaca } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [defs, setDefs] = useState<any[]>([])
  const [form, setForm] = useState<any>(null)
  const [kolom, setKolom] = useState<any>(null)
  const boleh = profile?.role === 'super_admin' && !hanyaBaca
  const load = async () => {
    const [{ data: t }, { data: d }] = await Promise.all([
      supabase.from('custom_tables').select('*').order('name'),
      supabase.from('custom_field_defs').select('*').like('entity', 'ct:%').order('sort_order'),
    ])
    setRows(t ?? []); setDefs(d ?? [])
  }
  useEffect(() => { load() }, [])
  if (!fitur('tabel_kustom')) return <UpgradeGate fitur="Tabel kustom" />

  const simpanTabel = async () => {
    const code = form.id ? form.code : (form.code || slug(form.name).slice(0, 30))
    const payload = { code, name: form.name, description: form.description || null, module_code: form.module_code || 'CORE', is_active: true }
    const { error } = form.id ? await supabase.from('custom_tables').update(payload).eq('id', form.id)
      : await supabase.from('custom_tables').insert({ ...payload, company_id: profile!.company_id })
    if (error) toast.push(error.message, 'error'); else { toast.push('Tabel disimpan'); setForm(null); load() }
  }
  const simpanKolom = async () => {
    const options = kolom.data_type === 'pilihan' ? String(kolom.options).split(/[\n,;]/).map((s: string) => s.trim()).filter(Boolean) : []
    const { error } = await supabase.from('custom_field_defs').insert({
      company_id: profile!.company_id, entity: `ct:${kolom.tabel.code}`, field_key: kolom.field_key || slug(kolom.label), label: kolom.label,
      data_type: kolom.data_type, options, required: !!kolom.required, show_in_table: true, filterable: true, sort_order: defs.filter(d => d.entity === `ct:${kolom.tabel.code}`).length + 1,
    })
    if (error) toast.push(error.message, 'error'); else { hapusCacheKonfigurasi(); toast.push('Kolom ditambahkan'); setKolom(null); load() }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Tabel Kustom" breadcrumb={['Pengaturan', 'Tabel Kustom']}
        subtitle="Buat tabel ringan untuk kebutuhan yang tidak ada di modul inti — mis. daftar kendaraan sewa, izin tetangga, checklist K3 khusus principal."
        actions={boleh && <Button icon={<Plus size={16} />} onClick={() => setForm({ name: '', code: '', description: '', module_code: 'OPERATIONS' })}>Tabel Baru</Button>} />
      {rows.length === 0 ? <SectionCard title="Belum ada tabel kustom"><EmptyState icon={<Table2 size={22} />} title="Belum ada tabel kustom" message="Tabel kustom otomatis mendapat halaman data, form, ekspor, dan dataset di Pusat Impor." /></SectionCard> :
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map(t => {
          const kol = defs.filter(d => d.entity === `ct:${t.code}`)
          return (
            <SectionCard key={t.id} title={t.name} subtitle={t.description ?? ''}
              action={<Badge tone="teal">{MODUL_LABEL[t.module_code] ?? t.module_code}</Badge>}>
              <div className="text-caption text-ink-500">Kolom: {kol.length ? kol.map(k => k.label).join(', ') : 'belum ada'}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={`/data/${t.code}`}><Button size="sm" icon={<Table2 size={13} />}>Buka data</Button></Link>
                {boleh && <Button size="sm" variant="outline" icon={<Plus size={13} />} onClick={() => setKolom({ tabel: t, label: '', data_type: 'teks', options: '', required: false })}>Kolom</Button>}
                {boleh && <Button size="sm" variant="ghost" icon={<Settings2 size={13} />} onClick={() => setForm(t)}>Ubah</Button>}
                <Link to={`/pengaturan/impor?dataset=ct:${t.code}`}><Button size="sm" variant="ghost" icon={<Upload size={13} />}>Impor</Button></Link>
              </div>
            </SectionCard>)
        })}</div>}

      <Drawer open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Ubah tabel' : 'Tabel kustom baru'}
        footer={<><Button variant="outline" onClick={() => setForm(null)}>Batal</Button><Button onClick={simpanTabel}>Simpan</Button></>}>
        {form && <div className="space-y-4">
          <Field label="Nama tabel" required><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="mis. Izin Warga / RT" /></Field>
          <Field label="Kode" hint="Dipakai di alamat halaman."><Input disabled={!!form.id} value={form.id ? form.code : (form.code || slug(form.name).slice(0, 30))} onChange={e => setForm({ ...form, code: slug(e.target.value).slice(0, 30) })} /></Field>
          <Field label="Keterangan"><Textarea value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Hak akses mengikuti modul" hint="Siapa yang boleh membaca/menulis tabel ini mengikuti hak akses jabatan pada modul tersebut.">
            <Select value={form.module_code} onChange={(e: any) => setForm({ ...form, module_code: e.target.value })} options={Object.entries(MODUL_LABEL).map(([value, label]) => ({ value, label }))} placeholder="" /></Field>
        </div>}
      </Drawer>
      <Drawer open={!!kolom} onClose={() => setKolom(null)} title={`Kolom baru — ${kolom?.tabel?.name ?? ''}`}
        footer={<><Button variant="outline" onClick={() => setKolom(null)}>Batal</Button><Button onClick={simpanKolom}>Tambah</Button></>}>
        {kolom && <div className="space-y-4">
          <Field label="Nama kolom" required><Input value={kolom.label} onChange={e => setKolom({ ...kolom, label: e.target.value })} /></Field>
          <Field label="Tipe"><Select value={kolom.data_type} onChange={(e: any) => setKolom({ ...kolom, data_type: e.target.value })} options={TIPE_FIELD} placeholder="" /></Field>
          {kolom.data_type === 'pilihan' && <Field label="Pilihan (satu per baris)"><Textarea value={kolom.options} onChange={e => setKolom({ ...kolom, options: e.target.value })} /></Field>}
          <label className="flex items-center gap-2 text-body"><input type="checkbox" checked={kolom.required} onChange={e => setKolom({ ...kolom, required: e.target.checked })} /> Wajib diisi</label>
        </div>}
      </Drawer>
    </div>
  )
}

/** Halaman data generik untuk satu tabel kustom: /data/:kode */
export function DataKustom() {
  const { kode } = useParams()
  const { profile, can } = useAuth()
  const toast = useToast()
  const [tabel, setTabel] = useState<any>(null)
  const [defs, setDefs] = useState<DefField[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<any>(null)
  const [hapus, setHapus] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    const { data: t } = await supabase.from('custom_tables').select('*').eq('code', kode).maybeSingle()
    setTabel(t)
    if (t) {
      const [{ data: d }, { data: r }] = await Promise.all([
        supabase.from('custom_field_defs').select('*').eq('entity', `ct:${kode}`).eq('is_active', true).order('sort_order'),
        supabase.from('custom_records').select('*').eq('table_id', (t as any).id).order('created_at', { ascending: false }).limit(5000),
      ])
      setDefs((d ?? []) as DefField[]); setRows(r ?? [])
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [kode])
  const bolehTulis = tabel && can(tabel.module_code, 'write')
  const cols: Column[] = useMemo(() => [
    ...defs.map(d => ({ key: `data.${d.field_key}`, header: d.label, render: (r: any) => formatNilaiKustom(d, r.data?.[d.field_key]) })),
    { key: 'created_at', header: 'Dibuat', render: (r: any) => new Date(r.created_at).toLocaleDateString('id-ID') },
  ], [defs])
  const datar = rows.map(r => ({ ...r, ...Object.fromEntries(Object.entries(r.data ?? {}).map(([k, v]) => [`data.${k}`, v])) }))

  if (!loading && !tabel) return <EmptyState title="Tabel tidak ditemukan" message="Tabel kustom ini tidak ada atau Anda tidak berhak membukanya." />
  const simpan = async () => {
    const galat = periksaFieldKustom(defs, form.data)
    if (galat) { toast.push(galat, 'error'); return }
    const { error } = form.id ? await supabase.from('custom_records').update({ data: form.data }).eq('id', form.id)
      : await supabase.from('custom_records').insert({ company_id: profile!.company_id, table_id: tabel.id, data: form.data })
    if (error) toast.push(error.message, 'error'); else { toast.push('Tersimpan'); setForm(null); load() }
  }
  return (
    <div className="space-y-5">
      <PageHeader title={tabel?.name ?? 'Tabel kustom'} subtitle={tabel?.description ?? 'Tabel kustom perusahaan'} breadcrumb={['Data Kustom', tabel?.name ?? '']}
        actions={bolehTulis && <div className="flex gap-2">
          <Link to={`/pengaturan/impor?dataset=ct:${kode}`}><Button variant="outline" icon={<Upload size={15} />}>Impor</Button></Link>
          <Button icon={<Plus size={16} />} onClick={() => setForm({ data: {} })}>Tambah</Button></div>} />
      <DataTable columns={cols} rows={datar} loading={loading} exportName={`tabel-${kode}`}
        searchKeys={defs.map(d => `data.${d.field_key}`)} onRowClick={bolehTulis ? (r) => setForm({ id: r.id, data: r.data ?? {} }) : undefined}
        emptyTitle="Belum ada data" emptyMessage={defs.length ? 'Tambahkan baris pertama atau impor dari Excel.' : 'Tabel belum punya kolom. Tambahkan kolom di Pengaturan → Tabel Kustom.'} />
      <Drawer open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Ubah data' : 'Data baru'}
        footer={<><Button variant="outline" onClick={() => setForm(null)}>Batal</Button>
          {form?.id && <Button variant="danger" onClick={() => { setHapus(form); setForm(null) }}>Hapus</Button>}
          <Button onClick={simpan}>Simpan</Button></>}>
        {form && <InputFieldKustom defs={defs} value={form.data} onChange={v => setForm({ ...form, data: v })} judul={tabel?.name ?? ''} />}
      </Drawer>
      <ConfirmDialog open={!!hapus} onClose={() => setHapus(null)} danger title="Hapus baris?" message="Baris ini akan dihapus permanen (tercatat di Log Audit)."
        onConfirm={async () => { const { error } = await supabase.from('custom_records').delete().eq('id', hapus.id); if (error) toast.push(error.message, 'error'); else load() }} />
    </div>
  )
}
