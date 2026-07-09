// Service Worker sederhana: cache file-file utama biar app tetap bisa
// dibuka (shell-nya) walau internet lagi jelek. Ini BUKAN cache buat
// respons AI (karena itu emang butuh internet tiap kali).

const NAMA_CACHE = "struk-analyzer-v2"; // dinaikkan versinya biar cache lama dibersihkan

const FILE_UNTUK_DICACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/src/icon-192.png",
  "/src/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(NAMA_CACHE).then((cache) => cache.addAll(FILE_UNTUK_DICACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((namaCacheList) =>
      Promise.all(
        namaCacheList
          .filter((nama) => nama !== NAMA_CACHE)
          .map((nama) => caches.delete(nama))
      )
    )
  );
  self.clients.claim();
});

// Strategi: coba ambil dari cache dulu, kalau gak ada baru ke network.
// Request ke /api/ (proxy AI kita sendiri) sengaja dilewati, biar selalu
// fresh dari server dan tidak pernah tersimpan sebagai cache.
self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/api/")) {
    return; // biarkan request ke backend langsung ke network
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});