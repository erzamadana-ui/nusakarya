-- =====================================================================
-- 0011_security_hardening_public_grant.sql
-- Follow-up: functions are created with an implicit GRANT EXECUTE TO
-- PUBLIC. Revoking from the `anon` role alone does not remove that
-- PUBLIC grant (anon still inherits it via PUBLIC), which is why
-- get_advisors(security) still flagged these as anon-executable.
-- Revoke from PUBLIC explicitly, then re-grant only to `authenticated`
-- (required so RLS policies, which run as the querying user, can call
-- them) and to `service_role`.
-- =====================================================================

revoke execute on function auth_company_id() from public;
revoke execute on function auth_role() from public;
revoke execute on function auth_employee_id() from public;
revoke execute on function is_super() from public;
revoke execute on function can_read(text) from public;
revoke execute on function can_write(text) from public;
revoke execute on function can_approve(text) from public;
revoke execute on function next_doc_no(uuid, text) from public;
revoke execute on function fn_sla_recalc(uuid) from public;

grant execute on function auth_company_id() to authenticated, service_role;
grant execute on function auth_role() to authenticated, service_role;
grant execute on function auth_employee_id() to authenticated, service_role;
grant execute on function is_super() to authenticated, service_role;
grant execute on function can_read(text) to authenticated, service_role;
grant execute on function can_write(text) to authenticated, service_role;
grant execute on function can_approve(text) to authenticated, service_role;
grant execute on function next_doc_no(uuid, text) to authenticated, service_role;
grant execute on function fn_sla_recalc(uuid) to authenticated, service_role;
