import React, { useEffect, useState } from 'react'
import { Copy, UserPlus, Ban, MessageCircle } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth, ROLE_LABEL } from '@/lib/auth'
import { PageHeader, SectionCard, DataTable, Badge, Button, Field, Input, Select, useToast, type Column } from '@/components/ui'

const alamatApp = () => `${window.location.origin}${window.location.pathname}`
const tautan = (token: string) => `${alamatApp()}#/undangan/${token}`

export default function UndangTim() {
  const { profile, company, langganan, hanyaBaca } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [cabang, setCabang] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'teknisi', branch_id: '' })
  const [sibuk, setSibuk] = useState(false)
  const boleh = ['super_admin', 'manager_hr'].includes(profile?.role ?? '') && !hanyaBaca

  const load = async () => {
    setLoading(true)
    const [{ data: i }, { data: b }] = await Promise.all([
      supabase.from('tenant_invites').select('*').order('created_at', { ascending: false }),
      supabase.from('branches').select('id,name').eq('is_active', true).order('name'),
    ])
    setRows(i ?? []); setCabang(b ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const kirim = async () => {
    const email = form.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.push('Email tidak valid', 'error'); return }
    setSibuk(true)
    try {
      const { data, error } = await supabase.from('tenant_invites').insert({
        company_id: profile!.company_id, email, full_name: form.full_name || null, role: form.role, branch_id: form.branch_id || null,
      }).select().single()
      if (error) throw error
      await navigator.clipboard?.writeText(tautan((data as any).token)).catch(() => {})
      toast.push('Undangan dibuat — tautan sudah disalin. Kirim lewat WhatsApp/email ke yang bersangkutan.', 'success')
      setForm({ email: '', full_name: '', role: form.role, branch_id: form.branch_id }); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal membuat undangan', 'error') } finally { setSibuk(false) }
  }

  const statusOf = (r: any) => r.accepted_at ? ['Diterima', 'emerald'] : r.revoked_at ? ['Dicabut', 'slate']
    : new Date(r.expires_at) < new Date() ? ['Kedaluwarsa', 'red'] : ['Menunggu', 'amber']

  const cols: Column[] = [
    { key: 'email', header: 'Email' },
    { key: 'full_name', header: 'Nama', render: r => r.full_name || '-' },
    { key: 'role', header: 'Jabatan', render: r => ROLE_LABEL[r.role] ?? r.role },
    { key: 'expires_at', header: 'Berlaku sampai', render: r => new Date(r.expires_at).toLocaleDateString('id-ID') },
    { key: 'status', header: 'Status', render: r => { const [l, t] = statusOf(r); return <Badge tone={t}>{l}</Badge> } },
    { key: 'aksi', header: '', render: r => statusOf(r)[0] === 'Menunggu' && boleh ? (
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" icon={<Copy size={13} />} onClick={() => { navigator.clipboard?.writeText(tautan(r.token)); toast.push('Tautan disalin') }}>Salin</Button>
        <Button size="sm" variant="outline" icon={<MessageCircle size={13} />} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Anda diundang bergabung ke workspace ${company?.name ?? ''} di NUSAKARYA. Buka tautan ini untuk membuat akun: ${tautan(r.token)}`)}`, '_blank')}>WA</Button>
        <Button size="sm" variant="ghost" icon={<Ban size={13} />} onClick={async () => {
          const { error } = await supabase.from('tenant_invites').update({ revoked_at: new Date().toISOString() }).eq('id', r.id)
          if (error) toast.push(error.message, 'error'); else { toast.push('Undangan dicabut'); load() }
        }}>Cabut</Button>
      </div>) : null },
  ]

  const peran = Object.entries(ROLE_LABEL).filter(([k]) => profile?.role === 'super_admin' || k !== 'super_admin').map(([value, label]) => ({ value, label }))

  return (
    <div className="space-y-5">
      <PageHeader title="Undang Tim" subtitle="Tambahkan rekan kerja & teknisi tanpa membuatkan kata sandi untuk mereka. Undangan berlaku 7 hari."
        breadcrumb={['Pengaturan', 'Undang Tim']} />
      {boleh ? (
        <SectionCard title="Undangan baru" subtitle={`Pengguna panel: ${langganan?.usage?.users ?? '-'} / ${langganan?.limits?.users ?? '∞'} · Teknisi: ${langganan?.usage?.teknisi ?? '-'} / ${langganan?.limits?.teknisi ?? '∞'}`}>
          <div className="grid gap-3 md:grid-cols-5 items-end">
            <Field label="Email" required><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="nama@perusahaan.id" /></Field>
            <Field label="Nama (opsional)"><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></Field>
            <Field label="Jabatan" required><Select value={form.role} onChange={(e: any) => setForm({ ...form, role: e.target.value })} options={peran} /></Field>
            <Field label="Cabang"><Select value={form.branch_id} onChange={(e: any) => setForm({ ...form, branch_id: e.target.value })} options={cabang.map(c => ({ value: c.id, label: c.name }))} placeholder="— semua —" /></Field>
            <Button icon={<UserPlus size={15} />} loading={sibuk} onClick={kirim}>Buat Undangan</Button>
          </div>
          <p className="mt-3 text-caption text-ink-500">Cara kerja: sistem membuat tautan pribadi → Anda kirim lewat WhatsApp/email → penerima membuka tautan, mengisi nama & kata sandi → akun langsung masuk ke workspace ini dengan jabatan yang Anda pilih. Teknisi kemudian login di aplikasi lapangan dengan email & sandi yang sama.</p>
        </SectionCard>
      ) : <SectionCard title="Undangan"><p className="text-body text-ink-500">Hanya Super Admin atau Manager HR yang dapat mengundang pengguna{hanyaBaca ? ' (workspace sedang hanya-baca)' : ''}.</p></SectionCard>}
      <DataTable columns={cols} rows={rows} loading={loading} exportName="undangan" searchKeys={['email', 'full_name', 'role']}
        emptyTitle="Belum ada undangan" emptyMessage="Mulai dengan mengundang supervisor dan teknisi pertama Anda." />
    </div>
  )
}
