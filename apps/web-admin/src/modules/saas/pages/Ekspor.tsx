import React, { useState } from 'react'
import { Download, FileJson, FileSpreadsheet, ShieldCheck } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { PageHeader, SectionCard, Button, Checkbox, Progress, useToast } from '@/components/ui'
import { MODUL_LABEL } from '../lib/konstanta'

/** Kelompok tabel yang diekspor. Semua dibaca lewat RLS -> hanya data tenant sendiri & modul yang boleh dibaca. */
const KELOMPOK: { modul: string; tabel: [string, string][] }[] = [
  { modul: 'CORE', tabel: [['branches', 'Cabang'], ['profiles', 'Pengguna'], ['master_references', 'Master Referensi'], ['custom_field_defs', 'Definisi Field Kustom'], ['custom_tables', 'Tabel Kustom'], ['custom_records', 'Isi Tabel Kustom'], ['audit_logs', 'Log Audit (5.000 terakhir)']] },
  { modul: 'HR', tabel: [['employees', 'Karyawan'], ['attendances', 'Absensi'], ['leave_requests', 'Cuti'], ['shifts', 'Shift']] },
  { modul: 'OPERATIONS', tabel: [['work_orders', 'Work Order'], ['tickets', 'Tiket'], ['network_elements', 'Aset Jaringan'], ['job_types', 'Jenis Pekerjaan'], ['root_causes', 'Akar Masalah']] },
  { modul: 'INVENTORY', tabel: [['warehouses', 'Gudang'], ['stock_balances', 'Saldo Stok'], ['stock_movements', 'Mutasi Stok']] },
  { modul: 'COMMERCE', tabel: [['customers', 'Pelanggan'], ['contracts', 'Kontrak'], ['contract_price_list', 'Price List'], ['spk', 'SPK'], ['bast', 'BAST'], ['ar_invoices', 'Invoice AR']] },
  { modul: 'PROCUREMENT', tabel: [['vendors', 'Vendor'], ['item_catalog', 'Katalog Item'], ['purchase_requests', 'PR'], ['purchase_orders', 'PO'], ['vendor_invoices', 'Invoice Vendor']] },
  { modul: 'FINANCE', tabel: [['ap_payments', 'Pembayaran AP'], ['cash_flows', 'Arus Kas'], ['chart_of_accounts', 'COA']] },
  { modul: 'PAYROLL', tabel: [['payroll_runs', 'Payroll'], ['salary_components', 'Komponen Gaji'], ['freelance_rate_cards', 'Rate Card Freelance']] },
  { modul: 'DEPLOYMENT', tabel: [['projects', 'Proyek']] },
  { modul: 'ASSET', tabel: [['assets', 'Aset']] },
]
const HALAMAN = 1000
const BATAS = 50000

async function tarik(tabel: string): Promise<any[]> {
  const semua: any[] = []
  const batas = tabel === 'audit_logs' ? 5000 : BATAS
  for (let dari = 0; dari < batas; dari += HALAMAN) {
    let q: any = supabase.from(tabel).select('*').range(dari, dari + HALAMAN - 1)
    if (tabel === 'audit_logs') q = q.order('created_at', { ascending: false })
    const { data, error } = await q
    if (error) throw new Error(`${tabel}: ${error.message}`)
    semua.push(...(data ?? []))
    if (!data || data.length < HALAMAN) break
  }
  return semua
}

export default function Ekspor() {
  const { can, company, fitur } = useAuth()
  const toast = useToast()
  const tersedia = KELOMPOK.filter(k => can(k.modul, 'read'))
  const [pilih, setPilih] = useState<Set<string>>(new Set(tersedia.flatMap(k => k.tabel.map(t => t[0]))))
  const [kemajuan, setKemajuan] = useState<{ i: number; n: number; tabel: string } | null>(null)

  const unduh = async (format: 'xlsx' | 'json') => {
    const daftar = tersedia.flatMap(k => k.tabel).filter(([t]) => pilih.has(t))
    if (!daftar.length) { toast.push('Pilih minimal satu tabel', 'error'); return }
    const hasil: Record<string, any[]> = {}
    const lewati: string[] = []
    for (let i = 0; i < daftar.length; i++) {
      const [t, label] = daftar[i]
      setKemajuan({ i, n: daftar.length, tabel: label })
      try { hasil[t] = await tarik(t) } catch { lewati.push(label) }
    }
    setKemajuan(null)
    const nama = `nusakarya-${(company?.code ?? 'data').toLowerCase()}-${new Date().toISOString().slice(0, 10)}`
    if (format === 'json') {
      const blob = new Blob([JSON.stringify({ perusahaan: company?.name, diekspor: new Date().toISOString(), tabel: hasil }, null, 1)], { type: 'application/json' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${nama}.json`; a.click()
    } else {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      for (const [t, rows] of Object.entries(hasil)) {
        const datar = rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === 'object' ? JSON.stringify(v) : v])))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(datar.length ? datar : [{ keterangan: 'kosong' }]), t.slice(0, 31))
      }
      XLSX.writeFile(wb, `${nama}.xlsx`)
    }
    const total = Object.values(hasil).reduce((a, r) => a + r.length, 0)
    await supabase.rpc('fn_catat_ekspor', { p_format: format, p_tabel: Object.keys(hasil), p_jumlah: total })
    toast.push(`Ekspor selesai: ${Object.keys(hasil).length} tabel, ${total.toLocaleString('id-ID')} baris${lewati.length ? `. Dilewati: ${lewati.join(', ')}` : ''}.`, lewati.length ? 'info' : 'success')
  }

  if (!fitur('ekspor_data')) return <SectionCard title="Ekspor data"><p>Fitur ekspor belum termasuk paket Anda.</p></SectionCard>
  return (
    <div className="space-y-5">
      <PageHeader title="Ekspor & Cadangan Data" breadcrumb={['Pengaturan', 'Ekspor Data']}
        subtitle="Data Anda milik Anda. Unduh salinan lengkap kapan saja — untuk arsip, audit, atau pindah sistem." />
      <SectionCard title="Pilih data" subtitle="Hanya modul yang boleh Anda baca yang tersedia. Setiap ekspor tercatat di Log Audit.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tersedia.map(k => (
            <div key={k.modul} className="rounded-md border border-ink-200 p-3">
              <div className="font-semibold text-ink-800 mb-2">{MODUL_LABEL[k.modul] ?? k.modul}</div>
              {k.tabel.map(([t, l]) => <Checkbox key={t} label={l} checked={pilih.has(t)} onChange={(e: any) => {
                const s = new Set(pilih); e.target.checked ? s.add(t) : s.delete(t); setPilih(s)
              }} />)}
            </div>))}
        </div>
        {kemajuan && <div className="mt-4"><div className="text-caption text-ink-500 mb-1">Menarik {kemajuan.tabel} ({kemajuan.i + 1}/{kemajuan.n})…</div><Progress value={(kemajuan.i / kemajuan.n) * 100} /></div>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button icon={<FileSpreadsheet size={15} />} loading={!!kemajuan} onClick={() => unduh('xlsx')}>Unduh Excel (.xlsx)</Button>
          <Button variant="outline" icon={<FileJson size={15} />} loading={!!kemajuan} onClick={() => unduh('json')}>Unduh JSON lengkap</Button>
        </div>
      </SectionCard>
      <SectionCard title="Cadangan di sisi server" subtitle="Status jujur per 24 Sep 2026">
        <ul className="space-y-1.5 text-body text-ink-600">
          <li className="flex gap-2"><ShieldCheck size={16} className="text-amber-600 mt-0.5 shrink-0" />Cadangan otomatis basis data mengikuti paket Supabase yang dipakai. <b>Uji pemulihan (restore drill) belum pernah dilakukan</b> — wajib sebelum produksi.</li>
          <li className="flex gap-2"><Download size={16} className="text-ink-400 mt-0.5 shrink-0" />Ekspor di halaman ini adalah cadangan logis milik pelanggan; berkas foto evidence tidak ikut (tetap di penyimpanan terenkripsi, bisa diminta terpisah).</li>
        </ul>
      </SectionCard>
    </div>
  )
}
