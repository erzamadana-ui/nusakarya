-- NUSAKARYA — kueri introspeksi skema untuk Pusat Impor Data.
-- SELECT-only. Jalankan lewat MCP Supabase (execute_sql) lalu salin hasilnya ke
-- tools/impor/introspeksi.json. Sesudah itu: node tools/impor/buat-skema-dataset.mjs
--
-- Bagian 1 — kolom  -> "tabel|kolom|udt|nullable(1/0)|punya_default(1/0)"
with t as (select unnest(array[
  'branches','employees','employee_positions','stg_wfp','customers','vendors','item_catalog',
  'warehouses','job_types','contract_price_list','freelance_rate_cards','network_elements','assets',
  'salary_components','chart_of_accounts','job_applicants','shifts','competencies','root_causes',
  'master_references','sto_ref']) as tn)
select c.table_name||'|'||c.column_name||'|'||c.udt_name||'|'
       ||(case when c.is_nullable='YES' then '1' else '0' end)||'|'
       ||(case when c.column_default is null then '0' else '1' end) as baris
from information_schema.columns c join t on t.tn = c.table_name
where c.table_schema='public' order by c.table_name, c.ordinal_position;

-- Bagian 2 — CHECK  -> "tabel|nama_constraint|definisi"
select c.relname||'|'||con.conname||'|'||pg_get_constraintdef(con.oid)
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and con.contype='c' order by 1;

-- Bagian 3 — FOREIGN KEY -> "tabel|kolom|tabel_tujuan|kolom_tujuan"
select c.relname||'|'||a.attname||'|'||fc.relname||'|'||fa.attname
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_class fc on fc.oid = con.confrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid  and a.attnum = con.conkey[1]
join pg_attribute fa on fa.attrelid = fc.oid and fa.attnum = con.confkey[1]
where n.nspname='public' and con.contype='f' and array_length(con.conkey,1)=1 order by 1;

-- Bagian 4 — INDEKS UNIK (kunci alami untuk upsert) -> "tabel|kolom1,kolom2"
select c.relname||'|'||(
  select string_agg(a.attname, ',' order by k.ord)
  from unnest(ix.indkey::int[]) with ordinality k(att, ord)
  join pg_attribute a on a.attrelid = c.oid and a.attnum = k.att)
from pg_index ix
join pg_class c on c.oid = ix.indrelid
join pg_class i on i.oid = ix.indexrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and ix.indisunique and ix.indpred is null
  and i.relname not like '%_pkey' order by 1;
