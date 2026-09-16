-- =====================================================================
-- 0018_payroll_freelance.sql — Payroll jalur mitra/freelance
-- (payroll_runs sudah menangani jalur pegawai tetap fix salary)
-- =====================================================================

-- ---------------------------------------------------------------------
-- kolom tambahan pada employees untuk skema payroll
-- ---------------------------------------------------------------------
alter table employees
  add column if not exists payroll_scheme text not null default 'fix_salary'
    check (payroll_scheme in ('fix_salary','freelance','campuran')),
  add column if not exists default_rate_card_id uuid;

-- ---------------------------------------------------------------------
-- freelance_rate_cards — tarif per satuan pekerjaan untuk mitra.
-- employee_id & vendor_id NULL sekaligus berarti tarif umum (default job_types.tariff_amount override)
-- ---------------------------------------------------------------------
create table freelance_rate_cards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,
  vendor_id uuid references vendors(id) on delete cascade,
  job_type_id uuid not null references job_types(id),
  rate_amount numeric not null,
  min_qty numeric default 0,
  effective_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (not (employee_id is not null and vendor_id is not null))
);
create index idx_freelance_rate_cards_company on freelance_rate_cards(company_id);
create index idx_freelance_rate_cards_employee on freelance_rate_cards(employee_id);
create index idx_freelance_rate_cards_vendor on freelance_rate_cards(vendor_id);
create index idx_freelance_rate_cards_job_type on freelance_rate_cards(job_type_id);
create trigger trg_freelance_rate_cards_updated_at before update on freelance_rate_cards
  for each row execute function set_updated_at();

alter table employees
  add constraint fk_employees_default_rate_card foreign key (default_rate_card_id) references freelance_rate_cards(id);

-- ---------------------------------------------------------------------
-- tax_brackets_art17 — tarif progresif PPh Pasal 17 UU HPP (UU No. 7/2021)
-- Sumber: UU No. 7 Tahun 2021 tentang Harmonisasi Peraturan Perpajakan (HPP),
-- Pasal 17 ayat (1) huruf a — lapisan tarif Wajib Pajak Orang Pribadi.
-- CATATAN: data referensi, WAJIB diverifikasi ulang terhadap peraturan
-- terbaru (PP/PMK turunan) sebelum dipakai sebagai dasar perhitungan resmi.
-- ---------------------------------------------------------------------
create table tax_brackets_art17 (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  min_income numeric not null,
  max_income numeric,
  rate numeric not null,
  effective_from date not null default '2022-01-01',
  source_note text default 'UU No. 7/2021 (HPP) Pasal 17 ayat (1) huruf a — perlu verifikasi ulang',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_tax_brackets_art17_company on tax_brackets_art17(company_id);
create trigger trg_tax_brackets_art17_updated_at before update on tax_brackets_art17
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- freelance_payouts
-- ---------------------------------------------------------------------
create table freelance_payouts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  payout_no text not null,
  period_code text not null,
  employee_id uuid references employees(id),
  vendor_id uuid references vendors(id),
  payee_type text not null check (payee_type in ('orang_pribadi','badan')),
  gross_amount numeric not null default 0,
  dpp_percent numeric not null default 50,
  dpp_amount numeric not null default 0,
  tax_scheme text not null check (tax_scheme in ('pph21_bukan_pegawai','pph23_jasa','final','tanpa_potongan')),
  tax_rate numeric default 0,
  tax_amount numeric not null default 0,
  other_deduction numeric not null default 0,
  net_amount numeric not null default 0,
  npwp text,
  has_npwp boolean not null default false,
  status text not null default 'draft' check (status in ('draft','dihitung','diverifikasi','disetujui','dibayar','ditolak')),
  paid_at timestamptz,
  payment_ref text,
  self_billing_no text,
  file_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, payout_no),
  check (not (employee_id is null and vendor_id is null)),
  check (payee_type <> 'orang_pribadi' or vendor_id is null)
);
create index idx_freelance_payouts_company on freelance_payouts(company_id);
create index idx_freelance_payouts_employee on freelance_payouts(employee_id);
create index idx_freelance_payouts_vendor on freelance_payouts(vendor_id);
create index idx_freelance_payouts_period on freelance_payouts(period_code);
create trigger trg_freelance_payouts_updated_at before update on freelance_payouts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- freelance_payout_lines
-- ---------------------------------------------------------------------
create table freelance_payout_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  payout_id uuid not null references freelance_payouts(id) on delete cascade,
  productivity_entry_id uuid references productivity_entries(id),
  work_order_id uuid references work_orders(id),
  job_type_id uuid references job_types(id),
  work_date date,
  description text,
  qty numeric not null default 1,
  rate numeric not null default 0,
  amount numeric not null default 0,
  qc_passed boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_freelance_payout_lines_company on freelance_payout_lines(company_id);
create index idx_freelance_payout_lines_payout on freelance_payout_lines(payout_id);
create index idx_freelance_payout_lines_productivity_entry on freelance_payout_lines(productivity_entry_id);
create index idx_freelance_payout_lines_work_order on freelance_payout_lines(work_order_id);
create trigger trg_freelance_payout_lines_updated_at before update on freelance_payout_lines
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- fn_hitung_pph21_bukan_pegawai
-- DPP = 50% x bruto. Pajak = tarif progresif Pasal 17 atas DPP, dihitung
-- sederhana memakai lapisan tarif PERTAMA yang mencakup nilai DPP (bukan
-- akumulasi berlapis/kumulatif setahun). Bila WP tidak ber-NPWP, tarif x 1,2
-- sesuai Pasal 21 ayat (5a) UU PPh.
-- PENYEDERHANAAN: perhitungan PPh 21 bukan pegawai yang sebenarnya bersifat
-- kumulatif progresif dalam satu tahun pajak berjalan (penghasilan kumulatif
-- dari masa ke masa). Fungsi ini HANYA memakai bracket pertama yang cocok
-- atas DPP masa berjalan dan WAJIB diverifikasi ulang oleh tim pajak/payroll
-- sebelum dipakai sebagai dasar pemotongan resmi.
-- ---------------------------------------------------------------------
create or replace function fn_hitung_pph21_bukan_pegawai(p_gross numeric, p_has_npwp boolean)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_dpp numeric;
  v_rate numeric;
  v_tax numeric;
begin
  if p_gross is null or p_gross <= 0 then
    return 0;
  end if;

  v_dpp := round(p_gross * 0.5, 2);

  select rate into v_rate
  from tax_brackets_art17
  where company_id = auth_company_id()
    and min_income <= v_dpp
    and (max_income is null or v_dpp <= max_income)
  order by min_income desc
  limit 1;

  if v_rate is null then
    v_rate := 0.05;
  end if;

  v_tax := v_dpp * v_rate;

  if not coalesce(p_has_npwp, false) then
    v_tax := v_tax * 1.2;
  end if;

  return round(v_tax, 2);
end;
$$;
comment on function fn_hitung_pph21_bukan_pegawai(numeric, boolean) is
  'Penyederhanaan perhitungan PPh 21 bukan pegawai (DPP 50% x bruto, tarif Pasal 17 atas DPP masa berjalan, x1.2 jika tanpa NPWP). Bukan perhitungan kumulatif tahunan — wajib diverifikasi ulang oleh tim pajak sebelum dipakai sebagai dasar pemotongan resmi.';
