import React, { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { PageHeader, SectionCard, Field, Input, Select, Button, ChoiceChips, useToast } from '@/components/ui'

const HARI = [{ value: 1, label: 'Sen' }, { value: 2, label: 'Sel' }, { value: 3, label: 'Rab' }, { value: 4, label: 'Kam' }, { value: 5, label: 'Jum' }, { value: 6, label: 'Sab' }, { value: 7, label: 'Min' }]

/** Pengaturan dasar per perusahaan (tenant_settings). */
export default function Preferensi() {
  const { profile, hanyaBaca } = useAuth()
  const toast = useToast()
  const [f, setF] = useState<any>(null)
  const [sibuk, setSibuk] = useState(false)
  const boleh = profile?.role === 'super_admin' && !hanyaBaca
  useEffect(() => {
    supabase.from('tenant_settings').select('*').eq('company_id', profile?.company_id).maybeSingle()
      .then(({ data }) => setF(data ?? { zona_waktu: 'Asia/Jakarta', mata_uang: 'IDR', format_tanggal: 'DD/MM/YYYY', awal_tahun_fiskal: 1, prefix_wo: 'WO', hari_kerja: [1, 2, 3, 4, 5, 6], jam_mulai: '08:00', jam_selesai: '17:00', radius_absensi_m: 200, wajib_foto_evidence: 2 }))
  }, [profile?.company_id])
  if (!f) return null
  const simpan = async () => {
    setSibuk(true)
    const { id, created_at, updated_at, ...isi } = f
    const { error } = await supabase.from('tenant_settings').upsert({ ...isi, company_id: profile!.company_id, updated_by: profile!.id }, { onConflict: 'company_id' })
    setSibuk(false)
    if (error) toast.push(error.message, 'error'); else toast.push('Pengaturan disimpan', 'success')
  }
  const s = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  return (
    <div className="space-y-5">
      <PageHeader title="Pengaturan Perusahaan" breadcrumb={['Pengaturan', 'Preferensi']}
        subtitle="Aturan dasar workspace: zona waktu, jam kerja, penomoran, dan standar evidence lapangan."
        actions={boleh && <Button icon={<Save size={15} />} loading={sibuk} onClick={simpan}>Simpan</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Regional & format">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Zona waktu"><Select disabled={!boleh} value={f.zona_waktu} onChange={s('zona_waktu')} placeholder="" options={['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']} /></Field>
            <Field label="Mata uang"><Input disabled value={f.mata_uang} /></Field>
            <Field label="Format tanggal"><Select disabled={!boleh} value={f.format_tanggal} onChange={s('format_tanggal')} placeholder="" options={['DD/MM/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY']} /></Field>
            <Field label="Awal tahun fiskal (bulan)"><Input disabled={!boleh} type="number" min={1} max={12} value={f.awal_tahun_fiskal} onChange={s('awal_tahun_fiskal')} /></Field>
          </div>
        </SectionCard>
        <SectionCard title="Operasional lapangan">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Awalan nomor WO"><Input disabled={!boleh} value={f.prefix_wo} onChange={s('prefix_wo')} /></Field>
            <Field label="Minimal foto evidence per WO" hint="Dipakai sebagai standar QC."><Input disabled={!boleh} type="number" min={0} value={f.wajib_foto_evidence} onChange={s('wajib_foto_evidence')} /></Field>
            <Field label="Radius absensi (meter)"><Input disabled={!boleh} type="number" value={f.radius_absensi_m} onChange={s('radius_absensi_m')} /></Field>
            <div />
            <Field label="Jam mulai"><Input disabled={!boleh} type="time" value={String(f.jam_mulai).slice(0, 5)} onChange={s('jam_mulai')} /></Field>
            <Field label="Jam selesai"><Input disabled={!boleh} type="time" value={String(f.jam_selesai).slice(0, 5)} onChange={s('jam_selesai')} /></Field>
          </div>
          <div className="mt-3"><div className="text-caption font-medium text-ink-600 mb-1.5">Hari kerja</div>
            <ChoiceChips options={HARI} value={f.hari_kerja} onChange={(v: number[]) => boleh && setF({ ...f, hari_kerja: v })} /></div>
        </SectionCard>
      </div>
      <p className="text-caption text-ink-500">Catatan keterbatasan: nilai di halaman ini tersimpan dan tercatat di Log Audit; pemakaian otomatisnya di aplikasi lapangan (radius & minimal foto) masuk backlog tahap berikutnya.</p>
    </div>
  )
}
