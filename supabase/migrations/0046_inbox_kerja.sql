-- =====================================================================
-- 0046_inbox_kerja.sql
--
-- KEBUTUHAN
-- Permintaan GM: "untuk menu yang lain selain HR, ada sistem inbox yaitu
-- isinya pekerjaan yang harus dilengkapi staf, spv, sampai keatas. jadi
-- inbox kerjanya tau dan tau mana yang sudah diselesaikan ataupun overdue."
--
-- Yang dibangun di sini BUKAN inbox persetujuan (v_approval_inbox +
-- halaman /persetujuan sudah menanganinya). Ini INBOX PEKERJAAN: daftar
-- pekerjaan yang BELUM LENGKAP di tiap unit, dengan pemilik berjenjang
-- (pelaksana -> supervisor -> manajer), penanda selesai, dan penanda
-- terlambat.
--
-- ISI MIGRASI
--   1. Tabel inbox_tugas                 -- satu baris = satu pekerjaan
--   2. Helper modul (array, murah)       -- fn_modul_dapat_dibaca/ditulis
--   3. RLS inbox_tugas                   -- berjenjang: diri / peran / modul
--   4. View v_inbox_kerja                -- + hari_terlambat & keterlambatan
--   5. fn_bangun_inbox_kerja()           -- generator, idempoten (kunci_unik)
--   6. fn_selesaikan_tugas_inbox()       -- tandai selesai + jejak siapa/kapan
--
-- CATATAN PERFORMA (pelajaran dari 0036)
-- v_kesiapan_produksi dengan security_invoker = on dulu menimbulkan
-- statement timeout karena count(*) di atas BANYAK tabel besar dievaluasi
-- baris demi baris lewat RLS. v_inbox_kerja TIDAK punya masalah itu:
--   - sumbernya SATU tabel kecil (inbox_tugas, ratusan baris, bukan ribuan
--     transaksi) -- semua pemindaian tabel besar terjadi di dalam
--     fn_bangun_inbox_kerja() yang SECURITY DEFINER dan dijalankan terjadwal,
--     bukan saat halaman dibuka;
--   - predikat RLS-nya hanya memakai fungsi TANPA ARGUMEN (auth_role(),
--     auth_employee_id(), fn_modul_dapat_dibaca()) sehingga PostgreSQL
--     mengevaluasinya SEKALI per query, bukan sekali per baris. can_read(modul)
--     SENGAJA TIDAK dipakai di policy karena argumennya kolom -> akan
--     dievaluasi per baris.
-- Karena itu security_invoker = on di sini aman dan tetap dipakai supaya
-- RLS inbox_tugas berlaku apa adanya.
--
-- Idempoten: aman dijalankan ulang.
-- =====================================================================

-- =====================================================================
-- 1. Tabel inbox_tugas
-- =====================================================================
create table if not exists public.inbox_tugas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,

  -- penempatan
  modul text not null references public.modules(code),
  jenis text not null,

  -- dokumen/baris yang harus dilengkapi
  entity_type text,
  entity_id uuid,
  judul text not null,
  keterangan text,
  route_path text,                       -- tautan ke halaman panel (lihat nav.ts)

  -- kepemilikan berjenjang
  pic_employee_id uuid references public.employees(id) on delete set null,
  pic_role text,                         -- dipakai bila belum ada orang spesifik
  branch_id uuid references public.branches(id) on delete set null,
  eskalasi_role text,                    -- peran di atasnya (spv/manajer)

  -- tenggat & bobot
  jatuh_tempo date,
  prioritas text not null default 'sedang',

  -- penyelesaian
  status text not null default 'terbuka',
  selesai_at timestamptz,
  selesai_by uuid references public.profiles(id) on delete set null,
  catatan_penyelesaian text,
  ditutup_otomatis boolean not null default false,

  -- asal & anti-duplikat
  sumber text not null default 'otomatis',
  kunci_unik text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,

  constraint inbox_tugas_prioritas_chk check (prioritas in ('tinggi','sedang','rendah')),
  constraint inbox_tugas_status_chk    check (status in ('terbuka','dikerjakan','selesai','batal')),
  constraint inbox_tugas_sumber_chk    check (sumber in ('otomatis','manual')),
  constraint inbox_tugas_jenis_chk     check (jenis in (
      'data_karyawan_belum_lengkap',
      'wo_tanpa_jenis_pekerjaan',
      'tiket_lewat_sla',
      'insiden_tanpa_rca',
      'proyek_tanpa_kontrak',
      'bast_tanpa_proyek',
      'pr_menunggu_po',
      'invoice_selisih_3way',
      'ar_jatuh_tempo_belum_lunas',
      'pembayaran_tanpa_arus_kas',
      'stok_negatif',
      'opname_belum_dikoreksi',
      'tarif_belum_terverifikasi',
      'tugas_manual')),
  -- status 'selesai' wajib punya jejak waktu; sebaliknya jejak waktu tanpa
  -- status selesai tidak boleh ada (supaya laporan "sudah diselesaikan" jujur)
  constraint inbox_tugas_selesai_chk check (
    case when status = 'selesai' then selesai_at is not null
         when status = 'batal'   then true
         else selesai_at is null end),
  constraint inbox_tugas_kunci_chk check (length(trim(kunci_unik)) > 0)
);

comment on table public.inbox_tugas is
  'Inbox pekerjaan per unit: satu baris = satu pekerjaan yang belum lengkap, dengan pemilik berjenjang (pic_employee_id -> pic_role -> eskalasi_role), tenggat, dan status penyelesaian. Diisi otomatis oleh fn_bangun_inbox_kerja() atau manual oleh atasan. Berbeda dari v_approval_inbox yang berisi PERSETUJUAN dokumen.';
comment on column public.inbox_tugas.kunci_unik is
  'Kunci idempoten generator, format "<jenis>:<identitas baris sumber>". Unik per perusahaan sehingga fn_bangun_inbox_kerja() boleh dijalankan berulang tanpa menduplikasi tugas.';
comment on column public.inbox_tugas.ditutup_otomatis is
  'true bila tugas ditutup oleh generator karena kondisinya sudah tidak berlaku. Tugas yang ditutup manusia TIDAK akan dibuka kembali oleh generator.';
comment on column public.inbox_tugas.eskalasi_role is
  'Peran satu tingkat di atas PIC. Dipakai untuk eskalasi tugas terlambat dan membuat tugas tetap terlihat oleh atasan.';

-- anti-duplikat: inti idempotensi generator
create unique index if not exists uq_inbox_tugas_kunci
  on public.inbox_tugas (company_id, kunci_unik);

-- pola query nyata: "inbox saya" (per orang), "inbox peran saya", per modul,
-- per tenggat. Indeks parsial -- yang dilihat pengguna hanya yang belum tuntas.
create index if not exists idx_inbox_tugas_pic_employee
  on public.inbox_tugas (company_id, pic_employee_id, jatuh_tempo)
  where status in ('terbuka','dikerjakan');
create index if not exists idx_inbox_tugas_pic_role
  on public.inbox_tugas (company_id, pic_role, jatuh_tempo)
  where status in ('terbuka','dikerjakan');
create index if not exists idx_inbox_tugas_eskalasi_role
  on public.inbox_tugas (company_id, eskalasi_role, jatuh_tempo)
  where status in ('terbuka','dikerjakan');
create index if not exists idx_inbox_tugas_modul_status
  on public.inbox_tugas (company_id, modul, status);
create index if not exists idx_inbox_tugas_jatuh_tempo
  on public.inbox_tugas (company_id, jatuh_tempo)
  where status in ('terbuka','dikerjakan');
create index if not exists idx_inbox_tugas_jenis
  on public.inbox_tugas (company_id, jenis, status);
create index if not exists idx_inbox_tugas_entity
  on public.inbox_tugas (entity_type, entity_id);

drop trigger if exists trg_inbox_tugas_updated_at on public.inbox_tugas;
create trigger trg_inbox_tugas_updated_at
  before update on public.inbox_tugas
  for each row execute function set_updated_at();

-- =====================================================================
-- 2. Helper modul -- dikembalikan sebagai ARRAY supaya murah di RLS
--    (fungsi tanpa argumen -> dievaluasi sekali per query, bukan per baris)
-- =====================================================================
create or replace function public.fn_modul_dapat_dibaca()
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when is_super() then coalesce((select array_agg(m.code) from modules m), '{}'::text[])
    else coalesce((
      select array_agg(rma.module_code)
      from role_module_access rma
      where rma.company_id = auth_company_id()
        and rma.role = auth_role()
        and rma.can_read
    ), '{}'::text[])
  end;
$$;

comment on function public.fn_modul_dapat_dibaca() is
  'Daftar kode modul yang boleh DIBACA pengguna saat ini. Padanan can_read() dalam bentuk array supaya bisa dipakai di policy RLS tanpa biaya per baris.';

create or replace function public.fn_modul_dapat_ditulis()
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when is_super() then coalesce((select array_agg(m.code) from modules m), '{}'::text[])
    else coalesce((
      select array_agg(rma.module_code)
      from role_module_access rma
      where rma.company_id = auth_company_id()
        and rma.role = auth_role()
        and rma.can_write
    ), '{}'::text[])
  end;
$$;

comment on function public.fn_modul_dapat_ditulis() is
  'Daftar kode modul yang boleh DITULIS pengguna saat ini. Padanan can_write() dalam bentuk array untuk policy RLS.';

revoke execute on function public.fn_modul_dapat_dibaca() from public;
revoke execute on function public.fn_modul_dapat_ditulis() from public;
-- anon memegang EXECUTE eksplisit dari default privileges Supabase, jadi
-- revoke dari PUBLIC saja belum cukup (lihat alasan yang sama di 0011).
revoke execute on function public.fn_modul_dapat_dibaca() from anon;
revoke execute on function public.fn_modul_dapat_ditulis() from anon;
grant execute on function public.fn_modul_dapat_dibaca() to authenticated, service_role;
grant execute on function public.fn_modul_dapat_ditulis() to authenticated, service_role;

-- =====================================================================
-- 3. RLS inbox_tugas
--
-- MEMBACA: seseorang melihat tugas yang (a) ditujukan ke dirinya,
-- (b) ditujukan ke perannya (PIC peran atau peran eskalasi), atau
-- (c) berada di modul yang boleh ia baca.
--
-- Pengecualian yang SENGAJA ditambahkan di luar permintaan: peran lapangan
-- (teknisi, mitra -- lihat tabel peran_lapangan dari 0039) hanya melihat
-- butir (a) dan (b). Alasannya, teknisi diberi can_read HR/INVENTORY supaya
-- bisa absen dan memakai material; tanpa pengecualian ini ia akan melihat
-- daftar "data karyawan belum lengkap" SELURUH pegawai, yang bertentangan
-- dengan self-scope teknisi/mitra yang ditetapkan 0025.
--
-- MENULIS/MENYELESAIKAN: PIC orangnya sendiri, atau (bukan peran lapangan
-- dan) PIC perannya, atau punya hak tulis di modul tugas tersebut.
-- =====================================================================
alter table public.inbox_tugas enable row level security;

drop policy if exists inbox_tugas_select on public.inbox_tugas;
create policy inbox_tugas_select on public.inbox_tugas for select
  to authenticated
  using (
    is_super()
    or (
      company_id = auth_company_id()
      and (
        (pic_employee_id is not null and pic_employee_id = auth_employee_id())
        or (pic_role is not null and pic_role = auth_role())
        or (eskalasi_role is not null and eskalasi_role = auth_role())
        or (not is_peran_lapangan() and modul = any (fn_modul_dapat_dibaca()))
      )
    )
  );

drop policy if exists inbox_tugas_insert on public.inbox_tugas;
create policy inbox_tugas_insert on public.inbox_tugas for insert
  to authenticated
  with check (
    is_super()
    or (
      company_id = auth_company_id()
      and not is_peran_lapangan()
      and modul = any (fn_modul_dapat_ditulis())
    )
  );

drop policy if exists inbox_tugas_update on public.inbox_tugas;
create policy inbox_tugas_update on public.inbox_tugas for update
  to authenticated
  using (
    is_super()
    or (
      company_id = auth_company_id()
      and (
        (pic_employee_id is not null and pic_employee_id = auth_employee_id())
        or (not is_peran_lapangan()
            and ((pic_role is not null and pic_role = auth_role())
                 or modul = any (fn_modul_dapat_ditulis())))
      )
    )
  )
  with check (
    is_super()
    or (
      company_id = auth_company_id()
      and (
        (pic_employee_id is not null and pic_employee_id = auth_employee_id())
        or (not is_peran_lapangan()
            and ((pic_role is not null and pic_role = auth_role())
                 or modul = any (fn_modul_dapat_ditulis())))
      )
    )
  );

-- Menghapus tugas menghapus jejak pekerjaan -- hanya super admin.
drop policy if exists inbox_tugas_delete on public.inbox_tugas;
create policy inbox_tugas_delete on public.inbox_tugas for delete
  to authenticated
  using (is_super());

revoke all on public.inbox_tugas from anon;

-- =====================================================================
-- 4. View v_inbox_kerja
--    Kolom turunan: hari_terlambat & keterlambatan ('aman','segera','terlambat')
--    Ambang 'segera' = 3 hari sebelum jatuh tempo.
-- =====================================================================
create or replace view public.v_inbox_kerja with (security_invoker = on) as
select
  t.id,
  t.company_id,
  t.modul,
  t.jenis,
  t.entity_type,
  t.entity_id,
  t.judul,
  t.keterangan,
  t.route_path,
  t.pic_employee_id,
  e.full_name       as nama_pic,
  t.pic_role,
  t.branch_id,
  b.name            as nama_cabang,
  t.eskalasi_role,
  t.jatuh_tempo,
  t.prioritas,
  t.status,
  t.selesai_at,
  t.selesai_by,
  p.full_name       as nama_penyelesai,
  t.catatan_penyelesaian,
  t.ditutup_otomatis,
  t.sumber,
  t.kunci_unik,
  t.created_at,
  t.updated_at,
  -- positif = sudah lewat tenggat sekian hari; negatif = masih ada sisa waktu
  case
    when t.jatuh_tempo is null then null
    when t.status in ('selesai','batal') then null
    else (current_date - t.jatuh_tempo)
  end as hari_terlambat,
  case
    when t.status in ('selesai','batal') then 'aman'
    when t.jatuh_tempo is null then 'aman'
    when t.jatuh_tempo < current_date then 'terlambat'
    when t.jatuh_tempo <= current_date + 3 then 'segera'
    else 'aman'
  end as keterlambatan
from public.inbox_tugas t
left join public.employees e on e.id = t.pic_employee_id
left join public.branches  b on b.id = t.branch_id
left join public.profiles  p on p.id = t.selesai_by;

comment on view public.v_inbox_kerja is
  'Inbox pekerjaan siap tampil: inbox_tugas + hari_terlambat & keterlambatan (aman/segera/terlambat) + nama cabang, nama PIC dan nama penyelesai. security_invoker = on aman di sini karena sumbernya satu tabel kecil dan predikat RLS-nya hanya memakai fungsi tanpa argumen (lihat catatan performa di kepala migrasi 0046).';

revoke all on public.v_inbox_kerja from anon;
grant select on public.v_inbox_kerja to authenticated, service_role;

-- =====================================================================
-- 5. fn_bangun_inbox_kerja() -- generator
--
-- Memindai basis data, meng-UPSERT tugas berdasar kunci_unik, lalu MENUTUP
-- otomatis tugas bersumber 'otomatis' yang kondisinya sudah tidak berlaku.
--
-- ATURAN JATUH TEMPO (sengaja DETERMINISTIK -- diturunkan dari tanggal
-- dokumen, bukan dari tanggal pemindaian, supaya menjalankan generator ulang
-- tidak pernah memundurkan tenggat dan tugas terlambat tetap terlambat):
--   data_karyawan_belum_lengkap : tanggal bergabung + 30 hari
--   wo_tanpa_jenis_pekerjaan    : tanggal WO selesai + 3 hari
--   tiket_lewat_sla             : tanggal batas SLA itu sendiri (sudah lewat)
--   insiden_tanpa_rca           : tanggal insiden + 7 hari
--   proyek_tanpa_kontrak        : tanggal mulai proyek + 14 hari
--   bast_tanpa_proyek           : tanggal BAST + 7 hari
--   pr_menunggu_po              : need_by_date - 7 hari (atau tanggal PR + 7)
--   invoice_selisih_3way        : jatuh tempo invoice (atau tgl invoice + 14)
--   ar_jatuh_tempo_belum_lunas  : jatuh tempo invoice itu sendiri
--   pembayaran_tanpa_arus_kas   : tanggal bayar + 3 hari
--   stok_negatif                : tanggal perubahan saldo terakhir + 1 hari
--   opname_belum_dikoreksi      : tanggal opname + 3 hari
--   tarif_belum_terverifikasi   : tanggal tarif dibuat + 30 hari
--
-- p_company_id null = seluruh perusahaan (dipakai penjadwal/administrator);
-- diisi = hanya perusahaan itu.
-- =====================================================================
create or replace function public.fn_bangun_inbox_kerja(p_company_id uuid default null)
returns table(modul text, jenis text, dibuat bigint, diperbarui bigint, ditutup bigint)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
-- nama kolom (modul, jenis) sengaja diprioritaskan atas nama parameter OUT
#variable_conflict use_column
declare
  v_company uuid := p_company_id;
begin
  return query
  with kandidat as (

    -- ---------------------------------------------------------------
    -- HR -- data karyawan aktif dengan kolom wajib kosong
    -- ---------------------------------------------------------------
    select
      e.company_id,
      'HR'::text                              as modul,
      'data_karyawan_belum_lengkap'::text     as jenis,
      'employees'::text                       as entity_type,
      e.id                                    as entity_id,
      ('Lengkapi data karyawan: ' || e.full_name || ' (' || coalesce(e.nip,'tanpa NIP') || ')')::text as judul,
      ('Kolom wajib yang masih kosong: ' || array_to_string(array_remove(array[
          case when nullif(trim(e.nik_ktp),'')     is null then 'NIK KTP' end,
          case when nullif(trim(e.npwp),'')        is null then 'NPWP' end,
          case when nullif(trim(e.ptkp_status),'') is null then 'status PTKP' end,
          case when nullif(trim(e.bank_account),'')is null then 'rekening bank' end,
          case when nullif(trim(e.bpjs_tk_no),'')  is null then 'BPJS Ketenagakerjaan' end,
          case when nullif(trim(e.bpjs_kes_no),'') is null then 'BPJS Kesehatan' end,
          case when e.birth_date is null           then 'tanggal lahir' end,
          case when nullif(trim(e.gender),'')      is null then 'jenis kelamin' end,
          case when nullif(trim(e.phone),'')       is null then 'nomor telepon' end,
          case when nullif(trim(e.address),'')     is null then 'alamat' end
        ], null), ', ') || '. Data ini dipakai untuk payroll, pajak dan BPJS.')::text as keterangan,
      '/hr/karyawan'::text                    as route_path,
      null::uuid                              as pic_employee_id,
      'staff_hr'::text                        as pic_role,
      e.branch_id,
      'manager_hr'::text                      as eskalasi_role,
      (coalesce(e.join_date, e.created_at::date) + 30)::date as jatuh_tempo,
      -- kosongnya NIK/NPWP/PTKP langsung menghambat perhitungan PPh 21
      (case when nullif(trim(e.nik_ktp),'') is null
              or nullif(trim(e.npwp),'') is null
              or nullif(trim(e.ptkp_status),'') is null
            then 'tinggi' else 'sedang' end)::text as prioritas,
      ('data_karyawan_belum_lengkap:' || e.id::text)::text as kunci_unik
    from public.employees e
    where e.status = 'aktif'
      and (v_company is null or e.company_id = v_company)
      and (nullif(trim(e.nik_ktp),'') is null
        or nullif(trim(e.npwp),'') is null
        or nullif(trim(e.ptkp_status),'') is null
        or nullif(trim(e.bank_account),'') is null
        or nullif(trim(e.bpjs_tk_no),'') is null
        or nullif(trim(e.bpjs_kes_no),'') is null
        or e.birth_date is null
        or nullif(trim(e.gender),'') is null
        or nullif(trim(e.phone),'') is null
        or nullif(trim(e.address),'') is null)

    union all

    -- ---------------------------------------------------------------
    -- OPERATIONS -- work order selesai tanpa jenis pekerjaan
    -- (tanpa job_type_id, poin produktivitas & tarif tidak bisa dihitung)
    -- ---------------------------------------------------------------
    select
      w.company_id,
      'OPERATIONS'::text,
      'wo_tanpa_jenis_pekerjaan'::text,
      'work_orders'::text,
      w.id,
      ('Isi jenis pekerjaan WO ' || w.wo_no)::text,
      ('Work order sudah berstatus selesai tetapi jenis pekerjaannya belum diisi, sehingga poin produktivitas teknisi dan nilai tarifnya tidak dapat dihitung.')::text,
      '/ops/work-order'::text,
      w.assigned_to,
      'spv_operations'::text,
      w.branch_id,
      'manager_operations'::text,
      (coalesce(w.finished_at, w.updated_at)::date + 3)::date,
      'sedang'::text,
      ('wo_tanpa_jenis_pekerjaan:' || w.id::text)::text
    from public.work_orders w
    where w.status = 'done'
      and w.job_type_id is null
      and (v_company is null or w.company_id = v_company)

    union all

    -- ---------------------------------------------------------------
    -- OPERATIONS -- tiket melewati batas SLA tapi belum resolved
    -- ---------------------------------------------------------------
    select
      k.company_id,
      'OPERATIONS'::text,
      'tiket_lewat_sla'::text,
      'tickets'::text,
      k.id,
      ('Tiket lewat SLA: ' || k.ticket_no || ' -- ' || coalesce(k.customer_name,'pelanggan tidak tercatat'))::text,
      ('Batas SLA ' || to_char(k.sla_due_at, 'DD Mon YYYY HH24:MI')
        || ' sudah terlewat dan tiket belum berstatus resolved (status sekarang: ' || k.status
        || ', severity: ' || coalesce(k.severity,'-') || '). Selesaikan atau eskalasikan.')::text,
      '/ops/tiket'::text,
      k.assigned_to,
      (case when k.assigned_to is null then 'dispatcher' else 'teknisi' end)::text,
      k.branch_id,
      'spv_operations'::text,
      k.sla_due_at::date,
      (case when k.severity in ('kritis','tinggi') then 'tinggi' else 'sedang' end)::text,
      ('tiket_lewat_sla:' || k.id::text)::text
    from public.tickets k
    where k.sla_due_at is not null
      and k.sla_due_at < now()
      and k.resolved_at is null
      and k.status not in ('resolved','closed','cancelled')
      and (v_company is null or k.company_id = v_company)

    union all

    -- ---------------------------------------------------------------
    -- OPERATIONS (K3) -- insiden HSE tanpa root cause lebih dari 3 hari
    -- ---------------------------------------------------------------
    select
      h.company_id,
      'OPERATIONS'::text,
      'insiden_tanpa_rca'::text,
      'hse_incidents'::text,
      h.id,
      ('Lengkapi RCA insiden ' || h.incident_no)::text,
      ('Insiden tanggal ' || to_char(h.incident_date,'DD Mon YYYY')
        || ' sudah lebih dari 3 hari tanpa akar masalah (root cause). Tanpa RCA, tindakan korektif dan laporan K3 tidak dapat ditutup.')::text,
      '/k3/insiden'::text,
      null::uuid,
      'spv_operations'::text,
      h.branch_id,
      'manager_operations'::text,
      (h.incident_date + 7)::date,
      'tinggi'::text,
      ('insiden_tanpa_rca:' || h.id::text)::text
    from public.hse_incidents h
    where h.root_cause_id is null
      and h.incident_date < current_date - 3
      and coalesce(h.status,'') <> 'batal'
      and (v_company is null or h.company_id = v_company)

    union all

    -- ---------------------------------------------------------------
    -- DEPLOYMENT -- proyek tanpa kontrak / SPK (dasar penagihan hilang)
    -- ---------------------------------------------------------------
    select
      pr.company_id,
      'DEPLOYMENT'::text,
      'proyek_tanpa_kontrak'::text,
      'projects'::text,
      pr.id,
      ('Lengkapi dasar kontrak proyek ' || pr.project_code || ' -- ' || pr.project_name)::text,
      ('Proyek belum tertaut ke '
        || case when pr.contract_id is null and pr.spk_id is null then 'kontrak dan SPK'
                when pr.contract_id is null then 'kontrak'
                else 'SPK' end
        || '. Tanpa tautan ini nilai proyek tidak punya dasar penagihan dan margin tidak dapat diaudit.')::text,
      '/deploy/proyek'::text,
      pr.pm_id,
      'project_manager'::text,
      pr.branch_id,
      'manager_deployment'::text,
      (coalesce(pr.start_date, pr.created_at::date) + 14)::date,
      'tinggi'::text,
      ('proyek_tanpa_kontrak:' || pr.id::text)::text
    from public.projects pr
    where (pr.contract_id is null or pr.spk_id is null)
      and coalesce(pr.status,'') not in ('batal','selesai')
      and (v_company is null or pr.company_id = v_company)

    union all

    -- ---------------------------------------------------------------
    -- DEPLOYMENT -- BAST tanpa proyek (progres tidak terhubung)
    -- ---------------------------------------------------------------
    select
      ba.company_id,
      'DEPLOYMENT'::text,
      'bast_tanpa_proyek'::text,
      'bast'::text,
      ba.id,
      ('Tautkan BAST ' || ba.bast_no || ' ke proyek')::text,
      ('BAST tanggal ' || to_char(ba.bast_date,'DD Mon YYYY')
        || ' belum tertaut ke proyek manapun, sehingga serah terima ini tidak terhitung pada progres proyek maupun kurva S.')::text,
      '/deploy/rfs'::text,
      null::uuid,
      'project_manager'::text,
      null::uuid,
      'manager_deployment'::text,
      (ba.bast_date + 7)::date,
      'sedang'::text,
      ('bast_tanpa_proyek:' || ba.id::text)::text
    from public.bast ba
    where ba.project_id is null
      and coalesce(ba.status,'') <> 'ditolak'
      and (v_company is null or ba.company_id = v_company)

    union all

    -- ---------------------------------------------------------------
    -- PROCUREMENT -- PR sudah disetujui tapi PO belum terbit
    -- ---------------------------------------------------------------
    select
      q.company_id,
      'PROCUREMENT'::text,
      'pr_menunggu_po'::text,
      'purchase_requests'::text,
      q.id,
      ('Terbitkan PO untuk PR ' || q.pr_no)::text,
      ('Purchase request sudah disetujui'
        || case when q.need_by_date is not null
                then ' dan dibutuhkan paling lambat ' || to_char(q.need_by_date,'DD Mon YYYY')
                else '' end
        || ', tetapi belum ada purchase order yang menindaklanjuti.')::text,
      '/procurement/pr'::text,
      (select em.id from public.employees em where em.id = q.requester_id),
      'staff_procurement'::text,
      q.branch_id,
      'manager_procurement'::text,
      coalesce(q.need_by_date - 7, q.request_date + 7)::date,
      (case when q.need_by_date is not null and q.need_by_date < current_date
            then 'tinggi' else 'sedang' end)::text,
      ('pr_menunggu_po:' || q.id::text)::text
    from public.purchase_requests q
    where q.status = 'disetujui'
      and not exists (select 1 from public.purchase_orders po where po.pr_id = q.id)
      and (v_company is null or q.company_id = v_company)

    union all

    -- ---------------------------------------------------------------
    -- PROCUREMENT -- invoice vendor selisih 3-way match
    -- ---------------------------------------------------------------
    select
      vi.company_id,
      'PROCUREMENT'::text,
      'invoice_selisih_3way'::text,
      'vendor_invoices'::text,
      vi.id,
      ('Selesaikan selisih 3-way invoice ' || vi.inv_no)::text,
      ('Invoice vendor ' || coalesce(vn.name,'-') || ' bernilai '
        || to_char(coalesce(vi.total,0),'FM999G999G999G999') || ' berstatus SELISIH pada pencocokan PO-GR-Invoice'
        || case when nullif(trim(vi.match_note),'') is not null then '. Catatan: ' || vi.match_note else '' end
        || '. Invoice tidak boleh dibayar sebelum selisih tuntas.')::text,
      '/procurement/invoice-vendor'::text,
      null::uuid,
      'staff_procurement'::text,
      null::uuid,
      'manager_procurement'::text,
      coalesce(vi.due_date, vi.invoice_date + 14)::date,
      'tinggi'::text,
      ('invoice_selisih_3way:' || vi.id::text)::text
    from public.vendor_invoices vi
    left join public.vendors vn on vn.id = vi.vendor_id
    where vi.match_status = 'selisih'
      and (v_company is null or vi.company_id = v_company)

    union all

    -- ---------------------------------------------------------------
    -- FINANCE -- piutang jatuh tempo belum lunas
    -- ---------------------------------------------------------------
    select
      ar.company_id,
      'FINANCE'::text,
      'ar_jatuh_tempo_belum_lunas'::text,
      'ar_invoices'::text,
      ar.id,
      ('Tagih piutang jatuh tempo: ' || ar.inv_no)::text,
      ('Invoice ke ' || coalesce(cu.name,'pelanggan') || ' jatuh tempo '
        || to_char(ar.due_date,'DD Mon YYYY') || ', sisa tagihan '
        || to_char(coalesce(ar.total,0) - coalesce(ar.paid_amount,0),'FM999G999G999G999')
        || ' dari total ' || to_char(coalesce(ar.total,0),'FM999G999G999G999') || '.')::text,
      '/finance/ar'::text,
      null::uuid,
      'staff_finance'::text,
      null::uuid,
      'manager_finance'::text,
      ar.due_date,
      -- lewat 30 hari = masuk kategori piutang bermasalah
      (case when ar.due_date < current_date - 30 then 'tinggi' else 'sedang' end)::text,
      ('ar_jatuh_tempo_belum_lunas:' || ar.id::text)::text
    from public.ar_invoices ar
    left join public.customers cu on cu.id = ar.customer_id
    where ar.due_date is not null
      and ar.due_date < current_date
      and coalesce(ar.paid_amount,0) < coalesce(ar.total,0)
      and coalesce(ar.status,'') not in ('lunas','batal','draft')
      and (v_company is null or ar.company_id = v_company)

    union all

    -- ---------------------------------------------------------------
    -- FINANCE -- pembayaran ke vendor belum tercatat di arus kas
    -- (ref_type dibandingkan tanpa peduli huruf besar/kecil -- data lama
    --  memakai 'AP_PAYMENT', konvensi lain memakai huruf kecil)
    -- ---------------------------------------------------------------
    select
      ap.company_id,
      'FINANCE'::text,
      'pembayaran_tanpa_arus_kas'::text,
      'ap_payments'::text,
      ap.id,
      ('Catat arus kas pembayaran ' || ap.payment_no)::text,
      ('Pembayaran tanggal ' || to_char(ap.payment_date,'DD Mon YYYY') || ' sebesar '
        || to_char(coalesce(ap.amount,0),'FM999G999G999G999')
        || ' belum punya baris arus kas, sehingga laporan kas dan rekonsiliasi bank tidak akan seimbang.')::text,
      '/finance/cashflow'::text,
      null::uuid,
      'staff_finance'::text,
      null::uuid,
      'manager_finance'::text,
      (ap.payment_date + 3)::date,
      'sedang'::text,
      ('pembayaran_tanpa_arus_kas:' || ap.id::text)::text
    from public.ap_payments ap
    where coalesce(ap.status,'') <> 'batal'
      and not exists (
        select 1 from public.cash_flows cf
        where upper(cf.ref_type) = 'AP_PAYMENT' and cf.ref_id = ap.id)
      and (v_company is null or ap.company_id = v_company)

    union all

    -- ---------------------------------------------------------------
    -- INVENTORY -- saldo stok negatif (mustahil secara fisik)
    -- ---------------------------------------------------------------
    select
      sb.company_id,
      'INVENTORY'::text,
      'stok_negatif'::text,
      'stock_balances'::text,
      sb.id,
      ('Koreksi saldo negatif: ' || coalesce(ic.name, 'item') || ' di ' || coalesce(wh.name,'gudang'))::text,
      ('Saldo tercatat ' || sb.qty::text
        || ' (negatif). Penyebab biasanya pemakaian material dicatat mendahului penerimaan barang. Perlu koreksi mutasi atau opname.')::text,
      '/inventory/stok'::text,
      null::uuid,
      'staff_inventory'::text,
      null::uuid,
      'manager_inventory'::text,
      (sb.updated_at::date + 1)::date,
      'tinggi'::text,
      ('stok_negatif:' || sb.id::text)::text
    from public.stock_balances sb
    left join public.item_catalog ic on ic.id = sb.item_id
    left join public.warehouses  wh on wh.id = sb.warehouse_id
    where sb.qty < 0
      and (v_company is null or sb.company_id = v_company)

    union all

    -- ---------------------------------------------------------------
    -- INVENTORY -- opname sudah disetujui/selesai tapi saldo belum dikoreksi
    -- ---------------------------------------------------------------
    select
      so.company_id,
      'INVENTORY'::text,
      'opname_belum_dikoreksi'::text,
      'stock_opnames'::text,
      so.id,
      ('Koreksi saldo hasil opname ' || so.opname_no)::text,
      ('Opname di ' || coalesce(wh2.name,'gudang') || ' tanggal ' || to_char(so.opname_date,'DD Mon YYYY')
        || ' sudah berstatus ' || so.status
        || ', tetapi saldo stok sistem masih berbeda dari hasil hitung fisik. Selisihnya perlu dijurnal/dikoreksi.')::text,
      '/inventory/opname'::text,
      (select em2.id from public.employees em2 where em2.id = so.pic_id),
      'staff_inventory'::text,
      null::uuid,
      'manager_inventory'::text,
      (so.opname_date + 3)::date,
      'tinggi'::text,
      ('opname_belum_dikoreksi:' || so.id::text)::text
    from public.stock_opnames so
    left join public.warehouses wh2 on wh2.id = so.warehouse_id
    where so.status in ('disetujui','selesai')
      and exists (
        select 1
        from public.stock_opname_lines sl
        where sl.opname_id = so.id
          and coalesce(sl.variance,0) <> 0
          and not exists (
            select 1 from public.stock_balances sb2
            where sb2.warehouse_id = so.warehouse_id
              and sb2.item_id = sl.item_id
              and sb2.qty = sl.qty_physical))
      and (v_company is null or so.company_id = v_company)

    union all

    -- ---------------------------------------------------------------
    -- PRODUCTIVITY -- tarif yang masih berasal dari asumsi sistem
    -- (sumbernya sama dengan view v_tarif_belum_terverifikasi; di sini
    --  dibaca dari tabel dasar supaya tidak bergantung pada RLS view)
    -- ---------------------------------------------------------------
    select
      x.company_id,
      'PRODUCTIVITY'::text,
      'tarif_belum_terverifikasi'::text,
      x.sumber_tabel,
      x.id,
      ('Verifikasi tarif ' || coalesce(x.kode,'tanpa kode') || ' -- ' || coalesce(x.deskripsi,'-'))::text,
      ('Nilai ' || to_char(coalesce(x.tarif,0),'FM999G999G999G999')
        || ' masih berlabel asumsi sistem, belum dipastikan ke dokumen resmi. ' || x.dipakai_di)::text,
      x.route_path,
      null::uuid,
      'manager_commerce'::text,
      null::uuid,
      'direktur'::text,
      (x.created_at::date + 30)::date,
      'tinggi'::text,
      ('tarif_belum_terverifikasi:' || x.sumber_tabel || ':' || x.id::text)::text
    from (
      select jt.company_id, 'job_types'::text as sumber_tabel, jt.id, jt.code as kode, jt.name as deskripsi,
             jt.tariff_amount as tarif, jt.created_at,
             '/pengaturan/kesiapan'::text as route_path,
             'Dipakai untuk poin produktivitas teknisi dan tarif cadangan payout mitra.'::text as dipakai_di
      from public.job_types jt
      where jt.price_source = 'asumsi_sistem' and jt.is_active
      union all
      select cpl.company_id, 'contract_price_list', cpl.id, cpl.item_code, cpl.description,
             cpl.unit_price, cpl.created_at,
             '/commerce/price-list',
             'Dipakai untuk menghitung nilai klaim progres dan penagihan ke pelanggan.'
      from public.contract_price_list cpl
      where cpl.price_source = 'asumsi_sistem' and cpl.is_active
      union all
      select frc.company_id, 'freelance_rate_cards', frc.id, jt2.code,
             coalesce(jt2.name,'Rate card mitra'),
             frc.rate_amount, frc.created_at,
             '/hr/freelance',
             'Dipakai langsung dalam perhitungan payout mitra freelance.'
      from public.freelance_rate_cards frc
      left join public.job_types jt2 on jt2.id = frc.job_type_id
      where frc.price_source = 'asumsi_sistem' and frc.is_active
    ) x
    where (v_company is null or x.company_id = v_company)
  ),

  -- ---------------------------------------------------------------
  -- UPSERT: tugas baru dibuat, tugas lama disegarkan isinya.
  -- Tugas otomatis yang dulu DITUTUP OTOMATIS dibuka kembali bila
  -- kondisinya muncul lagi; tugas yang ditutup MANUSIA tidak diganggu.
  -- ---------------------------------------------------------------
  ups as (
    insert into public.inbox_tugas as it (
      company_id, modul, jenis, entity_type, entity_id, judul, keterangan,
      route_path, pic_employee_id, pic_role, branch_id, eskalasi_role,
      jatuh_tempo, prioritas, sumber, kunci_unik)
    select
      k.company_id, k.modul, k.jenis, k.entity_type, k.entity_id, k.judul, k.keterangan,
      k.route_path, k.pic_employee_id, k.pic_role, k.branch_id, k.eskalasi_role,
      k.jatuh_tempo, k.prioritas, 'otomatis', k.kunci_unik
    from kandidat k
    on conflict (company_id, kunci_unik) do update set
      modul            = excluded.modul,
      entity_type      = excluded.entity_type,
      entity_id        = excluded.entity_id,
      judul            = excluded.judul,
      keterangan       = excluded.keterangan,
      route_path       = excluded.route_path,
      pic_employee_id  = excluded.pic_employee_id,
      pic_role         = excluded.pic_role,
      branch_id        = excluded.branch_id,
      eskalasi_role    = excluded.eskalasi_role,
      jatuh_tempo      = excluded.jatuh_tempo,
      prioritas        = excluded.prioritas,
      status           = case when it.status = 'selesai' and it.ditutup_otomatis
                              then 'terbuka' else it.status end,
      selesai_at       = case when it.status = 'selesai' and it.ditutup_otomatis
                              then null else it.selesai_at end,
      selesai_by       = case when it.status = 'selesai' and it.ditutup_otomatis
                              then null else it.selesai_by end,
      catatan_penyelesaian = case when it.status = 'selesai' and it.ditutup_otomatis
                              then null else it.catatan_penyelesaian end,
      ditutup_otomatis = case when it.status = 'selesai' and it.ditutup_otomatis
                              then false else it.ditutup_otomatis end,
      updated_at       = now()
    where it.sumber = 'otomatis'
    returning it.modul as r_modul, it.jenis as r_jenis, (it.xmax::text::bigint = 0) as baru
  ),

  -- ---------------------------------------------------------------
  -- TUTUP OTOMATIS: tugas otomatis yang kunci_unik-nya tidak lagi muncul
  -- pada pemindaian = kondisinya sudah tidak berlaku.
  -- (Sub-perintah ini memakai snapshot sebelum ups, dan himpunan barisnya
  --  saling lepas dengan ups, sehingga tidak ada baris yang diubah dua kali.)
  -- ---------------------------------------------------------------
  tutup as (
    update public.inbox_tugas t set
      status = 'selesai',
      selesai_at = now(),
      selesai_by = null,
      ditutup_otomatis = true,
      catatan_penyelesaian = 'Ditutup otomatis oleh fn_bangun_inbox_kerja(): kondisi yang memunculkan tugas ini sudah tidak berlaku.',
      updated_at = now()
    where t.sumber = 'otomatis'
      and t.status in ('terbuka','dikerjakan')
      and (v_company is null or t.company_id = v_company)
      and not exists (
        select 1 from kandidat k
        where k.company_id = t.company_id and k.kunci_unik = t.kunci_unik)
    returning t.modul as r_modul, t.jenis as r_jenis
  ),

  gabung as (
    select r_modul, r_jenis, case when baru then 1 else 0 end as d,
           case when baru then 0 else 1 end as u, 0 as c
    from ups
    union all
    select r_modul, r_jenis, 0, 0, 1 from tutup
  )
  select g.r_modul, g.r_jenis, sum(g.d)::bigint, sum(g.u)::bigint, sum(g.c)::bigint
  from gabung g
  group by g.r_modul, g.r_jenis
  order by g.r_modul, g.r_jenis;
end;
$$;

comment on function public.fn_bangun_inbox_kerja(uuid) is
  'Generator inbox pekerjaan. Memindai 13 jenis pekerjaan yang belum lengkap di HR, OPERATIONS, DEPLOYMENT, PROCUREMENT, FINANCE, INVENTORY dan PRODUCTIVITY, meng-UPSERT ke inbox_tugas berdasar kunci_unik (idempoten -- dijalankan berulang tidak menduplikasi), lalu menutup otomatis tugas yang kondisinya sudah tidak berlaku. p_company_id null berarti seluruh perusahaan. Mengembalikan ringkasan per modul/jenis: dibuat, diperbarui, ditutup.';

revoke execute on function public.fn_bangun_inbox_kerja(uuid) from public;
revoke execute on function public.fn_bangun_inbox_kerja(uuid) from anon;
grant execute on function public.fn_bangun_inbox_kerja(uuid) to authenticated, service_role;

-- =====================================================================
-- 6. fn_selesaikan_tugas_inbox() -- tandai selesai + jejak siapa/kapan
--    Boleh dipanggil oleh PIC orangnya, PIC perannya, atau pemegang hak
--    tulis modul tugas tersebut. Peran lapangan hanya boleh menutup tugas
--    yang memang ditujukan ke dirinya (sejalan dengan 0039/0025).
-- =====================================================================
create or replace function public.fn_selesaikan_tugas_inbox(p_id uuid, p_catatan text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_t public.inbox_tugas;
  v_boleh boolean;
begin
  select * into v_t from public.inbox_tugas where id = p_id;
  if not found then
    raise exception 'Tugas inbox tidak ditemukan: %', p_id using errcode = 'P0002';
  end if;

  if not is_super() and v_t.company_id is distinct from auth_company_id() then
    raise exception 'Tugas inbox ini milik perusahaan lain' using errcode = '42501';
  end if;

  v_boleh :=
       is_super()
    or (v_t.pic_employee_id is not null and v_t.pic_employee_id = auth_employee_id())
    or (not is_peran_lapangan()
        and ((v_t.pic_role is not null and v_t.pic_role = auth_role())
             or can_write(v_t.modul)));

  if not v_boleh then
    raise exception 'Anda tidak berhak menyelesaikan tugas ini (modul %, PIC peran %)',
      v_t.modul, coalesce(v_t.pic_role,'-') using errcode = '42501';
  end if;

  if v_t.status in ('selesai','batal') then
    return jsonb_build_object(
      'id', v_t.id, 'status', v_t.status, 'selesai_at', v_t.selesai_at,
      'pesan', 'Tugas sudah berstatus ' || v_t.status || ', tidak ada perubahan.');
  end if;

  update public.inbox_tugas set
    status = 'selesai',
    selesai_at = now(),
    selesai_by = auth.uid(),
    ditutup_otomatis = false,
    catatan_penyelesaian = nullif(trim(coalesce(p_catatan,'')),''),
    updated_at = now()
  where id = p_id
  returning * into v_t;

  return jsonb_build_object(
    'id', v_t.id, 'modul', v_t.modul, 'jenis', v_t.jenis,
    'status', v_t.status, 'selesai_at', v_t.selesai_at, 'selesai_by', v_t.selesai_by,
    'catatan_penyelesaian', v_t.catatan_penyelesaian,
    'pesan', 'Tugas ditandai selesai.');
end;
$$;

comment on function public.fn_selesaikan_tugas_inbox(uuid, text) is
  'Menandai satu tugas inbox selesai dan mencatat siapa (auth.uid()) serta kapan. Menolak dengan errcode 42501 bila pemanggil bukan PIC tugas dan tidak punya hak tulis pada modul tugas tersebut.';

revoke execute on function public.fn_selesaikan_tugas_inbox(uuid, text) from public;
revoke execute on function public.fn_selesaikan_tugas_inbox(uuid, text) from anon;
grant execute on function public.fn_selesaikan_tugas_inbox(uuid, text) to authenticated, service_role;
