// ============================================================
// js/tab-bar-position.js — Vị trí thanh tab chính (Hôm nay/Lịch/
// Thống kê/Thùng rác + cụm tiện ích): "top" (mặc định, dính ở đỉnh
// trang khi cuộn, hành vi gốc) hoặc "bottom" (cố định ở đáy màn hình,
// kiểu tab bar di động quen thuộc).
//
// ĐỔI BẰNG KÉO TRỰC TIẾP (không qua bảng chọn) — nhấn giữ ~500ms trên
// KHOẢNG TRỐNG của thanh (không phải trên 1 nút cụ thể bên trong) để
// kích hoạt, rồi rê ngón tay lên/xuống: cả thanh "bứt" khỏi vị trí neo
// và theo sát ngón tay theo trục dọc. Thả tay ở NỬA TRÊN màn hình →
// chốt "top", thả ở NỬA DƯỚI → chốt "bottom" — luôn animate "bay nốt"
// về đúng vị trí cuối cùng bằng transition, không snap tức thì.
//
// Dùng TOUCH EVENTS THUẦN, cùng convention với swipe-nav.js và
// long-press.js trong app này (xem lý do đầy đủ trong long-press.js:
// tránh trộn nhiều API sự kiện khác nhau cho cùng 1 vùng cảm ứng).
//
// Lưu trong localStorage riêng (CONFIG.STORAGE_KEYS.TAB_BAR_POSITION)
// — đây là preference HIỂN THỊ THUẦN TUÝ của thiết bị đang dùng,
// không phải dữ liệu người dùng (habit/event/check) cần đồng bộ lên
// server, nên KHÔNG đi qua Sync — mỗi thiết bị tự nhớ vị trí riêng
// của nó, giống hệt cách js/theme-toggle.js lưu theme cục bộ.
// ============================================================

const TabBarPosition = (() => {

  const HOLD_MS = 500;        // thời gian giữ yên trước khi kích hoạt kéo — khớp LongPress.DURATION_MS để nhất quán cảm giác trên toàn app
  const MOVE_TOLERANCE = 8;   // px — ngón tay di chuyển quá ngưỡng này TRƯỚC KHI đủ HOLD_MS thì huỷ, coi như đang cuộn/thao tác khác chứ không định giữ yên

  function get() {
    try {
      const v = localStorage.getItem(CONFIG.STORAGE_KEYS.TAB_BAR_POSITION);
      return v === 'bottom' ? 'bottom' : 'top'; // mặc định "top" nếu chưa từng lưu hoặc giá trị lạ
    } catch (e) {
      return 'top';
    }
  }

  function set(position) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.TAB_BAR_POSITION, position === 'bottom' ? 'bottom' : 'top');
    } catch (e) {}
  }

  // apply(tabsEl) — gắn/gỡ đúng class CSS lên phần tử thanh tab theo
  // vị trí đang lưu. Gọi 1 lần lúc mount (app.js) và mỗi khi người
  // dùng thả tay xong 1 lượt kéo hợp lệ.
  function apply(tabsEl) {
    const pos = get();
    tabsEl.classList.toggle('sticky-tabs', pos === 'top');
    tabsEl.classList.toggle('sticky-tabs-bottom', pos === 'bottom');
    // #app cần chừa khoảng trống đáy bằng đúng chiều cao thanh tab khi
    // nó chuyển sang "bottom" (fixed, ra khỏi luồng layout bình
    // thường) — nếu không, nội dung cuối trang (nút "Thêm" cuối danh
    // sách habit chẳng hạn) sẽ bị thanh tab fixed đè lên, không bấm
    // được. Đo bằng ResizeObserver để tự cập nhật nếu chiều cao thanh
    // tab đổi (xoay màn hình, đổi cỡ chữ hệ thống...).
    const app = document.getElementById('app');
    if (pos === 'bottom') {
      const syncPadding = () => {
        app.style.paddingBottom = `calc(${tabsEl.offsetHeight}px + 1.5rem)`;
      };
      syncPadding();
      if (!tabsEl.__bottomPadObserver) {
        tabsEl.__bottomPadObserver = new ResizeObserver(syncPadding);
        tabsEl.__bottomPadObserver.observe(tabsEl);
      }
    } else {
      app.style.paddingBottom = '';
      if (tabsEl.__bottomPadObserver) {
        tabsEl.__bottomPadObserver.disconnect();
        tabsEl.__bottomPadObserver = null;
      }
    }
  }

  // bind(tabsEl, onChange) — gắn cử chỉ "giữ rồi kéo dọc" lên chính
  // thanh tab. shouldIgnore loại trừ khi cử chỉ bắt đầu TRÊN 1 NÚT CỤ
  // THỂ bên trong thanh (mọi <button> con) — long-press vào 1 nút lẽ
  // ra để làm việc của riêng nút đó (hiện #nav-theme có cử chỉ dọc
  // RIÊNG của chính nó, xem theme-quick-picker.js — 2 nhu cầu "giữ rồi
  // rê dọc" không thể cùng lắng nghe 1 điểm chạm). Chỉ khoảng TRỐNG
  // giữa/xung quanh các nút mới kích hoạt kéo cả thanh.
  function bind(tabsEl, onChange) {
    let timer = null;
    let dragging = false;
    let startX = 0, startY = 0;
    let startTop = 0; // vị trí Y ban đầu của thanh trên màn hình lúc bắt đầu kéo — dùng để tính offset kéo

    function shouldIgnore(target) {
      return !!target.closest('button');
    }

    function clearTimer() {
      if (timer) { clearTimeout(timer); timer = null; }
    }

    // Huỷ hẳn giai đoạn "đang chờ đủ HOLD_MS" — khác clearTimer() đơn
    // thuần (chỉ dừng đếm giờ): gỡ luôn phản hồi thị giác is-long-
    // pressing đã bật lúc chạm xuống, dùng khi xác định RÕ RÀNG người
    // dùng không có ý định giữ yên (di chuyển quá ngưỡng, hoặc nhấc
    // tay lên trước khi đủ thời gian).
    function cancelPending() {
      clearTimer();
      tabsEl.classList.remove('is-long-pressing');
    }

    function beginDrag() {
      dragging = true;
      const rect = tabsEl.getBoundingClientRect();
      startTop = rect.top;
      tabsEl.classList.remove('is-long-pressing');
      tabsEl.classList.add('tab-bar-dragging');
      // Khoá vị trí hiện tại bằng position:fixed ngay tại toạ độ đang
      // đứng, để tránh "giật" 1 khung hình khi lớp CSS sticky/fixed cũ
      // vẫn còn tác động trong lúc bắt đầu kéo bằng tay.
      tabsEl.style.position = 'fixed';
      tabsEl.style.left = `${tabsEl.getBoundingClientRect().left}px`;
      tabsEl.style.top = `${startTop}px`;
      tabsEl.style.right = 'auto';
      tabsEl.style.bottom = 'auto';
      tabsEl.style.margin = '0';
      tabsEl.style.zIndex = '50';
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    }

    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      if (shouldIgnore(e.target)) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      clearTimer();
      tabsEl.classList.add('is-long-pressing'); // phản hồi NHẸ ngay khi chạm xuống, nâng lên RÕ (tab-bar-dragging) khi đủ HOLD_MS
      timer = setTimeout(beginDrag, HOLD_MS);
    }

    function onTouchMove(e) {
      const t = e.touches[0];
      if (!dragging) {
        // Còn trong giai đoạn chờ đủ HOLD_MS — di chuyển quá ngưỡng
        // huỷ luôn (đang cuộn/vuốt, không phải giữ yên để kéo).
        if (timer) {
          const dx = Math.abs(t.clientX - startX);
          const dy = Math.abs(t.clientY - startY);
          if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) cancelPending();
        }
        return;
      }
      // Đang kéo thật — chặn cuộn trang mặc định, theo sát ngón tay
      // theo TRỤC DỌC (bám đúng toạ độ Y hiện tại của ngón tay trừ đi
      // khoảng lệch ban đầu giữa điểm chạm và mép trên của thanh, để
      // thanh không "nhảy cóc" về đúng dưới ngón tay ngay khung hình
      // đầu, mà giữ nguyên độ lệch ban đầu lúc chạm xuống).
      e.preventDefault();
      const offsetInBar = startY - startTop; // khoảng cách từ điểm chạm ban đầu tới mép trên thanh
      let newTop = t.clientY - offsetInBar;
      const maxTop = window.innerHeight - tabsEl.offsetHeight;
      newTop = Math.max(0, Math.min(newTop, maxTop));
      tabsEl.style.top = `${newTop}px`;
    }

    function onTouchEnd() {
      cancelPending();
      if (!dragging) return;
      dragging = false;
      tabsEl.classList.remove('tab-bar-dragging');

      // Quyết định "top" hay "bottom" theo vị trí TRUNG ĐIỂM thanh so
      // với nửa trên/dưới màn hình lúc thả tay — trực quan hơn so với
      // chỉ so điểm chạm, vì người dùng cảm nhận theo cả khối thanh
      // đang trôi tới đâu, không chỉ đầu ngón tay.
      const rect = tabsEl.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const chosen = midY < window.innerHeight / 2 ? 'top' : 'bottom';
      const changed = chosen !== get();
      set(chosen);

      // "Bay nốt" về đúng vị trí neo cuối cùng (top:0 dính đỉnh, hoặc
      // đáy màn hình) bằng transition, rồi dọn sạch style tạm để
      // apply() (class sticky-tabs/sticky-tabs-bottom trong CSS) tiếp
      // quản vị trí lâu dài — không giữ position:fixed tay tự set ở
      // đây mãi, chỉ dùng trong lúc animate.
      const targetTop = chosen === 'top' ? 0 : window.innerHeight - tabsEl.offsetHeight;
      tabsEl.style.transition = 'top 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
      tabsEl.style.top = `${targetTop}px`;

      const cleanup = () => {
        tabsEl.style.transition = '';
        tabsEl.style.position = '';
        tabsEl.style.left = '';
        tabsEl.style.top = '';
        tabsEl.style.right = '';
        tabsEl.style.bottom = '';
        tabsEl.style.margin = '';
        tabsEl.style.zIndex = '';
        apply(tabsEl);
        if (changed && navigator.vibrate) { try { navigator.vibrate(14); } catch (e) {} }
        if (changed && typeof onChange === 'function') onChange(chosen);
        tabsEl.removeEventListener('transitionend', cleanup);
      };
      tabsEl.addEventListener('transitionend', cleanup);
    }

    function onTouchCancel() {
      cancelPending();
      if (!dragging) return;
      dragging = false;
      tabsEl.classList.remove('tab-bar-dragging');
      // Huỷ giữa chừng (cuộc gọi tới, chuyển app...) — trôi VỀ vị trí
      // đã lưu trước đó (không đổi gì), không để thanh kẹt lại giữa
      // màn hình.
      const pos = get();
      const targetTop = pos === 'top' ? 0 : window.innerHeight - tabsEl.offsetHeight;
      tabsEl.style.transition = 'top 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
      tabsEl.style.top = `${targetTop}px`;
      const cleanup = () => {
        tabsEl.style.transition = '';
        tabsEl.style.position = '';
        tabsEl.style.left = '';
        tabsEl.style.top = '';
        tabsEl.style.right = '';
        tabsEl.style.bottom = '';
        tabsEl.style.margin = '';
        tabsEl.style.zIndex = '';
        apply(tabsEl);
        tabsEl.removeEventListener('transitionend', cleanup);
      };
      tabsEl.addEventListener('transitionend', cleanup);
    }

    tabsEl.addEventListener('touchstart', onTouchStart, { passive: true });
    tabsEl.addEventListener('touchmove', onTouchMove, { passive: false });
    tabsEl.addEventListener('touchend', onTouchEnd, { passive: true });
    tabsEl.addEventListener('touchcancel', onTouchCancel, { passive: true });
    // Chặn menu ngữ cảnh gốc (giữ lâu trên mobile mặc định hiện menu
    // "Sao chép/Chia sẻ") — xung đột trực tiếp với cử chỉ giữ-để-kéo.
    tabsEl.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  return { get, set, apply, bind };
})();
