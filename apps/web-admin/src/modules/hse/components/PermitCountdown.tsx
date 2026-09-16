import React, { useEffect, useState } from 'react'
import { sisaMenitIzin, warnaSisaIzin, formatSisaIzin, WARNA_KELAS } from '../lib/helpers'

/** Hitung mundur masa berlaku izin kerja berwarna: hijau (>24 jam) / kuning (≤24 jam) / merah (kedaluwarsa). */
export default function PermitCountdown({ validTo, closedAt }: { validTo?: string | null; closedAt?: string | null }) {
 const [now, setNow] = useState(() => new Date())
 useEffect(() => {
 if (closedAt) return
 const t = setInterval(() => setNow(new Date()), 60000)
 return () => clearInterval(t)
 }, [closedAt])

 if (!validTo) return <span className="text-ink-400">-</span>
 const acuan = closedAt ? new Date(closedAt) : now
 const sisa = sisaMenitIzin(validTo, acuan)
 const warna = warnaSisaIzin(sisa)
 return <span className={`font-medium tabular ${WARNA_KELAS[warna]}`}>{formatSisaIzin(sisa)}{closedAt ? ' (ditutup)' : ''}</span>
}
