/* Service worker sederhana untuk NUSAKARYA Teknisi (PWA).
 * Menyimpan cache "app shell" agar aplikasi tetap terbuka saat sinyal buruk / offline.
 * Strategi: cache-first untuk aset statis (JS/CSS/gambar/font), lalu perbarui cache
 * di latar belakang (stale-while-revalidate) supaya update berikutnya tetap terambil.
 */
const CACHE_NAME = "nusakarya-teknisi-shell-v1";
const SCOPE_PATH = self.registration.scope;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Precache halaman utama saja; aset JS/CSS di-cache saat pertama diminta (runtime caching).
      return cache.addAll([SCOPE_PATH]).catch(() => {
        /* diamkan jika offline saat install pertama kali */
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Hanya tangani GET same-origin; biarkan request lain (mis. ke Supabase) lewat apa adanya.
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);

      const networkFetch = fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(req, response.clone());
          }
          return response;
        })
        .catch(() => undefined);

      if (cached) {
        // Stale-while-revalidate: kembalikan cache segera, perbarui di belakang layar.
        networkFetch.catch(() => {});
        return cached;
      }

      const networkResponse = await networkFetch;
      if (networkResponse) {
        return networkResponse;
      }

      // Offline dan tidak ada cache: untuk navigasi halaman, kembalikan shell utama bila ada.
      if (req.mode === "navigate") {
        const shell = await cache.match(SCOPE_PATH);
        if (shell) return shell;
      }

      return new Response("Offline dan halaman belum pernah dimuat sebelumnya.", {
        status: 503,
        statusText: "Offline",
      });
    })
  );
});
