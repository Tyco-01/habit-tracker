// Regression test: a rapid duplicate mutation must leave one local habit and
// one sync-queue entry. Run with: node smoke-test-duplicate-habit.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const storage = new Map();
const context = {
  console,
  Date,
  Math,
  JSON,
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  navigator: { onLine: false },
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
  },
  addEventListener: () => {},
  Auth: { currentToken: () => null }
};
context.window = context;
vm.createContext(context);
let passed = 0;
function check(label, condition) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  passed++;
  console.log(`  OK  ${label}`);
}

['js/config.js', 'js/date-utils.js', 'js/storage-local.js', 'js/sync/state.js', 'js/sync/queue.js', 'js/sync/mutations.js', 'js/sync/pull.js', 'js/sync/index.js']
  .forEach(file => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file }));

const Sync = vm.runInContext('Sync', context);
const LocalStore = vm.runInContext('LocalStore', context);
console.log('=== Kiểm tra chặn tạo habit trùng ===');
const first = Sync.addHabit('  Tập   thể dục ');
const second = Sync.addHabit('tập thể dục');
check('Lần gọi lặp trả về cùng habit', first.id === second.id);
check('Chỉ có một habit cục bộ', Sync.getData().habits.length === 1);
const adds = LocalStore.loadQueue().filter(entry => entry.type === 'add_habit');
check('Chỉ có một thao tác add trong hàng đợi đồng bộ', adds.length === 1);
check('Tên hợp lệ vẫn được giữ nguyên cho người dùng', Sync.getData().habits[0].name === 'Tập   thể dục');
// This must still be deduplicated after the short rapid-submit window.
const originalNow = Date.now;
Date.now = () => originalNow() + 5000;
const third = Sync.addHabit('TẬP THỂ DỤC');
Date.now = originalNow;
check('Trùng tên sau thời gian dài vẫn trỏ tới habit đang có', third.id === first.id);
check('Không có queue entry trùng sau thời gian dài', LocalStore.loadQueue().filter(entry => entry.type === 'add_habit').length === 1);
const meditation = Sync.addHabit('Thiền');
check('Không cho đổi tên thành task đang tồn tại', Sync.renameHabit(meditation.id, 'tập thể dục') === false);
check('Không tạo parent tự tham chiếu', Sync.setHabitParent(meditation.id, meditation.id) === false);
Sync.reorderHabits(['id-không-tồn-tại', meditation.id]);
check('Reorder payload cũ không làm mất task', Sync.getData().habits.length === 2);
console.log(`========== KẾT QUẢ: ${passed} PASS ==========`);
