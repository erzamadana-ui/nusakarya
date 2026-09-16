import React, { useEffect, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { list, update } from '@/lib/db'
import { useAuth, ROLE_LABEL } from '@/lib/auth'
import { tglJam } from '@/lib/format'
import { PageHeader, Card, CardHeader, DataTable, Badge, Modal, Field, Select, Checkbox, Button, useToast, type Column } from '@/components/ui'

type ProfileRow = {
  id: string; full_name: string; email: string | null; role: string; unit: string | null
  branch_id: string | null; is_active: boolean; last_login_at: string | null
}
type Branch = { id: string; name: string }

export default function Pengguna() {
  const { profile, can } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<ProfileRow[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<ProfileRow | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [p, b] = await Promise.all([
        list<ProfileRow>('profiles', { select: 'id, full_name, email, role, unit, branch_id, is_active, last_login_at', order: { col: 'full_name', asc: true } }),
        list<Branch>('branches', { select: 'id, name', order: { col: 'name', asc: true } }),
      ])
      setRows(p); setBranches(b)
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat pengguna', 'error') } finally { setLoading(false) }
  }
  useEffect(() => { if (profile) load() }, [profile])

  const branchName = useMemo(() => Object.fromEntries(branches.map(b => [b.id, b.name])), [branches])

  const save = async () => {
    if (!edit) return
    setSaving(true)
    try {
      await update('profiles', edit.id, { role: edit.role, unit: edit.unit || null, branch_id: edit.branch_id || null, is_active: edit.is_active })
      toast.push('Data pengguna disimpan')
      setEdit(null); load()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan', 'error') } finally { setSaving(false) }
  }

  const columns: Column[] = [
    { key: 'full_name', header: 'Nama' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Jabatan', render: r => ROLE_LABEL[r.role] ?? r.role },
    { key: 'unit', header: 'Unit', render: r => r.unit ?? '-' },
    { key: 'branch_id', header: 'Cabang', render: r => branchName[r.branch_id] ?? '-' },
    { key: 'is_active', header: 'Status', align: 'center', render: r => <Badge>{r.is_active ? 'Aktif' : 'Nonaktif'}</Badge> },
    { key: 'last_login_at', header: 'Login Terakhir', render: r => tglJam(r.last_login_at) },
  ]

  return (
    <div>
      <PageHeader title="Pengguna" subtitle="Kelola jabatan, unit, cabang & status akun pengguna panel admin" />

      <Card className="mb-4 border-primary-200 dark:border-primary-800 bg-primary-50/40 dark:bg-primary-950/30">
        <div className="p-4 flex gap-3">
          <Info size={18} className="text-primary-600 mt-0.5 shrink-0" />
          <div className="text-body text-ink-700 dark:text-ink-200">
            <p className="font-medium">Cara mengundang pengguna baru</p>
            <p className="mt-1 text-caption text-ink-500">
              Akun pengguna baru dibuat oleh administrator melalui Supabase Auth (bukan dari halaman ini). Saat membuat akun,
              lengkapi metadata berikut agar profil otomatis tertaut dengan benar: <b>company_id</b>, <b>role</b>, <b>full_name</b>, <b>unit</b>, dan <b>branch_id</b>.
              Setelah akun dibuat, jabatan/unit/cabang/status dapat diperbarui dari tabel di bawah ini. Kata sandi tidak pernah ditampilkan atau disimpan di panel ini.
            </p>
          </div>
        </div>
      </Card>

      <DataTable
        columns={columns} rows={rows} loading={loading}
        onRowClick={can('CORE', 'write') ? (r) => setEdit(r) : undefined}
        searchKeys={['full_name', 'email', 'role', 'unit']}
        exportName="pengguna" emptyTitle="Belum ada pengguna"
      />

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Ubah Data Pengguna" subtitle={edit?.full_name}
        footer={<>
          <Button variant="outline" onClick={() => setEdit(null)}>Batal</Button>
          <Button loading={saving} onClick={save}>Simpan</Button>
        </>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Jabatan">
              <Select value={edit.role} onChange={(e: any) => setEdit({ ...edit, role: e.target.value })}
                options={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))} />
            </Field>
            <Field label="Unit">
              <Select value={edit.unit ?? ''} onChange={(e: any) => setEdit({ ...edit, unit: e.target.value })}
                options={['HR', 'COMMERCE', 'PROCUREMENT', 'FINANCE', 'INVENTORY', 'OPERATIONS', 'DEPLOYMENT', 'EXECUTIVE']} />
            </Field>
            <Field label="Cabang">
              <Select value={edit.branch_id ?? ''} onChange={(e: any) => setEdit({ ...edit, branch_id: e.target.value })}
                options={branches.map(b => ({ value: b.id, label: b.name }))} />
            </Field>
            <Checkbox label="Akun aktif" checked={edit.is_active} onChange={(e: any) => setEdit({ ...edit, is_active: e.target.checked })} />
          </div>
        )}
      </Modal>
    </div>
  )
}
