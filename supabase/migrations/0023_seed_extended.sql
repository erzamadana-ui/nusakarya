-- =====================================================================
-- 0023_seed_extended.sql — Seed data tahap-2 (Apr-Sep 2026)
-- Konsisten dengan seed dasar (companies/branches/employees dari 0009/0015).
-- Deterministic random via setseed(); generate_series untuk volume.
-- CATATAN: tidak membuat auth user/password apa pun di sini.
-- =====================================================================

select setseed(0.7171);

-- =====================================================================
-- PART 0: reference temp tables
-- =====================================================================
create temp table t_company as select id from companies limit 1;

create temp table t_branch as
  select id, code, row_number() over (order by code) as rn from branches;

create temp table t_employee as
  select id, nip, full_name, position, unit, branch_id, employment_type,
         row_number() over (order by nip) as rn
  from employees;

create temp table t_teknisi as
  select id, nip, full_name, branch_id, employment_type,
         row_number() over (order by nip) as rn
  from employees
  where position in ('Teknisi Lapangan','Mitra Teknisi');

create temp table t_jobtype as
  select id, code, name, category, tariff_amount,
         row_number() over (order by code) as rn
  from job_types;

create temp table t_vendor as
  select id, name, row_number() over (order by name) as rn from vendors;

create temp table t_customer as
  select id, name, row_number() over (order by name) as rn from customers;

create temp table t_project as
  select id, project_code, status, row_number() over (order by project_code) as rn
  from projects;

create temp table t_contract as
  select id, customer_id, row_number() over (order by contract_no) as rn from contracts;

create temp table t_profile as select id, role from profiles;

create temp table t_root_cause as
  select id, row_number() over (order by name) as rn from root_causes;

create temp table t_workorder as
  select id, wo_no, branch_id, row_number() over (order by wo_no) as rn from work_orders;

create temp table t_ticket as
  select id, row_number() over (order by id) as rn from tickets;

create temp table t_ar_invoice as
  select id, inv_no, customer_id, invoice_date, dpp, ppn, pph23, faktur_pajak_no,
         row_number() over (order by inv_no) as rn
  from ar_invoices;

create temp table t_vendor_invoice as
  select id, inv_no, vendor_id, invoice_date, dpp, ppn, pph23, faktur_pajak_no,
         row_number() over (order by inv_no) as rn
  from vendor_invoices;

create temp table t_item as
  select id, code, uom, row_number() over (order by code) as rn from item_catalog;

create temp table t_gr as
  select gr.id as gr_id, gr.po_id, po.vendor_id, row_number() over (order by gr.gr_no) as rn
  from goods_receipts gr join purchase_orders po on po.id = gr.po_id;

select 'PART 0 OK' as status;

-- =====================================================================
-- PART 1: HR — Rekrutmen (job_vacancies, job_applicants)
-- =====================================================================
create temp table t_vacancy as
with ins as (
  insert into job_vacancies (company_id, vacancy_no, title, unit, branch_id, position, employment_type, qty,
    requirements, salary_range_min, salary_range_max, open_date, close_date, status, pic_id)
  select (select id from t_company), v.vno, v.title, v.unit, br.id, v.title, v.etype, v.qty,
    v.req, v.smin, v.smax, v.odate, v.cdate, v.st,
    (select id from t_employee where nip='NKMT-0005')
  from (values
    ('LOW/2026/00001','Teknisi Fiber Optik','OPERATIONS','PKWT',5,
     'Min. SMK, memiliki SIM C, bersedia bekerja di lapangan & ketinggian',4200000,5500000,
     date '2026-04-05', date '2026-05-05','dibuka'),
    ('LOW/2026/00002','Staff Finance','FINANCE','PKWTT',1,
     'Min. D3 Akuntansi, mampu mengoperasikan software akuntansi',5000000,6500000,
     date '2026-05-10', date '2026-06-10','dibuka'),
    ('LOW/2026/00003','Design Engineer','DEPLOYMENT','PKWT',2,
     'Min. S1 Teknik Telekomunikasi/Elektro, menguasai AutoCAD & GIS',6000000,8000000,
     date '2026-03-01', date '2026-04-01','ditutup')
  ) as v(vno,title,unit,etype,qty,req,smin,smax,odate,cdate,st)
  join t_branch br on br.rn = 1
  returning id, vacancy_no
)
select * from ins;

insert into job_applicants (company_id, vacancy_id, full_name, email, phone, education, experience_years,
  cv_url, source, stage, score, note, applied_at, decided_at, decided_by)
select
  (select id from t_company), tv.id,
  'Pelamar ' || g.i, 'pelamar' || g.i || '@mail.test', '08' || lpad((1000000000+g.i*137)::text,10,'0'),
  (array['SMK','SMA','D3','S1'])[1 + (g.i % 4)],
  (g.i % 6)::numeric,
  'https://files.nusakarya.test/cv/pelamar-' || g.i || '.pdf',
  (array['Jobstreet','LinkedIn','Referensi Internal','Walk-in'])[1 + (g.i % 4)],
  st.stage,
  case when st.stage in ('diterima','ditolak') then (50 + (g.i*7)%50)::numeric else null end,
  case when st.stage = 'ditolak' then 'Tidak memenuhi kualifikasi minimum' else null end,
  (date '2026-04-01' + (g.i*5) * interval '1 day'),
  case when st.stage in ('diterima','ditolak') then (date '2026-04-01' + (g.i*5+10) * interval '1 day') else null end,
  case when st.stage in ('diterima','ditolak') then (select id from t_profile where role='manager_hr') else null end
from generate_series(1,25) as g(i)
join t_vacancy tv on tv.vacancy_no = (array['LOW/2026/00001','LOW/2026/00002','LOW/2026/00003'])[1 + (g.i % 3)]
cross join lateral (
  select (array['baru','seleksi_berkas','tes','wawancara','tawaran','diterima','ditolak'])[1 + (g.i % 7)] as stage
) st;

select count(*) as n_job_vacancies from job_vacancies;
select count(*) as n_job_applicants from job_applicants;
select 'PART 1 (rekrutmen) OK' as status;

-- =====================================================================
-- PART 1b: HR — Kompetensi & Penilaian
-- =====================================================================
create temp table t_competency as
with ins as (
  insert into competencies (company_id, code, name, category, description, required_for_positions)
  select (select id from t_company), c.code, c.name, c.category, c.descr, c.positions
  from (values
    ('FO-SPLICING','Splicing Fiber Optik','teknis','Kemampuan penyambungan core fiber optik dengan fusion splicer',
       array['Teknisi Lapangan','Mitra Teknisi']),
    ('FO-OTDR','Pengukuran OTDR','teknis','Kemampuan membaca & menganalisis hasil pengukuran OTDR',
       array['Teknisi Lapangan','Mitra Teknisi']),
    ('INSTALASI-ODP','Instalasi ODP/ODC','teknis','Kemampuan instalasi perangkat ODP dan ODC di lapangan',
       array['Teknisi Lapangan','Mitra Teknisi']),
    ('TARIK-KABEL','Teknik Penarikan Kabel','teknis','Kemampuan penarikan kabel fiber optik udara & duct',
       array['Teknisi Lapangan','Mitra Teknisi']),
    ('K3-KETINGGIAN','Bekerja di Ketinggian','K3','Kompetensi bekerja aman di ketinggian (tiang/rooftop)',
       array['Teknisi Lapangan','Mitra Teknisi']),
    ('K3-DASAR','K3 Dasar','K3','Pemahaman dasar keselamatan & kesehatan kerja',
       array['Teknisi Lapangan','Mitra Teknisi','Supervisor Operations']),
    ('P3K','Pertolongan Pertama Pada Kecelakaan','K3','Kemampuan P3K dasar di lokasi kerja',
       array['Supervisor Operations','Dispatcher']),
    ('KEPEMIMPINAN-TIM','Kepemimpinan Tim','manajerial','Kemampuan memimpin & mengkoordinasi tim lapangan',
       array['Supervisor Operations','Project Manager']),
    ('MANAJEMEN-PROYEK','Manajemen Proyek','manajerial','Kemampuan perencanaan & pengendalian proyek deployment',
       array['Project Manager','Design Engineer']),
    ('SERT-K3-KEMNAKER','Sertifikasi K3 Kemnaker','sertifikasi','Sertifikasi Ahli K3 Umum dari Kemnaker RI',
       array['Supervisor Operations']),
    ('SERT-FO-BNSP','Sertifikasi Teknisi FO BNSP','sertifikasi','Sertifikasi kompetensi teknisi fiber optik BNSP',
       array['Teknisi Lapangan','Mitra Teknisi']),
    ('CUSTOMER-SERVICE','Layanan Pelanggan','manajerial','Kemampuan komunikasi & penanganan keluhan pelanggan',
       array['Staff Commerce','Dispatcher'])
  ) as c(code,name,category,descr,positions)
  returning id, code
)
select * from ins;

-- penilaian kompetensi untuk teknisi: 3 kompetensi teknis relevan per teknisi
insert into employee_competencies (company_id, employee_id, competency_id, level, assessed_at, assessed_by, expiry_date, evidence_url)
select (select id from t_company), tk.id, tc.id,
  (array['dasar','madya','utama'])[1 + ((tk.rn + ci.n) % 3)],
  date '2026-05-15',
  (select id from t_profile where role='manager_hr'),
  case when tc.code = 'SERT-FO-BNSP' then date '2028-05-15' else null end,
  'https://files.nusakarya.test/evidence/' || tk.nip || '-' || tc.code || '.pdf'
from t_teknisi tk
cross join lateral (select tc.id, tc.code, n from (values
    ('FO-SPLICING',1),('FO-OTDR',2),('K3-KETINGGIAN',3)
  ) as x(code,n) join t_competency tc on tc.code = x.code) ci(id, code, n)
join t_competency tc on tc.id = ci.id;

select count(*) as n_competencies from competencies;
select count(*) as n_employee_competencies from employee_competencies;

-- =====================================================================
-- PART 1c: HR — Pelatihan
-- =====================================================================
create temp table t_training as
with ins as (
  insert into trainings (company_id, training_no, title, training_type, competency_id, provider, start_date, end_date,
    location, cost, quota, status)
  select (select id from t_company), t.tno, t.title, t.ttype,
    (select id from t_competency where code = t.comp_code), t.provider, t.sdate, t.edate, t.loc, t.cost, t.quota, t.st
  from (values
    ('TRN/2026/00001','Pelatihan Splicing Fiber Optik','internal','FO-SPLICING','Internal Trainer NKMT',
       date '2026-04-10', date '2026-04-11','Kantor Cabang Pekanbaru',3000000,15,'selesai'),
    ('TRN/2026/00002','Sertifikasi K3 Ketinggian','sertifikasi','K3-KETINGGIAN','Lembaga Sertifikasi Kemnaker',
       date '2026-05-05', date '2026-05-07','Kantor Cabang Batam',12000000,12,'selesai'),
    ('TRN/2026/00003','Induksi K3 Karyawan Baru','induksi_K3','K3-DASAR','Internal Trainer NKMT',
       date '2026-06-01', date '2026-06-01','Kantor Cabang Padang',1500000,20,'selesai'),
    ('TRN/2026/00004','Workshop Manajemen Proyek Deployment','eksternal','MANAJEMEN-PROYEK','Konsultan PM Academy',
       date '2026-07-14', date '2026-07-15','Kantor Cabang Pekanbaru',9000000,10,'selesai'),
    ('TRN/2026/00005','Sertifikasi Teknisi FO BNSP','sertifikasi','SERT-FO-BNSP','LSP Telekomunikasi',
       date '2026-08-03', date '2026-08-06','Kantor Cabang Dumai',15000000,15,'berjalan'),
    ('TRN/2026/00006','Pelatihan Layanan Pelanggan','internal','CUSTOMER-SERVICE','Internal Trainer NKMT',
       date '2026-09-10', date '2026-09-10','Kantor Cabang Bukittinggi',2000000,10,'rencana')
  ) as t(tno,title,ttype,comp_code,provider,sdate,edate,loc,cost,quota,st)
  returning id, training_no
)
select * from ins;

insert into training_participants (company_id, training_id, employee_id, attendance, score, certificate_url)
select (select id from t_company), tr.id, p.employee_id,
  p.attendance,
  case when p.attendance in ('lulus','hadir') then (70 + (p.rn*3)%30)::numeric else null end,
  case when p.attendance = 'lulus' then 'https://files.nusakarya.test/certs/' || tr.training_no || '-' || p.rn || '.pdf' else null end
from t_training tr
join lateral (
  select tk.id as employee_id, tk.rn,
    case when tr.training_no in ('TRN/2026/00002','TRN/2026/00005') then
      (array['lulus','lulus','lulus','tidak_lulus'])[1 + (tk.rn % 4)]
    else
      (array['hadir','hadir','hadir','tidak_hadir'])[1 + (tk.rn % 4)]
    end as attendance
  from t_teknisi tk
  where tk.rn <= 12
) p on true;

select count(*) as n_trainings from trainings;
select count(*) as n_training_participants from training_participants;
select 'PART 1b/1c (kompetensi & pelatihan) OK' as status;

-- =====================================================================
-- PART 2: HR — Lembur, SPPD, Disiplin, Kinerja
-- =====================================================================
insert into overtime_requests (company_id, spl_no, employee_id, work_date, start_at, end_at, hours, reason,
  status, approved_by, approved_at, calculated_amount)
select
  (select id from t_company), 'SPL/2026/' || lpad(g.i::text,5,'0'), tk.id,
  wdate, wdate + time '17:00', wdate + time '17:00' + (hrs || ' hours')::interval, hrs,
  'Penyelesaian pekerjaan lapangan di luar jam kerja normal',
  st.status,
  case when st.status <> 'diajukan' then (select id from t_profile where role='manager_operations') else null end,
  case when st.status <> 'diajukan' then (wdate + time '18:00')::timestamptz else null end,
  case when st.status in ('disetujui','dibayar') then hrs * 30000 else 0 end
from generate_series(1,180) as g(i)
join t_teknisi tk on tk.rn = 1 + ((g.i - 1) % (select count(*) from t_teknisi))
cross join lateral (select (date '2026-04-01' + ((g.i*11) % 169) * interval '1 day')::date as wdate) d(wdate)
cross join lateral (select (1 + (g.i % 4))::numeric as hrs) h(hrs)
cross join lateral (
  select case
    when g.i % 100 < 30 then 'dibayar'
    when g.i % 100 < 75 then 'disetujui'
    when g.i % 100 < 90 then 'diajukan'
    else 'ditolak'
  end as status
) st;

select count(*) as n_overtime_requests from overtime_requests;

-- SPPD (business_trips) + biaya
create temp table t_trip as
with ins as (
  insert into business_trips (company_id, sppd_no, employee_id, destination, purpose, start_date, end_date,
    transport_type, daily_allowance, total_advance, status, approved_by)
  select
    (select id from t_company), 'SPPD/2026/' || lpad(g.i::text,5,'0'), te.id,
    dest.name, purp.name,
    sdate, sdate + (dur || ' days')::interval,
    trn.name, 350000,
    (350000 * dur) + trn.cost,
    st.status,
    case when st.status <> 'diajukan' then (select id from t_profile where role='manager_deployment') else null end
  from generate_series(1,30) as g(i)
  join t_employee te on te.rn = 1 + ((g.i*3) % 60)
  cross join lateral (select (date '2026-04-05' + ((g.i*17) % 160) * interval '1 day')::date as sdate) d(sdate)
  cross join lateral (select 2 + (g.i % 4) as dur) du(dur)
  cross join lateral (select (array['Jakarta','Medan','Palembang','Jambi','Bengkulu','Batam','Padang','Dumai'])[1+(g.i%8)] as name) dest(name)
  cross join lateral (select (array['Survey Lokasi Proyek Baru','Koordinasi Kontrak dengan Customer','Instalasi di Luar Cabang','Audit K3 Cabang','Pelatihan Eksternal'])[1+(g.i%5)] as name) purp(name)
  cross join lateral (select case when g.i % 3 = 0 then 'udara' else 'darat' end as name, case when g.i % 3 = 0 then 1500000 else 400000 end as cost) trn(name, cost)
  cross join lateral (
    select case
      when g.i % 100 < 55 then 'selesai'
      when g.i % 100 < 75 then 'disetujui'
      when g.i % 100 < 85 then 'berjalan'
      when g.i % 100 < 95 then 'diajukan'
      else 'ditolak'
    end as status
  ) st
  returning id, sppd_no, status
)
select * from ins;

insert into trip_expenses (company_id, trip_id, expense_date, category, description, amount, receipt_url, status)
select (select id from t_company), tt.id, base_date + (n-1)*interval '1 day', cat.name, cat.descr, cat.amt,
  'https://files.nusakarya.test/receipt/' || tt.sppd_no || '-' || n || '.pdf',
  case when tt.status in ('selesai') then 'dibayar' when tt.status in ('disetujui','berjalan') then 'disetujui' else 'diajukan' end
from t_trip tt
cross join lateral (select current_date - 30 as base_date) bd(base_date)
cross join generate_series(1,2) as n
cross join lateral (
  select case n when 1 then 'penginapan' else 'makan' end as name,
    case n when 1 then 'Akomodasi hotel selama dinas' else 'Uang makan selama dinas' end as descr,
    case n when 1 then 450000 else 150000 end as amt
) cat;

select count(*) as n_business_trips from business_trips;
select count(*) as n_trip_expenses from trip_expenses;

-- Disciplinary actions
insert into disciplinary_actions (company_id, employee_id, action_no, action_type, violation_date, violation_category,
  description, issued_date, valid_until, issued_by, document_url, status)
select (select id from t_company), tk.id, 'SP/2026/' || lpad(g.i::text,5,'0'), da.atype,
  vdate, da.category, da.descr, vdate + 3, vdate + interval '6 months',
  (select id from t_profile where role='manager_hr'),
  'https://files.nusakarya.test/disiplin/SP-2026-' || lpad(g.i::text,5,'0') || '.pdf',
  case when g.i = 8 then 'berakhir' else 'aktif' end
from generate_series(1,8) as g(i)
join t_teknisi tk on tk.rn = 1 + ((g.i*5) % (select count(*) from t_teknisi))
cross join lateral (select (date '2026-04-10' + (g.i*20) * interval '1 day')::date as vdate) v(vdate)
cross join lateral (
  select
    (array['teguran_lisan','teguran_tertulis','SP1','SP1','SP2'])[1+((g.i-1)%5)] as atype,
    (array['Keterlambatan berulang','Tidak memakai APD lengkap','Absen tanpa keterangan','Pelanggaran SOP K3','Kelalaian penanganan pelanggan'])[1+((g.i-1)%5)] as category,
    'Pelanggaran disiplin kerja sesuai laporan supervisor lapangan' as descr
) da;

select count(*) as n_disciplinary_actions from disciplinary_actions;

-- Performance reviews (semua 60 karyawan, periode 2026-Q2)
create temp table t_review as
with ins as (
  insert into performance_reviews (company_id, employee_id, period_code, review_type, total_score, grade,
    strengths, improvements, reviewer_id, reviewed_at, status)
  select (select id from t_company), te.id, '2026-Q2', 'triwulan',
    sc.score,
    case when sc.score >= 90 then 'A' when sc.score >= 80 then 'B' when sc.score >= 70 then 'C'
         when sc.score >= 60 then 'D' else 'E' end,
    'Konsisten mencapai target produktivitas dan disiplin waktu',
    'Perlu peningkatan dokumentasi laporan pekerjaan',
    (select id from t_profile where role='manager_hr'),
    (date '2026-07-10')::timestamptz,
    case when te.rn % 10 = 0 then 'diajukan' else 'disetujui' end
  from t_employee te
  cross join lateral (select (60 + (te.rn * 7) % 40)::numeric as score) sc
  returning id, employee_id
)
select * from ins;

insert into performance_review_items (company_id, review_id, aspect, weight_percent, target_value, actual_value, score, note)
select (select id from t_company), tr.id, a.aspect, a.weight, 100, av.actual, round(av.actual * a.weight / 100.0, 2), null
from t_review tr
cross join lateral (
  select unnest(array['Kualitas Kerja','Kedisiplinan','Produktivitas']) as aspect,
         unnest(array[40,30,30]) as weight
) a
cross join lateral (select (65 + (('x'||md5(tr.id::text||a.aspect))::bit(20)::int % 30))::numeric as actual) av;

select count(*) as n_performance_reviews from performance_reviews;
select count(*) as n_performance_review_items from performance_review_items;
select 'PART 2 (lembur/sppd/disiplin/kinerja) OK' as status;

-- =====================================================================
-- PART 3: HSE/K3 — Insiden, Inspeksi, Izin Kerja
-- =====================================================================
insert into hse_incidents (company_id, incident_no, incident_date, incident_type, location, lat, lng, branch_id,
  employee_id, work_order_id, description, immediate_action, root_cause_id, corrective_action, lost_days,
  cost_estimate, status, reported_by, closed_at)
select (select id from t_company), 'HSE-INC/2026/' || lpad(g.i::text,5,'0'), idate, itype,
  'Lokasi kerja ' || br.code, b.lat + (random()-0.5)*0.05, b.lng + (random()-0.5)*0.05, br.id,
  tk.id,
  case when g.i % 3 = 0 then (select id from t_workorder where rn = 1 + (g.i % (select count(*) from t_workorder))) else null end,
  'Kejadian ' || itype || ' saat pekerjaan lapangan',
  'Penghentian sementara pekerjaan dan evaluasi area kerja',
  (select id from t_root_cause where rn = 1 + (g.i % (select count(*) from t_root_cause))),
  case when itype in ('sedang','berat') then 'Perbaikan SOP dan briefing ulang K3' else null end,
  case itype when 'nearmiss' then 0 when 'ringan' then (g.i % 2) when 'sedang' then 2 + (g.i % 3) else 10 + (g.i % 5) end,
  case itype when 'nearmiss' then 0 when 'ringan' then 250000 when 'sedang' then 2500000 else 15000000 end,
  case when g.i <= 11 then 'selesai' when g.i <= 13 then 'investigasi' else 'dilaporkan' end,
  (select id from t_profile where role='teknisi'),
  case when g.i <= 11 then (idate + 5)::timestamptz else null end
from generate_series(1,14) as g(i)
join t_branch br on br.rn = 1 + ((g.i-1) % 5)
join branches b on b.id = br.id
join t_teknisi tk on tk.rn = 1 + ((g.i*3) % (select count(*) from t_teknisi))
cross join lateral (select (date '2026-04-01' + (g.i*23) % 169 * interval '1 day')::date as idate) d(idate)
cross join lateral (
  select (array['nearmiss','nearmiss','nearmiss','nearmiss','nearmiss','nearmiss',
                'ringan','ringan','ringan','ringan','ringan','sedang','sedang','berat'])[g.i] as itype
) t(itype);

select count(*) as n_hse_incidents from hse_incidents;

insert into hse_inspections (company_id, inspection_no, inspection_date, inspection_type, branch_id, inspector_id,
  target_ref, findings, score, result, follow_up, due_date, status)
select (select id from t_company), 'HSE-INS/2026/' || lpad(g.i::text,5,'0'), idate, itype.name, br.id, tk.id,
  itype.name || ' - ' || br.code,
  jsonb_build_array(jsonb_build_object('item','Kelengkapan APD','ok', res.result='aman')),
  res.score, res.result,
  case when res.result <> 'aman' then 'Tindak lanjut perbaikan dalam 7 hari' else null end,
  case when res.result <> 'aman' then idate + 7 else null end,
  'selesai'
from generate_series(1,40) as g(i)
join t_branch br on br.rn = 1 + ((g.i-1) % 5)
join t_teknisi tk on tk.rn = 1 + ((g.i*7) % (select count(*) from t_teknisi))
cross join lateral (select (date '2026-04-01' + (g.i*17) % 169 * interval '1 day')::date as idate) d(idate)
cross join lateral (select (array['APD','kendaraan','alat','lokasi_kerja','ketinggian'])[1+((g.i-1)%5)] as name) itype
cross join lateral (
  select case when g.i % 20 = 0 then 'tidak_aman' when g.i % 4 = 0 then 'perlu_perbaikan' else 'aman' end as result,
    case when g.i % 20 = 0 then 55 when g.i % 4 = 0 then 75 else 95 end as score
) res;

select count(*) as n_hse_inspections from hse_inspections;

insert into work_permits (company_id, permit_no, permit_type, work_order_id, location, lat, lng, valid_from, valid_to,
  requested_by, approved_by, approved_at, safety_checklist, status)
select (select id from t_company), 'SIKA/2026/' || lpad(g.i::text,5,'0'), 'kerja_ketinggian',
  wo.id, 'Lokasi kerja ketinggian - ' || br.code,
  b.lat + (random()-0.5)*0.05, b.lng + (random()-0.5)*0.05,
  vdate + time '07:00', vdate + time '17:00',
  (select id from t_profile where role='teknisi'),
  case when st.status in ('disetujui','aktif','ditutup') then (select id from t_profile where role='manager_operations') else null end,
  case when st.status in ('disetujui','aktif','ditutup') then (vdate + time '06:30')::timestamptz else null end,
  jsonb_build_array(
    jsonb_build_object('item','Full body harness','ok', true),
    jsonb_build_object('item','Safety helmet & sepatu safety','ok', true),
    jsonb_build_object('item','Tangga/lift standar','ok', st.status <> 'ditolak')
  ),
  st.status
from generate_series(1,55) as g(i)
join t_branch br on br.rn = 1 + ((g.i-1) % 5)
join branches b on b.id = br.id
join t_workorder wo on wo.rn = 1 + ((g.i*13) % (select count(*) from t_workorder))
cross join lateral (select (date '2026-04-01' + (g.i*9) % 169 * interval '1 day')::date as vdate) d(vdate)
cross join lateral (
  select case
    when g.i % 100 < 55 then 'ditutup'
    when g.i % 100 < 75 then 'aktif'
    when g.i % 100 < 88 then 'disetujui'
    when g.i % 100 < 95 then 'diajukan'
    else 'ditolak'
  end as status
) st;

select count(*) as n_work_permits from work_permits;
select 'PART 3 (HSE) OK' as status;

-- =====================================================================
-- PART 4: Payroll Freelance — tarif pajak, mitra, rate card, payout
-- =====================================================================

-- tarif progresif PPh Pasal 17 UU HPP (referensi, perlu verifikasi ulang)
insert into tax_brackets_art17 (company_id, min_income, max_income, rate, effective_from)
select (select id from t_company), b.min_income, b.max_income, b.rate, date '2022-01-01'
from (values
  (0::numeric, 60000000::numeric, 0.05::numeric),
  (60000000::numeric, 250000000::numeric, 0.15::numeric),
  (250000000::numeric, 500000000::numeric, 0.25::numeric),
  (500000000::numeric, 5000000000::numeric, 0.30::numeric),
  (5000000000::numeric, null, 0.35::numeric)
) as b(min_income, max_income, rate);

select count(*) as n_tax_brackets_art17 from tax_brackets_art17;

-- tandai ~18 karyawan sebagai mitra freelance (5 sudah MITRA sejak seed dasar + 13 tambahan)
update employees set employment_type = 'MITRA'
where nip in ('NKMT-0011','NKMT-0013','NKMT-0015','NKMT-0017','NKMT-0019','NKMT-0021','NKMT-0023',
              'NKMT-0025','NKMT-0027','NKMT-0029','NKMT-0031','NKMT-0033','NKMT-0035');

update employees set payroll_scheme = 'freelance'
where nip in ('NKMT-0010','NKMT-0011','NKMT-0013','NKMT-0015','NKMT-0017','NKMT-0019','NKMT-0021','NKMT-0023',
              'NKMT-0025','NKMT-0027','NKMT-0029','NKMT-0031','NKMT-0033','NKMT-0035',
              'NKMT-0045','NKMT-0046','NKMT-0047','NKMT-0048');

select count(*) as n_mitra_freelance from employees where payroll_scheme = 'freelance';

create temp table t_mitra as
  select id, nip, row_number() over (order by nip) as rn
  from employees where payroll_scheme = 'freelance';

-- rate card umum per jenis pekerjaan untuk mitra (employee_id & vendor_id null = tarif umum)
insert into freelance_rate_cards (company_id, employee_id, vendor_id, job_type_id, rate_amount, min_qty,
  effective_date, is_active, note)
select (select id from t_company), null, null, jt.id, jt.tariff_amount, 1, date '2026-01-01', true,
  'Tarif umum mitra freelance mengikuti tarif produktivitas job type'
from job_types jt;

select count(*) as n_freelance_rate_cards from freelance_rate_cards;

-- payout mitra per periode, bersumber dari productivity_entries mitra
create temp table t_frl_agg as
select pe.employee_id, to_char(pe.work_date,'YYYY-MM') as period_code, sum(pe.amount) as gross_amount
from productivity_entries pe
join t_mitra m on m.id = pe.employee_id
group by pe.employee_id, to_char(pe.work_date,'YYYY-MM');

create temp table t_frl_payout as
with numbered as (
  select *, row_number() over (order by period_code, employee_id) as rn from t_frl_agg
),
calc as (
  select n.*, m.nip,
    (('x' || substr(md5(n.employee_id::text||n.period_code),1,4))::bit(16)::int % 2 = 0) as has_npwp,
    case when n.period_code < '2026-09' then 'dibayar' else 'draft' end as pstatus
  from numbered n
  join t_mitra m on m.id = n.employee_id
),
ins as (
  insert into freelance_payouts (company_id, payout_no, period_code, employee_id, payee_type, gross_amount,
    dpp_percent, dpp_amount, tax_scheme, tax_rate, tax_amount, other_deduction, net_amount, npwp, has_npwp,
    status, paid_at, payment_ref, note)
  select (select id from t_company), 'FRL/2026/' || lpad(c.rn::text,5,'0'), c.period_code, c.employee_id,
    'orang_pribadi', c.gross_amount,
    50, round(c.gross_amount * 0.5, 2), 'pph21_bukan_pegawai',
    0.05, fn_hitung_pph21_bukan_pegawai(c.gross_amount, c.has_npwp), 0,
    c.gross_amount - fn_hitung_pph21_bukan_pegawai(c.gross_amount, c.has_npwp),
    case when c.has_npwp then '09.' || lpad((1000+c.rn)::text,3,'0') || '.234.5-211.000' else null end,
    c.has_npwp,
    c.pstatus,
    case when c.pstatus = 'dibayar' then (to_date(c.period_code || '-01','YYYY-MM-DD') + interval '1 month' + interval '3 days')::timestamptz else null end,
    case when c.pstatus = 'dibayar' then 'TRF/FRL/2026/' || lpad(c.rn::text,5,'0') else null end,
    'Payout mitra ' || c.nip || ' periode ' || c.period_code
  from calc c
  returning id, employee_id, period_code
)
select * from ins;

select count(*) as n_freelance_payouts from freelance_payouts;

insert into freelance_payout_lines (company_id, payout_id, productivity_entry_id, work_order_id, job_type_id,
  work_date, description, qty, rate, amount, qc_passed)
select (select id from t_company), fp.id, pe.id, pe.work_order_id, pe.job_type_id, pe.work_date,
  jt.name, pe.qty,
  case when pe.qty > 0 then round(pe.amount / pe.qty, 2) else pe.amount end,
  pe.amount,
  pe.status <> 'draft'
from t_frl_payout fp
join productivity_entries pe on pe.employee_id = fp.employee_id and to_char(pe.work_date,'YYYY-MM') = fp.period_code
join job_types jt on jt.id = pe.job_type_id;

select count(*) as n_freelance_payout_lines from freelance_payout_lines;
select 'PART 4 (payroll freelance) OK' as status;

-- =====================================================================
-- PART 5: Commerce — Opportunity (CRM) & Komplain Pelanggan
-- =====================================================================
create temp table t_opportunity as
with ins as (
  insert into opportunities (company_id, opp_no, title, customer_id, opportunity_type, estimated_value,
    probability_percent, stage, source, submit_deadline, decision_date, owner_id, competitor_note, lost_reason, note)
  select (select id from t_company), 'OPP/2026/' || lpad(g.i::text,5,'0'),
    'Perluasan Jaringan FTTH - ' || cu.name || ' Fase ' || (1+(g.i%4)),
    cu.id, otype.name, (300000000 + (g.i * 91) % 2700000000)::numeric,
    prob.pct, stg.name, src.name,
    date '2026-04-01' + (g.i*11) * interval '1 day',
    case when stg.name in ('menang','kalah','batal') then (date '2026-04-01' + (g.i*11+20) * interval '1 day') else null end,
    (select id from t_employee where nip = (array['NKMT-0003','NKMT-0057'])[1+(g.i%2)]),
    case when g.i % 4 = 0 then 'Bersaing dengan kompetitor lokal pada harga' else null end,
    case when stg.name = 'kalah' then 'Kalah harga dengan kompetitor' else null end,
    'Peluang perluasan layanan pada area cakupan existing'
  from generate_series(1,20) as g(i)
  join t_customer cu on cu.rn = 1 + ((g.i-1) % 3)
  cross join lateral (select (array['tender','penunjukan_langsung','perpanjangan','upsell'])[1+(g.i%4)] as name) otype
  cross join lateral (select (array['lead','kualifikasi','penawaran','negosiasi','menang','kalah','batal'])[1+(g.i%7)] as name) stg
  cross join lateral (select case stg.name when 'menang' then 100 when 'kalah' then 0 when 'batal' then 0
      when 'negosiasi' then 70 when 'penawaran' then 50 when 'kualifikasi' then 30 else 10 end as pct) prob
  cross join lateral (select (array['Tender Resmi','Referensi Internal','Follow-up Existing Customer'])[1+(g.i%3)] as name) src
  returning id, opp_no
)
select * from ins;

insert into opportunity_activities (company_id, opportunity_id, activity_date, activity_type, note)
select (select id from t_company), o.id, date '2026-04-05' + (n*15) * interval '1 day',
  (array['Meeting Awal','Site Visit','Penawaran Terkirim','Follow-up Call','Negosiasi Harga'])[1+((n)%5)],
  'Aktivitas tindak lanjut opportunity ' || o.opp_no
from t_opportunity o
cross join generate_series(0,1) as n;

select count(*) as n_opportunities from opportunities;
select count(*) as n_opportunity_activities from opportunity_activities;

insert into customer_complaints (company_id, complaint_no, customer_id, contract_id, complaint_date, channel,
  category, severity, description, root_cause_id, corrective_action, resolved_at, csat_score, status, pic_id)
select (select id from t_company), 'CMP/2026/' || lpad(g.i::text,5,'0'), cu.id,
  (select id from t_contract where customer_id = cu.id limit 1),
  cdate, ch.name, cat.name, sev.name,
  'Keluhan pelanggan terkait ' || cat.name,
  case when sev.name = 'tinggi' then (select id from t_root_cause where rn = 1 + (g.i % (select count(*) from t_root_cause))) else null end,
  case when st.name = 'selesai' then 'Perbaikan dilakukan dan dikonfirmasi ke pelanggan' else null end,
  case when st.name = 'selesai' then (cdate + 3)::timestamptz else null end,
  case when st.name = 'selesai' then 2 + (g.i % 4) else null end,
  st.name,
  (select id from t_employee where nip = (array['NKMT-0003','NKMT-0057'])[1+(g.i%2)])
from generate_series(1,18) as g(i)
join t_customer cu on cu.rn = 1 + ((g.i-1) % 3)
cross join lateral (select (date '2026-04-01' + (g.i*13) % 169 * interval '1 day')::date as cdate) d(cdate)
cross join lateral (select (array['Telepon','Email','Aplikasi','Datang Langsung'])[1+(g.i%4)] as name) ch
cross join lateral (select (array['Gangguan Layanan','Billing','Kualitas Instalasi','Lainnya'])[1+(g.i%4)] as name) cat
cross join lateral (select (array['rendah','sedang','tinggi'])[1+(g.i%3)] as name) sev
cross join lateral (select case when g.i % 6 = 0 then 'eskalasi' when g.i % 3 = 0 then 'proses' when g.i%9=0 then 'baru' else 'selesai' end as name) st;

select count(*) as n_customer_complaints from customer_complaints;
select 'PART 5 (commerce/CRM) OK' as status;

-- =====================================================================
-- PART 6: Procurement — Kontrak Vendor & Retur (RTV)
-- =====================================================================
insert into vendor_contracts (company_id, contract_no, vendor_id, contract_type, start_date, end_date,
  ceiling_value, used_value, payment_term_days, status, file_url, note)
select (select id from t_company), 'VC/2026/' || lpad(g.i::text,5,'0'), v.id, ctype.name,
  date '2026-01-01', date '2026-12-31',
  ceiling.amt, round(ceiling.amt * (0.2 + (g.i%5)*0.1), 2), 30, 'aktif',
  'https://files.nusakarya.test/kontrak-vendor/VC-2026-' || lpad(g.i::text,5,'0') || '.pdf',
  'Kontrak kerangka pengadaan tahun 2026 dengan ' || v.name
from generate_series(1,6) as g(i)
join t_vendor v on v.rn = g.i
cross join lateral (select (array['rangka','blanket_po','sewa','jasa_berkala'])[1+(g.i%4)] as name) ctype
cross join lateral (select (500000000 + (g.i*137000000))::numeric as amt) ceiling;

select count(*) as n_vendor_contracts from vendor_contracts;

create temp table t_rtv as
with ins as (
  insert into vendor_returns (company_id, rtv_no, rtv_date, vendor_id, gr_id, po_id, reason, total_amount, status, note)
  select (select id from t_company), 'RTV/2026/' || lpad(g.i::text,5,'0'),
    date '2026-05-01' + (g.i*23) * interval '1 day',
    gr.vendor_id, gr.gr_id, gr.po_id,
    'Barang tidak sesuai spesifikasi teknis pada saat inspeksi', 0,
    (array['diajukan','disetujui','dikirim','selesai','ditolak'])[g.i],
    'Retur ke vendor karena hasil QC tidak memenuhi standar'
  from generate_series(1,5) as g(i)
  join t_gr gr on gr.rn = g.i
  returning id, rtv_no
)
select * from ins;

insert into vendor_return_items (company_id, rtv_id, item_id, qty, uom, price, amount, reason)
select (select id from t_company), r.id, it.id, qty.n, it.uom, price.p, qty.n * price.p, 'Cacat produksi / tidak sesuai spesifikasi'
from (select id, row_number() over (order by rtv_no) as rn from t_rtv) r
join t_item it on it.rn = 1 + (r.rn % (select count(*) from t_item))
cross join lateral (select (5 + (r.rn*2))::numeric as n) qty
cross join lateral (select 75000::numeric as p) price;

select count(*) as n_vendor_returns from vendor_returns;
select count(*) as n_vendor_return_items from vendor_return_items;
select 'PART 6 (procurement) OK' as status;

-- =====================================================================
-- PART 7: Finance — COA, Jurnal Umum, Pajak, Kas Kecil, Kasbon, Bank
-- =====================================================================
insert into chart_of_accounts (company_id, account_code, account_name, account_type, parent_code, normal_balance, is_postable, is_active)
select (select id from t_company), a.code, a.name, a.atype, null, a.balance, true, true
from (values
  ('1101','Kas','aset','debit'),('1102','Kas Kecil','aset','debit'),
  ('1111','Bank BCA','aset','debit'),('1112','Bank Mandiri','aset','debit'),('1113','Bank BNI','aset','debit'),
  ('1201','Piutang Usaha','aset','debit'),('1202','Piutang Karyawan (Kasbon)','aset','debit'),('1203','PPN Masukan','aset','debit'),
  ('1301','Persediaan Material','aset','debit'),
  ('1401','Uang Muka Vendor','aset','debit'),('1402','Uang Muka Proyek','aset','debit'),
  ('1501','Aset Tetap - Kendaraan','aset','debit'),('1502','Aset Tetap - Peralatan','aset','debit'),
  ('1503','Akumulasi Penyusutan Aset Tetap','aset','kredit'),
  ('2101','Hutang Usaha','liabilitas','kredit'),('2102','Hutang PPh 21','liabilitas','kredit'),
  ('2103','Hutang PPh 23','liabilitas','kredit'),('2104','Hutang PPh 4(2) Final','liabilitas','kredit'),
  ('2105','PPN Keluaran','liabilitas','kredit'),('2106','Hutang BPJS Ketenagakerjaan','liabilitas','kredit'),
  ('2107','Hutang BPJS Kesehatan','liabilitas','kredit'),('2108','Biaya Yang Masih Harus Dibayar','liabilitas','kredit'),
  ('2201','Retensi Kontrak (Retention Payable)','liabilitas','kredit'),
  ('3101','Modal Disetor','ekuitas','kredit'),('3102','Laba Ditahan','ekuitas','kredit'),('3103','Laba Tahun Berjalan','ekuitas','kredit'),
  ('4101','Pendapatan Jasa Deployment','pendapatan','kredit'),('4102','Pendapatan Jasa Manage Service','pendapatan','kredit'),
  ('4103','Pendapatan Sewa Alat','pendapatan','kredit'),('4104','Pendapatan Lain-lain','pendapatan','kredit'),
  ('5101','Beban Gaji Pegawai Tetap','beban','debit'),('5102','Beban Lembur','beban','debit'),
  ('5103','Beban Payout Mitra Freelance','beban','debit'),('5104','Beban BPJS Perusahaan','beban','debit'),
  ('5105','Beban Material Proyek','beban','debit'),('5106','Beban Subkontraktor','beban','debit'),
  ('5107','Beban Sewa Kendaraan','beban','debit'),('5108','Beban BBM & Tol','beban','debit'),
  ('5109','Beban Perjalanan Dinas','beban','debit'),('5110','Beban Penyusutan','beban','debit'),
  ('5111','Beban Sewa Kantor','beban','debit'),('5112','Beban Listrik & Internet','beban','debit'),
  ('5113','Beban Pelatihan & Sertifikasi','beban','debit'),('5114','Beban K3 & APD','beban','debit'),
  ('5115','Beban Administrasi Bank','beban','debit')
) as a(code,name,atype,balance);

select count(*) as n_chart_of_accounts from chart_of_accounts;

create temp table t_jtx as
select i, tx.debit_code, tx.credit_code, tx.descr, tx.amt, tx.source_type,
  (date '2026-04-01' + (i*3) % 169 * interval '1 day')::date as jdate
from generate_series(1,120) as i
cross join lateral (
  select case i % 6
    when 0 then '5101' when 1 then '5103' when 2 then '1201' when 3 then '1301' when 4 then '5108' else '2101' end as debit_code,
    case i % 6
      when 0 then '1111' when 1 then '1112' when 2 then '4101' when 3 then '2101' when 4 then '1102' else '1111' end as credit_code,
    case i % 6
      when 0 then 'Pembayaran gaji pegawai tetap periode berjalan'
      when 1 then 'Pembayaran payout mitra freelance'
      when 2 then 'Pengakuan pendapatan jasa deployment/manage service'
      when 3 then 'Pembelian material proyek dari vendor'
      when 4 then 'Beban operasional BBM & tol kendaraan operasional'
      else 'Pembayaran hutang usaha ke vendor' end as descr,
    case i % 6
      when 0 then (60000000 + (i*731) % 90000000)::numeric
      when 1 then (5000000 + (i*211) % 25000000)::numeric
      when 2 then (80000000 + (i*977) % 420000000)::numeric
      when 3 then (5000000 + (i*331) % 45000000)::numeric
      when 4 then (500000 + (i*97) % 4500000)::numeric
      else (5000000 + (i*401) % 45000000)::numeric end as amt,
    case i % 6 when 0 then 'payroll_runs' when 1 then 'freelance_payouts' when 2 then 'ar_invoices'
      when 3 then 'purchase_orders' when 4 then 'petty_cash' else 'vendor_invoices' end as source_type
) tx;

create temp table t_journal as
with ins as (
  insert into journal_entries (company_id, journal_no, journal_date, description, source_type, source_id,
    total_debit, total_credit, status, posted_by, posted_at)
  select (select id from t_company), 'JV/2026/' || lpad(jt.i::text,5,'0'), jt.jdate, jt.descr, jt.source_type, null,
    jt.amt, jt.amt,
    case when jt.i % 10 = 0 then 'draft' else 'diposting' end,
    case when jt.i % 10 <> 0 then (select id from t_profile where role='manager_finance') else null end,
    case when jt.i % 10 <> 0 then (jt.jdate + 1)::timestamptz else null end
  from t_jtx jt
  returning id, journal_no
)
select ins.id, ins.journal_no, jt.debit_code, jt.credit_code, jt.descr, jt.amt
from ins join t_jtx jt on 'JV/2026/' || lpad(jt.i::text,5,'0') = ins.journal_no;

insert into journal_lines (company_id, journal_id, account_code, description, debit, credit, cost_center)
select (select id from t_company), j.id, j.debit_code, j.descr, j.amt, 0, 'HEAD OFFICE'
from t_journal j
union all
select (select id from t_company), j.id, j.credit_code, j.descr, 0, j.amt, 'HEAD OFFICE'
from t_journal j;

select count(*) as n_journal_entries from journal_entries;
select count(*) as n_journal_lines from journal_lines;

-- tax_records dari ar_invoices (PPN Keluaran + PPh23 bila ada) & vendor_invoices (PPN Masukan + PPh23)
create temp table t_tr as
  select 'ppn_keluaran' as ttype, 'ar_invoice' as ref_type, ari.id as ref_id, cu.name as cp_name, null::text as cp_npwp,
    ari.dpp, ari.ppn as tax_amount, ari.faktur_pajak_no as faktur, ari.invoice_date, row_number() over (order by ari.invoice_date) as rn
  from t_ar_invoice ari join customers cu on cu.id = ari.customer_id
union all
  select 'ppn_masukan', 'vendor_invoice', vi.id, ve.name, null,
    vi.dpp, vi.ppn, vi.faktur_pajak_no, vi.invoice_date, row_number() over (order by vi.invoice_date)
  from t_vendor_invoice vi join vendors ve on ve.id = vi.vendor_id;

insert into tax_records (company_id, record_no, tax_period, tax_type, ref_type, ref_id, counterparty_name,
  counterparty_npwp, dpp, tax_amount, faktur_no, bukti_potong_no, status)
select (select id from t_company), 'TAX/2026/' || lpad(row_number() over (order by rn)::text,5,'0'),
  to_char(invoice_date,'YYYY-MM'), ttype, ref_type, ref_id, cp_name, cp_npwp, dpp, tax_amount, faktur, null,
  case when faktur is not null then 'dilaporkan' else 'draft' end
from t_tr;

select count(*) as n_tax_records_ppn from tax_records;

-- tax_records PPh23 tambahan (bila pph23 > 0 pada ar/vendor invoices)
insert into tax_records (company_id, record_no, tax_period, tax_type, ref_type, ref_id, counterparty_name,
  counterparty_npwp, dpp, tax_amount, faktur_no, bukti_potong_no, status)
select (select id from t_company),
  'TAX/2026/' || lpad((900 + row_number() over (order by ari.invoice_date))::text,5,'0'),
  to_char(ari.invoice_date,'YYYY-MM'), 'pph23', 'ar_invoice', ari.id, cu.name, null, ari.dpp, ari.pph23, null,
  'BP-' || to_char(ari.invoice_date,'YYYYMM') || '-' || lpad(row_number() over (order by ari.invoice_date)::text,4,'0'),
  'dilaporkan'
from t_ar_invoice ari join customers cu on cu.id = ari.customer_id
where ari.pph23 > 0;

select count(*) as n_tax_records_total from tax_records;
select 'PART 7a (COA/jurnal/pajak) OK' as status;

-- =====================================================================
-- PART 7b: Finance — Kas Kecil, Kasbon, Bank & Rekonsiliasi
-- =====================================================================
insert into petty_cash (company_id, transaction_no, transaction_date, branch_id, direction, category, description,
  amount, balance_after, receipt_url, pic_id, status)
select (select id from t_company), 'PC/2026/' || lpad(g.i::text,5,'0'), tdate, br.id, dir.name, dir.cat, dir.descr,
  dir.amt, null,
  case when dir.name = 'out' then 'https://files.nusakarya.test/kaskecil/PC-2026-' || lpad(g.i::text,5,'0') || '.pdf' else null end,
  (select id from t_employee where nip = (array['NKMT-0007','NKMT-0059'])[1+(g.i%2)]),
  case when g.i % 15 = 0 then 'diajukan' else 'disetujui' end
from generate_series(1,90) as g(i)
join t_branch br on br.rn = 1 + ((g.i-1) % 5)
cross join lateral (select (date '2026-04-01' + (g.i*2) % 169 * interval '1 day')::date as tdate) d(tdate)
cross join lateral (
  select
    case when g.i % 10 = 0 then 'in' else 'out' end as name,
    case when g.i % 10 = 0 then 'Isi Ulang Kas' else (array['Operasional','ATK & Kantor','Transport Lokal','Konsumsi Rapat','Parkir & Tol'])[1+(g.i%5)] end as cat,
    case when g.i % 10 = 0 then 'Pengisian ulang dana kas kecil cabang' else 'Pengeluaran operasional kas kecil cabang' end as descr,
    case when g.i % 10 = 0 then 5000000::numeric else (50000 + (g.i*211) % 950000)::numeric end as amt
) dir;

select count(*) as n_petty_cash from petty_cash;

insert into employee_advances (company_id, advance_no, employee_id, request_date, purpose, amount, due_date,
  settled_amount, status, approved_by, note)
select (select id from t_company), 'KSB/2026/' || lpad(g.i::text,5,'0'), te.id, rdate,
  (array['Kebutuhan mendesak keluarga','Biaya pendidikan anak','Renovasi rumah','Biaya pengobatan'])[1+(g.i%4)],
  amt.n, rdate + 90,
  case st.name when 'lunas' then amt.n when 'sebagian_lunas' then round(amt.n*0.5,2) else 0 end,
  st.name,
  case when st.name <> 'diajukan' then (select id from t_profile where role='manager_finance') else null end,
  'Pengajuan kasbon karyawan'
from generate_series(1,22) as g(i)
join t_employee te on te.rn = 1 + ((g.i*3) % 60)
cross join lateral (select (date '2026-04-05' + (g.i*17) % 160 * interval '1 day')::date as rdate) d(rdate)
cross join lateral (select (500000 + (g.i*173000) % 4500000)::numeric as n) amt
cross join lateral (
  select case
    when g.i % 100 < 40 then 'lunas'
    when g.i % 100 < 65 then 'sebagian_lunas'
    when g.i % 100 < 80 then 'dicairkan'
    when g.i % 100 < 90 then 'disetujui'
    when g.i % 100 < 96 then 'diajukan'
    else 'ditolak'
  end as name
) st;

select count(*) as n_employee_advances from employee_advances;

create temp table t_bank as
with ins as (
  insert into bank_accounts (company_id, bank_name, account_no, account_holder, currency, opening_balance, current_balance, is_active)
  select (select id from t_company), b.name, b.acc, 'PT Nusakarya Mitra Telematika', 'IDR', b.opening, b.current, true
  from (values
    ('Bank BCA','1234567890', 500000000::numeric, 725000000::numeric),
    ('Bank Mandiri','9876543210', 300000000::numeric, 415000000::numeric),
    ('Bank BNI','5566778899', 150000000::numeric, 198000000::numeric)
  ) as b(name,acc,opening,current)
  returning id, bank_name
)
select * from ins;

select count(*) as n_bank_accounts from bank_accounts;

create temp table t_recon as
with ins as (
  insert into bank_reconciliations (company_id, recon_no, bank_account_id, period_start, period_end,
    statement_balance, book_balance, difference, status, note)
  select (select id from t_company), 'REC/2026/00001', (select id from t_bank where bank_name = 'Bank BCA'),
    date '2026-08-01', date '2026-08-31', 725000000, 723500000, 1500000, 'selesai',
    'Selisih karena biaya administrasi bank belum dicatat di buku besar'
  returning id
)
select * from ins;

insert into bank_statement_lines (company_id, recon_id, transaction_date, description, debit, credit,
  matched_ref_type, matched_ref_id, is_matched)
select (select id from t_company), r.id, date '2026-08-01' + (n*2) * interval '1 day',
  case when n % 3 = 0 then 'Setoran Kliring Customer' when n % 3 = 1 then 'Transfer Keluar Vendor' else 'Biaya Admin Bank' end,
  case when n % 3 = 1 then (2000000 + n*150000)::numeric when n % 3 = 2 then 25000 else 0 end,
  case when n % 3 = 0 then (5000000 + n*300000)::numeric else 0 end,
  case when n % 3 = 2 then null else 'journal_entries' end,
  null,
  n % 7 <> 0
from t_recon r
cross join generate_series(1,15) as n;

select count(*) as n_bank_reconciliations from bank_reconciliations;
select count(*) as n_bank_statement_lines from bank_statement_lines;
select 'PART 7b (kas/kasbon/bank) OK' as status;

-- =====================================================================
-- PART 8: Operations — NMS Alarm, Eskalasi, SLA Report, Knowledge Base
-- =====================================================================
create temp table t_netel as
  select id, name, row_number() over (order by name) as rn from network_elements;

insert into nms_alarms (company_id, alarm_id_ext, received_at, severity, source_system, network_element_id,
  element_ref, alarm_type, description, cleared_at, ticket_id, status, acknowledged_by, acknowledged_at)
select (select id from t_company), 'ALM-' || lpad(g.i::text,6,'0'), rtime, sev.name, src.name, ne.id, ne.name, atype.name,
  atype.name || ' terdeteksi pada ' || ne.name,
  case when st.name = 'clear' then rtime + (30 + g.i % 90) * interval '1 minute' else null end,
  case when g.i % 5 = 0 then (select id from t_ticket where rn = 1 + (g.i % (select count(*) from t_ticket))) else null end,
  st.name,
  case when st.name <> 'baru' then (select id from t_profile where role='dispatcher') else null end,
  case when st.name <> 'baru' then rtime + interval '5 minutes' else null end
from generate_series(1,220) as g(i)
join t_netel ne on ne.rn = 1 + ((g.i*7) % (select count(*) from t_netel))
cross join lateral (select (timestamp '2026-04-01 00:00' + (g.i*137) % 169 * interval '1 day' + (g.i*53) % 1440 * interval '1 minute')::timestamptz as rtime) r(rtime)
cross join lateral (select (array['critical','major','minor','warning'])[1+(g.i%4)] as name) sev
cross join lateral (select (array['NMS-Huawei','NMS-ZTE','EMS-OLT'])[1+(g.i%3)] as name) src
cross join lateral (select (array['LOS (Loss of Signal)','Power Down','High Temperature','Link Down','Fiber Cut Detected'])[1+(g.i%5)] as name) atype
cross join lateral (
  select case
    when g.i % 100 < 55 then 'clear'
    when g.i % 100 < 75 then 'tiket_dibuat'
    when g.i % 100 < 90 then 'diakui'
    when g.i % 100 < 97 then 'baru'
    else 'diabaikan'
  end as name
) st;

select count(*) as n_nms_alarms from nms_alarms;

insert into escalation_matrix (company_id, level, branch_id, severity, elapsed_minutes, role_to_notify, contact_name, contact_phone, note)
select (select id from t_company), lvl.level, null, 'critical', lvl.minutes, lvl.role, lvl.contact, lvl.phone, lvl.note
from (values
  (1, 15, 'Dispatcher Regional', 'Dispatcher Cabang', '0811-1000-001', 'Eskalasi awal ke dispatcher cabang terkait'),
  (2, 30, 'Supervisor Operations', 'Supervisor Operasional', '0811-1000-002', 'Eskalasi ke supervisor bila belum tertangani 30 menit'),
  (3, 60, 'Manager Operations', 'Manager Operations', '0811-1000-003', 'Eskalasi ke manager operations untuk insiden major/critical'),
  (4, 120, 'Direktur Utama', 'Direktur Utama', '0811-1000-004', 'Eskalasi puncak untuk insiden critical berkepanjangan')
) as lvl(level, minutes, role, contact, phone, note);

select count(*) as n_escalation_matrix from escalation_matrix;

create temp table t_sla_src as
select cu.id as customer_id, cu.name as customer_name, per.period_code, per.rn as prn,
  row_number() over (order by cu.rn, per.rn) as seq
from (select id, name, row_number() over (order by name) as rn from customers) cu
cross join lateral (
  select ('2026-0' || (3+n))::text as period_code, n as rn from generate_series(1,6) n
) per;

insert into sla_reports (company_id, report_no, customer_id, contract_id, period_code, total_tickets, met_count,
  breach_count, compliance_percent, mttr_minutes, penalty_amount, status, note)
select (select id from t_company), 'SLA/2026/' || lpad(s.seq::text,5,'0'), s.customer_id,
  (select id from t_contract where customer_id = s.customer_id limit 1),
  s.period_code, tt.total, tt.met, tt.total - tt.met,
  round(100.0 * tt.met / tt.total, 2), mttr.n,
  case when tt.total - tt.met > 0 then (tt.total - tt.met) * 2500000 else 0 end,
  case when s.prn <= 5 then 'disetujui' else 'diajukan' end,
  'Rekap SLA bulanan area layanan ' || s.customer_name
from t_sla_src s
cross join lateral (select (30 + (s.seq*7) % 40) as total) t0(total)
cross join lateral (select t0.total as total, greatest(t0.total - (s.prn % 4), t0.total - 6) as met) tt
cross join lateral (select (25 + (s.seq*11) % 60)::numeric as n) mttr;

select count(*) as n_sla_reports from sla_reports;

insert into knowledge_articles (company_id, article_no, title, category, symptom, root_cause, resolution_steps,
  applicable_to, view_count, is_published, author_id)
select (select id from t_company), 'KB/2026/' || lpad(g.i::text,5,'0'), a.title, a.category, a.symptom, a.rc, a.steps,
  a.applicable, (10 + g.i*7) % 250, g.i <= 13,
  (select id from t_employee where nip = 'NKMT-0008')
from generate_series(1,15) as g(i)
join (values
  (1,'Troubleshooting Redaman Tinggi pada ODP','Gangguan Layanan','Redaman optik di atas ambang batas pada pengukuran OPM',
     'Konektor kotor atau bending kabel berlebih','1. Cek kebersihan konektor 2. Ukur ulang dengan OTDR 3. Perbaiki bending radius',
     'GGN-ONT,GGN-WIFI'),
  (2,'Prosedur Splicing Fiber Optik Standar','Instalasi','Sambungan core menghasilkan loss tinggi',
     'Teknik cleaving tidak presisi','1. Cleave ulang core 2. Bersihkan fiber holder 3. Verifikasi hasil splice loss < 0.1dB',
     'SPLICING-12,SPLICING-24'),
  (3,'Penanganan ONT Tidak Menyala','Gangguan Layanan','Lampu indikator ONT mati total',
     'Adaptor rusak atau tegangan tidak stabil','1. Cek adaptor & stop kontak 2. Ganti adaptor jika perlu 3. Restart ONT',
     'GGN-ONT'),
  (4,'Prosedur Kerja Aman di Ketinggian','K3','Risiko jatuh saat instalasi tiang',
     'Kelalaian penggunaan APD','1. Pastikan full body harness terpasang 2. Cek kondisi tangga 3. Gunakan safety line',
     'PASANG-TIANG'),
  (5,'Migrasi Pelanggan ke ODP Baru','Provisioning','Layanan terputus saat migrasi',
     'Splitter belum dikonfigurasi','1. Konfirmasi port ODP baru 2. Splicing ulang 3. Uji redaman sebelum aktivasi',
     'PSB-MIGRASI'),
  (6,'Troubleshooting WiFi Lambat','Gangguan Layanan','Kecepatan WiFi jauh di bawah paket berlangganan',
     'Interferensi kanal atau posisi router','1. Ganti channel WiFi 2. Reposisi router 3. Update firmware router',
     'GGN-WIFI'),
  (7,'Standar Closure & Splitter di ODC','Instalasi','Closure bocor menyebabkan redaman naik saat hujan',
     'Sealing closure tidak sempurna','1. Bongkar closure 2. Ganti sealing gel 3. Pasang ulang sesuai SOP',
     'INSTALL-ODC'),
  (8,'Prosedur Penanganan Gangguan Massal','Assurance','Banyak pelanggan pada satu ODC melapor gangguan bersamaan',
     'Kabel feeder putus/fiber cut','1. Cek NMS untuk alarm ODC terkait 2. Kirim tim ke rute kabel 3. Lakukan splicing darurat',
     'GGN-MASSAL,FIBER-CUT'),
  (9,'Checklist Preventive Maintenance ODC','Maintenance','Redaman meningkat bertahap tanpa gangguan terlaporkan',
     'Debu/korosi pada konektor','1. Bersihkan seluruh konektor 2. Ukur redaman tiap port 3. Dokumentasikan hasil',
     'PREV-ODC'),
  (10,'Panduan Pengukuran OTDR Lapangan','Maintenance','Hasil OTDR tidak konsisten',
     'Kalibrasi alat atau panjang gelombang salah','1. Kalibrasi OTDR 2. Gunakan panjang gelombang sesuai standar 3. Simpan hasil ke sistem',
     'UKUR-OTDR'),
  (11,'SOP Perapihan Kabel Udara','Maintenance','Kabel kendur dan berisiko putus',
     'Instalasi awal tidak mengikuti standar tarikan','1. Ukur tegangan tarik ideal 2. Perapihan dengan clamp hook 3. Verifikasi hasil',
     'PERAPIHAN'),
  (12,'Panduan Survey Lokasi Sebelum Instalasi','Deployment','Estimasi material tidak akurat',
     'Survey tidak mendetail','1. Ukur jarak rute aktual 2. Identifikasi titik tiang/ODP 3. Dokumentasikan foto lokasi',
     'SURVEY-LOKASI'),
  (13,'Troubleshooting STB Tidak Ada Sinyal','Gangguan Layanan','STB menampilkan pesan no signal',
     'Kabel HDMI/koneksi longgar atau STB rusak','1. Cek kabel HDMI 2. Restart STB 3. Ganti STB jika perlu',
     'GGN-STB'),
  (14,'Prosedur Dismantle Jaringan Lama','Deployment','Material lama tidak tercatat saat pembongkaran',
     'Checklist dismantle tidak lengkap','1. Inventarisasi material sebelum bongkar 2. Kembalikan ke gudang 3. Update status di sistem',
     'DISMANTLE'),
  (15,'Panduan Layanan Pelanggan saat Komplain','Layanan Pelanggan','Pelanggan tidak puas dengan penanganan awal',
     'Kurangnya empati & follow-up','1. Dengarkan keluhan dengan aktif 2. Berikan estimasi waktu perbaikan 3. Follow-up hasil perbaikan',
     'CUSTOMER-SERVICE')
) as a(i,title,category,symptom,rc,steps,applicable) on a.i = g.i;

select count(*) as n_knowledge_articles from knowledge_articles;
select 'PART 8 (operations) OK' as status;

-- =====================================================================
-- PART 9: Deployment — Perizinan, Punch List, Garansi, Subkontrak
-- =====================================================================
create temp table t_pm as
  select id, row_number() over (order by nip) as rn from employees where position = 'Project Manager';
create temp table t_teknisi9 as
  select id, row_number() over (order by nip) as rn from employees where position = 'Teknisi Lapangan';
create temp table t_bast_proj as
  select b.id as bast_id, p.id as project_id, p.project_code,
         row_number() over (order by p.project_code, b.bast_no) as rn
  from bast b
  join t_project p on p.spk_id = b.spk_id;

-- ---------------------------------------------------------------------
-- permits (16)
-- ---------------------------------------------------------------------
insert into permits (company_id, permit_no, project_id, permit_type, authority_name, applied_date,
  issued_date, expiry_date, cost, status, pic_id, note)
select (select id from t_company), 'IZN/2026/' || lpad(g.i::text,5,'0'),
  p.id, ptype.name, auth_name.name, ap.applied,
  case when st.name = 'terbit' then ap.applied + (5 + g.i % 10) else null end,
  case when st.name = 'terbit' then ap.applied + 365 else null end,
  (500000 + (g.i*137000) % 4000000)::numeric,
  st.name,
  pm.id,
  'Perizinan ' || ptype.name || ' untuk proyek ' || p.project_code
from generate_series(1,16) as g(i)
join t_project p on p.rn = 1 + (g.i % 10)
join t_pm pm on pm.rn = 1 + (g.i % (select count(*) from t_pm))
cross join lateral (select (array['row','galian','pemda','kawasan','ketinggian','lingkungan'])[1+(g.i%6)] as name) ptype
cross join lateral (select (array['Dinas PUPR Kota','Dinas Perhubungan','Kelurahan Setempat','PLN Wilayah','Pemda Kabupaten'])[1+(g.i%5)] as name) auth_name
cross join lateral (select (date '2026-04-01' + ((g.i*11) % 150)) as applied) ap
cross join lateral (
  select case
    when g.i % 6 = 0 then 'ditolak'
    when g.i % 7 = 0 then 'kedaluwarsa'
    when g.i % 5 = 0 then 'proses'
    when g.i % 4 = 0 then 'diajukan'
    when g.i % 9 = 0 then 'disiapkan'
    else 'terbit'
  end as name
) st;

select count(*) as n_permits from permits;

-- ---------------------------------------------------------------------
-- punch_lists (60)
-- ---------------------------------------------------------------------
insert into punch_lists (company_id, punch_no, project_id, bast_id, found_date, location, lat, lng,
  category, description, severity, assigned_to, due_date, fixed_date, verified_by, status)
select (select id from t_company), 'PL/2026/' || lpad(g.i::text,5,'0'),
  bp.project_id, bp.bast_id,
  fdate.d, ('Titik ODP-' || lpad(((g.i*3) % 60 + 1)::text,3,'0')),
  (-0.450 - (g.i % 100)::numeric/1000), (101.300 + (g.i % 150)::numeric/1000),
  cat.name, (cat.name || ' perlu perbaikan pada ' || bp.project_code),
  sev.name,
  tek.id,
  fdate.d + 7,
  case when g.i % 5 in (1,2,4) then fdate.d + (3 + g.i % 8) else null end,
  case when g.i % 5 in (2,4) then (select id from t_profile where role = 'manager_deployment') else null end,
  st.name
from generate_series(1,60) as g(i)
join t_bast_proj bp on bp.rn = 1 + (g.i % (select count(*) from t_bast_proj))
join t_teknisi9 tek on tek.rn = 1 + (g.i % (select count(*) from t_teknisi9))
cross join lateral (select (date '2026-04-05' + ((g.i*13) % 160)) as d) fdate
cross join lateral (select (array['Instalasi','Sipil','Pertamanan','Kabel','Perangkat Aktif'])[1+(g.i%5)] as name) cat
cross join lateral (select (array['minor','minor','mayor','kritis'])[1+(g.i%4)] as name) sev
cross join lateral (
  select case g.i % 5
    when 0 then 'terbuka'
    when 1 then 'diperbaiki'
    when 2 then 'diverifikasi'
    when 3 then 'ditolak'
    else 'ditutup'
  end as name
) st;

select count(*) as n_punch_lists from punch_lists;

-- ---------------------------------------------------------------------
-- warranty_periods (4) — untuk proyek status bast/selesai
-- ---------------------------------------------------------------------
insert into warranty_periods (company_id, project_id, spk_id, start_date, end_date, warranty_months, scope, status, note)
select (select id from t_company), p.id, p.spk_id, v.start_date, v.end_date, v.months, v.scope, v.status, v.note
from t_project p
join (values
  ('PRJ/2026/00009', date '2025-09-01', date '2026-09-10', 12, 'Instalasi Kabel & ODP', 'berakhir', 'Garansi instalasi sudah berakhir, tidak ada klaim'),
  ('PRJ/2026/00009', date '2025-09-01', date '2026-10-05', 13, 'Peralatan Aktif (OLT/ONT)', 'aktif', 'Garansi perangkat aktif mendekati masa berakhir'),
  ('PRJ/2026/00008', date '2026-08-01', date '2027-08-01', 12, 'Instalasi Kabel & ODP', 'aktif', 'Garansi instalasi masih berjalan normal'),
  ('PRJ/2026/00008', date '2026-08-01', date '2026-11-10', 3, 'Peralatan Aktif (OLT/ONT)', 'aktif', 'Garansi perangkat aktif akan segera berakhir')
) as v(project_code, start_date, end_date, months, scope, status, note) on v.project_code = p.project_code;

select count(*) as n_warranty_periods from warranty_periods;

-- ---------------------------------------------------------------------
-- subcontract_packages (8) — satu per vendor
-- ---------------------------------------------------------------------
create temp table t_pkg as
select (select id from t_company) as company_id,
  'SUBKON/2026/' || lpad(v.rn::text,5,'0') as package_no,
  p.id as project_id, v.id as vendor_id, sc.scope,
  sc.contract_value, sc.start_date, sc.end_date, sc.progress_percent, 5::numeric as retention_percent,
  sc.status
from t_vendor v
join t_project p on p.rn = 1 + ((v.rn*3) % 10)
join (values
  ('CV Cahaya Fiber Optik','Splicing & Instalasi Kabel Fiber', 85000000::numeric, date '2026-04-10', date '2026-07-10', 100::numeric, 'selesai'),
  ('CV Mitra Teknik Splicing','Splicing Fiber Optik Outdoor', 62000000, date '2026-05-01', date '2026-08-01', 80, 'aktif'),
  ('CV Sarana Tiang Mandiri','Pengadaan & Pemasangan Tiang', 145000000, date '2026-04-15', date '2026-08-15', 65, 'aktif'),
  ('CV Sumber Optik Jaya','Pengadaan Material Fiber Optik', 210000000, date '2026-03-20', date '2026-09-20', 55, 'aktif'),
  ('PT Fiberindo Perkasa','Deployment Jaringan FTTH Turnkey', 320000000, date '2026-04-01', date '2026-09-30', 70, 'aktif'),
  ('PT Konstruksi Jaringan Nusantara','Konstruksi Jaringan Sipil', 275000000, date '2026-05-10', date '2026-09-10', 40, 'aktif'),
  ('PT Sewa Alat Telekom','Sewa Alat Berat & OTDR', 48000000, date '2026-04-01', date '2026-06-30', 100, 'selesai'),
  ('PT Subkon Galian Riau','Pekerjaan Galian & Penanaman Kabel', 190000000, date '2026-04-20', date '2026-08-20', 30, 'draft')
) as sc(vname, scope, contract_value, start_date, end_date, progress_percent, status) on sc.vname = v.name;

insert into subcontract_packages (company_id, package_no, project_id, vendor_id, scope, contract_value,
  start_date, end_date, progress_percent, retention_percent, status)
select company_id, package_no, project_id, vendor_id, scope, contract_value, start_date, end_date,
  progress_percent, retention_percent, status
from t_pkg;

select count(*) as n_subcontract_packages from subcontract_packages;

-- ---------------------------------------------------------------------
-- subcontract_progress (2 laporan per paket = 16)
-- ---------------------------------------------------------------------
create temp table t_pkg_ins as
  select sp.id, sp.package_no, sp.start_date, sp.end_date, sp.progress_percent, sp.contract_value,
         row_number() over (order by sp.package_no) as rn
  from subcontract_packages sp
  where sp.company_id = (select id from t_company);

insert into subcontract_progress (company_id, package_id, report_date, progress_percent, amount_claimed, verified_by, note)
select (select id from t_company), k.id,
  k.start_date + ((k.end_date - k.start_date) * r.step / 2),
  round(k.progress_percent * r.step / 2.0, 2),
  round(k.contract_value * (k.progress_percent * r.step / 2.0) / 100.0, 2),
  (select id from t_profile where role = 'manager_deployment'),
  'Laporan progres subkontrak tahap ' || r.step
from t_pkg_ins k
cross join lateral (select generate_series(1,2) as step) r;

select count(*) as n_subcontract_progress from subcontract_progress;

select 'PART 9 (deployment) OK' as status;

-- =====================================================================
-- PART 10: master_references (STO Sumbagteng, Satuan, Bank, Kategori Gangguan)
-- =====================================================================
insert into master_references (company_id, ref_group, code, name, parent_code, sort_order, attributes, is_active)
select (select id from t_company), r.ref_group, r.code, r.name, r.parent_code, r.sort_order, '{}'::jsonb, true
from (values
  -- STO wilayah Sumatera Bagian Tengah (Sumbagteng)
  ('STO','STO-PKU01','STO Pekanbaru Kota','AREA-PKU',1),
  ('STO','STO-PKU02','STO Pekanbaru Rumbai','AREA-PKU',2),
  ('STO','STO-PKU03','STO Pekanbaru Panam','AREA-PKU',3),
  ('STO','STO-DUM01','STO Dumai Kota','AREA-DUM',4),
  ('STO','STO-DUM02','STO Dumai Bukit Kapur','AREA-DUM',5),
  ('STO','STO-BKN01','STO Bangkinang','AREA-KMP',6),
  ('STO','STO-BATAM01','STO Batam Center','AREA-BATAM',7),
  ('STO','STO-BATAM02','STO Batam Nagoya','AREA-BATAM',8),
  ('STO','STO-BATAM03','STO Batam Sekupang','AREA-BATAM',9),
  ('STO','STO-BUK01','STO Bukittinggi','AREA-BUK',10),
  ('STO','STO-PDG01','STO Padang Kota','AREA-PDG',11),
  ('STO','STO-PDG02','STO Padang Lubuk Begalung','AREA-PDG',12),
  ('STO','STO-JMB01','STO Jambi Kota','AREA-JMB',13),
  ('STO','STO-JMB02','STO Jambi Telanaipura','AREA-JMB',14),
  ('STO','STO-TJP01','STO Tanjung Pinang','AREA-TJP',15),
  ('STO','STO-DRI01','STO Duri','AREA-DUM',16),
  ('STO','STO-RGT01','STO Rengat','AREA-KMP',17),
  ('STO','STO-SLK01','STO Solok','AREA-PDG',18),
  ('STO','STO-PYK01','STO Payakumbuh','AREA-BUK',19),
  ('STO','STO-KRC01','STO Kerinci','AREA-JMB',20),
  -- Satuan (unit of measure)
  ('SATUAN','MTR','Meter',null,1),
  ('SATUAN','PCS','Pieces / Buah',null,2),
  ('SATUAN','UNIT','Unit',null,3),
  ('SATUAN','ROLL','Roll',null,4),
  ('SATUAN','SET','Set',null,5),
  ('SATUAN','BOX','Box',null,6),
  ('SATUAN','LOT','Lot',null,7),
  ('SATUAN','TITIK','Titik',null,8),
  ('SATUAN','JAM','Jam',null,9),
  ('SATUAN','HARI','Hari',null,10),
  -- Bank referensi pembayaran
  ('BANK','BCA','Bank Central Asia',null,1),
  ('BANK','MANDIRI','Bank Mandiri',null,2),
  ('BANK','BNI','Bank Negara Indonesia',null,3),
  ('BANK','BRI','Bank Rakyat Indonesia',null,4),
  ('BANK','BSI','Bank Syariah Indonesia',null,5),
  ('BANK','RIAU-KEPRI','Bank Riau Kepri',null,6),
  ('BANK','PERMATA','Bank Permata',null,7),
  ('BANK','CIMB','CIMB Niaga',null,8),
  -- Kategori gangguan (disturbance categories)
  ('KATEGORI_GANGGUAN','GGN-ONT','Gangguan ONT / Perangkat Pelanggan',null,1),
  ('KATEGORI_GANGGUAN','GGN-WIFI','Gangguan WiFi / Jaringan Lokal',null,2),
  ('KATEGORI_GANGGUAN','GGN-STB','Gangguan Set Top Box / IPTV',null,3),
  ('KATEGORI_GANGGUAN','FIBER-CUT','Kabel Fiber Putus',null,4),
  ('KATEGORI_GANGGUAN','GGN-MASSAL','Gangguan Massal',null,5),
  ('KATEGORI_GANGGUAN','GGN-REDAMAN','Redaman Tinggi / Loss Optik',null,6),
  ('KATEGORI_GANGGUAN','GGN-POWER','Gangguan Catuan Daya / PLN Padam',null,7),
  ('KATEGORI_GANGGUAN','GGN-KONFIG','Kesalahan Konfigurasi Perangkat',null,8),
  ('KATEGORI_GANGGUAN','GGN-LAINNYA','Gangguan Lainnya',null,9)
) as r(ref_group, code, name, parent_code, sort_order);

select count(*) as n_master_references from master_references;
select 'PART 10 (master_references) OK' as status;
