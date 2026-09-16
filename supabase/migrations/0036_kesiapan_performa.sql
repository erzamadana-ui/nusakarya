-- =====================================================================
-- 0036_kesiapan_performa.sql
-- Perbaikan performa halaman Kesiapan Produksi: v_kesiapan_produksi
-- (security_invoker = on) menyebabkan setiap count(*) di dalamnya
-- dievaluasi lewat kebijakan RLS pada banyak tabel sekaligus dan
-- menimbulkan "statement timeout" untuk pengguna biasa (bukan koneksi
-- admin, yang tidak melewati RLS sehingga masalah ini lolos QA
-- sebelumnya).
--
-- Perbaikan: fn_kesiapan_produksi() SECURITY DEFINER yang mengurung
-- dirinya sendiri ke auth_company_id() lalu memfilter company_id
-- SECARA EKSPLISIT pada tiap query (RLS dilewati dengan sengaja &
-- aman — bukan lubang keamanan, karena tetap dikurung ke perusahaan
-- pemanggil oleh kode, bukan oleh RLS). Checkpoint yang membaca tabel
-- yang sama (employees, contracts, job_types) digabung jadi satu
-- pemindaian tabel dengan count(*) filter(...). v_kesiapan_produksi
-- dipertahankan sebagai pembungkus tipis di atas fungsi ini supaya
-- kode halaman yang sudah ada (list('v_kesiapan_produksi')) tidak
-- perlu diubah.
--
-- fn_bersihkan_data_contoh TIDAK diubah sama sekali.
-- =====================================================================

-- =====================================================================
-- 1. Index penunjang (aman diulang — IF NOT EXISTS)
-- =====================================================================
create index if not exists idx_employees_company_status on public.employees (company_id, status);
create index if not exists idx_contracts_company_status on public.contracts (company_id, status);
create index if not exists idx_warehouses_company_active on public.warehouses (company_id, is_active);
create index if not exists idx_job_types_company_active on public.job_types (company_id, is_active);
-- indeks parsial: hanya baris yang benar-benar dicari butir AKUN_BELUM_LOGIN
create index if not exists idx_profiles_company_belum_login on public.profiles (company_id) where last_login_at is null;

-- =====================================================================
-- 2. fn_kesiapan_produksi() — SECURITY DEFINER, murah, terkurung company_id eksplisit
-- =====================================================================
create or replace function public.fn_kesiapan_produksi()
returns table(
  company_id uuid, kode text, kategori text, judul text, keterangan text,
  status text, jumlah_terdampak bigint, tindakan_disarankan text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_company uuid := auth_company_id();
  v_company_name text;
  v_is_demo boolean;

  v_emp_npwp bigint; v_emp_bank bigint; v_emp_bpjs bigint;
  v_kontrak_berkas bigint; v_kontrak_expired bigint;
  v_gudang_pic bigint;
  v_jt_tanpa_tarif bigint; v_jt_asumsi bigint;
  v_akun_belum_login bigint;
  v_pajak_unverified bigint := null;
  v_bpjs_unverified bigint := null;
  v_demo_transaksi bigint := 0;

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
  if v_company is null then
    raise exception 'Tidak ada perusahaan yang terkait dengan akun ini.' using errcode = '42501';
  end if;

  select c.name, c.is_demo into v_company_name, v_is_demo from companies c where c.id = v_company;
  if v_company_name is null then
    raise exception 'Perusahaan tidak ditemukan.';
  end if;

  -- NB: seluruh query statis di bawah WAJIB mengualifikasi kolom company_id
  -- dengan alias tabel (mis. e.company_id) — nama kolom keluaran fungsi ini
  -- juga "company_id" (dari RETURNS TABLE), sehingga referensi tak berawalan
  -- akan dianggap ambigu oleh PL/pgSQL (variabel OUT vs kolom tabel).

  -- --- karyawan: satu pemindaian tabel employees untuk 3 butir ---
  select
    count(*) filter (where e.npwp is null or e.npwp = ''),
    count(*) filter (where e.bank_account is null or e.bank_account = ''),
    count(*) filter (where e.bpjs_kes_no is null or e.bpjs_kes_no = '' or e.bpjs_tk_no is null or e.bpjs_tk_no = '')
  into v_emp_npwp, v_emp_bank, v_emp_bpjs
  from employees e where e.company_id = v_company and e.status = 'aktif';

  -- --- kontrak: satu pemindaian tabel contracts untuk 2 butir ---
  select
    count(*) filter (where ct.status <> 'draft' and (ct.file_url is null or ct.file_url = '')),
    count(*) filter (where ct.status = 'aktif' and ct.end_date is not null and ct.end_date < current_date)
  into v_kontrak_berkas, v_kontrak_expired
  from contracts ct where ct.company_id = v_company;

  -- --- gudang ---
  select count(*) filter (where w.is_active and w.pic_id is null)
    into v_gudang_pic from warehouses w where w.company_id = v_company;

  -- --- jenis pekerjaan: satu pemindaian tabel job_types untuk 1-2 butir ---
  if v_has_price_source then
    execute
      'select count(*) filter (where is_active and coalesce(tariff_amount,0) = 0), ' ||
      '       count(*) filter (where is_active and price_source = ''asumsi_sistem'') ' ||
      'from job_types where company_id = $1'
      into v_jt_tanpa_tarif, v_jt_asumsi using v_company;
  else
    select count(*) filter (where j.is_active and coalesce(j.tariff_amount, 0) = 0)
      into v_jt_tanpa_tarif from job_types j where j.company_id = v_company;
  end if;

  -- --- akun pengguna ---
  select count(*) into v_akun_belum_login
    from profiles pr where pr.company_id = v_company and pr.last_login_at is null;

  -- --- referensi pajak (opsional, tergantung migrasi 0033) ---
  if v_has_tax_rates_ref then
    execute 'select count(*) from tax_rates_ref where company_id = $1 and is_verified = false'
      into v_pajak_unverified using v_company;
  end if;

  -- --- konfigurasi BPJS (opsional, tergantung migrasi 0032) ---
  if v_has_bpjs_verified then
    execute 'select count(*) from bpjs_config where company_id = $1 and is_verified = false'
      into v_bpjs_unverified using v_company;
  end if;

  -- --- data contoh: hanya dipindai bila perusahaan memang bertanda demo ---
  if v_is_demo then
    select
      coalesce((select count(*) from employees x where x.company_id = v_company), 0)
      + coalesce((select count(*) from customers x where x.company_id = v_company), 0)
      + coalesce((select count(*) from vendors x where x.company_id = v_company), 0)
      + coalesce((select count(*) from projects x where x.company_id = v_company), 0)
      + coalesce((select count(*) from contracts x where x.company_id = v_company), 0)
      + coalesce((select count(*) from work_orders x where x.company_id = v_company), 0)
      + coalesce((select count(*) from tickets x where x.company_id = v_company), 0)
      + coalesce((select count(*) from purchase_orders x where x.company_id = v_company), 0)
      + coalesce((select count(*) from purchase_requests x where x.company_id = v_company), 0)
      + coalesce((select count(*) from goods_receipts x where x.company_id = v_company), 0)
      + coalesce((select count(*) from ar_invoices x where x.company_id = v_company), 0)
      + coalesce((select count(*) from vendor_invoices x where x.company_id = v_company), 0)
      + coalesce((select count(*) from payroll_runs x where x.company_id = v_company), 0)
      + coalesce((select count(*) from stock_movements x where x.company_id = v_company), 0)
      + coalesce((select count(*) from material_requests x where x.company_id = v_company), 0)
      + coalesce((select count(*) from spk x where x.company_id = v_company), 0)
      + coalesce((select count(*) from progress_claims x where x.company_id = v_company), 0)
      + coalesce((select count(*) from bast x where x.company_id = v_company), 0)
      + coalesce((select count(*) from assets x where x.company_id = v_company), 0)
      + coalesce((select count(*) from journal_entries x where x.company_id = v_company), 0)
    into v_demo_transaksi;
  end if;

  -- =====================================================================
  -- Rakit baris keluaran (urutan & isi sama seperti v_kesiapan_produksi lama)
  -- =====================================================================

  company_id := v_company; kode := 'DEMO_PERUSAHAAN'; kategori := 'Data Contoh';
  judul := 'Perusahaan masih bertanda data contoh';
  keterangan := case when v_is_demo
    then 'Kolom companies.is_demo masih true — aplikasi masih dianggap terisi data peragaan, bukan data operasional sungguhan.'
    else 'Kolom companies.is_demo sudah false.' end;
  status := case when v_is_demo then 'bahaya' else 'aman' end;
  jumlah_terdampak := case when v_is_demo then 1 else 0 end;
  tindakan_disarankan := case when v_is_demo
    then 'Jalankan "Simulasi Pembersihan" lalu "Hapus Data Contoh" di bagian bawah halaman ini setelah mencadangkan basis data.'
    else 'Tidak ada tindakan.' end;
  return next;

  company_id := v_company; kode := 'DEMO_TRANSAKSI'; kategori := 'Data Contoh';
  judul := 'Baris transaksi yang berasal dari data contoh';
  keterangan := 'Jumlah baris pada sebagian tabel transaksi utama (karyawan, pelanggan, vendor, proyek, kontrak, work order, tiket, PO/PR, invoice, payroll, stok, MR, SPK, klaim progres, BAST, aset, jurnal) milik perusahaan ini — angka pendekatan, bukan penghitungan lengkap seluruh tabel. Jalankan "Simulasi Pembersihan" untuk rincian lengkap per tabel.';
  status := case when v_is_demo and v_demo_transaksi > 0 then 'bahaya' else 'aman' end;
  jumlah_terdampak := v_demo_transaksi;
  tindakan_disarankan := case when v_is_demo and v_demo_transaksi > 0
    then 'Bersihkan lewat bagian "Bersihkan Data Contoh" di bawah setelah mencadangkan basis data.'
    else 'Tidak ada tindakan.' end;
  return next;

  company_id := v_company; kode := 'AKUN_BELUM_LOGIN'; kategori := 'Akun Pengguna';
  judul := 'Akun pengguna yang belum pernah login';
  keterangan := 'Akun dengan profiles.last_login_at kosong — kemungkinan besar akun peragaan/contoh yang dibuat untuk demo, belum pernah dipakai sungguhan.';
  status := case when v_akun_belum_login > 0 then 'perhatian' else 'aman' end;
  jumlah_terdampak := v_akun_belum_login;
  tindakan_disarankan := case when v_akun_belum_login > 0
    then 'Tinjau daftar di bagian "Akun Peragaan" di bawah, lalu nonaktifkan/hapus yang tidak diperlukan di halaman Pengguna.'
    else 'Tidak ada tindakan.' end;
  return next;

  company_id := v_company; kode := 'KARYAWAN_TANPA_NPWP'; kategori := 'Data Karyawan';
  judul := 'Karyawan aktif tanpa NPWP';
  keterangan := 'Karyawan berstatus aktif dengan kolom npwp kosong — menghambat perhitungan PPh 21 yang akurat (tarif tidak ber-NPWP lebih tinggi).';
  status := case when v_emp_npwp > 0 then 'perhatian' else 'aman' end;
  jumlah_terdampak := v_emp_npwp;
  tindakan_disarankan := case when v_emp_npwp > 0 then 'Lengkapi NPWP karyawan di halaman Data Karyawan (HR).' else 'Tidak ada tindakan.' end;
  return next;

  company_id := v_company; kode := 'KARYAWAN_TANPA_REKENING'; kategori := 'Data Karyawan';
  judul := 'Karyawan aktif tanpa nomor rekening bank';
  keterangan := 'Karyawan berstatus aktif dengan kolom bank_account kosong — pembayaran gaji/payout tidak bisa diproses lewat transfer.';
  status := case when v_emp_bank > 0 then 'perhatian' else 'aman' end;
  jumlah_terdampak := v_emp_bank;
  tindakan_disarankan := case when v_emp_bank > 0 then 'Lengkapi data rekening bank karyawan di halaman Data Karyawan (HR).' else 'Tidak ada tindakan.' end;
  return next;

  company_id := v_company; kode := 'KARYAWAN_TANPA_BPJS'; kategori := 'Data Karyawan';
  judul := 'Karyawan aktif tanpa nomor BPJS';
  keterangan := 'Karyawan berstatus aktif dengan bpjs_kes_no dan/atau bpjs_tk_no kosong — kepesertaan BPJS Kesehatan/Ketenagakerjaan belum lengkap, berisiko pada kepatuhan & perhitungan iuran.';
  status := case when v_emp_bpjs > 0 then 'bahaya' else 'aman' end;
  jumlah_terdampak := v_emp_bpjs;
  tindakan_disarankan := case when v_emp_bpjs > 0 then 'Lengkapi nomor BPJS Kesehatan & Ketenagakerjaan karyawan di halaman Data Karyawan (HR).' else 'Tidak ada tindakan.' end;
  return next;

  company_id := v_company; kode := 'KONTRAK_TANPA_BERKAS'; kategori := 'Kontrak';
  judul := 'Kontrak tanpa berkas terlampir';
  keterangan := 'Kontrak (selain draft) dengan kolom file_url kosong — tidak ada dokumen sah yang bisa dijadikan rujukan hukum.';
  status := case when v_kontrak_berkas > 0 then 'perhatian' else 'aman' end;
  jumlah_terdampak := v_kontrak_berkas;
  tindakan_disarankan := case when v_kontrak_berkas > 0 then 'Unggah berkas kontrak di halaman Kontrak (Commerce).' else 'Tidak ada tindakan.' end;
  return next;

  company_id := v_company; kode := 'KONTRAK_KEDALUWARSA_AKTIF'; kategori := 'Kontrak';
  judul := 'Kontrak kedaluwarsa tapi masih berstatus aktif';
  keterangan := 'Kontrak dengan end_date sudah lewat tapi status masih ''aktif'' — berisiko dipakai sebagai dasar penagihan/SLA padahal sudah tidak berlaku.';
  status := case when v_kontrak_expired > 0 then 'bahaya' else 'aman' end;
  jumlah_terdampak := v_kontrak_expired;
  tindakan_disarankan := case when v_kontrak_expired > 0 then 'Perbarui status kontrak (perpanjang atau tandai selesai/putus) di halaman Kontrak (Commerce).' else 'Tidak ada tindakan.' end;
  return next;

  company_id := v_company; kode := 'GUDANG_TANPA_PIC'; kategori := 'Gudang';
  judul := 'Gudang aktif tanpa penanggung jawab';
  keterangan := 'Gudang aktif dengan kolom pic_id kosong — tidak ada yang bertanggung jawab atas akurasi stok di gudang tersebut.';
  status := case when v_gudang_pic > 0 then 'perhatian' else 'aman' end;
  jumlah_terdampak := v_gudang_pic;
  tindakan_disarankan := case when v_gudang_pic > 0 then 'Tetapkan penanggung jawab gudang di halaman Gudang (Inventory).' else 'Tidak ada tindakan.' end;
  return next;

  company_id := v_company; kode := 'JENIS_PEKERJAAN_TANPA_TARIF'; kategori := 'Tarif Pekerjaan';
  judul := 'Jenis pekerjaan aktif tanpa tarif';
  keterangan := 'Jenis pekerjaan aktif dengan tariff_amount = 0 — poin produktivitas teknisi/payout mitra untuk jenis pekerjaan ini akan terhitung Rp 0.';
  status := case when v_jt_tanpa_tarif > 0 then 'perhatian' else 'aman' end;
  jumlah_terdampak := v_jt_tanpa_tarif;
  tindakan_disarankan := case when v_jt_tanpa_tarif > 0 then 'Isi tarif jenis pekerjaan di halaman Jenis Pekerjaan (Operations/HR).' else 'Tidak ada tindakan.' end;
  return next;

  if v_has_tax_rates_ref then
    company_id := v_company; kode := 'PAJAK_BELUM_VERIFIKASI'; kategori := 'Referensi Pajak & BPJS';
    judul := 'Tarif pajak belum diverifikasi';
    keterangan := 'Baris pada tax_rates_ref dengan is_verified = false — tarif PPN/PPh masih berupa isian sistem, belum dicocokkan & disahkan tim pajak.';
    status := case when v_pajak_unverified > 0 then 'bahaya' else 'aman' end;
    jumlah_terdampak := v_pajak_unverified;
    tindakan_disarankan := case when v_pajak_unverified > 0 then 'Tinjau & tandai terverifikasi di halaman Referensi Pajak (Finance).' else 'Tidak ada tindakan.' end;
    return next;
  end if;

  if v_has_bpjs_verified then
    company_id := v_company; kode := 'BPJS_BELUM_VERIFIKASI'; kategori := 'Referensi Pajak & BPJS';
    judul := 'Konfigurasi BPJS belum diverifikasi';
    keterangan := 'Baris pada bpjs_config dengan is_verified = false — kelompok risiko JKK & tarif iuran BPJS masih berupa dugaan sistem, belum dicocokkan ke sertifikat kepesertaan BPJS Ketenagakerjaan.';
    status := case when v_bpjs_unverified > 0 then 'bahaya' else 'aman' end;
    jumlah_terdampak := v_bpjs_unverified;
    tindakan_disarankan := case when v_bpjs_unverified > 0 then 'Cocokkan ke sertifikat kepesertaan lalu tandai terverifikasi di halaman Setelan Payroll (Finance/HR).' else 'Tidak ada tindakan.' end;
    return next;
  end if;

  if v_has_price_source then
    company_id := v_company; kode := 'TARIF_ASUMSI'; kategori := 'Tarif Pekerjaan';
    judul := 'Tarif pekerjaan masih bertanda asumsi sistem';
    keterangan := 'Baris pada job_types aktif dengan price_source = ''asumsi_sistem'' — tarif belum dikonfirmasi berasal dari kontrak/negosiasi/survei pasar sesungguhnya.';
    status := case when v_jt_asumsi > 0 then 'bahaya' else 'aman' end;
    jumlah_terdampak := v_jt_asumsi;
    tindakan_disarankan := case when v_jt_asumsi > 0 then 'Perbarui asal-usul tarif (price_source) di halaman Jenis Pekerjaan setelah dikonfirmasi.' else 'Tidak ada tindakan.' end;
    return next;
  end if;

  return;
end;
$$;

comment on function public.fn_kesiapan_produksi() is
  'Versi cepat dari pemeriksaan kesiapan produksi: SECURITY DEFINER, melewati RLS dengan sengaja tapi tetap terkurung ke auth_company_id() lewat filter company_id eksplisit pada tiap query. Menggantikan v_kesiapan_produksi (security_invoker) yang menimbulkan statement timeout untuk pengguna biasa karena count(*) dievaluasi lewat RLS pada banyak tabel.';

revoke execute on function public.fn_kesiapan_produksi() from public;
revoke execute on function public.fn_kesiapan_produksi() from anon;
grant execute on function public.fn_kesiapan_produksi() to authenticated;

-- =====================================================================
-- 3. v_kesiapan_produksi — pembungkus tipis, supaya kode lama tidak rusak
-- =====================================================================
create or replace view public.v_kesiapan_produksi with (security_invoker = on) as
  select * from public.fn_kesiapan_produksi();

comment on view public.v_kesiapan_produksi is
  'Pembungkus tipis atas fn_kesiapan_produksi() (SECURITY DEFINER, cepat, terkurung company_id eksplisit). Lihat komentar fungsinya untuk alasan perubahan dari pendekatan UNION ALL security_invoker sebelumnya (menimbulkan statement timeout akibat RLS).';
