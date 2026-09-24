-- 0054_catat_ekspor.sql — setiap ekspor/cadangan data dari UI tercatat di audit_logs.
create or replace function public.fn_catat_ekspor(p_format text, p_tabel text[], p_jumlah bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or public.auth_company_id() is null then return; end if;
  insert into public.audit_logs (company_id, user_id, action, entity_type, after)
  values (public.auth_company_id(), auth.uid(), 'ekspor_data', 'companies',
          jsonb_build_object('format', left(p_format, 10), 'tabel', p_tabel, 'jumlah_baris', p_jumlah));
end $$;
revoke execute on function public.fn_catat_ekspor(text, text[], bigint) from anon;
