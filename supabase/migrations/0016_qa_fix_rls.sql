-- =====================================================================
-- 0016_qa_fix_rls.sql — perbaikan temuan QA RLS end-to-end (16 Sep 2026)
-- =====================================================================
-- Ref: docs/LAPORAN-QA-RLS.md
--
-- Temuan #1 (kebocoran modul salah): ap_payments diberi label "(PROCUREMENT)"
-- di 0007_rls.sql padahal secara bisnis adalah pembayaran hutang vendor milik
-- unit FINANCE. Akibatnya manager_finance (can_write PROCUREMENT=false) tidak
-- bisa mencatat pembayaran AP walau seharusnya BOLEH, sementara staff/manager
-- procurement (can_write PROCUREMENT=true) yang justru TIDAK seharusnya bisa
-- menulis ap_payments malah diizinkan. Perbaikan: gunakan modul FINANCE.
-- ---------------------------------------------------------------------
drop policy if exists ap_payments_select on ap_payments;
drop policy if exists ap_payments_insert on ap_payments;
drop policy if exists ap_payments_update on ap_payments;
drop policy if exists ap_payments_delete on ap_payments;

create policy ap_payments_select on ap_payments for select
  using (company_id = auth_company_id() and can_read('FINANCE'));
create policy ap_payments_insert on ap_payments for insert
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy ap_payments_update on ap_payments for update
  using (company_id = auth_company_id() and can_write('FINANCE'))
  with check (company_id = auth_company_id() and can_write('FINANCE'));
create policy ap_payments_delete on ap_payments for delete
  using (company_id = auth_company_id() and can_approve('FINANCE'));

-- ---------------------------------------------------------------------
-- Temuan #2 (data link hilang): profiles.employee_id untuk SEMUA 13 akun
-- login QA adalah NULL (akun auth dibuat terpisah dari seed employees).
-- Ini mematikan setiap kebijakan RLS "self-scoped" yang bergantung pada
-- auth_employee_id(), contoh nyata: teknisi@ tidak bisa melihat/insert
-- productivity_entries miliknya sendiri (auth_employee_id() selalu NULL
-- sehingga employee_id = auth_employee_id() tidak pernah cocok) padahal
-- role_module_access mengizinkan can_read('PRODUCTIVITY')=true untuk
-- teknisi. Perbaikan: tautkan akun teknisi@ ke baris employees miliknya
-- (Andi Saputra / NKMT-0001, unit OPERATIONS, posisi Teknisi Lapangan)
-- dua arah (profiles.employee_id + employees.user_id).
-- ---------------------------------------------------------------------
update profiles
   set employee_id = '8ee1211d-4366-4386-94da-19edb1423e42'
 where email = 'teknisi@nusakarya.id'
   and employee_id is distinct from '8ee1211d-4366-4386-94da-19edb1423e42';

update employees
   set user_id = (select id from auth.users where email = 'teknisi@nusakarya.id')
 where id = '8ee1211d-4366-4386-94da-19edb1423e42'
   and user_id is distinct from (select id from auth.users where email = 'teknisi@nusakarya.id');
