// ============================================================
// Test js/lunar-calendar.js — module thuần logic (không đụng DOM),
// chạy thẳng bằng Node, KHÔNG cần jsdom. Đối chiếu với dữ liệu THẬT
// (không phải tự bịa số mong đợi):
//   - 12 mốc "mùng 1 tháng âm lịch" của năm 2026, lấy trực tiếp từ ảnh
//     chụp Lịch macOS người dùng cung cấp lúc yêu cầu tính năng này.
//   - Tết Giáp Thìn 2024 (10/2/2024) và Tết Ất Tỵ 2025 (29/1/2025) —
//     2 mốc Tết công khai, nhiều nguồn xác nhận.
//   - Tên năm Can Chi 2026 = "Bính Ngọ", đúng như nhãn trong ảnh tham
//     khảo ("Bính Ngọ 2026").
//
// Chạy: node smoke-test-lunar-calendar.js (không cần cài gì thêm)
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/lunar-calendar.js'), 'utf8'), context, { filename: 'js/lunar-calendar.js' });
vm.runInContext('this.LunarCalendar = LunarCalendar;', context);
const LunarCalendar = context.LunarCalendar;

let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { pass++; console.log('  OK  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

console.log('=== 1. 12 mốc "mùng 1 tháng âm" năm 2026 (đối chiếu ảnh Lịch macOS) ===');
const expectedFirstDays2026 = [
  [19, 1], [17, 2], [19, 3], [17, 4], [17, 5], [15, 6],
  [14, 7], [13, 8], [11, 9], [10, 10], [9, 11], [9, 12]
];
expectedFirstDays2026.forEach(([dd, mm]) => {
  const l = LunarCalendar.toLunar(dd, mm, 2026);
  check(`${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/2026 là mùng 1 âm lịch (thực tế: ngày ${l.day})`, l.day === 1);
});

console.log('=== 2. Tết (mùng 1 tháng 1 âm lịch) — mốc công khai ===');
const tet2024 = LunarCalendar.toLunar(10, 2, 2024);
check('Tết Giáp Thìn: 10/02/2024 → mùng 1 tháng 1 âm lịch', tet2024.day === 1 && tet2024.month === 1);
const tet2025 = LunarCalendar.toLunar(29, 1, 2025);
check('Tết Ất Tỵ: 29/01/2025 → mùng 1 tháng 1 âm lịch', tet2025.day === 1 && tet2025.month === 1);
const tet2026 = LunarCalendar.toLunar(17, 2, 2026);
check('Tết Bính Ngọ: 17/02/2026 → mùng 1 tháng 1 âm lịch', tet2026.day === 1 && tet2026.month === 1);

console.log('=== 3. Tên năm Can Chi ===');
check('Năm âm lịch bắt đầu từ Tết 17/02/2026 là "Bính Ngọ" (khớp nhãn trong ảnh tham khảo)',
  LunarCalendar.canChiYear(tet2026.year) === 'Bính Ngọ');
check('Năm âm lịch bắt đầu từ Tết 10/02/2024 là "Giáp Thìn"', LunarCalendar.canChiYear(tet2024.year) === 'Giáp Thìn');
check('Năm âm lịch bắt đầu từ Tết 29/01/2025 là "Ất Tỵ"', LunarCalendar.canChiYear(tet2025.year) === 'Ất Tỵ');

console.log('=== 4. fromDateStr() — parse đúng định dạng dateStr của app (YYYY-MM-DD) ===');
const viaDateStr = LunarCalendar.fromDateStr('2026-02-17');
check('fromDateStr("2026-02-17") khớp toLunar(17,2,2026)',
  viaDateStr.day === tet2026.day && viaDateStr.month === tet2026.month && viaDateStr.year === tet2026.year);

console.log('=== 5. formatFull() — chuỗi hiển thị rõ ràng, không mơ hồ ===');
const fullStr = LunarCalendar.formatFull(tet2026);
check('Chứa đúng ngày', fullStr.includes('1/1'));
check('Chứa rõ chữ "âm lịch" (phân biệt với ngày dương)', fullStr.includes('âm lịch'));
check('Chứa tên năm Can Chi', fullStr.includes('Bính Ngọ'));

console.log('=== 6. Ngày liên tiếp phải tăng dần liên tục (không nhảy cóc/lặp) ===');
let prev = LunarCalendar.toLunar(1, 1, 2026);
let brokenSequence = false;
for (let d = 2; d <= 31; d++) {
  const cur = LunarCalendar.toLunar(d, 1, 2026);
  const sameMonth = cur.month === prev.month && cur.year === prev.year && !cur.isLeap === !prev.isLeap;
  const dayAdvancedByOne = cur.day === prev.day + 1;
  const rolledOverToNewMonth = cur.day === 1 && !sameMonth;
  if (!((sameMonth && dayAdvancedByOne) || rolledOverToNewMonth)) brokenSequence = true;
  prev = cur;
}
check('31 ngày liên tiếp của tháng 1/2026 (dương) cho ra chuỗi ngày âm liên tục, không lỗi', !brokenSequence);

console.log('');
console.log(`========== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ==========`);
process.exit(fail > 0 ? 1 : 0);
