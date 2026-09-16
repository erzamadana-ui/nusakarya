import supabase from './supabase'

/** Helper daftar data generik. RLS server sudah menyaring company_id. */
export async function list<T = any>(
  table: string,
  opts: {
    select?: string
    eq?: Record<string, any>
    in?: Record<string, any[]>
    order?: { col: string; asc?: boolean }
    limit?: number
  } = {}
): Promise<T[]> {
  let q: any = supabase.from(table).select(opts.select ?? '*')
  Object.entries(opts.eq ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q = q.eq(k, v)
  })
  Object.entries(opts.in ?? {}).forEach(([k, v]) => {
    if (v?.length) q = q.in(k, v)
  })
  if (opts.order) q = q.order(opts.order.col, { ascending: opts.order.asc ?? false })
  if (opts.limit) q = q.limit(opts.limit)
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

export async function nextDocNo(companyId: string, prefix: string): Promise<string> {
  const { data, error } = await supabase.rpc('next_doc_no', { p_company: companyId, p_prefix: prefix })
  if (error) throw error
  return data as string
}

/**
 * Unggah berkas (URI lokal dari kamera/galeri/kanvas) ke bucket privat 'files'.
 * Konvensi path WAJIB: <company_id>/<entitas>/<file>
 */
export async function uploadFile(
  companyId: string,
  entity: string,
  localUri: string,
  fileNameHint = 'foto.jpg',
  contentType = 'image/jpeg'
): Promise<string> {
  const safe = fileNameHint.replace(/[^\w.\-]/g, '_')
  const key = `${companyId}/${entity}/${Date.now()}-${safe}`
  const res = await fetch(localUri)
  const arrayBuffer = await res.arrayBuffer()
  const { error } = await supabase.storage.from('files').upload(key, arrayBuffer, {
    upsert: false,
    contentType,
  })
  if (error) throw error
  return key
}

export async function signedUrl(path?: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  const { data, error } = await supabase.storage.from('files').createSignedUrl(path, expiresIn)
  if (error) return null
  return data?.signedUrl ?? null
}
