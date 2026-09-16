# NUSAKARYA Teknisi

Aplikasi mobile untuk Teknisi & Mitra Lapangan (React Native + Expo SDK 51 + expo-router + TypeScript), terhubung ke Supabase project `idlhsxamdkipnmyvewbp`.

## Menjalankan

```bash
npm install
npx expo start
```

Salin `.env.example` ke `.env` dan isi kredensial Supabase bila berbeda.

## Build APK (EAS)

```bash
npx eas build -p android --profile preview
```

Profil `preview` pada `eas.json` menghasilkan berkas APK (bukan AAB) untuk instalasi langsung/UAT.
Build juga dapat dipicu manual lewat GitHub Actions: `.github/workflows/mobile-apk.yml` (perlu secret `EXPO_TOKEN`).

## Keterbatasan & pekerjaan lanjutan

- **Antrean sinkronisasi offline belum ada.** Saat perangkat tanpa jaringan, aksi (absensi, checklist, evidence, dll.) akan gagal dengan pesan error dan pengguna diarahkan mengulang (tarik-untuk-muat-ulang pada daftar). Implementasi antrean lokal (SQLite/AsyncStorage) + retry background adalah pekerjaan lanjutan.
- **Tautan BAST ke `customers`**: tabel `bast.customer_id` bersifat wajib, sedangkan `work_orders` hanya menyimpan `customer_name`/`customer_no`. Aplikasi mencari data pelanggan berdasarkan kecocokan nama; bila tidak ditemukan di master `customers`, BAST tidak dapat disimpan dan pengguna diberi pesan untuk menghubungi admin.
- Tanda tangan pelanggan menggunakan kanvas sederhana (`react-native-svg` + `PanResponder`), bukan pustaka pihak ketiga khusus signature.
- Pemindaian barcode memakai `expo-camera` (`CameraView` dengan `onBarcodeScanned`), sesuai SDK 51.
