import React, { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { list } from '@/lib/db'
import { PageHeader, Card, CardHeader, KpiCard, DataTable, Badge, TableSkeleton, EmptyState } from '@/components/ui'
import { tgl, todayISO } from '@/lib/format'
import { Users, UserCheck, FileWarning, Award, Clock } from 'lucide-react'
import { expiryTone } from '../lib/constants'

export default function DashboardHR() {
  const [loading, setLoading] = useState(true)
  const [dash, setDash] = useState<any[]>([])
  const [contractsExp, setContractsExp] = useState<any[]>([])
  const [certsExp, setCertsExp] = useState<any[]>([])
  const [cutiHariIni, setCutiHariIni] = useState(0)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const today = todayISO()
      const in60 = new Date(); in60.setDate(in60.getDate() + 60)
      const in90 = new Date(); in90.setDate(in90.getDate() + 90)

      const [dv, employees, certs, cuti] = await Promise.all([
        list('v_dashboard_hr', {}).catch(() => []),
        list<any>('employees', { select: 'id,full_name,position,employment_type,contract_end,status', eq: { status: 'aktif' }, order: { col: 'contract_end', asc: true } }),
        list<any>('employee_certifications', { select: 'id,employee_id,cert_name,cert_type,expiry_date,status,employees(full_name)', order: { col: 'expiry_date', asc: true } }),
        list<any>('leave_requests', { select: 'id', eq: { status: 'disetujui' }, lte: { start_date: today }, gte: { end_date: today } }),
      ])
      setDash(dv as any[])
      setContractsExp((employees ?? []).filter((e: any) => e.employment_type === 'PKWT' && e.contract_end && e.contract_end <= in60.toISOString().slice(0, 10)))
      setCertsExp((certs ?? []).filter((c: any) => c.expiry_date && c.expiry_date <= in90.toISOString().slice(0, 10)))
      setCutiHariIni((cuti ?? []).length)
    } finally { setLoading(false) }
  }

  const totalAktif = useMemo(() => dash.reduce((s, r) => s + Number(r.headcount_aktif || 0), 0), [dash])
  const hadir = useMemo(() => dash.reduce((s, r) => s + Number(r.hadir_hari_ini || 0), 0), [dash])
  const terlambat = useMemo(() => dash.reduce((s, r) => s + Number(r.terlambat_hari_ini || 0), 0), [dash])
  const alpa = useMemo(() => dash.reduce((s, r) => s + Number(r.alpa_hari_ini || 0), 0), [dash])
  const kontrakHabis = useMemo(() => dash.reduce((s, r) => s + Number(r.contracts_expiring_60d || 0), 0), [dash])
  const sertifKedaluwarsa = useMemo(() => dash.reduce((s, r) => s + Number(r.certifications_expired || 0), 0), [dash])

  const perUnit = useMemo(() => {
    const m = new Map<string, number>()
    dash.forEach(r => m.set(r.unit || 'Lainnya', (m.get(r.unit || 'Lainnya') || 0) + Number(r.headcount_aktif || 0)))
    return Array.from(m, ([unit, jumlah]) => ({ unit, jumlah }))
  }, [dash])
  const perCabang = useMemo(() => {
    const m = new Map<string, number>()
    dash.forEach(r => m.set(r.branch_name || 'Tanpa Cabang', (m.get(r.branch_name || 'Tanpa Cabang') || 0) + Number(r.headcount_aktif || 0)))
    return Array.from(m, ([cabang, jumlah]) => ({ cabang, jumlah }))
  }, [dash])

  return (
    <div>
      <PageHeader title="Dashboard HR" subtitle="Ringkasan sumber daya manusia perusahaan" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Karyawan Aktif" value={totalAktif} icon={<Users size={16} />} tone="teal" />
        <KpiCard label="Hadir Hari Ini" value={hadir} icon={<UserCheck size={16} />} tone="emerald" />
        <KpiCard label="Terlambat" value={terlambat} icon={<Clock size={16} />} tone="orange" />
        <KpiCard label="Alpa" value={alpa} icon={<FileWarning size={16} />} tone="red" />
        <KpiCard label="Cuti Hari Ini" value={cutiHariIni} icon={<Award size={16} />} tone="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader title="Karyawan Aktif per Unit" />
          <div className="p-4 h-64">
            {loading ? <TableSkeleton rows={4} /> : perUnit.length === 0 ? <EmptyState title="Belum ada data" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perUnit}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EB" vertical={false} />
                  <XAxis dataKey="unit" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="jumlah" fill="#1B8A92" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>)}
          </div>
        </Card>
        <Card>
          <CardHeader title="Karyawan Aktif per Cabang" />
          <div className="p-4 h-64">
            {loading ? <TableSkeleton rows={4} /> : perCabang.length === 0 ? <EmptyState title="Belum ada data" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perCabang}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E6EB" vertical={false} />
                  <XAxis dataKey="cabang" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="jumlah" fill="#F5A524" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>)}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="overflow-hidden">
          <CardHeader title="Kontrak PKWT Akan Habis (<60 hari)" subtitle={`${kontrakHabis} kontrak terdeteksi`} />
          <DataTable
            loading={loading}
            columns={[
              { key: 'full_name', header: 'Nama' },
              { key: 'position', header: 'Jabatan' },
              { key: 'contract_end', header: 'Habis Kontrak', render: r => tgl(r.contract_end) },
              { key: 'sisa', header: 'Sisa', align: 'right', render: r => { const t = expiryTone(r.contract_end); return <Badge tone={t.tone}>{t.label}</Badge> } },
            ]}
            rows={contractsExp}
            searchable={false}
            pageSize={8}
            emptyTitle="Tidak ada kontrak yang akan habis"
          />
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Sertifikasi Kedaluwarsa / Akan Habis" subtitle={`${sertifKedaluwarsa} sertifikat kedaluwarsa`} />
          <DataTable
            loading={loading}
            columns={[
              { key: 'nama', header: 'Nama', render: r => r.employees?.full_name ?? '-' },
              { key: 'cert_name', header: 'Sertifikat' },
              { key: 'expiry_date', header: 'Berakhir', render: r => tgl(r.expiry_date) },
              { key: 'sisa', header: 'Status', align: 'right', render: r => { const t = expiryTone(r.expiry_date); return <Badge tone={t.tone}>{t.label}</Badge> } },
            ]}
            rows={certsExp}
            searchable={false}
            pageSize={8}
            emptyTitle="Tidak ada sertifikasi yang akan habis"
          />
        </Card>
      </div>
      <p className="text-caption text-ink-400 mt-4">Sumber data: v_dashboard_hr, employees, employee_certifications, leave_requests — ditarik {tgl(todayISO())}.</p>
    </div>
  )
}
