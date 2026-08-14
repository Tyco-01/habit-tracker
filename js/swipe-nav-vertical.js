// ============================================================
// js/swipe-nav-vertical.js — Anh em song sinh của swipe-nav.js, NHƯNG
// khoá theo TRỤC DỌC thay vì ngang. Tách file riêng thay vì thêm
// option "axis" vào swipe-nav.js gốc — 2 lý do:
//   (1) swipe-nav.js đang được dùng ở NHIỀU nơi (4-tab chính trong
//       app.js) với logic "nếu phát hiện dy lớn hơn dx thì buông
//       hẳn, nhường cuộn dọc cho trình duyệt" — đảo ngược logic đó
//       thành "buông nếu dx lớn hơn dy" cho 1 use-case dọc duy nhất
//       sẽ làm file gốc khó đọc hơn cho MỌI nơi khác đang dùng nó.
//   (2) Chỉ 1 nơi cần bản dọc (cal-switcher-vertical, xem year.js) —
//       tách riêng giữ mỗi file 1 trách nhiệm rõ ràng.
//
// HỖ TRỢ CẢ CẢM ỨNG LẪN CHUỘT — bản đầu chỉ nghe touch events, không
// kéo được bằng chuột trên desktop/web (lỗi thật đã báo lại, cùng gốc
// với tab-bar-position.js). Cùng cách sửa: 1 lõi xử lý chung nhận toạ
// độ trừu tượng, 2 lớp adapter mỏng (touch/mouse) gọi vào lõi đó — xem
// giải thích đầy đủ hơn ở đầu tab-bar-position.js.
// ============================================================

const SwipeNavVertical = (() => {

  const COMMIT_THRESHOLD_PX = 40; // ngắn hơn bản ngang (55px) — vùng cột dọc hẹp hơn nhiều bề rộng màn hình full-width mà bản ngang áp dụng, quãng kéo hợp lý để "chắc chắn là cố ý" cũng ngắn theo tỉ lệ
  const DIRECTION_LOCK_PX = 10;

  // options giống hệt swipe-nav.js, chỉ đổi Ý NGHĨA tham số truyền
  // vào callback: onDrag(dy) — dy dương = kéo/rê XUỐNG, âm = LÊN.
  // onCommit(dir) — dir = 1 (xuống, "tiến") | -1 (lên, "lùi").
  function bind(el, { onDrag, onCommit, onSettle, onCancel, onLockVertical, shouldIgnore } = {}) {
    let active = false;
    let lockedVertical = false;
    let startX = 0, startY = 0, lastDy = 0;

    // ---- Lõi dùng chung cho touch và mouse ----

    function coreStart(x, y, target) {
      if (typeof shouldIgnore === 'function' && shouldIgnore(target)) return false;
      active = true;
      lockedVertical = false;
      startX = x;
      startY = y;
      lastDy = 0;
      return true;
    }

    function coreMove(x, y, preventDefault) {
      if (!active) return;
      const dx = x - startX;
      const dy = y - startY;

      if (!lockedVertical) {
        if (Math.abs(dy) > DIRECTION_LOCK_PX && Math.abs(dy) > Math.abs(dx)) {
          lockedVertical = true;
          if (typeof onLockVertical === 'function') onLockVertical();
        } else if (Math.abs(dx) > DIRECTION_LOCK_PX) {
          // Rõ ràng là cử chỉ NGANG (không phải ý định của cột dọc
          // này) — buông hẳn.
          active = false;
          return;
        } else {
          return;
        }
      }

      // Đã khoá dọc — chặn cuộn/chọn text mặc định, báo dy mới.
      if (preventDefault) preventDefault();
      lastDy = dy;
      if (typeof onDrag === 'function') onDrag(dy);
    }

    function coreEnd() {
      if (!active) return;
      active = false;
      if (!lockedVertical) return;
      lockedVertical = false;

      if (Math.abs(lastDy) >= COMMIT_THRESHOLD_PX) {
        const dir = lastDy > 0 ? 1 : -1;
        if (typeof onCommit === 'function') onCommit(dir);
        if (typeof onSettle === 'function') onSettle();
      } else {
        if (typeof onCancel === 'function') onCancel();
      }
      lastDy = 0;
    }

    function coreCancel() {
      if (!active) return;
      active = false;
      const wasLocked = lockedVertical;
      lockedVertical = false;
      lastDy = 0;
      if (wasLocked && typeof onCancel === 'function') onCancel();
    }

    // ---- Adapter touch ----

    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      coreStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
    }
    function onTouchMove(e) {
      const t = e.touches[0];
      coreMove(t.clientX, t.clientY, () => e.preventDefault());
    }
    function onTouchEnd() { coreEnd(); }
    function onTouchCancel() { coreCancel(); }

    // ---- Adapter chuột — mousemove/mouseup trên document (con trỏ
    // có thể trôi ra ngoài phạm vi el trong lúc kéo), cùng lý do đã
    // giải thích trong tab-bar-position.js. ----

    let mouseActive = false;

    function onMouseDown(e) {
      if (e.button !== 0) return;
      const started = coreStart(e.clientX, e.clientY, e.target);
      if (started === false) return;
      mouseActive = true;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }
    function onMouseMove(e) {
      if (!mouseActive) return;
      coreMove(e.clientX, e.clientY, () => e.preventDefault());
    }
    function onMouseUp() {
      if (!mouseActive) return;
      mouseActive = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      coreEnd();
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });
    el.addEventListener('mousedown', onMouseDown);

    return function unbind() {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
      el.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }

  return { bind, COMMIT_THRESHOLD_PX };
})();
