import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Rocket, CheckCircle2, Circle, X } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Card } from '@/components/ui'

/** Kartu panduan untuk workspace baru — hilang setelah workspace diaktifkan dan berisi data. */
export default function MulaiDiSini() {
  const { profile, onboarding, company } = useAuth()
  const [cek, setCek] = useState<any[] | null>(null)
  const [tutup, setTutup] = useState(() => { try { return sessionStorage.getItem('nk-mulai') === '1' } catch { return false } })
  useEffect(() => { supabase.rpc('fn_validasi_data_awal').then(({ data }) => setCek(data ?? [])) }, [company?.id])
  if (tutup || !cek || (onboarding?.activated_at && cek.every(c => c.status !== 'kosong'))) return null
  const ok = cek.filter(c => c.status === 'ok').length
  return (
    <Card className="p-4 mb-5 border-primary-200 bg-primary-50/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-full bg-primary-500 text-white grid place-items-center shrink-0"><Rocket size={17} /></span>
          <div>
            <div className="font-semibold text-ink-900">Mulai di sini — {ok}/{cek.length} data dasar siap</div>
            <p className="text-caption text-ink-500">Dashboard terisi otomatis begitu data masuk. Isi yang masih kosong lewat Pusat Impor (Excel/CSV) — tanpa developer.</p>
          </div>
        </div>
        <button className="text-ink-400 hover:text-ink-700" onClick={() => { setTutup(true); try { sessionStorage.setItem('nk-mulai', '1') } catch {} }}><X size={16} /></button>
      </div>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
        {cek.slice(0, 10).map(c => (
          <Link key={c.kunci} to={c.tautan} className="flex items-center gap-1.5 text-caption text-ink-700 hover:text-primary-700">
            {c.status === 'ok' ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Circle size={13} className={c.status === 'kosong' ? 'text-red-400' : 'text-amber-500'} />}
            {c.label}
          </Link>))}
      </div>
      {profile?.role === 'super_admin' && !onboarding?.activated_at && <Link to="/onboarding" className="mt-3 inline-block text-caption font-semibold text-primary-700">Buka panduan onboarding 7 langkah →</Link>}
    </Card>
  )
}
