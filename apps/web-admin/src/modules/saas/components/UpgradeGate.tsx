import React from 'react'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Card, Button } from '@/components/ui'

/** Ditampilkan bila modul/fitur tidak termasuk paket langganan tenant. */
export default function UpgradeGate({ fitur, modul }: { fitur?: string; modul?: string }) {
  const { langganan } = useAuth()
  return (
    <Card className="p-10 text-center max-w-xl mx-auto mt-10">
      <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 text-amber-600 grid place-items-center"><Lock size={22} /></div>
      <h2 className="mt-4 font-display text-xl font-bold text-ink-900">{fitur ?? modul ?? 'Fitur ini'} belum termasuk paket Anda</h2>
      <p className="mt-2 text-body text-ink-500">
        Paket saat ini: <b>{langganan?.plan_name ?? '-'}</b>. Data Anda aman — fitur ini hanya belum diaktifkan.
        Naikkan paket untuk membukanya; perubahan berlaku seketika tanpa migrasi data.
      </p>
      <Link to="/pengaturan/langganan"><Button className="mt-5">Lihat perbandingan paket</Button></Link>
    </Card>
  )
}
