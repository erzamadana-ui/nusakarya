import React, { useEffect, useState } from 'react'
import { sisaMenitSla, warnaSisaSla, formatSisaSla, WARNA_KELAS } from '../lib/helpers'

/** Hitung mundur SLA berwarna: hijau (aman) / kuning (mendekati jatuh tempo) / merah (lewat SLA).
 * Berhenti berdetak bila tiket sudah selesai/ditutup (selesaiAt terisi). */
export default function SlaCountdown({ dueAt, slaMenit, selesaiAt }: { dueAt?: string | null; slaMenit?: number | null; selesaiAt?: string | null }) {
 const [now, setNow] = useState(() => new Date())
 useEffect(() => {
 if (selesaiAt) return
 const t = setInterval(() => setNow(new Date()), 30000)
 return () => clearInterval(t)
 }, [selesaiAt])

 if (!dueAt) return <span className="text-ink-400">-</span>
 const acuan = selesaiAt ? new Date(selesaiAt) : now
 const sisa = sisaMenitSla(dueAt, acuan)
 const warna = warnaSisaSla(sisa, slaMenit)
 return (
 <span className={`font-medium tabular ${WARNA_KELAS[warna]}`}>
 {formatSisaSla(sisa)}{selesaiAt ? ' (final)' : ''}
 </span>
 )
}
