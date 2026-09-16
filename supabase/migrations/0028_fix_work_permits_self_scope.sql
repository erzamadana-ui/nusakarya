-- =====================================================================
-- 0028_fix_work_permits_self_scope.sql
-- Ditemukan lewat QA tahap-2: kebijakan ber-cakupan diri untuk work_permits
-- (0025_self_scope_teknisi_mitra.sql) membandingkan requested_by dengan
-- auth_employee_id() (id baris `employees`), padahal kolom
-- work_permits.requested_by di-FK ke auth.users(id) (id akun login) —
-- terbukti seluruh 55 baris seed memakai id auth.users, dan 0 yang cocok
-- dengan employees.id. Akibatnya kondisi `requested_by = auth_employee_id()`
-- TIDAK PERNAH bisa benar (dua ruang id yang berbeda), sehingga
-- work_permits_insert_self dan work_permits_select_self mati total —
-- peran yang HANYA mengandalkan self-scope ini (tanpa hak modul OPERATIONS
-- penuh) tidak akan pernah bisa INSERT/SELECT izin kerja miliknya sendiri.
-- Pola yang benar sudah ada di kebijakan lain pada migrasi yang sama
-- (hse_incidents_select_self: `reported_by = auth.uid()`).
--
-- Perbaikan: samakan work_permits dengan pola auth.uid(), sesuai FK-nya.
-- auth.uid() dibungkus (select ...) supaya planner Postgres men-cache-nya
-- sekali per query (bukan per baris) — sekalian membereskan advisory
-- performa `auth_rls_initplan` untuk kedua policy baru ini.
-- =====================================================================

drop policy if exists work_permits_insert_self on public.work_permits;
create policy work_permits_insert_self on public.work_permits for insert to authenticated
  with check (company_id = public.auth_company_id() and requested_by = (select auth.uid()));

drop policy if exists work_permits_select_self on public.work_permits;
create policy work_permits_select_self on public.work_permits for select to authenticated
  using (company_id = public.auth_company_id() and requested_by = (select auth.uid()));
