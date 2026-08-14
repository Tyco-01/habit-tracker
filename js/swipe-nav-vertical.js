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
//       tách riêng giữ mỗi file 1 trách nhiệm rõ ràng, đúng tinh thần
//       modular hoá đã áp dụng cho toàn bộ codebase (xem sync/*.js).
//
// Toàn bộ API/hành vi CÒN LẠI giống hệt swipe-nav.js — xem file đó để
// đọc giải thích đầy đủ về "giọt lỏng" (onDrag theo thời gian thực),
// COMMIT_THRESHOLD_PX, lý do dùng touch events thuần thay vì Pointer
// Events. Ở đây chỉ ghi chú phần THỰC SỰ khác biệt (đảo trục).
// ============================================================

const SwipeNavVertical = (() => {

  const COMMIT_THRESHOLD_PX = 40; // ngắn hơn bản ngang (55px) — vùng cột dọc hẹp hơn nhiều bề rộng màn hình full-width mà bản ngang áp dụng, quãng kéo hợp lý để "chắc chắn là cố ý" cũng ngắn theo tỉ lệ
  const DIRECTION_LOCK_PX = 10;

  // options giống hệt swipe-nav.js, chỉ đổi Ý NGHĨA tham số truyền
  // vào callback: onDrag(dy) — dy dương = kéo XUỐNG, âm = kéo LÊN.
  // onCommit(dir) — dir = 1 (kéo xuống, "tiến") | -1 (kéo lên, "lùi").
  function bind(el, { onDrag, onCommit, onSettle, onCancel, onLockVertical, shouldIgnore } = {}) {
    let active = false;
    let lockedVertical = false;
    let startX = 0, startY = 0, lastDy = 0;

    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      if (typeof shouldIgnore === 'function' && shouldIgnore(e.target)) return;
      active = true;
      lockedVertical = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lastDy = 0;
    }

    function onTouchMove(e) {
      if (!active) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!lockedVertical) {
        if (Math.abs(dy) > DIRECTION_LOCK_PX && Math.abs(dy) > Math.abs(dx)) {
          lockedVertical = true;
          if (typeof onLockVertical === 'function') onLockVertical();
        } else if (Math.abs(dx) > DIRECTION_LOCK_PX) {
          // Rõ ràng là cử chỉ NGANG (không phải ý định của cột dọc
          // này) — buông hẳn, không preventDefault gì cả.
          active = false;
          return;
        } else {
          return;
        }
      }

      // Đã khoá dọc — chặn cuộn trang mặc định (el là vùng NHỎ, cố
      // định — chặn cuộn ở đây không ảnh hưởng cuộn nội dung lịch bên
      // cạnh, vì đó là 1 vùng DOM khác hẳn, xem year.js).
      e.preventDefault();
      lastDy = dy;
      if (typeof onDrag === 'function') onDrag(dy);
    }

    function onTouchEnd() {
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

    function onTouchCancel() {
      if (!active) return;
      active = false;
      const wasLocked = lockedVertical;
      lockedVertical = false;
      lastDy = 0;
      if (wasLocked && typeof onCancel === 'function') onCancel();
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return function unbind() {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }

  return { bind, COMMIT_THRESHOLD_PX };
})();
