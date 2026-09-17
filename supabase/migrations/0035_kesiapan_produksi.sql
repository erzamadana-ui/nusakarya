-- Kolom penanda data contoh. Ditaruh di sini karena file inilah yang pertama memakainya;
-- tanpa baris ini, migrasi dari nol gagal di 0035. Idempoten: aman dijalankan ulang.
alter table public.companies add column if not exists is_demo boolean not null default false;

-- =====================================================================
-- 0035_kesiapan_produksi.sql
-- Halaman "Kesiapan Produksi": satu tempat yang menunjukkan apa saja
-- yang masih menghalangi aplikasi dipakai sungguhan, dan alat untuk
-- membereskannya.
--
-- Berisi:
--   1. fn_bersihkan_data_contoh(p_company, p_konfirmasi) — SECURITY DEFINER,
--      mode SIMULASI (dry-run, tidak mengubah apa pun) dan mode nyata
--      (hanya jalan bila p_konfirmasi = 'HAPUS DATA CONTOH', dipicu tombol
--      di UI dengan konfirmasi berlapis).
--   2. v_kesiapan_produksi — satu baris per butir pemeriksaan kesiapan.
--
-- CATATAN PENTING: migrasi ini ditulis defensif terhadap kolom/tabel yang
-- belum ada (tax_rates_ref, bpjs_config.is_verified, job_types.price_source)
-- karena tiga migrasi lain (0032 bpjs_risk_class, 0033 tax_reference,
-- 0034 tarif_provenance) sedang dikerjakan paralel dan mungkin belum
-- diterapkan saat migrasi ini jalan. Bila kolom/tabel itu belum ada,
-- butir terkait pada view diabaikan dengan aman (tidak muncul), dan
-- fungsi pembersihan tidak menyentuhnya sama sekali.
-- =====================================================================

-- =====================================================================
-- 1. fn_bersihkan_data_contoh(p_company uuid, p_konfirmasi text)
-- =====================================================================
-- Daftar 117 tabel transaksi/company-scoped yang DIHAPUS, dalam urutan
-- yang menghormati foreign key (anak sebelum induk — dihitung dari graf
-- foreign key aktual pada 2026-09-16 via mcp__Supabase__list_tables,
-- BUKAN tebakan). Tabel yang TIDAK ada di daftar ini (companies, branches,
-- profiles, modules, role_module_access, doc_sequences, ter_rates,
-- tax_brackets_art17, bpjs_config, salary_components, master_references,
-- job_types, dan tabel yang belum ada seperti tax_rates_ref) SENGAJA
-- dipertahankan — job_types dipilih sebagai satu-satunya "tabel referensi
-- tarif" yang company-wide (tidak terikat ke satu kontrak/karyawan
-- tertentu seperti contract_price_list/freelance_rate_cards, yang NOT
-- NULL/terikat ke baris transaksi yang justru dihapus — mempertahankan
-- keduanya akan meninggalkan baris yatim atau melanggar foreign key).
create or replace function fn_bersihkan_data_contoh(p_company uuid, p_konfirmasi text)
returns table(nama_tabel text, baris_dihapus bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_urutan text[] := array[
    'ap_payments','approvals','ar_payments','asset_assignments','asset_maintenances',
    'attachments','attendances','audit_logs','bank_statement_lines','budgets','cash_flows',
    'chart_of_accounts','customer_complaints','disciplinary_actions','documents','drm_sessions',
    'employee_advances','employee_certifications','employee_competencies','employee_salaries',
    'escalation_matrix','freelance_payout_lines','freelance_rate_cards','gr_items','hse_incidents',
    'hse_inspections','job_applicants','job_costs','journal_lines','knowledge_articles',
    'leave_requests','maintenance_tasks','material_request_items','material_usages','nms_alarms',
    'notifications','opportunity_activities','overtime_requests','partner_payment_sla',
    'payroll_run_lines','performance_review_items','permits','petty_cash','pr_items',
    'productivity_targets','progress_claim_items','progress_reports','project_milestones',
    'punch_lists','qc_records','rfq_quotes','rfs_records','rosters','serial_movements',
    'sla_penalties','sla_reports','stock_balances','stock_movements','stock_opname_lines',
    'subcontract_progress','surveys','tax_records','ticket_activities','ticket_sla_events',
    'training_participants','trip_expenses','vendor_contracts','vendor_return_items',
    'vendor_scorecards','warranty_periods','wo_checklists','work_permits','vendor_invoices',
    'ar_invoices','assets','bank_reconciliations','freelance_payouts','productivity_entries',
    'po_items','job_vacancies','cost_categories','journal_entries','maintenance_plans',
    'material_requests','boq_items','opportunities','payroll_runs','performance_reviews',
    'contract_price_list','bast','shifts','serials','stock_opnames','subcontract_packages',
    'trainings','business_trips','vendor_returns','progress_claims','bank_accounts',
    'payroll_periods','item_catalog','work_orders','competencies','goods_receipts','tickets',
    'purchase_orders','network_elements','root_causes','rfqs','vendors','warehouses',
    'purchase_requests','projects','employees','spk','contracts','customers'
  ];
  v_tabel text;
  v_n bigint;
  v_company_name text;
  v_is_simulasi boolean;
begin
  -- 1) hanya super_admin pada perusahaan yang sama yang boleh memanggil ini sama sekali
  --    (berlaku untuk mode simulasi maupun mode hapus nyata)
  if not (coalesce(is_super(), false) and auth_company_id() = p_company) then
    raise exception 'Hanya super_admin pada perusahaan ini yang boleh menjalankan pembersihan data contoh.'
      using errcode = '42501';
  end if;

  select name into v_company_name from companies where id = p_company;
  if v_company_name is null then
    raise exception 'Perusahaan tidak ditemukan.';
  end if;

  v_is_simulasi := (p_konfirmasi = 'SIMULASI');

  -- 2) teks konfirmasi harus persis 'SIMULASI' (mode kering) atau
  --    'HAPUS DATA CONTOH' (mode nyata) — selain itu ditolak
  if p_konfirmasi is distinct from 'SIMULASI' and p_konfirmasi is distinct from 'HAPUS DATA CONTOH' then
    raise exception 'Teks konfirmasi tidak sesuai. Ketik persis "HAPUS DATA CONTOH" untuk menjalankan, atau "SIMULASI" untuk mode kering.'
      using errcode = '22023';
  end if;

  -- =====================================================================
  -- Mode kering: hanya menghitung, TIDAK mengubah apa pun.
  -- =====================================================================
  if v_is_simulasi then
    foreach v_tabel in array v_urutan loop
      if to_regclass('public.' || v_tabel) is not null then
        execute format('select count(*) from %I where company_id = $1', v_tabel)
          into v_n using p_company;
        nama_tabel := v_tabel;
        baris_dihapus := v_n;
        return next;
      end if;
    end loop;
    return;
  end if;

  -- =====================================================================
  -- Mode nyata: p_konfirmasi = 'HAPUS DATA CONTOH'
  -- =====================================================================

  -- lepas dua tautan silang yang membentuk siklus foreign key sebelum
  -- menghapus tabel-tabel yang bersangkutan (keduanya nullable):
  --   profiles.employee_id  -> employees      (profiles DIPERTAHANKAN, employees DIHAPUS)
  --   employees.default_rate_card_id -> freelance_rate_cards (freelance_rate_cards
  --     dihapus lebih dulu dalam urutan di atas daripada employees)
  update profiles set employee_id = null
    where company_id = p_company and employee_id is not null;
  update employees set default_rate_card_id = null
    where company_id = p_company and default_rate_card_id is not null;

  foreach v_tabel in array v_urutan loop
    if to_regclass('public.' || v_tabel) is not null then
      execute format('delete from %I where company_id = $1', v_tabel) using p_company;
      get diagnostics v_n = row_count;
      nama_tabel := v_tabel;
      baris_dihapus := v_n;
      return next;
    end if;
  end loop;

  insert into audit_logs (company_id, user_id, action, entity_type, entity_id, before, after)
  values (
    p_company, auth.uid(), 'bersihkan_data_contoh', 'companies', p_company,
    jsonb_build_object('is_demo', true),
    jsonb_build_object('is_demo', false, 'catatan', 'Data contoh dibersihkan via fn_bersihkan_data_contoh')
  );

  update companies set is_demo = false where id = p_company;

  return;
end;
$$;

comment on function fn_bersihkan_data_contoh(uuid, text) is
  'Membersihkan seluruh data contoh (transaksi) milik satu perusahaan, mempertahankan data struktural/referensi (companies, branches, profiles, modules, role_module_access, doc_sequences, ter_rates, tax_brackets_art17, bpjs_config, salary_components, master_references, job_types). p_konfirmasi=''SIMULASI'' -> mode kering, tidak menghapus apa pun. p_konfirmasi=''HAPUS DATA CONTOH'' -> menghapus sungguhan (permanen, tidak bisa dibatalkan). Hanya super_admin pada perusahaan itu yang boleh memanggil.';

revoke execute on function fn_bersihkan_data_contoh(uuid, text) from public;
grant execute on function fn_bersihkan_data_contoh(uuid, text) to authenticated, service_role;


-- =====================================================================
-- 2. v_kesiapan_produksi — satu baris per butir pemeriksaan kesiapan
-- =====================================================================
-- Dibangun via DO block + EXECUTE agar butir yang bergantung pada
-- kolom/tabel yang belum ada (tax_rates_ref, bpjs_config.is_verified,
-- job_types.price_source — datang dari migrasi paralel 0032/0033/0034)
-- bisa diikutsertakan HANYA bila sudah ada, tanpa membuat migrasi ini
-- gagal saat migrasi tersebut belum diterapkan.
do $$
declare
  v_sql text;
  v_has_tax_rates_ref boolean := to_regclass('public.tax_rates_ref') is not null;
  v_has_bpjs_verified boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bpjs_config' and column_name = 'is_verified'
  );
  v_has_price_source boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_types' and column_name = 'price_source'
  );
begin
  v_sql := $q$
    -- --- Data Contoh -----------------------------------------------
    select
      c.id as company_id, 'DEMO_PERUSAHAAN'::text as kode, 'Data Contoh'::text as kategori,
      'Perusahaan masih bertanda data contoh'::text as judul,
      case when c.is_demo
        then 'Kolom companies.is_demo masih true — aplikasi masih dianggap terisi data peragaan, bukan data operasional sungguhan.'
        else 'Kolom companies.is_demo sudah false.'
      end as keterangan,
      case when c.is_demo then 'bahaya' else 'aman' end as status,
      (case when c.is_demo then 1 else 0 end)::bigint as jumlah_terdampak,
      case when c.is_demo
        then 'Jalankan "Simulasi Pembersihan" lalu "Hapus Data Contoh" di bagian bawah halaman ini setelah mencadangkan basis data.'
        else 'Tidak ada tindakan.'
      end as tindakan_disarankan
    from companies c

    union all

    select
      c.id, 'DEMO_TRANSAKSI', 'Data Contoh',
      'Baris transaksi yang berasal dari data contoh',
      'Jumlah baris pada sebagian tabel transaksi utama (karyawan, pelanggan, vendor, proyek, kontrak, work order, tiket, PO/PR, invoice, payroll, stok, MR, SPK, klaim progres, BAST, aset, jurnal) milik perusahaan ini — angka pendekatan, bukan penghitungan lengkap seluruh tabel. Jalankan "Simulasi Pembersihan" untuk rincian lengkap per tabel.'::text,
      case when c.is_demo and t.n > 0 then 'bahaya' else 'aman' end,
      (case when c.is_demo then t.n else 0 end)::bigint,
      case when c.is_demo and t.n > 0
        then 'Bersihkan lewat bagian "Bersihkan Data Contoh" di bawah setelah mencadangkan basis data.'
        else 'Tidak ada tindakan.'
      end
    from companies c
    join lateral (
      select
        coalesce((select count(*) from employees where company_id = c.id), 0)
        + coalesce((select count(*) from customers where company_id = c.id), 0)
        + coalesce((select count(*) from vendors where company_id = c.id), 0)
        + coalesce((select count(*) from projects where company_id = c.id), 0)
        + coalesce((select count(*) from contracts where company_id = c.id), 0)
        + coalesce((select count(*) from work_orders where company_id = c.id), 0)
        + coalesce((select count(*) from tickets where company_id = c.id), 0)
        + coalesce((select count(*) from purchase_orders where company_id = c.id), 0)
        + coalesce((select count(*) from purchase_requests where company_id = c.id), 0)
        + coalesce((select count(*) from goods_receipts where company_id = c.id), 0)
        + coalesce((select count(*) from ar_invoices where company_id = c.id), 0)
        + coalesce((select count(*) from vendor_invoices where company_id = c.id), 0)
        + coalesce((select count(*) from payroll_runs where company_id = c.id), 0)
        + coalesce((select count(*) from stock_movements where company_id = c.id), 0)
        + coalesce((select count(*) from material_requests where company_id = c.id), 0)
        + coalesce((select count(*) from spk where company_id = c.id), 0)
        + coalesce((select count(*) from progress_claims where company_id = c.id), 0)
        + coalesce((select count(*) from bast where company_id = c.id), 0)
        + coalesce((select count(*) from assets where company_id = c.id), 0)
        + coalesce((select count(*) from journal_entries where company_id = c.id), 0)
        as n
    ) t on true

    union all

    -- --- Akun Pengguna ------------------------------------------------
    select
      c.id, 'AKUN_BELUM_LOGIN', 'Akun Pengguna',
      'Akun pengguna yang belum pernah login',
      'Akun dengan profiles.last_login_at kosong — kemungkinan besar akun peragaan/contoh yang dibuat untuk demo, belum pernah dipakai sungguhan.'::text,
      case when p.n > 0 then 'perhatian' else 'aman' end,
      p.n::bigint,
      case when p.n > 0
        then 'Tinjau daftar di bagian "Akun Peragaan" di bawah, lalu nonaktifkan/hapus yang tidak diperlukan di halaman Pengguna.'
        else 'Tidak ada tindakan.'
      end
    from companies c
    join lateral (
      select count(*) as n from profiles where company_id = c.id and last_login_at is null
    ) p on true

    union all

    -- --- Data Karyawan --------------------------------------------------
    select
      c.id, 'KARYAWAN_TANPA_NPWP', 'Data Karyawan',
      'Karyawan aktif tanpa NPWP',
      'Karyawan berstatus aktif dengan kolom npwp kosong — menghambat perhitungan PPh 21 yang akurat (tarif tidak ber-NPWP lebih tinggi).'::text,
      case when e.n > 0 then 'perhatian' else 'aman' end,
      e.n::bigint,
      case when e.n > 0 then 'Lengkapi NPWP karyawan di halaman Data Karyawan (HR).' else 'Tidak ada tindakan.' end
    from companies c
    join lateral (
      select count(*) as n from employees
      where company_id = c.id and status = 'aktif' and (npwp is null or npwp = '')
    ) e on true

    union all

    select
      c.id, 'KARYAWAN_TANPA_REKENING', 'Data Karyawan',
      'Karyawan aktif tanpa nomor rekening bank',
      'Karyawan berstatus aktif dengan kolom bank_account kosong — pembayaran gaji/payout tidak bisa diproses lewat transfer.'::text,
      case when e.n > 0 then 'perhatian' else 'aman' end,
      e.n::bigint,
      case when e.n > 0 then 'Lengkapi data rekening bank karyawan di halaman Data Karyawan (HR).' else 'Tidak ada tindakan.' end
    from companies c
    join lateral (
      select count(*) as n from employees
      where company_id = c.id and status = 'aktif' and (bank_account is null or bank_account = '')
    ) e on true

    union all

    select
      c.id, 'KARYAWAN_TANPA_BPJS', 'Data Karyawan',
      'Karyawan aktif tanpa nomor BPJS',
      'Karyawan berstatus aktif dengan bpjs_kes_no dan/atau bpjs_tk_no kosong — kepesertaan BPJS Kesehatan/Ketenagakerjaan belum lengkap, berisiko pada kepatuhan & perhitungan iuran.'::text,
      case when e.n > 0 then 'bahaya' else 'aman' end,
      e.n::bigint,
      case when e.n > 0 then 'Lengkapi nomor BPJS Kesehatan & Ketenagakerjaan karyawan di halaman Data Karyawan (HR).' else 'Tidak ada tindakan.' end
    from companies c
    join lateral (
      select count(*) as n from employees
      where company_id = c.id and status = 'aktif'
        and (bpjs_kes_no is null or bpjs_kes_no = '' or bpjs_tk_no is null or bpjs_tk_no = '')
    ) e on true

    union all

    -- --- Kontrak --------------------------------------------------------
    select
      c.id, 'KONTRAK_TANPA_BERKAS', 'Kontrak',
      'Kontrak tanpa berkas terlampir',
      'Kontrak (selain draft) dengan kolom file_url kosong — tidak ada dokumen sah yang bisa dijadikan rujukan hukum.'::text,
      case when k.n > 0 then 'perhatian' else 'aman' end,
      k.n::bigint,
      case when k.n > 0 then 'Unggah berkas kontrak di halaman Kontrak (Commerce).' else 'Tidak ada tindakan.' end
    from companies c
    join lateral (
      select count(*) as n from contracts
      where company_id = c.id and status <> 'draft' and (file_url is null or file_url = '')
    ) k on true

    union all

    select
      c.id, 'KONTRAK_KEDALUWARSA_AKTIF', 'Kontrak',
      'Kontrak kedaluwarsa tapi masih berstatus aktif',
      'Kontrak dengan end_date sudah lewat tapi status masih ''aktif'' — berisiko dipakai sebagai dasar penagihan/SLA padahal sudah tidak berlaku.'::text,
      case when k.n > 0 then 'bahaya' else 'aman' end,
      k.n::bigint,
      case when k.n > 0 then 'Perbarui status kontrak (perpanjang atau tandai selesai/putus) di halaman Kontrak (Commerce).' else 'Tidak ada tindakan.' end
    from companies c
    join lateral (
      select count(*) as n from contracts
      where company_id = c.id and status = 'aktif' and end_date is not null and end_date < current_date
    ) k on true

    union all

    -- --- Gudang -----------------------------------------------------
    select
      c.id, 'GUDANG_TANPA_PIC', 'Gudang',
      'Gudang aktif tanpa penanggung jawab',
      'Gudang aktif dengan kolom pic_id kosong — tidak ada yang bertanggung jawab atas akurasi stok di gudang tersebut.'::text,
      case when w.n > 0 then 'perhatian' else 'aman' end,
      w.n::bigint,
      case when w.n > 0 then 'Tetapkan penanggung jawab gudang di halaman Gudang (Inventory).' else 'Tidak ada tindakan.' end
    from companies c
    join lateral (
      select count(*) as n from warehouses where company_id = c.id and is_active and pic_id is null
    ) w on true

    union all

    -- --- Tarif Pekerjaan -----------------------------------------------
    select
      c.id, 'JENIS_PEKERJAAN_TANPA_TARIF', 'Tarif Pekerjaan',
      'Jenis pekerjaan aktif tanpa tarif',
      'Jenis pekerjaan aktif dengan tariff_amount = 0 — poin produktivitas teknisi/payout mitra untuk jenis pekerjaan ini akan terhitung Rp 0.'::text,
      case when j.n > 0 then 'perhatian' else 'aman' end,
      j.n::bigint,
      case when j.n > 0 then 'Isi tarif jenis pekerjaan di halaman Jenis Pekerjaan (Operations/HR).' else 'Tidak ada tindakan.' end
    from companies c
    join lateral (
      select count(*) as n from job_types where company_id = c.id and is_active and coalesce(tariff_amount, 0) = 0
    ) j on true
  $q$;

  if v_has_tax_rates_ref then
    v_sql := v_sql || $q$
    union all
    select
      c.id, 'PAJAK_BELUM_VERIFIKASI', 'Referensi Pajak & BPJS',
      'Tarif pajak belum diverifikasi',
      'Baris pada tax_rates_ref dengan is_verified = false — tarif PPN/PPh masih berupa isian sistem, belum dicocokkan & disahkan tim pajak.'::text,
      case when x.n > 0 then 'bahaya' else 'aman' end,
      x.n::bigint,
      case when x.n > 0 then 'Tinjau & tandai terverifikasi di halaman Referensi Pajak (Finance).' else 'Tidak ada tindakan.' end
    from companies c
    join lateral (
      select count(*) as n from tax_rates_ref where company_id = c.id and is_verified = false
    ) x on true
    $q$;
  end if;

  if v_has_bpjs_verified then
    v_sql := v_sql || $q$
    union all
    select
      c.id, 'BPJS_BELUM_VERIFIKASI', 'Referensi Pajak & BPJS',
      'Konfigurasi BPJS belum diverifikasi',
      'Baris pada bpjs_config dengan is_verified = false — kelompok risiko JKK & tarif iuran BPJS masih berupa dugaan sistem, belum dicocokkan ke sertifikat kepesertaan BPJS Ketenagakerjaan.'::text,
      case when x.n > 0 then 'bahaya' else 'aman' end,
      x.n::bigint,
      case when x.n > 0 then 'Cocokkan ke sertifikat kepesertaan lalu tandai terverifikasi di halaman Setelan Payroll (Finance/HR).' else 'Tidak ada tindakan.' end
    from companies c
    join lateral (
      select count(*) as n from bpjs_config where company_id = c.id and is_verified = false
    ) x on true
    $q$;
  end if;

  if v_has_price_source then
    v_sql := v_sql || $q$
    union all
    select
      c.id, 'TARIF_ASUMSI', 'Tarif Pekerjaan',
      'Tarif pekerjaan masih bertanda asumsi sistem',
      'Baris pada job_types aktif dengan price_source = ''asumsi_sistem'' — tarif belum dikonfirmasi berasal dari kontrak/negosiasi/survei pasar sesungguhnya.'::text,
      case when x.n > 0 then 'bahaya' else 'aman' end,
      x.n::bigint,
      case when x.n > 0 then 'Perbarui asal-usul tarif (price_source) di halaman Jenis Pekerjaan setelah dikonfirmasi.' else 'Tidak ada tindakan.' end
    from companies c
    join lateral (
      select count(*) as n from job_types where company_id = c.id and is_active and price_source = 'asumsi_sistem'
    ) x on true
    $q$;
  end if;

  execute 'create or replace view public.v_kesiapan_produksi with (security_invoker = on) as ' || v_sql;

  comment on view public.v_kesiapan_produksi is
    'Satu baris per butir pemeriksaan kesiapan produksi per perusahaan. status: aman/perhatian/bahaya. Dipakai halaman /pengaturan/kesiapan. Butir PAJAK_BELUM_VERIFIKASI, BPJS_BELUM_VERIFIKASI, TARIF_ASUMSI hanya muncul bila tabel/kolom pendukungnya (tax_rates_ref, bpjs_config.is_verified, job_types.price_source) sudah diterapkan oleh migrasi 0033/0032/0034.';
end $$;
