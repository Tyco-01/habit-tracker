// ============================================================
// Smoke test: EventSection sau khi sửa cơ chế chip + timeline phân
// trang. Nạp toàn bộ app thật vào JSDOM (đúng thứ tự script trong
// index.html), gọi EventSection.render() thật, thao tác DOM thật —
// theo đúng yêu cầu ARCHITECTURE.md mục 7 ("luôn chạy smoke test này
// sau khi sửa bất kỳ view hay module dùng chung nào").
//
// Chạy: node smoke-test-event-section.js (cần `npm install jsdom`
// trước, không cần commit vào repo — chỉ dùng để tự kiểm tra).
// ============================================================

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const dom = new JSDOM('<!DOCTYPE html><div id="app"></div>', {
  url: 'http://localhost/',
  pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;

let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { pass++; console.log('  OK  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

// ---- Nạp script ĐÚNG thứ tự như index.html (chỉ phần cần cho test này) ----
const vm = require('vm');
const context = dom.window;
vm.createContext(context);

const scripts = [
  'js/config.js', 'js/date-utils.js', 'js/dom-utils.js',
  'js/storage-local.js', 'js/sync.js', 'js/confirm-modal.js',
  'js/event-section.js'
];
scripts.forEach(f => {
  const code = fs.readFileSync(path.join(__dirname, f), 'utf8');
  // Ép các khai báo top-level (const Sync = ...) gắn thẳng vào
  // window.Sync — vm.runInContext CŨNG gặp vấn đề y hệt eval() với
  // const/let top-level (không tự lên global object), nên bọc thủ
  // công: sau khi chạy IIFE, gán kết quả named export ra window.
  vm.runInContext(code, context, { filename: f });
});
// Các module dùng `const X = (() => {...})()` — sau khi vm chạy xong,
// biến X tồn tại trong context nhưng KHÔNG tự lên context.X (giống
// hệt hành vi const ở top-level của module JS thật). Lấy ra thủ công
// bằng cách chạy 1 dòng cuối cùng nối các tên biến vào window.
const exposeNames = ['CONFIG', 'DateUtils', 'DomUtils', 'LocalStore', 'Sync', 'ConfirmModal', 'EventSection'];
vm.runInContext(exposeNames.map(n => `window.${n} = ${n};`).join('\n'), context);

// Gán các global vừa định nghĩa trong dom.window ra ngoài để dùng trực tiếp
const { Sync, EventSection, DateUtils } = dom.window;

console.log('=== Chuẩn bị dữ liệu giả: 1 dấu ấn "habit tracker" có 7 mốc lịch sử ===');
const todayKey = DateUtils.dateKey(new Date());
const todayDate = DateUtils.parseDateStr(todayKey);
// Tạo 6 ngày lịch sử trước đó (cách nhau vài ngày) + hôm nay = 7 mốc
const pastDates = [];
for (let i = 6; i >= 1; i--) {
  const d = new Date(todayDate);
  d.setDate(d.getDate() - i * 3);
  pastDates.push(DateUtils.dateKey(d));
}
const allDates = [...pastDates, todayKey];
const eventsSeed = {};
let firstId = null;
allDates.forEach((d, idx) => {
  const id = 'seed_' + idx;
  if (d === todayKey) firstId = id;
  eventsSeed[d] = [{ id, name: 'habit tracker', note: '' }];
});
// Thêm 1 dấu ấn tên KHÁC ở 1 ngày trong quá khứ (không phải hôm nay) —
// để có ít nhất 1 gợi ý KHÔNG bị lọc, dùng test label/hiển thị chip.
// Nếu chỉ có đúng 1 tên và tên đó trùng hôm nay, allEventNames() sau
// khi lọc sẽ luôn rỗng, không kiểm tra được nhánh "có gợi ý để hiện".
eventsSeed[pastDates[0]].push({ id: 'seed_other', name: 'lần đầu ra ủy ban xác thực sơ yếu lí lịch', note: '' });
Sync.getData().events = eventsSeed;

console.log('=== Render EventSection thật, giống cách today.js gọi ===');
const container = document.createElement('div');
document.getElementById('app').appendChild(container);
EventSection.render(container, todayKey, { idPrefix: 'today', showHistory: true });

// ---- Test 1: đếm dấu ấn hiển thị đúng ----
const countEl = container.querySelector('#today-event-count');
check('Số lượng dấu ấn hiển thị = 1', countEl.textContent === '1');

// ---- Test 2: timeline mặc định chỉ hiện 5 mốc (không phải cả 7) ----
let timelineItems = container.querySelectorAll('.event-timeline-item');
check('Timeline mặc định hiện đúng 5/7 mốc (phân trang)', timelineItems.length === 5);

const moreBtn = container.querySelector('[data-expand]');
check('Có nút "Xem thêm" khi còn mốc chưa hiện', !!moreBtn);
check('Nút "Xem thêm" ghi đúng số mốc còn lại (2)', moreBtn && moreBtn.textContent.includes('2'));

// ---- Test 3: bấm "Xem thêm" mở rộng đúng, không mất mốc đã hiện ----
if (moreBtn) moreBtn.click();
timelineItems = container.querySelectorAll('.event-timeline-item');
check('Sau khi bấm "Xem thêm", hiện đủ cả 7/7 mốc', timelineItems.length === 7);
check('Hết mốc thì KHÔNG còn nút "Xem thêm"', !container.querySelector('[data-expand]'));

// ---- Test 4: chấm mới nhất có class "latest", đúng thứ tự mới->cũ ----
const firstDot = container.querySelector('.event-timeline-item:first-child .event-timeline-dot');
check('Chấm đầu tiên (mới nhất) có class "latest"', firstDot && firstDot.classList.contains('latest'));

// ---- Test 5: nút "+ Thêm" mở khối, đổi thành "Đóng", có class active ----
const addBtn = container.querySelector('#today-event-add-btn');
const addRow = container.querySelector('#today-event-input-row');
check('Khối input mặc định ẨN', addRow.style.display === 'none');
addBtn.click();
check('Sau khi bấm "+ Thêm", khối input HIỆN', addRow.style.display === 'flex');
check('Nút đổi chữ thành "Đóng"', addBtn.textContent.trim().includes('Đóng'));
check('Nút có class "active" (fill đen cố định)', addBtn.classList.contains('active'));

// ---- Test 6: chip gợi ý hiện NGAY (không cần gõ), và LỌC tên đã có hôm nay ----
const suggestBox = container.querySelector('#today-event-dropdown');
check('Khối gợi ý hiện đúng label "hoặc chạm để dùng lại"', suggestBox.innerHTML.includes('hoặc chạm để dùng lại'));
const chips = suggestBox.querySelectorAll('[data-suggest]');
check('Chip "habit tracker" bị LỌC KHỎI gợi ý (đã có trong dấu ấn hôm nay)',
  ![...chips].some(c => c.dataset.suggest === 'habit tracker'));

// ---- Test 7: thêm 1 dấu ấn tên mới qua ô input, khối tự đóng lại ----
const input = container.querySelector('#today-event-input');
const saveBtn = container.querySelector('#today-event-save');
input.value = 'cắt tóc';
saveBtn.click();
check('Dấu ấn mới "cắt tóc" đã được thêm vào data thật', Sync.getData().events[todayKey].some(e => e.name === 'cắt tóc'));
check('Sau khi Lưu, khối input tự ĐÓNG lại', addRow.style.display === 'none');
check('Sau khi đóng, nút trở lại chữ "Thêm" (không còn class active)',
  addBtn.textContent.trim().includes('Thêm') && !addBtn.classList.contains('active'));

// ---- Test 8: bấm chip = ghi nhận NGAY, không cần qua ô input ----
// Trước tiên xoá "cắt tóc" vừa thêm để dọn lại trạng thái sạch cho test này
Sync.getData().events[todayKey] = Sync.getData().events[todayKey].filter(e => e.name !== 'cắt tóc');
addBtn.click(); // mở lại khối
const chipsAfterReopen = container.querySelectorAll('[data-suggest]');
const targetChip = [...chipsAfterReopen].find(c => c.dataset.suggest === 'habit tracker');
check('Vẫn lọc đúng (habit tracker không xuất hiện lại, vì vẫn có trong dữ liệu hôm nay)', !targetChip);

// Test lọc đúng nghĩa hơn: xoá HẲN habit tracker khỏi hôm nay, xem chip có xuất hiện lại
Sync.getData().events[todayKey] = Sync.getData().events[todayKey].filter(e => e.name !== 'habit tracker');
addBtn.click(); addBtn.click(); // đóng rồi mở lại để vẽ lại suggestions
const chipsAfterRemove = container.querySelectorAll('[data-suggest]');
const chipReappear = [...chipsAfterRemove].find(c => c.dataset.suggest === 'habit tracker');
check('Sau khi xoá "habit tracker" khỏi hôm nay, chip xuất hiện lại trong gợi ý', !!chipReappear);
if (chipReappear) chipReappear.click();
check('Bấm chip = ghi nhận NGAY vào data thật (không cần qua ô input/Lưu)',
  Sync.getData().events[todayKey].some(e => e.name === 'habit tracker'));
check('Bấm chip xong, khối tự ĐÓNG lại', addRow.style.display === 'none');

// ---- Test 9: chạy render() nhiều lần liên tiếp (mô phỏng chuyển tab qua lại) — không cộng dồn listener ----
// Dùng thẳng Sync._listenerCount() (API debug nội bộ, xem cuối sync.js)
// để đo CHÍNH XÁC, thay vì đo gián tiếp qua hành vi UI.
const listenersBefore = Sync._listenerCount();
for (let i = 0; i < 5; i++) {
  EventSection.render(container, todayKey, { idPrefix: 'today', showHistory: true });
}
const listenersAfter = Sync._listenerCount();
check('render() gọi lại 5 lần liên tiếp KHÔNG làm listener cộng dồn (vẫn đúng 1, không phải 6)',
  listenersAfter === 1 && listenersAfter === listenersBefore);

console.log('');
console.log(`========== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ==========`);
process.exit(fail > 0 ? 1 : 0);
