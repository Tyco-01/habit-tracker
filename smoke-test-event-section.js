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
allDates.forEach((d, idx) => {
  const id = 'seed_' + idx;
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
const firstDot = container.querySelector('.event-timeline-item:first-of-type .event-timeline-dot');
check('Chấm đầu tiên (mới nhất) có class "latest"', firstDot && firstDot.classList.contains('latest'));

// ---- Test 5: nút "+ Thêm" mở khối, đổi thành "Đóng", có class active ----
const addBtn = container.querySelector('#today-event-add-btn');
const addRow = container.querySelector('#today-event-input-row');
check('Khối input mặc định ẨN', !addRow.classList.contains('is-open'));
addBtn.click();
check('Sau khi bấm "+ Thêm", khối input HIỆN', addRow.classList.contains('is-open'));
check('Nút đổi chữ thành "Đóng"', addBtn.textContent.trim().includes('Đóng'));
check('Nút có class "active" (fill đen cố định)', addBtn.classList.contains('active'));

// ---- Test 6: chip gợi ý hiện NGAY (không cần gõ), và LỌC tên đã có hôm nay ----
// Label "hoặc chạm để dùng lại" đã bỏ (dư thừa với project chỉ 1
// người dùng) — giờ chỉ còn kiểm tra bản thân chip có hiện đúng.
const suggestBox = container.querySelector('#today-event-dropdown');
check('Khối gợi ý hiện block chip (display: block)', suggestBox.style.display === 'block');
const chips = suggestBox.querySelectorAll('[data-suggest]');
check('Chip "habit tracker" bị LỌC KHỎI gợi ý (đã có trong dấu ấn hôm nay)',
  ![...chips].some(c => c.dataset.suggest === 'habit tracker'));

// ---- Test 7: thêm 1 dấu ấn tên mới qua ô input, khối tự đóng lại ----
const input = container.querySelector('#today-event-input');
const saveBtn = container.querySelector('#today-event-save');
input.value = 'cắt tóc';
saveBtn.click();
check('Dấu ấn mới "cắt tóc" đã được thêm vào data thật', Sync.getData().events[todayKey].some(e => e.name === 'cắt tóc'));
check('Sau khi Lưu, khối input tự ĐÓNG lại', !addRow.classList.contains('is-open'));
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
check('Bấm chip xong, khối tự ĐÓNG lại', !addRow.classList.contains('is-open'));

// ---- Test 9: chạy render() nhiều lần liên tiếp (mô phỏng chuyển tab qua lại) — không cộng dồn listener ----
// Dùng thẳng Sync._listenerCount() (API debug nội bộ, xem cuối sync.js)
// để đo CHÍNH XÁC, thay vì đo gián tiếp qua hành vi UI.
// Số ổn định đúng giờ là 2 (không phải 1): drawEvents + drawSuggestions
// (thêm sau, để chip gợi ý tự đồng bộ real-time — xem event-section.js),
// mỗi cái đăng ký đúng 1 lần qua idPrefix riêng, gỡ listener cũ trước
// khi đăng ký cái mới ở mỗi lần render().
const listenersBefore = Sync._listenerCount();
for (let i = 0; i < 5; i++) {
  EventSection.render(container, todayKey, { idPrefix: 'today', showHistory: true });
}
const listenersAfter = Sync._listenerCount();
check('render() gọi lại 5 lần liên tiếp KHÔNG làm listener cộng dồn (vẫn đúng 2, không phải 12)',
  listenersAfter === 2 && listenersAfter === listenersBefore);

// ---- Test 10: chip gợi ý tự đồng bộ real-time khi khối ĐANG MỞ SẴN ----
// Đây đúng là bug đã sửa: trước đây drawSuggestions() chỉ chạy 1 lần
// lúc bấm "+ Thêm", không nghe Sync.onChange — nên nếu có dấu ấn mới
// xuất hiện trong khi khối đang mở sẵn (không đóng/mở lại), chip cũ
// vẫn còn nguyên, không phản ánh đúng dữ liệu thật.
Sync.getData().events[todayKey] = Sync.getData().events[todayKey].filter(e => e.name !== 'zzz-test-sync');
const addBtn2 = container.querySelector('#today-event-add-btn');
if (addBtn2.classList.contains('active')) addBtn2.click(); // đảm bảo đóng trước
addBtn2.click(); // mở khối, không đóng lại nữa trong suốt test này
const chipsBeforeSync = container.querySelectorAll('[data-suggest]');
check('Trước khi có thay đổi ngoài, chip "zzz-test-sync" CHƯA xuất hiện',
  ![...chipsBeforeSync].some(c => c.dataset.suggest === 'zzz-test-sync'));
// Mô phỏng 1 dấu ấn mới được ghi nhận ở NGÀY KHÁC (không phải hôm nay)
// bằng chính API thật Sync.addEvent — đây là nguồn tạo ra tên mới cho
// allEventNames(), đúng đường đi thật của app chứ không chỉnh thẳng
// object dữ liệu để giả lập.
Sync.addEvent(pastDates[1], 'zzz-test-sync');
const chipsAfterSync = container.querySelectorAll('[data-suggest]');
check('Khối ĐANG MỞ SẴN tự cập nhật, chip "zzz-test-sync" xuất hiện KHÔNG CẦN đóng/mở lại',
  [...chipsAfterSync].some(c => c.dataset.suggest === 'zzz-test-sync'));
addBtn2.click(); // đóng lại, dọn trạng thái cho test sau

// ---- Test 11: gõ tay TRÙNG tên đã có hôm nay KHÔNG được tạo bản sao ----
// Đây đúng là bug đã báo và tái hiện được: trước sửa, chip gợi ý có
// lọc tên trùng nhưng Ô NHẬP TAY thì không — gõ đúng tên 1 dấu ấn đã
// ghi nhận hôm nay vẫn tạo ra 1 event object MỚI (id khác) trùng tên,
// khiến UI hiện 2 khối "dấu ấn" giống hệt nhau cho cùng 1 sự việc
// (đúng như ảnh chụp màn hình người dùng gửi: 2 khối "habit tracker").
const countBeforeDup = Sync.getData().events[todayKey].length;
const addBtn3 = container.querySelector('#today-event-add-btn');
const addRow3 = container.querySelector('#today-event-input-row');
const input3 = container.querySelector('#today-event-input');
const saveBtn3 = container.querySelector('#today-event-save');
addBtn3.click();
input3.value = 'habit tracker'; // tên NÀY đã có trong dữ liệu hôm nay (test 8 vừa ghi lại)
saveBtn3.click();
const countAfterDup = Sync.getData().events[todayKey].length;
check('Gõ tay tên TRÙNG hôm nay KHÔNG tạo thêm event object mới (số lượng không đổi)',
  countAfterDup === countBeforeDup);
check('Sau khi gõ trùng, khối input vẫn tự ĐÓNG lại (coi như đã chọn cái có sẵn)',
  !addRow3.classList.contains('is-open'));
const eventRowsAfterDup = container.querySelectorAll('.event-row');
check('UI CHỈ hiện 1 khối "habit tracker" cho hôm nay, không nhân đôi',
  [...eventRowsAfterDup].filter(r => r.querySelector('.event-name').textContent === 'habit tracker').length === 1);

// Gõ tay khác HOA/THƯỜNG và thừa khoảng trắng cũng phải bị chặn trùng
// — không so sánh tuyệt đối chuỗi, để tránh lách qua bằng cách gõ
// "Habit Tracker " thay vì "habit tracker".
addBtn3.click();
input3.value = '  Habit Tracker  ';
saveBtn3.click();
const countAfterCaseDup = Sync.getData().events[todayKey].length;
check('Gõ trùng tên khác HOA/THƯỜNG + thừa khoảng trắng vẫn bị chặn (không tạo bản sao)',
  countAfterCaseDup === countBeforeDup);

// ---- Test 12: nút SỬA TÊN đổi tên CẢ CHUỖI lịch sử (mọi ngày) ----
// Dữ liệu seed ban đầu có 7 event "habit tracker" ở 7 ngày khác nhau
// (pastDates + hôm nay) — bấm sửa tên ở khối hôm nay phải đổi cả 7,
// không chỉ đúng event của hôm nay, để timeline không bị tách chuỗi.
// Lấy id hiện tại của event "habit tracker" hôm nay TRỰC TIẾP từ data
// thật tại thời điểm này (không dùng id seed ban đầu) — vì test 8 đã
// xoá rồi thêm LẠI event này qua chip, nên nó mang id MỚI (tempId())
// khác hẳn id lúc seed.
const todayEventId = Sync.getData().events[todayKey].find(e => e.name === 'habit tracker').id;
const editBtn = container.querySelector(`[data-event-edit="${todayEventId}"]`);
check('Nút sửa tên (bút chì) tồn tại trên UI', !!editBtn);
editBtn.click();
const nameInput = container.querySelector(`[data-event-name-edit="${todayEventId}"]`);
check('Bấm nút sửa tên → ô input inline hiện ra', nameInput.style.display !== 'none');
nameInput.value = 'thói quen theo dõi';
nameInput.dispatchEvent(new dom.window.Event('blur'));

const countRenamedTotal = Object.values(Sync.getData().events)
  .flat()
  .filter(e => e.name === 'thói quen theo dõi').length;
const countOldNameLeft = Object.values(Sync.getData().events)
  .flat()
  .filter(e => e.name === 'habit tracker').length;
check('Đổi tên áp dụng CẢ 7 event trong chuỗi (mọi ngày), không chỉ hôm nay',
  countRenamedTotal === 7);
check('Không còn event nào giữ tên cũ "habit tracker" sau khi đổi',
  countOldNameLeft === 0);

// ---- Test 13: sửa tên KHÔNG được trùng với dấu ấn KHÁC đã có CÙNG NGÀY ----
// Nếu không chặn, sẽ tạo ra 2 event object cùng ngày cùng tên — đúng
// lỗi trùng tên đã sửa ở submitEvent (test 11), chỉ khác đường đi.
// Thêm 1 dấu ấn khác tên vào hôm nay để có cái mà đổi tên trùng vào.
Sync.addEvent(todayKey, 'zzz-other-today');
EventSection.render(container, todayKey, { idPrefix: 'today', showHistory: true });
const renamedEventId = Sync.getData().events[todayKey].find(e => e.name === 'thói quen theo dõi').id;
const editBtn2 = container.querySelector(`[data-event-edit="${renamedEventId}"]`);
editBtn2.click();
const nameInput2 = container.querySelector(`[data-event-name-edit="${renamedEventId}"]`);
nameInput2.value = 'zzz-other-today'; // trùng với dấu ấn KHÁC đã có hôm nay
nameInput2.dispatchEvent(new dom.window.Event('blur'));
const stillOldName = Sync.getData().events[todayKey].find(e => e.id === renamedEventId).name;
check('Sửa tên trùng với dấu ấn KHÁC cùng ngày bị CHẶN (tên giữ nguyên, không đổi)',
  stillOldName === 'thói quen theo dõi');

console.log('');
console.log(`========== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ==========`);
process.exit(fail > 0 ? 1 : 0);
