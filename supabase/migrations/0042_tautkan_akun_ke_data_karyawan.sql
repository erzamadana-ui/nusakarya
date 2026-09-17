-- =====================================================================
-- 0042_tautkan_akun_ke_data_karyawan.sql
--
-- MASALAH: 21 dari 23 akun login tidak punya baris di tabel employees,
-- sehingga auth_employee_id() bernilai NULL dan SELURUH layanan mandiri
-- (absen, cuti, lembur, SPPD, uang muka) tidak bisa dipakai pemiliknya.
-- Sebelumnya hanya akun teknisi dan mitra yang tertaut.
--
-- PERBAIKAN: buatkan baris karyawan untuk setiap akun aktif yang belum
-- punya, lalu tautkan lewat employees.user_id. Idempoten — dijalankan
-- ulang tidak membuat duplikat.
-- =====================================================================

insert into employees (company_id, nip, full_name, unit, position, employment_type,
                       status, join_date, branch_id, email, phone, ptkp_status,
                       payroll_scheme, user_id)
select
  p.company_id,
  'SYS-' || upper(substr(replace(p.id::text,'-',''),1,6)),
  p.full_name,
  case p.role
    when 'manager_hr' then 'HR' when 'staff_hr' then 'HR'
    when 'manager_commerce' then 'COMMERCE' when 'staff_commerce' then 'COMMERCE'
    when 'manager_procurement' then 'PROCUREMENT' when 'staff_procurement' then 'PROCUREMENT'
    when 'manager_finance' then 'FINANCE' when 'staff_finance' then 'FINANCE'
    when 'manager_inventory' then 'INVENTORY' when 'staff_inventory' then 'INVENTORY'
    when 'manager_operations' then 'OPERATIONS' when 'spv_operations' then 'OPERATIONS'
    when 'dispatcher' then 'OPERATIONS' when 'qc' then 'OPERATIONS'
    when 'manager_deployment' then 'DEPLOYMENT' when 'project_manager' then 'DEPLOYMENT'
    when 'design_engineer' then 'DEPLOYMENT'
    else 'EXECUTIVE'
  end,
  coalesce(nullif(p.full_name,''), p.role),
  'PKWTT',
  'aktif',
  current_date,
  p.branch_id,
  p.email,
  p.phone,
  'TK/0',
  'fix_salary',
  p.id
from profiles p
where p.is_active
  and not exists (select 1 from employees e where e.user_id = p.id)
  and not exists (select 1 from employees e2 where e2.company_id = p.company_id
                    and e2.nip = 'SYS-' || upper(substr(replace(p.id::text,'-',''),1,6)));
