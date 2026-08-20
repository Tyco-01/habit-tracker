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
  // con) — giữ lâu vào 1 nút lẽ ra để làm việc của riêng nút đó (nút
  // Home có cử chỉ dọc RIÊNG của chính nó, xem theme-quick-picker.js).
  // Chỉ khoảng TRỐNG giữa/xung quanh các nút mới kích hoạt kéo cả
  // thanh.
  //
  // HIỆU ỨNG "GHOST CLONE" — mô phỏng ĐÚNG cảm giác kéo-thả sắp xếp
  // habit (js/views/today.js: draggable="true" HTML5 DnD, xem
  // css/views/today.css .habit-row.dragging) theo yêu cầu cụ thể: bản
  // GỐC đứng YÊN tại chỗ trong lúc kéo, chỉ đổi diện mạo (mờ đi + viền
  // nét đứt, xem .tab-bar-drag-source trong CSS) — KHÔNG dùng
  // position:fixed di chuyển CHÍNH tabsEl như bản trước (đó là
  // nguyên nhân bản trước để lại "khoảng trống hoàn toàn, không có gì
  // đứng đó cả" khi đang kéo, khác hẳn cảm giác habit). Bản THẬT SỰ
  // bám theo tay là 1 CLONE riêng (ghostEl) — tạo mới lúc beginDrag(),
  // absolute/fixed theo viewport, xoá hẳn lúc kết thúc lượt kéo.
  // KHÔNG dùng HTML5 Drag and Drop API thật (draggable="true") như bên
  // habit — API đó CHỈ hoạt động với chuột trên desktop, hoàn toàn vô
  // dụng trên cảm ứng/mobile (đã xác nhận từ đợt sửa trước "kéo-giữ
  // khó dùng trên web" — vấn đề ngược lại, thiếu hỗ trợ CHUỘT, ở đây
  // là vấn đề thiếu hỗ trợ TOUCH nếu dùng draggable thật). Tự vẽ ghost
  // bằng JS thuần đảm bảo hoạt động đồng nhất trên CẢ 2 loại input.
  function bind(tabsEl, onChange) {
    let timer = null;
    let dragging = false;
    let startX = 0, startY = 0;
    let startTop = 0, startLeft = 0; // vị trí ban đầu của tabsEl trên màn hình lúc bắt đầu kéo — dùng để tính offset kéo VÀ vị trí xuất phát của ghost
    let ghostEl = null;

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
      startLeft = rect.left;
      tabsEl.classList.remove('is-long-pressing');
      // Bản GỐC đứng yên, chỉ đổi diện mạo — mờ đi + viền nét đứt,
      // đúng cảm giác .habit-row.dragging (css/views/today.css).
      // KHÔNG set position:fixed/transform gì lên chính tabsEl nữa.
      tabsEl.classList.add('tab-bar-drag-source');

      // Tạo GHOST CLONE — bản THẬT SỰ bám theo tay, đứng NGOÀI luồng
      // layout (position: fixed), nhân bản visually y hệt tabsEl thật
      // (dùng cloneNode(true) — copy cả nội dung 7 icon bên trong,
      // không phải 1 khung trống) tại ĐÚNG vị trí xuất phát của bản
      // gốc, để không có cú "nhảy" nào giữa lúc bắt đầu kéo.
      ghostEl = tabsEl.cloneNode(true);
      ghostEl.removeAttribute('id'); // tránh 2 phần tử trùng ID cùng lúc tồn tại trong DOM (tabsEl thật + ghost) — vi phạm HTML hợp lệ, có thể gây querySelector('#id') nhầm trúng ghost
      ghostEl.classList.add('tab-bar-drag-ghost');
      ghostEl.classList.remove('sticky-tabs', 'sticky-tabs-bottom', 'tab-bar-drag-source', 'is-long-pressing');
      ghostEl.style.position = 'fixed';
      ghostEl.style.left = `${startLeft}px`;
      ghostEl.style.top = `${startTop}px`;
      ghostEl.style.width = `${rect.width}px`;
      ghostEl.style.margin = '0';
      ghostEl.style.zIndex = '50';
      ghostEl.style.pointerEvents = 'none'; // ghost chỉ để NHÌN — mọi sự kiện chạm/chuột tiếp theo vẫn phải xuyên qua nó để tới đúng document (nơi onMouseMove/touchmove đang lắng nghe), không bị ghost chặn ngang
      document.body.appendChild(ghostEl);

      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    }

    // ---- Phần LÕI dùng chung cho cả touch và mouse — nhận toạ độ
    // (x, y) trừu tượng, không quan tâm nguồn gốc từ đâu. ----

    function handleStart(x, y, target) {
      if (shouldIgnore(target)) return false;
      startX = x;
      startY = y;
      clearTimer();
      tabsEl.classList.add('is-long-pressing'); // phản hồi NHẸ ngay khi bắt đầu, nâng lên RÕ (tab-bar-drag-source + ghost) khi đủ HOLD_MS
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
      // Đang kéo thật — chặn cuộn/chọn text mặc định, di chuyển GHOST
      // (không phải tabsEl gốc) theo sát toạ độ theo TRỤC DỌC (bám
      // đúng Y hiện tại trừ đi khoảng lệch ban đầu giữa điểm bắt đầu
      // và mép trên của thanh, để ghost không "nhảy cóc" về đúng dưới
      // con trỏ ngay khung hình đầu, mà giữ nguyên độ lệch ban đầu).
      if (preventDefault) preventDefault();
      if (!ghostEl) return;
      const offsetInBar = startY - startTop;
      let newTop = y - offsetInBar;
      const maxTop = window.innerHeight - ghostEl.offsetHeight;
      newTop = Math.max(0, Math.min(newTop, maxTop));
      ghostEl.style.top = `${newTop}px`;
    }

    // Dọn sạch ghost + diện mạo "nguồn đang kéo" của bản gốc — dùng
    // chung cho cả 2 đường thoát (commit hợp lệ / huỷ giữa chừng),
    // luôn gọi ngay khi biết CHẮC CHẮN lượt kéo đã hoàn toàn kết thúc.
    function cleanupGhost() {
      if (ghostEl) {
        ghostEl.remove();
        ghostEl = null;
      }
      tabsEl.classList.remove('tab-bar-drag-source');
    }

    function handleEnd() {
      cancelPending();
      if (!dragging) return;
      dragging = false;

      // Quyết định "top" hay "bottom" theo vị trí TRUNG ĐIỂM GHOST so
      // với nửa trên/dưới màn hình lúc buông — trực quan hơn so với
      // chỉ so điểm chạm/con trỏ, vì người dùng cảm nhận theo cả khối
      // ghost đang trôi tới đâu, không chỉ 1 điểm.
      const rect = ghostEl ? ghostEl.getBoundingClientRect() : tabsEl.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const chosen = midY < window.innerHeight / 2 ? 'top' : 'bottom';
      const changed = chosen !== get();
      set(chosen);
      apply(tabsEl); // đổi diện mạo THẬT (sticky-tabs / sticky-tabs-bottom) NGAY LẬP TỨC trên tabsEl gốc — nó vẫn đứng nguyên vị trí cũ suốt lúc kéo, giờ mới thật sự "nhảy" sang vị trí mới, đồng thời với việc ghost biến mất
      cleanupGhost();
      if (changed && navigator.vibrate) { try { navigator.vibrate(14); } catch (e) {} }
      if (changed && typeof onChange === 'function') onChange(chosen);
    }

    function handleCancel() {
      cancelPending();
      if (!dragging) return;
      dragging = false;
      // Huỷ giữa chừng — không đổi gì, chỉ dọn ghost + trả bản gốc về
      // diện mạo bình thường (nó chưa từng rời khỏi vị trí cũ, không
      // cần animate "bay về" gì cả).
      cleanupGhost();
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

    // ---- 2 lối tắt DỰ PHÒNG cho desktop, không cần giữ+kéo — hữu ích
    // khi bàn tay đang bận chuột/bàn phím hoặc thao tác kéo bất tiện
    // (yêu cầu thêm sau khi báo "kéo-giữ khó dùng trên web"). Bản đầu
    // có thêm CHUỘT PHẢI → menu nhỏ, nhưng nhiều trình duyệt (đặc biệt
    // Brave, đã báo lại kèm ảnh chụp) tự VẼ ĐÈ menu ngữ cảnh GỐC của
    // hệ điều hành LÊN TRÊN bất kể preventDefault() có gọi hay không
    // trong một số cấu hình — khiến menu tự tạo tuy vẫn tồn tại trong
    // DOM (không lỗi JS) nhưng bị che khuất hoàn toàn, không đọc được.
    // Bỏ hẳn nhánh chuột phải, thay bằng NHẤP ĐÚP — đơn giản hơn, không
    // phụ thuộc hành vi context-menu khác nhau giữa các trình duyệt. ----

    // (1) NHẤP ĐÚP (double-click) trên khoảng trống thanh tab → đổi vị
    // trí NGAY LẬP TỨC, đảo ngược so với hiện tại (đang "top" → chuyển
    // "bottom" và ngược lại) — không cần chọn hướng, double-click vốn
    // đã là 1 thao tác "quả quyết", đảo ngược trực tiếp phù hợp hơn là
    // bắt chọn thêm 1 lần nữa qua menu.
    function onDblClick(e) {
      if (shouldIgnore(e.target)) return;
      const target = get() === 'top' ? 'bottom' : 'top';
      set(target);
      apply(tabsEl);
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch (err) {} }
      if (typeof onChange === 'function') onChange(target);
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
    // kéo tay/lăn chuột ở trên, nhất quán toàn bộ các cách.
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

    tabsEl.addEventListener('dblclick', onDblClick);
    tabsEl.addEventListener('wheel', onWheel, { passive: false });
    tabsEl.addEventListener('keydown', onKeyDown);
  }

  return { get, set, apply, bind };
})();
