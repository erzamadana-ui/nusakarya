-- =====================================================================
-- 0053_batch_impor_dan_rollback.sql
-- Setiap impor dari Pusat Impor kini tercatat sebagai BATCH. Baris yang
-- disisipkan/diperbarui oleh batch itu dilacak (termasuk nilai SEBELUM
-- diperbarui), sehingga batch bisa DIBATALKAN (rollback) utuh:
--   * baris baru dihapus, baris yang diperbarui dikembalikan ke nilai lama.
-- Pelacakan memakai header HTTP `x-nk-import-batch` yang dikirim klien
-- impor; PostgREST meneruskannya ke current_setting('request.headers').
-- Header palsu tidak berbahaya: pelacak hanya menerima batch milik tenant
-- yang sama, berstatus 'berjalan', dan dibuat oleh pengguna yang sama.
-- =====================================================================

create table if not exists public.import_batches (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade default public.auth_company_id(),
  dataset       text not null,
  tabel         text not null,
  modul         text not null,
  nama_berkas   text,
  mode          text not null default 'lewati' check (mode in ('lewati','semua_atau_batal')),
  total_baris   int not null default 0,
  berhasil      int not null default 0,
  dilewati      int not null default 0,
  gagal         int not null default 0,
  status        text not null default 'berjalan' check (status in ('berjalan','selesai','gagal','dibatalkan')),
  ringkasan     jsonb,
  created_by    uuid references auth.users(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  selesai_at    timestamptz,
  rollback_at   timestamptz,
  rollback_by   uuid references auth.users(id),
  rollback_hasil jsonb
);
create index if not exists idx_import_batches_company on public.import_batches(company_id, created_at desc);
alter table public.import_batches enable row level security;
drop policy if exists ib_read on public.import_batches;
create policy ib_read on public.import_batches for select using (company_id = public.auth_company_id() and public.can_read(modul));
drop policy if exists ib_insert on public.import_batches;
create policy ib_insert on public.import_batches for insert
  with check (company_id = public.auth_company_id() and public.can_write_master(modul) and public.fn_fitur_aktif('impor_data') and created_by = auth.uid());
drop policy if exists ib_update on public.import_batches;
create policy ib_update on public.import_batches for update
  using (company_id = public.auth_company_id() and created_by = auth.uid() and status = 'berjalan')
  with check (company_id = public.auth_company_id() and created_by = auth.uid() and status in ('berjalan','selesai','gagal'));
grant select, insert, update on public.import_batches to authenticated;

create table if not exists public.import_batch_rows (
  batch_id   uuid not null references public.import_batches(id) on delete cascade,
  company_id uuid not null,
  tabel      text not null,
  row_id     uuid not null,
  aksi       text not null check (aksi in ('insert','update')),
  sebelum    jsonb,
  urutan     bigserial,
  primary key (batch_id, tabel, row_id)
);
alter table public.import_batch_rows enable row level security;
drop policy if exists ibr_read on public.import_batch_rows;
create policy ibr_read on public.import_batch_rows for select using (company_id = public.auth_company_id());
grant select on public.import_batch_rows to authenticated;

create or replace function public.fn_lacak_impor()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_batch uuid; v_hdr text;
begin
  v_hdr := current_setting('request.headers', true);
  if v_hdr is null or v_hdr = '' then return null; end if;
  begin
    v_batch := nullif(v_hdr::json->>'x-nk-import-batch', '')::uuid;
  exception when others then return null;
  end;
  if v_batch is null then return null; end if;
  if not exists (select 1 from public.import_batches b where b.id = v_batch and b.company_id = new.company_id
                  and b.status = 'berjalan' and b.created_by = auth.uid()) then
    return null;
  end if;
  insert into public.import_batch_rows (batch_id, company_id, tabel, row_id, aksi, sebelum)
  values (v_batch, new.company_id, tg_table_name, new.id,
          case when tg_op = 'INSERT' then 'insert' else 'update' end,
          case when tg_op = 'UPDATE' then to_jsonb(old) end)
  on conflict do nothing;   -- sentuhan pertama menyimpan nilai asli
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['branches','customers','vendors','item_catalog','warehouses','job_types',
      'contract_price_list','freelance_rate_cards','network_elements','assets','salary_components',
      'chart_of_accounts','job_applicants','shifts','competencies','root_causes','master_references',
      'sto_ref','employees','work_orders','contracts','ar_invoices','stock_balances','custom_records','tickets'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_lacak_impor on public.%I', t);
      execute format('create trigger trg_lacak_impor after insert or update on public.%I for each row execute function public.fn_lacak_impor()', t);
    end if;
  end loop;
end $$;

create or replace function public.fn_rollback_impor(p_batch uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b public.import_batches; r record; v_cols text; n_hapus int := 0; n_pulih int := 0; v_gagal jsonb := '[]';
begin
  select * into b from public.import_batches where id = p_batch for update;
  if not found or b.company_id is distinct from public.auth_company_id() then
    raise exception 'Batch impor tidak ditemukan.' using errcode = '42704';
  end if;
  if not (public.can_write_master(b.modul) or public.is_super()) then
    raise exception 'Anda tidak berwenang membatalkan impor ini.' using errcode = '42501';
  end if;
  if b.status = 'dibatalkan' then raise exception 'Batch ini sudah dibatalkan sebelumnya.'; end if;

  perform set_config('nusakarya.sistem', 'on', true);
  for r in select * from public.import_batch_rows where batch_id = p_batch order by urutan desc loop
    begin
      if r.aksi = 'insert' then
        execute format('delete from public.%I where id = $1 and company_id = $2', r.tabel) using r.row_id, b.company_id;
        n_hapus := n_hapus + 1;
      else
        select string_agg(format('%I', k), ', ') into v_cols
          from jsonb_object_keys(r.sebelum) k
         where k not in ('id', 'company_id')
           and exists (select 1 from information_schema.columns c
                        where c.table_schema = 'public' and c.table_name = r.tabel and c.column_name = k
                          and c.is_generated = 'NEVER');
        execute format('update public.%1$I t set (%2$s) = (select %2$s from jsonb_populate_record(null::public.%1$I, $1)) where t.id = $2 and t.company_id = $3',
                       r.tabel, v_cols) using r.sebelum, r.row_id, b.company_id;
        n_pulih := n_pulih + 1;
      end if;
    exception when others then
      v_gagal := v_gagal || jsonb_build_array(jsonb_build_object('tabel', r.tabel, 'id', r.row_id, 'alasan', sqlerrm));
    end;
  end loop;
  perform set_config('nusakarya.sistem', 'off', true);

  update public.import_batches set status = 'dibatalkan', rollback_at = now(), rollback_by = auth.uid(),
    rollback_hasil = jsonb_build_object('dihapus', n_hapus, 'dipulihkan', n_pulih, 'gagal', v_gagal)
   where id = p_batch;
  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, after)
  values (b.company_id, auth.uid(), 'rollback_impor', 'import_batches', p_batch,
          jsonb_build_object('dataset', b.dataset, 'dihapus', n_hapus, 'dipulihkan', n_pulih, 'gagal', jsonb_array_length(v_gagal)));
  return jsonb_build_object('dihapus', n_hapus, 'dipulihkan', n_pulih, 'gagal', v_gagal);
end $$;
revoke execute on function public.fn_rollback_impor(uuid) from anon;

-- Penutup batch: catat ringkasan + audit (impor_gagal dipakai skor kesehatan tenant).
create or replace function public.fn_tutup_batch_impor(p_batch uuid, p_berhasil int, p_dilewati int, p_gagal int, p_ringkasan jsonb default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare b public.import_batches;
begin
  select * into b from public.import_batches where id = p_batch;
  if not found or b.company_id is distinct from public.auth_company_id() or b.created_by is distinct from auth.uid() then
    raise exception 'Batch impor tidak ditemukan.' using errcode = '42704';
  end if;
  update public.import_batches set berhasil = p_berhasil, dilewati = p_dilewati, gagal = p_gagal,
    status = case when p_berhasil = 0 and p_gagal > 0 then 'gagal' else 'selesai' end,
    ringkasan = p_ringkasan, selesai_at = now()
   where id = p_batch and status = 'berjalan';
  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, after)
  values (b.company_id, auth.uid(), case when p_gagal > 0 then 'impor_gagal' else 'impor_selesai' end, 'import_batches', p_batch,
          jsonb_build_object('dataset', b.dataset, 'berkas', b.nama_berkas, 'berhasil', p_berhasil, 'dilewati', p_dilewati, 'gagal', p_gagal));
  update public.tenant_onboarding set langkah_selesai = (select array_agg(distinct x) from unnest(langkah_selesai || array['impor']) x)
   where company_id = b.company_id and p_berhasil > 0;
end $$;
revoke execute on function public.fn_tutup_batch_impor(uuid, int, int, int, jsonb) from anon;
