-- =====================================================================
-- 0040_layanan_mandiri_karyawan.sql
--
-- MASALAH
-- 1. Kebijakan absensi mandiri di-hardcode ke peran 'teknisi', sehingga
--    peran lain (spv, dispatcher, manajer unit, QC, staf) TIDAK BISA
--    mencatat absen dirinya sendiri.
-- 2. Tabel leave_requests sama sekali tidak punya kebijakan mandiri,
--    jadi hanya peran ber-hak-tulis HR yang bisa mengajukan cuti.
-- 3. Pengajuan lembur/SPPD/uang muka/biaya perjalanan sudah punya
--    kebijakan INSERT mandiri, tetapi tidak punya UPDATE mandiri —
--    pengaju tidak bisa memperbaiki isian sebelum disetujui.
--
-- PERBAIKAN: kebijakan berbasis kepemilikan baris (employee_id =
-- auth_employee_id()), bukan berbasis nama peran. Idempoten.
-- =====================================================================

drop policy if exists attendances_teknisi_insert on attendances;
drop policy if exists attendances_teknisi_update on attendances;
drop policy if exists attendances_insert_self on attendances;
create policy attendances_insert_self on attendances for insert
  with check (company_id = auth_company_id() and employee_id = auth_employee_id());
drop policy if exists attendances_update_self on attendances;
create policy attendances_update_self on attendances for update
  using (company_id = auth_company_id() and employee_id = auth_employee_id())
  with check (company_id = auth_company_id() and employee_id = auth_employee_id());

drop policy if exists attendances_insert on attendances;
create policy attendances_insert on attendances for insert
  with check (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan());
drop policy if exists attendances_update on attendances;
create policy attendances_update on attendances for update
  using (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan())
  with check (company_id = auth_company_id() and can_write('HR') and not is_peran_lapangan());

drop policy if exists leave_requests_insert_self on leave_requests;
create policy leave_requests_insert_self on leave_requests for insert
  with check (company_id = auth_company_id() and employee_id = auth_employee_id()
              and coalesce(status,'diajukan') in ('draft','diajukan'));
drop policy if exists leave_requests_update_self on leave_requests;
create policy leave_requests_update_self on leave_requests for update
  using (company_id = auth_company_id() and employee_id = auth_employee_id() and status in ('draft','diajukan'))
  with check (company_id = auth_company_id() and employee_id = auth_employee_id() and status in ('draft','diajukan'));

drop policy if exists overtime_requests_update_self on overtime_requests;
create policy overtime_requests_update_self on overtime_requests for update
  using (company_id = auth_company_id() and employee_id = auth_employee_id() and status = 'diajukan')
  with check (company_id = auth_company_id() and employee_id = auth_employee_id() and status = 'diajukan');

drop policy if exists business_trips_update_self on business_trips;
create policy business_trips_update_self on business_trips for update
  using (company_id = auth_company_id() and employee_id = auth_employee_id() and status = 'diajukan')
  with check (company_id = auth_company_id() and employee_id = auth_employee_id() and status = 'diajukan');

drop policy if exists employee_advances_update_self on employee_advances;
create policy employee_advances_update_self on employee_advances for update
  using (company_id = auth_company_id() and employee_id = auth_employee_id() and status = 'diajukan')
  with check (company_id = auth_company_id() and employee_id = auth_employee_id() and status = 'diajukan');

drop policy if exists trip_expenses_update_self on trip_expenses;
create policy trip_expenses_update_self on trip_expenses for update
  using (company_id = auth_company_id() and status = 'diajukan'
         and exists (select 1 from business_trips t where t.id = trip_expenses.trip_id and t.employee_id = auth_employee_id()))
  with check (company_id = auth_company_id() and status = 'diajukan'
         and exists (select 1 from business_trips t where t.id = trip_expenses.trip_id and t.employee_id = auth_employee_id()));
