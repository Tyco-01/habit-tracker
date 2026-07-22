// ============================================================
// service-worker.js — Cache tài nguyên tĩnh để app mở được khi
// mất mạng (giao diện vẫn tải, dữ liệu vẫn đọc/ghi được từ
// localStorage nhờ sync.js — chỉ việc gọi Supabase là cần mạng).
//
// QUAN TRỌNG: tăng CACHE_NAME (đổi số version) mỗi khi cập nhật code,
// để trình duyệt biết cần thay cache cũ — nếu không, bản JS/CSS cũ
// có thể bị "kẹt" lại rất lâu dù đã tải code mới lên server.
// ============================================================

const CACHE_NAME = 'habit-tracker-v4';

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
  './js/event-section.js',
  './js/views/today.js',
  './js/views/year.js',
  './js/views/day-detail.js',
  './js/views/stats.js',
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

  const isAppFile = url.origin === self.location.origin;

  if (isAppFile) {
    // NETWORK-FIRST cho file thuộc app (HTML/CSS/JS/icon): luôn thử lấy
    // bản mới nhất từ mạng trước. Chỉ rơi về cache khi thực sự mất mạng.
    // Nhờ vậy, cập nhật code mới sẽ có hiệu lực ngay lần mở tiếp theo,
    // không bị "kẹt" ở bản cũ như cách cache-first trước đây.
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // CACHE-FIRST cho tài nguyên bên ngoài (vd Google Fonts, Tabler Icons):
    // các thứ này hiếm khi đổi, ưu tiên tốc độ và khả năng dùng offline.
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
  }
});

