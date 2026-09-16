# Dua salinan repo — kenapa ada, dan mana yang benar

## Ringkas
- **Sumber kebenaran: GitHub** — `https://github.com/erzamadana-ui/nusakarya`, cabang `main`.
- **Salinan yang mendorong ke GitHub**: di laptop pengguna, `~/nk/nusakarya`.
- **Salinan kerja Claude**: di container cloud, `/home/claude/nusakarya`.

## Kenapa terpisah
Proxy jaringan container cloud hanya mengizinkan akses git ke repositori yang
terdaftar pada sesi. Repo ini tidak termasuk, sehingga container **tidak bisa**
melakukan `git push` maupun `git fetch` ke sana. Karena itu alur kerjanya:

1. Claude menulis kode di container.
2. Berkas yang berubah dizip dan disalin ke laptop lewat jembatan perangkat.
3. Commit dan push dilakukan dari salinan di laptop.

Akibatnya susunan commit kedua salinan bisa berbeda (satu memecah jadi beberapa
commit, satunya menggabung) walaupun **isi berkasnya sama**.

## Aturan untuk sesi berikutnya
- Jangan menganggap `/home/claude/nusakarya` mutakhir. Selalu ambil keadaan
  terkini dari GitHub, atau dari `~/nk/nusakarya` di laptop.
- Setelah menyalin perubahan ke laptop dan mendorongnya, **commit juga di
  container** supaya salinan kerja tidak menumpuk perubahan yang menggantung.
- Jangan pernah `git push --force` dari salah satu salinan.

## Folder di laptop
- `MEGA/02. Pribadi/Aplikasi Kontraktor & Manage Service Fiber Optic/repo-live/nusakarya`
  — salinan hasil unzip pertama, **sudah usang**, dibiarkan agar kartu berkas di
  riwayat percakapan tidak mati.
- `~/nk/nusakarya` — salinan aktif yang dipakai mendorong ke GitHub. Operasi git
  gagal bila dijalankan di dalam folder tersinkron karena berkas kunci tidak bisa
  dihapus di sana.
