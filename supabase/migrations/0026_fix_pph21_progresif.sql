-- =====================================================================
-- 0026_fix_pph21_progresif.sql
-- Perbaikan fn_hitung_pph21_bukan_pegawai: sebelumnya memakai TARIF TUNGGAL
-- (bracket pertama yang "mengandung" nilai DPP), padahal Pasal 17 UU PPh
-- (dan UU HPP) mewajibkan tarif PROGRESIF BERLAPIS — setiap lapisan
-- penghasilan dikenai tarifnya sendiri secara kumulatif.
--
-- Ditemukan lewat QA tahap-2: pada DPP tepat di batas lapisan (mis. bruto
-- Rp120.000.000 -> DPP 50% = Rp60.000.000, persis di batas lapisan I/II),
-- fungsi lama memilih lapisan KEDUA (15%) untuk SELURUH DPP karena data
-- tax_brackets_art17 memakai batas inklusif tumpang-tindih (min lapisan II
-- = max lapisan I = 60.000.000) dan query lama mengambil "min_income
-- tertinggi yang <= DPP". Hasilnya pajak dihitung Rp9.000.000 (ber-NPWP),
-- padahal seharusnya Rp3.000.000 (seluruh DPP masih di lapisan I 5%) —
-- selisih Rp6.000.000 (kelebihan pungut 200%) untuk satu transaksi ini.
--
-- Perbaikan: hitung pajak per-lapisan (progresif kumulatif) dengan
-- melebarkan DPP ke setiap bracket sesuai lebarnya (max_income - min_income),
-- bukan mencari SATU bracket yang "mengandung" nilai DPP.
-- =====================================================================

create or replace function fn_hitung_pph21_bukan_pegawai(p_gross numeric, p_has_npwp boolean)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_dpp numeric;
  v_remaining numeric;
  v_tax numeric := 0;
  v_layer_width numeric;
  v_found boolean := false;
  b record;
begin
  if p_gross is null or p_gross <= 0 then
    return 0;
  end if;

  v_dpp := round(p_gross * 0.5, 2);
  v_remaining := v_dpp;

  for b in
    select min_income, max_income, rate
    from tax_brackets_art17
    where company_id = auth_company_id()
    order by min_income asc
  loop
    exit when v_remaining <= 0;
    v_found := true;

    if b.max_income is null then
      v_layer_width := v_remaining;
    else
      v_layer_width := least(v_remaining, greatest(b.max_income - b.min_income, 0));
    end if;

    if v_layer_width > 0 then
      v_tax := v_tax + v_layer_width * b.rate;
      v_remaining := v_remaining - v_layer_width;
    end if;
  end loop;

  -- fallback: jika perusahaan belum punya baris tax_brackets_art17 sama sekali
  if not v_found then
    v_tax := v_dpp * 0.05;
  end if;

  if not coalesce(p_has_npwp, false) then
    v_tax := v_tax * 1.2;
  end if;

  return round(v_tax, 2);
end;
$$;

comment on function fn_hitung_pph21_bukan_pegawai(numeric, boolean) is
  'Perhitungan PPh 21 bukan pegawai (DPP 50% x bruto) memakai tarif PROGRESIF BERLAPIS Pasal 17 UU PPh/HPP atas DPP masa berjalan (setiap lapisan dikenai tarifnya sendiri secara kumulatif, bukan tarif tunggal dari satu bracket), x1.2 jika tanpa NPWP sesuai Pasal 21 ayat (5a). Masih penyederhanaan per-masa (bukan kumulatif setahun penuh) — tetap wajib diverifikasi oleh tim pajak/payroll sebelum dipakai sebagai dasar pemotongan resmi.';
