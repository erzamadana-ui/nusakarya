-- =====================================================================
-- 0037_tambah_perusahaan.sql
-- Halaman /pengaturan/perusahaan: sampai migrasi ini, tabel `companies`
-- TIDAK PERNAH di-`insert` dari UI mana pun (RLS `companies_select` hanya
-- mengizinkan `id = auth_company_id()` — super_admin sekalipun hanya
-- bisa MELIHAT perusahaannya sendiri, dan tidak ada policy INSERT sama
-- sekali). Onboarding tenant baru wajib lewat SQL manual.
--
-- Berisi dua fungsi SECURITY DEFINER (pola sama seperti
-- fn_kesiapan_produksi/fn_bersihkan_data_contoh pada 0035/0036 —
-- sengaja melewati RLS, tapi dikurung ketat lewat pemeriksaan
-- is_super() di baris pertama):
--
--   1. fn_daftar_perusahaan() — daftar SELURUH perusahaan di sistem,
--      supaya super_admin bisa melihat tenant lain (bukan cuma miliknya
--      sendiri, yang dibatasi RLS `companies_select`).
--   2. fn_tambah_perusahaan(...) — membuat perusahaan baru sekaligus
--      menyiapkan isi minimalnya: satu cabang pusat, dan matriks
--      role_module_access disalin dari perusahaan tertua yang sudah ada
--      (mencakup seluruh modul standar pada tabel `modules`, karena
--      `modules` sendiri adalah tabel referensi global tanpa
--      company_id — tidak perlu disalin per perusahaan). TIDAK
--      menyisipkan data contoh/transaksi apa pun; `is_demo` selalu
--      di-set false untuk perusahaan baru.
-- =====================================================================

-- =====================================================================
-- 1. fn_daftar_perusahaan()
-- =====================================================================
create or replace function public.fn_daftar_perusahaan()
returns setof public.companies
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_super() then
    raise exception 'Hanya Super Admin yang boleh melihat daftar seluruh perusahaan (modul CORE, hak super_admin).'
      using errcode = '42501';
  end if;
  return query select * from public.companies order by created_at asc;
end;
$$;

comment on function public.fn_daftar_perusahaan() is
  'Daftar seluruh perusahaan (lintas tenant) untuk halaman /pengaturan/perusahaan. SECURITY DEFINER karena RLS companies_select hanya mengizinkan id = auth_company_id() — super_admin butuh melihat tenant lain untuk mengelola daftar perusahaan. Hanya boleh dipanggil oleh super_admin.';

revoke execute on function public.fn_daftar_perusahaan() from public;
revoke execute on function public.fn_daftar_perusahaan() from anon;
grant execute on function public.fn_daftar_perusahaan() to authenticated;

-- =====================================================================
-- 2. fn_tambah_perusahaan(...)
-- =====================================================================
create or replace function public.fn_tambah_perusahaan(
  p_name text,
  p_code text,
  p_npwp text default null,
  p_address text default null,
  p_phone text default null,
  p_email text default null
)
returns public.companies
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_code text := upper(trim(coalesce(p_code, '')));
  v_company public.companies;
  v_template_company uuid;
begin
  -- 1) hanya super_admin yang boleh membuat perusahaan baru
  if not is_super() then
    raise exception 'Hanya Super Admin yang boleh menambah perusahaan baru (modul CORE, hak super_admin).'
      using errcode = '42501';
  end if;

  -- 2) validasi input wajib
  if v_name = '' then
    raise exception 'Nama perusahaan wajib diisi.' using errcode = '22023';
  end if;
  if v_code = '' then
    raise exception 'Kode perusahaan wajib diisi.' using errcode = '22023';
  end if;
  if exists (select 1 from public.companies where code = v_code) then
    raise exception 'Kode perusahaan "%" sudah dipakai perusahaan lain. Gunakan kode unik.', v_code
      using errcode = '23505';
  end if;

  -- 3) tentukan perusahaan pola (tertua yang sudah ada) SEBELUM insert,
  --    supaya perusahaan baru tidak pernah menyalin dari dirinya sendiri
  select id into v_template_company from public.companies order by created_at asc limit 1;

  -- 4) buat baris perusahaan — is_demo selalu false, tidak ada data contoh
  insert into public.companies (name, code, npwp, address, phone, email, is_active, is_demo, created_by)
  values (
    v_name, v_code,
    nullif(trim(coalesce(p_npwp, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    true, false, auth.uid()
  )
  returning * into v_company;

  -- 5) satu cabang pusat
  insert into public.branches (company_id, code, name, is_active, created_by)
  values (v_company.id, 'PUSAT', v_name || ' - Kantor Pusat', true, auth.uid());

  -- 6) matriks role_module_access disalin dari pola perusahaan yang ada
  --    (mencakup seluruh modul standar pada tabel `modules`, karena
  --    setiap baris role_module_access sudah menunjuk ke module_code
  --    yang valid). Dilewati bila belum ada perusahaan sama sekali
  --    (perusahaan pertama di sistem) — tidak ada pola untuk disalin.
  if v_template_company is not null then
    insert into public.role_module_access (company_id, role, module_code, can_read, can_write, can_approve, created_by)
    select v_company.id, rma.role, rma.module_code, rma.can_read, rma.can_write, rma.can_approve, auth.uid()
    from public.role_module_access rma
    where rma.company_id = v_template_company;
  end if;

  -- 7) jejak audit
  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, before, after)
  values (
    v_company.id, auth.uid(), 'tambah_perusahaan', 'companies', v_company.id,
    null,
    jsonb_build_object('name', v_company.name, 'code', v_company.code, 'disalin_dari', v_template_company)
  );

  return v_company;
end;
$$;

comment on function public.fn_tambah_perusahaan(text, text, text, text, text, text) is
  'Membuat perusahaan (tenant) baru: baris companies + satu cabang pusat + matriks role_module_access disalin dari perusahaan tertua yang ada. Tidak pernah menyisipkan data contoh (is_demo selalu false). SECURITY DEFINER karena tidak ada policy INSERT pada companies/role_module_access lintas tenant — dikurung lewat pemeriksaan is_super() di awal fungsi. Hanya boleh dipanggil oleh super_admin.';

revoke execute on function public.fn_tambah_perusahaan(text, text, text, text, text, text) from public;
revoke execute on function public.fn_tambah_perusahaan(text, text, text, text, text, text) from anon;
grant execute on function public.fn_tambah_perusahaan(text, text, text, text, text, text) to authenticated;
