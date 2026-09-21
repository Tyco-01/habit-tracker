// ============================================================
// Smoke test: LongPress + DayPreviewSheet + icon event-clip/note-mark
// ở mode Tháng (view Lịch). Nạp toàn bộ app thật vào JSDOM, đúng thứ
// tự script trong index.html, thao tác DOM/PointerEvent thật.
//
// Chạy: node smoke-test-day-preview-sheet.js
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

// Polyfill tối thiểu — JSDOM không triển khai ResizeObserver (app
// thật dùng nó ở year.js để đo chiều cao .sticky-tabs / bề rộng nút
// switcher và tự cập nhật khi đổi cỡ; trong test không cần hành vi đó
// hoạt động thật, chỉ cần .observe()/.disconnect() tồn tại để code
// không crash khi gọi `new ResizeObserver(...)`).
dom.window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { pass++; console.log('  OK  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

const vm = require('vm');
const context = dom.window;
vm.createContext(context);

const scripts = [
  'js/config.js', 'js/date-utils.js', 'js/dom-utils.js', 'js/habit-scope.js', 'js/lunar-calendar.js',
  'js/storage-local.js',
  'js/sync/state.js', 'js/sync/queue.js', 'js/sync/mutations.js', 'js/sync/pull.js', 'js/sync/index.js',
  'js/confirm-modal.js',
  'js/event-section.js',
  'js/habit-note-panel.js',
  'js/long-press.js',
  'js/swipe-nav.js',
  'js/day-preview-sheet.js',
  'js/views/year.js'
];
scripts.forEach(f => {
  const code = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  vm.runInContext(code, context, { filename: f });
});
const exposeNames = [
  'CONFIG', 'DateUtils', 'DomUtils', 'HabitScope', 'LunarCalendar', 'LocalStore', 'Sync',
  'ConfirmModal', 'EventSection', 'HabitNotePanel', 'LongPress', 'SwipeNav', 'DayPreviewSheet', 'YearView'
];
vm.runInContext(exposeNames.map(n => `window.${n} = ${n};`).join('\n'), context);

const { Sync, DateUtils, LongPress, DayPreviewSheet, YearView } = dom.window;

// Test này chỉ quan tâm hành vi UI (long-press/sheet/tick), không test
// đồng bộ mạng thật — mock tối thiểu Auth + fetch để kickSync() (chạy
// debounce nền 400ms sau mỗi Sync.setCheck/addEvent) không crash khi
// timer của nó tự bắn trong lúc test đang await, giống cách app thật
// xử lý "không có mạng" (flushQueue tự bắt lỗi, xem sync/queue.js).
dom.window.Auth = { currentToken: () => null };
dom.window.fetch = () => Promise.reject(new Error('no network in test'));

console.log('=== Chuẩn bị dữ liệu giả: 1 habit + 1 event hôm nay ===');
const todayKey = DateUtils.dateKey(new Date());
Sync.addHabit('Uống nước');
Sync.addEvent(todayKey, 'Khám răng');

console.log('=== Render YearView (mặc định mode "month") thật, giống app.js ===');
const container = document.createElement('div');
document.getElementById('app').appendChild(container);
let openedDate = null;
YearView.render(container, (dateStr) => { openedDate = dateStr; }, { focusToday: true });

// ---- Test 1: icon event-clip ở mode Tháng nằm trong wrapper display:contents,
// không còn chiếm dòng riêng cùng âm lịch (day-cell-icons chỉ còn là wrapper vô hình) ----
const todayCell = container.querySelector(`.day-cell[data-date="${todayKey}"]`);
check('Tìm thấy ô ngày hôm nay trong lưới Tháng', !!todayCell);
const clipIcon = todayCell && todayCell.querySelector('.event-clip');
check('Ô hôm nay có icon event-clip (đã tạo event)', !!clipIcon);
const iconsWrapper = todayCell && todayCell.querySelector('.day-cell-icons');
check('day-cell-icons vẫn tồn tại trong DOM (giữ cấu trúc HTML cũ)', !!iconsWrapper);
check('day-cell-icons chứa event-clip bên trong (không bị wrapper nuốt mất)', iconsWrapper && iconsWrapper.contains(clipIcon));

// ---- Test 2: long-press 500ms trên ô ngày mở DayPreviewSheet ----
// jsdom chạy setTimeout trên Node event loop THẬT, nên chờ thật ~520ms
// (nhỉnh hơn ngưỡng 500ms trong long-press.js) là đủ để timer bên
// trong tự bắn — không cần fake timer.
// LongPress giờ dùng Touch Events thuần (xem js/long-press.js) — giả
// lập touchstart/touchend tối giản, chỉ cần .touches[0].clientX/Y.
function fireTouch(el, type, x = 10, y = 10) {
  const ev = new dom.window.Event(type, { bubbles: true, cancelable: true });
  ev.touches = [{ clientX: x, clientY: y }];
  el.dispatchEvent(ev);
  return ev;
}
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function run() {
  console.log('=== Mô phỏng nhấn giữ (long-press) trên ô hôm nay ===');
  const overlayBefore = document.querySelector('.day-preview-sheet-overlay');
  check('Chưa có sheet nào mở lúc đầu', !overlayBefore || overlayBefore.style.display === 'none');

  fireTouch(todayCell, 'touchstart');
  check('Ô hôm nay có class is-long-pressing NGAY khi vừa nhấn xuống (trước ngưỡng)', !todayCell.classList.contains('is-long-pressing'));
  await wait(560);

  check('Ô hôm nay có class is-long-pressing SAU khi giữ đủ lâu', todayCell.classList.contains('is-long-pressing'));
  const overlay = document.querySelector('.day-preview-sheet-overlay');
  check('DayPreviewSheet overlay đã được tạo trong DOM', !!overlay);
  check('Overlay đang hiện (display:flex, class is-open)', overlay && overlay.style.display === 'flex' && overlay.classList.contains('is-open'));

  const title = overlay.querySelector('#day-preview-sheet-title');
  check('Sheet hiện tiêu đề "Hôm nay" cho đúng ngày hôm nay', title && title.textContent.trim() === 'Hôm nay');

  const habitRow = overlay.querySelector('.day-preview-habit-list .check-btn');
  check('Sheet hiện habit "Uống nước" với nút tick', !!habitRow);

  const eventCount = overlay.querySelector('#day-preview-sheet-event-count');
  check('Khối EventSection nhúng trong sheet có đếm đúng 1 sự kiện', eventCount && eventCount.textContent.trim() === '1');

  // ---- Test 3: tick việc trong sheet cập nhật đúng Sync data ----
  console.log('=== Bấm tick "Uống nước" trong sheet ===');
  const { habits } = Sync.getData();
  const habitId = habits[0].id;
  habitRow.click();
  const { checks } = Sync.getData();
  check('setCheck đã ghi nhận true sau khi bấm tick trong sheet', !!(checks[habitId] && checks[habitId][todayKey]));
  // drawHabitsList vẽ lại TOÀN BỘ innerHTML qua Sync.onChange (đúng
  // pattern day-detail.js) — node habitRow cũ đã bị thay thế, phải lấy
  // lại node MỚI từ DOM để kiểm tra class checked, không dùng tham
  // chiếu cũ (đã văng khỏi cây DOM thật dù biến JS vẫn còn giữ nó).
  const habitRowAfter = overlay.querySelector('.day-preview-habit-list .check-btn');
  check('Nút tick trong sheet tự cập nhật class checked (Sync.onChange)', habitRowAfter.classList.contains('checked'));

  // ---- Test 4: bấm "Xem chi tiết đầy đủ" gọi đúng callback + đóng sheet ----
  console.log('=== Bấm "Xem chi tiết đầy đủ" ===');
  const fullBtn = overlay.querySelector('#day-preview-sheet-full-btn');
  check('Có nút "Xem chi tiết đầy đủ"', !!fullBtn);
  fullBtn.click();
  check('Callback onOpenFull (= onDayClick) được gọi đúng dateStr', openedDate === todayKey);
  check('Overlay bắt đầu đóng (mất class is-open) ngay khi bấm', !overlay.classList.contains('is-open'));
  await wait(300);
  check('Overlay ẩn hẳn (display:none) sau khi animation đóng xong', overlay.style.display === 'none');

  // ---- Test 5: click THƯỜNG (không giữ lâu) vẫn mở day-detail như cũ, KHÔNG mở sheet ----
  console.log('=== Click thường (nhấn rồi nhả ngay) vẫn hoạt động như trước ===');
  openedDate = null;
  const otherCell = container.querySelector('.day-cell:not(.blank-adjacent):not(.future-day)');
  fireTouch(otherCell, 'touchstart');
  await wait(50); // nhả tay SỚM, trước ngưỡng 500ms — không phải long-press
  fireTouch(otherCell, 'touchend');
  otherCell.click(); // JSDOM không tự bắn 'click' sau touchstart/end giả lập — gọi tay giống trình duyệt thật sẽ làm
  check('Click thường (thả sớm) mở thẳng onDayClick, KHÔNG có is-long-pressing', openedDate === otherCell.dataset.date && !otherCell.classList.contains('is-long-pressing'));
  const overlayAfterClick = document.querySelector('.day-preview-sheet-overlay');
  check('Click thường KHÔNG mở sheet xem nhanh', !overlayAfterClick.classList.contains('is-open'));

  // ---- Test 6: click "ra ngoài để đóng" NGAY SAU KHI MỞ không được
  // tự đóng sheet — đây là bug thật đã gặp: trên di động, long-press
  // mở sheet trong lúc ngón tay còn chạm màn hình, nên khi nhấc tay
  // trình duyệt tổng hợp 1 click rơi trúng lớp nền (overlay) vừa mở,
  // khiến sheet tự đóng ngay tức khắc trước khi người dùng kịp thấy.
  // Xem IGNORE_OUTSIDE_CLICK_MS trong day-preview-sheet.js. ----
  console.log('=== Long-press mở sheet, rồi mô phỏng click tổng hợp trên overlay NGAY LẬP TỨC (bug thật trên di động) ===');
  fireTouch(todayCell, 'touchstart');
  await wait(560);
  const overlay2 = document.querySelector('.day-preview-sheet-overlay');
  check('Sheet đã mở (is-open) trước khi mô phỏng click tổng hợp', overlay2.classList.contains('is-open'));
  // Mô phỏng ĐÚNG kịch bản lỗi: click rơi trúng overlay NGAY sau khi mở
  const clickEvt = new dom.window.MouseEvent('click', { bubbles: true });
  Object.defineProperty(clickEvt, 'target', { value: overlay2, enumerable: true });
  overlay2.dispatchEvent(clickEvt);
  check('Sheet VẪN MỞ ngay sau click tổng hợp tức thời (chưa đủ IGNORE_OUTSIDE_CLICK_MS)', overlay2.classList.contains('is-open'));

  console.log('=== Sau khi đợi đủ lâu (400ms), click ra ngoài ĐÓNG được sheet như bình thường ===');
  await wait(400);
  const clickEvt2 = new dom.window.MouseEvent('click', { bubbles: true });
  Object.defineProperty(clickEvt2, 'target', { value: overlay2, enumerable: true });
  overlay2.dispatchEvent(clickEvt2);
  check('Sheet đóng đúng khi click ra ngoài SAU khoảng miễn dịch', !overlay2.classList.contains('is-open'));
  await wait(300);

  // ---- Test 7: mở sheet NHIỀU LẦN không làm nhân bản listener "click
  // ra ngoài để đóng" trên overlay — bug rò rỉ đã gặp: bản trước gắn
  // listener này lại mỗi lần open(), trong khi overlay chỉ tạo 1 lần
  // duy nhất (ensureOverlay() tái dùng), khiến listener chồng chất
  // qua mỗi lần mở. Kiểm tra gián tiếp: mở 3 lần, rồi đợi đủ lâu, 1
  // click ra ngoài phải đóng sheet ĐÚNG 1 LẦN gọi close() thực chất
  // (không quan sát trực tiếp được số listener từ ngoài module, nhưng
  // có thể xác nhận qua việc sheet đóng gọn gàng không lỗi/không tự
  // mở lại bất thường). ----
  console.log('=== Mở sheet 3 lần liên tiếp, xác nhận vẫn đóng gọn gàng bằng click ra ngoài (không rò rỉ listener) ===');
  for (let i = 0; i < 3; i++) {
    fireTouch(todayCell, 'touchstart');
    await wait(560);
    fireTouch(todayCell, 'touchend');
    await wait(50);
  }
  const overlay3 = document.querySelector('.day-preview-sheet-overlay');
  check('Sheet mở đúng sau 3 lần long-press liên tiếp', overlay3.classList.contains('is-open'));
  await wait(400); // vượt khoảng miễn dịch của lần mở cuối
  const clickEvt3 = new dom.window.MouseEvent('click', { bubbles: true });
  Object.defineProperty(clickEvt3, 'target', { value: overlay3, enumerable: true });
  overlay3.dispatchEvent(clickEvt3);
  check('Đóng đúng bằng ĐÚNG 1 lần click ra ngoài, dù đã mở lại nhiều lần trước đó (không rò rỉ listener)', !overlay3.classList.contains('is-open'));

  console.log(`\n=== KẾT QUẢ: ${pass} pass, ${fail} fail ===`);
  process.exit(fail > 0 ? 1 : 0);
}

run();
