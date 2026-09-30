-- Enforce tenant ownership before privileged RPC bodies, including super admin callers.
CREATE OR REPLACE FUNCTION public.fn_bangun_inbox_kerja(p_company_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(modul text, jenis text, dibuat bigint, diperbarui bigint, ditutup bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
-- nama kolom (modul, jenis) sengaja diprioritaskan atas nama parameter OUT
#variable_conflict use_column
declare
  v_company uuid := case when auth.uid() is null or public.is_platform_admin() then p_company_id else public.auth_company_id() end;
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin()
     and (public.auth_company_id() is null or coalesce(p_company_id,public.auth_company_id()) is distinct from public.auth_company_id()) then
    raise exception 'Tidak berwenang mengakses workspace ini.' using errcode='42501';
  end if;

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
$function$;

CREATE OR REPLACE FUNCTION public.fn_bersihkan_data_contoh(p_company uuid, p_konfirmasi text)
 RETURNS TABLE(nama_tabel text, baris_dihapus bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin()
     and (public.auth_company_id() is null or coalesce(p_company,public.auth_company_id()) is distinct from public.auth_company_id()) then
    raise exception 'Tidak berwenang mengakses workspace ini.' using errcode='42501';
  end if;

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
$function$;

CREATE OR REPLACE FUNCTION public.fn_bongkar_wfp(p_company_id uuid DEFAULT auth_company_id())
 RETURNS TABLE(kamus_baris bigint, data_baris bigint, md5_kamus text, md5_data text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_co uuid; v_kamus text; v_data text; r text; f text[]; i int; c text; k int;
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin()
     and (public.auth_company_id() is null or coalesce(p_company_id,public.auth_company_id()) is distinct from public.auth_company_id()) then
    raise exception 'Tidak berwenang mengakses workspace ini.' using errcode='42501';
  end if;

  v_co := fn_jaga_impor_hr(p_company_id);

  select string_agg(isi, chr(10) order by urut) into v_kamus
    from stg_blob where bagian = 'kamus' and company_id = v_co;
  select string_agg(isi, chr(10) order by urut) into v_data
    from stg_blob where bagian = 'data'  and company_id = v_co;

  delete from stg_kamus where company_id = v_co;
  delete from stg_wfp   where company_id = v_co;

  foreach r in array coalesce(string_to_array(v_kamus, chr(10)), array[]::text[]) loop
    if r is null or r = '' then continue; end if;
    f := string_to_array(r, '^'); c := f[1];
    for i in 2 .. array_length(f, 1) loop
      insert into stg_kamus(company_id, kolom, kode, nilai) values (v_co, c, i - 1, f[i])
      on conflict do nothing;
    end loop;
  end loop;

  k := 0;
  foreach r in array coalesce(string_to_array(v_data, chr(10)), array[]::text[]) loop
    if r is null or r = '' then continue; end if;
    k := k + 1; f := string_to_array(r, '^');
    insert into stg_wfp(company_id, baris, object_id, nik, nama, gaji,
      position_name, position_title, kemitraan, branch, level_jabatan, group_wfp, sub_group,
      group_fungsi, psa, portofolio, status_teknisi, status_salary, nama_program, sto, sto_kode,
      status_penugasan, skill, sektor_ditangani)
    values (v_co, k, nullif(f[1],''), nullif(f[2],''), nullif(f[3],''), nullif(f[4],'')::numeric,
      (select nilai from stg_kamus where company_id=v_co and kolom='position_name'    and kode = nullif(f[5],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='position_title'   and kode = nullif(f[6],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='kemitraan'        and kode = nullif(f[7],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='branch'           and kode = nullif(f[8],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='level'            and kode = nullif(f[9],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='group_wfp'        and kode = nullif(f[10],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='sub_group'        and kode = nullif(f[11],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='group_fungsi'     and kode = nullif(f[12],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='psa'              and kode = nullif(f[13],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='portofolio'       and kode = nullif(f[14],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='status_teknisi'   and kode = nullif(f[15],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='status_salary'    and kode = nullif(f[16],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='nama_program'     and kode = nullif(f[17],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='sto'              and kode = nullif(f[18],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='sto_kode'         and kode = nullif(f[19],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='status_penugasan' and kode = nullif(f[20],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='skill'            and kode = nullif(f[21],'')::int),
      (select nilai from stg_kamus where company_id=v_co and kolom='sektor_ditangani' and kode = nullif(f[22],'')::int));
  end loop;

  return query select
    (select count(*) from stg_kamus where company_id = v_co),
    (select count(*) from stg_wfp   where company_id = v_co),
    md5(coalesce(v_kamus, '')), md5(coalesce(v_data, ''));
end $function$;

CREATE OR REPLACE FUNCTION public.fn_buat_draft_tagihan(p_company uuid, p_bulan date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date)
 RETURNS saas_invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s public.tenant_subscriptions; p public.saas_plans; u jsonb; v_lines jsonb := '[]'; v_total numeric := 0;
  v_awal date := date_trunc('month', p_bulan)::date; v_akhir date := (date_trunc('month', p_bulan) + interval '1 month - 1 day')::date;
  v_teknisi numeric; v_wo numeric; v_inv public.saas_invoices; v_harga numeric;
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin()
     and (public.auth_company_id() is null or coalesce(p_company,public.auth_company_id()) is distinct from public.auth_company_id()) then
    raise exception 'Tidak berwenang mengakses workspace ini.' using errcode='42501';
  end if;

  if not public.is_platform_admin() then raise exception 'Hanya platform admin.' using errcode = '42501'; end if;
  select * into s from public.tenant_subscriptions where company_id = p_company;
  if not found then raise exception 'Tenant belum punya langganan.'; end if;
  select * into p from public.saas_plans where code = s.plan_code;
  u := public.fn_pemakaian(p_company);
  v_harga := coalesce(s.price_override, p.price_monthly);
  v_lines := v_lines || jsonb_build_array(jsonb_build_object('uraian', 'Langganan paket ' || p.name || ' ' || to_char(v_awal, 'MM/YYYY'), 'qty', 1, 'harga', v_harga, 'jumlah', v_harga));
  v_total := v_harga;
  v_teknisi := greatest(0, (u->>'teknisi')::numeric - coalesce(p.max_technicians, 1e9));
  if v_teknisi > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('uraian', 'Overage teknisi aktif', 'qty', v_teknisi, 'harga', p.overage_technician, 'jumlah', v_teknisi * p.overage_technician));
    v_total := v_total + v_teknisi * p.overage_technician;
  end if;
  select greatest(0, count(*) - coalesce(p.max_wo_month, 1e9)) into v_wo from public.work_orders
   where company_id = p_company and created_at >= v_awal and created_at < v_akhir + 1;
  if v_wo > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('uraian', 'Overage work order', 'qty', v_wo, 'harga', p.overage_wo, 'jumlah', v_wo * p.overage_wo));
    v_total := v_total + v_wo * p.overage_wo;
  end if;
  insert into public.saas_invoices (company_id, invoice_no, period_start, period_end, plan_code, lines, subtotal, due_date, catatan)
  values (p_company, 'NKS-' || to_char(v_awal, 'YYYYMM') || '-' || upper(substr(p_company::text, 1, 6)), v_awal, v_akhir, p.code,
          v_lines, v_total, v_akhir + 14, 'Harga belum termasuk PPN. Draft otomatis — periksa sebelum diterbitkan.')
  on conflict (company_id, period_start) do update set lines = excluded.lines, subtotal = excluded.subtotal, updated_at = now()
    where public.saas_invoices.status = 'draft'
  returning * into v_inv;
  return v_inv;
end $function$;

CREATE OR REPLACE FUNCTION public.fn_cek_kuota(p_company uuid, p_metrik text, p_tambah integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  p public.saas_plans; s public.tenant_subscriptions; u jsonb; v_pakai numeric; v_batas numeric; v_keras boolean;
  v_label text;
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin()
     and (public.auth_company_id() is null or coalesce(p_company,public.auth_company_id()) is distinct from public.auth_company_id()) then
    raise exception 'Tidak berwenang mengakses workspace ini.' using errcode='42501';
  end if;

  select * into s from public.tenant_subscriptions where company_id = p_company;
  if not found then return jsonb_build_object('ok', true, 'keras', false, 'pesan', 'Tanpa paket (legacy)'); end if;
  select * into p from public.saas_plans where code = s.plan_code;
  u := public.fn_pemakaian(p_company);
  if p_metrik = 'users' then
    v_pakai := (u->>'users')::numeric; v_batas := p.max_users; v_keras := true; v_label := 'pengguna panel';
  elsif p_metrik = 'teknisi' then
    v_pakai := (u->>'teknisi')::numeric; v_batas := p.max_technicians; v_keras := false; v_label := 'teknisi aktif';
  elsif p_metrik = 'wo' then
    v_pakai := (u->>'wo_bulan_ini')::numeric; v_batas := p.max_wo_month; v_keras := false; v_label := 'WO bulan ini';
  else
    v_pakai := (u->>'storage_mb')::numeric / 1024; v_batas := p.max_storage_gb; v_keras := false; v_label := 'GB penyimpanan';
  end if;
  if v_batas is null or v_pakai + p_tambah <= v_batas then
    return jsonb_build_object('ok', true, 'keras', v_keras, 'pakai', v_pakai, 'batas', v_batas);
  end if;
  return jsonb_build_object('ok', false, 'keras', v_keras, 'pakai', v_pakai, 'batas', v_batas,
    'pesan', format('Batas %s paket %s adalah %s (terpakai %s). %s', v_label, p.name, v_batas, v_pakai,
      case when v_keras then 'Naikkan paket atau nonaktifkan akun yang tidak dipakai.'
           else 'Kelebihan tetap diizinkan dan akan ditagih sebagai overage.' end));
end $function$;

CREATE OR REPLACE FUNCTION public.fn_hapus_data_contoh(p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r record; n int := 0; gagal int := 0;
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin()
     and (public.auth_company_id() is null or coalesce(p_company,public.auth_company_id()) is distinct from public.auth_company_id()) then
    raise exception 'Tidak berwenang mengakses workspace ini.' using errcode='42501';
  end if;

  if auth.uid() is not null and current_setting('nusakarya.sistem', true) is distinct from 'on'
     and not public.is_platform_admin() and not coalesce(p_company = public.auth_company_id() and public.is_super(), false) then
    raise exception 'Hanya Super Admin perusahaan ini.' using errcode = '42501';
  end if;
  for r in select * from public.demo_records where company_id = p_company order by urutan loop
    begin
      execute format('delete from public.%I where id = $1 and company_id = $2', r.tabel) using r.row_id, p_company;
      n := n + 1;
    exception when foreign_key_violation then gagal := gagal + 1; continue;
    end;
    delete from public.demo_records where company_id = p_company and tabel = r.tabel and row_id = r.row_id;
  end loop;
  if gagal = 0 then update public.companies set is_demo = false where id = p_company; end if;
  insert into public.audit_logs (company_id, user_id, action, entity_type, after)
  values (p_company, auth.uid(), 'hapus_data_contoh', 'companies', jsonb_build_object('dihapus', n, 'tertahan', gagal));
  return jsonb_build_object('dihapus', n, 'tertahan_relasi', gagal);
end $function$;

CREATE OR REPLACE FUNCTION public.fn_inbox_konflik_wfp(p_company_id uuid DEFAULT auth_company_id())
 RETURNS TABLE(jenis_konflik text, jumlah bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_co uuid; n bigint;
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin()
     and (public.auth_company_id() is null or coalesce(p_company_id,public.auth_company_id()) is distinct from public.auth_company_id()) then
    raise exception 'Tidak berwenang mengakses workspace ini.' using errcode='42501';
  end if;

  v_co := fn_jaga_impor_hr(p_company_id);

  insert into inbox_tugas (company_id, modul, jenis, entity_type, judul, keterangan, route_path,
       pic_role, eskalasi_role, jatuh_tempo, prioritas, status, sumber, kunci_unik)
  select v_co, 'HR', 'tugas_manual', 'employees',
         'NIK ganda dengan nama berbeda: '||t.nik,
         'NIK '||t.nik||' dipakai oleh nama yang berbeda: '||t.nama_list||
         '. Sistem tidak menebak mana yang benar. Tentukan NIK yang sah, perbaiki di sumber WFP, lalu muat ulang.',
         '/hr/karyawan', 'staff_hr', 'manager_hr', current_date + 7, 'tinggi', 'terbuka', 'manual',
         'konflik_nik_'||t.nik
  from (select nik, string_agg(distinct nama, ' | ') nama_list
        from stg_wfp where company_id = v_co and nik is not null and nama is not null
        group by nik having count(distinct nama) > 1) t
  on conflict (company_id, kunci_unik) do nothing;
  get diagnostics n = row_count; jenis_konflik := 'NIK ganda beda nama'; jumlah := n; return next;

  insert into inbox_tugas (company_id, modul, jenis, entity_type, judul, keterangan, route_path,
       pic_role, eskalasi_role, jatuh_tempo, prioritas, status, sumber, kunci_unik)
  select v_co, 'OPERATIONS', 'tugas_manual', 'sto_ref',
         'Kode STO '||t.kode||' menunjuk '||t.n||' nama berbeda',
         'Kode '||t.kode||' dipakai untuk: '||t.nama_list||
         '. Referensi STO tidak dimuat untuk kode ini sampai dipastikan. Tentukan pasangan kode-nama yang benar.',
         '/ops/elemen', 'spv_operations', 'manager_operations', current_date + 14, 'sedang', 'terbuka', 'manual',
         'konflik_sto_'||t.kode
  from (select sto_kode kode, count(distinct sto) n, string_agg(distinct sto, ' | ') nama_list
        from stg_wfp where company_id = v_co and sto is not null and sto_kode is not null
        group by sto_kode having count(distinct sto) > 1) t
  on conflict (company_id, kunci_unik) do nothing;
  get diagnostics n = row_count; jenis_konflik := 'kode STO bertabrakan'; jumlah := n; return next;

  insert into inbox_tugas (company_id, modul, jenis, entity_type, judul, keterangan, route_path,
       pic_role, eskalasi_role, branch_id, jatuh_tempo, prioritas, status, sumber, kunci_unik)
  select v_co, 'HR', 'tugas_manual', 'employee_positions',
         'Formasi kosong '||t.branch||': '||t.n||' kursi',
         'Ada '||t.n||' formasi tanpa karyawan di '||t.branch||
         '. Perlu diisi lewat rekrutmen atau mutasi, atau dinonaktifkan bila formasinya memang dihapus.',
         '/hr/karyawan', 'staff_hr', 'manager_hr',
         (select b.id from branches b where b.company_id=v_co and b.name ilike '%'||replace(t.branch,'BRANCH ','')||'%' limit 1),
         current_date + 30, 'sedang', 'terbuka', 'manual',
         'formasi_kosong_'||t.branch
  from (select branch, count(*) n from stg_wfp
        where company_id = v_co and nik is null and nama is null group by branch) t
  on conflict (company_id, kunci_unik) do nothing;
  get diagnostics n = row_count; jenis_konflik := 'formasi kosong per cabang'; jumlah := n; return next;

  insert into inbox_tugas (company_id, modul, jenis, entity_type, judul, keterangan, route_path,
       pic_role, eskalasi_role, jatuh_tempo, prioritas, status, sumber, kunci_unik)
  select v_co, 'HR', 'tugas_manual', 'employees',
         'Nilai GROUP tidak sah pada '||coalesce(s.nama,'formasi '||s.object_id),
         'Baris WFP ke-'||s.baris||' memiliki GROUP = '||s.group_wfp||
         ', padahal nilai yang sah hanya RKAP, MITRA, RIFO, NFO. Nilai itu tampak berasal dari kolom KEMITRAAN. Kolom dikosongkan sampai dibetulkan.',
         '/hr/karyawan', 'staff_hr', 'manager_hr', current_date + 7, 'sedang', 'terbuka', 'manual',
         'group_wfp_salah_'||s.baris
  from stg_wfp s where s.company_id = v_co and s.group_wfp = 'TELKOM AKSES'
  on conflict (company_id, kunci_unik) do nothing;
  get diagnostics n = row_count; jenis_konflik := 'GROUP tidak sah'; jumlah := n; return next;

  insert into inbox_tugas (company_id, modul, jenis, entity_type, judul, keterangan, route_path,
       pic_role, eskalasi_role, jatuh_tempo, prioritas, status, sumber, kunci_unik)
  select v_co, 'HR', 'tugas_manual', 'employee_positions',
    'Ejaan SUB GROUP kembar di data WFP',
    'Ditemukan pasangan ejaan yang merujuk hal sama: OPERATION vs Operation, dan PROVISIONING & MIGRASI vs PROVISIONING & MIGRATION. Samakan di sumber WFP agar laporan per sub group tidak terpecah.',
    '/hr/karyawan', 'staff_hr', 'manager_hr', current_date + 14, 'rendah', 'terbuka', 'manual',
    'ejaan_sub_group_kembar'
  where exists (
    select 1 from stg_wfp where company_id = v_co
      and sub_group in ('OPERATION','Operation','PROVISIONING & MIGRASI','PROVISIONING & MIGRATION'))
  on conflict (company_id, kunci_unik) do nothing;
  get diagnostics n = row_count; jenis_konflik := 'ejaan sub group kembar'; jumlah := n; return next;
end $function$;

CREATE OR REPLACE FUNCTION public.fn_isi_data_contoh(p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_br1 uuid := gen_random_uuid(); v_br2 uuid := gen_random_uuid();
  v_cus uuid := gen_random_uuid(); v_ctr uuid := gen_random_uuid();
  v_wh uuid := gen_random_uuid(); v_it1 uuid := gen_random_uuid(); v_it2 uuid := gen_random_uuid();
  v_emp uuid[] := array[]::uuid[]; v_id uuid; v_jt uuid[]; i int; v_st text[] := array['draft','dispatched','accepted','on_progress','done','done','done','failed','pending_material','done'];
  v_nama text[] := array['Andi Saputra','Budi Hartono','Citra Lestari','Dedi Kurnia','Eko Prasetyo','Fajar Ramadhan'];
  n int := 0;
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin()
     and (public.auth_company_id() is null or coalesce(p_company,public.auth_company_id()) is distinct from public.auth_company_id()) then
    raise exception 'Tidak berwenang mengakses workspace ini.' using errcode='42501';
  end if;

  if auth.uid() is not null and current_setting('nusakarya.sistem', true) is distinct from 'on'
     and not public.is_platform_admin() and not coalesce(p_company = public.auth_company_id() and public.is_super(), false) then
    raise exception 'Hanya Super Admin perusahaan ini.' using errcode = '42501';
  end if;
  insert into public.branches (id, company_id, code, name, city) values
    (v_br1, p_company, 'DMO-A', 'Cabang Contoh A', 'Padang'), (v_br2, p_company, 'DMO-B', 'Cabang Contoh B', 'Pekanbaru');
  insert into public.demo_records values (p_company,'branches',v_br1,90),(p_company,'branches',v_br2,90);
  insert into public.customers (id, company_id, code, name, customer_type, city, payment_term_days, status)
    values (v_cus, p_company, 'DMO-PRINCIPAL', 'Principal Contoh (fiktif)', 'principal', 'Padang', 45, 'aktif');
  insert into public.demo_records values (p_company,'customers',v_cus,80);
  insert into public.contracts (id, company_id, contract_no, contract_name, customer_id, contract_type, start_date, end_date, contract_value, status)
    values (v_ctr, p_company, 'DMO-KTR-001', 'Kontrak Contoh PSB & Assurance', v_cus, 'unit_price', current_date - 60, current_date + 300, 1500000000, 'aktif');
  insert into public.demo_records values (p_company,'contracts',v_ctr,70);
  insert into public.warehouses (id, company_id, code, name, warehouse_type, branch_id) values (v_wh, p_company, 'DMO-GD', 'Gudang Contoh', 'branch', v_br1);
  insert into public.demo_records values (p_company,'warehouses',v_wh,60);
  insert into public.item_catalog (id, company_id, code, name, category, uom, last_price, is_serial_tracked) values
    (v_it1, p_company, 'DMO-ONT', 'ONT Contoh', 'NTE', 'unit', 500000, true),
    (v_it2, p_company, 'DMO-DC', 'Kabel Drop Core Contoh', 'NON_NTE', 'roll', 150000, false);
  insert into public.demo_records values (p_company,'item_catalog',v_it1,50),(p_company,'item_catalog',v_it2,50);
  insert into public.stock_balances (id, company_id, warehouse_id, item_id, qty, avg_price) values
    (gen_random_uuid(), p_company, v_wh, v_it1, 40, 500000), (gen_random_uuid(), p_company, v_wh, v_it2, 120, 150000);
  insert into public.demo_records select p_company, 'stock_balances', id, 40 from public.stock_balances where company_id = p_company and warehouse_id = v_wh;
  for i in 1..6 loop
    v_id := gen_random_uuid();
    insert into public.employees (id, company_id, nip, full_name, branch_id, position, unit, employment_type, status, join_date, payroll_scheme)
      values (v_id, p_company, 'DMO-' || lpad(i::text, 3, '0'), v_nama[i] || ' (contoh)', case when i % 2 = 0 then v_br2 else v_br1 end,
              'Teknisi Fiber Optic', 'OPERATIONS', 'PKWT', 'aktif', current_date - 200, 'fix_salary');
    insert into public.demo_records values (p_company, 'employees', v_id, 30);
    v_emp := v_emp || v_id;
  end loop;
  select array_agg(id) into v_jt from public.job_types where company_id = p_company;
  for i in 1..30 loop
    v_id := gen_random_uuid();
    insert into public.work_orders (id, company_id, wo_no, wo_type, job_type_id, title, customer_name, address, branch_id,
      scheduled_at, assigned_to, status, qc_status, created_at, started_at, finished_at)
    values (v_id, p_company, 'DMO-WO-' || lpad(i::text, 4, '0'), (array['PSB','GANGGUAN','MAINTENANCE'])[1 + i % 3],
      case when v_jt is not null then v_jt[1 + i % array_length(v_jt, 1)] end,
      'Pekerjaan contoh #' || i, 'Pelanggan Contoh ' || i, 'Alamat contoh ' || i,
      case when i % 2 = 0 then v_br2 else v_br1 end, now() - (i || ' days')::interval, v_emp[1 + i % 6],
      v_st[1 + i % 10], case when v_st[1 + i % 10] = 'done' then (array['lulus','lulus','belum','tidak_lulus'])[1 + i % 4] else 'belum' end,
      now() - (i || ' days')::interval,
      case when v_st[1 + i % 10] in ('on_progress','done','failed') then now() - (i || ' days')::interval + interval '1 hour' end,
      case when v_st[1 + i % 10] in ('done','failed') then now() - (i || ' days')::interval + interval '3 hours' end);
    insert into public.demo_records values (p_company, 'work_orders', v_id, 10);
    n := n + 1;
  end loop;
  insert into public.ar_invoices (id, company_id, inv_no, invoice_date, due_date, customer_id, contract_id, dpp, ppn, total, paid_amount, status)
    values (gen_random_uuid(), p_company, 'DMO-INV-001', current_date - 40, current_date + 5, v_cus, v_ctr, 100000000, 11000000, 111000000, 0, 'terkirim'),
           (gen_random_uuid(), p_company, 'DMO-INV-002', current_date - 75, current_date - 30, v_cus, v_ctr, 80000000, 8800000, 88800000, 40000000, 'dibayar_sebagian');
  insert into public.demo_records select p_company, 'ar_invoices', id, 20 from public.ar_invoices where company_id = p_company and inv_no like 'DMO-INV-%';
  update public.companies set is_demo = true where id = p_company;
  return jsonb_build_object('cabang', 2, 'karyawan', 6, 'work_order', n, 'invoice', 2);
end $function$;

CREATE OR REPLACE FUNCTION public.fn_jaga_impor_hr(p_company_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin()
     and (public.auth_company_id() is null or coalesce(p_company_id,public.auth_company_id()) is distinct from public.auth_company_id()) then
    raise exception 'Tidak berwenang mengakses workspace ini.' using errcode='42501';
  end if;

  if not can_write_master('HR') then
    raise exception 'Akses ditolak: impor data karyawan memerlukan hak tulis master modul HR.'
      using errcode = '42501';
  end if;

  if p_company_id is null then
    raise exception 'Perusahaan tidak diketahui: profil pemanggil tidak punya company_id dan p_company_id tidak diisi.'
      using errcode = '22023';
  end if;

  if not is_super() and p_company_id is distinct from auth_company_id() then
    raise exception 'Akses ditolak: tidak boleh mengimpor untuk perusahaan lain.'
      using errcode = '42501';
  end if;

  return p_company_id;
end $function$;

CREATE OR REPLACE FUNCTION public.fn_muat_karyawan_wfp(p_company_id uuid DEFAULT auth_company_id())
 RETURNS TABLE(langkah text, jumlah bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_co uuid; n bigint;
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin()
     and (public.auth_company_id() is null or coalesce(p_company_id,public.auth_company_id()) is distinct from public.auth_company_id()) then
    raise exception 'Tidak berwenang mengakses workspace ini.' using errcode='42501';
  end if;

  v_co := fn_jaga_impor_hr(p_company_id);

  insert into branches (company_id, code, name, city, is_active)
  select v_co, k.kode, 'Cabang '||initcap(k.kota), initcap(k.kota), true
  from (values ('BTM','batam'),('BKT','bukittinggi'),('DUM','dumai'),('PDG','padang'),('PBR','pekanbaru')) k(kode,kota)
  where not exists (select 1 from branches b where b.company_id=v_co and b.name ilike '%'||k.kota||'%');

  insert into employees (company_id, nip, nik_telkom, full_name, branch_id, position, unit,
                         employment_type, status, join_date, level_jabatan, kemitraan,
                         group_wfp, status_teknisi, status_salary, skill, payroll_scheme)
  select v_co, s.nik, s.nik, max(s.nama),
         (select b.id from branches b where b.company_id=v_co
            and b.name ilike '%'||replace(max(s.branch),'BRANCH ','')||'%' limit 1),
         max(s.position_title),
         case
           when max(s.sub_group) in ('FINANCE & BILCO') then 'FINANCE'
           when max(s.sub_group) in ('PROCUREMENT & PARTNERSHIP') then 'PROCUREMENT'
           when max(s.sub_group) in ('INVENTORY & ASSET MANAGEMENT AREA','WAREHOUSE SO','WAREHOUSE REFURBISH') then 'INVENTORY'
           when max(s.group_fungsi) in ('HCM & HSE') then 'HR'
           when max(s.group_fungsi) in ('B2B','B2C') then 'COMMERCE'
           when max(s.group_fungsi) in ('COMMERCIAL & SUPPLY CHAIN') then 'PROCUREMENT'
           when max(s.group_fungsi) in ('CONSTRUCTION','SDI') then 'DEPLOYMENT'
           when max(s.level_jabatan) in ('GM/VP/PM/PMO') then 'EXECUTIVE'
           when max(s.group_fungsi) in ('BUSINESS SUPPORT','SHARED SERVICE') then 'FINANCE'
           else 'OPERATIONS'
         end,
         case max(s.kemitraan) when 'TELKOM AKSES' then 'PKWTT' when 'MITRA' then 'MITRA' else 'OUTSOURCE' end,
         'aktif', current_date, max(s.level_jabatan),
         case when max(s.kemitraan) in ('TELKOM AKSES','MITRA','RIFO FIX','RIFO VARIABLE') then max(s.kemitraan) else null end,
         case when max(s.group_wfp) in ('RKAP','MITRA','RIFO','NFO') then max(s.group_wfp) else null end,
         case when max(s.status_teknisi) in ('PERFORMANCE BASED','RESOURCE BASED') then max(s.status_teknisi) else null end,
         case when max(s.status_salary) in ('FIXED','VARIABLE') then max(s.status_salary) else null end,
         case when max(s.skill) is null then null else string_to_array(max(s.skill), ' | ') end,
         coalesce(case max(s.status_salary) when 'FIXED' then 'fix_salary' when 'VARIABLE' then 'freelance' else null end, 'fix_salary')
  from stg_wfp s
  where s.company_id = v_co and s.nik is not null and s.nama is not null
  group by s.nik
  on conflict (company_id, nip) do update set
    nik_telkom = excluded.nik_telkom, full_name = excluded.full_name,
    branch_id = excluded.branch_id, position = excluded.position, unit = excluded.unit,
    employment_type = excluded.employment_type, level_jabatan = excluded.level_jabatan,
    kemitraan = excluded.kemitraan, group_wfp = excluded.group_wfp,
    status_teknisi = excluded.status_teknisi, status_salary = excluded.status_salary,
    skill = excluded.skill, payroll_scheme = excluded.payroll_scheme, updated_at = now();
  get diagnostics n = row_count; langkah := 'karyawan (insert/update)'; jumlah := n; return next;

  insert into employee_positions (company_id, sumber_baris, employee_id, object_id, position_name, position_title,
      branch_id, psa, portofolio, group_fungsi, sub_group, nama_program, gaji_per_teknisi,
      sto, sto_kode, sektor_ditangani, status_penugasan, aktif, berlaku_mulai)
  select v_co, s.baris, e.id,
         case when s.object_id ~ '^[0-9]{17}$' or s.object_id ~ '^MTR-[0-9]{4}$' then s.object_id else null end,
         s.position_name, s.position_title,
         (select b.id from branches b where b.company_id=v_co
            and b.name ilike '%'||replace(s.branch,'BRANCH ','')||'%' limit 1),
         s.psa, s.portofolio, s.group_fungsi, s.sub_group, s.nama_program, s.gaji,
         s.sto, s.sto_kode,
         case when s.sektor_ditangani is null then null else string_to_array(s.sektor_ditangani, ' | ') end,
         case when s.status_penugasan in ('DEFINITIF','PGS','POH') then s.status_penugasan else null end,
         true, current_date
  from stg_wfp s
  left join employees e on e.company_id = v_co and e.nik_telkom = s.nik
  where s.company_id = v_co
  on conflict (company_id, sumber_baris) where sumber_baris is not null do update set
    employee_id = excluded.employee_id, object_id = excluded.object_id,
    position_name = excluded.position_name, position_title = excluded.position_title,
    branch_id = excluded.branch_id, psa = excluded.psa, portofolio = excluded.portofolio,
    group_fungsi = excluded.group_fungsi, sub_group = excluded.sub_group,
    nama_program = excluded.nama_program, gaji_per_teknisi = excluded.gaji_per_teknisi,
    sto = excluded.sto, sto_kode = excluded.sto_kode,
    sektor_ditangani = excluded.sektor_ditangani, status_penugasan = excluded.status_penugasan,
    updated_at = now();
  get diagnostics n = row_count; langkah := 'formasi (insert/update)'; jumlah := n; return next;

  insert into sto_ref (company_id, kode, nama, psa)
  select v_co, t.sto_kode, min(t.sto), min(t.psa)
  from (select distinct sto, sto_kode, psa from stg_wfp
        where company_id = v_co and sto is not null and sto_kode is not null) t
  group by t.sto_kode having count(distinct t.sto) = 1
  on conflict do nothing;
  get diagnostics n = row_count; langkah := 'sto_ref konsisten'; jumlah := n; return next;

  langkah := 'total formasi'; select count(*) into jumlah from employee_positions where company_id=v_co; return next;
  langkah := 'formasi kosong'; select count(*) into jumlah from employee_positions where company_id=v_co and employee_id is null; return next;
  langkah := 'karyawan total'; select count(*) into jumlah from employees where company_id=v_co and nik_telkom is not null; return next;
  langkah := 'orang dengan >1 posisi';
    select count(*) into jumlah from (select employee_id from employee_positions
      where company_id=v_co and employee_id is not null group by employee_id having count(*)>1) z; return next;
end $function$;

CREATE OR REPLACE FUNCTION public.fn_pemakaian(p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'storage', 'pg_temp'
AS $function$
declare v jsonb;
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin()
     and (public.auth_company_id() is null or coalesce(p_company,public.auth_company_id()) is distinct from public.auth_company_id()) then
    raise exception 'Tidak berwenang mengakses workspace ini.' using errcode='42501';
  end if;

  if auth.uid() is not null and current_setting('nusakarya.sistem', true) is distinct from 'on'
     and p_company is distinct from public.auth_company_id() and not public.is_platform_admin() then
    raise exception 'Tidak berwenang melihat pemakaian perusahaan lain.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'users', (select count(*) from public.profiles where company_id = p_company and is_active and role not in ('teknisi','mitra')),
    'teknisi', (select count(*) from public.profiles where company_id = p_company and is_active and role in ('teknisi','mitra')),
    'wo_bulan_ini', (select count(*) from public.work_orders where company_id = p_company and created_at >= date_trunc('month', now())),
    'storage_mb', round(coalesce((select sum((o.metadata->>'size')::bigint) from storage.objects o
                   where o.bucket_id = 'files' and o.name like p_company::text || '/%'), 0) / 1048576.0, 1)
  ) into v;
  return v;
end $function$;

CREATE OR REPLACE FUNCTION public.fn_terapkan_template(p_company uuid, p_template text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cfg jsonb; t text; hasil jsonb := '{}';
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin()
     and (public.auth_company_id() is null or coalesce(p_company,public.auth_company_id()) is distinct from public.auth_company_id()) then
    raise exception 'Tidak berwenang mengakses workspace ini.' using errcode='42501';
  end if;

  if auth.uid() is not null and current_setting('nusakarya.sistem', true) is distinct from 'on'
     and not public.is_platform_admin()
     and not coalesce(p_company = public.auth_company_id() and public.is_super(), false) then
    raise exception 'Hanya Super Admin perusahaan ini yang boleh menerapkan template.' using errcode = '42501';
  end if;
  select config into cfg from public.business_templates where code = p_template and is_active;
  if cfg is null then raise exception 'Template % tidak ditemukan.', p_template; end if;
  foreach t in array array['role_module_access','job_types','master_references','root_causes','shifts',
                           'competencies','salary_components','chart_of_accounts','custom_field_defs',
                           'tenant_status_labels','tenant_sla_rules'] loop
    if cfg ? t and to_regclass('public.' || t) is not null then
      hasil := hasil || jsonb_build_object(t, public.fn__sisip_json(p_company, t, cfg->t));
    end if;
  end loop;
  update public.tenant_onboarding set template_code = p_template,
    langkah_selesai = (select array_agg(distinct x) from unnest(langkah_selesai || array['template']) x), updated_at = now()
   where company_id = p_company;
  insert into public.audit_logs (company_id, user_id, action, entity_type, after)
  values (p_company, auth.uid(), 'terapkan_template', 'business_templates', jsonb_build_object('template', p_template, 'hasil', hasil));
  return hasil;
end $function$;

CREATE OR REPLACE FUNCTION public.next_doc_no(p_company uuid, p_prefix text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_year int := extract(year from now())::int;
  v_last int;
  v_no text;
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin()
     and (public.auth_company_id() is null or coalesce(p_company,public.auth_company_id()) is distinct from public.auth_company_id()) then
    raise exception 'Tidak berwenang mengakses workspace ini.' using errcode='42501';
  end if;

  if not is_super() and p_company is distinct from auth_company_id() then
    raise exception 'not authorized for this company';
  end if;

  insert into doc_sequences (company_id, prefix, year, last_no)
  values (p_company, p_prefix, v_year, 1)
  on conflict (company_id, prefix, year)
  do update set last_no = doc_sequences.last_no + 1
  returning last_no into v_last;

  v_no := p_prefix || '/' || v_year::text || '/' || lpad(v_last::text, 5, '0');
  return v_no;
end;
$function$;

create or replace function public.fn_status_langganan(p_company uuid) returns text language sql stable security definer
set search_path=public,pg_temp as $$
 select case when auth.role()='service_role' or public.is_platform_admin() or p_company=public.auth_company_id()
 then coalesce((select case when s.status='trial' and s.trial_ends_at<now() then 'trial_berakhir' else s.status end
 from public.tenant_subscriptions s where s.company_id=p_company),'legacy') else null end;
$$;
create or replace function public.fn_fitur_aktif(p_feature text,p_company uuid default null) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select case when auth.role()='service_role' or public.is_platform_admin()
 or coalesce(p_company,public.auth_company_id())=public.auth_company_id()
 then coalesce((select s.status<>'cancelled' and coalesce(
 (select o.enabled from public.tenant_feature_overrides o where o.company_id=s.company_id and o.feature_code='fitur:'||p_feature),
 p.features @> array[p_feature]) from public.tenant_subscriptions s join public.saas_plans p on p.code=s.plan_code
 where s.company_id=coalesce(p_company,public.auth_company_id())),true) else false end;
$$;
do $triggers$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef and p.prorettype='trigger'::regtype loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $triggers$;
notify pgrst,'reload schema';
