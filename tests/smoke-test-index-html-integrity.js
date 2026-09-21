// ============================================================
// tests/smoke-test-index-html-integrity.js — Nạp index.html THẬT
// (đúng thứ tự script như trình duyệt sẽ làm) vào JSDOM, bắt mọi lỗi
// định nghĩa module — mô phỏng đúng tình huống "mở app lên bị trắng
// trang, tương tác gì cũng không được" (1 module JS mới thêm nhưng
// QUÊN đăng ký thẻ <script> trong index.html, khiến module khác gọi
// tới nó bị ReferenceError ngay khi vừa tải trang — lỗi này không bài
// smoke-test nào khác phát hiện được vì chúng tự chọn tay danh sách
// script cần nạp, không đọc trực tiếp từ index.html thật).
// ============================================================
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const errors = [];

const dom = new JSDOM('<!DOCTYPE html><div id="app"></div>', {
  url: 'http://localhost/',
  pretendToBeVisual: true
});
const { window } = dom;
window.localStorage = (() => {
  let store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { store = {}; }
  };
})();
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.fetch = () => Promise.reject(new Error('no network in test'));
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));

const context = vm.createContext(window);

// Đọc index.html thật, trích đúng danh sách script src theo ĐÚNG THỨ
// TỰ xuất hiện — mô phỏng chính xác cách trình duyệt tải & chạy tuần
// tự các thẻ <script> không có "defer"/"async". DÙNG CHUNG 1 CONTEXT
// vm xuyên suốt (không phải window.eval() riêng lẻ từng lần) — mỗi
// file định nghĩa `const Foo = (() => {...})()` ở TOP-LEVEL của
// SCRIPT ĐÓ, và trong trình duyệt thật mọi <script> không type=module
// đều chia sẻ chung 1 global scope; vm.runInContext với CÙNG 1
// `context` tái tạo đúng hành vi đó, còn window.eval() gọi lặp lại
// nhiều lần có thể không giữ đúng cách 1 số bản JSDOM xử lý phạm vi
// biến giữa các lần gọi.
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scriptSrcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
console.log(`Tìm thấy ${scriptSrcs.length} thẻ <script src="...">`);

for (const src of scriptSrcs) {
  const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
  try {
    vm.runInContext(code, context, { filename: src });
  } catch (err) {
    errors.push(`[${src}] ${err.message}`);
  }
}

if (errors.length > 0) {
  console.log('\n❌ CÓ LỖI khi nạp script:');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
} else {
  console.log('\n✅ Toàn bộ script nạp xong không lỗi.');
  process.exit(0);
}
