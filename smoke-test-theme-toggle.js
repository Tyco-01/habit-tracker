// ============================================================
// Test js/theme-toggle.js — không thuộc js/sync/ nên không bắt buộc
// theo quy tắc ở ARCHITECTURE.md mục 9, nhưng module có khá nhiều hàm
// logic thuần (đổi hex, tính độ tương phản WCAG, CRUD bộ sưu tập theme
// tuỳ chỉnh) dễ sai lệch 1 ký tự mà khó soát bằng mắt — viết test cho
// chắc, theo đúng khuôn các file smoke-test-*.js khác trong repo.
//
// Chạy: npm install jsdom --no-save && node smoke-test-theme-toggle.js
// (dọn lại sau: rm -rf node_modules package-lock.json)
// ============================================================

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dom = new JSDOM('<!DOCTYPE html><div id="app"></div><meta name="theme-color" content="#F5F1E8" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#1C1917" media="(prefers-color-scheme: dark)">', { url: 'http://localhost/', pretendToBeVisual: true });
const context = dom.window;
vm.createContext(context);

let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { pass++; console.log('  OK  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/theme-toggle.js'), 'utf8'), context, { filename: 'js/theme-toggle.js' });
vm.runInContext('window.ThemeToggle = ThemeToggle;', context);
const ThemeToggle = dom.window.ThemeToggle;

console.log('=== 1. hexToRgbTriplet (không export riêng — test gián tiếp qua apply()) ===');
const t1 = ThemeToggle.saveNewCustomTheme('Test hex', Object.assign(
  {}, ...ThemeToggle.VARS.map(v => ({ [v.key]: '#000000' })), { ink: '#2B2622' }
));
ThemeToggle.set('custom:' + t1.id);
check('--ink-rgb suy đúng từ --ink (#2B2622 → "43, 38, 34")',
  dom.window.document.documentElement.style.getPropertyValue('--ink-rgb').trim() === '43, 38, 34');
check('--ink được áp inline đúng giá trị', dom.window.document.documentElement.style.getPropertyValue('--ink').trim() === '#2B2622');
ThemeToggle.deleteCustomTheme(t1.id);

console.log('=== 2. contrastRatio (công thức WCAG) ===');
check('Đen vs Trắng ≈ 21 (tối đa)', Math.abs(ThemeToggle.contrastRatio('#000000', '#FFFFFF') - 21) < 0.1);
check('Cùng 1 màu = tỉ lệ 1 (không tương phản)', Math.abs(ThemeToggle.contrastRatio('#808080', '#808080') - 1) < 0.01);
check('Tỉ lệ đối xứng (a,b) = (b,a)', ThemeToggle.contrastRatio('#F5F1E8', '#2B2622') === ThemeToggle.contrastRatio('#2B2622', '#F5F1E8'));

console.log('=== 3. saveNewCustomTheme / listCustomThemes ===');
const before = ThemeToggle.listCustomThemes().length;
const vars = Object.assign({}, ...ThemeToggle.VARS.map(v => ({ [v.key]: '#123456' })));
const theme = ThemeToggle.saveNewCustomTheme('Hoàng hôn', vars);
check('Theme mới có id', typeof theme.id === 'string' && theme.id.length > 0);
check('Xuất hiện trong danh sách', ThemeToggle.listCustomThemes().some(t => t.id === theme.id));
check('Số lượng tăng đúng 1', ThemeToggle.listCustomThemes().length === before + 1);

console.log('=== 4. updateCustomTheme ===');
const updated = ThemeToggle.updateCustomTheme(theme.id, 'Hoàng hôn (đã sửa)', Object.assign({}, vars, { ink: '#ABCDEF' }));
check('updateCustomTheme trả về bản đã sửa', !!updated && updated.name === 'Hoàng hôn (đã sửa)');
check('Đã lưu lại đúng vào danh sách', ThemeToggle.listCustomThemes().find(t => t.id === theme.id).vars.ink === '#ABCDEF');
check('updateCustomTheme với id không tồn tại trả về null', ThemeToggle.updateCustomTheme('khong-ton-tai', 'x', vars) === null);

console.log('=== 5. get()/set() cho theme tuỳ chỉnh ===');
ThemeToggle.set('custom:' + theme.id);
check('get() trả về đúng mode custom:<id>', ThemeToggle.get() === 'custom:' + theme.id);
check('isCustomMode() nhận diện đúng', ThemeToggle.isCustomMode(ThemeToggle.get()) === true);
check('customIdOf() tách đúng id', ThemeToggle.customIdOf(ThemeToggle.get()) === theme.id);
check('data-theme bị gỡ khi dùng custom (áp qua inline style, không qua attribute)',
  !dom.window.document.documentElement.hasAttribute('data-theme'));

console.log('=== 6. apply() dọn sạch inline override khi chuyển sang light/dark ===');
ThemeToggle.set('dark');
check('Chuyển sang "dark" thì gỡ data-theme="dark"', dom.window.document.documentElement.getAttribute('data-theme') === 'dark');
check('--ink KHÔNG còn bị inline override sót lại từ theme tuỳ chỉnh trước đó',
  dom.window.document.documentElement.style.getPropertyValue('--ink') === '');
check('--ink-rgb cũng được dọn sạch', dom.window.document.documentElement.style.getPropertyValue('--ink-rgb') === '');

console.log('=== 7. deleteCustomTheme — rơi về "system" nếu đang xoá đúng theme đang dùng ===');
ThemeToggle.set('custom:' + theme.id);
check('Đang dùng đúng theme vừa tạo', ThemeToggle.get() === 'custom:' + theme.id);
ThemeToggle.deleteCustomTheme(theme.id);
check('Sau khi xoá, không còn trong danh sách', !ThemeToggle.listCustomThemes().some(t => t.id === theme.id));
check('Rơi về "system" vì vừa xoá đúng theme đang active', ThemeToggle.get() === 'system');

console.log('=== 8. get() tự phục hồi nếu mode trỏ tới theme đã bị xoá bằng cách khác (vd tab khác) ===');
const t2 = ThemeToggle.saveNewCustomTheme('Tạm', vars);
ThemeToggle.set('custom:' + t2.id);
// Xoá thẳng khỏi localStorage mà KHÔNG qua deleteCustomTheme() — mô
// phỏng dữ liệu bị xoá từ nơi khác (tab khác, hoặc user xoá thủ công).
dom.window.localStorage.setItem('habit-tracker-custom-themes', '[]');
check('get() không kẹt ở 1 custom theme không còn tồn tại, tự rơi về "system"', ThemeToggle.get() === 'system');

console.log('');
console.log(`========== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ==========`);
process.exit(fail > 0 ? 1 : 0);
