// ============================================================
// Test mô phỏng "mất mạng giữa chừng" trong flushQueue() — đúng
// kịch bản bug đã từng xảy ra và được sửa (xem ARCHITECTURE.md mục
// 5, "Bài học từ bug đã sửa"). Viết lại test này sau khi sửa
// flushQueue() (thêm kiểm tra kết quả saveQueue) để xác nhận thay
// đổi không vô tình phá lại behavior đã sửa trước đó.
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

// Mock Auth và SupabaseClient TRƯỚC khi nạp sync.js (sync.js chỉ gọi
// chúng lúc runtime bên trong hàm, không phải lúc load module, nên
// thứ tự nạp trước/sau ở đây không quan trọng — nhưng gán trước cho rõ ràng).
vm.runInContext(`
  const Auth = { currentToken: () => 'fake-token-123', isLoggedIn: () => true };
  window.Auth = Auth;
`, context);

const scripts = ['js/config.js', 'js/date-utils.js', 'js/dom-utils.js', 'js/storage-local.js'];
scripts.forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), context, { filename: f });
});

// Mock SupabaseClient.rpc — item đầu THÀNH CÔNG, item thứ 2 NÉM LỖI
// MẠNG (isNetworkError=true, đúng cách supabase-client.js thật báo
// lỗi khi fetch() tự nó throw), item thứ 3 sẽ KHÔNG BAO GIỜ được xử
// lý tới (vì lỗi mạng ở item 2 phải làm dừng toàn bộ vòng lặp) —
// nhưng vẫn phải được GIỮ LẠI trong hàng đợi, không được mất.
let callLog = [];
vm.runInContext(`
  const SupabaseClient = {
    rpc: async (fnName, params) => {
      window.__callLog.push({ fnName, params });
      if (params.p_name === 'habit-2-mất-mạng') {
        const err = new Error('network_error');
        err.isNetworkError = true;
        throw err;
      }
      return 'server-id-' + params.p_name;
    }
  };
  window.SupabaseClient = SupabaseClient;
`, context);
context.__callLog = callLog;

vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/sync/state.js'), 'utf8'), context, { filename: 'js/sync/state.js' });
vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/sync/queue.js'), 'utf8'), context, { filename: 'js/sync/queue.js' });
vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/sync/mutations.js'), 'utf8'), context, { filename: 'js/sync/mutations.js' });
vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/sync/pull.js'), 'utf8'), context, { filename: 'js/sync/pull.js' });
vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/sync/index.js'), 'utf8'), context, { filename: 'js/sync/index.js' });
vm.runInContext('window.Sync = Sync; window.LocalStore = LocalStore;', context);
const { Sync, LocalStore } = dom.window;

console.log('=== Chuẩn bị hàng đợi 3 thao tác add_habit ===');
const queue = [
  { id: 'q1', type: 'add_habit', payload: { habitId: 'tmp_1', name: 'habit-1-ok' } },
  { id: 'q2', type: 'add_habit', payload: { habitId: 'tmp_2', name: 'habit-2-mất-mạng' } },
  { id: 'q3', type: 'add_habit', payload: { habitId: 'tmp_3', name: 'habit-3-chưa-kịp-xử-lý' } }
];
LocalStore.saveQueue(queue);

console.log('=== Chạy flushQueue() thật (đã sửa) ===');
// flushQueue không nằm trong export công khai của Sync (đúng thiết
// kế — nó tự chạy qua setInterval/online listener bên trong module,
// xem ARCHITECTURE.md). Gọi gián tiếp qua sự kiện 'online' mà chính
// js/sync/queue.js đã tự đăng ký lúc module load (window.addEventListener
// ('online', () => flushQueue())) — đây là cách DUY NHẤT kích hoạt nó
// từ bên ngoài mà không phải export thêm 1 API chỉ để phục vụ test.
dom.window.dispatchEvent(new dom.window.Event('online'));

// flushQueue là async — đợi đủ lâu để chắc chắn nó chạy xong trước khi kiểm tra.
setTimeout(() => {
  console.log('=== Kiểm tra kết quả ===');
  check('Item 1 (thành công) đã được gọi RPC', callLog.some(c => c.params.p_name === 'habit-1-ok'));
  check('Item 2 (mất mạng) đã được thử gọi RPC', callLog.some(c => c.params.p_name === 'habit-2-mất-mạng'));
  check('Item 3 KHÔNG được gọi RPC (dừng lại đúng lúc gặp lỗi mạng)', !callLog.some(c => c.params.p_name === 'habit-3-chưa-kịp-xử-lý'));

  const remainingQueue = LocalStore.loadQueue();
  const remainingIds = remainingQueue.map(e => e.id);
  check('Item 1 (thành công) đã bị XOÁ khỏi hàng đợi', !remainingIds.includes('q1'));
  check('Item 2 (đang lỗi) vẫn còn trong hàng đợi để thử lại', remainingIds.includes('q2'));
  check('Item 3 (CHƯA kịp xử lý) vẫn còn trong hàng đợi — ĐÂY LÀ BUG ĐÃ SỬA, không được để rơi mất', remainingIds.includes('q3'));
  check('Hàng đợi còn lại đúng 2 item (không thừa, không thiếu)', remainingQueue.length === 2);

  console.log('');
  console.log(`========== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ==========`);
  process.exit(fail > 0 ? 1 : 0);
}, 200);
