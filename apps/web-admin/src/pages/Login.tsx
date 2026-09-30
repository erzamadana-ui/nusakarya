import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import supabase, { getAuthMethods } from '@/lib/supabase'
import { Button, Input, Field } from '@/components/ui'
import { ShieldCheck, Activity, Boxes, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'

type Mode = 'password' | 'phone'

function normalizePhone(raw: string) {
  const digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return `+${digits.slice(1).replace(/\D/g, '')}`
  const clean = digits.replace(/\D/g, '')
  if (clean.startsWith('0')) return `+62${clean.slice(1)}`
  if (clean.startsWith('62')) return `+${clean}`
  return `+${clean}`
}

export default function Login() {
 const { signIn } = useAuth()
 const [methods, setMethods] = useState({ google: false, phone: false })
 useEffect(() => { getAuthMethods().then(setMethods) }, [])
 const [mode, setMode] = useState<Mode>('password')
 const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
 const [phone, setPhone] = useState(''); const [otp, setOtp] = useState(''); const [otpSent, setOtpSent] = useState(false)
 const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)

 const submit = async (e: React.FormEvent) => {
 e.preventDefault(); setErr(''); setBusy(true)
 try { await signIn(email.trim(), pw) }
 catch (x: any) { setErr(x?.message === 'Invalid login credentials' ? 'Email atau kata sandi salah.' : (x?.message ?? 'Gagal masuk.')) }
 finally { setBusy(false) }
 }

 const google = async () => {
   if (!methods.google) return
   setErr(''); setBusy(true)
   try {
     const { error } = await supabase.auth.signInWithOAuth({
       provider: 'google',
       options: { redirectTo: window.location.origin + window.location.pathname },
     })
     if (error) throw error
   } catch (x: any) { setErr(x?.message ?? 'Login Google gagal. Periksa konfigurasi provider.') ; setBusy(false) }
 }

 const phoneLogin = async (e: React.FormEvent) => {
   e.preventDefault(); setErr(''); setBusy(true)
   const normalized = normalizePhone(phone)
   try {
     if (!methods.phone) throw new Error('Login SMS belum tersedia. Gunakan email dan kata sandi.')
     if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error('Nomor HP harus berformat internasional, misalnya +62812…')
     if (!otpSent) {
       const { error } = await supabase.auth.signInWithOtp({ phone: normalized, options: { shouldCreateUser: false } })
       if (error) throw error
       setPhone(normalized); setOtpSent(true)
     } else {
       const { error } = await supabase.auth.verifyOtp({ phone: normalized, token: otp.trim(), type: 'sms' })
       if (error) throw error
     }
   } catch (x: any) {
     setErr(x?.message ?? 'OTP gagal. Pastikan nomor terverifikasi pada akun perusahaan.')
   } finally { setBusy(false) }
 }

 return (
 <div className="min-h-screen grid lg:grid-cols-2 bg-surface">
 <div className="hidden lg:flex flex-col justify-between bg-sidebar text-white p-12">
 <div className="flex items-center gap-3">
 <div className="w-11 h-11 rounded-md bg-primary-500 grid place-items-center font-display font-extrabold text-lg">N</div>
 <div><div className="font-display font-bold text-xl tracking-tight">NUSAKARYA</div>
 <div className="text-caption text-white/55">Operational Control &amp; Supervision Tools</div></div>
 </div>
 <div>
 <h2 className="font-display text-[30px] leading-[1.2] font-bold max-w-md">Satu kendali untuk deployment dan manage service fiber optic.</h2>
 <p className="mt-3 text-white/65 max-w-md text-body-l">Dari survey sampai BAST, dari permintaan material sampai pembayaran mitra — terekam, terukur, dan bisa diaudit.</p>
 <div className="mt-8 grid grid-cols-2 gap-4 max-w-md">
 {[[Activity,'Assurance & SLA'],[Boxes,'Inventory NTE ber-serial'],[Wallet,'Payroll & pembayaran mitra'],[ShieldCheck,'Jejak audit penuh']].map(([I,t]: any, i) => (
 <div key={i} className="flex items-center gap-2.5 text-body text-white/80"><I size={17} className="text-primary-300 shrink-0" />{t}</div>))}
 </div>
 </div>
 <p className="text-caption text-white/35">© 2026 NUSAKARYA · Multi-tenant untuk mitra kerja</p>
 </div>

 <div className="flex items-center justify-center p-6 sm:p-12">
 <div className="w-full max-w-sm">
 <div className="lg:hidden flex items-center gap-2.5 mb-8">
 <div className="w-10 h-10 rounded-md bg-primary-500 text-white grid place-items-center font-display font-extrabold">N</div>
 <span className="font-display font-bold text-lg">NUSAKARYA</span>
 </div>
 <h1 className="font-display text-[26px] font-bold text-ink-900">Masuk</h1>
 <p className="text-body text-ink-500 mt-1 mb-5">Pilih metode masuk untuk akun perusahaan yang sudah terdaftar.</p>
 <Button type="button" variant="outline" size="lg" loading={busy} className="w-full" onClick={google} disabled={!methods.google}>
 <span aria-hidden="true" className="mr-2 font-bold text-lg">G</span> {methods.google ? 'Lanjutkan dengan Google' : 'Google · segera tersedia'}
 </Button>
 <div className="flex items-center gap-3 my-5 text-caption text-ink-400"><span className="h-px flex-1 bg-ink-200" />atau<span className="h-px flex-1 bg-ink-200" /></div>
 <div className="grid grid-cols-2 rounded-sm border border-ink-200 p-1 mb-5" role="tablist" aria-label="Metode masuk">
 <button type="button" role="tab" aria-selected={mode === 'password'} onClick={() => { setMode('password'); setErr('') }} className={`h-9 rounded-xs text-body font-semibold ${mode === 'password' ? 'bg-primary-50 text-primary-700' : 'text-ink-500'}`}>Email & sandi</button>
 <button type="button" role="tab" aria-selected={mode === 'phone'} disabled={!methods.phone} onClick={() => { setMode('phone'); setErr(''); setOtp(''); setOtpSent(false) }} className={`h-9 rounded-xs text-body font-semibold ${mode === 'phone' ? 'bg-primary-50 text-primary-700' : 'text-ink-500'}`}>{methods.phone ? 'Nomor HP · OTP' : 'OTP · segera tersedia'}</button>
 </div>
 {mode === 'password' ? <form onSubmit={submit}>
 <div className="space-y-4">
 <Field label="Email" required><Input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@perusahaan.id" required /></Field>
 <Field label="Kata Sandi" required><Input type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" required /></Field>
 </div>
 {err && <div role="alert" className="mt-4 p-3 rounded-sm bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-body">{err}</div>}
 <Button type="submit" size="lg" loading={busy} className="w-full mt-6">Masuk</Button>
 </form> : <form onSubmit={phoneLogin}>
 <div className="space-y-4">
 <Field label="Nomor HP terverifikasi" required hint="Contoh: +62 812… atau 0812…"><Input type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+62 812 3456 7890" required disabled={otpSent} /></Field>
 {otpSent && <Field label="Kode OTP SMS" required hint="Masukkan kode yang dikirim ke nomor Anda."><Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 digit" required /></Field>}
 </div>
 {err && <div role="alert" className="mt-4 p-3 rounded-sm bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-body">{err}</div>}
 <Button type="submit" size="lg" loading={busy} className="w-full mt-6">{otpSent ? 'Verifikasi & masuk' : 'Kirim kode SMS'}</Button>
 {otpSent && <button type="button" className="w-full mt-3 text-caption text-primary-700 underline" onClick={() => { setOtpSent(false); setOtp(''); setErr('') }}>Ganti nomor</button>}
 </form>}
 <p className="mt-5 text-[11px] leading-relaxed text-ink-400 text-center">Gunakan email perusahaan yang sama saat masuk dengan Google. Kode SMS hanya dikirim ke nomor yang sudah terverifikasi pada akun Anda.</p>
 <p className="mt-4 text-caption text-ink-400 text-center">Lupa kata sandi? Hubungi administrator perusahaan Anda.</p>
 <div className="mt-5 rounded-md border border-primary-200 bg-primary-50 p-3 text-center text-body text-primary-800">
 Perusahaan Anda belum terdaftar? <Link to="/daftar" className="font-semibold underline">Buat workspace — uji coba 30 hari</Link>
 </div>
 <p className="mt-3 text-[11px] text-ink-400 text-center">Akses pilot perusahaan · onboarding didampingi. · <a href="../" className="underline">Tentang NUSAKARYA</a></p>
 </div>
 </div>
 </div>
 )
}
