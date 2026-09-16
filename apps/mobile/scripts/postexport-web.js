#!/usr/bin/env node
/**
 * Menyiapkan hasil `expo export --platform web` sebagai PWA yang bisa dipasang
 * di layar utama Android (Chrome "Tambahkan ke layar utama"):
 *  - menyalin manifest.webmanifest, ikon 192/512px, dan service worker ke dist/
 *  - menyuntikkan <link rel="manifest">, meta theme-color, apple-touch-icon,
 *    dan registrasi service worker ke dist/index.html
 *
 * Dijalankan setelah `expo export --platform web` (lihat package.json -> "export:web").
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PWA_SRC = path.join(ROOT, "pwa");
const BASE_PATH = "/nusakarya/teknisi/";

function copyFile(name) {
  const src = path.join(PWA_SRC, name);
  const dest = path.join(DIST, name);
  fs.copyFileSync(src, dest);
  console.log(`copied ${name} -> dist/${name}`);
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error("dist/ tidak ditemukan. Jalankan `expo export --platform web` dahulu.");
    process.exit(1);
  }

  ["manifest.webmanifest", "sw.js", "icon-192.png", "icon-512.png"].forEach(copyFile);

  const indexPath = path.join(DIST, "index.html");
  let html = fs.readFileSync(indexPath, "utf8");

  const tags = [
    `<link rel="manifest" href="${BASE_PATH}manifest.webmanifest" />`,
    `<meta name="theme-color" content="#4F46E5" />`,
    `<meta name="mobile-web-app-capable" content="yes" />`,
    `<meta name="apple-mobile-web-app-capable" content="yes" />`,
    `<meta name="apple-mobile-web-app-status-bar-style" content="default" />`,
    `<meta name="apple-mobile-web-app-title" content="Teknisi" />`,
    `<link rel="apple-touch-icon" href="${BASE_PATH}icon-192.png" />`,
  ].join("\n  ");

  if (!html.includes("manifest.webmanifest")) {
    html = html.replace("</head>", `  ${tags}\n</head>`);
  }

  const swRegistration = `
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('${BASE_PATH}sw.js').catch(function (err) {
          console.warn('Gagal mendaftarkan service worker:', err);
        });
      });
    }
  </script>
`;

  if (!html.includes("sw.js")) {
    html = html.replace("</body>", `${swRegistration}</body>`);
  }

  fs.writeFileSync(indexPath, html);
  console.log("index.html diperbarui dengan manifest + service worker.");
}

main();
