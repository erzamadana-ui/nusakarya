-- 0032_bpjs_risk_class.sql
-- Membuat tarif JKK (dan iuran BPJS lain) bisa diubah dari aplikasi, dengan kelompok
-- risiko JKK yang tertelusur ke PP 44/2015 & PP 49/2023, status verifikasi eksplisit,
-- dan riwayat berlaku multi-baris pada bpjs_config.

-- =====================================================================
-- 1. Kolom baru pada bpjs_config: kelompok risiko JKK & status verifikasi
-- =====================================================================
ALTER TABLE public.bpjs_config
  ADD COLUMN IF NOT EXISTS jkk_risk_class text,
  ADD COLUMN IF NOT EXISTS jkk_source_note text,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.bpjs_config
  DROP CONSTRAINT IF EXISTS bpjs_config_jkk_risk_class_check;
ALTER TABLE public.bpjs_config
  ADD CONSTRAINT bpjs_config_jkk_risk_class_check
  CHECK (jkk_risk_class IS NULL OR jkk_risk_class IN ('I','II','III','IV','V'));

COMMENT ON COLUMN public.bpjs_config.jkk_risk_class IS
  'Kelompok tingkat risiko lingkungan kerja JKK menurut PP 44/2015 Pasal 16 (I=sangat rendah .. V=sangat tinggi). Menentukan tarif jkk yang berlaku.';
COMMENT ON COLUMN public.bpjs_config.jkk_source_note IS
  'Penjelasan asal-usul nilai jkk_risk_class/jkk saat ini: apakah dugaan sistem, hasil pilihan manual HR, atau hasil verifikasi terhadap sertifikat kepesertaan BPJS Ketenagakerjaan.';
COMMENT ON COLUMN public.bpjs_config.is_verified IS
  'true bila tarif pada baris ini sudah dicocokkan & dikonfirmasi oleh pemegang izin approve PAYROLL terhadap sertifikat kepesertaan BPJS Ketenagakerjaan perusahaan. false = masih berupa dugaan/isian sistem, jangan dipakai sebagai dasar final tanpa verifikasi.';
COMMENT ON COLUMN public.bpjs_config.verified_by IS 'Pengguna yang menandai konfigurasi ini terverifikasi.';
COMMENT ON COLUMN public.bpjs_config.verified_at IS 'Waktu penandaan terverifikasi.';

-- Riwayat berlaku: bpjs_config sudah mendukung banyak baris per company_id dengan
-- effective_date berbeda (tidak ada UNIQUE(company_id) yang membatasi). Tambahkan index
-- agar pencarian "baris berlaku pada tanggal periode" (effective_date terbesar <= tanggal)
-- efisien.
CREATE INDEX IF NOT EXISTS idx_bpjs_config_company_effective
  ON public.bpjs_config (company_id, effective_date DESC);

-- =====================================================================
-- 2. Tabel referensi kelompok risiko JKK (PP 44/2015 & PP 49/2023)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.jkk_risk_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id), -- NULL = referensi umum berlaku semua company
  class_code text NOT NULL CHECK (class_code IN ('I','II','III','IV','V')),
  class_name text NOT NULL,
  description text,
  rate numeric NOT NULL,
  effective_from date NOT NULL DEFAULT '2015-07-01',
  source_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jkk_risk_rates_lookup
  ON public.jkk_risk_rates (company_id, class_code, effective_from DESC);
DROP TRIGGER IF EXISTS trg_jkk_risk_rates_updated_at ON public.jkk_risk_rates;
CREATE TRIGGER trg_jkk_risk_rates_updated_at BEFORE UPDATE ON public.jkk_risk_rates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE public.jkk_risk_rates IS
  'Referensi lima kelompok tingkat risiko lingkungan kerja Jaminan Kecelakaan Kerja (JKK) beserta tarifnya, menurut PP 44/2015 Pasal 16 ayat (1) dan perubahannya PP 49/2023 Pasal 16A (rekomposisi 0,14% ke iuran Jaminan Kehilangan Pekerjaan/JKP, berlaku sejak 6 Oktober 2023 khusus peserta yang terdaftar program JKP). '
  'Sumber diambil 2026-09-16: '
  'https://www.bpjsketenagakerjaan.go.id/assets/uploads/peraturan/15122015_104557_PP%2044%20Tahun%202015.pdf (PP 44/2015 Pasal 16, tarif dasar 0,24%/0,54%/0,89%/1,27%/1,74%); '
  'https://peraturan.bpk.go.id/Download/28927/PP%20Nomor%2044%20Tahun%202015.pdf (salinan resmi PP 44/2015, mengonfirmasi angka yang sama); '
  'https://www.ramco.com/hubfs/Bebas-Regular-Font/PP%2049%20th%202023%20ttg%20perubahan%20PP%2044%20th%202015%20ttg%20penyelenggaraan%20program%20JKK%20dan%20JKM.pdf (PP 49/2023 Pasal 16A, tarif rekomposisi 0,10%/0,40%/0,75%/1,13%/1,60%); '
  'https://www.cnbcindonesia.com/news/20231009104717-4-478983/skema-iuran-kecelakaan-kerja-diubah-begini-aturannya (berita sekunder yang mengonfirmasi angka rekomposisi PP 49/2023 & syarat kepesertaan JKP). '
  'CATATAN: kolom rate pada tabel ini memakai tarif PASCA rekomposisi PP 49/2023 (berlaku bagi peserta yang terdaftar program JKP). Perusahaan yang BELUM terdaftar JKP atau masih menunggak iuran tetap memakai tarif dasar PP 44/2015 yang lebih tinggi — kedua angka dicantumkan pada kolom description tiap baris. Contoh jenis usaha per kelompok bersumber dari uraian sekunder (krishandsoftware.com merujuk Lampiran I PP 44/2015) dan BUKAN pengganti Lampiran I resmi; penetapan kelompok risiko final tiap perusahaan dilakukan oleh BPJS Ketenagakerjaan dan tercantum pada sertifikat kepesertaan.';
COMMENT ON COLUMN public.jkk_risk_rates.rate IS 'Tarif JKK pasca rekomposisi PP 49/2023 (desimal, mis. 0.0040 = 0,40%). Lihat description untuk tarif dasar PP 44/2015 sebelum rekomposisi.';
COMMENT ON COLUMN public.jkk_risk_rates.effective_from IS 'Tanggal mulai berlaku tarif pada baris ini (2023-10-06 = mulai berlaku PP 49/2023).';

ALTER TABLE public.jkk_risk_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS jkk_risk_rates_select ON public.jkk_risk_rates;
CREATE POLICY jkk_risk_rates_select ON public.jkk_risk_rates FOR SELECT
  USING ((company_id IS NULL OR company_id = auth_company_id()) AND can_read('PAYROLL'));

INSERT INTO public.jkk_risk_rates (company_id, class_code, class_name, description, rate, effective_from, source_note)
VALUES
  (NULL, 'I', 'Sangat Rendah',
    'Contoh: industri kreatif, jasa profesi (dokter, pengacara, akuntan). Tarif dasar PP 44/2015: 0,24% dari upah sebulan. Tarif pasca rekomposisi PP 49/2023 (peserta terdaftar JKP): 0,10%.',
    0.0010, '2023-10-06',
    'PP 44/2015 Ps.16(1) huruf a: 0,24%; PP 49/2023 Ps.16A: 0,10%. https://www.bpjsketenagakerjaan.go.id/assets/uploads/peraturan/15122015_104557_PP%2044%20Tahun%202015.pdf ; https://www.ramco.com/hubfs/Bebas-Regular-Font/PP%2049%20th%202023%20ttg%20perubahan%20PP%2044%20th%202015%20ttg%20penyelenggaraan%20program%20JKK%20dan%20JKM.pdf . Diambil 2026-09-16.'),
  (NULL, 'II', 'Rendah',
    'Contoh: perkebunan, pabrik rokok, perusahaan pembuatan film. Tarif dasar PP 44/2015: 0,54% dari upah sebulan. Tarif pasca rekomposisi PP 49/2023 (peserta terdaftar JKP): 0,40%.',
    0.0040, '2023-10-06',
    'PP 44/2015 Ps.16(1) huruf b: 0,54%; PP 49/2023 Ps.16A: 0,40%. https://www.bpjsketenagakerjaan.go.id/assets/uploads/peraturan/15122015_104557_PP%2044%20Tahun%202015.pdf ; https://www.ramco.com/hubfs/Bebas-Regular-Font/PP%2049%20th%202023%20ttg%20perubahan%20PP%2044%20th%202015%20ttg%20penyelenggaraan%20program%20JKK%20dan%20JKM.pdf . Diambil 2026-09-16.'),
  (NULL, 'III', 'Sedang',
    'Contoh: pabrik pengecoran besi, pembuatan meubel, reparasi kendaraan bermotor. Tarif dasar PP 44/2015: 0,89% dari upah sebulan. Tarif pasca rekomposisi PP 49/2023 (peserta terdaftar JKP): 0,75%.',
    0.0075, '2023-10-06',
    'PP 44/2015 Ps.16(1) huruf c: 0,89%; PP 49/2023 Ps.16A: 0,75%. https://www.bpjsketenagakerjaan.go.id/assets/uploads/peraturan/15122015_104557_PP%2044%20Tahun%202015.pdf ; https://www.ramco.com/hubfs/Bebas-Regular-Font/PP%2049%20th%202023%20ttg%20perubahan%20PP%2044%20th%202015%20ttg%20penyelenggaraan%20program%20JKK%20dan%20JKM.pdf . Diambil 2026-09-16.'),
  (NULL, 'IV', 'Tinggi',
    'Contoh: pabrik mesin, pembuatan & reparasi kapal baja, pengangkutan barang; pada praktiknya kontraktor konstruksi jaringan/instalasi telekomunikasi (fiber optic) umumnya diarahkan ke kelompok ini. Tarif dasar PP 44/2015: 1,27% dari upah sebulan. Tarif pasca rekomposisi PP 49/2023 (peserta terdaftar JKP): 1,13%.',
    0.0113, '2023-10-06',
    'PP 44/2015 Ps.16(1) huruf d: 1,27%; PP 49/2023 Ps.16A: 1,13%. Klasifikasi jasa konstruksi/instalasi telekomunikasi tidak disebut eksplisit pada sumber sekunder — perlu dicocokkan ke Lampiran I PP 44/2015 & sertifikat kepesertaan. https://www.bpjsketenagakerjaan.go.id/assets/uploads/peraturan/15122015_104557_PP%2044%20Tahun%202015.pdf ; https://www.krishandsoftware.com/blog/782/pembagian-kelompok-tingkat-risiko-lingkungan-kerja-jkk/ ; https://www.ramco.com/hubfs/Bebas-Regular-Font/PP%2049%20th%202023%20ttg%20perubahan%20PP%2044%20th%202015%20ttg%20penyelenggaraan%20program%20JKK%20dan%20JKM.pdf . Diambil 2026-09-16.'),
  (NULL, 'V', 'Sangat Tinggi',
    'Contoh: perbaikan rumah & jalan, konstruksi berat, jembatan kereta api, instalasi listrik, pertambangan, pengangkutan laut/udara. Tarif dasar PP 44/2015: 1,74% dari upah sebulan. Tarif pasca rekomposisi PP 49/2023 (peserta terdaftar JKP): 1,60%.',
    0.0160, '2023-10-06',
    'PP 44/2015 Ps.16(1) huruf e: 1,74%; PP 49/2023 Ps.16A: 1,60%. https://www.bpjsketenagakerjaan.go.id/assets/uploads/peraturan/15122015_104557_PP%2044%20Tahun%202015.pdf ; https://www.krishandsoftware.com/blog/782/pembagian-kelompok-tingkat-risiko-lingkungan-kerja-jkk/ ; https://www.ramco.com/hubfs/Bebas-Regular-Font/PP%2049%20th%202023%20ttg%20perubahan%20PP%2044%20th%202015%20ttg%20penyelenggaraan%20program%20JKK%20dan%20JKM.pdf . Diambil 2026-09-16.')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 3. Izin RLS: penanda "verified" adalah tindakan approve, bukan sekadar write
-- =====================================================================
DROP POLICY IF EXISTS bpjs_config_update ON public.bpjs_config;
CREATE POLICY bpjs_config_update ON public.bpjs_config FOR UPDATE
  USING (company_id = auth_company_id() AND (can_write('PAYROLL') OR can_approve('PAYROLL')))
  WITH CHECK (company_id = auth_company_id() AND (can_write('PAYROLL') OR can_approve('PAYROLL')));

-- =====================================================================
-- 4. Isi kelompok risiko dugaan pada baris bpjs_config yang sudah ada,
--    TANPA mengubah nilai jkk/jht/jkm/jp/kes yang sedang berlaku.
--    Kelompok IV (Tinggi) dipilih sebagai dugaan moderat untuk kontraktor
--    jasa konstruksi/instalasi jaringan telekomunikasi fiber optic — BUKAN
--    kepastian, harus dicocokkan ke sertifikat kepesertaan perusahaan.
-- =====================================================================
UPDATE public.bpjs_config
SET
  jkk_risk_class = 'IV',
  is_verified = false,
  jkk_source_note = 'Dugaan sistem (belum diverifikasi): Kelompok IV — Tinggi, untuk usaha jasa konstruksi/instalasi jaringan telekomunikasi (fiber optic). Dipilih sebagai perkiraan moderat karena sumber sekunder yang dipakai (krishandsoftware.com, merujuk Lampiran I PP 44/2015) hanya mencontohkan "instalasi listrik" & konstruksi berat pada Kelompok V tanpa menyebut instalasi telekomunikasi secara eksplisit; pekerjaan jaringan fiber optic (penarikan kabel udara/tanam, panjat tiang/tower) dinilai berisiko tinggi namun tidak otomatis disamakan dengan kelompok risiko tertinggi. Nilai jkk saat ini (0,54%) yang terisi di baris ini justru sama persis dengan tarif dasar PP 44/2015 Kelompok II (Rendah) sebelum rekomposisi PP 49/2023 — kemungkinan warisan data lama, BUKAN hasil penetapan kelompok IV. WAJIB dicocokkan ke sertifikat kepesertaan BPJS Ketenagakerjaan perusahaan (mencantumkan kelompok risiko & tarif JKK resmi) sebelum dipakai sebagai dasar pembayaran, lalu tandai terverifikasi.'
WHERE jkk_risk_class IS NULL;
