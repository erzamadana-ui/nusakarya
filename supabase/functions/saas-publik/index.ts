// Edge Function: saas-publik  (verify_jwt = false — dipanggil sebelum pengguna punya akun)
// Aksi:
//   daftar           : buat akun + workspace (tenant) baru dengan masa uji coba 30 hari
//   terima_undangan  : buat akun dari tautan undangan lalu tautkan ke workspace pengundang
// Pengaman: validasi masukan, honeypot anti-bot, batas pendaftaran per hari (di SQL),
// company/role HANYA ditentukan server (app_metadata / fungsi SQL), tidak pernah dari klien.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const sandiKuat = (pw: unknown): pw is string =>
  typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw)
const emailSah = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  let body: any = {}
  try {
    const raw = await req.text()
    if (raw.length > 16384) return json({ error: 'Permintaan terlalu besar' }, 413)
    body = JSON.parse(raw)
  } catch { return json({ error: 'Permintaan tidak valid' }, 400) }
  if (body?.situs_web) return json({ ok: true }) // honeypot: bot mengisi kolom tersembunyi

  try {
    if (body?.action === 'daftar') {
      return json({ error: 'Gunakan halaman pendaftaran terbaru dan verifikasi email kerja sebelum membuat workspace.' }, 410)
    }

    if (body?.action === 'minat') {
      const company_name = String(body.company_name ?? '').trim()
      const contact_name = String(body.contact_name ?? '').trim()
      const email = String(body.email ?? '').trim().toLowerCase()
      const phone = String(body.phone ?? '').trim()
      const notes = String(body.notes ?? '').trim()
      const plan = String(body.plan ?? 'belum_tahu')
      const technicians = Number(body.technicians)
      const work_orders_month = Number(body.work_orders_month)
      if (company_name.length < 3 || company_name.length > 120 || contact_name.length < 2 || contact_name.length > 100
        || !emailSah(email) || email.length > 254 || phone.length > 30 || notes.length > 2000
        || !['starter','professional','enterprise','managed','belum_tahu'].includes(plan)
        || !Number.isInteger(technicians) || technicians < 1 || technicians > 100000
        || !Number.isInteger(work_orders_month) || work_orders_month < 0 || work_orders_month > 10000000
        || body.consent !== true) return json({ error: 'Periksa data kontak, volume tim, dan persetujuan Anda.' }, 400)
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
        new TextEncoder().encode(`${new Date().toISOString().slice(0,10)}:${ip}`))))
        .map(x => x.toString(16).padStart(2,'0')).join('')
      const { data: id, error } = await admin.rpc('fn_submit_commercial_lead', {
        p_data: { company_name,contact_name,email,phone,plan,technicians,work_orders_month,notes,consent:true }, p_hash:hash,
      })
      if (error) return json({ error: error.code === 'P0429' ? 'Terlalu banyak permintaan. Silakan coba lagi besok.' : 'Permintaan belum tersimpan. Coba lagi nanti.' }, error.code === 'P0429' ? 429 : 500)
      return json({ ok: true, reference: id })
    }

    if (body?.action === 'terima_undangan') {
      const token = String(body.token ?? '')
      const full_name = String(body.full_name ?? '').trim()
      if (token.length < 24) return json({ error: 'Tautan undangan tidak valid' }, 400)
      if (!sandiKuat(body.password)) return json({ error: 'Kata sandi minimal 8 karakter serta mengandung huruf dan angka' }, 400)
      const { data: inv } = await admin.from('tenant_invites').select('*').eq('token', token).maybeSingle()
      if (!inv || inv.accepted_at || inv.revoked_at || new Date(inv.expires_at) < new Date()) {
        return json({ error: 'Undangan tidak berlaku, sudah dipakai, atau kedaluwarsa' }, 400)
      }
      const { data: tenant } = await admin.from('companies').select('privacy_quarantined').eq('id', inv.company_id).maybeSingle()
      if (!tenant || tenant.privacy_quarantined) return json({ error: 'Workspace sedang ditinjau. Hubungi pemilik platform.' }, 403)
      const { data: kuota } = await admin.rpc('fn_cek_kuota', {
        p_company: inv.company_id, p_metrik: ['teknisi', 'mitra'].includes(inv.role) ? 'teknisi' : 'users', p_tambah: 1,
      })
      if (kuota && kuota.ok === false && kuota.keras) return json({ error: kuota.pesan }, 402)

      const { data: dibuat, error: e1 } = await admin.auth.admin.createUser({
        email: inv.email, password: body.password, email_confirm: true,
        user_metadata: { full_name: full_name || inv.full_name, sumber: 'undangan' },
        app_metadata: { company_id: inv.company_id, role: inv.role, branch_id: inv.branch_id },
      })
      if (e1 || !dibuat.user) {
        const pesan = /already/i.test(e1?.message ?? '')
          ? 'Email ini sudah punya akun. Masuk dulu, lalu buka lagi tautan undangan.'
          : (e1?.message ?? 'Gagal membuat akun')
        return json({ error: pesan }, 409)
      }
      await admin.from('tenant_invites').update({ accepted_at: new Date().toISOString(), accepted_by: dibuat.user.id }).eq('id', inv.id)
      await admin.from('audit_logs').insert({
        company_id: inv.company_id, user_id: dibuat.user.id, action: 'terima_undangan',
        entity_type: 'tenant_invites', entity_id: inv.id, after: { email: inv.email, role: inv.role },
      })
      return json({ ok: true, email: inv.email })
    }

    return json({ error: 'Aksi tidak dikenal' }, 400)
  } catch (e: any) {
    return json({ error: e?.message ?? 'Terjadi kesalahan pada server' }, 500)
  }
})
