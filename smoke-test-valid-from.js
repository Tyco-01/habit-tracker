// ============================================================
// Test tính năng "phạm vi áp dụng" (validFrom/validTo) — xem
// js/habit-scope.js và ARCHITECTURE.md mục "9. Nếu muốn nhờ người
// khác sửa tiếp": mọi thay đổi trong js/sync/ đều PHẢI có test xác
// minh, không chỉ đọc code bằng mắt. Bài test này bao phủ:
//   1. addHabit() tự gán validFrom = hôm nay (fix bug gốc — habit mới
//      không ảnh hưởng ngày quá khứ).
//   2. HabitScope.habitsForDate() loại đúng habit theo validFrom, và
//      COI HABIT THIẾU validFrom LÀ "LUÔN HỢP LỆ" (tương thích ngược
//      với dữ liệu cũ trước khi tính năng này tồn tại).
//   3. archive/restore CARRY OVER validFrom đúng cả 2 chiều.
//   4. applySetCheck cho phép tick CẢ habit đã archive.
//   5. removeHabit() mặc định validTo = hôm nay khi không truyền gì
//      (không đụng lịch sử — tương đương hành vi archive cũ).
//   6. removeHabit(id, ngày quá khứ) — "Xoá cả quá khứ": validTo lùi
//      về quá khứ, HabitScope tính đúng mốc CUỐI CÙNG còn hoạt động,
//      loại đúng những ngày SAU mốc đó (kể cả hôm nay).
//   7. Habit archive TỪ TRƯỚC khi có validTo (dữ liệu cũ, chỉ có
//      archivedAt) — HabitScope dùng archivedAt làm mốc thay thế,
//      giữ nguyên hành vi cũ.
//   8. setHabitValidFrom() cập nhật đúng + queue đúng payload (kể cả
//      null = "không giới hạn").
//   9. Hàng đợi đồng bộ: add_habit gửi kèm p_valid_from lên RPC; sau
//      khi remap id tạm → id thật, entry set_habit_valid_from CHƯA
//      gửi vẫn được cập nhật đúng habitId (đúng bug lớp
//      remapHabitIdInQueue đã có từ trước — set_habit_valid_from là
//      loại entry MỚI, dễ bị quên thêm vào đó).
//
// Chạy: npm install jsdom --no-save && node smoke-test-valid-from.js
// (dọn lại sau: rm -rf node_modules package-lock.json)
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

vm.runInContext(`
  const Auth = { currentToken: () => 'fake-token-123', isLoggedIn: () => true };
  window.Auth = Auth;
`, context);

['js/config.js', 'js/date-utils.js', 'js/dom-utils.js', 'js/habit-scope.js', 'js/storage-local.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), context, { filename: f }));

// Mock SupabaseClient — ghi lại mọi lời gọi RPC để kiểm tra payload gửi
// lên, KHÔNG gọi mạng thật. add_habit trả về 1 id "server" giả để test
// remap id tạm → id thật.
let callLog = [];
vm.runInContext(`
  const SupabaseClient = {
    rpc: async (fnName, params) => {
      window.__callLog.push({ fnName, params });
      if (fnName === 'add_habit') return 'server-id-1';
      return null;
    }
  };
  window.SupabaseClient = SupabaseClient;
`, context);
context.__callLog = callLog;

['js/sync/state.js', 'js/sync/queue.js', 'js/sync/mutations.js', 'js/sync/pull.js', 'js/sync/index.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), context, { filename: f }));

vm.runInContext('window.Sync = Sync; window.LocalStore = LocalStore; window.DateUtils = DateUtils; window.HabitScope = HabitScope;', context);
const { Sync, LocalStore, DateUtils, HabitScope } = dom.window;

const todayKey = DateUtils.dateKey(new Date());
const pastKey = '2000-01-01'; // chắc chắn trước bất kỳ hôm nay thật nào

console.log('=== 1. addHabit() tự gán validFrom = hôm nay ===');
const habit = Sync.addHabit('Tập thể dục');
check('validFrom = hôm nay', habit.validFrom === todayKey);

console.log('=== 2. HabitScope.habitsForDate loại đúng theo validFrom ===');
const dataAfterAdd = Sync.getData();
const scopedPast = HabitScope.habitsForDate(pastKey, dataAfterAdd);
const scopedToday = HabitScope.habitsForDate(todayKey, dataAfterAdd);
check('Habit KHÔNG tính vào ngày trước khi tạo (fix bug gốc)', !scopedPast.some(h => h.id === habit.id));
check('Habit CÓ tính vào đúng ngày tạo', scopedToday.some(h => h.id === habit.id));

console.log('=== 2b. Habit thiếu validFrom (dữ liệu cũ) luôn được coi là hợp lệ ===');
const legacyHabit = { id: 'legacy-1', name: 'Habit cũ trước khi có tính năng này' };
check('Habit không có validFrom vẫn tính vào ngày rất xa trong quá khứ',
  HabitScope.isActiveOn(pastKey, legacyHabit) === true);

console.log('=== 3. Archive/restore carry-over validFrom ===');
Sync.removeHabit(habit.id);
const afterArchive = Sync.getData().archivedHabits.find(h => h.id === habit.id);
check('Archive giữ nguyên validFrom', !!afterArchive && afterArchive.validFrom === todayKey);
const scopedTodayAfterArchive = HabitScope.habitsForDate(todayKey, Sync.getData());
check('HabitScope vẫn tính habit đã archive vào ĐÚNG ngày nó còn hoạt động',
  scopedTodayAfterArchive.some(h => h.id === habit.id));
check('HabitScope KHÔNG tính habit đã archive vào ngày rất xa trong quá khứ (trước cả archivedAt lẫn validFrom)',
  !HabitScope.habitsForDate(pastKey, Sync.getData()).some(h => h.id === habit.id));

Sync.restoreHabit(habit.id);
const afterRestore = Sync.getData().habits.find(h => h.id === habit.id);
check('Restore trả lại đúng validFrom', !!afterRestore && afterRestore.validFrom === todayKey);

console.log('=== 4. applySetCheck cho phép tick habit đã archive ===');
Sync.removeHabit(habit.id);
const tickOk = Sync.setCheck(habit.id, todayKey, true);
check('setCheck() trả về true (KHÔNG bị chặn) cho habit đã archive', tickOk === true);
check('Check thật sự được ghi lại', !!(Sync.getData().checks[habit.id] && Sync.getData().checks[habit.id][todayKey]));
Sync.restoreHabit(habit.id);

console.log('=== 5. removeHabit() mặc định validTo = hôm nay (không đụng lịch sử) ===');
Sync.removeHabit(habit.id); // không truyền validTo — phải tự mặc định hôm nay
const afterArchiveDefault = Sync.getData().archivedHabits.find(h => h.id === habit.id);
check('archivedHabits có validTo = hôm nay khi không truyền gì', !!afterArchiveDefault && afterArchiveDefault.validTo === todayKey);
Sync.restoreHabit(habit.id);

console.log('=== 6. removeHabit(id, ngày quá khứ) — "Xoá cả quá khứ" ===');
// Đặt validFrom lùi hẳn về quá khứ TRƯỚC, để có "khoảng trống" giữa
// validFrom và hôm nay cho stopKey nằm vào giữa (nếu không, validFrom
// mặc định = hôm nay sẽ khiến mọi stopKey trong quá khứ trở thành
// khoảng RỖNG — validFrom > validTo — vô nghĩa để kiểm tra).
Sync.setHabitValidFrom(habit.id, pastKey);
const stopKey = '2020-06-15'; // nằm giữa pastKey (2000) và hôm nay
Sync.removeHabit(habit.id, stopKey);
const afterArchivePast = Sync.getData().archivedHabits.find(h => h.id === habit.id);
check('archivedHabits.validTo = đúng ngày đã chọn (không phải hôm nay)', !!afterArchivePast && afterArchivePast.validTo === stopKey);
const dataAfterPastArchive = Sync.getData();
check('HabitScope VẪN tính habit vào đúng ngày ngừng (validTo là ngày CUỐI CÙNG còn tính)',
  HabitScope.habitsForDate(stopKey, dataAfterPastArchive).some(h => h.id === habit.id));
check('HabitScope KHÔNG còn tính habit vào ngày NGAY SAU mốc ngừng',
  !HabitScope.habitsForDate(DateUtils.addDays(stopKey, 1), dataAfterPastArchive).some(h => h.id === habit.id));
check('HabitScope KHÔNG tính habit vào HÔM NAY nữa (đã ngừng từ lâu — khác hẳn hành vi archivedAt cũ, vốn vẫn tính tới lúc bấm xoá)',
  !HabitScope.habitsForDate(todayKey, dataAfterPastArchive).some(h => h.id === habit.id));

Sync.restoreHabit(habit.id);
Sync.setHabitValidFrom(habit.id, null); // dọn lại "không giới hạn" cho gọn trước khi qua test khác

console.log('=== 7. Habit archive TỪ TRƯỚC khi có validTo (dữ liệu cũ) — dùng archivedAt làm mốc thay thế ===');
const legacyArchived = { id: 'legacy-archived-1', name: 'Habit đã archive trước khi có validTo', archivedAt: new Date('2024-03-10').getTime() };
check('Không có validTo → habit vẫn tính tới ĐÚNG ngày archivedAt', HabitScope.isActiveOn('2024-03-10', legacyArchived) === true);
check('Không có validTo → habit KHÔNG còn tính vào ngày sau archivedAt', HabitScope.isActiveOn('2024-03-11', legacyArchived) === false);

console.log('=== 8. setHabitValidFrom() ===');
const changed = Sync.setHabitValidFrom(habit.id, pastKey);
check('setHabitValidFrom trả về true', changed === true);
check('validFrom đã đổi trong data cục bộ', Sync.getData().habits.find(h => h.id === habit.id).validFrom === pastKey);
const queueEntry = LocalStore.loadQueue().find(e => e.type === 'set_habit_valid_from' && e.payload.habitId === habit.id);
check('Hàng đợi có entry set_habit_valid_from đúng payload', !!queueEntry && queueEntry.payload.validFrom === pastKey);

const unlimitedOk = Sync.setHabitValidFrom(habit.id, null);
check('setHabitValidFrom(null) = "không giới hạn" hoạt động đúng', unlimitedOk === true && Sync.getData().habits.find(h => h.id === habit.id).validFrom === null);

console.log('=== 9. Hàng đợi đồng bộ: add_habit/archive_habit gửi đúng payload + remap id tạm ===');
LocalStore.clearQueue();
callLog.length = 0;
const habit2 = Sync.addHabit('Việc thứ 2 (test remap)');
const tempId2 = habit2.id; // giữ lại id TẠM để so sánh — sau flush, data cục bộ sẽ đổi sang id thật
// enqueue set_habit_valid_from NGAY (còn mang id tạm) — mô phỏng đúng
// kịch bản "add rồi sửa liền, chưa kịp đồng bộ add trước" đã có sẵn
// cơ chế xử lý cho set_check/rename_habit/... (xem remapHabitIdInQueue
// trong queue.js) — set_habit_valid_from là loại entry MỚI thêm vào
// đó, đây chính là điều bài test này xác minh.
Sync.setHabitValidFrom(tempId2, pastKey);
// Cũng enqueue archive_habit NGAY sau đó (vẫn còn id tạm) — kiểm tra
// remapHabitIdInQueue không bỏ sót loại entry này (archive_habit vốn
// đã tồn tại từ trước, nhưng payload giờ có thêm field validTo — xác
// nhận field đó cũng sống sót qua remap, không bị rớt mất).
Sync.removeHabit(tempId2, stopKey);

dom.window.dispatchEvent(new dom.window.Event('online'));

setTimeout(() => {
  const addCall = callLog.find(c => c.fnName === 'add_habit' && c.params.p_name === 'Việc thứ 2 (test remap)');
  check('add_habit gửi kèm p_valid_from lên server', !!addCall && addCall.params.p_valid_from === todayKey);

  // Nếu remapHabitIdInQueue QUÊN xử lý 'set_habit_valid_from' (đúng bug
  // dạng đã từng xảy ra với các loại entry khác trước đây — xem
  // ARCHITECTURE.md mục 5), entry này sẽ gửi lên server với ID TẠM đã
  // hết hạn (tmp_...), server sẽ không tìm thấy habit đó. Kiểm tra
  // ĐÚNG id được gửi lên là bằng chứng trực tiếp remap đã chạy đúng.
  const validFromCall = callLog.find(c => c.fnName === 'update_habit_valid_from');
  check('update_habit_valid_from ĐÃ được gọi (không bị treo chờ mãi vì tưởng habit chưa sync)', !!validFromCall);
  check('update_habit_valid_from gửi ĐÚNG id thật sau remap (server-id-1), KHÔNG còn id tạm', !!validFromCall && validFromCall.params.p_habit_id === 'server-id-1');

  const archiveCall = callLog.find(c => c.fnName === 'remove_habit');
  check('remove_habit ĐÃ được gọi (cùng lý do remap ở trên)', !!archiveCall);
  check('remove_habit gửi ĐÚNG id thật sau remap', !!archiveCall && archiveCall.params.p_habit_id === 'server-id-1');
  check('remove_habit gửi kèm p_valid_to đúng ngày đã chọn', !!archiveCall && archiveCall.params.p_valid_to === stopKey);

  check('id tạm cũ không còn xuất hiện trong bất kỳ lời gọi nào', !callLog.some(c => JSON.stringify(c.params).includes(tempId2)));

  // Xác nhận fix remapHabitId (phát hiện lúc viết test này): dữ liệu
  // CỤC BỘ (archivedHabits) cũng phải đổi sang id thật, không chỉ
  // payload gửi lên server.
  const localArchived = Sync.getData().archivedHabits.find(h => h.name === 'Việc thứ 2 (test remap)');
  check('archivedHabits cục bộ cũng đổi sang id thật (không còn kẹt id tạm)', !!localArchived && localArchived.id === 'server-id-1');

  console.log('');
  console.log(`========== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ==========`);
  process.exit(fail > 0 ? 1 : 0);
}, 200);
