// Edge Function: saas-publik  (verify_jwt = false — dipanggil sebelum pengguna punya akun)
// Aksi:
//   daftar           : buat akun + workspace (tenant) baru dengan masa uji coba 30 hari
//   terima_undangan  : buat akun dari tautan undangan lalu tautkan ke workspace pengundang
// Pengaman: validasi masukan, honeypot anti-bot, batas pendaftaran per hari (di SQL),
// company/role HANYA ditentukan server (app_metadata / fungsi SQL), tidak pernah dari klien.
import { createClient } from 'npm:@supabase/supabase-js@2'

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
  try { body = await req.json() } catch { /* kosong */ }
  if (body?.situs_web) return json({ ok: true }) // honeypot: bot mengisi kolom tersembunyi

  try {
    if (body?.action === 'daftar') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const full_name = String(body.full_name ?? '').trim()
      const perusahaan = String(body.perusahaan ?? '').trim()
      const telepon = body.telepon ? String(body.telepon).trim().slice(0, 30) : null
      const template = ['fo_telkom_akses', 'kontraktor_umum'].includes(body.template) ? body.template : 'fo_telkom_akses'
      const paket = ['starter', 'professional', 'enterprise'].includes(body.paket) ? body.paket : 'professional'
      const data_contoh = !!body.data_contoh
      if (!emailSah(email)) return json({ error: 'Email tidak valid' }, 400)
      if (full_name.length < 3) return json({ error: 'Nama lengkap minimal 3 karakter' }, 400)
      if (perusahaan.length < 3 || perusahaan.length > 120) return json({ error: 'Nama perusahaan 3–120 karakter' }, 400)
      if (!sandiKuat(body.password)) return json({ error: 'Kata sandi minimal 8 karakter serta mengandung huruf dan angka' }, 400)
      if (!body.setuju) return json({ error: 'Anda perlu menyetujui ketentuan uji coba & pemrosesan data' }, 400)

      const { data: dibuat, error: e1 } = await admin.auth.admin.createUser({
        email, password: body.password, email_confirm: true,
        user_metadata: { full_name, phone: telepon, sumber: 'daftar_mandiri' },
      })
      if (e1 || !dibuat.user) {
        const pesan = /already/i.test(e1?.message ?? '') ? 'Email sudah terdaftar. Silakan masuk.' : (e1?.message ?? 'Gagal membuat akun')
        return json({ error: pesan }, /already/i.test(e1?.message ?? '') ? 409 : 400)
      }
      const { data: companyId, error: e2 } = await admin.rpc('fn__buat_workspace', {
        p_user: dibuat.user.id, p_nama: perusahaan, p_template: template, p_paket: paket,
        p_nama_admin: full_name, p_telepon: telepon, p_data_contoh: data_contoh,
      })
      if (e2) {
        await admin.auth.admin.deleteUser(dibuat.user.id) // jangan tinggalkan akun yatim
        return json({ error: e2.message }, 400)
      }
      return json({ ok: true, company_id: companyId })
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
