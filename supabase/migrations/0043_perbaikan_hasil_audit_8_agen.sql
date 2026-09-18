-- =====================================================================
-- 0043_perbaikan_hasil_audit_8_agen.sql
--
-- Perbaikan atas temuan audit 8 agen (18 Sep 2026) pada sisi basis data.
-- Perbaikan sisi aplikasi (literal status mobile, jenis izin kerja, kategori
-- biaya perjalanan, pencatatan stok Good Receive, arus kas pembayaran vendor)
-- ada di commit yang sama, di apps/mobile dan apps/web-admin.
-- Idempoten.
-- =====================================================================

-- ---- 1. Izin kerja umum ----
-- Aplikasi mobile menawarkan jenis "Izin Kerja Umum" tetapi nilainya tidak ada
-- di CHECK constraint, sehingga izin jenis itu selalu gagal disimpan.
alter table work_permits drop constraint if exists work_permits_permit_type_check;
alter table work_permits add constraint work_permits_permit_type_check
  check (permit_type in ('umum','kerja_ketinggian','galian','listrik','ruang_terbatas','panas'));

-- ---- 2. Izin kerja: menyetujui butuh hak approve ----
-- Sebelumnya siapa pun dengan can_write('OPERATIONS') — termasuk teknisi —
-- bisa mengubah status izin kerjanya sendiri menjadi 'disetujui'.
drop policy if exists work_permits_update on work_permits;
create policy work_permits_update on work_permits for update
  using (company_id = auth_company_id() and can_write('OPERATIONS'))
  with check (company_id = auth_company_id() and can_write('OPERATIONS')
              and (status not in ('disetujui','aktif','ditutup') or can_approve('OPERATIONS')));

-- ---- 3. Kebijakan mandiri yang dikunci ke nama peran 'teknisi' ----
-- Akibatnya peran 'mitra' (dan peran lain) tidak bisa membaca absensi,
-- data karyawannya sendiri, maupun produktivitasnya — halaman tampak kosong
-- tanpa pesan kesalahan.
drop policy if exists attendances_teknisi_select on attendances;
drop policy if exists attendances_select_self on attendances;
create policy attendances_select_self on attendances for select
  using (company_id = auth_company_id() and employee_id = auth_employee_id());

drop policy if exists productivity_entries_teknisi_select on productivity_entries;
drop policy if exists productivity_entries_select_self on productivity_entries;
create policy productivity_entries_select_self on productivity_entries for select
  using (company_id = auth_company_id() and employee_id = auth_employee_id());

-- Teknisi TIDAK boleh membuat atau mengubah entri produktivitasnya sendiri:
-- entri dibuat trigger fn_wo_done_productivity (SECURITY DEFINER, tidak butuh
-- kebijakan) dan status 'diverifikasi' adalah dasar pembayaran. Sebelumnya
-- teknisi bisa memverifikasi sekaligus mengubah nominal miliknya sendiri.
drop policy if exists productivity_entries_teknisi_insert on productivity_entries;
drop policy if exists productivity_entries_teknisi_update on productivity_entries;

drop policy if exists work_orders_teknisi_update on work_orders;
drop policy if exists work_orders_update_self on work_orders;
create policy work_orders_update_self on work_orders for update
  using (company_id = auth_company_id() and assigned_to = auth_employee_id())
  with check (company_id = auth_company_id() and assigned_to = auth_employee_id());

drop policy if exists employees_select_self on employees;
create policy employees_select_self on employees for select
  using (company_id = auth_company_id() and user_id = auth.uid());

-- ---- 4. approvals & attachments dipakai lintas modul ----
-- Keduanya mensyaratkan can_write('CORE'), padahal ditulis dari halaman modul
-- lain: penolakan dokumen dan unggah lampiran gagal untuk peran yang sebenarnya
-- berwenang di modulnya sendiri.
drop policy if exists approvals_insert on approvals;
create policy approvals_insert on approvals for insert
  with check (company_id = auth_company_id() and can_read('CORE'));
drop policy if exists approvals_update on approvals;
create policy approvals_update on approvals for update
  using (company_id = auth_company_id() and can_read('CORE'))
  with check (company_id = auth_company_id() and can_read('CORE'));

drop policy if exists attachments_insert on attachments;
create policy attachments_insert on attachments for insert
  with check (company_id = auth_company_id() and can_read('CORE'));

-- ---- 5. jkk_risk_rates sama sekali tidak punya kebijakan tulis ----
alter table jkk_risk_rates enable row level security;
drop policy if exists jkk_risk_rates_select on jkk_risk_rates;
create policy jkk_risk_rates_select on jkk_risk_rates for select
  using (company_id = auth_company_id() and can_read('PAYROLL'));
drop policy if exists jkk_risk_rates_write on jkk_risk_rates;
create policy jkk_risk_rates_write on jkk_risk_rates for all
  using (company_id = auth_company_id() and can_write_master('PAYROLL'))
  with check (company_id = auth_company_id() and can_write_master('PAYROLL'));

-- ---- 6. Cegah bayar dobel ----
-- Satu work order hanya boleh menghasilkan satu entri produktivitas.
create unique index if not exists uq_productivity_entries_wo
  on productivity_entries (work_order_id) where work_order_id is not null;

-- ---- 7. Trigger produktivitas ----
-- (a) job_type_id kosong sebelumnya membuat seluruh penyelesaian WO gagal diam-diam
--     karena melanggar NOT NULL; kini ditolak dengan pesan yang bisa dibaca pengguna.
-- (b) on conflict do nothing sebagai penjaga terakhir terhadap entri ganda.
create or replace function fn_wo_done_productivity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_point_weight numeric; v_tariff numeric;
begin
  if new.status = 'done' and (old.status is distinct from 'done') and new.assigned_to is not null then
    if new.job_type_id is null then
      raise exception 'Jenis pekerjaan (job_type) wajib diisi sebelum Work Order % diselesaikan, karena menjadi dasar poin dan tarif produktivitas.', new.wo_no
        using errcode = '23502';
    end if;
    select point_weight, tariff_amount into v_point_weight, v_tariff from job_types where id = new.job_type_id;

    insert into productivity_entries (company_id, employee_id, work_date, job_type_id, work_order_id, qty, points, amount, status)
    values (new.company_id, new.assigned_to, coalesce(new.finished_at::date, current_date), new.job_type_id, new.id,
            1, coalesce(v_point_weight,0), coalesce(v_tariff,0), 'draft')
    on conflict (work_order_id) where work_order_id is not null do nothing;

    update work_orders set points = coalesce(v_point_weight,0), amount = coalesce(v_tariff,0) where id = new.id;
  end if;
  return new;
end $$;

-- ---- 8. PPh 21 bukan pegawai: hapus fallback tarif tunggal 5% ----
-- Bila lapisan tarif Pasal 17 tidak ditemukan, fungsi lama memotong 5% rata atas
-- seluruh DPP. Untuk DPP Rp300 juta itu Rp15 juta, padahal seharusnya Rp44 juta —
-- kurang potong Rp29 juta tanpa peringatan apa pun. Kini dihentikan dengan galat.
create or replace function fn_hitung_pph21_bukan_pegawai(p_gross numeric, p_has_npwp boolean)
returns numeric language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_dpp numeric; v_remaining numeric; v_tax numeric := 0; v_layer_width numeric; v_found boolean := false; b record;
begin
  if p_gross is null or p_gross <= 0 then return 0; end if;
  v_dpp := round(p_gross * 0.5, 2);
  v_remaining := v_dpp;
  for b in select min_income, max_income, rate from tax_brackets_art17 where company_id = auth_company_id() order by min_income asc loop
    exit when v_remaining <= 0;
    v_found := true;
    if b.max_income is null then v_layer_width := v_remaining;
    else v_layer_width := least(v_remaining, greatest(b.max_income - b.min_income, 0)); end if;
    if v_layer_width > 0 then
      v_tax := v_tax + v_layer_width * b.rate;
      v_remaining := v_remaining - v_layer_width;
    end if;
  end loop;
  if not v_found then
    raise exception 'Lapisan tarif Pasal 17 (tax_brackets_art17) tidak ditemukan untuk perusahaan ini. Perhitungan PPh 21 dihentikan agar tidak terjadi kurang potong.'
      using errcode = 'P0002';
  end if;
  if not coalesce(p_has_npwp, false) then v_tax := v_tax * 1.2; end if;
  return round(v_tax, 2);
end $$;
