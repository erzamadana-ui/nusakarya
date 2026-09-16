import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { list, insert, update } from '@/lib/db'
import {
  PageHeader, Card, CardHeader, Section, DataTable, Badge, Button, Modal, Field, Input, Money, useToast,
  EmptyState, TableSkeleton, Skeleton, cx,
} from '@/components/ui'
import { rupiah, pct, tgl, tglJam, todayISO } from '@/lib/format'
import { toPct, toDec, JKK_RISK_CLASS_LABEL } from '../lib/constants'
import { ShieldAlert, ShieldCheck, CheckCircle2, Pencil } from 'lucide-react'

const emptyForm = {
  jht_company_pct: 3.7, jht_employee_pct: 2,
  jkk_pct: 0, jkk_risk_class: null as string | null, jkk_source_note: '',
  jkm_pct: 0.3,
  jp_company_pct: 2, jp_employee_pct: 1, jp_cap: 0,
  kes_company_pct: 4, kes_employee_pct: 1, kes_cap: 0,
  effective_date: todayISO(),
}

function pickEffective(rows: any[], dateStr: string) {
  const eligible = rows.filter(r => r.effective_date <= dateStr)
  if (!eligible.length) return null
  return eligible.reduce((a, b) => (b.effective_date > a.effective_date ? b : a))
}

export default function SetelanBpjs() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<any[]>([])
  const [riskRates, setRiskRates] = useState<any[]>([])
  const [current, setCurrent] = useState<any>(null)
  const [profileMap, setProfileMap] = useState<Record<string, string>>({})
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [simUpah, setSimUpah] = useState<number>(6000000)

  const [rateEdit, setRateEdit] = useState<any>(null)
  const [rateForm, setRateForm] = useState<any>(null)
  const [rateSaving, setRateSaving] = useState(false)

  useEffect(() => { load() }, [profile?.company_id])

  async function load() {
    setLoading(true)
    try {
      const [rows, rates] = await Promise.all([
        list<any>('bpjs_config', { eq: { company_id: profile?.company_id }, order: { col: 'effective_date', asc: false } }),
        list<any>('jkk_risk_rates', { order: { col: 'effective_from', asc: false } }),
      ])
      setHistory(rows)
      setRiskRates(rates)
      const cur = pickEffective(rows, todayISO()) ?? rows[0] ?? null
      setCurrent(cur)
      if (cur) {
        setForm({
          jht_company_pct: toPct(cur.jht_company), jht_employee_pct: toPct(cur.jht_employee),
          jkk_pct: toPct(cur.jkk), jkk_risk_class: cur.jkk_risk_class ?? null, jkk_source_note: cur.jkk_source_note ?? '',
          jkm_pct: toPct(cur.jkm),
          jp_company_pct: toPct(cur.jp_company), jp_employee_pct: toPct(cur.jp_employee), jp_cap: Number(cur.jp_cap) || 0,
          kes_company_pct: toPct(cur.kes_company), kes_employee_pct: toPct(cur.kes_employee), kes_cap: Number(cur.kes_cap) || 0,
          effective_date: todayISO(),
        })
      }
      const ids = Array.from(new Set(rows.flatMap((r: any) => [r.created_by, r.verified_by]).filter(Boolean)))
      if (ids.length) {
        const profs = await list<any>('profiles', { select: 'id,full_name', in: { id: ids } })
        const map: Record<string, string> = {}
        profs.forEach((p: any) => { map[p.id] = p.full_name })
        setProfileMap(map)
      } else setProfileMap({})
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat setelan BPJS', 'error') }
    finally { setLoading(false) }
  }

  const riskCards = useMemo(() => {
    const byClass: Record<string, any> = {}
    riskRates.forEach(r => { if (!byClass[r.class_code] || r.effective_from > byClass[r.class_code].effective_from) byClass[r.class_code] = r })
    return ['I', 'II', 'III', 'IV', 'V'].map(c => byClass[c]).filter(Boolean)
  }, [riskRates])

  function pickRiskClass(r: any) {
    if (!can('PAYROLL', 'write')) return
    setForm((f: any) => ({
      ...f, jkk_risk_class: r.class_code, jkk_pct: toPct(r.rate),
      jkk_source_note: `Dipilih manual oleh ${profile?.full_name ?? 'pengguna'} pada ${tgl(todayISO())} dari referensi Kelompok ${r.class_code} (${r.class_name}), tarif pasca-rekomposisi PP 49/2023: ${pct(toPct(r.rate), 2)}. Belum diverifikasi — cocokkan dengan sertifikat kepesertaan BPJS Ketenagakerjaan perusahaan sebelum ditandai terverifikasi.`,
    }))
  }

  function openRateEdit(r: any) {
    if (!can('PAYROLL', 'approve')) return
    setRateEdit(r)
    setRateForm({ class_name: r.class_name, description: r.description ?? '', rate_pct: toPct(r.rate), effective_from: todayISO(), source_note: '' })
  }
  async function saveRate() {
    if (!can('PAYROLL', 'approve') || !rateEdit) return
    if (!rateForm.class_name || !rateForm.effective_from || rateForm.rate_pct === '' || rateForm.rate_pct == null) {
      toast.push('Nama kelompok, tarif, dan tanggal berlaku wajib diisi', 'error'); return
    }
    setRateSaving(true)
    try {
      await insert('jkk_risk_rates', {
        company_id: null,
        class_code: rateEdit.class_code,
        class_name: rateForm.class_name,
        description: rateForm.description || null,
        rate: toDec(rateForm.rate_pct),
        effective_from: rateForm.effective_from,
        source_note: rateForm.source_note || null,
      })
      toast.push(`Tarif Kelompok ${rateEdit.class_code} diperbarui, berlaku mulai ${tgl(rateForm.effective_from)}`)
      setRateEdit(null); load()
    } catch (e: any) {
      const msg = /row-level security|permission denied/i.test(e.message ?? '') ? 'Gagal menyimpan — hak akses Anda pada modul PAYROLL tidak mengizinkan tindakan approve (ubah tarif kelompok risiko JKK).' : (e.message ?? 'Gagal menyimpan tarif kelompok risiko')
      toast.push(msg, 'error')
    } finally { setRateSaving(false) }
  }

  async function save() {
    if (!can('PAYROLL', 'write')) return
    if (!form.effective_date) { toast.push('Tanggal mulai berlaku wajib diisi', 'error'); return }
    if (!form.jkk_risk_class) { toast.push('Pilih kelompok risiko JKK terlebih dahulu', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        company_id: profile?.company_id,
        jht_company: toDec(form.jht_company_pct), jht_employee: toDec(form.jht_employee_pct),
        jkk: toDec(form.jkk_pct), jkk_risk_class: form.jkk_risk_class, jkk_source_note: form.jkk_source_note || null,
        jkm: toDec(form.jkm_pct),
        jp_company: toDec(form.jp_company_pct), jp_employee: toDec(form.jp_employee_pct), jp_cap: form.jp_cap || 0,
        kes_company: toDec(form.kes_company_pct), kes_employee: toDec(form.kes_employee_pct), kes_cap: form.kes_cap || 0,
        effective_date: form.effective_date,
        is_verified: false,
        created_by: profile?.id,
      }
      await insert('bpjs_config', payload)
      toast.push(`Konfigurasi BPJS baru disimpan, berlaku mulai ${tgl(form.effective_date)}. Status: belum diverifikasi.`)
      load()
    } catch (e: any) {
      const msg = /row-level security|permission denied/i.test(e.message ?? '') ? 'Gagal menyimpan — hak akses Anda pada modul PAYROLL tidak mengizinkan penulisan (perlu izin write).' : (e.message ?? 'Gagal menyimpan setelan BPJS')
      toast.push(msg, 'error')
    } finally { setSaving(false) }
  }

  async function verify() {
    if (!can('PAYROLL', 'approve') || !current) return
    setVerifying(true)
    try {
      await update('bpjs_config', current.id, { is_verified: true, verified_by: profile?.id, verified_at: new Date().toISOString() })
      toast.push('Konfigurasi ditandai terverifikasi')
      load()
    } catch (e: any) {
      const msg = /row-level security|permission denied/i.test(e.message ?? '') ? 'Gagal menandai terverifikasi — hak akses Anda pada modul PAYROLL tidak mengizinkan tindakan approve.' : (e.message ?? 'Gagal menandai terverifikasi')
      toast.push(msg, 'error')
    } finally { setVerifying(false) }
  }

  const simulasi = useMemo(() => {
    const upah = Number(simUpah) || 0
    const jpBase = Math.min(upah, Number(form.jp_cap) || Infinity)
    const kesBase = Math.min(upah, Number(form.kes_cap) || Infinity)
    const items = [
      { label: 'JHT (Jaminan Hari Tua)', co: upah * toDec(form.jht_company_pct), emp: upah * toDec(form.jht_employee_pct) },
      { label: `JKK (Jaminan Kecelakaan Kerja)${form.jkk_risk_class ? ` — Kel. ${form.jkk_risk_class}` : ''}`, co: upah * toDec(form.jkk_pct), emp: 0 },
      { label: 'JKM (Jaminan Kematian)', co: upah * toDec(form.jkm_pct), emp: 0 },
      { label: `JP (Jaminan Pensiun)${form.jp_cap ? ` — dasar dibatasi ${rupiah(form.jp_cap, true)}` : ''}`, co: jpBase * toDec(form.jp_company_pct), emp: jpBase * toDec(form.jp_employee_pct) },
      { label: `BPJS Kesehatan${form.kes_cap ? ` — dasar dibatasi ${rupiah(form.kes_cap, true)}` : ''}`, co: kesBase * toDec(form.kes_company_pct), emp: kesBase * toDec(form.kes_employee_pct) },
    ]
    const totalCo = items.reduce((s, i) => s + i.co, 0)
    const totalEmp = items.reduce((s, i) => s + i.emp, 0)
    return { items, totalCo, totalEmp, totalAll: totalCo + totalEmp, upah }
  }, [simUpah, form])

  const numProps = { type: 'number', step: '0.01', className: 'text-right tabular' }

  return (
    <div>
      <PageHeader title="Setelan BPJS & Pajak" subtitle="Kelola tarif iuran BPJS Ketenagakerjaan & BPJS Kesehatan — termasuk kelompok risiko JKK — tanpa menyentuh basis data" />

      {loading ? <Skeleton className="h-24 w-full mb-5" /> : current && (
        current.is_verified ? (
          <div className="flex items-start gap-2.5 p-3.5 rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-900 mb-5">
            <ShieldCheck size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-caption text-ink-700">
              <p className="font-semibold text-emerald-700">Tarif iuran sudah diverifikasi</p>
              <p className="mt-0.5">
                Ditandai oleh {profileMap[current.verified_by] ?? '—'} pada {tglJam(current.verified_at)}. Berlaku sejak {tgl(current.effective_date)}.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 p-3.5 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 mb-5">
            <ShieldAlert size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 text-caption text-ink-700">
              <p className="font-semibold text-amber-700">Tarif iuran belum diverifikasi — perhitungan payroll memakai angka dugaan sistem</p>
              <p className="mt-0.5">{current.jkk_source_note || 'Kelompok risiko JKK & tarif lain pada baris berlaku saat ini belum dicocokkan dengan sertifikat kepesertaan BPJS Ketenagakerjaan perusahaan.'}</p>
            </div>
            {can('PAYROLL', 'approve') && (
              <Button size="sm" variant="success" icon={<CheckCircle2 size={14} />} loading={verifying} onClick={verify} className="shrink-0">
                Tandai Terverifikasi
              </Button>
            )}
          </div>
        )
      )}

      <Section title="Kelompok Risiko JKK (PP 44/2015 & PP 49/2023)">
        {loading ? <TableSkeleton rows={2} /> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {riskCards.map(r => {
              const selected = form.jkk_risk_class === r.class_code
              return (
                <Card key={r.class_code}
                  onClick={() => pickRiskClass(r)}
                  className={cx('p-3.5', can('PAYROLL', 'write') && 'cursor-pointer hover:shadow-e2 transition-shadow',
                    selected && 'border-primary-400 ring-2 ring-primary-200 bg-primary-50')}>
                  <div className="flex items-center justify-between">
                    <Badge tone={selected ? 'teal' : 'slate'}>Kelompok {r.class_code}</Badge>
                    <div className="flex items-center gap-1.5">
                      {can('PAYROLL', 'approve') && (
                        <button
                          onClick={(e: any) => { e.stopPropagation(); openRateEdit(r) }}
                          title="Ubah tarif kelompok ini (mis. peraturan baru)"
                          className="p-1 rounded-xs text-ink-400 hover:text-primary-600 hover:bg-primary-50">
                          <Pencil size={13} />
                        </button>
                      )}
                      {selected && <CheckCircle2 size={16} className="text-primary-600" />}
                    </div>
                  </div>
                  <p className="mt-2 font-display font-semibold text-[15px] text-ink-900">{r.class_name}</p>
                  <p className="mt-0.5 font-display font-bold text-[20px] tabular text-primary-700">{pct(toPct(r.rate), 2)}</p>
                  <p className="mt-1.5 text-caption text-ink-500 line-clamp-3">{r.description}</p>
                </Card>
              )
            })}
          </div>
        )}
        <p className="text-caption text-ink-400 mt-3">
          Kelompok risiko resmi tiap perusahaan ditetapkan oleh BPJS Ketenagakerjaan dan tercantum pada sertifikat kepesertaan
          (bagian data kepesertaan/kartu perusahaan) — bukan dipilih sendiri oleh perusahaan. Gunakan kartu ini hanya sebagai
          referensi tarif per kelompok; cocokkan pilihan dengan dokumen sertifikat sebelum menandai terverifikasi.
        </p>
      </Section>

      <Section title="Iuran Lain & Tanggal Berlaku">
        {loading ? <TableSkeleton rows={3} /> : (
          <Card className="p-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="JHT — Bagian Perusahaan (%)"><Input {...numProps} value={form.jht_company_pct} onChange={(e: any) => setForm({ ...form, jht_company_pct: e.target.value })} disabled={!can('PAYROLL', 'write')} /></Field>
              <Field label="JHT — Bagian Pekerja (%)"><Input {...numProps} value={form.jht_employee_pct} onChange={(e: any) => setForm({ ...form, jht_employee_pct: e.target.value })} disabled={!can('PAYROLL', 'write')} /></Field>
              <Field label="JKK (%) — dari kartu kelompok risiko di atas"><Input {...numProps} value={form.jkk_pct} onChange={(e: any) => setForm({ ...form, jkk_pct: e.target.value })} disabled={!can('PAYROLL', 'write')} /></Field>
              <Field label="JKM (%)"><Input {...numProps} value={form.jkm_pct} onChange={(e: any) => setForm({ ...form, jkm_pct: e.target.value })} disabled={!can('PAYROLL', 'write')} /></Field>
              <Field label="JP — Bagian Perusahaan (%)"><Input {...numProps} value={form.jp_company_pct} onChange={(e: any) => setForm({ ...form, jp_company_pct: e.target.value })} disabled={!can('PAYROLL', 'write')} /></Field>
              <Field label="JP — Bagian Pekerja (%)"><Input {...numProps} value={form.jp_employee_pct} onChange={(e: any) => setForm({ ...form, jp_employee_pct: e.target.value })} disabled={!can('PAYROLL', 'write')} /></Field>
              <Field label="Batas Upah JP (Rp/bulan)"><Money value={form.jp_cap} onChange={(v: number) => setForm({ ...form, jp_cap: v })} disabled={!can('PAYROLL', 'write')} /></Field>
              <Field label="BPJS Kesehatan — Bagian Perusahaan (%)"><Input {...numProps} value={form.kes_company_pct} onChange={(e: any) => setForm({ ...form, kes_company_pct: e.target.value })} disabled={!can('PAYROLL', 'write')} /></Field>
              <Field label="BPJS Kesehatan — Bagian Pekerja (%)"><Input {...numProps} value={form.kes_employee_pct} onChange={(e: any) => setForm({ ...form, kes_employee_pct: e.target.value })} disabled={!can('PAYROLL', 'write')} /></Field>
              <Field label="Batas Upah BPJS Kesehatan (Rp/bulan)"><Money value={form.kes_cap} onChange={(v: number) => setForm({ ...form, kes_cap: v })} disabled={!can('PAYROLL', 'write')} /></Field>
              <Field label="Berlaku Mulai" hint="Menyimpan akan menambah versi baru — versi lama tetap tersimpan di Riwayat Berlaku.">
                <Input type="date" value={form.effective_date} onChange={(e: any) => setForm({ ...form, effective_date: e.target.value })} disabled={!can('PAYROLL', 'write')} />
              </Field>
            </div>
            {can('PAYROLL', 'write') && (
              <div className="mt-4 flex justify-end">
                <Button loading={saving} onClick={save}>Simpan Konfigurasi (Versi Baru)</Button>
              </div>
            )}
          </Card>
        )}
      </Section>

      <Section title="Simulasi Langsung">
        <Card className="p-4">
          <div className="max-w-xs mb-4">
            <Field label="Upah Bulanan Contoh"><Money value={simUpah} onChange={(v: number) => setSimUpah(v)} /></Field>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-body">
              <thead><tr className="text-caption uppercase text-ink-500">
                <th className="text-left font-semibold pb-2">Komponen Iuran</th>
                <th className="text-right font-semibold pb-2">Bagian Perusahaan</th>
                <th className="text-right font-semibold pb-2">Bagian Pekerja</th>
              </tr></thead>
              <tbody>
                {simulasi.items.map((i, idx) => (
                  <tr key={idx} className="border-t border-ink-100">
                    <td className="py-2 text-ink-700">{i.label}</td>
                    <td className="py-2 text-right tabular">{rupiah(i.co)}</td>
                    <td className="py-2 text-right tabular">{i.emp > 0 ? rupiah(i.emp) : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink-200 font-semibold">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right tabular">{rupiah(simulasi.totalCo)}</td>
                  <td className="py-2 text-right tabular">{rupiah(simulasi.totalEmp)}</td>
                </tr>
                <tr className="font-display font-bold text-[15px]">
                  <td className="py-2">Total Iuran BPJS (Perusahaan + Pekerja)</td>
                  <td colSpan={2} className="py-2 text-right tabular">{rupiah(simulasi.totalAll)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-caption text-ink-400 mt-3">
            Simulasi memakai nilai yang sedang diisi pada form di atas (belum tentu tersimpan) dan penerapan batas upah JP/Kesehatan.
            Cocokkan hasilnya dengan slip gaji nyata sebelum menyimpan sebagai konfigurasi resmi.
          </p>
        </Card>
      </Section>

      <Section title="Riwayat Berlaku">
        <DataTable
          loading={loading} rows={history} emptyTitle="Belum ada riwayat konfigurasi BPJS"
          columns={[
            { key: 'effective_date', header: 'Berlaku Sejak', render: (r: any) => tgl(r.effective_date) },
            { key: 'jkk_risk_class', header: 'Kel. JKK', render: (r: any) => r.jkk_risk_class ? <Badge tone="teal">{r.jkk_risk_class}</Badge> : <Badge tone="slate">-</Badge> },
            { key: 'jkk', header: 'JKK', align: 'right', render: (r: any) => pct(toPct(r.jkk), 2) },
            { key: 'jht_company', header: 'JHT Perusahaan', align: 'right', render: (r: any) => pct(toPct(r.jht_company), 2) },
            { key: 'jp_company', header: 'JP Perusahaan', align: 'right', render: (r: any) => pct(toPct(r.jp_company), 2) },
            { key: 'kes_company', header: 'Kes. Perusahaan', align: 'right', render: (r: any) => pct(toPct(r.kes_company), 2) },
            { key: 'is_verified', header: 'Status', render: (r: any) => r.is_verified ? <Badge tone="emerald">Terverifikasi</Badge> : <Badge tone="amber">Dugaan Sistem</Badge> },
            { key: 'created_by', header: 'Dibuat Oleh', render: (r: any) => profileMap[r.created_by] ?? '—' },
            { key: 'created_at', header: 'Dibuat Pada', render: (r: any) => tglJam(r.created_at) },
          ]}
        />
      </Section>

      <p className="text-caption text-ink-400 mt-2">
        Sumber tarif JKK: PP 44/2015 Pasal 16 ayat (1) (tarif dasar 0,24% / 0,54% / 0,89% / 1,27% / 1,74%) dan PP 49/2023 Pasal 16A
        (rekomposisi menjadi 0,10% / 0,40% / 0,75% / 1,13% / 1,60% sejak 6 Oktober 2023, khusus peserta program Jaminan Kehilangan
        Pekerjaan). Tarif JHT, JKM, JP, dan BPJS Kesehatan pada form ini mengikuti nilai yang sudah tersimpan di basis data sebelum
        halaman ini dibuat dan BELUM diverifikasi ulang terhadap peraturan/sertifikat terbaru. Nilai resmi yang mengikat perusahaan
        selalu tercantum pada sertifikat kepesertaan BPJS Ketenagakerjaan &amp; BPJS Kesehatan serta peraturan pemerintah yang berlaku
        saat periode payroll berjalan — halaman ini adalah alat bantu administrasi, bukan pengganti dokumen resmi tersebut.
      </p>

      <Modal open={!!rateEdit} onClose={() => setRateEdit(null)} title={`Ubah Tarif Kelompok Risiko ${rateEdit?.class_code ?? ''}`} size="sm"
        footer={<><Button variant="outline" onClick={() => setRateEdit(null)}>Batal</Button><Button loading={rateSaving} onClick={saveRate}>Simpan Tarif Baru</Button></>}>
        {rateEdit && rateForm && (
          <div className="space-y-3">
            <p className="text-caption text-ink-500">Tarif saat ini: <span className="font-medium text-ink-800">{pct(toPct(rateEdit.rate), 2)}</span>, berlaku sejak {tgl(rateEdit.effective_from)}. Menyimpan akan menambah versi baru — riwayat lama tetap tersimpan.</p>
            <Field label="Nama Kelompok" required><Input value={rateForm.class_name} onChange={(e: any) => setRateForm({ ...rateForm, class_name: e.target.value })} /></Field>
            <Field label="Deskripsi"><Input value={rateForm.description} onChange={(e: any) => setRateForm({ ...rateForm, description: e.target.value })} /></Field>
            <Field label="Tarif Baru (%)" required><Input type="number" step="0.01" value={rateForm.rate_pct} onChange={(e: any) => setRateForm({ ...rateForm, rate_pct: e.target.value })} className="text-right tabular" /></Field>
            <Field label="Berlaku Mulai" required><Input type="date" value={rateForm.effective_from} onChange={(e: any) => setRateForm({ ...rateForm, effective_from: e.target.value })} /></Field>
            <Field label="Sumber/Alasan Perubahan" hint="Mis. rujukan peraturan baru."><Input value={rateForm.source_note} onChange={(e: any) => setRateForm({ ...rateForm, source_note: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
