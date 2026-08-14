// ============================================================
// js/tab-bar-position.js — Vị trí thanh tab chính (Hôm nay/Lịch/
// Thống kê/Thùng rác): "top" (mặc định, dính ở đỉnh trang khi cuộn,
// hành vi gốc) hoặc "bottom" (cố định ở đáy màn hình, kiểu tab bar
// di động quen thuộc). Đổi bằng NHẤN GIỮ vào chính thanh tab (không
// nhấn 1 nút cụ thể bên trong) — hiện bảng nhỏ 2 lựa chọn, bấm để áp
// dụng ngay.
//
// Lưu trong localStorage riêng (CONFIG.STORAGE_KEYS.TAB_BAR_POSITION)
// — đây là preference HIỂN THỊ THUẦN TUÝ của thiết bị đang dùng,
// không phải dữ liệu người dùng (habit/event/check) cần đồng bộ lên
// server, nên KHÔNG đi qua Sync — mỗi thiết bị tự nhớ vị trí riêng
// của nó, giống hệt cách js/theme-toggle.js lưu theme cục bộ.
// ============================================================

const TabBarPosition = (() => {

  const HOLD_MS = 500; // bằng đúng LongPress.DURATION_MS mặc định — dùng LongPress.bind() có sẵn thay vì tự viết timer riêng

  let panelEl = null;

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
  // dùng đổi lựa chọn qua bảng long-press.
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

  function ensurePanel() {
    if (panelEl) return panelEl;
    panelEl = document.createElement('div');
    panelEl.className = 'tab-bar-position-panel';
    panelEl.style.display = 'none';
    document.body.appendChild(panelEl);
    return panelEl;
  }

  function positionPanel(panel, tabsEl) {
    const r = tabsEl.getBoundingClientRect();
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    const margin = 8;
    let left = r.left + r.width / 2 - panelWidth / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));
    // Thanh tab TRÊN: bảng hiện NGAY DƯỚI thanh (tabsEl.bottom + gap).
    // Thanh tab DƯỚI: bảng hiện NGAY TRÊN thanh (tabsEl.top - height -
    // gap) — luôn mở về phía có nhiều chỗ trống hơn, không tràn khỏi
    // viewport theo chiều dọc dù thanh đang ở vị trí nào.
    const pos = get();
    const top = pos === 'bottom' ? r.top - panelHeight - 10 : r.bottom + 10;
    panel.style.left = `${left}px`;
    panel.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - panelHeight - margin))}px`;
  }

  function renderPanelContent(panel, tabsEl, onChange) {
    const current = get();
    panel.innerHTML = `
      <div class="tab-bar-position-option ${current === 'top' ? 'is-current' : ''}" data-pos="top">
        <i class="ti ti-layout-navbar" aria-hidden="true"></i>
        <span>Thanh tab ở trên</span>
      </div>
      <div class="tab-bar-position-option ${current === 'bottom' ? 'is-current' : ''}" data-pos="bottom">
        <i class="ti ti-layout-bottombar" aria-hidden="true"></i>
        <span>Thanh tab ở dưới</span>
      </div>
    `;
    panel.querySelectorAll('.tab-bar-position-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const chosen = opt.dataset.pos;
        close();
        if (chosen !== get()) {
          set(chosen);
          apply(tabsEl);
          if (navigator.vibrate) { try { navigator.vibrate(14); } catch (e) {} }
          if (typeof onChange === 'function') onChange(chosen);
        }
      });
    });
  }

  function open(tabsEl, onChange) {
    const panel = ensurePanel();
    renderPanelContent(panel, tabsEl, onChange);
    panel.style.display = 'flex';
    panel.style.visibility = 'hidden';
    positionPanel(panel, tabsEl);
    panel.style.visibility = 'visible';
    requestAnimationFrame(() => panel.classList.add('is-open'));
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) {} }
    // Đóng khi bấm ra ngoài — trễ 1 nhịp giống DayPreviewSheet để
    // tránh chính click tổng hợp sau long-press (touchend) vô tình
    // đóng ngay bảng vừa mở (xem js/day-preview-sheet.js,
    // IGNORE_OUTSIDE_CLICK_MS, cùng lý do).
    const openedAt = Date.now();
    const onOutsideClick = (e) => {
      if (!panel.contains(e.target) && Date.now() - openedAt > 350) {
        close();
        document.removeEventListener('click', onOutsideClick, true);
      }
    };
    document.addEventListener('click', onOutsideClick, true);
  }

  function close() {
    if (!panelEl) return;
    panelEl.classList.remove('is-open');
    setTimeout(() => { if (panelEl) panelEl.style.display = 'none'; }, 160);
  }

  // bind(tabsEl, onChange) — gắn long-press vào chính thanh tab để mở
  // bảng chọn vị trí. shouldIgnore loại trừ khi cử chỉ bắt đầu TRÊN 1
  // NÚT CỤ THỂ bên trong thanh (mọi <button> con) — long-press vào 1
  // nút lẽ ra để làm việc của riêng nút đó (hiện chỉ #nav-theme có
  // hành vi riêng, nhưng loại trừ luôn TẤT CẢ nút cho nhất quán logic:
  // "giữ vào NỀN thanh tab" mới là cử chỉ đổi vị trí, giữ vào 1 nút cụ
  // thể là ý định khác). Chỉ khoảng TRỐNG giữa các nút mới kích hoạt.
  function bind(tabsEl, onChange) {
    LongPress.bind(tabsEl, (el) => {
      open(el, onChange);
    }, {
      shouldIgnore: (target) => !!target.closest('button')
    });
  }

  return { get, set, apply, bind, open, close };
})();
