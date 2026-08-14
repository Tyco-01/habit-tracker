// ============================================================
// js/tab-bar-position.js — Vị trí thanh tab chính (Hôm nay/Lịch/
// Thống kê/Thùng rác + cụm tiện ích): "top" (mặc định, dính ở đỉnh
// trang khi cuộn, hành vi gốc) hoặc "bottom" (cố định ở đáy màn hình,
// kiểu tab bar di động quen thuộc).
//
// ĐỔI BẰNG KÉO TRỰC TIẾP (không qua bảng chọn) — nhấn giữ ~500ms trên
// KHOẢNG TRỐNG của thanh (không phải trên 1 nút cụ thể bên trong) để
// kích hoạt, rồi rê lên/xuống: cả thanh "bứt" khỏi vị trí neo và theo
// sát con trỏ/ngón tay theo trục dọc. Thả ở NỬA TRÊN màn hình → chốt
// "top", thả ở NỬA DƯỚI → chốt "bottom" — luôn animate "bay nốt" về
// đúng vị trí cuối cùng bằng transition, không snap tức thì.
//
// HỖ TRỢ CẢ CẢM ỨNG (điện thoại) LẪN CHUỘT (desktop/web) — bản đầu
// tiên CHỈ nghe touch events, khiến toàn bộ tính năng này vô dụng
// trên desktop (không kéo được gì bằng chuột, đây là lỗi thật đã báo
// lại). Sửa bằng 1 lớp "input nguồn" chung ở dưới: mọi logic tính
// toán (HOLD_MS, ngưỡng di chuyển, giới hạn top/bottom, animate bay
// nốt...) CHỈ VIẾT 1 LẦN DUY NHẤT, nhận toạ độ (x, y) trừu tượng từ 1
// trong 2 nguồn — không lặp lại 2 bộ handler gần giống hệt nhau cho
// touch và mouse (lặp code kiểu đó rất dễ sửa 1 bên quên bên kia sau
// này). Bên dưới lắng nghe CẢ touchstart VÀ mousedown trên cùng phần
// tử; trình duyệt không bao giờ bắn cả 2 loại event cho cùng 1 lần
// tương tác thật (cảm ứng hoặc chuột, không bao giờ cả hai), nên
// không có nguy cơ handler chạy đúp.
//
// Lưu trong localStorage riêng (CONFIG.STORAGE_KEYS.TAB_BAR_POSITION)
// — đây là preference HIỂN THỊ THUẦN TUÝ của thiết bị đang dùng,
// không phải dữ liệu người dùng (habit/event/check) cần đồng bộ lên
// server, nên KHÔNG đi qua Sync — mỗi thiết bị tự nhớ vị trí riêng
// của nó, giống hệt cách js/theme-toggle.js lưu theme cục bộ.
// ============================================================

const TabBarPosition = (() => {

  const HOLD_MS = 500;        // thời gian giữ yên trước khi kích hoạt kéo — khớp LongPress.DURATION_MS để nhất quán cảm giác trên toàn app
  const MOVE_TOLERANCE = 8;   // px — di chuyển quá ngưỡng này TRƯỚC KHI đủ HOLD_MS thì huỷ, coi như đang cuộn/thao tác khác chứ không định giữ yên

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
  // dùng thả xong 1 lượt kéo hợp lệ.
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
  // thanh tab, hoạt động với CẢ chạm lẫn chuột. shouldIgnore loại trừ
  // khi cử chỉ bắt đầu TRÊN 1 NÚT CỤ THỂ bên trong thanh (mọi <button>
  // con) — giữ lâu vào 1 nút lẽ ra để làm việc của riêng nút đó (hiện
  // #nav-theme có cử chỉ dọc RIÊNG của chính nó, xem theme-quick-
  // picker.js). Chỉ khoảng TRỐNG giữa/xung quanh các nút mới kích hoạt
  // kéo cả thanh.
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
    // pressing đã bật lúc bắt đầu chạm/nhấn, dùng khi xác định RÕ RÀNG
    // không có ý định giữ yên (di chuyển quá ngưỡng, hoặc buông trước
    // khi đủ thời gian).
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
      // vẫn còn tác động trong lúc bắt đầu kéo.
      tabsEl.style.position = 'fixed';
      tabsEl.style.left = `${tabsEl.getBoundingClientRect().left}px`;
      tabsEl.style.top = `${startTop}px`;
      tabsEl.style.right = 'auto';
      tabsEl.style.bottom = 'auto';
      tabsEl.style.margin = '0';
      tabsEl.style.zIndex = '50';
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    }

    // ---- Phần LÕI dùng chung cho cả touch và mouse — nhận toạ độ
    // (x, y) trừu tượng, không quan tâm nguồn gốc từ đâu. ----

    function handleStart(x, y, target) {
      if (shouldIgnore(target)) return false;
      startX = x;
      startY = y;
      clearTimer();
      tabsEl.classList.add('is-long-pressing'); // phản hồi NHẸ ngay khi bắt đầu, nâng lên RÕ (tab-bar-dragging) khi đủ HOLD_MS
      timer = setTimeout(beginDrag, HOLD_MS);
      return true;
    }

    function handleMove(x, y, preventDefault) {
      if (!dragging) {
        // Còn trong giai đoạn chờ đủ HOLD_MS — di chuyển quá ngưỡng
        // huỷ luôn (đang cuộn/thao tác khác, không phải giữ yên để kéo).
        if (timer) {
          const dx = Math.abs(x - startX);
          const dy = Math.abs(y - startY);
          if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) cancelPending();
        }
        return;
      }
      // Đang kéo thật — chặn cuộn/chọn text mặc định, theo sát toạ độ
      // theo TRỤC DỌC (bám đúng Y hiện tại trừ đi khoảng lệch ban đầu
      // giữa điểm bắt đầu và mép trên của thanh, để thanh không "nhảy
      // cóc" về đúng dưới con trỏ ngay khung hình đầu, mà giữ nguyên
      // độ lệch ban đầu lúc bắt đầu).
      if (preventDefault) preventDefault();
      const offsetInBar = startY - startTop;
      let newTop = y - offsetInBar;
      const maxTop = window.innerHeight - tabsEl.offsetHeight;
      newTop = Math.max(0, Math.min(newTop, maxTop));
      tabsEl.style.top = `${newTop}px`;
    }

    function handleEnd() {
      cancelPending();
      if (!dragging) return;
      dragging = false;
      tabsEl.classList.remove('tab-bar-dragging');

      // Quyết định "top" hay "bottom" theo vị trí TRUNG ĐIỂM thanh so
      // với nửa trên/dưới màn hình lúc buông — trực quan hơn so với
      // chỉ so điểm chạm/con trỏ, vì người dùng cảm nhận theo cả khối
      // thanh đang trôi tới đâu, không chỉ 1 điểm.
      const rect = tabsEl.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const chosen = midY < window.innerHeight / 2 ? 'top' : 'bottom';
      const changed = chosen !== get();
      set(chosen);

      // "Bay nốt" về đúng vị trí neo cuối cùng (top:0 dính đỉnh, hoặc
      // đáy màn hình) bằng transition, rồi dọn sạch style tạm để
      // apply() (class sticky-tabs/sticky-tabs-bottom trong CSS) tiếp
      // quản vị trí lâu dài.
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

    function handleCancel() {
      cancelPending();
      if (!dragging) return;
      dragging = false;
      tabsEl.classList.remove('tab-bar-dragging');
      // Huỷ giữa chừng — trôi VỀ vị trí đã lưu trước đó (không đổi
      // gì), không để thanh kẹt lại giữa màn hình.
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

    // ---- Adapter TOUCH — chuyển touch event → gọi phần lõi chung ----

    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      handleStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
    }
    function onTouchMove(e) {
      const t = e.touches[0];
      handleMove(t.clientX, t.clientY, () => e.preventDefault());
    }
    function onTouchEnd() { handleEnd(); }
    function onTouchCancel() { handleCancel(); }

    // ---- Adapter CHUỘT — chuyển mouse event → gọi phần lõi chung.
    // mousemove/mouseup gắn lên document (không phải tabsEl) vì con
    // trỏ chuột có thể trôi ra ngoài phạm vi thanh trong lúc kéo —
    // touch không cần vậy vì trình duyệt tự động gửi touchmove tiếp
    // theo về đúng phần tử đã touchstart bất kể ngón tay di chuyển tới
    // đâu (semantics khác nhau giữa 2 API, đây không phải sơ suất). ----

    let mouseDragActive = false;

    function onMouseDown(e) {
      if (e.button !== 0) return; // chỉ nút trái chuột
      const started = handleStart(e.clientX, e.clientY, e.target);
      if (started === false) return;
      mouseDragActive = true;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }
    function onMouseMove(e) {
      if (!mouseDragActive) return;
      handleMove(e.clientX, e.clientY, () => e.preventDefault());
    }
    function onMouseUp() {
      if (!mouseDragActive) return;
      mouseDragActive = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      handleEnd();
    }

    tabsEl.addEventListener('touchstart', onTouchStart, { passive: true });
    tabsEl.addEventListener('touchmove', onTouchMove, { passive: false });
    tabsEl.addEventListener('touchend', onTouchEnd, { passive: true });
    tabsEl.addEventListener('touchcancel', onTouchCancel, { passive: true });
    tabsEl.addEventListener('mousedown', onMouseDown);

    // ---- 3 lối tắt DỰ PHÒNG cho desktop, không cần giữ+kéo — hữu ích
    // khi bàn tay đang bận chuột/bàn phím hoặc thao tác kéo bất tiện
    // (yêu cầu thêm sau khi báo "kéo-giữ khó dùng trên web"): ----

    // (1) CHUỘT PHẢI trên khoảng trống thanh tab → menu nhỏ 2 lựa chọn.
    // preventDefault() chặn context menu gốc của trình duyệt (vốn đã
    // bị chặn ở dưới cho MỌI right-click trên thanh, xem addEventListener
    // 'contextmenu' cuối file) — ở đây xử lý RIÊNG khi target không
    // phải 1 nút con, để show quick-menu thay vì chỉ im lặng chặn.
    function onContextMenu(e) {
      if (shouldIgnore(e.target)) return; // right-click ngay trên 1 nút — không hiện quick-menu, giữ hành vi mặc định đã bị chặn ở listener chung bên dưới (không mở menu gì cả, đúng như trước)
      e.preventDefault();
      showQuickMenu(e.clientX, e.clientY);
    }

    // (2) LĂN CHUỘT trên khoảng trống thanh tab → đổi ngay lập tức,
    // không cần giữ gì cả. Lăn XUỐNG (deltaY > 0, cảm giác "cuộn tới")
    // → chuyển "bottom"; lăn LÊN → "top". Bỏ qua nếu target là 1 nút
    // con (không lăn chuột trúng nút bao giờ có ý nghĩa gì khác).
    let wheelDebounce = null;
    function onWheel(e) {
      if (shouldIgnore(e.target)) return;
      e.preventDefault();
      // Debounce nhẹ (150ms) — 1 lần lăn chuột thường bắn NHIỀU sự
      // kiện wheel liên tiếp rất nhanh (trackpad đặc biệt hay vậy);
      // không debounce sẽ khiến 1 cái lăn tay nhẹ nhàng bị hiểu thành
      // "đổi qua đổi lại nhiều lần" dồn dập, gây giật hoặc đổi nhầm
      // ngược ý định.
      if (wheelDebounce) return;
      const target = e.deltaY > 0 ? 'bottom' : 'top';
      if (target !== get()) {
        set(target);
        apply(tabsEl);
        if (navigator.vibrate) { try { navigator.vibrate(10); } catch (err) {} }
        if (typeof onChange === 'function') onChange(target);
      }
      wheelDebounce = setTimeout(() => { wheelDebounce = null; }, 150);
    }

    // (3) PHÍM MŨI TÊN LÊN/XUỐNG khi thanh tab đang được FOCUS (bấm
    // Tab để focus tới, hoặc click/chạm vào khoảng trống — xem
    // tabindex="0" gắn trên #tab-bar-outer trong app.js). Mũi tên
    // XUỐNG → "bottom", LÊN → "top" — cùng chiều trực giác với cử chỉ
    // kéo tay/lăn chuột ở trên, nhất quán toàn bộ 4 cách.
    function onKeyDown(e) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      // Đang gõ trong 1 ô nhập liệu nào đó vô tình nằm trong thanh tab
      // (hiện không có, nhưng phòng hờ mở rộng sau này) — không can
      // thiệp phím mũi tên của người dùng đang gõ chữ.
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      const target = e.key === 'ArrowDown' ? 'bottom' : 'top';
      if (target !== get()) {
        set(target);
        apply(tabsEl);
        if (typeof onChange === 'function') onChange(target);
      }
    }

    tabsEl.addEventListener('contextmenu', onContextMenu);
    tabsEl.addEventListener('wheel', onWheel, { passive: false });
    tabsEl.addEventListener('keydown', onKeyDown);
  }

  // ---- Menu nhỏ hiện khi chuột phải vào thanh tab — 2 lựa chọn Lên
  // trên/Xuống dưới. Tự đóng khi bấm ra ngoài hoặc chọn xong. Tái sử
  // dụng 1 phần tử DOM duy nhất (tạo lúc cần, xoá lúc đóng) thay vì
  // giữ sẵn ẩn/hiện — quick-menu hiếm khi mở, không cần tối ưu tái
  // dùng DOM cho trường hợp hiếm gặp này. ----
  function showQuickMenu(x, y) {
    const existing = document.querySelector('.tab-bar-quick-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'tab-bar-quick-menu';
    menu.innerHTML = `
      <button data-pos="top"><i class="ti ti-arrow-bar-to-up" aria-hidden="true"></i> Chuyển lên trên</button>
      <button data-pos="bottom"><i class="ti ti-arrow-bar-to-down" aria-hidden="true"></i> Chuyển xuống dưới</button>
    `;
    document.body.appendChild(menu);

    // Canh vị trí SAU KHI đã có kích thước thật (offsetWidth/Height),
    // kẹp trong viewport để menu không tràn ra ngoài mép phải/dưới khi
    // right-click gần biên màn hình.
    const menuW = menu.offsetWidth;
    const menuH = menu.offsetHeight;
    const left = Math.min(x, window.innerWidth - menuW - 8);
    const top = Math.min(y, window.innerHeight - menuH - 8);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;

    function close() {
      menu.remove();
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('keydown', onEsc);
    }
    function onOutside(e) {
      if (!menu.contains(e.target)) close();
    }
    function onEsc(e) {
      if (e.key === 'Escape') close();
    }
    menu.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const pos = btn.dataset.pos;
        const tabsEl = document.querySelector('#tab-bar-outer');
        if (tabsEl && pos !== get()) {
          set(pos);
          apply(tabsEl);
        }
        close();
      });
    });
    // setTimeout 0 — tránh chính sự kiện mousedown/contextmenu VỪA MỞ
    // menu này bị listener onOutside bắt luôn trong cùng 1 lượt bubble,
    // đóng ngay lập tức lúc vừa mở.
    setTimeout(() => {
      document.addEventListener('mousedown', onOutside, true);
      document.addEventListener('keydown', onEsc);
    }, 0);
  }

  return { get, set, apply, bind };
})();
