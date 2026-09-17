-- =====================================================================
-- 0041_cegah_swa_persetujuan_peran_lapangan.sql
--
-- MASALAH: peran lapangan (teknisi) diberi can_write('HR')=true supaya
-- tombol layanan mandiri muncul di UI. Karena kebijakan RLS bersifat
-- PERMISIF (digabung dengan OR), kebijakan modul HR itu membatalkan
-- penjaga status pada kebijakan mandiri. Terbukti: teknisi bisa
-- menyisipkan pengajuan cuti yang langsung berstatus 'disetujui' —
-- menyetujui dirinya sendiri.
--
-- PERBAIKAN: kebijakan modul HR pada tabel pengajuan tidak lagi berlaku
-- bagi peran lapangan; mereka hanya boleh lewat jalur mandiri, yang
-- mewajibkan status awal. Idempoten.
-- =====================================================================

drop policy if exists leave_requests_insert on leave_requests;
create policy leave_requests_insert on leave_requests for insert
  with check (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan());
drop policy if exists leave_requests_update on leave_requests;
create policy leave_requests_update on leave_requests for update
  using (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan())
  with check (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan());

drop policy if exists overtime_requests_insert on overtime_requests;
create policy overtime_requests_insert on overtime_requests for insert
  with check (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan());
drop policy if exists overtime_requests_update on overtime_requests;
create policy overtime_requests_update on overtime_requests for update
  using (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan())
  with check (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan());

drop policy if exists business_trips_insert on business_trips;
create policy business_trips_insert on business_trips for insert
  with check (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan());
drop policy if exists business_trips_update on business_trips;
create policy business_trips_update on business_trips for update
  using (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan())
  with check (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan());

drop policy if exists employee_advances_insert on employee_advances;
create policy employee_advances_insert on employee_advances for insert
  with check (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan());
drop policy if exists employee_advances_update on employee_advances;
create policy employee_advances_update on employee_advances for update
  using (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan())
  with check (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan());

drop policy if exists trip_expenses_insert on trip_expenses;
create policy trip_expenses_insert on trip_expenses for insert
  with check (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan());
drop policy if exists trip_expenses_update on trip_expenses;
create policy trip_expenses_update on trip_expenses for update
  using (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan())
  with check (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan());

-- Penjaga status pada jalur mandiri: pengajuan baru wajib berstatus awal.
drop policy if exists overtime_requests_insert_self on overtime_requests;
create policy overtime_requests_insert_self on overtime_requests for insert
  with check (company_id = auth_company_id() and employee_id = auth_employee_id()
              and coalesce(status,'diajukan') = 'diajukan');

drop policy if exists business_trips_insert_self on business_trips;
create policy business_trips_insert_self on business_trips for insert
  with check (company_id = auth_company_id() and employee_id = auth_employee_id()
              and coalesce(status,'diajukan') = 'diajukan');

drop policy if exists employee_advances_insert_self on employee_advances;
create policy employee_advances_insert_self on employee_advances for insert
  with check (company_id = auth_company_id() and employee_id = auth_employee_id()
              and coalesce(status,'diajukan') = 'diajukan');

drop policy if exists trip_expenses_insert_self on trip_expenses;
create policy trip_expenses_insert_self on trip_expenses for insert
  with check (company_id = auth_company_id() and coalesce(status,'diajukan') = 'diajukan'
              and exists (select 1 from business_trips t where t.id = trip_expenses.trip_id and t.employee_id = auth_employee_id()));
