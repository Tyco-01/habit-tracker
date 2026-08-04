// ============================================================
// Test cơ chế cảnh báo khi localStorage đầy (Sync.onSaveError).
// Mô phỏng localStorage.setItem ném QuotaExceededError, xác nhận:
//   1. persistLocal() không ném lỗi ra ngoài (không làm crash app)
//   2. onSaveError bắn đúng 'local_storage_full' khi lưu thất bại
//   3. Không bắn lặp lại nếu vẫn tiếp tục thất bại (chỉ báo 1 lần
//      khi CHUYỂN trạng thái, không spam mỗi lần ghi)
//   4. Bắn 'recovered' khi lưu lại thành công sau khi từng thất bại
// ============================================================

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dom = new JSDOM('<!DOCTYPE html><div id="app"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
const context = dom.window;
vm.createContext(context);

let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { pass++; console.log('  OK  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

const scripts = [
  'js/config.js', 'js/date-utils.js', 'js/dom-utils.js', 'js/storage-local.js',
  'js/sync/state.js', 'js/sync/queue.js', 'js/sync/mutations.js', 'js/sync/pull.js', 'js/sync/index.js'
];
scripts.forEach(f => {
  const code = fs.readFileSync(path.join(__dirname, f), 'utf8');
  vm.runInContext(code, context, { filename: f });
});
vm.runInContext('window.Sync = Sync; window.LocalStore = LocalStore;', context);
const { Sync, LocalStore } = dom.window;

// Override thẳng LocalStore.save — đây là object thường (không phải
// Storage "exotic object" như localStorage, vốn tự biến MỌI property
// gán vào thành 1 cặp key-value lưu trữ thay vì override hàm thật,
// theo đúng chuẩn Web Storage API mà JSDOM implement chính xác). Thử
// override localStorage.setItem trực tiếp đã KHÔNG hoạt động vì lý do
// này — bài học giữ lại trong comment để không lặp lại nhầm lẫn.
const realSave = LocalStore.save;
let shouldFail = true;
LocalStore.save = (data) => {
  if (shouldFail) return false;
  return realSave(data);
};

const events = [];
Sync.onSaveError(reason => events.push(reason));

console.log('=== Thêm 1 habit trong lúc localStorage đang "đầy" ===');
let threw = false;
try {
  Sync.addHabit('test habit');
} catch (e) {
  threw = true;
}
check('persistLocal() KHÔNG ném lỗi ra ngoài dù localStorage đầy (không crash app)', !threw);
check('onSaveError bắn đúng "local_storage_full"', events.includes('local_storage_full'));

console.log('=== Thêm tiếp 1 habit nữa, vẫn đang "đầy" ===');
const eventsCountBefore = events.length;
Sync.addHabit('test habit 2');
check('KHÔNG bắn lặp lại lần 2 khi vẫn đang thất bại (chỉ báo khi CHUYỂN trạng thái)', events.length === eventsCountBefore);

console.log('=== localStorage hết đầy, lưu lại thành công ===');
shouldFail = false;
Sync.addHabit('test habit 3');
check('Bắn "recovered" khi lưu lại thành công', events[events.length - 1] === 'recovered');

console.log('');
console.log(`========== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ==========`);
process.exit(fail > 0 ? 1 : 0);
