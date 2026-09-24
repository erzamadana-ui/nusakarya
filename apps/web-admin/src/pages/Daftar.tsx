import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Building2, ShieldCheck, Upload, Sparkles } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth, ROLE_LABEL } from '@/lib/auth'
import { Button, Input, Field, Select, Checkbox } from '@/components/ui'

const PAKET = [
  { value: 'starter', label: 'Starter — WO, evidence, absensi, material' },
  { value: 'professional', label: 'Professional — + BAST, invoice, AP/AR, payroll (disarankan)' },
  { value: 'enterprise', label: 'Enterprise — + tabel & alur kustom' },
]

function Kerangka({ judul, sub, children }: { judul: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-surface">
      <div className="hidden lg:flex flex-col justify-between bg-sidebar text-white p-12">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-md bg-primary-500 grid place-items-center font-display font-extrabold text-lg">N</div>
          <div><div className="font-display font-bold text-xl tracking-tight">NUSAKARYA</div>
            <div className="text-caption text-white/55">Partner Operating System · kontraktor fiber optic</div></div>
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="font-display text-[28px] leading-[1.2] font-bold">Workspace siap dalam 15 menit. Data lama cukup diunggah dari Excel.</h2>
          {[[Building2, 'Template khusus mitra fiber optic: jabatan, jenis pekerjaan, SLA, bagan akun'],
            [Upload, 'Impor CSV/Excel dengan pemetaan kolom, pratinjau, dan pembatalan'],
            [ShieldCheck, 'Data tiap perusahaan terisolasi di basis data (Row Level Security)'],
            [Sparkles, 'Uji coba 30 hari, tanpa kartu kredit']].map(([I, t]: any, i) => (
            <div key={i} className="flex items-start gap-2.5 text-body text-white/80"><I size={17} className="text-primary-300 shrink-0 mt-0.5" />{t}</div>))}
        </div>
        <p className="text-caption text-white/40">Status layanan: STAGING — belum production-ready. Jangan unggah data pribadi nyata selama uji coba tanpa perjanjian pemrosesan data.</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <h1 className="font-display text-[26px] font-bold text-ink-900">{judul}</h1>
          <p className="text-body text-ink-500 mt-1 mb-6">{sub}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

/** Pendaftaran workspace baru (tanpa login). */
export default function Daftar() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ perusahaan: '', full_name: '', email: '', telepon: '', password: '', paket: 'professional', template: 'fo_telkom_akses', data_contoh: true, setuju: false, situs_web: '' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const kirim = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('saas-publik', { body: { action: 'daftar', ...f } })
      const pesan = (data as any)?.error ?? (error ? await (error as any).context?.json?.().then((j: any) => j?.error).catch(() => null) : null) ?? error?.message
      if (pesan) throw new Error(pesan)
      await signIn(f.email.trim().toLowerCase(), f.password)
      nav('/onboarding')
    } catch (x: any) { setErr(x?.message ?? 'Pendaftaran gagal') } finally { setBusy(false) }
  }
  const s = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  return (
    <Kerangka judul="Buat workspace perusahaan" sub="Satu workspace = satu perusahaan mitra. Anda menjadi Super Admin-nya.">
      <form onSubmit={kirim} className="space-y-3.5">
        <Field label="Nama perusahaan" required><Input value={f.perusahaan} onChange={s('perusahaan')} placeholder="PT Contoh Fiber Nusantara" required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nama Anda" required><Input value={f.full_name} onChange={s('full_name')} required /></Field>
          <Field label="No. WhatsApp"><Input value={f.telepon} onChange={s('telepon')} placeholder="08…" /></Field></div>
        <Field label="Email kerja" required><Input type="email" autoComplete="username" value={f.email} onChange={s('email')} required /></Field>
        <Field label="Kata sandi" required hint="Minimal 8 karakter, berisi huruf dan angka."><Input type="password" autoComplete="new-password" value={f.password} onChange={s('password')} required /></Field>
        <Field label="Paket uji coba (30 hari)"><Select value={f.paket} onChange={s('paket')} options={PAKET} placeholder="" /></Field>
        <Field label="Template bisnis"><Select value={f.template} onChange={s('template')} placeholder="" options={[{ value: 'fo_telkom_akses', label: 'Mitra Fiber Optic Telkom Akses' }, { value: 'kontraktor_umum', label: 'Kontraktor Jaringan Umum' }]} /></Field>
        <input className="hidden" tabIndex={-1} autoComplete="off" value={f.situs_web} onChange={s('situs_web')} aria-hidden />
        <Checkbox label="Isi dengan data contoh (fiktif) agar bisa langsung dicoba — bisa dihapus tuntas kapan saja" checked={f.data_contoh} onChange={(e: any) => setF({ ...f, data_contoh: e.target.checked })} />
        <Checkbox label="Saya menyetujui ketentuan uji coba: layanan berstatus staging, dan saya bertanggung jawab atas dasar hukum data pribadi yang saya unggah (UU PDP)." checked={f.setuju} onChange={(e: any) => setF({ ...f, setuju: e.target.checked })} />
        {err && <div className="p-3 rounded-sm bg-red-50 text-red-700 text-body">{err}</div>}
        <Button type="submit" size="lg" loading={busy} className="w-full" disabled={!f.setuju}>Buat workspace</Button>
        <p className="text-caption text-ink-400 text-center">Sudah punya akun? <Link to="/" className="text-primary-600">Masuk</Link></p>
      </form>
    </Kerangka>
  )
}

/** Terima undangan: /undangan/:token */
export function TerimaUndangan() {
  const { token = '' } = useParams()
  const { signIn, session } = useAuth()
  const nav = useNavigate()
  const [info, setInfo] = useState<any>(undefined)
  const [f, setF] = useState({ full_name: '', password: '' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { supabase.rpc('fn_info_undangan', { p_token: token }).then(({ data }) => { setInfo(data ?? null); setF(x => ({ ...x, full_name: (data as any)?.full_name ?? '' })) }) }, [token])

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      if (session) {
        const { error } = await supabase.rpc('fn_terima_undangan', { p_token: token })
        if (error) throw error
        window.location.hash = '#/dashboard'; window.location.reload(); return
      }
      const { data, error } = await supabase.functions.invoke('saas-publik', { body: { action: 'terima_undangan', token, ...f } })
      const pesan = (data as any)?.error ?? (error ? await (error as any).context?.json?.().then((j: any) => j?.error).catch(() => null) : null) ?? error?.message
      if (pesan) throw new Error(pesan)
      await signIn(info.email, f.password)
      nav('/dashboard')
    } catch (x: any) { setErr(x?.message ?? 'Gagal menerima undangan') } finally { setBusy(false) }
  }
  if (info === undefined) return <Kerangka judul="Memeriksa undangan…" sub=""><div /></Kerangka>
  if (!info || !info.berlaku) return (
    <Kerangka judul="Undangan tidak berlaku" sub="Tautan sudah dipakai, dicabut, atau kedaluwarsa (7 hari). Minta admin perusahaan Anda mengirim undangan baru.">
      <Link to="/"><Button variant="outline">Ke halaman masuk</Button></Link></Kerangka>)
  return (
    <Kerangka judul={`Bergabung ke ${info.perusahaan}`} sub={`Anda diundang sebagai ${ROLE_LABEL[info.role] ?? info.role}.`}>
      <form onSubmit={kirim} className="space-y-3.5">
        <Field label="Email"><Input value={info.email} disabled /></Field>
        {!session && <>
          <Field label="Nama lengkap" required><Input value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} required /></Field>
          <Field label="Buat kata sandi" required hint="Minimal 8 karakter, berisi huruf dan angka."><Input type="password" autoComplete="new-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required /></Field></>}
        {err && <div className="p-3 rounded-sm bg-red-50 text-red-700 text-body">{err}</div>}
        <Button type="submit" size="lg" loading={busy} className="w-full" icon={<CheckCircle2 size={16} />}>Terima undangan</Button>
        <p className="text-caption text-ink-400">Teknisi: setelah ini, masuk di aplikasi lapangan (menu Teknisi) dengan email & kata sandi yang sama.</p>
      </form>
    </Kerangka>
  )
}

/** Pengguna sudah login tetapi belum punya workspace. */
export function BuatWorkspace() {
  const { signOut, refresh, session } = useAuth()
  const [f, setF] = useState({ nama: '', paket: 'professional', template: 'fo_telkom_akses', contoh: true })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const kirim = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    const { error } = await supabase.rpc('fn_buat_workspace', { p_nama: f.nama, p_template: f.template, p_paket: f.paket, p_data_contoh: f.contoh })
    setBusy(false)
    if (error) { setErr(error.message); return }
    window.location.hash = '#/onboarding'; await refresh()
  }
  return (
    <Kerangka judul="Akun Anda belum punya workspace" sub={`Masuk sebagai ${session?.user?.email ?? ''}. Buat workspace baru, atau buka tautan undangan dari admin perusahaan Anda.`}>
      <form onSubmit={kirim} className="space-y-3.5">
        <Field label="Nama perusahaan" required><Input value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} required /></Field>
        <Field label="Paket uji coba"><Select value={f.paket} onChange={(e: any) => setF({ ...f, paket: e.target.value })} options={PAKET} placeholder="" /></Field>
        <Checkbox label="Isi data contoh (fiktif)" checked={f.contoh} onChange={(e: any) => setF({ ...f, contoh: e.target.checked })} />
        {err && <div className="p-3 rounded-sm bg-red-50 text-red-700 text-body">{err}</div>}
        <Button type="submit" size="lg" loading={busy} className="w-full">Buat workspace</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={signOut}>Keluar</Button>
      </form>
    </Kerangka>
  )
}
