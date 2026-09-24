// Edge Function: admin-users
// Operasi administrasi akun login (Supabase Auth) untuk panel NUSAKARYA.
// Hanya boleh dipanggil oleh super_admin atau manager_hr, dan hanya menyentuh
// pengguna pada company_id yang sama dengan pemanggil.
//
// v2 (24 Sep 2026): company_id / role / unit / cabang ditulis ke APP_METADATA
// (hanya bisa diisi service role) — trigger handle_new_user() tidak lagi
// mempercayai user_metadata. Manager HR tidak boleh membuat/menyentuh Super Admin.
// Batas pengguna per paket langganan ditegakkan di sini dan di trigger basis data.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function isStrongPassword(pw: unknown): pw is string {
  return typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw)
}

const ALLOWED_ROLES = [
  'super_admin', 'direktur', 'komisaris', 'manager_hr', 'manager_commerce', 'manager_procurement',
  'manager_finance', 'manager_inventory', 'manager_operations', 'manager_deployment', 'staff_hr',
  'staff_commerce', 'staff_procurement', 'staff_finance', 'staff_inventory', 'spv_operations',
  'dispatcher', 'teknisi', 'design_engineer', 'project_manager', 'qc', 'mitra', 'viewer',
]
const ALLOWED_UNITS = [
  'EXECUTIVE', 'HR', 'COMMERCE', 'PROCUREMENT', 'FINANCE', 'INVENTORY', 'OPERATIONS', 'DEPLOYMENT',
]
const BAN_FOREVER = '87600h'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'Tidak terautentikasi' }, 401)
    const { data: callerAuth, error: callerAuthErr } = await admin.auth.getUser(token)
    if (callerAuthErr || !callerAuth?.user) return json({ error: 'Sesi tidak valid' }, 401)

    const { data: callerProfile } = await admin.from('profiles')
      .select('id, company_id, role, is_active').eq('id', callerAuth.user.id).maybeSingle()
    if (!callerProfile) return json({ error: 'Profil pemanggil tidak ditemukan' }, 403)
    if (!callerProfile.is_active) return json({ error: 'Akun Anda nonaktif' }, 403)
    if (!['super_admin', 'manager_hr'].includes(callerProfile.role)) {
      return json({ error: 'Anda tidak memiliki hak untuk mengelola pengguna' }, 403)
    }
    const companyId = callerProfile.company_id as string
    const isSuper = callerProfile.role === 'super_admin'

    let body: any = {}
    try { body = await req.json() } catch { /* kosong */ }
    const action = body?.action as string

    const writeAudit = async (auditAction: string, entityId: string | null, after: Record<string, unknown> | null) => {
      await admin.from('audit_logs').insert({
        company_id: companyId, user_id: callerProfile.id, action: auditAction,
        entity_type: 'user', entity_id: entityId, after,
      })
    }
    const targetOf = async (user_id: string) => {
      const { data } = await admin.from('profiles').select('id, company_id, email, role').eq('id', user_id).maybeSingle()
      if (!data || data.company_id !== companyId) return null
      return data
    }

    if (action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = body.password
      const full_name = String(body.full_name ?? '').trim()
      const role = String(body.role ?? '').trim()
      const unit = body.unit ? String(body.unit).trim() : null
      const branch_id = body.branch_id ? String(body.branch_id).trim() : null
      const phone = body.phone ? String(body.phone).trim() : null
      const employee_id = body.employee_id ? String(body.employee_id).trim() : null

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Email tidak valid' }, 400)
      if (!full_name) return json({ error: 'Nama lengkap wajib diisi' }, 400)
      if (!ALLOWED_ROLES.includes(role)) return json({ error: 'Jabatan tidak valid' }, 400)
      if (role === 'super_admin' && !isSuper) return json({ error: 'Hanya Super Admin yang boleh membuat akun Super Admin' }, 403)
      if (unit && !ALLOWED_UNITS.includes(unit)) return json({ error: 'Unit tidak valid' }, 400)
      if (!isStrongPassword(password)) return json({ error: 'Kata sandi minimal 8 karakter serta mengandung huruf dan angka' }, 400)

      // Batas pengguna sesuai paket langganan.
      const { data: kuota } = await admin.rpc('fn_cek_kuota', { p_company: companyId, p_metrik: 'users', p_tambah: 1 })
      if (kuota && kuota.ok === false) return json({ error: kuota.pesan }, 402)

      if (employee_id) {
        const { data: emp } = await admin.from('employees').select('id, company_id, user_id').eq('id', employee_id).maybeSingle()
        if (!emp || emp.company_id !== companyId) return json({ error: 'Karyawan tidak ditemukan' }, 400)
        if (emp.user_id) return json({ error: 'Karyawan tersebut sudah tertaut ke akun lain' }, 400)
      }
      if (branch_id) {
        const { data: br } = await admin.from('branches').select('id, company_id').eq('id', branch_id).maybeSingle()
        if (!br || br.company_id !== companyId) return json({ error: 'Cabang tidak valid' }, 400)
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name, phone },
        app_metadata: { company_id: companyId, role, unit, branch_id, employee_id },
      })
      if (createErr) {
        const msg = /already been registered|already exists/i.test(createErr.message ?? '')
          ? 'Email sudah terdaftar' : (createErr.message || 'Gagal membuat pengguna')
        return json({ error: msg }, /already/i.test(msg) ? 409 : 400)
      }
      const newId = created.user?.id
      await writeAudit('create_user', newId ?? null, { email, full_name, role, unit, branch_id, phone, employee_id })
      return json({ id: newId, email })
    }

    if (action === 'reset_password') {
      const user_id = String(body.user_id ?? '')
      if (!user_id) return json({ error: 'user_id wajib diisi' }, 400)
      if (!isStrongPassword(body.new_password)) return json({ error: 'Kata sandi minimal 8 karakter serta mengandung huruf dan angka' }, 400)
      const target = await targetOf(user_id)
      if (!target) return json({ error: 'Pengguna tidak ditemukan' }, 404)
      if (target.role === 'super_admin' && !isSuper) return json({ error: 'Manager HR tidak boleh mengubah akun Super Admin' }, 403)
      const { error } = await admin.auth.admin.updateUserById(user_id, { password: body.new_password })
      if (error) return json({ error: error.message || 'Gagal mengatur ulang kata sandi' }, 400)
      await writeAudit('reset_password', user_id, { email: target.email })
      return json({ ok: true })
    }

    if (action === 'set_active') {
      const user_id = String(body.user_id ?? '')
      const is_active = !!body.is_active
      if (!user_id) return json({ error: 'user_id wajib diisi' }, 400)
      if (user_id === callerProfile.id) return json({ error: 'Tidak dapat menonaktifkan akun sendiri' }, 400)
      const target = await targetOf(user_id)
      if (!target) return json({ error: 'Pengguna tidak ditemukan' }, 404)
      if (target.role === 'super_admin' && !isSuper) return json({ error: 'Manager HR tidak boleh mengubah akun Super Admin' }, 403)
      const { error: e1 } = await admin.from('profiles').update({ is_active }).eq('id', user_id)
      if (e1) return json({ error: e1.message || 'Gagal memperbarui status' }, 400)
      const { error: e2 } = await admin.auth.admin.updateUserById(user_id, { ban_duration: is_active ? 'none' : BAN_FOREVER })
      if (e2) return json({ error: e2.message || 'Gagal memperbarui status login' }, 400)
      await writeAudit('set_active_user', user_id, { email: target.email, is_active })
      return json({ ok: true })
    }

    if (action === 'delete') {
      const user_id = String(body.user_id ?? '')
      if (!user_id) return json({ error: 'user_id wajib diisi' }, 400)
      if (!isSuper) return json({ error: 'Hanya Super Admin yang dapat menghapus pengguna' }, 403)
      if (user_id === callerProfile.id) return json({ error: 'Tidak dapat menghapus akun sendiri' }, 400)
      const target = await targetOf(user_id)
      if (!target) return json({ error: 'Pengguna tidak ditemukan' }, 404)
      const { error } = await admin.auth.admin.deleteUser(user_id)
      if (error) return json({ error: error.message || 'Gagal menghapus pengguna' }, 400)
      await writeAudit('delete_user', user_id, { email: target.email })
      return json({ ok: true })
    }

    return json({ error: 'Aksi tidak dikenal' }, 400)
  } catch (e: any) {
    return json({ error: e?.message ?? 'Terjadi kesalahan pada server' }, 500)
  }
})
