// ============================================================
// service-worker.js — Cache tài nguyên tĩnh để app mở được khi
// mất mạng (giao diện vẫn tải, dữ liệu vẫn đọc/ghi được từ
// localStorage nhờ sync.js — chỉ việc gọi Supabase là cần mạng).
// ============================================================

const CACHE_NAME = 'habit-tracker-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/supabase-client.js',
  './js/auth.js',
  './js/storage-local.js',
  './js/sync.js',
  './js/tree-icons.js',
  './js/views/today.js',
  './js/views/year.js',
  './js/views/day-detail.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Không cache các lời gọi tới Supabase — dữ liệu phải luôn mới,
  // và các request này đã có cơ chế xử lý lỗi mạng riêng trong sync.js.
  if (url.hostname.endsWith('.supabase.co')) return;

  // Chỉ xử lý GET; các request khác đi thẳng qua mạng như bình thường.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache thêm tài nguyên mới gặp (vd font ngoài) để lần sau vẫn dùng offline được
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
