-- =====================================================================
-- 0015_seed_transaksi_demo.sql — Seed data transaksi 6 bulan (Apr-Sep 2026)
-- Context: mitra Telkom Akses wilayah Sumatera bagian tengah
-- CATATAN: tidak membuat auth user/password apa pun di sini.
-- Deterministic random via setseed(); generate_series untuk volume.
-- =====================================================================

select setseed(0.4242);

-- =====================================================================
-- PART 0: reference temp tables (dibaca dari data master yang sudah ada)
-- =====================================================================
create temp table t_company as select id from companies limit 1;

create temp table t_branch as
  select id, code, row_number() over (order by code) as rn
  from branches;

create temp table t_wh as
  select w.id, w.code, w.branch_id, w.warehouse_type,
         row_number() over (order by w.code) as rn
  from warehouses w;

create temp table t_item as
  select id, code, category, coalesce(is_serial_tracked,false) as is_serial_tracked,
         coalesce(last_price,0) as price, uom,
         row_number() over (order by code) as rn
  from item_catalog;

create temp table t_jobtype as
  select id, code, name, category, point_weight, tariff_amount, standard_minutes,
         row_number() over (order by code) as rn
  from job_types;

create temp table t_vendor as
  select id, code, vendor_type, row_number() over (order by code) as rn
  from vendors;

create temp table t_customer as
  select id, code, row_number() over (order by code) as rn
  from customers;

create temp table t_rootcause as
  select id, code, aspect, row_number() over (order by code) as rn
  from root_causes;

create temp table t_salcomp as
  select id, code from salary_components;

create temp table t_contract0 as select id from contracts limit 1;
create temp table t_spk0 as select id from spk limit 1;
create temp table t_project0 as select id from projects limit 1;

-- name pools (referensi kecil untuk kombinasi nama fiktif, bukan data baris)
create temp table t_fname (i int, nm text);
insert into t_fname values
 (1,'Rian'),(2,'Dedi'),(3,'Rudi'),(4,'Agus'),(5,'Bambang'),(6,'Hendra'),(7,'Yudi'),(8,'Wahyu'),
 (9,'Anton'),(10,'Doni'),(11,'Fajar'),(12,'Irwan'),(13,'Yanto'),(14,'Herman'),(15,'Nanda'),(16,'Reza'),
 (17,'Taufik'),(18,'Rizal'),(19,'Ade'),(20,'Ilham'),(21,'Dian'),(22,'Yoga'),(23,'Arif'),(24,'Ferry'),
 (25,'Zulfikar'),(26,'Robi'),(27,'Sandi'),(28,'Hadi'),(29,'Eko'),(30,'Panji'),(31,'Wira'),(32,'Bayu'),
 (33,'Rio'),(34,'Kurnia'),(35,'Aldi'),(36,'Firman'),(37,'Gilang'),(38,'Randi'),(39,'Fikri'),(40,'Rendi'),
 (41,'Siti'),(42,'Rina'),(43,'Dewi'),(44,'Yuni'),(45,'Wulan'),(46,'Fitri'),(47,'Nova'),(48,'Lestari'),
 (49,'Ayu'),(50,'Sari');

create temp table t_lname (i int, nm text);
insert into t_lname values
 (1,'Saputra'),(2,'Hartono'),(3,'Kurniawan'),(4,'Nugroho'),(5,'Wijaya'),(6,'Gunawan'),(7,'Prasetyo'),(8,'Setiawan'),
 (9,'Pratama'),(10,'Ramadhan'),(11,'Santoso'),(12,'Hidayat'),(13,'Permana'),(14,'Firmansyah'),(15,'Suryadi'),(16,'Maulana'),
 (17,'Kusuma'),(18,'Syahputra'),(19,'Iskandar'),(20,'Effendi'),(21,'Handoko'),(22,'Wibowo'),(23,'Yulianto'),(24,'Susanto'),
 (25,'Rahman'),(26,'Halim'),(27,'Sitompul'),(28,'Siregar'),(29,'Harahap'),(30,'Nasution'),(31,'Simamora'),(32,'Chaniago'),
 (33,'Marpaung'),(34,'Rangkuti'),(35,'Lubis'),(36,'Zulkarnain'),(37,'Hakim'),(38,'Fauzi'),(39,'Ramli'),(40,'Junaidi');

select 'PART 0 OK' as status;

-- =====================================================================
-- PART 1: HR
-- =====================================================================

-- 1.1 employees: tambah 50 (total 60), NIP berurutan lanjut dari NKMT-0010
insert into employees (
  company_id, nip, full_name, gender, birth_date, phone, email, address,
  branch_id, position, unit, employment_type, join_date, contract_start, contract_end,
  status, ptkp_status, npwp, nik_ktp, bank_name, bank_account, bank_holder, bpjs_tk_no, bpjs_kes_no
)
select
  (select id from t_company),
  'NKMT-' || lpad((10 + g.i)::text, 4, '0'),
  fn.nm || ' ' || ln.nm,
  case when (g.i % 5) = 0 then 'P' else 'L' end,
  date '1985-01-01' + ((random()*8000)::int) * interval '1 day',
  '08' || (random()*4 + 5)::int || lpad((random()*99999999)::bigint::text, 8, '0'),
  lower(fn.nm) || '.' || lower(ln.nm) || (10+g.i) || '@nusakarya.co.id',
  'Jl. ' || ln.nm || ' No. ' || (1+ (g.i*7)%99) || ', ' || br.code,
  br.id,
  case
    when g.i <= 34 then 'Teknisi Lapangan'
    when g.i <= 38 then 'Mitra Teknisi'
    when g.i <= 40 then 'Dispatcher'
    when g.i <= 42 then 'Supervisor Operations'
    when g.i = 43 then 'Design Engineer'
    when g.i = 44 then 'Quality Control'
    when g.i = 45 then 'Project Manager'
    when g.i = 46 then 'Staff HR'
    when g.i = 47 then 'Staff Commerce'
    when g.i = 48 then 'Staff Procurement'
    when g.i = 49 then 'Staff Finance'
    else 'Staff Inventory'
  end,
  case
    when g.i <= 42 then 'OPERATIONS'
    when g.i <= 45 then 'DEPLOYMENT'
    when g.i = 46 then 'HR'
    when g.i = 47 then 'COMMERCE'
    when g.i = 48 then 'PROCUREMENT'
    when g.i = 49 then 'FINANCE'
    else 'INVENTORY'
  end,
  case
    when g.i <= 34 then (case when g.i % 2 = 0 then 'PKWTT' else 'PKWT' end)
    when g.i <= 38 then 'MITRA'
    else 'PKWTT'
  end,
  (date '2023-09-01' + ((g.i * 37) % 900) * interval '1 day')::date,
  (date '2023-09-01' + ((g.i * 37) % 900) * interval '1 day')::date,
  case
    when g.i <= 38 then
      (case when g.i % 10 = 0
        then current_date + (5 + (g.i % 50)) * interval '1 day'
        else current_date + (60 + (g.i * 11) % 540) * interval '1 day'
      end)::date
    else null
  end,
  'aktif',
  (array['TK/0','TK/0','TK/1','K/0','K/1','K/2','TK/2','K/3'])[1 + (g.i % 8)],
  '0' || (20+g.i) || '.345.678.9-211.000',
  '14' || lpad((1000000000 + g.i*3771)::text, 10, '0'),
  (array['BCA','BRI','Mandiri','BNI'])[1 + (g.i % 4)],
  lpad((3000000000 + g.i*98123)::text, 12, '0'),
  fn.nm || ' ' || ln.nm,
  lpad((21000000000000 + g.i*777)::text, 15, '0'),
  lpad((1000000000 + g.i*555)::text, 13, '0')
from generate_series(1,50) as g(i)
join t_fname fn on fn.i = 1 + ((g.i*7) % 50)
join t_lname ln on ln.i = 1 + ((g.i*11) % 40)
join t_branch br on br.rn = 1 + ((g.i-1) % 5);

create temp table t_emp as
  select e.id, e.nip, e.unit, e.position, e.branch_id, e.employment_type,
         (e.position in ('Teknisi Lapangan','Mitra Teknisi')) as is_tech,
         e.join_date, e.contract_end, e.status,
         row_number() over (order by e.nip) as rn
  from employees e;

create temp table t_tech as
  select *, row_number() over (order by nip) as trn from t_emp where is_tech;

select count(*) as n_employees, count(*) filter (where is_tech) as n_teknisi from t_emp;

-- 1.2 employee_certifications: BNSP fiber optic + K3 ketinggian untuk teknisi & sebagian staf ops
insert into employee_certifications (company_id, employee_id, cert_type, cert_name, cert_no, issuer, issued_date, expiry_date, status)
select
  (select id from t_company), t.id,
  case when (t.trn % 2 = 0) then 'BNSP' else 'K3' end,
  case when (t.trn % 2 = 0) then 'Sertifikasi Kompetensi Teknisi Fiber Optik (BNSP)' else 'Sertifikasi K3 Ketinggian' end,
  'CERT/' || (case when t.trn % 2 = 0 then 'BNSP' else 'K3' end) || '/2024/' || lpad(t.trn::text,4,'0'),
  case when (t.trn % 2 = 0) then 'BNSP' else 'Kemnaker RI' end,
  (date '2023-01-01' + (t.trn * 29) % 700 * interval '1 day')::date,
  (date '2023-01-01' + (t.trn * 29) % 700 * interval '1 day' + interval '3 years')::date
    - (case when t.trn % 7 = 0 then interval '3 years' - interval '20 days' else interval '0' end),
  case when t.trn % 7 = 0 then 'expired' else 'aktif' end
from t_tech t;

-- sebagian teknisi punya 2 sertifikasi (K3 tambahan)
insert into employee_certifications (company_id, employee_id, cert_type, cert_name, cert_no, issuer, issued_date, expiry_date, status)
select
  (select id from t_company), t.id, 'K3', 'Sertifikasi K3 Ketinggian', 'CERT/K3/2024/X' || lpad(t.trn::text,4,'0'),
  'Kemnaker RI',
  (date '2023-06-01' + (t.trn * 17) % 500 * interval '1 day')::date,
  (date '2023-06-01' + (t.trn * 17) % 500 * interval '1 day' + interval '2 years')::date,
  case when t.trn % 11 = 0 then 'expired' when t.trn % 13 = 0 then
      case when (date '2023-06-01' + (t.trn * 17) % 500 * interval '1 day' + interval '2 years')::date <= current_date + interval '45 days' then 'aktif' else 'aktif' end
    else 'aktif' end
from t_tech t
where t.trn % 2 = 1;

select count(*) as n_certs from employee_certifications;

-- 1.3 shifts: 3 shift
insert into shifts (company_id, code, name, start_time, end_time) values
  ((select id from t_company), 'SHIFT-PAGI', 'Shift Pagi', '07:00', '15:00'),
  ((select id from t_company), 'SHIFT-SIANG', 'Shift Siang', '15:00', '23:00'),
  ((select id from t_company), 'SHIFT-MALAM', 'Shift Malam (On-Call Gangguan)', '23:00', '07:00');

create temp table t_shift as select id, row_number() over (order by code) as rn from shifts;

select 'PART 1.1-1.3 OK' as status;

-- 1.4 attendances: 60 hari terakhir untuk seluruh teknisi (+ mitra teknisi)
insert into attendances (
  company_id, employee_id, work_date, check_in_at, check_in_lat, check_in_lng,
  check_out_at, check_out_lat, check_out_lng, shift_id, status, late_minutes, work_minutes, overtime_minutes, note
)
select
  (select id from t_company), t.id, d.work_date,
  case when st.status in ('hadir','terlambat')
    then (d.work_date + time '07:00' + (case when st.status = 'terlambat' then (st.late_min || ' minutes')::interval else interval '0' end)
          + (random()*15) * interval '1 minute')
    else null end,
  case when st.status in ('hadir','terlambat') then b.lat + (random()-0.5)*0.03 else null end,
  case when st.status in ('hadir','terlambat') then b.lng + (random()-0.5)*0.03 else null end,
  case when st.status in ('hadir','terlambat')
    then (d.work_date + time '16:00' + (random()*90) * interval '1 minute') else null end,
  case when st.status in ('hadir','terlambat') then b.lat + (random()-0.5)*0.03 else null end,
  case when st.status in ('hadir','terlambat') then b.lng + (random()-0.5)*0.03 else null end,
  sh.id,
  st.status,
  case when st.status = 'terlambat' then st.late_min else 0 end,
  case when st.status in ('hadir','terlambat') then 420 + (random()*90)::int else 0 end,
  case when st.status = 'hadir' and random() < 0.25 then (random()*90)::int else 0 end,
  case when st.status = 'alpa' then 'Tidak ada keterangan' when st.status='izin' then 'Izin keperluan pribadi' when st.status='sakit' then 'Sakit, surat dokter menyusul' else null end
from t_tech t
cross join lateral (select generate_series(0,59) as off) d0
cross join lateral (select (current_date - d0.off) as work_date) d
join branches b on b.id = t.branch_id
join t_shift sh on sh.rn = 1 + (t.trn % 3)
cross join lateral (
  select
    case
      when extract(dow from d.work_date) = 0 then
        case when random() < 0.9 then 'libur' else 'hadir' end
      when random() < 0.03 then 'alpa'
      when random() < 0.06 then 'cuti'
      when random() < 0.10 then 'sakit'
      when random() < 0.14 then 'izin'
      when random() < 0.26 then 'terlambat'
      else 'hadir'
    end as status,
    (5 + (random()*55)::int) as late_min
) st
where d.work_date >= t.join_date;

select count(*) as n_attendances from attendances;

-- 1.5 leave_requests: ~25 baris berbagai status
insert into leave_requests (company_id, employee_id, leave_type, start_date, end_date, days, reason, status, approved_at)
select
  (select id from t_company), t.id,
  (array['cuti_tahunan','sakit','izin','tanpa_keterangan','melahirkan'])[1 + (r.i % 5)],
  d_start,
  d_start + (case when (r.i % 5) = 4 then 84 else (r.i % 3) end) * interval '1 day',
  (case when (r.i % 5) = 4 then 90 else (1+(r.i % 3)) end),
  (array['Keperluan keluarga','Sakit demam','Acara adat','Tanpa keterangan','Cuti melahirkan','Urus dokumen','Istirahat'])[1 + (r.i % 7)],
  (array['diajukan','disetujui','disetujui','disetujui','ditolak','draft'])[1 + (r.i % 6)],
  case when (r.i % 6) in (1,2,3) then (d_start - interval '1 day')::timestamptz else null end
from generate_series(1,25) as r(i)
join t_emp t on t.rn = 1 + (r.i * 3) % 60
cross join lateral (
  select (date '2026-04-01' + ((r.i * 53) % 168) * interval '1 day')::date as d_start
) s
where t.join_date <= d_start;

select count(*) as n_leave from leave_requests;

select 'PART 1.4-1.5 OK' as status;

-- 1.6 employee_salaries: gaji pokok ~UMK cabang + tunjangan wajar (semua 60 karyawan)
create temp table t_umk as
  select code, umk from (values
    ('BR-BAT', 4900000), ('BR-BUK', 3000000), ('BR-DUM', 3700000), ('BR-PAD', 2950000), ('BR-PEK', 3600000)
  ) as x(code, umk);

insert into employee_salaries (company_id, employee_id, component_id, amount, effective_date)
select (select id from t_company), t.id, sc.id,
  case
    when t.position in ('Teknisi Lapangan','Mitra Teknisi') then u.umk + (t.rn * 3733) % 250000
    when t.position in ('Supervisor Operations','Design Engineer','Quality Control','Project Manager') then u.umk + 900000 + (t.rn*4111) % 400000
    else u.umk + 400000 + (t.rn*2917) % 300000
  end,
  greatest(t.join_date, date '2024-01-01')
from t_emp t
join branches b on b.id = t.branch_id
join t_umk u on u.code = b.code
join t_salcomp sc on sc.code = 'BASIC';

insert into employee_salaries (company_id, employee_id, component_id, amount, effective_date)
select (select id from t_company), t.id, sc.id, 750000, greatest(t.join_date, date '2024-01-01')
from t_emp t join t_salcomp sc on sc.code = 'TUNJ_MAKAN';

insert into employee_salaries (company_id, employee_id, component_id, amount, effective_date)
select (select id from t_company), t.id, sc.id,
  case when t.is_tech then 500000 else 400000 end,
  greatest(t.join_date, date '2024-01-01')
from t_emp t join t_salcomp sc on sc.code = 'TUNJ_TRANSPORT';

insert into employee_salaries (company_id, employee_id, component_id, amount, effective_date)
select (select id from t_company), t.id, sc.id, 150000, greatest(t.join_date, date '2024-01-01')
from t_emp t join t_salcomp sc on sc.code = 'TUNJ_PULSA'
where t.position in ('Dispatcher','Supervisor Operations','Design Engineer','Project Manager','Quality Control','Staff HR','Staff Commerce','Staff Procurement','Staff Finance','Staff Inventory');

insert into employee_salaries (company_id, employee_id, component_id, amount, effective_date)
select (select id from t_company), t.id, sc.id, 1250000, greatest(t.join_date, date '2024-01-01')
from t_emp t join t_salcomp sc on sc.code = 'TUNJ_JABATAN'
where t.position in ('Supervisor Operations','Design Engineer','Project Manager','Quality Control');

select count(*) as n_emp_salaries from employee_salaries;

select 'PART 1.6 OK' as status;

-- =====================================================================
-- PART 2: COMMERCE (kontrak/SPK dibuat lebih dulu agar bisa dirujuk modul lain)
-- =====================================================================

-- 2.1 contracts: tambah 3 (total 4)
insert into contracts (id, company_id, contract_no, contract_name, customer_id, contract_type, start_date, end_date, contract_value, retention_percent, status)
select * from (values
  (gen_random_uuid(), (select id from t_company), 'CTR/2026/00002', 'Kontrak Deployment FTTH Perluasan Cabang Batam-Pekanbaru',
    (select id from t_customer where code='CUST-TA'), 'deployment', date '2026-01-15', date '2026-12-31', 4200000000::numeric, 5::numeric, 'aktif'),
  (gen_random_uuid(), (select id from t_company), 'CTR/2026/00003', 'Kontrak Manage Service Menara & Jaringan Mitratel',
    (select id from t_customer where code='CUST-MTEL'), 'manage_service', date '2026-02-01', date '2028-01-31', 2600000000::numeric, 5::numeric, 'aktif'),
  (gen_random_uuid(), (select id from t_company), 'CTR/2026/00004', 'Kontrak Maintenance Jaringan Backbone Lintasarta',
    (select id from t_customer where code='CUST-LSAT'), 'maintenance', date '2026-03-01', date '2027-02-28', 950000000::numeric, 5::numeric, 'aktif')
) as x;

create temp table t_contract as
  select id, contract_no, contract_type, customer_id, row_number() over (order by contract_no) as rn
  from contracts;

-- 2.2 spk: tambah 11 (total 12), tersebar di 5 cabang
insert into spk (id, company_id, spk_no, contract_id, spk_date, title, scope, location, branch_id, start_date, end_date, spk_value, status)
select
  gen_random_uuid(), (select id from t_company),
  'SPK/2026/' || lpad((1+g.i)::text,5,'0'),
  c.id,
  (date '2026-01-10' + (g.i*23) * interval '1 day')::date,
  'SPK ' || c.contract_no || ' - Cabang ' || br.code,
  case c.contract_type
    when 'manage_service' then 'Pemeliharaan & penanganan gangguan jaringan FTTH wilayah ' || br.code
    when 'deployment' then 'Deployment & pemasangan jaringan baru wilayah ' || br.code
    when 'maintenance' then 'Preventive maintenance backbone wilayah ' || br.code
    else 'Pekerjaan borongan wilayah ' || br.code
  end,
  'Wilayah ' || br.code,
  br.id,
  (date '2026-01-15' + (g.i*23) * interval '1 day')::date,
  (date '2026-01-15' + (g.i*23) * interval '1 day' + interval '11 months')::date,
  350000000 + (g.i * 41000000),
  case when g.i = 11 then 'selesai' else 'aktif' end
from generate_series(1,11) as g(i)
join t_branch br on br.rn = 1 + ((g.i-1) % 5)
join t_contract c on c.rn = 1 + (g.i % 4);

create temp table t_spk as
  select s.id, s.spk_no, s.contract_id, s.branch_id, c.contract_type,
         row_number() over (order by s.spk_no) as rn
  from spk s join contracts c on c.id = s.contract_id;

-- SPK/2025/00001 lama (manage_service, cabang PEK) turut dimasukkan ke pool
create temp table t_spk_all as
  select id, spk_no, contract_id, branch_id, contract_type, row_number() over (order by spk_no) as rn from (
    select s.id, s.spk_no, s.contract_id, s.branch_id, c.contract_type from spk s join contracts c on c.id = s.contract_id
  ) z;

-- 2.3 contract_price_list: tambah 21 (total 25)
insert into contract_price_list (company_id, contract_id, job_type_id, item_code, description, uom, unit_price, is_active)
select (select id from t_company), c.id, jt.id, jt.code, jt.code || ' - ' || jt.name, 'paket',
  round(jt.tariff_amount * (1.4 + (jt.rn % 5) * 0.08), -3), true
from t_contract c
join generate_series(1,6) as jt_seq(i) on true
join t_jobtype jt on jt.rn = 1 + ((c.rn * 7 + jt_seq.i) % 22)
where c.rn <= 4
limit 21;

select count(*) as n_cpl from contract_price_list;

select 'PART 2 (contracts/spk/cpl) OK' as status;

-- =====================================================================
-- PART 3: DEPLOYMENT - projects (dibuat lebih dulu agar bisa dirujuk modul lain)
-- =====================================================================

create temp table t_pm as
  select id, row_number() over (order by nip) as rn from t_emp where position = 'Project Manager';

insert into projects (id, company_id, project_code, project_name, customer_id, contract_id, spk_id, project_type, branch_id,
  location, lat, lng, start_date, target_date, actual_finish_date, contract_value, budget_cost, progress_percent, status, pm_id, note)
select
  gen_random_uuid(), (select id from t_company),
  'PRJ/2026/' || lpad((1+g.i)::text,5,'0'),
  proj_name,
  cust.id,
  ctr.id,
  spk.id,
  ptype,
  br.id,
  'Wilayah ' || br.code,
  b.lat + (random()-0.5)*0.05, b.lng + (random()-0.5)*0.05,
  start_d, target_d, actual_d,
  cval, bcost, prog, pstatus,
  pm.id,
  'Proyek demo data 2026'
from generate_series(1,9) as g(i)
join t_branch br on br.rn = 1 + ((g.i-1) % 5)
join branches b on b.id = br.id
join t_pm pm on pm.rn = 1 + (g.i % (select count(*) from t_pm))
cross join lateral (
  select
    (array['deployment','relokasi','upgrade','recovery','manage_service'])[1 + (g.i % 5)] as ptype,
    (array['perencanaan','survey','design','approval','pelaksanaan','testing','bast','selesai','hold'])[g.i] as pstatus
) x
cross join lateral (
  select
    case when x.ptype = 'manage_service' then (select id from t_customer where code='CUST-MTEL')
         when g.i % 4 = 0 then (select id from t_customer where code='CUST-LSAT')
         else (select id from t_customer where code='CUST-TA') end as cid
) xc
join customers cust on cust.id = xc.cid
join t_contract ctr on ctr.rn = 1 + (g.i % 4)
join t_spk_all spk on spk.rn = 1 + (g.i % 12)
cross join lateral (
  select ('Deployment FTTH Cluster ' || br.code || ' Tahap ' || g.i) as proj_name,
    (date '2026-01-01' + (g.i*17) * interval '1 day')::date as start_d,
    (date '2026-01-01' + (g.i*17) * interval '1 day' + interval '5 months')::date as target_d,
    case when x.pstatus in ('selesai','bast') then (date '2026-01-01' + (g.i*17) * interval '1 day' + interval '4 months')::date else null end as actual_d,
    (600000000::numeric + g.i * 180000000) as cval,
    (450000000::numeric + g.i * 140000000) as bcost,
    case x.pstatus
      when 'perencanaan' then 5 when 'survey' then 15 when 'design' then 25 when 'approval' then 35
      when 'pelaksanaan' then 60 when 'testing' then 85 when 'bast' then 95 when 'selesai' then 100 when 'hold' then 40
      else 10 end as prog
) y;

create temp table t_project as
  select p.id, p.project_code, p.branch_id, p.customer_id, p.contract_id, p.spk_id, p.status, p.pm_id, p.contract_value,
         row_number() over (order by p.project_code) as rn
  from projects p;

select count(*) as n_projects from projects;

-- 3.1 project_milestones (bobot total 100% per proyek, 5 milestone)
insert into project_milestones (company_id, project_id, seq, milestone_name, weight_percent, plan_start, plan_end, actual_start, actual_end, progress_percent, status)
select (select id from t_company), p.id, ms.seq, ms.nm, ms.wt,
  (date '2026-01-01' + (p.rn*17) * interval '1 day' + (ms.seq-1) * interval '25 days')::date,
  (date '2026-01-01' + (p.rn*17) * interval '1 day' + ms.seq * interval '25 days')::date,
  case when ms.seq <= 3 then (date '2026-01-01' + (p.rn*17) * interval '1 day' + (ms.seq-1) * interval '25 days')::date else null end,
  case when ms.seq <= 2 then (date '2026-01-01' + (p.rn*17) * interval '1 day' + ms.seq * interval '25 days')::date else null end,
  case when ms.seq = 1 then 100 when ms.seq = 2 then 100 when ms.seq = 3 then 60 else 0 end,
  case when ms.seq = 1 then 'selesai' when ms.seq = 2 then 'selesai' when ms.seq = 3 then 'berjalan' else 'belum_mulai' end
from t_project p
cross join (values (1,'Survey & Perencanaan',10::numeric),(2,'Desain & Approval',15::numeric),
  (3,'Pengadaan Material',20::numeric),(4,'Instalasi & Konstruksi',40::numeric),(5,'Testing & BAST',15::numeric)) as ms(seq,nm,wt);

select count(*) as n_milestones from project_milestones;

select 'PART 3 (projects/milestones) OK' as status;

-- =====================================================================
-- PART 4: OPERATIONS
-- =====================================================================

-- 4.1 network_elements: tambah 50 (total 60), tersebar 5 cabang, ODC/ODP/FAT/TIANG
insert into network_elements (company_id, element_type, code, name, branch_id, sto, lat, lng, capacity, used, status, install_date)
select
  (select id from t_company), etype,
  etype || '-' || br.code_short || '-' || lpad((100+g.i)::text,3,'0'),
  etype || ' ' || br.code_short || ' ' || (100+g.i),
  br.id,
  'STO-' || br.code_short,
  b.lat + (random()-0.5)*0.08, b.lng + (random()-0.5)*0.08,
  capx.cap, usedx.used_v,
  case when g.i % 17 = 0 then 'rusak' when g.i % 23 = 0 then 'nonaktif' when usedx.used_v >= capx.cap then 'penuh' else 'aktif' end,
  (date '2024-01-01' + (g.i*13) % 700 * interval '1 day')::date
from generate_series(1,50) as g(i)
join (select id, right(code,3) as code_short, rn from t_branch) br on br.rn = 1 + ((g.i-1) % 5)
join branches b on b.id = br.id
cross join lateral (
  select
    (array['ODC','FAT','ODP','ODP','TIANG'])[1 + (g.i % 5)] as etype
) et
cross join lateral (
  select case et.etype when 'ODC' then 144 when 'FAT' then 8 when 'ODP' then 16 when 'TIANG' then 1 else 8 end as cap
) capx
cross join lateral (
  select (capx.cap * (0.3 + (( (g.i*37) % 70)/100.0)))::int as used_v
) usedx;

select count(*) as n_netel from network_elements;
select 'PART 4.1 OK' as status;

-- 4.2 work_orders: 800 baris, 6 bulan terakhir, sebaran status realistis
create temp table t_tech_by_branch as
  select id, branch_id, row_number() over (partition by branch_id order by nip) as rnb
  from t_tech;

create temp table t_wo_base as
select
  g.i,
  (select id from t_company) as company_id,
  'WO/2026/' || lpad(g.i::text,6,'0') as wo_no,
  wtype,
  br.id as branch_id,
  jt.id as job_type_id, jt.standard_minutes, jt.point_weight, jt.tariff_amount,
  sched,
  assignee.id as assigned_to,
  wstatus
from generate_series(1,800) as g(i)
join t_branch br on br.rn = 1 + ((g.i-1) % 5)
cross join lateral (
  select case
    when g.i % 20 in (0,1,2,3,4,5,6) then 'PSB'
    when g.i % 20 in (7,8) then 'MIGRASI'
    when g.i % 20 in (9,10,11,12,13,14) then 'GANGGUAN'
    when g.i % 20 in (15,16,17) then 'MAINTENANCE'
    else 'SURVEY'
  end as wtype
) wt
cross join lateral (
  select case wt.wtype
    when 'PSB' then (select id from t_jobtype where code='PSB-INDIHOME')
    when 'MIGRASI' then (select id from t_jobtype where code='PSB-MIGRASI')
    when 'GANGGUAN' then (select id from t_jobtype where code=(array['GGN-ONT','GGN-STB','GGN-WIFI','GGN-DROPCORE','FIBER-CUT','GGN-MASSAL'])[1+(g.i%6)])
    when 'MAINTENANCE' then (select id from t_jobtype where code=(array['PREV-ODC','PATROLI-RUTE','PERAPIHAN','REDAMAN-CHECK','UKUR-OTDR'])[1+(g.i%5)])
    else (select id from t_jobtype where code='SURVEY-LOKASI')
  end as jt_id
) jtx
join t_jobtype jt on jt.id = jtx.jt_id
cross join lateral (
  select (date '2026-04-01' + (g.i * 227) % 169 * interval '1 day' + ((6 + (g.i*7)%9))* interval '1 hour')::timestamptz as sched
) schedx
join t_tech_by_branch assignee on assignee.branch_id = br.id
  and assignee.rnb = 1 + (g.i % (select count(*) from t_tech_by_branch tb2 where tb2.branch_id = br.id))
cross join lateral (
  select case
    when g.i % 100 < 64 then 'done'
    when g.i % 100 < 73 then 'failed'
    when g.i % 100 < 78 then 'cancelled'
    when g.i % 100 < 86 then 'on_progress'
    when g.i % 100 < 91 then 'dispatched'
    when g.i % 100 < 95 then 'accepted'
    when g.i % 100 < 98 then 'pending_material'
    else 'draft'
  end as wstatus
) wsx;

insert into work_orders (
  company_id, wo_no, wo_type, job_type_id, title, description, customer_name, customer_no,
  address, lat, lng, branch_id, scheduled_at, assigned_to, assigned_at, started_at, finished_at,
  duration_minutes, status, fail_reason, result_note, evidence_count, points, amount, qc_status
)
select
  b.company_id, b.wo_no, b.wtype, b.job_type_id,
  b.wtype || ' - ' || (select name from job_types where id=b.job_type_id),
  'Pekerjaan ' || b.wtype || ' pelanggan area ' || br2.code,
  'Pelanggan ' || lpad(b.i::text,5,'0'),
  '3' || lpad(b.i::text,7,'0'),
  'Jl. Merdeka No. ' || (1+(b.i%150)) || ', ' || br2.code,
  brt.lat + (random()-0.5)*0.06, brt.lng + (random()-0.5)*0.06,
  b.branch_id,
  b.sched,
  b.assigned_to,
  b.sched - (random()*2) * interval '1 hour',
  case when b.wstatus in ('accepted','on_progress','pending_material','done','failed')
    then b.sched + (random()*2) * interval '1 hour' else null end,
  case when b.wstatus in ('done','failed')
    then b.sched + (random()*2) * interval '1 hour'
       + (greatest(30, coalesce(b.standard_minutes,60) * (case when b.wstatus='failed' then 0.5 else (0.8+random()*0.5) end))::int || ' minutes')::interval
    else null end,
  case when b.wstatus in ('done','failed')
    then greatest(20, (coalesce(b.standard_minutes,60) * (case when b.wstatus='failed' then 0.5 else (0.8+random()*0.5) end))::int)
    else null end,
  b.wstatus,
  case when b.wstatus = 'failed' then
    (array['Pelanggan tidak ada di lokasi','Material tidak tersedia','Redaman melebihi standar','Akses lokasi tertutup','Perangkat pelanggan rusak berat','Cuaca tidak memungkinkan'])[1+(b.i%6)]
  else null end,
  case when b.wstatus = 'done' then 'Pekerjaan selesai sesuai SOP, hasil ukur normal.'
       when b.wstatus = 'failed' then 'Pekerjaan tidak dapat diselesaikan, dijadwalkan ulang.'
       else null end,
  case when b.wstatus in ('done','failed') then 3 + (b.i % 6) else (b.i % 2) end,
  case when b.wstatus = 'done' then b.point_weight else 0 end,
  case when b.wstatus = 'done' then b.tariff_amount else 0 end,
  case when b.wstatus = 'done' then (array['lulus','lulus','lulus','tidak_lulus'])[1+(b.i%4)]
       when b.wstatus = 'failed' then 'tidak_lulus'
       else 'belum' end
from t_wo_base b
join t_branch brr on brr.id = b.branch_id
join (select id, code from branches) br2 on br2.id = b.branch_id
join branches brt on brt.id = b.branch_id;

create temp table t_wo as
  select id, wo_no, wo_type, branch_id, status, assigned_to, job_type_id, finished_at,
         row_number() over (order by wo_no) as rn
  from work_orders;

select count(*) as n_wo, count(*) filter (where status='done') as n_done from work_orders;
select 'PART 4.2 OK' as status;

-- 4.3 tickets: 350 baris, keparahan bervariasi, SLA & root cause konsisten
create temp table t_ne_by_branch as
  select id, branch_id, row_number() over (partition by branch_id order by code) as rnb
  from network_elements;

create temp table t_ticket_base as
select
  g.i,
  (select id from t_company) as company_id,
  'TKT/2026/' || lpad(g.i::text,6,'0') as ticket_no,
  (array['pelanggan','pelanggan','pelanggan','nms','nms','preventive','internal','principal'])[1+(g.i%8)] as src,
  (array['gangguan','gangguan','gangguan','gangguan','gangguan','keluhan','request','massal'])[1+(g.i%8)] as ttype,
  (array['kritis','tinggi','tinggi','sedang','sedang','sedang','rendah','rendah'])[1+(g.i%8)] as sev,
  br.id as branch_id,
  case
    when g.i % 20 < 13 then 'closed'
    when g.i % 20 < 20 then 'resolved'
    else 'open'
  end as base_status_pool,
  (array['closed','resolved','on_progress','pending','assigned','open','cancelled'])[
    case when g.i % 100 < 40 then 1 when g.i % 100 < 65 then 2 when g.i % 100 < 75 then 3
         when g.i % 100 < 80 then 4 when g.i % 100 < 85 then 5 when g.i % 100 < 95 then 6 else 7 end
  ] as tstatus
from generate_series(1,350) as g(i)
join t_branch br on br.rn = 1 + ((g.i-1) % 5);

insert into tickets (
  company_id, ticket_no, source, ticket_type, customer_name, customer_no, customer_phone, address, lat, lng,
  branch_id, network_element_id, category, sub_category, severity, reported_at, sla_minutes, sla_due_at,
  responded_at, resolved_at, closed_at, ttr_minutes, sla_status, status, assigned_to, root_cause_id, description
)
select
  tb.company_id, tb.ticket_no, tb.src, tb.ttype,
  'Pelanggan ' || lpad(tb.i::text,5,'0'), '3' || lpad((tb.i+9000)::text,7,'0'),
  '08' || (5 + tb.i%4) || lpad((tb.i*12345)::text,8,'0'),
  'Jl. Diponegoro No. ' || (1+(tb.i%120)) || ', ' || br2.code,
  brt.lat + (random()-0.5)*0.07, brt.lng + (random()-0.5)*0.07,
  tb.branch_id,
  ne.id,
  case tb.ttype when 'gangguan' then 'Jaringan' when 'keluhan' then 'Layanan' when 'request' then 'Permintaan' else 'Massal' end,
  case tb.sev when 'kritis' then 'Total Loss' when 'tinggi' then 'Redaman Tinggi' else 'Gangguan Ringan' end,
  tb.sev,
  reported,
  slamin,
  reported + (slamin || ' minutes')::interval,
  case when tb.tstatus in ('closed','resolved','on_progress','pending') then reported + (5 + random()*55) * interval '1 minute' else null end,
  case when tb.tstatus in ('closed','resolved') then resolved_calc else null end,
  case when tb.tstatus = 'closed' then resolved_calc + (random()*2) * interval '1 day' else null end,
  case when tb.tstatus in ('closed','resolved') then extract(epoch from (resolved_calc - reported))/60 else null end,
  case
    when tb.tstatus in ('closed','resolved') then (case when extract(epoch from (resolved_calc - reported))/60 <= slamin then 'met' else 'breach' end)
    when tb.tstatus in ('open','assigned','on_progress','pending') then
      (case when extract(epoch from (now() - reported))/60 > slamin then 'breach'
            when extract(epoch from (now() - reported))/60 > slamin*0.7 then 'warning'
            else 'on_track' end)
    else 'on_track'
  end,
  tb.tstatus,
  asg.id,
  case when tb.tstatus in ('closed','resolved') then rc.id else null end,
  'Laporan ' || tb.ttype || ' tingkat ' || tb.sev || ' dari ' || tb.src
from t_ticket_base tb
join (select id, code from branches) br2 on br2.id = tb.branch_id
join branches brt on brt.id = tb.branch_id
join t_ne_by_branch ne on ne.branch_id = tb.branch_id
  and ne.rnb = 1 + (tb.i % (select count(*) from t_ne_by_branch n2 where n2.branch_id = tb.branch_id))
join t_tech_by_branch asg on asg.branch_id = tb.branch_id
  and asg.rnb = 1 + ((tb.i*3) % (select count(*) from t_tech_by_branch tb2 where tb2.branch_id = tb.branch_id))
join t_rootcause rc on rc.rn = 1 + (tb.i % 16)
cross join lateral (
  select case tb.sev when 'kritis' then 240 when 'tinggi' then 480 when 'sedang' then 1440 else 2880 end as slamin
) slax
cross join lateral (
  select case when tb.tstatus in ('closed','resolved')
    then (date '2026-04-01' + (tb.i * 131) % 169 * interval '1 day' + ((6 + (tb.i*11)%12))* interval '1 hour')::timestamptz
    else (now() - ((tb.i % 12) || ' days')::interval - ((tb.i%10)||' hours')::interval)
  end as reported
) repx
cross join lateral (
  select repx.reported + (
    (case
      when tb.i % 5 = 0 then (slax.slamin * (1.1 + random()*0.6))::int  -- breach
      else (slax.slamin * (0.2 + random()*0.7))::int                    -- met
    end) || ' minutes')::interval as resolved_calc
) rcalc;

create temp table t_ticket as
  select id, ticket_no, branch_id, status, ticket_type, reported_at, resolved_at, row_number() over (order by ticket_no) as rn
  from tickets;

select count(*) as n_tickets from tickets;
select 'PART 4.3 OK' as status;

-- 4.4 kaitkan sebagian WO tipe GANGGUAN dengan tiket (per cabang)
with wo_g as (
  select id, branch_id, row_number() over (partition by branch_id order by wo_no) as rn
  from work_orders where wo_type = 'GANGGUAN'
), tk_g as (
  select id, branch_id, row_number() over (partition by branch_id order by ticket_no) as rn
  from tickets where ticket_type = 'gangguan'
)
update work_orders w set ticket_id = tk.id
from wo_g, tk_g tk
where w.id = wo_g.id and tk.branch_id = wo_g.branch_id and tk.rn = wo_g.rn;

-- 4.5 ticket_activities: 2 per tiket resolved/closed
insert into ticket_activities (company_id, ticket_id, activity_type, note, lat, lng, created_by, created_at)
select (select id from t_company), t.id, 'dispatch', 'Teknisi dikirim ke lokasi pelanggan untuk penanganan.', null, null, null, t.reported_at + interval '10 minutes'
from t_ticket t where t.status in ('resolved','closed');

insert into ticket_activities (company_id, ticket_id, activity_type, note, lat, lng, created_by, created_at)
select (select id from t_company), t.id, 'resolusi', 'Gangguan berhasil ditangani, layanan pulih normal.', null, null, null, coalesce(t.resolved_at, t.reported_at + interval '2 hours')
from t_ticket t where t.status in ('resolved','closed');

select count(*) as n_ticket_act from ticket_activities;

-- 4.6 ticket_sla_events: pause/resume untuk sebagian tiket (~30%)
insert into ticket_sla_events (company_id, ticket_id, event_type, reason, event_at)
select (select id from t_company), t.id, 'pause', 'Menunggu material NTE dari gudang', t.reported_at + interval '30 minutes'
from t_ticket t where t.rn % 3 = 0 and t.status in ('resolved','closed');

insert into ticket_sla_events (company_id, ticket_id, event_type, reason, event_at)
select (select id from t_company), t.id, 'resume', 'Material tersedia, penanganan dilanjutkan', t.reported_at + interval '90 minutes'
from t_ticket t where t.rn % 3 = 0 and t.status in ('resolved','closed');

select count(*) as n_sla_events from ticket_sla_events;

-- 4.7 maintenance_plans (8) + maintenance_tasks
insert into maintenance_plans (company_id, plan_no, plan_name, plan_type, frequency, branch_id, network_element_id, next_due_date, assigned_to, is_active)
select
  (select id from t_company),
  'MP/2026/' || lpad(g.i::text,4,'0'),
  (array['Preventive ODC','Patroli Rute Kabel','Perapihan Kabel Udara','Pengukuran Redaman Rutin','Preventive ODC Zona 2','Patroli Rute Backbone','Perapihan Tiang','Preventive ODC Zona 3'])[g.i],
  (array['preventive','patroli','perapihan','pengukuran','preventive','patroli','perapihan','preventive'])[g.i],
  (array['bulanan','mingguan','bulanan','triwulan','bulanan','mingguan','semester','bulanan'])[g.i],
  br.id,
  ne.id,
  (date '2026-09-01' + g.i * interval '3 days')::date,
  asg.id,
  true
from generate_series(1,8) as g(i)
join t_branch br on br.rn = 1 + ((g.i-1) % 5)
join t_ne_by_branch ne on ne.branch_id = br.id and ne.rnb = 1 + (g.i % (select count(*) from t_ne_by_branch n2 where n2.branch_id = br.id))
join t_tech_by_branch asg on asg.branch_id = br.id and asg.rnb = 1 + (g.i % (select count(*) from t_tech_by_branch tb2 where tb2.branch_id = br.id));

create temp table t_mplan as select id, row_number() over (order by plan_no) as rn from maintenance_plans;

insert into maintenance_tasks (company_id, plan_id, task_date, assigned_to, status, started_at, finished_at, findings, note)
select
  (select id from t_company), mp.id,
  d.task_date,
  asg.id,
  case when d.task_date < current_date then (case when g.k % 9 = 0 then 'terlewat' else 'selesai' end)
       when d.task_date = current_date then 'berjalan'
       else 'terjadwal' end,
  case when d.task_date <= current_date then (d.task_date + time '08:00')::timestamptz else null end,
  case when d.task_date < current_date and g.k % 9 <> 0 then (d.task_date + time '11:00')::timestamptz else null end,
  case when d.task_date < current_date and g.k % 9 <> 0 then 'Kondisi perangkat baik, redaman dalam batas normal.' else null end,
  null
from t_mplan mp
join generate_series(1,12) as g(k) on true
join t_tech asg on asg.trn = 1 + ((mp.rn*7+g.k) % (select count(*) from t_tech))
cross join lateral (
  select (date '2026-04-05' + (mp.rn*5 + g.k*15) * interval '1 day')::date as task_date
) d;

select count(*) as n_mtask from maintenance_tasks;
select 'PART 4.4-4.7 OK' as status;


-- =====================================================================
-- PART 5: HR - PAYROLL & PRODUCTIVITY
-- =====================================================================

-- 5.0 payroll_periods: 6 bulan (Apr-Agu 'dibayar', Sep 'draft')
create temp table t_pperiod (rn int, period_code text, start_date date, end_date date, pay_date date, status text);
insert into t_pperiod values
 (1,'2026-04','2026-04-01','2026-04-30','2026-05-05','dibayar'),
 (2,'2026-05','2026-05-01','2026-05-31','2026-06-05','dibayar'),
 (3,'2026-06','2026-06-01','2026-06-30','2026-07-05','dibayar'),
 (4,'2026-07','2026-07-01','2026-07-31','2026-08-05','dibayar'),
 (5,'2026-08','2026-08-01','2026-08-31','2026-09-05','dibayar'),
 (6,'2026-09','2026-09-01','2026-09-30',null,'draft');

insert into payroll_periods (company_id, period_code, start_date, end_date, pay_date, status)
select (select id from t_company), period_code, start_date, end_date, pay_date, status from t_pperiod;

create temp table t_pp as
  select id, period_code, start_date, end_date, pay_date, status, row_number() over (order by period_code) as rn
  from payroll_periods;

select count(*) as n_payroll_periods from payroll_periods;
select 'PART 5.0 OK' as status;

-- 5.1 productivity_targets: target bulanan per teknisi
insert into productivity_targets (company_id, employee_id, position, period_code, target_points)
select (select id from t_company), t.id, t.position, pp.period_code,
  case when t.position = 'Teknisi Lapangan' then 100 + (t.trn % 5) * 10 else 70 + (t.trn % 5) * 10 end
from t_tech t
cross join t_pp pp;

select count(*) as n_prod_targets from productivity_targets;

-- 5.2 productivity_entries: dari work_order status 'done'
insert into productivity_entries (company_id, employee_id, work_date, job_type_id, work_order_id, qty, points, amount, status)
select (select id from t_company), w.assigned_to, w.finished_at::date, w.job_type_id, w.id, 1, w.points, w.amount,
  case
    when w.finished_at::date <= date '2026-08-31' then 'dibayar'
    when w.finished_at::date <= date '2026-09-10' then 'diverifikasi'
    else 'draft'
  end
from work_orders w
where w.status = 'done' and w.assigned_to is not null and w.finished_at is not null;

select count(*) as n_prod_entries from productivity_entries;
select 'PART 5.1-5.2 OK' as status;

-- 5.3 payroll_runs: 1 baris per karyawan per periode (60 x 6 = 360)
create temp table t_emp_base as
  select employee_id, sum(amount) as base_gross from employee_salaries group by employee_id;

create temp table t_ot_by_period as
  select a.employee_id, pp.id as period_id, pp.rn,
    sum(coalesce(a.overtime_minutes,0)) as ot_minutes
  from attendances a
  join t_pp pp on a.work_date between pp.start_date and pp.end_date
  group by a.employee_id, pp.id, pp.rn;

create temp table t_prod_by_period as
  select e.employee_id, pp.id as period_id, pp.rn,
    sum(e.amount) as prod_amt
  from productivity_entries e
  join t_pp pp on e.work_date between pp.start_date and pp.end_date
  group by e.employee_id, pp.id, pp.rn;

create temp table t_payroll_calc as
  select t.id as employee_id, pp.id as period_id, pp.rn as prn, pp.status as pstatus, pp.pay_date,
    eb.base_gross,
    (coalesce(ot.ot_minutes,0) * 416.67)::numeric as overtime_amount,
    coalesce(pr.prod_amt,0)::numeric as productivity_amount
  from t_emp t
  cross join t_pp pp
  join t_emp_base eb on eb.employee_id = t.id
  left join t_ot_by_period ot on ot.employee_id = t.id and ot.period_id = pp.id
  left join t_prod_by_period pr on pr.employee_id = t.id and pr.period_id = pp.id;

create temp table t_payroll_final as
  select *,
    (base_gross + overtime_amount + productivity_amount) as gross,
    round((base_gross + overtime_amount + productivity_amount) * 0.85, -2) as taxable_gross
  from t_payroll_calc;

create temp table t_payroll_run as
with ins as (
  insert into payroll_runs (
    company_id, period_id, employee_id, gross, taxable_gross,
    bpjs_jht_company, bpjs_jht_employee, bpjs_jkk, bpjs_jkm, bpjs_jp_company, bpjs_jp_employee,
    bpjs_kes_company, bpjs_kes_employee, overtime_amount, productivity_amount, thr_amount,
    pph21_amount, other_deduction, net_pay, status, paid_at
  )
  select
    (select id from t_company), pf.period_id, pf.employee_id,
    round(pf.gross,0), round(pf.taxable_gross,0),
    round(pf.taxable_gross*0.037,0), round(pf.taxable_gross*0.02,0),
    round(pf.taxable_gross*0.0024,0), round(pf.taxable_gross*0.003,0),
    round(pf.taxable_gross*0.02,0), round(pf.taxable_gross*0.01,0),
    round(pf.taxable_gross*0.04,0), round(pf.taxable_gross*0.01,0),
    round(pf.overtime_amount,0), round(pf.productivity_amount,0), 0,
    round(pf.taxable_gross*0.02,0),
    case when pf.prn % 7 = 0 then round(pf.taxable_gross*0.01,0) else 0 end,
    round(pf.gross
      - round(pf.taxable_gross*0.02,0) - round(pf.taxable_gross*0.01,0) - round(pf.taxable_gross*0.01,0)
      - round(pf.taxable_gross*0.02,0)
      - (case when pf.prn % 7 = 0 then round(pf.taxable_gross*0.01,0) else 0 end)
    ,0),
    pf.pstatus,
    case when pf.pstatus = 'dibayar' then (pf.pay_date + time '10:00')::timestamptz else null end
  from t_payroll_final pf
  returning id, employee_id, period_id, overtime_amount, productivity_amount,
    bpjs_jht_employee, bpjs_jp_employee, bpjs_kes_employee, pph21_amount, other_deduction
)
select * from ins;

select count(*) as n_payroll_runs from payroll_runs;

-- 5.4 payroll_run_lines
insert into payroll_run_lines (company_id, run_id, component_id, component_name, component_type, amount)
select (select id from t_company), pr.id, sc.id, sc.name, sc.component_type, es.amount
from t_payroll_run pr
join employee_salaries es on es.employee_id = pr.employee_id
join salary_components sc on sc.id = es.component_id;

insert into payroll_run_lines (company_id, run_id, component_id, component_name, component_type, amount)
select (select id from t_company), pr.id, sc.id, sc.name, 'earning', pr.overtime_amount
from t_payroll_run pr join salary_components sc on sc.code = 'LEMBUR'
where pr.overtime_amount > 0;

insert into payroll_run_lines (company_id, run_id, component_id, component_name, component_type, amount)
select (select id from t_company), pr.id, sc.id, sc.name, 'earning', pr.productivity_amount
from t_payroll_run pr join salary_components sc on sc.code = 'INSENTIF_PROD'
where pr.productivity_amount > 0;

insert into payroll_run_lines (company_id, run_id, component_id, component_name, component_type, amount)
select (select id from t_company), pr.id, sc.id, sc.name, 'deduction', (pr.bpjs_jht_employee + pr.bpjs_jp_employee)
from t_payroll_run pr join salary_components sc on sc.code = 'POT_BPJS_TK'
where (pr.bpjs_jht_employee + pr.bpjs_jp_employee) > 0;

insert into payroll_run_lines (company_id, run_id, component_id, component_name, component_type, amount)
select (select id from t_company), pr.id, sc.id, sc.name, 'deduction', pr.bpjs_kes_employee
from t_payroll_run pr join salary_components sc on sc.code = 'POT_BPJS_KES'
where pr.bpjs_kes_employee > 0;

insert into payroll_run_lines (company_id, run_id, component_id, component_name, component_type, amount)
select (select id from t_company), pr.id, sc.id, sc.name, 'deduction', pr.pph21_amount
from t_payroll_run pr join salary_components sc on sc.code = 'POT_PPH21'
where pr.pph21_amount > 0;

insert into payroll_run_lines (company_id, run_id, component_id, component_name, component_type, amount)
select (select id from t_company), pr.id, sc.id, sc.name, 'deduction', pr.other_deduction
from t_payroll_run pr join salary_components sc on sc.code = 'POT_PINJAMAN'
where pr.other_deduction > 0;

select count(*) as n_payroll_run_lines from payroll_run_lines;
select 'PART 5.3-5.4 OK' as status;


-- =====================================================================
-- PART 6: INVENTORY
-- =====================================================================

create temp table t_moveitem as
  select id, code, category, is_serial_tracked, price, uom, row_number() over (order by code) as rn
  from t_item
  where category in ('NTE','NON_NTE');

create temp table t_nte_item as
  select id, code, price, row_number() over (order by code) as rn
  from t_item where category = 'NTE';

create temp table t_wh_branch as
  select id, code, branch_id, row_number() over (order by code) as rn
  from t_wh where warehouse_type = 'branch';

create temp table t_emp_by_branch as
  select id, branch_id, position, row_number() over (partition by branch_id order by nip) as rnb
  from t_emp;

create temp table t_wo_by_branch as
  select id, branch_id, wo_no, wo_type, status, finished_at, assigned_to,
    row_number() over (partition by branch_id order by wo_no) as rnb
  from work_orders;

-- pool user auth.users yang sudah ada (akun role, bukan akun baru) untuk kolom *_id yang FK ke auth.users
create temp table t_authuser as
  select id, row_number() over (order by full_name) as rn from profiles;

-- 6.1a stock_movements: GR (3 event per gudang x item)
insert into stock_movements (company_id, move_no, move_date, move_type, item_id, qty, uom, from_warehouse_id, to_warehouse_id, ref_type, ref_id, work_order_id, price, note)
select
  (select id from t_company),
  'SM/2026/GR/' || lpad((row_number() over (order by wh.rn, mi.rn, ev.seq))::text,6,'0'),
  (date '2026-04-01' + ((wh.rn*7 + mi.rn*3 + ev.seq*11) % 175) * interval '1 day')::date,
  'GR',
  mi.id,
  case when mi.category = 'NTE' then (10 + (wh.rn+mi.rn+ev.seq*3) % 15)
       else (80 + (wh.rn*13+mi.rn*7+ev.seq*17) % 150) end,
  mi.uom,
  null,
  wh.id,
  'INITIAL_STOCK',
  null,
  null,
  mi.price,
  'Penerimaan stok ' || mi.code || ' - ' || wh.code
from t_wh wh
cross join t_moveitem mi
cross join generate_series(1,3) as ev(seq);

select count(*) as n_sm_gr from stock_movements where move_type = 'GR';

-- 6.1b stock_movements: ISSUE (gudang cabang -> work order)
insert into stock_movements (company_id, move_no, move_date, move_type, item_id, qty, uom, from_warehouse_id, to_warehouse_id, ref_type, ref_id, work_order_id, price, note)
select
  (select id from t_company),
  'SM/2026/ISU/' || lpad((row_number() over (order by wh.rn, mi.rn, ev.seq))::text,6,'0'),
  (date '2026-04-10' + ((wh.rn*11+mi.rn*5+ev.seq*19) % 165) * interval '1 day')::date,
  'ISSUE',
  mi.id,
  case when mi.category = 'NTE' then (1 + (wh.rn+mi.rn+ev.seq) % 4)
       else (5 + (wh.rn*11+mi.rn*5+ev.seq*7) % 40) end,
  mi.uom,
  wh.id,
  null,
  'WO',
  wo.id,
  wo.id,
  mi.price,
  'Pemakaian material ' || mi.code || ' - WO ' || wo.wo_no
from t_wh_branch wh
cross join t_moveitem mi
cross join generate_series(1,2) as ev(seq)
join t_wo_by_branch wo on wo.branch_id = wh.branch_id
  and wo.rnb = 1 + ((wh.rn*31+mi.rn*17+ev.seq*53) % (select count(*) from t_wo_by_branch w2 where w2.branch_id = wh.branch_id));

select count(*) as n_sm_issue from stock_movements where move_type = 'ISSUE';
select count(*) as n_stock_balances from stock_balances;
select 'PART 6.1 OK' as status;

-- 6.2 serials: ~400 untuk item ONT/STB (NTE)
insert into serials (company_id, item_id, serial_no, mac_address, status, warehouse_id, holder_employee_id, customer_ref, work_order_id, install_date, warranty_until, principal, is_consignment, note)
select
  (select id from t_company),
  ni.id,
  'SN' || lpad(g.i::text,8,'0'),
  case when g.i % 3 = 0 then lpad(lpad(to_hex(g.i*997),12,'0'),12,'0') else null end,
  sx.sstatus,
  wh.id,
  case when sx.sstatus = 'issued' then tech.id else null end,
  case when sx.sstatus = 'installed' then 'CUST-' || lpad(g.i::text,6,'0') else null end,
  case when sx.sstatus = 'installed' then wo.id else null end,
  case when sx.sstatus = 'installed' then wo.finished_at::date else null end,
  case when sx.sstatus = 'installed' then (wo.finished_at::date + interval '1 year')::date else null end,
  case ni.rn when 1 then 'Fiberhome' when 2 then 'Huawei' when 3 then 'ZTE' when 4 then 'Generic' else 'ZTE' end,
  false,
  null
from generate_series(1,400) as g(i)
join t_nte_item ni on ni.rn = 1 + ((g.i-1) % 5)
join t_wh_branch wh on wh.rn = 1 + ((g.i-1) % 5)
cross join lateral (
  select case when g.i % 10 < 5 then 'installed' when g.i % 10 < 8 then 'issued' else 'in_stock' end as sstatus
) sx
left join t_tech_by_branch tech on sx.sstatus = 'issued' and tech.branch_id = wh.branch_id
  and tech.rnb = 1 + (g.i % (select count(*) from t_tech_by_branch tb2 where tb2.branch_id = wh.branch_id))
left join t_wo_by_branch wo on sx.sstatus = 'installed' and wo.branch_id = wh.branch_id and wo.wo_type in ('PSB','MIGRASI') and wo.status = 'done'
  and wo.rnb = 1 + (g.i % greatest(1,(select count(*) from t_wo_by_branch w2 where w2.branch_id = wh.branch_id and w2.wo_type in ('PSB','MIGRASI') and w2.status = 'done')));

select count(*) as n_serials from serials;
select 'PART 6.2 OK' as status;

-- 6.3 material_requests (~40) + items
insert into material_requests (company_id, mr_no, request_date, requester_id, warehouse_id, work_order_id, project_id, purpose, status, note)
select
  (select id from t_company),
  'MR/2026/' || lpad(g.i::text,5,'0'),
  (date '2026-04-01' + ((g.i*37) % 170) * interval '1 day')::date,
  req.id,
  wh.id,
  case when g.i % 3 = 0 then wo.id else null end,
  case when g.i % 5 = 0 then proj.id else null end,
  case when g.i % 3 = 0 then 'Material untuk penyelesaian work order' else 'Material untuk kebutuhan proyek deployment' end,
  (array['draft','diajukan','disetujui','disetujui','dikeluarkan','dikeluarkan','ditolak','selesai'])[1 + (g.i % 8)],
  null
from generate_series(1,40) as g(i)
join t_branch br on br.rn = 1 + ((g.i-1) % 5)
join t_wh_branch wh on wh.branch_id = br.id
join t_authuser req on req.rn = 1 + (g.i % (select count(*) from t_authuser))
join t_wo_by_branch wo on wo.branch_id = br.id and wo.rnb = 1 + (g.i % (select count(*) from t_wo_by_branch w2 where w2.branch_id = br.id))
join t_project proj on proj.rn = 1 + (g.i % 10);

create temp table t_mr as select id, mr_no, status, row_number() over (order by mr_no) as rn from material_requests;

insert into material_request_items (company_id, mr_id, item_id, qty_request, qty_approved, qty_issued, uom, note)
select
  (select id from t_company), mr.id, mi.id,
  qreq,
  case when mr.status in ('disetujui','dikeluarkan','selesai') then qreq else 0 end,
  case when mr.status in ('dikeluarkan','selesai') then qreq else 0 end,
  mi.uom,
  null
from t_mr mr
cross join generate_series(1,3) as k(seq)
join t_moveitem mi on mi.rn = 1 + ((mr.rn*5 + k.seq*7) % 20)
cross join lateral (
  select (case when mi.category = 'NTE' then 2 + (mr.rn+k.seq) % 5 else 10 + (mr.rn*3+k.seq*11) % 60 end)::numeric as qreq
) qx;

select count(*) as n_mr from material_requests;
select count(*) as n_mr_items from material_request_items;
select 'PART 6.3 OK' as status;

-- 6.4 material_usages: dari work order done (PSB/MIGRASI/GANGGUAN), sebagian melebihi toleransi
insert into material_usages (company_id, work_order_id, project_id, boq_item_id, item_id, qty_plan, qty_actual, variance, variance_percent, is_over_tolerance, note, reported_by, reported_at)
select
  (select id from t_company), w.id, null, null, mi.id,
  qplan,
  qactual,
  (qactual - qplan),
  round(((qactual - qplan) / qplan) * 100, 1),
  (abs((qactual - qplan) / qplan) > 0.10),
  'Pemakaian material aktual di lapangan',
  null,
  w.finished_at
from t_wo w
cross join (select id, code from item_catalog where code = 'NTE-ONT-ZTE-F670L') mi_ont
cross join (select id, code from item_catalog where code = 'NON-DROPCORE-1CORE') mi_drop
cross join lateral (
  select case when w.wo_type in ('PSB','MIGRASI') then mi_ont.id else mi_drop.id end as item_id
) mix
join item_catalog mi on mi.id = mix.item_id
cross join lateral (
  select (case when w.wo_type in ('PSB','MIGRASI') then 1 else 20 end)::numeric as qplan
) qp
cross join lateral (
  select (case
    when w.wo_type in ('PSB','MIGRASI') then (case when random() < 0.15 then 2 else 1 end)
    else round((20 * (0.85 + random()*0.4))::numeric, 1)
  end)::numeric as qactual
) qa
where w.status = 'done' and w.wo_type in ('PSB','MIGRASI','GANGGUAN') and w.rn % 2 = 0
  and w.finished_at is not null;

select count(*) as n_mat_usage from material_usages;
select count(*) filter (where is_over_tolerance) as n_mat_usage_over from material_usages;
select 'PART 6.4 OK' as status;

-- 6.5 stock_opnames (1, selesai) + lines dengan variance, ambil dari stock_balances aktual
insert into stock_opnames (company_id, opname_no, opname_date, warehouse_id, status, pic_id, note)
select (select id from t_company), 'SO/2026/00001', date '2026-09-15', wh.id, 'selesai', pic.id, 'Stock opname akhir periode September 2026'
from t_wh_branch wh
join t_authuser pic on pic.rn = 1 + (5 % (select count(*) from t_authuser))
where wh.rn = 5;

create temp table t_so as select id, warehouse_id from stock_opnames limit 1;

insert into stock_opname_lines (company_id, opname_id, item_id, qty_system, qty_physical, variance, variance_value, reason)
select
  (select id from t_company), so.id, sb.item_id, sb.qty,
  round(sb.qty * (1 + (((row_number() over (order by sb.item_id)) % 7) - 3) * 0.02), 0),
  round(sb.qty * (((row_number() over (order by sb.item_id)) % 7) - 3) * 0.02, 0),
  round(sb.qty * (((row_number() over (order by sb.item_id)) % 7) - 3) * 0.02, 0) * coalesce(mi.last_price,0),
  case when ((row_number() over (order by sb.item_id)) % 7) = 3 then null
       when ((row_number() over (order by sb.item_id)) % 7) < 3 then 'Selisih kurang - dugaan susut/hilang'
       else 'Selisih lebih - dugaan kesalahan catat sebelumnya' end
from t_so so
join stock_balances sb on sb.warehouse_id = so.warehouse_id
join item_catalog mi on mi.id = sb.item_id;

select count(*) as n_opname_lines from stock_opname_lines;
select 'PART 6.5 OK' as status;

-- 6.6 assets (~35: 5 cabang x 7 jenis) + asset_assignments + asset_maintenances
create temp table t_asset_type (rn int, code text, name text, category text, life_months int);
insert into t_asset_type values
 (1,'ASSET-OTDR','OTDR','alat_ukur',60),
 (2,'ASSET-SPLICER','Fusion Splicer','alat_ukur',60),
 (3,'ASSET-OPM','Optical Power Meter','alat_ukur',48),
 (4,'ASSET-MOTOR','Motor Operasional','kendaraan',96),
 (5,'ASSET-PICKUP','Mobil Pickup','kendaraan',120),
 (6,'ASSET-LAPTOP','Laptop Teknisi','it',36),
 (7,'ASSET-TANGGA','Tangga Aluminium 6m','tools',60);

insert into assets (company_id, asset_no, item_id, asset_name, asset_category, brand, model, serial_no, purchase_date, purchase_price, useful_life_months, depreciation_method, book_value, condition, status, warehouse_id, branch_id, holder_employee_id, note)
select
  (select id from t_company),
  'AST/2026/' || br.code || '/' || lpad(at.rn::text,3,'0'),
  ic.id,
  at.name,
  at.category,
  (array['Telkom','Sumitomo','Fujikura','Yamaha','Mitsubishi','Lenovo','Krisbow'])[at.rn],
  'MDL-' || (2020 + (br.rn+at.rn) % 5),
  'SN-AST-' || br.code || '-' || lpad(at.rn::text,3,'0') || '-' || lpad(((br.rn*137+at.rn*29) % 9999)::text,4,'0'),
  (date '2023-01-01' + ((br.rn*29+at.rn*41) % 900) * interval '1 day')::date,
  ic.last_price,
  at.life_months,
  'garis_lurus',
  round(ic.last_price * greatest(0.15, 1 - (((br.rn*29+at.rn*41) % 900)::numeric / (at.life_months*30.0))), 0),
  case when (br.rn+at.rn) % 9 = 0 then 'rusak_ringan' else 'baik' end,
  case when (br.rn+at.rn) % 11 = 0 then 'perbaikan' when at.rn in (4,5) and (br.rn+at.rn) % 3 = 0 then 'tersedia' else 'dipakai' end,
  wh.id,
  br.id,
  case when (case when (br.rn+at.rn) % 11 = 0 then 'perbaikan' when at.rn in (4,5) and (br.rn+at.rn) % 3 = 0 then 'tersedia' else 'dipakai' end) = 'dipakai'
    then hold.id else null end,
  'Aset demo data 2026'
from t_branch br
cross join t_asset_type at
join t_wh_branch wh on wh.branch_id = br.id
join item_catalog ic on ic.code = at.code
join t_emp_by_branch hold on hold.branch_id = br.id and hold.rnb = 1 + ((br.rn+at.rn) % (select count(*) from t_emp_by_branch e2 where e2.branch_id = br.id));

create temp table t_asset as select id, asset_no, status, branch_id, holder_employee_id, row_number() over (order by asset_no) as rn from assets;

insert into asset_assignments (company_id, asset_id, employee_id, assigned_at, returned_at, condition_out, condition_in, note)
select (select id from t_company), a.id, a.holder_employee_id,
  (date '2026-01-05' + (a.rn*11 % 60) * interval '1 day')::timestamptz, null, 'baik', null,
  'Penyerahan aset ke pemegang saat ini'
from t_asset a where a.status = 'dipakai' and a.holder_employee_id is not null;

insert into asset_assignments (company_id, asset_id, employee_id, assigned_at, returned_at, condition_out, condition_in, note)
select (select id from t_company), a.id, e2.id,
  (date '2025-06-01' + (a.rn*7 % 120) * interval '1 day')::timestamptz,
  (date '2025-12-01' + (a.rn*7 % 120) * interval '1 day')::timestamptz,
  'baik', 'baik',
  'Riwayat pemegang sebelumnya'
from t_asset a
join t_emp_by_branch e2 on e2.branch_id = a.branch_id and e2.rnb = 1 + ((a.rn+2) % (select count(*) from t_emp_by_branch x2 where x2.branch_id = a.branch_id))
where a.rn % 4 = 0;

insert into asset_maintenances (company_id, asset_id, maintenance_date, maintenance_type, vendor_id, cost, description, next_due_date)
select
  (select id from t_company), a.id,
  (date '2026-05-01' + (a.rn*13 % 130) * interval '1 day')::date,
  (array['servis_rutin','kalibrasi','perbaikan'])[1 + (a.rn % 3)],
  v.id,
  (250000 + (a.rn*37111) % 2500000),
  'Perawatan/kalibrasi berkala aset operasional',
  (date '2026-05-01' + (a.rn*13 % 130) * interval '1 day' + interval '6 months')::date
from t_asset a
join t_vendor v on v.rn = 1 + (a.rn % (select count(*) from t_vendor));

select count(*) as n_assets from assets;
select count(*) as n_asset_assign from asset_assignments;
select count(*) as n_asset_maint from asset_maintenances;
select 'PART 6.6 OK' as status;


-- =====================================================================
-- PART 7: PROCUREMENT
-- =====================================================================

-- 7.1 purchase_requests (~45) + pr_items
insert into purchase_requests (company_id, pr_no, request_date, requester_id, branch_id, unit, need_by_date, purpose, project_id, total_estimate, status, current_step, note)
select
  (select id from t_company),
  'PR/2026/' || lpad(g.i::text,5,'0'),
  (date '2026-04-01' + ((g.i*29) % 168) * interval '1 day')::date,
  req.id,
  br.id,
  (array['OPERATIONS','DEPLOYMENT','INVENTORY','PROCUREMENT'])[1+(g.i%4)],
  (date '2026-04-01' + ((g.i*29) % 168) * interval '1 day' + interval '14 days')::date,
  'Pengadaan material/peralatan operasional cabang ' || br.code,
  case when g.i % 5 = 0 then proj.id else null end,
  0,
  (array['draft','diajukan','disetujui','disetujui','sebagian_po','selesai','ditolak','batal'])[1+(g.i%8)],
  1,
  null
from generate_series(1,45) as g(i)
join t_branch br on br.rn = 1+((g.i-1)%5)
join t_authuser req on req.rn = 1+(g.i % (select count(*) from t_authuser))
join t_project proj on proj.rn = 1+(g.i%10);

create temp table t_pr as select id, pr_no, status, row_number() over (order by pr_no) as rn from purchase_requests;

insert into pr_items (company_id, pr_id, item_id, description, qty, uom, estimate_price, amount, qty_po, note)
select (select id from t_company), pr.id, mi.id, mi.code || ' - kebutuhan pengadaan', qx.qty, mi.uom, mi.price, qx.qty*mi.price,
  case when pr.status in ('sebagian_po','selesai') then qx.qty else 0 end,
  null
from t_pr pr
cross join generate_series(1,3) as k(seq)
join t_moveitem mi on mi.rn = 1+((pr.rn*5+k.seq*7) % 20)
cross join lateral (select (case when mi.category='NTE' then 5+(pr.rn+k.seq)%10 else 20+(pr.rn*3+k.seq*11)%80 end)::numeric as qty) qx;

update purchase_requests pr set total_estimate = sub.amt
from (select pr_id, sum(amount) amt from pr_items group by pr_id) sub
where sub.pr_id = pr.id;

select count(*) as n_pr from purchase_requests;
select count(*) as n_pr_items from pr_items;
select 'PART 7.1 OK' as status;

-- 7.2 rfqs (~12) + rfq_quotes
insert into rfqs (company_id, rfq_no, pr_id, issue_date, due_date, status)
select (select id from t_company), 'RFQ/2026/'||lpad(row_number() over(order by pr.rn)::text,4,'0'), pr.id,
  (date '2026-04-05' + (pr.rn*11)%160 * interval '1 day')::date,
  (date '2026-04-05' + (pr.rn*11)%160 * interval '1 day' + interval '7 days')::date,
  (array['selesai','selesai','ditutup','draft'])[1+(pr.rn%4)]
from t_pr pr
where pr.status not in ('draft','ditolak','batal')
order by pr.rn
limit 12;

create temp table t_rfq as select id, pr_id, row_number() over (order by id) as rn from rfqs;

insert into rfq_quotes (company_id, rfq_id, vendor_id, quote_no, quote_date, total_amount, delivery_days, payment_term, is_selected, note)
select (select id from t_company), rq.id, v.id,
  'QT/'||lpad(rq.rn::text,4,'0')||'/'||v.rn,
  (date '2026-04-10' + (rq.rn*13)%150 * interval '1 day')::date,
  (5000000 + (rq.rn*777000+v.rn*333000) % 25000000),
  7 + (v.rn*3+rq.rn)%20,
  (array['30 hari','45 hari','net 14','cod'])[1+(v.rn%4)],
  (k.seq = 1),
  null
from t_rfq rq
cross join generate_series(1,3) as k(seq)
join t_vendor v on v.rn = 1+((rq.rn*3+k.seq*5) % 8);

select count(*) as n_rfq from rfqs;
select count(*) as n_rfq_quotes from rfq_quotes;
select 'PART 7.2 OK' as status;

-- 7.3 purchase_orders (~35) + po_items
insert into purchase_orders (company_id, po_no, po_date, vendor_id, pr_id, rfq_id, delivery_date, warehouse_id, subtotal, discount, ppn, total, currency, payment_term_days, status, note)
select
  (select id from t_company),
  'PO/2026/'||lpad(g.i::text,5,'0'),
  (date '2026-04-15' + (g.i*17)%150 * interval '1 day')::date,
  v.id,
  pr.id,
  rq.id,
  (date '2026-04-15' + (g.i*17)%150 * interval '1 day' + interval '10 days')::date,
  wh.id,
  0, 0, 0, 0,
  'IDR', 30,
  (array['draft','diajukan','disetujui','batal','dikirim','diterima_sebagian','diterima','diterima','ditutup','dikirim'])[1+(g.i%10)],
  null
from generate_series(1,35) as g(i)
join t_pr pr on pr.rn = 1+(g.i % 45)
join t_branch br on br.rn = 1+((g.i-1)%5)
join t_wh_branch wh on wh.branch_id = br.id
left join t_rfq rq on rq.pr_id = pr.id
join t_vendor v on v.rn = 1+(g.i%8);

create temp table t_po as select id, po_no, vendor_id, warehouse_id, status, row_number() over (order by po_no) as rn from purchase_orders;

insert into po_items (company_id, po_id, item_id, description, qty, uom, price, discount, amount)
select (select id from t_company), po.id, mi.id, mi.code, qx.qty, mi.uom, mi.price, 0, qx.qty*mi.price
from t_po po
cross join generate_series(1,3) as k(seq)
join t_moveitem mi on mi.rn = 1+((po.rn*7+k.seq*11) % 20)
cross join lateral (select (case when mi.category='NTE' then 5+(po.rn+k.seq)%15 else 20+(po.rn*3+k.seq*7)%100 end)::numeric as qty) qx;

update purchase_orders po set subtotal = s.amt, ppn = round(s.amt*0.11,0), total = round(s.amt*1.11,0)
from (select po_id, sum(amount) amt from po_items group by po_id) s
where s.po_id = po.id;

create temp table t_poi as select id, po_id, item_id, qty, price, row_number() over (partition by po_id order by id) as rnk from po_items;

select count(*) as n_po from purchase_orders;
select count(*) as n_po_items from po_items;
select 'PART 7.3 OK' as status;

-- 7.4 goods_receipts (~28) + gr_items (trigger fn_gr_items_apply akan update po_items.qty_received & PO status)
create temp table t_po_recv as select * from t_po where status in ('dikirim','diterima_sebagian','diterima','ditutup');

insert into goods_receipts (company_id, gr_no, gr_date, po_id, warehouse_id, received_by, status, note)
select (select id from t_company),
  'GR/2026/'||lpad(g.i::text,5,'0'),
  (date '2026-04-20' + (g.i*13)%150 * interval '1 day')::date,
  pr.id, pr.warehouse_id, au.id,
  case when g.i % 9 = 0 then 'draft' else 'diterima' end,
  null
from generate_series(1,28) as g(i)
join t_po_recv pr on pr.rn = 1 + (g.i % (select count(*) from t_po_recv))
join t_authuser au on au.rn = 1 + (g.i % (select count(*) from t_authuser));

create temp table t_gr as select id, gr_no, po_id, warehouse_id, row_number() over (order by gr_no) as rn from goods_receipts;

insert into gr_items (company_id, gr_id, po_item_id, item_id, qty_received, qty_rejected, reject_reason, note)
select (select id from t_company), gr.id, poi.id, poi.item_id,
  round(poi.qty * fx.factor, 0),
  case when (gr.rn+poi.rnk) % 11 = 0 then round(poi.qty*0.02,0) else 0 end,
  case when (gr.rn+poi.rnk) % 11 = 0 then 'Sebagian barang rusak saat pengiriman' else null end,
  null
from t_gr gr
join t_poi poi on poi.po_id = gr.po_id
cross join lateral (select (0.20 + ((gr.rn*7+poi.rnk*11) % 26)/100.0)::numeric as factor) fx;

select count(*) as n_gr from goods_receipts;
select count(*) as n_gr_items from gr_items;
select 'PART 7.4 OK' as status;

-- 7.5 vendor_invoices (~30) + ap_payments
create temp table t_gr_amt as
  select gi.gr_id, gr.po_id, sum(gi.qty_received*pit.price) as gr_amount
  from gr_items gi
  join t_gr gr on gr.id = gi.gr_id
  join po_items pit on pit.id = gi.po_item_id
  group by gi.gr_id, gr.po_id;

create temp table t_gra as select *, row_number() over (order by gr_id) as rn from t_gr_amt;

insert into vendor_invoices (company_id, inv_no, vendor_invoice_no, invoice_date, due_date, vendor_id, po_id, gr_id, dpp, ppn, pph23, total, paid_amount, match_status, status, faktur_pajak_no)
select
  (select id from t_company),
  'VINV/2026/'||lpad(ga.rn::text,5,'0'),
  'VND-'||lpad(ga.rn::text,6,'0'),
  dx.invd,
  dx.invd + interval '30 days',
  po.vendor_id,
  ga.po_id,
  ga.gr_id,
  d2.dpp_v, p2.ppn_v, p3.pph23_v, t2.total_v, pv.paid_v,
  mx.mstatus,
  sx.istatus,
  case when sx.istatus <> 'draft' then 'FP-'||lpad(ga.rn::text,6,'0') else null end
from t_gra ga
join t_po po on po.id = ga.po_id
cross join lateral (select (date '2026-05-01' + (ga.rn*11)%140 * interval '1 day')::date as invd) dx
cross join lateral (select round(ga.gr_amount,0) as dpp_v) d2
cross join lateral (select round(d2.dpp_v*0.11,0) as ppn_v) p2
cross join lateral (select (case when ga.rn%4=0 then round(d2.dpp_v*0.02,0) else 0 end) as pph23_v) p3
cross join lateral (select (d2.dpp_v+p2.ppn_v-p3.pph23_v) as total_v) t2
cross join lateral (select (array['draft','diajukan','diverifikasi','disetujui','dibayar_sebagian','lunas','lunas','ditolak'])[1+(ga.rn%8)] as istatus) sx
cross join lateral (select (case when sx.istatus='lunas' then t2.total_v when sx.istatus='dibayar_sebagian' then round(t2.total_v*0.5,0) else 0 end) as paid_v) pv
cross join lateral (select (array['belum','cocok','cocok','selisih'])[1+(ga.rn%4)] as mstatus) mx
limit 30;

create temp table t_vinv as select id, vendor_id, status, total, paid_amount, row_number() over (order by inv_no) as rn from vendor_invoices;

insert into ap_payments (company_id, payment_no, payment_date, vendor_id, invoice_id, amount, method, bank_ref, note, status)
select (select id from t_company), 'APP/2026/'||lpad(vi.rn::text,5,'0'),
  (date '2026-05-15' + (vi.rn*9)%130 * interval '1 day')::date,
  vi.vendor_id, vi.id, vi.paid_amount,
  (array['transfer','transfer','giro'])[1+(vi.rn%3)],
  'REF-'||lpad(vi.rn::text,8,'0'),
  'Pembayaran invoice vendor',
  'terkonfirmasi'
from t_vinv vi
where vi.status in ('lunas','dibayar_sebagian') and vi.paid_amount > 0;

select count(*) as n_vinv from vendor_invoices;
select count(*) as n_ap_payments from ap_payments;
select 'PART 7.5 OK' as status;

-- 7.6 vendor_scorecards (8 vendor x 3 periode)
insert into vendor_scorecards (company_id, vendor_id, period_code, otd_score, quality_score, price_score, compliance_score, total_score, note)
select (select id from t_company), v.id, per.pc,
  sxv.otd, sxv.qual, sxv.price, sxv.comp,
  round((sxv.otd+sxv.qual+sxv.price+sxv.comp)/4.0,1),
  null
from t_vendor v
cross join (values ('2026-Q2',1),('2026-Q3',2),('2026-Q4',3)) as per(pc,pi)
cross join lateral (
  select
    round(70 + ((v.rn*7+per.pi*5) % 30),1) as otd,
    round(70 + ((v.rn*11+per.pi*3) % 30),1) as qual,
    round(65 + ((v.rn*5+per.pi*9) % 30),1) as price,
    round(75 + ((v.rn*3+per.pi*7) % 25),1) as comp
) sxv;

select count(*) as n_scorecards from vendor_scorecards;
select 'PART 7.6 OK' as status;


-- =====================================================================
-- PART 8: COMMERCE (progress_claims, bast, ar_invoices, ar_payments, sla_penalties)
-- =====================================================================

create temp table t_spk_claim as select *, row_number() over (order by spk_no) as rnc from t_spk_all;

-- 8.1 progress_claims (~30) + progress_claim_items
insert into progress_claims (company_id, claim_no, spk_id, contract_id, period_start, period_end, progress_percent, claim_amount, retention_amount, status, ba_no, ba_date, note)
select
  (select id from t_company),
  'CLM/2026/'||lpad((row_number() over (order by sc.rnc, k.seq))::text,5,'0'),
  sc.id, sc.contract_id,
  px.pstart, px.pend, px.prog,
  ax.camt, round(ax.camt*0.05,0),
  sxx.cstatus,
  case when sxx.cstatus in ('disetujui','ditagihkan') then 'BA/'||lpad(sc.rnc::text,4,'0')||'/'||k.seq else null end,
  case when sxx.cstatus in ('disetujui','ditagihkan') then px.pend else null end,
  null
from t_spk_claim sc
cross join generate_series(1,3) as k(seq)
cross join lateral (
  select
    (date '2026-04-01' + ((k.seq-1)*60) * interval '1 day')::date as pstart,
    (date '2026-04-01' + ((k.seq-1)*60 + 29) * interval '1 day')::date as pend,
    least(100, k.seq*30 + (sc.rnc%10)) as prog
) px
join spk sraw on sraw.id = sc.id
cross join lateral (select round(sraw.spk_value * (0.15 + (k.seq*0.1)), -3) as camt) ax
cross join lateral (select (array['draft','diajukan','diverifikasi','disetujui','ditagihkan','ditolak'])[1+((sc.rnc+k.seq)%6)] as cstatus) sxx;

create temp table t_pclaim as select id, contract_id, spk_id, claim_amount, row_number() over (order by claim_no) as rn from progress_claims;

create temp table t_cpl as select id, contract_id, description, uom, unit_price, row_number() over (partition by contract_id order by id) as rnk from contract_price_list;

insert into progress_claim_items (company_id, claim_id, price_list_id, description, uom, qty, unit_price, amount)
select (select id from t_company), c.id, cp.id, cp.description, cp.uom, qx.qv, cp.unit_price, qx.qv*cp.unit_price
from t_pclaim c
cross join generate_series(1,3) as k(seq)
join t_cpl cp on cp.contract_id = c.contract_id
  and cp.rnk = 1 + ((c.rn*3+k.seq) % greatest(1,(select count(*) from t_cpl c2 where c2.contract_id=c.contract_id)))
cross join lateral (select (1 + (c.rn+k.seq)%8)::numeric as qv) qx;

select count(*) as n_claims from progress_claims;
select count(*) as n_claim_items from progress_claim_items;
select 'PART 8.1 OK' as status;

-- 8.2 bast (~24)
insert into bast (company_id, bast_no, bast_date, spk_id, project_id, work_order_id, customer_id, title, scope, signed_by_customer, signer_name, signer_position, status)
select
  (select id from t_company),
  'BAST/2026/'||lpad((row_number() over (order by sc.rnc, k.seq))::text,5,'0'),
  (date '2026-05-01' + (sc.rnc*17+k.seq*23)%140 * interval '1 day')::date,
  sc.id, null, null, cust.id,
  'BAST Pekerjaan ' || sc.spk_no,
  'Serah terima hasil pekerjaan sesuai SPK',
  svx.signed_v,
  case when svx.signed_v then (array['Budi Santoso','Siti Aminah','Herman Wijaya','Rina Kartika','Agus Salim'])[1+((sc.rnc+k.seq)%5)] else null end,
  case when svx.signed_v then 'Perwakilan Pelanggan' else null end,
  bsx.bstatus
from t_spk_claim sc
cross join generate_series(1,2) as k(seq)
join spk sraw on sraw.id = sc.id
join contracts ctr on ctr.id = sraw.contract_id
join customers cust on cust.id = ctr.customer_id
cross join lateral (select (((sc.rnc+k.seq) % 4) <> 0) as signed_v) svx
cross join lateral (select case when svx.signed_v then 'ditandatangani' else (array['draft','diajukan','ditolak'])[1+((sc.rnc+k.seq)%3)] end as bstatus) bsx;

select count(*) as n_bast from bast;
select 'PART 8.2 OK' as status;

-- 8.3 ar_invoices (~28) + ar_payments
create temp table t_ar_base as select * from t_pclaim order by rn limit 28;

insert into ar_invoices (company_id, inv_no, invoice_date, due_date, customer_id, contract_id, spk_id, claim_id, dpp, ppn, pph23, total, paid_amount, status, faktur_pajak_no)
select
  (select id from t_company),
  'ARINV/2026/'||lpad(b.rn::text,5,'0'),
  dx.invd, dx.invd+interval '30 days',
  cust.id, b.contract_id, b.spk_id, b.id,
  d2.dpp_v, p2.ppn_v, p3.pph23_v, t2.total_v, pv.paid_v,
  sx.istatus,
  case when sx.istatus<>'draft' then 'FP-AR-'||lpad(b.rn::text,6,'0') else null end
from t_ar_base b
join contracts ctr on ctr.id = b.contract_id
join customers cust on cust.id = ctr.customer_id
cross join lateral (select (date '2026-05-05' + (b.rn*13)%130 * interval '1 day')::date as invd) dx
cross join lateral (select round(b.claim_amount*0.95,0) as dpp_v) d2
cross join lateral (select round(d2.dpp_v*0.11,0) as ppn_v) p2
cross join lateral (select (case when ctr.contract_type='manage_service' then round(d2.dpp_v*0.02,0) else 0 end) as pph23_v) p3
cross join lateral (select (d2.dpp_v+p2.ppn_v-p3.pph23_v) as total_v) t2
cross join lateral (select (array['draft','diajukan','terkirim','dibayar_sebagian','lunas','lunas','overdue','batal'])[1+(b.rn%8)] as istatus) sx
cross join lateral (select (case when sx.istatus='lunas' then t2.total_v when sx.istatus='dibayar_sebagian' then round(t2.total_v*0.5,0) else 0 end) as paid_v) pv;

create temp table t_ar as select id, customer_id, status, total, paid_amount, row_number() over (order by inv_no) as rn from ar_invoices;

insert into ar_payments (company_id, payment_no, payment_date, customer_id, invoice_id, amount, method, bank_ref, note)
select (select id from t_company), 'ARP/2026/'||lpad(a.rn::text,5,'0'),
  (date '2026-06-01' + (a.rn*7)%120 * interval '1 day')::date,
  a.customer_id, a.id, a.paid_amount,
  (array['transfer','transfer','giro'])[1+(a.rn%3)],
  'ARREF-'||lpad(a.rn::text,8,'0'),
  'Penerimaan pembayaran pelanggan'
from t_ar a
where a.status in ('lunas','dibayar_sebagian') and a.paid_amount > 0;

select count(*) as n_ar_invoices from ar_invoices;
select count(*) as n_ar_payments from ar_payments;
select 'PART 8.3 OK' as status;

-- 8.4 sla_penalties (manage_service contracts)
insert into sla_penalties (company_id, contract_id, period_code, description, breach_count, penalty_amount, status, note)
select (select id from t_company), c.id, per.pc,
  'Penalti keterlambatan penanganan gangguan sesuai SLA kontrak',
  bx.bc, bx.bc*2000000, sxp.pstat, null
from t_contract c
cross join (values ('2026-Q2',1),('2026-Q3',2)) as per(pc,pi)
cross join lateral (select (1 + ((c.rn*3+per.pi*7) % 5)) as bc) bx
cross join lateral (select (array['diajukan','disetujui','ditagihkan'])[1+((c.rn+per.pi)%3)] as pstat) sxp
where c.contract_type = 'manage_service';

select count(*) as n_sla_penalty from sla_penalties;
select 'PART 8.4 OK' as status;


-- =====================================================================
-- PART 9: FINANCE
-- =====================================================================

-- 9.1 cost_categories (6)
insert into cost_categories (company_id, code, name, cost_type) values
 ((select id from t_company),'CC-MTRL','Material & Perangkat','material'),
 ((select id from t_company),'CC-UPAH','Upah Tenaga Kerja','upah'),
 ((select id from t_company),'CC-SUBKON','Subkontraktor','subkon'),
 ((select id from t_company),'CC-TRANS','Transportasi & Mobilisasi','transport'),
 ((select id from t_company),'CC-OVH','Overhead Proyek','overhead'),
 ((select id from t_company),'CC-LAIN','Biaya Lain-lain','lain');

create temp table t_cc as select id, code, name, row_number() over (order by code) as rn from cost_categories;

select count(*) as n_cost_cat from cost_categories;
select 'PART 9.1 OK' as status;

-- 9.2 job_costs (~600, margin proyek 8-22%)
create temp table t_jc_target0 as
  select p.id as project_id, p.spk_id, p.contract_value, row_number() over (order by p.project_code) as prn
  from projects p;

create temp table t_jc_target as
  select project_id, spk_id, contract_value, prn,
    (array[10,14,9,18,22,12,16,8,20,15])[1+((prn-1)%10)] as margin_pct,
    (contract_value * (1 - (array[10,14,9,18,22,12,16,8,20,15])[1+((prn-1)%10)]/100.0)) as target_cost
  from t_jc_target0;

create temp table t_jc_raw as
  select t.project_id, t.spk_id, t.prn, t.target_cost, g.i as seq,
    (1 + ((t.prn*13 + g.i*7) % 100))::numeric as w
  from t_jc_target t cross join generate_series(1,65) as g(i);

create temp table t_jc_sum as select project_id, sum(w) as wsum from t_jc_raw group by project_id;

insert into job_costs (company_id, project_id, spk_id, work_order_id, cost_category_id, cost_date, description, amount, source_type, source_id)
select (select id from t_company), r.project_id, r.spk_id, null, cc.id,
  (date '2026-04-01' + ((r.prn*17 + r.seq*3) % 168) * interval '1 day')::date,
  cc.name || ' - biaya proyek',
  round(r.target_cost * r.w / s.wsum, 0),
  'MANUAL', null
from t_jc_raw r
join t_jc_sum s on s.project_id = r.project_id
join t_cc cc on cc.rn = 1 + ((r.prn*7+r.seq*11) % 6);

select count(*) as n_job_costs from job_costs;
select 'PART 9.2 OK' as status;

-- 9.3 budgets (7 unit x 6 periode)
insert into budgets (company_id, period_code, unit, cost_category_id, project_id, budget_amount, note)
select (select id from t_company), per.pc, un.un, cc.id, null,
  round((50000000 + (un.rnU*17+per.rnP*29)%150000000),0),
  null
from (values ('2026-04',1),('2026-05',2),('2026-06',3),('2026-07',4),('2026-08',5),('2026-09',6)) as per(pc,rnP)
cross join (values ('OPERATIONS',1),('DEPLOYMENT',2),('HR',3),('COMMERCE',4),('PROCUREMENT',5),('FINANCE',6),('INVENTORY',7)) as un(un,rnU)
join t_cc cc on cc.rn = 1 + ((un.rnU+per.rnP) % 6);

select count(*) as n_budgets from budgets;
select 'PART 9.3 OK' as status;

-- 9.4 cash_flows (derived from ap_payments/ar_payments/payroll_runs)
insert into cash_flows (company_id, flow_date, direction, category, description, amount, ref_type, ref_id, bank_account)
select (select id from t_company), ap.payment_date, 'out', 'ap_payment', 'Pembayaran invoice vendor', ap.amount, 'AP_PAYMENT', ap.id, 'BCA-OPS-001'
from ap_payments ap;

insert into cash_flows (company_id, flow_date, direction, category, description, amount, ref_type, ref_id, bank_account)
select (select id from t_company), arp.payment_date, 'in', 'ar_payment', 'Penerimaan pembayaran pelanggan', arp.amount, 'AR_PAYMENT', arp.id, 'BCA-OPS-001'
from ar_payments arp;

insert into cash_flows (company_id, flow_date, direction, category, description, amount, ref_type, ref_id, bank_account)
select (select id from t_company), pr.paid_at::date, 'out', 'payroll', 'Pembayaran gaji karyawan', pr.net_pay, 'PAYROLL_RUN', pr.id, 'BCA-PAYROLL-001'
from payroll_runs pr where pr.status='dibayar' and pr.paid_at is not null;

select count(*) as n_cash_flows from cash_flows;
select 'PART 9.4 OK' as status;

-- 9.5 partner_payment_sla (6 vendor, target 30 hari)
insert into partner_payment_sla (company_id, vendor_id, target_days, note)
select (select id from t_company), v.id, 30, 'Target pembayaran standar 30 hari sejak invoice diverifikasi'
from t_vendor v where v.rn <= 6;

select count(*) as n_partner_sla from partner_payment_sla;
select 'PART 9.5 OK' as status;


-- =====================================================================
-- PART 10: DEPLOYMENT (surveys, drm_sessions, boq_items, progress_reports, qc_records, documents, rfs_records)
-- =====================================================================

create temp table t_proj10 as
  select p.id, p.project_code, p.project_name, p.branch_id, p.lat, p.lng, p.start_date, p.target_date, p.status, p.spk_id, p.contract_id, p.pm_id, p.contract_value,
         row_number() over (order by p.project_code) as prn
  from projects p;

create temp table t_engineer as
  select id, row_number() over (order by nip) as ern from t_emp where position in ('Design Engineer','Supervisor Operations','Project Manager');

create temp table t_qcinspector as
  select id, row_number() over (order by nip) as qrn from t_emp where position in ('Quality Control','Design Engineer','Supervisor Operations');

-- 10.1 surveys (1 per proyek)
insert into surveys (company_id, survey_no, project_id, survey_date, surveyor_id, location, lat, lng, findings, feasibility, recommendation, photo_urls, status)
select (select id from t_company), 'SVY/2026/'||lpad(pp.prn::text,4,'0'),
  pp.id, (pp.start_date - 10 * interval '1 day')::date,
  eng.id,
  'Lokasi survey ' || pp.project_name,
  pp.lat, pp.lng,
  'Kondisi existing tiang dan jalur kabel telah diperiksa, memungkinkan untuk deployment.',
  fez.f,
  case fez.f when 'layak' then 'Dapat dilanjutkan ke tahap desain' when 'layak_bersyarat' then 'Perlu penyesuaian jalur sebelum instalasi' else 'Perlu lokasi alternatif' end,
  '[]'::jsonb,
  'selesai'
from t_proj10 pp
join t_engineer eng on eng.ern = 1 + (pp.prn % (select count(*) from t_engineer))
cross join lateral (select (array['layak','layak','layak_bersyarat','tidak_layak'])[1+(pp.prn%4)] as f) fez;

select count(*) as n_surveys from surveys;
select 'PART 10.1 OK' as status;

-- 10.2 drm_sessions (1 per proyek)
insert into drm_sessions (company_id, drm_no, project_id, drm_date, participants, agenda, decisions, action_items, status, file_url)
select (select id from t_company), 'DRM/2026/'||lpad(pp.prn::text,4,'0'), pp.id,
  (pp.start_date + 3 * interval '1 day')::date,
  '["PM","Design Engineer","Supervisor Operations","Customer"]'::jsonb,
  'Review desain jaringan dan rencana deployment ' || pp.project_name,
  'Desain disetujui dengan catatan minor pada jalur ODP.',
  '[{"item":"Update shop drawing","due":"+7d"}]'::jsonb,
  'selesai',
  null
from t_proj10 pp;

select count(*) as n_drm from drm_sessions;
select 'PART 10.2 OK' as status;

-- 10.3 boq_items (plan & actual)
insert into boq_items (company_id, project_id, boq_type, version, item_id, item_code, description, uom, qty, unit_price, amount, category, note)
select (select id from t_company), pp.id, 'plan', 1, mi.id, mi.code, mi.code||' - rencana kebutuhan', mi.uom, qx.qv, mi.price, qx.qv*mi.price,
  case when mi.category='NTE' then 'Material Elektronik' else 'Material Pasif' end, null
from t_proj10 pp
cross join generate_series(1,8) as k(seq)
join t_moveitem mi on mi.rn = 1 + ((pp.prn*5+k.seq*7) % 20)
cross join lateral (select (case when mi.category='NTE' then 20+(pp.prn+k.seq)%80 else 100+(pp.prn*3+k.seq*11)%400 end)::numeric as qv) qx;

insert into boq_items (company_id, project_id, boq_type, version, item_id, item_code, description, uom, qty, unit_price, amount, category, note)
select (select id from t_company), pp.id, 'actual', 1, mi.id, mi.code, mi.code||' - realisasi pemakaian', mi.uom, qx.qv, mi.price, qx.qv*mi.price,
  case when mi.category='NTE' then 'Material Elektronik' else 'Material Pasif' end, null
from t_proj10 pp
cross join generate_series(1,8) as k(seq)
join t_moveitem mi on mi.rn = 1 + ((pp.prn*5+k.seq*7) % 20)
cross join lateral (select (case when mi.category='NTE' then 18+(pp.prn+k.seq)%85 else 95+(pp.prn*3+k.seq*11)%420 end)::numeric as qv) qx
where pp.status in ('pelaksanaan','testing','bast','selesai');

select count(*) as n_boq from boq_items;
select 'PART 10.3 OK' as status;

-- 10.4 progress_reports (S-curve mingguan)
insert into progress_reports (company_id, project_id, report_date, plan_percent, actual_percent, deviation, week_no, activities, constraints, next_plan, photo_urls, reported_by)
select (select id from t_company), pp.id, rx.rdate,
  plx.plan_pct, acx.act_pct, (acx.act_pct-plx.plan_pct), wk.w,
  'Pelaksanaan instalasi jaringan sesuai rencana mingguan.',
  case when (pp.prn+wk.w)%6=0 then 'Cuaca buruk menghambat sebagian pekerjaan lapangan' else null end,
  'Melanjutkan instalasi sesuai jadwal minggu berikutnya',
  '[]'::jsonb,
  au.id
from t_proj10 pp
cross join generate_series(1,24) as wk(w)
cross join lateral (select (pp.start_date + (wk.w*7) * interval '1 day')::date as rdate) rx
cross join lateral (select greatest(4, (pp.target_date - pp.start_date)/7) as totw) twx
cross join lateral (select round(100.0/(1+exp(-0.35*(wk.w - twx.totw/2.0))),1) as plan_pct) plx
cross join lateral (select least(100, greatest(0, plx.plan_pct + (((pp.prn*7+wk.w*3) % 13) - 6)))::numeric as act_pct) acx
join t_authuser au on au.rn = 1 + ((pp.prn+wk.w) % (select count(*) from t_authuser))
where rx.rdate <= date '2026-09-16';

select count(*) as n_progress_reports from progress_reports;
select 'PART 10.4 OK' as status;

-- 10.5 qc_records (mixed pass/fail, dari WO done)
insert into qc_records (company_id, project_id, work_order_id, qc_no, qc_date, qc_type, network_element_id, measured_value, threshold_value, unit, result, inspector_id, photo_urls, note)
select (select id from t_company), null, w.id,
  'QC/2026/'||lpad(w.rn::text,6,'0'),
  w.finished_at::date,
  (array['OTDR','VISUAL','INSTALASI'])[1+(w.rn%3)],
  null,
  mvx.mv, 0.25, 'dB',
  case wraw.qc_status when 'lulus' then 'lulus' else 'tidak_lulus' end,
  insp.id,
  '[]'::jsonb,
  null
from t_wo w
join work_orders wraw on wraw.id = w.id
join t_qcinspector insp on insp.qrn = 1 + (w.rn % (select count(*) from t_qcinspector))
cross join lateral (select case when wraw.qc_status='lulus' then round((0.10 + (w.rn%15)/100.0)::numeric,2) else round((0.30 + (w.rn%20)/100.0)::numeric,2) end as mv) mvx
where w.status='done' and wraw.qc_status in ('lulus','tidak_lulus') and w.rn % 3 = 0;

select count(*) as n_qc from qc_records;
select 'PART 10.5 OK' as status;

-- 10.6 documents (some versioned)
create temp table t_doctype as select * from (values (1,'ABD'),(2,'SHOPDRAWING'),(3,'QC'),(4,'IZIN'),(5,'BAST')) as x(dn,dt);

insert into documents (company_id, project_id, doc_type, doc_no, title, version, parent_document_id, file_url, file_size, status, reviewed_by, approved_by, approved_at, note)
select (select id from t_company), pp.id, dtp.dt,
  'DOC/'||dtp.dt||'/'||lpad(pp.prn::text,4,'0'),
  dtp.dt || ' - ' || pp.project_name,
  1, null, null, (500000 + (pp.prn*dtp.dn*911)%3000000),
  dsx.dstatus,
  case when dsx.dstatus in ('review','approved') then rv.id else null end,
  case when dsx.dstatus='approved' then ap.id else null end,
  case when dsx.dstatus='approved' then (pp.start_date + (dtp.dn*10) * interval '1 day')::timestamptz else null end,
  null
from t_proj10 pp
cross join t_doctype dtp
join t_authuser rv on rv.rn = 1 + ((pp.prn+dtp.dn) % (select count(*) from t_authuser))
join t_authuser ap on ap.rn = 1 + ((pp.prn+dtp.dn+3) % (select count(*) from t_authuser))
cross join lateral (select (array['draft','review','approved','approved','rejected'])[1+((pp.prn+dtp.dn)%5)] as dstatus) dsx;

create temp table t_doc_v1 as select id, project_id, doc_type, title from documents where version=1 and doc_type in ('ABD','SHOPDRAWING');

insert into documents (company_id, project_id, doc_type, doc_no, title, version, parent_document_id, file_url, file_size, status, reviewed_by, approved_by, approved_at, note)
select (select id from t_company), d.project_id, d.doc_type, 'DOC/'||d.doc_type||'/REV2/'||d.project_id::text,
  d.title || ' (Revisi 2)', 2, d.id, null, 600000, 'approved', au1.id, au2.id, now(), 'Revisi berdasarkan hasil review lapangan'
from t_doc_v1 d
join t_authuser au1 on au1.rn=2
join t_authuser au2 on au2.rn=3;

select count(*) as n_documents from documents;
select 'PART 10.6 OK' as status;

-- 10.7 rfs_records (proyek status bast/selesai)
insert into rfs_records (company_id, project_id, rfs_no, rfs_date, scope, capacity, status, approved_by, approved_at, note)
select (select id from t_company), pp.id, 'RFS/2026/'||lpad(pp.prn::text,4,'0'),
  pp.target_date, 'Jaringan siap layan pelanggan area ' || pp.project_name, 144,
  'disetujui', au.id, (pp.target_date + interval '2 days')::timestamptz, null
from t_proj10 pp
join t_authuser au on au.rn = 1 + (pp.prn % (select count(*) from t_authuser))
where pp.status in ('bast','selesai');

select count(*) as n_rfs from rfs_records;
select 'PART 10.7 OK' as status;

select 'ALL PARTS 0-10 OK' as final_status;
