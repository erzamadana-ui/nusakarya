import supabase from './supabase'

/** Generic list helper. Selalu hormati RLS (company_id difilter server-side). */
export async function list<T = any>(
  table: string,
  opts: {
    select?: string
    eq?: Record<string, any>
    neq?: Record<string, any>
    in?: Record<string, any[]>
    ilike?: { col: string; value: string }
    gte?: Record<string, any>
    lte?: Record<string, any>
    order?: { col: string; asc?: boolean }
    limit?: number
    range?: [number, number]
  } = {}
): Promise<T[]> {
  let q: any = supabase.from(table).select(opts.select ?? '*')
  Object.entries(opts.eq ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q = q.eq(k, v) })
  Object.entries(opts.neq ?? {}).forEach(([k, v]) => { q = q.neq(k, v) })
  Object.entries(opts.in ?? {}).forEach(([k, v]) => { if (v?.length) q = q.in(k, v) })
  Object.entries(opts.gte ?? {}).forEach(([k, v]) => { if (v) q = q.gte(k, v) })
  Object.entries(opts.lte ?? {}).forEach(([k, v]) => { if (v) q = q.lte(k, v) })
  if (opts.ilike?.value) q = q.ilike(opts.ilike.col, `%${opts.ilike.value}%`)
  if (opts.order) q = q.order(opts.order.col, { ascending: opts.order.asc ?? false })
  if (opts.limit) q = q.limit(opts.limit)
  if (opts.range) q = q.range(opts.range[0], opts.range[1])
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as T[]
}

export async function getOne<T = any>(table: string, id: string, select = '*'): Promise<T | null> {
  const { data, error } = await supabase.from(table).select(select).eq('id', id).maybeSingle()
  if (error) throw error
  return data as T
}

export async function insert<T = any>(table: string, values: any): Promise<T> {
  const { data, error } = await supabase.from(table).insert(values).select().single()
  if (error) throw error
  return data as T
}

export async function update<T = any>(table: string, id: string, values: any): Promise<T> {
  const { data, error } = await supabase.from(table).update(values).eq('id', id).select().single()
  if (error) throw error
  return data as T
}

export async function remove(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

export async function count(table: string, eq: Record<string, any> = {}) {
  let q: any = supabase.from(table).select('id', { count: 'exact', head: true })
  Object.entries(eq).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q = q.eq(k, v) })
  const { count: c, error } = await q
  if (error) throw error
  return c ?? 0
}

/** Nomor dokumen otomatis: next_doc_no(company_id, prefix) */
export async function nextDocNo(companyId: string, prefix: string): Promise<string> {
  const { data, error } = await supabase.rpc('next_doc_no', { p_company: companyId, p_prefix: prefix })
  if (error) throw error
  return data as string
}

/**
 * Upload berkas ke bucket privat 'files'.
 * Konvensi path WAJIB: <company_id>/<entitas>/<file>  — isolasi antar-tenant ditegakkan storage RLS.
 * Mengembalikan storage path (BUKAN public URL). Tampilkan dengan signedUrl().
 */
export async function uploadFile(companyId: string, entity: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.\-]/g, '_')
  const key = `${companyId}/${entity}/${Date.now()}-${safe}`
  const { error } = await supabase.storage.from('files').upload(key, file, { upsert: false })
  if (error) throw error
  return key
}

/** URL bertanda tangan (default 1 jam). Aman untuk foto evidence & dokumen pelanggan. */
export async function signedUrl(path?: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  const { data, error } = await supabase.storage.from('files').createSignedUrl(path, expiresIn)
  if (error) return null
  return data?.signedUrl ?? null
}

export async function removeFile(path: string) {
  const { error } = await supabase.storage.from('files').remove([path])
  if (error) throw error
}
