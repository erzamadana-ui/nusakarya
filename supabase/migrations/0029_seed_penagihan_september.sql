-- 0029 : Penagihan September 2026
-- Data contoh sebelumnya berhenti di Agustus sehingga seluruh KPI "bulan berjalan"
-- pada dashboard tampil Rp 0 dan margin kosong. Migrasi ini menambahkan penagihan
-- September agar dashboard memperlihatkan kondisi berjalan yang wajar.
-- CATATAN: ini DATA CONTOH. Jangan diterapkan ke lingkungan produksi.

with co as (select id from companies order by created_at limit 1),
src as (
  select (row_number() over (order by c.id))::int rn, c.id claim_id, c.spk_id,
         c.claim_amount, c.retention_amount, s.contract_id, k.customer_id
  from progress_claims c
  join spk s on s.id = c.spk_id
  join contracts k on k.id = s.contract_id
  where c.status in ('disetujui','ditagihkan')
  limit 6
)
insert into ar_invoices (company_id, inv_no, invoice_date, due_date, customer_id, contract_id, spk_id, claim_id,
                         dpp, ppn, pph23, total, paid_amount, status, faktur_pajak_no)
select (select id from co),
       'INV/2026/09' || lpad(rn::text,3,'0'),
       date '2026-09-01' + ((rn-1)*3) * interval '1 day',
       date '2026-09-01' + ((rn-1)*3 + 30) * interval '1 day',
       customer_id, contract_id, spk_id, claim_id,
       round(coalesce(claim_amount,0) - coalesce(retention_amount,0)),
       round((coalesce(claim_amount,0) - coalesce(retention_amount,0)) * 0.11),
       round((coalesce(claim_amount,0) - coalesce(retention_amount,0)) * 0.02),
       round((coalesce(claim_amount,0) - coalesce(retention_amount,0)) * 1.09),
       case when rn <= 2 then round((coalesce(claim_amount,0) - coalesce(retention_amount,0)) * 1.09) else 0 end,
       case when rn <= 2 then 'lunas' when rn <= 5 then 'terkirim' else 'diajukan' end,
       '010.000-26.' || lpad((90000000 + rn)::text, 8, '0')
from src
on conflict do nothing;

insert into ar_payments (company_id, payment_no, payment_date, customer_id, invoice_id, amount, method, bank_ref, note)
select company_id, 'RCV/2026/09' || lpad((row_number() over (order by inv_no))::text,3,'0'),
       invoice_date + interval '12 day', customer_id, id, total, 'transfer',
       'TRF-SEP-' || right(inv_no,3), 'Pelunasan penagihan September'
from ar_invoices where inv_no like 'INV/2026/09%' and status = 'lunas'
on conflict do nothing;

insert into cash_flows (company_id, flow_date, direction, category, description, amount, ref_type, ref_id)
select company_id, invoice_date + interval '12 day', 'in', 'Penerimaan Piutang',
       'Pelunasan ' || inv_no, total, 'ar_invoice', id
from ar_invoices where inv_no like 'INV/2026/09%' and status = 'lunas'
on conflict do nothing;
