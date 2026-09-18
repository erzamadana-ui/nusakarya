-- =====================================================================
-- 0044_produktivitas_bukan_swa_verifikasi.sql
--
-- Entri produktivitas adalah DASAR PEMBAYARAN mitra/teknisi. Kebijakan modul
-- PRODUCTIVITY yang lama mengizinkan siapa pun dengan can_write — termasuk
-- teknisi — mengubah status entri miliknya sendiri menjadi 'diverifikasi'
-- (yang langsung menjadikannya layak bayar) dan mengubah nominalnya.
-- Menghapus kebijakan khusus 'teknisi' di 0043 belum cukup, karena kebijakan
-- modul umum tetap berlaku.
--
-- Sekarang: peran lapangan tidak boleh menulis entri produktivitas sama sekali
-- (entri dibuat trigger fn_wo_done_productivity yang SECURITY DEFINER), dan
-- verifikasi membutuhkan hak approve, bukan sekadar hak tulis.
-- Idempoten.
-- =====================================================================

drop policy if exists productivity_entries_insert on productivity_entries;
create policy productivity_entries_insert on productivity_entries for insert
  with check (company_id = auth_company_id() and can_write_master('PRODUCTIVITY'));

drop policy if exists productivity_entries_update on productivity_entries;
create policy productivity_entries_update on productivity_entries for update
  using (company_id = auth_company_id() and can_write_master('PRODUCTIVITY'))
  with check (company_id = auth_company_id() and can_write_master('PRODUCTIVITY')
              and (status <> 'diverifikasi' or can_approve('PRODUCTIVITY')));
