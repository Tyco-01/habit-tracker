// ============================================================
// js/swipe-hint.js — Nhãn nổi nhỏ hiện NGAY KHI bắt đầu 1 cử chỉ vuốt
// ngang, báo cho người dùng biết mình đang vuốt để làm gì (đổi tab
// lớn, đổi chế độ xem lịch, hay lật trang) và đang hướng tới đâu — để
// không nhầm lẫn giữa 3 loại vuốt khác nhau cùng tồn tại trong app.
//
// Dùng CHUNG cho cả 3 nơi gọi SwipeNav.bind() (app.js cho 4-tab lớn,
// year.js cho .cal-switcher và .cal-pane) — mỗi nơi chỉ cần gọi
// SwipeHint.show(text) lúc onLockHorizontal và SwipeHint.hide() lúc
// onSettle/onCancel, không cần tự vẽ UI riêng.
// ============================================================

const SwipeHint = (() => {

  let el = null;

  function ensureEl() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'swipe-hint';
    document.body.appendChild(el);
    return el;
  }

  // show(text) — hiện nhãn với nội dung text (vd "→ Lịch", "← Hôm nay").
  // Gọi lại nhiều lần với text khác để ĐỔI nội dung mà không tắt/bật
  // lại animation (dùng khi người dùng đổi hướng kéo giữa chừng).
  function show(text) {
    const hintEl = ensureEl();
    if (hintEl.textContent !== text) hintEl.textContent = text;
    hintEl.classList.add('is-visible');
  }

  function hide() {
    if (!el) return;
    el.classList.remove('is-visible');
  }

  return { show, hide };
})();
