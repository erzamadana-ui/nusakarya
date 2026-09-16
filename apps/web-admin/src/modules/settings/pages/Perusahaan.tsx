import React, { useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import { getOne, update, uploadFile, signedUrl } from '@/lib/db'
import { useAuth } from '@/lib/auth'
import { PageHeader, Card, CardHeader, Field, Input, Button, Badge, useToast, Skeleton } from '@/components/ui'

type Company = {
  id: string; name: string; npwp: string | null; address: string | null; phone: string | null
  email: string | null; logo_url: string | null; is_demo: boolean | null
}

export default function Perusahaan() {
  const { profile, can, refresh } = useAuth()
  const toast = useToast()
  const [data, setData] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)

  const load = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const c = await getOne<Company>('companies', profile.company_id)
      setData(c)
      setLogoPreview(await signedUrl(c?.logo_url))
    } catch (e: any) { toast.push(e.message ?? 'Gagal memuat data perusahaan', 'error') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [profile])

  const save = async () => {
    if (!data || !profile) return
    setSaving(true)
    try {
      let logo_url = data.logo_url
      if (logoFile) logo_url = await uploadFile(profile.company_id, 'company', logoFile)
      await update('companies', data.id, { name: data.name, npwp: data.npwp || null, address: data.address || null, phone: data.phone || null, email: data.email || null, logo_url })
      toast.push('Profil perusahaan disimpan')
      setLogoFile(null); await load(); await refresh()
    } catch (e: any) { toast.push(e.message ?? 'Gagal menyimpan', 'error') } finally { setSaving(false) }
  }

  const clearDemo = async () => {
    if (!data) return
    try { await update('companies', data.id, { is_demo: false }); toast.push('Ditandai sebagai data produksi'); await load(); await refresh() }
    catch (e: any) { toast.push(e.message ?? 'Gagal memperbarui', 'error') }
  }

  const writable = can('CORE', 'write')

  if (loading) return (<div><PageHeader title="Profil Perusahaan" /><Skeleton className="h-80 w-full rounded-md" /></div>)
  if (!data) return null

  return (
    <div>
      <PageHeader title="Profil Perusahaan" subtitle="Data identitas perusahaan yang tampil pada dokumen & laporan"
        actions={data.is_demo && <Badge tone="amber">Data Contoh</Badge>} />

      {data.is_demo && (
        <Card className="mb-4 border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
          <div className="p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-body text-ink-700 dark:text-ink-200">Perusahaan ini masih ditandai sebagai <b>data contoh</b> untuk peragaan. Bersihkan penanda ini sebelum digunakan untuk operasional sesungguhnya.</p>
            {writable && <Button size="sm" variant="outline" onClick={clearDemo}>Tandai Bukan Data Contoh</Button>}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Identitas Perusahaan" />
        <div className="p-5 grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex items-center gap-4">
            <div className="w-16 h-16 rounded-md bg-ink-100 dark:bg-ink-800 grid place-items-center overflow-hidden shrink-0">
              {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : <Building2 size={24} className="text-ink-400" />}
            </div>
            {writable && (
              <Field label="Ganti Logo" className="flex-1">
                <input type="file" accept="image/*" disabled={!writable}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)) } }}
                  className="text-caption text-ink-500 file:mr-3 file:h-9 file:px-3 file:rounded-sm file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900 dark:file:text-primary-200" />
              </Field>
            )}
          </div>
          <Field label="Nama Perusahaan" required><Input disabled={!writable} value={data.name} onChange={(e: any) => setData({ ...data, name: e.target.value })} /></Field>
          <Field label="NPWP"><Input disabled={!writable} value={data.npwp ?? ''} onChange={(e: any) => setData({ ...data, npwp: e.target.value })} /></Field>
          <Field label="Telepon"><Input disabled={!writable} value={data.phone ?? ''} onChange={(e: any) => setData({ ...data, phone: e.target.value })} /></Field>
          <Field label="Email"><Input disabled={!writable} type="email" value={data.email ?? ''} onChange={(e: any) => setData({ ...data, email: e.target.value })} /></Field>
          <Field label="Alamat" className="sm:col-span-2"><Input disabled={!writable} value={data.address ?? ''} onChange={(e: any) => setData({ ...data, address: e.target.value })} /></Field>
        </div>
        {writable && (
          <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-ink-200 dark:border-ink-800">
            <Button loading={saving} onClick={save}>Simpan Perubahan</Button>
          </div>
        )}
      </Card>
    </div>
  )
}
