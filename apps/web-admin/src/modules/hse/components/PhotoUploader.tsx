import React, { useEffect, useState } from 'react'
import { uploadFile, signedUrl } from '@/lib/db'
import { Button, useToast } from '@/components/ui'

/** Unggah foto evidence (helm, APD, lokasi, dsb) langsung ke bucket privat, menyimpan storage path
 * ke array `paths` (kolom jsonb `photo_urls`). Pratinjau memakai signed URL — TIDAK ada URL publik. */
export default function PhotoUploader({
 companyId, entity, paths, onChange, disabled,
}: { companyId: string; entity: string; paths: string[]; onChange?: (paths: string[]) => void; disabled?: boolean }) {
 const toast = useToast()
 const [busy, setBusy] = useState(false)
 const [previews, setPreviews] = useState<Record<string, string>>({})

 useEffect(() => {
 let alive = true
 ;(async () => {
 const missing = paths.filter(p => !previews[p])
 if (!missing.length) return
 const entries = await Promise.all(missing.map(async p => [p, (await signedUrl(p)) ?? ''] as const))
 if (alive) setPreviews(prev => ({ ...prev, ...Object.fromEntries(entries) }))
 })()
 return () => { alive = false }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [paths])

 async function onPick(files: FileList | null) {
 if (!files?.length) return
 setBusy(true)
 try {
 const uploaded: string[] = []
 for (const file of Array.from(files)) uploaded.push(await uploadFile(companyId, entity, file))
 onChange?.([...paths, ...uploaded])
 toast.push(`${uploaded.length} foto berhasil diunggah`, 'success')
 } catch (e: any) { toast.push(e.message ?? 'Gagal mengunggah foto', 'error') }
 finally { setBusy(false) }
 }
 function removeAt(i: number) { onChange?.(paths.filter((_, idx) => idx !== i)) }

 return (
 <div>
 {!disabled && (
 <label className="inline-block mb-2">
 <span className="inline-flex items-center h-9 px-3 rounded-sm border border-ink-200 text-body cursor-pointer hover:bg-ink-50">
 {busy ? 'Mengunggah…' : 'Unggah Foto'}
 </span>
 <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={e => onPick(e.target.files)} />
 </label>
 )}
 {paths.length === 0 ? (
 <p className="text-caption text-ink-400">Belum ada foto diunggah.</p>
 ) : (
 <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
 {paths.map((p, i) => (
 <div key={p + i} className="relative group border border-ink-200 rounded-sm overflow-hidden">
 {previews[p] ? <img src={previews[p]} className="w-full h-20 object-cover" /> : <div className="w-full h-20 grid place-items-center bg-ink-50 text-caption text-ink-400">Memuat…</div>}
 {!disabled && (
 <button type="button" onClick={() => removeAt(i)}
 className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink-900/70 text-white text-[11px] leading-none grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 )
}
