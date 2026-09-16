# Cara membangun APK NUSAKARYA Teknisi

## Cara yang dipakai sekarang — tanpa akun Expo
Workflow `.github/workflows/android-apk.yml` membangun APK langsung di runner
GitHub memakai Gradle. Runner `ubuntu-latest` sudah memuat Android SDK dan JDK,
jadi tidak perlu akun Expo, tidak perlu EAS, dan tidak perlu token apa pun.

**Menjalankannya:**
1. Buka https://github.com/erzamadana-ui/nusakarya/actions
2. Pilih workflow **Build APK NUSAKARYA Teknisi**
3. Tekan **Run workflow**, pilih varian `release`, lalu jalankan.
4. Setelah selesai (sekitar 10–15 menit), APK tersedia di dua tempat:
   - lampiran artefak pada halaman run tersebut, dan
   - halaman **Releases** repo, dengan tautan yang bisa dibuka langsung dari ponsel.

**Catatan penandatanganan.** APK ditandatangani dengan kunci debug bawaan
React Native. Cukup untuk dipasang dan dipakai internal, tetapi **tidak bisa
diunggah ke Google Play**. Untuk Play Store nanti diperlukan keystore unggah
tersendiri yang disimpan sebagai secret repo.

---

# Cara Build APK NUSAKARYA Teknisi (lewat EAS Build)

Dokumen ini untuk **pemilik akun/repo** (`erzamadana-ui/nusakarya`). Setelah langkah
di bawah selesai, siapa pun dengan akses repo bisa menjalankan build APK dari tab
**Actions** di GitHub tanpa perlu memasang Android SDK di komputer masing-masing.

Build dijalankan oleh Expo Application Services (EAS) di server milik Expo, dipicu
oleh workflow `.github/workflows/mobile-apk.yml` (`workflow_dispatch`, dijalankan
manual). Konfigurasi profil build ada di `apps/mobile/eas.json` — profil `preview`
sudah diset menghasilkan APK (`"android": { "buildType": "apk" }`) yang bisa
langsung dipasang di HP Android, tanpa perlu Play Store atau App Bundle.

## Langkah 1 — Buat akun Expo

1. Buka https://expo.dev/signup dan buat akun (bisa pakai email yang sama dengan
   Supabase project ini, atau email kerja lain).
2. Catat username Expo yang dipilih — dipakai untuk login di langkah berikut.

## Langkah 2 — Login dari komputer (sekali saja, untuk membuat/verifikasi proyek EAS)

Di komputer yang punya Node.js terpasang:

```bash
cd apps/mobile
npx expo login
# ikuti prompt: masukkan email/username dan password akun Expo
```

Jika proyek EAS untuk `nusakarya-teknisi` belum terdaftar, jalankan sekali:

```bash
npx eas init
```

Ini akan menautkan folder `apps/mobile` ke proyek di dashboard expo.dev (menulis
`extra.eas.projectId` ke `app.json`). Commit perubahan `app.json` tersebut ke repo.

## Langkah 3 — Buat token akses (untuk dipakai GitHub Actions, bukan password)

1. Buka https://expo.dev/accounts/[username]/settings/access-tokens
   (ganti `[username]` dengan username Expo Anda).
2. Klik **Create token**, beri nama misalnya `github-actions-nusakarya`.
3. Salin token yang muncul (hanya ditampilkan sekali).

**Jangan** menaruh token ini di file apa pun di dalam repo. Token hanya ditaruh
sebagai GitHub Secret (langkah berikut).

## Langkah 4 — Simpan token sebagai GitHub Secret

1. Buka repo https://github.com/erzamadana-ui/nusakarya di GitHub.
2. Masuk ke **Settings → Secrets and variables → Actions → New repository secret**.
3. Nama secret: `EXPO_TOKEN`
4. Value: tempel token dari Langkah 3.
5. Klik **Add secret**.

## Langkah 5 — Jalankan workflow build APK

1. Buka tab **Actions** di repo.
2. Pilih workflow **"Build APK NUSAKARYA Teknisi"** di daftar sebelah kiri.
3. Klik **Run workflow**, pilih profil (default `preview` — menghasilkan APK untuk
   dibagikan/dipasang langsung; `production` menghasilkan App Bundle `.aab` untuk
   Play Store, bukan APK), lalu klik **Run workflow**.
4. Tunggu job selesai (build sebenarnya berjalan di server Expo, bisa dipantau
   lewat link yang muncul di log job — juga terlihat di dashboard expo.dev).
5. Setelah build EAS selesai, unduh APK dari halaman build di https://expo.dev
   (menu **Builds** pada proyek `nusakarya-teknisi`), lalu bagikan filenya ke
   teknisi/staf lapangan (mis. lewat Google Drive/WhatsApp) untuk dipasang.

## Catatan keamanan

- Token EXPO_TOKEN memberi akses build atas nama akun Expo Anda — perlakukan
  seperti password: jangan commit ke repo, jangan share di chat publik.
- Bila token bocor, cabut ("revoke") dari halaman Access Tokens expo.dev dan buat
  yang baru, lalu perbarui secret `EXPO_TOKEN` di GitHub.
- Anon key Supabase (`EXPO_PUBLIC_SUPABASE_ANON_KEY` di `apps/mobile/.env`) memang
  publik by design (dipakai di aplikasi klien) — bukan rahasia yang perlu disembunyikan,
  tapi tetap pastikan Row Level Security (RLS) aktif di Supabase untuk semua tabel.

## Ringkasan APK vs PWA (saat ini)

- **PWA (tersedia sekarang):** hasil `expo export --platform web` diterbitkan ke
  GitHub Pages di `/nusakarya/teknisi/`. Staf memasangnya lewat menu Chrome Android
  "Tambahkan ke layar utama" — tidak perlu APK, tidak perlu akun Expo, dan bisa
  dipakai hari ini.
- **APK asli (lewat EAS, langkah di atas):** perlu akun Expo + `EXPO_TOKEN` dan build
  di server Expo (build lokal gagal di lingkungan ini karena unduhan Android SDK
  command-line tools dari `dl.google.com` diblokir oleh kebijakan jaringan container).
  Setelah `EXPO_TOKEN` terpasang, APK bisa dibuat kapan saja lewat workflow ini.
