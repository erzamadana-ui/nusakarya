import React, { useEffect, useState } from 'react'
import { sisaMenitSla, warnaSisaSla, formatSisaSla, KELAS_WARNA } from '../lib/helpers'

/** Hitung mundur SLA berwarna: hijau (aman) / kuning (mendekati jatuh tempo) / merah (lewat SLA). */
export default function SlaCountdown({ dueAt, slaMenit }: { dueAt?: string | null; slaMenit?: number | null }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])
  if (!dueAt) return <span className="text-ink-400">-</span>
  const sisa = sisaMenitSla(dueAt, now)
  const warna = warnaSisaSla(sisa, slaMenit)
  return <span className={`font-medium tabular ${KELAS_WARNA[warna]}`}>{formatSisaSla(sisa)}</span>
}
