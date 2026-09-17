-- =====================================================================
-- 0039_batasi_master_data_peran_lapangan.sql
--
-- MASALAH YANG DIPERBAIKI
-- Hak akses aplikasi ini bersifat per-MODUL (role_module_access + helper
-- can_write('<MODUL>')). Satu modul memuat tabel transaksi DAN tabel
-- master/referensi. Akibatnya peran lapangan (teknisi, mitra) yang diberi
-- can_write pada HR / INVENTORY / OPERATIONS / PRODUCTIVITY -- supaya bisa
-- absen, mengajukan cuti, mengisi work order, memakai material -- ikut bisa
-- MENULIS tabel master.
--
-- Terbukti lewat peniruan JWT (set request.jwt.claims + role authenticated):
-- teknisi LOLOS menulis employees, warehouses, network_elements,
-- disciplinary_actions, root_causes, shifts, escalation_matrix.
--
-- CARA PERBAIKAN
-- Menambah lapisan kedua di atas can_write(): daftar peran lapangan disimpan
-- sebagai DATA (tabel peran_lapangan) supaya bisa diubah tanpa migrasi baru,
-- lalu policy INSERT/UPDATE tabel master memakai can_write_master().
-- Policy SELECT TIDAK diubah -- peran lapangan tetap boleh MEMBACA master
-- data (mereka butuh daftar gudang, elemen jaringan, jenis pekerjaan, dsb).
-- Policy DELETE TIDAK diubah -- sudah memakai can_approve() yang bernilai
-- false untuk semua peran lapangan.
--
-- Modul tiap tabel TIDAK diubah, jadi visibilitas menu di UI tetap sama.
-- Idempoten: aman dijalankan ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Daftar peran lapangan (data, bukan hardcode)
-- ---------------------------------------------------------------------
create table if not exists peran_lapangan (
  role text primary key,
  catatan text,
  created_at timestamptz not null default now()
);

insert into peran_lapangan (role, catatan) values
  ('teknisi', 'Teknisi lapangan -- hanya transaksi harian, tidak boleh mengubah master data'),
  ('mitra',   'Mitra kerja eksternal -- akses paling terbatas')
on conflict (role) do nothing;

alter table peran_lapangan enable row level security;

drop policy if exists peran_lapangan_select on peran_lapangan;
create policy peran_lapangan_select on peran_lapangan for select
  to authenticated using (true);

drop policy if exists peran_lapangan_write on peran_lapangan;
create policy peran_lapangan_write on peran_lapangan for all
  to authenticated using (is_super()) with check (is_super());

-- ---------------------------------------------------------------------
-- 2. Helper
-- ---------------------------------------------------------------------
create or replace function is_peran_lapangan()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from peran_lapangan where role = auth_role());
$$;

comment on function is_peran_lapangan() is
  'true bila peran pengguna saat ini terdaftar sebagai peran lapangan (lihat tabel peran_lapangan).';

create or replace function can_write_master(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select can_write(p_module) and not is_peran_lapangan();
$$;

comment on function can_write_master(text) is
  'Hak tulis untuk tabel master/referensi: hak modul biasa, tetapi ditolak untuk peran lapangan.';

revoke execute on function is_peran_lapangan() from public, anon;
revoke execute on function can_write_master(text) from public, anon;
grant execute on function is_peran_lapangan() to authenticated;
grant execute on function can_write_master(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Policy INSERT/UPDATE tabel master
-- ---------------------------------------------------------------------

-- ===== Modul HR =====

drop policy if exists employees_insert on employees;
create policy employees_insert on employees for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));
drop policy if exists employees_update on employees;
create policy employees_update on employees for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists disciplinary_actions_insert on disciplinary_actions;
create policy disciplinary_actions_insert on disciplinary_actions for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));
drop policy if exists disciplinary_actions_update on disciplinary_actions;
create policy disciplinary_actions_update on disciplinary_actions for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists performance_reviews_insert on performance_reviews;
create policy performance_reviews_insert on performance_reviews for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));
drop policy if exists performance_reviews_update on performance_reviews;
create policy performance_reviews_update on performance_reviews for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists performance_review_items_insert on performance_review_items;
create policy performance_review_items_insert on performance_review_items for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));
drop policy if exists performance_review_items_update on performance_review_items;
create policy performance_review_items_update on performance_review_items for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists competencies_insert on competencies;
create policy competencies_insert on competencies for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));
drop policy if exists competencies_update on competencies;
create policy competencies_update on competencies for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists employee_competencies_insert on employee_competencies;
create policy employee_competencies_insert on employee_competencies for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));
drop policy if exists employee_competencies_update on employee_competencies;
create policy employee_competencies_update on employee_competencies for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists employee_certifications_insert on employee_certifications;
create policy employee_certifications_insert on employee_certifications for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));
drop policy if exists employee_certifications_update on employee_certifications;
create policy employee_certifications_update on employee_certifications for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists job_vacancies_insert on job_vacancies;
create policy job_vacancies_insert on job_vacancies for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));
drop policy if exists job_vacancies_update on job_vacancies;
create policy job_vacancies_update on job_vacancies for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists job_applicants_insert on job_applicants;
create policy job_applicants_insert on job_applicants for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));
drop policy if exists job_applicants_update on job_applicants;
create policy job_applicants_update on job_applicants for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists shifts_insert on shifts;
create policy shifts_insert on shifts for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));
drop policy if exists shifts_update on shifts;
create policy shifts_update on shifts for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists rosters_insert on rosters;
create policy rosters_insert on rosters for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));
drop policy if exists rosters_update on rosters;
create policy rosters_update on rosters for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists trainings_insert on trainings;
create policy trainings_insert on trainings for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));
drop policy if exists trainings_update on trainings;
create policy trainings_update on trainings for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

drop policy if exists training_participants_insert on training_participants;
create policy training_participants_insert on training_participants for insert
  with check (company_id = auth_company_id() and can_write_master('HR'));
drop policy if exists training_participants_update on training_participants;
create policy training_participants_update on training_participants for update
  using (company_id = auth_company_id() and can_write_master('HR'))
  with check (company_id = auth_company_id() and can_write_master('HR'));

-- ===== Modul INVENTORY =====

drop policy if exists warehouses_insert on warehouses;
create policy warehouses_insert on warehouses for insert
  with check (company_id = auth_company_id() and can_write_master('INVENTORY'));
drop policy if exists warehouses_update on warehouses;
create policy warehouses_update on warehouses for update
  using (company_id = auth_company_id() and can_write_master('INVENTORY'))
  with check (company_id = auth_company_id() and can_write_master('INVENTORY'));

drop policy if exists serials_insert on serials;
create policy serials_insert on serials for insert
  with check (company_id = auth_company_id() and can_write_master('INVENTORY'));
drop policy if exists serials_update on serials;
create policy serials_update on serials for update
  using (company_id = auth_company_id() and can_write_master('INVENTORY'))
  with check (company_id = auth_company_id() and can_write_master('INVENTORY'));

drop policy if exists stock_balances_insert on stock_balances;
create policy stock_balances_insert on stock_balances for insert
  with check (company_id = auth_company_id() and can_write_master('INVENTORY'));
drop policy if exists stock_balances_update on stock_balances;
create policy stock_balances_update on stock_balances for update
  using (company_id = auth_company_id() and can_write_master('INVENTORY'))
  with check (company_id = auth_company_id() and can_write_master('INVENTORY'));

drop policy if exists stock_opnames_insert on stock_opnames;
create policy stock_opnames_insert on stock_opnames for insert
  with check (company_id = auth_company_id() and can_write_master('INVENTORY'));
drop policy if exists stock_opnames_update on stock_opnames;
create policy stock_opnames_update on stock_opnames for update
  using (company_id = auth_company_id() and can_write_master('INVENTORY'))
  with check (company_id = auth_company_id() and can_write_master('INVENTORY'));

drop policy if exists stock_opname_lines_insert on stock_opname_lines;
create policy stock_opname_lines_insert on stock_opname_lines for insert
  with check (company_id = auth_company_id() and can_write_master('INVENTORY'));
drop policy if exists stock_opname_lines_update on stock_opname_lines;
create policy stock_opname_lines_update on stock_opname_lines for update
  using (company_id = auth_company_id() and can_write_master('INVENTORY'))
  with check (company_id = auth_company_id() and can_write_master('INVENTORY'));

-- ===== Modul OPERATIONS =====

drop policy if exists escalation_matrix_insert on escalation_matrix;
create policy escalation_matrix_insert on escalation_matrix for insert
  with check (company_id = auth_company_id() and can_write_master('OPERATIONS'));
drop policy if exists escalation_matrix_update on escalation_matrix;
create policy escalation_matrix_update on escalation_matrix for update
  using (company_id = auth_company_id() and can_write_master('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write_master('OPERATIONS'));

drop policy if exists network_elements_insert on network_elements;
create policy network_elements_insert on network_elements for insert
  with check (company_id = auth_company_id() and can_write_master('OPERATIONS'));
drop policy if exists network_elements_update on network_elements;
create policy network_elements_update on network_elements for update
  using (company_id = auth_company_id() and can_write_master('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write_master('OPERATIONS'));

drop policy if exists root_causes_insert on root_causes;
create policy root_causes_insert on root_causes for insert
  with check (company_id = auth_company_id() and can_write_master('OPERATIONS'));
drop policy if exists root_causes_update on root_causes;
create policy root_causes_update on root_causes for update
  using (company_id = auth_company_id() and can_write_master('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write_master('OPERATIONS'));

drop policy if exists knowledge_articles_insert on knowledge_articles;
create policy knowledge_articles_insert on knowledge_articles for insert
  with check (company_id = auth_company_id() and can_write_master('OPERATIONS'));
drop policy if exists knowledge_articles_update on knowledge_articles;
create policy knowledge_articles_update on knowledge_articles for update
  using (company_id = auth_company_id() and can_write_master('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write_master('OPERATIONS'));

drop policy if exists maintenance_plans_insert on maintenance_plans;
create policy maintenance_plans_insert on maintenance_plans for insert
  with check (company_id = auth_company_id() and can_write_master('OPERATIONS'));
drop policy if exists maintenance_plans_update on maintenance_plans;
create policy maintenance_plans_update on maintenance_plans for update
  using (company_id = auth_company_id() and can_write_master('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write_master('OPERATIONS'));

drop policy if exists sla_reports_insert on sla_reports;
create policy sla_reports_insert on sla_reports for insert
  with check (company_id = auth_company_id() and can_write_master('OPERATIONS'));
drop policy if exists sla_reports_update on sla_reports;
create policy sla_reports_update on sla_reports for update
  using (company_id = auth_company_id() and can_write_master('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write_master('OPERATIONS'));

-- ===== Modul PRODUCTIVITY =====

drop policy if exists job_types_insert on job_types;
create policy job_types_insert on job_types for insert
  with check (company_id = auth_company_id() and can_write_master('PRODUCTIVITY'));
drop policy if exists job_types_update on job_types;
create policy job_types_update on job_types for update
  using (company_id = auth_company_id() and can_write_master('PRODUCTIVITY'))
  with check (company_id = auth_company_id() and can_write_master('PRODUCTIVITY'));

drop policy if exists productivity_targets_insert on productivity_targets;
create policy productivity_targets_insert on productivity_targets for insert
  with check (company_id = auth_company_id() and can_write_master('PRODUCTIVITY'));
drop policy if exists productivity_targets_update on productivity_targets;
create policy productivity_targets_update on productivity_targets for update
  using (company_id = auth_company_id() and can_write_master('PRODUCTIVITY'))
  with check (company_id = auth_company_id() and can_write_master('PRODUCTIVITY'));

-- =====================================================================
-- CATATAN UNTUK OPERASIONAL
-- Tabel transaksi yang SENGAJA tetap bisa ditulis peran lapangan:
--   attendances, leave_requests, overtime_requests, business_trips,
--   trip_expenses, employee_advances, material_requests,
--   material_request_items, material_usages, stock_movements,
--   serial_movements, tickets, ticket_activities, ticket_sla_events,
--   work_orders, wo_checklists, work_permits, hse_incidents,
--   hse_inspections, maintenance_tasks, nms_alarms, productivity_entries,
--   attachments.
-- Kalau nanti teknisi perlu mengunggah sertifikat sendiri, jangan longgarkan
-- employee_certifications untuk semua -- tambahkan policy self-scope terpisah
-- (pola migrasi 0025) yang hanya mengizinkan baris employee_id = auth_employee_id().
-- =====================================================================
