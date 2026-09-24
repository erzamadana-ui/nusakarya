import React, { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { SectionCard, DataTable, Badge, Button, ConfirmDialog, useToast, type Column } from '@/components/ui'
import { rollbackBatch, pesanGalatImpor } from '../lib/mesin-impor'

type Batch = {
  id: string; dataset: string; nama_berkas: string | null; total_baris: number; berhasil: number; gagal: number
  dilewati: number; status: string; created_at: string; rollback_at: string | null; rollback_hasil: any; mode: string
}
const NADA: Record<string, string> = { selesai: 'emerald', berjalan: 'amber', gagal: 'red', dibatalkan: 'slate' }

/** Riwayat impor tenant + tombol batalkan (rollback) per batch. */
export default function RiwayatImpor({ muatUlang = 0 }: { muatUlang?: number }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<Batch | null>(null)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('import_batches').select('*').order('created_at', { ascending: false }).limit(200)
    if (!error) setRows((data ?? []) as Batch[])
    setLoading(false)
  }
  useEffect(() => { if (profile) load() }, [profile, muatUlang])

  const cols: Column[] = [
    { key: 'created_at', header: 'Waktu', render: r => new Date(r.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) },
    { key: 'dataset', header: 'Data' },
    { key: 'nama_berkas', header: 'Berkas', render: r => r.nama_berkas || '-' },
    { key: 'berhasil', header: 'Masuk', align: 'right' },
    { key: 'gagal', header: 'Gagal', align: 'right' },
    { key: 'status', header: 'Status', render: r => <Badge tone={NADA[r.status]}>{r.status}</Badge> },
    { key: 'rollback', header: 'Pembatalan', render: r => r.rollback_at
        ? <span className="text-caption text-ink-500">{r.rollback_hasil?.dihapus ?? 0} dihapus · {r.rollback_hasil?.dipulihkan ?? 0} dipulihkan</span>
        : (r.status === 'selesai' || r.status === 'gagal') && r.berhasil > 0
          ? <Button size="sm" variant="outline" icon={<RotateCcw size={13} />} onClick={(e: any) => { e.stopPropagation(); setTarget(r) }}>Batalkan</Button>
          : '-' },
  ]

  return (
    <SectionCard title="Riwayat Impor" subtitle="Setiap impor tercatat. Impor yang keliru bisa dibatalkan utuh: baris baru dihapus, baris yang diperbarui dikembalikan ke nilai lama.">
      <DataTable columns={cols} rows={rows} loading={loading} exportName="riwayat-impor" dense
        emptyTitle="Belum ada impor" emptyMessage="Impor pertama Anda akan muncul di sini." />
      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} danger
        title="Batalkan impor?" confirmLabel="Ya, batalkan impor"
        message={`Impor "${target?.dataset}" (${target?.berhasil} baris) akan dibatalkan. Data yang sudah dipakai transaksi lain mungkin tertahan dan dilaporkan.`}
        onConfirm={async () => {
          if (!target) return
          try {
            const rb = await rollbackBatch(target.id)
            toast.push(`Dibatalkan: ${rb.dihapus} baris dihapus, ${rb.dipulihkan} dipulihkan${rb.gagal?.length ? `, ${rb.gagal.length} tertahan` : ''}.`, 'success')
            load()
          } catch (e) { toast.push(pesanGalatImpor(e), 'error') }
        }} />
    </SectionCard>
  )
}
