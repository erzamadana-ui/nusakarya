-- Public release containment: preserve records and owner access while closing anonymous RPCs.
alter table public.companies add column if not exists privacy_quarantined boolean not null default false;
update public.companies c set privacy_quarantined = true
where c.is_demo and exists (select 1 from public.employees e where e.company_id=c.id
  and (nullif(e.nik_telkom,'') is not null or nullif(e.nik_ktp,'') is not null));

create or replace function public.auth_company_id() returns uuid language sql stable security definer
set search_path = public, pg_temp as $$
 select p.company_id from public.profiles p join public.companies c on c.id=p.company_id
 where p.id=auth.uid() and p.is_active and (not c.privacy_quarantined or
 exists(select 1 from public.platform_admins a where a.user_id=auth.uid()));
$$;
create or replace function public.auth_role() returns text language sql stable security definer
set search_path = public, pg_temp as $$
 select p.role from public.profiles p where p.id=auth.uid() and p.is_active and p.company_id=public.auth_company_id();
$$;
create or replace function public.fn_guard_privacy_quarantine() returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
begin
 if new.privacy_quarantined is distinct from old.privacy_quarantined
 and auth.uid() is not null and not public.is_platform_admin() then
  raise exception 'Karantina privasi hanya dapat diubah pemilik platform.' using errcode='42501';
 end if;
 return new;
end; $$;
create trigger guard_privacy_quarantine before update on public.companies
for each row execute function public.fn_guard_privacy_quarantine();
-- SELECT policy for a user's own profile is preserved so affected users can sign in and see a containment message.
-- Anonymous invitation lookup is deliberately retained: random token is a capability, expired/revoked tokens return nothing.
create or replace function public.fn_info_undangan(p_token text) returns jsonb language sql stable security definer
set search_path=public,pg_temp as $$
 select jsonb_build_object('email',i.email,'full_name',i.full_name,'role',i.role,'perusahaan',c.name,'berlaku',true)
 from public.tenant_invites i join public.companies c on c.id=i.company_id
 where i.token=p_token and length(p_token)>=24 and i.accepted_at is null
 and i.revoked_at is null and i.expires_at>now() and not c.privacy_quarantined;
$$;
alter policy saas_plans_write on public.saas_plans to authenticated;
-- Restrict every privileged public function; triggers do not need public EXECUTE.
do $secure$ declare f record; begin
 for f in select p.oid::regprocedure as signature,p.proname,p.prorettype,
 has_function_privilege('authenticated',p.oid,'execute') as was_authenticated
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef loop
  execute format('revoke all on function %s from public, anon',f.signature);
  if f.was_authenticated and f.prorettype <> 'trigger'::regtype then
    execute format('grant execute on function %s to authenticated, service_role',f.signature);
  end if;
 end loop;
end $secure$;
grant execute on function public.fn_info_undangan(text) to anon;
alter default privileges for role postgres in schema public revoke execute on functions from public;

-- Sales inquiries: no public table access; only the existing public edge service can insert.
create table public.commercial_leads (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 company_name text not null check(char_length(company_name) between 3 and 120),
 contact_name text not null check(char_length(contact_name) between 2 and 100),
 email text not null check(char_length(email)<=254), phone text check(char_length(phone)<=30),
 plan text not null check(plan in ('starter','professional','enterprise','managed','belum_tahu')),
 technicians integer not null check(technicians between 1 and 100000),
 work_orders_month integer not null check(work_orders_month between 0 and 10000000),
 notes text check(char_length(notes)<=2000), consent boolean not null check(consent),
 privacy_version text not null default '2026-10-01',
 status text not null default 'baru' check(status in ('baru','dihubungi','demo','penawaran','menang','tidak_lanjut')),
 request_hash text not null
);
alter table public.commercial_leads enable row level security;
revoke all on public.commercial_leads from anon;
grant select,update,delete on public.commercial_leads to authenticated;
grant all on public.commercial_leads to service_role;
create policy commercial_leads_owner on public.commercial_leads for all to authenticated
using(public.is_platform_admin()) with check(public.is_platform_admin());
create index commercial_leads_recent on public.commercial_leads(created_at desc);
create index commercial_leads_rate on public.commercial_leads(request_hash,created_at);
create or replace function public.fn_submit_commercial_lead(p_data jsonb,p_hash text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; e text:=lower(trim(p_data->>'email')); begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only' using errcode='42501'; end if;
 if p_data->>'consent' is distinct from 'true' or e !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Masukan tidak valid' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_hash,0));
 perform pg_advisory_xact_lock(hashtextextended(e,1));
 if (select count(*) from public.commercial_leads where request_hash=p_hash and created_at>now()-interval '1 hour')>=5
 or (select count(*) from public.commercial_leads where email=e and created_at>now()-interval '1 day')>=3 then
 raise exception 'Terlalu banyak permintaan. Silakan coba lagi besok.' using errcode='P0429'; end if;
 insert into public.commercial_leads(company_name,contact_name,email,phone,plan,technicians,work_orders_month,notes,consent,request_hash)
 values(trim(p_data->>'company_name'),trim(p_data->>'contact_name'),e,nullif(trim(p_data->>'phone'),''),
 p_data->>'plan',(p_data->>'technicians')::integer,(p_data->>'work_orders_month')::integer,
 left(p_data->>'notes',2000),true,p_hash) returning id into result;
 return result;
end $$;
revoke all on function public.fn_submit_commercial_lead(jsonb,text) from public,anon,authenticated;
grant execute on function public.fn_submit_commercial_lead(jsonb,text) to service_role;
notify pgrst, 'reload schema';
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

CREATE OR REPLACE FUNCTION public.fn_hapus_data_contoh(p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r record; n int := 0; gagal int := 0;
begin
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

CREATE OR REPLACE FUNCTION public.fn_terapkan_template(p_company uuid, p_template text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cfg jsonb; t text; hasil jsonb := '{}';
begin
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
