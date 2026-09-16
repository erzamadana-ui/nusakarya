import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui'
export default function Forbidden({ module }: { module?: string }) {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950 grid place-items-center text-amber-600"><ShieldAlert size={26} /></div>
      <h2 className="mt-4 font-display text-xl font-bold text-ink-900 dark:text-ink-50">Akses ditolak</h2>
      <p className="mt-1.5 text-body text-ink-500 max-w-md mx-auto">
        Jabatan Anda tidak memiliki hak untuk membuka halaman ini{module ? ` (modul ${module})` : ''}.
        Minta administrator menyesuaikan matriks hak akses jabatan bila ini keliru.
      </p>
      <Link to="/dashboard"><Button className="mt-5" variant="outline">Kembali ke Dashboard</Button></Link>
    </div>)
}
