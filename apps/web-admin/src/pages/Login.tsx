import React, { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { Button, Input, Field } from '@/components/ui'
import { ShieldCheck, Activity, Boxes, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Login() {
 const { signIn } = useAuth()
 const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
 const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)

 const submit = async (e: React.FormEvent) => {
 e.preventDefault(); setErr(''); setBusy(true)
 try { await signIn(email.trim(), pw) }
 catch (x: any) { setErr(x?.message === 'Invalid login credentials' ? 'Email atau kata sandi salah.' : (x?.message ?? 'Gagal masuk.')) }
 finally { setBusy(false) }
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
 <form onSubmit={submit} className="w-full max-w-sm">
 <div className="lg:hidden flex items-center gap-2.5 mb-8">
 <div className="w-10 h-10 rounded-md bg-primary-500 text-white grid place-items-center font-display font-extrabold">N</div>
 <span className="font-display font-bold text-lg">NUSAKARYA</span>
 </div>
 <h1 className="font-display text-[26px] font-bold text-ink-900">Masuk</h1>
 <p className="text-body text-ink-500 mt-1 mb-6">Gunakan akun yang diberikan administrator, atau akun dari tautan undangan.</p>
 <div className="space-y-4">
 <Field label="Email" required><Input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@perusahaan.id" required /></Field>
 <Field label="Kata Sandi" required><Input type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" required /></Field>
 </div>
 {err && <div className="mt-4 p-3 rounded-sm bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-body">{err}</div>}
 <Button type="submit" size="lg" loading={busy} className="w-full mt-6">Masuk</Button>
 <p className="mt-6 text-caption text-ink-400 text-center">Lupa kata sandi? Hubungi administrator perusahaan Anda.</p>
 <div className="mt-6 rounded-md border border-primary-200 bg-primary-50 p-3 text-center text-body text-primary-800">
 Perusahaan Anda belum terdaftar? <Link to="/daftar" className="font-semibold underline">Buat workspace — uji coba 30 hari</Link>
 </div>
 <p className="mt-3 text-[11px] text-ink-400 text-center">Lingkungan STAGING — belum production-ready.</p>
 </form>
 </div>
 </div>
 )
}
