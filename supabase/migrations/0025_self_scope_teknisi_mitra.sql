-- Teknisi & mitra perlu melihat pekerjaan dan penghasilannya sendiri lewat aplikasi
-- lapangan, TANPA membuka seluruh modul DEPLOYMENT / PAYROLL untuk mereka.
-- Karena itu ditambahkan kebijakan ber-cakupan diri, bukan menaikkan hak modul.

-- Punch list: hanya baris yang ditugaskan kepada dirinya
drop policy if exists punch_lists_select_self on public.punch_lists;
create policy punch_lists_select_self on public.punch_lists for select to authenticated
  using (company_id = public.auth_company_id() and assigned_to = public.auth_employee_id());

drop policy if exists punch_lists_update_self on public.punch_lists;
create policy punch_lists_update_self on public.punch_lists for update to authenticated
  using (company_id = public.auth_company_id() and assigned_to = public.auth_employee_id())
  with check (company_id = public.auth_company_id() and assigned_to = public.auth_employee_id());

-- Payout freelance: mitra hanya boleh melihat payout miliknya sendiri (tanpa hak ubah)
drop policy if exists freelance_payouts_select_self on public.freelance_payouts;
create policy freelance_payouts_select_self on public.freelance_payouts for select to authenticated
  using (company_id = public.auth_company_id() and employee_id = public.auth_employee_id());

drop policy if exists freelance_payout_lines_select_self on public.freelance_payout_lines;
create policy freelance_payout_lines_select_self on public.freelance_payout_lines for select to authenticated
  using (company_id = public.auth_company_id()
         and exists (select 1 from public.freelance_payouts p
                      where p.id = freelance_payout_lines.payout_id
                        and p.employee_id = public.auth_employee_id()));

-- Rate card: mitra boleh melihat tarif yang berlaku untuk dirinya (transparansi upah)
drop policy if exists freelance_rate_cards_select_self on public.freelance_rate_cards;
create policy freelance_rate_cards_select_self on public.freelance_rate_cards for select to authenticated
  using (company_id = public.auth_company_id()
         and (employee_id = public.auth_employee_id() or employee_id is null));

-- K3: setiap pekerja WAJIB bisa melapor insiden & mengisi inspeksi APD, apa pun jabatannya.
drop policy if exists hse_incidents_insert_any on public.hse_incidents;
create policy hse_incidents_insert_any on public.hse_incidents for insert to authenticated
  with check (company_id = public.auth_company_id());

drop policy if exists hse_incidents_select_self on public.hse_incidents;
create policy hse_incidents_select_self on public.hse_incidents for select to authenticated
  using (company_id = public.auth_company_id()
         and (employee_id = public.auth_employee_id() or reported_by = auth.uid()));

drop policy if exists hse_inspections_insert_any on public.hse_inspections;
create policy hse_inspections_insert_any on public.hse_inspections for insert to authenticated
  with check (company_id = public.auth_company_id());

drop policy if exists hse_inspections_select_self on public.hse_inspections;
create policy hse_inspections_select_self on public.hse_inspections for select to authenticated
  using (company_id = public.auth_company_id() and inspector_id = public.auth_employee_id());

-- Izin kerja: pemohon boleh melihat & mengajukan izinnya sendiri
drop policy if exists work_permits_insert_self on public.work_permits;
create policy work_permits_insert_self on public.work_permits for insert to authenticated
  with check (company_id = public.auth_company_id() and requested_by = public.auth_employee_id());

drop policy if exists work_permits_select_self on public.work_permits;
create policy work_permits_select_self on public.work_permits for select to authenticated
  using (company_id = public.auth_company_id() and requested_by = public.auth_employee_id());

-- Pengajuan mandiri karyawan: lembur, dinas, biaya dinas, kasbon
drop policy if exists overtime_requests_self on public.overtime_requests;
create policy overtime_requests_self on public.overtime_requests for select to authenticated
  using (company_id = public.auth_company_id() and employee_id = public.auth_employee_id());
drop policy if exists overtime_requests_insert_self on public.overtime_requests;
create policy overtime_requests_insert_self on public.overtime_requests for insert to authenticated
  with check (company_id = public.auth_company_id() and employee_id = public.auth_employee_id());

drop policy if exists business_trips_self on public.business_trips;
create policy business_trips_self on public.business_trips for select to authenticated
  using (company_id = public.auth_company_id() and employee_id = public.auth_employee_id());
drop policy if exists business_trips_insert_self on public.business_trips;
create policy business_trips_insert_self on public.business_trips for insert to authenticated
  with check (company_id = public.auth_company_id() and employee_id = public.auth_employee_id());

drop policy if exists trip_expenses_self on public.trip_expenses;
create policy trip_expenses_self on public.trip_expenses for select to authenticated
  using (company_id = public.auth_company_id()
         and exists (select 1 from public.business_trips t
                      where t.id = trip_expenses.trip_id and t.employee_id = public.auth_employee_id()));
drop policy if exists trip_expenses_insert_self on public.trip_expenses;
create policy trip_expenses_insert_self on public.trip_expenses for insert to authenticated
  with check (company_id = public.auth_company_id()
         and exists (select 1 from public.business_trips t
                      where t.id = trip_expenses.trip_id and t.employee_id = public.auth_employee_id()));

drop policy if exists employee_advances_self on public.employee_advances;
create policy employee_advances_self on public.employee_advances for select to authenticated
  using (company_id = public.auth_company_id() and employee_id = public.auth_employee_id());
drop policy if exists employee_advances_insert_self on public.employee_advances;
create policy employee_advances_insert_self on public.employee_advances for insert to authenticated
  with check (company_id = public.auth_company_id() and employee_id = public.auth_employee_id());

-- Basis pengetahuan: seluruh pekerja boleh membaca artikel yang sudah diterbitkan
drop policy if exists knowledge_articles_read_published on public.knowledge_articles;
create policy knowledge_articles_read_published on public.knowledge_articles for select to authenticated
  using (company_id = public.auth_company_id() and is_published = true);
