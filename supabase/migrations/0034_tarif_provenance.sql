-- 0034_tarif_provenance.sql
-- Menandai asal-usul tarif (job_types.tariff_amount, contract_price_list.unit_price,
-- freelance_rate_cards.rate_amount) supaya angka asumsi sistem terlihat & mudah diganti
-- dengan tarif kontrak sebenarnya.

-- 1. Kolom provenance pada job_types
alter table public.job_types
  add column if not exists price_source text not null default 'asumsi_sistem',
  add column if not exists price_source_ref text,
  add column if not exists price_verified_at timestamptz,
  add column if not exists price_verified_by uuid references auth.users(id);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'job_types_price_source_check'
  ) then
    alter table public.job_types
      add constraint job_types_price_source_check
      check (price_source in ('asumsi_sistem','kontrak','negosiasi','survei_pasar','lainnya'));
  end if;
end $$;

-- 2. Kolom provenance pada contract_price_list
alter table public.contract_price_list
  add column if not exists price_source text not null default 'asumsi_sistem',
  add column if not exists price_source_ref text,
  add column if not exists price_verified_at timestamptz,
  add column if not exists price_verified_by uuid references auth.users(id);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'contract_price_list_price_source_check'
  ) then
    alter table public.contract_price_list
      add constraint contract_price_list_price_source_check
      check (price_source in ('asumsi_sistem','kontrak','negosiasi','survei_pasar','lainnya'));
  end if;
end $$;

-- 3. Kolom provenance pada freelance_rate_cards
alter table public.freelance_rate_cards
  add column if not exists price_source text not null default 'asumsi_sistem',
  add column if not exists price_source_ref text,
  add column if not exists price_verified_at timestamptz,
  add column if not exists price_verified_by uuid references auth.users(id);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'freelance_rate_cards_price_source_check'
  ) then
    alter table public.freelance_rate_cards
      add constraint freelance_rate_cards_price_source_check
      check (price_source in ('asumsi_sistem','kontrak','negosiasi','survei_pasar','lainnya'));
  end if;
end $$;

-- 4. Tandai seluruh baris yang sudah ada sekarang sebagai 'asumsi_sistem' bila kolom baru saja
--    dibuat (DEFAULT sudah menjangkau baris lama, tapi UPDATE eksplisit ini memastikan tidak ada
--    NULL tersisa pada instalasi lama sebelum kolom NOT NULL berlaku).
update public.job_types set price_source = 'asumsi_sistem' where price_source is null;
update public.contract_price_list set price_source = 'asumsi_sistem' where price_source is null;
update public.freelance_rate_cards set price_source = 'asumsi_sistem' where price_source is null;

-- 5. View pemantauan tarif yang belum diverifikasi (dipakai untuk peringatan di UI & audit tarif)
create or replace view public.v_tarif_belum_terverifikasi with (security_invoker = on) as
select
  jt.company_id,
  'job_types'::text as sumber_tabel,
  jt.id,
  jt.code as kode,
  jt.name as deskripsi,
  null::text as satuan,
  jt.tariff_amount as tarif,
  jt.price_source,
  'Tarif standar per jenis pekerjaan — dipakai untuk poin produktivitas teknisi dan tarif cadangan payout mitra freelance bila rate card tidak tersedia.'::text as dipakai_di
from public.job_types jt
where jt.price_source = 'asumsi_sistem' and jt.is_active

union all

select
  cpl.company_id,
  'contract_price_list'::text as sumber_tabel,
  cpl.id,
  cpl.item_code as kode,
  cpl.description as deskripsi,
  cpl.uom as satuan,
  cpl.unit_price as tarif,
  cpl.price_source,
  'Harga satuan price list kontrak — dipakai untuk menghitung nilai klaim progres/BA dan penagihan ke pelanggan.'::text as dipakai_di
from public.contract_price_list cpl
where cpl.price_source = 'asumsi_sistem' and cpl.is_active

union all

select
  frc.company_id,
  'freelance_rate_cards'::text as sumber_tabel,
  frc.id,
  jt2.code as kode,
  coalesce(jt2.name, 'Rate card mitra') as deskripsi,
  null::text as satuan,
  frc.rate_amount as tarif,
  frc.price_source,
  'Tarif per satuan pekerjaan untuk mitra/vendor freelance — dipakai langsung dalam perhitungan payout mitra.'::text as dipakai_di
from public.freelance_rate_cards frc
left join public.job_types jt2 on jt2.id = frc.job_type_id
where frc.price_source = 'asumsi_sistem' and frc.is_active;
