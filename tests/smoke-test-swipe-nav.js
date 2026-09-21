// ============================================================
// tests/smoke-test-swipe-nav.js — Kiểm tra js/swipe-nav.js (VIẾT LẠI
// dùng Touch Events thuần, thay bản cũ dùng Pointer Events +
// setPointerCapture + stopPropagation — xem ARCHITECTURE.md mục 8 để
// đọc lịch sử đầy đủ vì sao viết lại).
//
// JSDOM không có layout thật (getBoundingClientRect luôn trả 0) nên
// không test được animation theo tay bằng toạ độ thật — bài test này
// tập trung vào ĐÚNG LOGIC: khoá hướng ngang/dọc, ngưỡng commit, gọi
// đúng callback đúng lúc (onDrag liên tục, onCommit khi đủ ngưỡng,
// onCancel khi chưa đủ, shouldIgnore loại trừ đúng target).
// ============================================================

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dom = new JSDOM('<!DOCTYPE html><div id="outer"><div id="inner"></div></div>', {
  url: 'http://localhost/',
  pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;

const vmctx = dom.window;
vm.createContext(vmctx);
const code = fs.readFileSync(path.join(__dirname, '..', 'js/swipe-nav.js'), 'utf8');
vm.runInContext(code, vmctx, { filename: 'swipe-nav.js' });
vm.runInContext('window.SwipeNav = SwipeNav;', vmctx);
const { SwipeNav } = dom.window;

let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { pass++; console.log('  OK  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

// Giả lập TouchEvent — JSDOM không có TouchEvent/Touch built-in đầy
// đủ ở mọi bản, tự dựng object tối giản đủ dùng (chỉ cần .touches[0]
// .clientX/.clientY và .preventDefault()).
function fireTouch(el, type, points) {
  const touches = points.map(p => ({ clientX: p.x, clientY: p.y }));
  const ev = new dom.window.Event(type, { bubbles: true, cancelable: true });
  ev.touches = touches;
  el.dispatchEvent(ev);
  return ev;
}

console.log('=== Vuốt trái đủ ngưỡng (>=55px) kích hoạt onCommit(-1) ===');
const el1 = document.getElementById('outer');
const log1 = [];
SwipeNav.bind(el1, {
  onDrag: (dx) => log1.push('drag:' + dx),
  onCommit: (dir) => log1.push('commit:' + dir),
  onSettle: () => log1.push('settle'),
  onCancel: () => log1.push('cancel')
});
fireTouch(el1, 'touchstart', [{ x: 300, y: 50 }]);
[270, 240, 210, 180, 150, 120, 90, 60, 40].forEach(x => fireTouch(el1, 'touchmove', [{ x, y: 50 }]));
fireTouch(el1, 'touchend', []);
check('onCommit(-1) được gọi (vuốt trái = dx âm)', log1.includes('commit:-1'));
check('onSettle được gọi ngay sau onCommit', log1.indexOf('settle') === log1.indexOf('commit:-1') + 1);
check('onCancel KHÔNG được gọi khi đã commit', !log1.includes('cancel'));
check('onDrag được gọi nhiều lần trong lúc kéo (animation theo tay)', log1.filter(l => l.startsWith('drag:')).length >= 5);

console.log('\n=== Vuốt phải đủ ngưỡng kích hoạt onCommit(1) ===');
const el2 = document.createElement('div');
document.body.appendChild(el2);
const log2 = [];
SwipeNav.bind(el2, { onCommit: (dir) => log2.push('commit:' + dir) });
fireTouch(el2, 'touchstart', [{ x: 40, y: 50 }]);
[70, 100, 130, 160, 190, 220, 250, 280, 300].forEach(x => fireTouch(el2, 'touchmove', [{ x, y: 50 }]));
fireTouch(el2, 'touchend', []);
check('onCommit(1) được gọi (vuốt phải = dx dương)', log2.includes('commit:1'));

console.log('\n=== Vuốt NGẮN (dưới ngưỡng 55px) gọi onCancel, KHÔNG onCommit ===');
const el3 = document.createElement('div');
document.body.appendChild(el3);
const log3 = [];
SwipeNav.bind(el3, { onCommit: () => log3.push('commit'), onCancel: () => log3.push('cancel') });
fireTouch(el3, 'touchstart', [{ x: 100, y: 50 }]);
[90, 80, 70].forEach(x => fireTouch(el3, 'touchmove', [{ x, y: 50 }])); // chỉ đi 30px
fireTouch(el3, 'touchend', []);
check('onCancel được gọi khi vuốt ngắn', log3.includes('cancel'));
check('onCommit KHÔNG được gọi khi vuốt ngắn', !log3.includes('commit'));

console.log('\n=== Vuốt DỌC thuần tuý KHÔNG kích hoạt gì cả ===');
const el4 = document.createElement('div');
document.body.appendChild(el4);
const log4 = [];
SwipeNav.bind(el4, { onCommit: () => log4.push('commit'), onCancel: () => log4.push('cancel'), onDrag: () => log4.push('drag') });
fireTouch(el4, 'touchstart', [{ x: 100, y: 50 }]);
[90, 130, 170].forEach(y => fireTouch(el4, 'touchmove', [{ x: 100, y }])); // di chuyển dọc, ngang = 0
fireTouch(el4, 'touchend', []);
check('Vuốt dọc KHÔNG gọi onDrag/onCommit/onCancel gì cả', log4.length === 0);

console.log('\n=== shouldIgnore loại trừ đúng target — kịch bản thật: #app bao ngoài .cal-pane bên trong ===');
const outer = document.getElementById('outer');
const inner = document.getElementById('inner');
const outerLog = [];
SwipeNav.bind(outer, {
  shouldIgnore: (target) => !!target.closest('#inner'),
  onCommit: (dir) => outerLog.push('outer-commit:' + dir)
});
// Vuốt BẮT ĐẦU TRÊN #inner — outer phải shouldIgnore, không active gì cả
fireTouch(inner, 'touchstart', [{ x: 300, y: 50 }]);
[270, 240, 210, 180, 150, 120, 90, 60, 40].forEach(x => fireTouch(inner, 'touchmove', [{ x, y: 50 }]));
fireTouch(inner, 'touchend', []);
check('shouldIgnore chặn ĐÚNG — outer KHÔNG tự commit khi cử chỉ bắt đầu trong #inner', outerLog.length === 0);

console.log('\n=== Đối chứng: vuốt bắt đầu TRÊN outer (không qua #inner) vẫn hoạt động bình thường ===');
// #outer chứa #inner nhưng vuốt lần này target là chính outer (giả lập bằng dispatch trực tiếp lên outer)
fireTouch(outer, 'touchstart', [{ x: 300, y: 200 }]);
[270, 240, 210, 180, 150, 120, 90, 60, 40].forEach(x => fireTouch(outer, 'touchmove', [{ x, y: 200 }]));
fireTouch(outer, 'touchend', []);
check('Vuốt trực tiếp trên outer (target không phải #inner) vẫn kích hoạt onCommit', outerLog.includes('outer-commit:-1'));

console.log(`\n========== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ==========`);
process.exit(fail > 0 ? 1 : 0);
